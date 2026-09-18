import crypto from "node:crypto";
import express from "express";
import { crearAgente } from "./agente.js";

/**
 * Sincronización con Meta Ads sin guardar credenciales de Meta en la app.
 *
 * La app no habla con Meta: deja una solicitud y un agente de Claude (que sí
 * tiene el MCP de Meta Ads) la toma, consulta los ads por nombre y devuelve
 * los números. Ver .claude/skills/sync-meta/SKILL.md.
 *
 *   Navegador (cookie)          Agente (Authorization: Bearer SYNC_TOKEN)
 *   POST /api/sync  ─ pendiente ─>  GET  /api/sync/agent
 *                                   POST /api/sync/agent/claim   (procesando)
 *   GET  /api/sync  <─ listo ────   POST /api/sync/agent/result  (actualiza ads)
 *
 * Dos tipos de solicitud comparten el mismo canal:
 *   - "inversion": trae la inversión total de los ads de la app (por nombre).
 *   - "fatiga": trae 90 días de métricas diarias de una cuenta para la
 *     página Fatiga (esquema de datos de src/studio/motor-fatiga.js).
 */

const ADKEY = "nova-ads:all:v1";
const STATE_KEY = "meta_sync";
export const FATIGA_KEY = "nova-fatiga:datos:v1";
const IDLE = { status: "inactivo" };

const safeEqual = (a, b) => {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const round2 = (v) => Math.round(v * 100) / 100;

export function syncRouter({ kv, requireAuth, wrap }) {
  const router = express.Router();
  const agente = crearAgente(kv);

  const readState = async () => {
    const raw = await kv.metaGet(STATE_KEY);
    return raw ? JSON.parse(raw) : IDLE;
  };
  const writeState = (state) => kv.metaSet(STATE_KEY, JSON.stringify(state));
  // Lo que ve el navegador: sin la lista completa de ads, y si hay un agente
  // que pueda responder (sin SYNC_TOKEN nadie puede tomar la solicitud).
  const publicState = ({ ads, ...rest }, hayAgente) => ({
    tipo: "inversion", ...rest, total: ads?.length ?? 0, agente: hayAgente,
  });
  const SIN_TOKEN = "Todavía no hay clave para Claude: genérala en Ajustes → Conexión con Claude.";

  /** Valida y guarda los datos diarios de la página Fatiga. Devuelve un error o el resumen. */
  const guardarFatiga = async (datos, metaBase, finishedAt) => {
    if (!datos || !Array.isArray(datos.diario) || !datos.diario.length) {
      return { error: "datos.diario debe ser un arreglo con filas" };
    }
    const bien = datos.diario.every((f) => f && typeof f.fecha === "string" && f.ad_id != null);
    if (!bien) return { error: "Cada fila necesita fecha (AAAA-MM-DD) y ad_id" };
    const guardado = {
      meta: { ...metaBase, ...(datos.meta || {}), fuente: "mcp", actualizado: finishedAt },
      anuncios: Array.isArray(datos.anuncios) ? datos.anuncios : [],
      diario: datos.diario,
    };
    await kv.set(FATIGA_KEY, JSON.stringify(guardado));
    return { filas: datos.diario.length, anuncios: new Set(datos.diario.map((f) => String(f.ad_id))).size };
  };

  const requireAgent = agente.requireAgente;

  /* ---------- clave del canal (se ve y se genera desde Ajustes) ---------- */
  router.get("/clave", requireAuth, wrap(async (_req, res) => {
    const { clave, origen } = await agente.leer();
    res.json({ hay: !!clave, origen, clave: origen === "app" ? clave : "" });
  }));

  router.post("/clave", requireAuth, wrap(async (_req, res) => {
    try {
      res.json({ hay: true, origen: "app", clave: await agente.generar() });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }));

  /* ---------- navegador ---------- */
  router.get("/", requireAuth, wrap(async (_req, res) => {
    res.json(publicState(await readState(), await agente.hay()));
  }));

  router.post("/", requireAuth, wrap(async (req, res) => {
    if (!(await agente.hay())) return res.status(503).json({ error: SIN_TOKEN });
    if (req.body?.tipo === "fatiga") {
      const { cuenta, dias = 90, metrica = "cpa", objetivo = null, etiqueta = "Compras" } = req.body;
      if (typeof cuenta !== "string" || !cuenta.trim()) {
        return res.status(400).json({ error: "Indica la cuenta de Meta (ID o nombre) en la configuración" });
      }
      const state = {
        id: crypto.randomUUID(),
        tipo: "fatiga",
        status: "pendiente",
        requestedAt: new Date().toISOString(),
        cuenta: cuenta.trim().slice(0, 120),
        dias: Math.min(90, Math.max(7, Number(dias) || 90)),
        metrica: metrica === "roas" ? "roas" : "cpa",
        objetivo: num(objetivo),
        etiqueta: String(etiqueta).slice(0, 40),
      };
      await writeState(state);
      return res.json(publicState(state, true));
    }
    const ads = (Array.isArray(req.body?.ads) ? req.body.ads : [])
      .filter((a) => a && typeof a.id === "string" && typeof a.nombre === "string")
      .map(({ id, nombre }) => ({ id, nombre }));
    if (!ads.length) return res.status(400).json({ error: "No hay ads lanzados para sincronizar" });
    const state = {
      id: crypto.randomUUID(),
      tipo: "inversion",
      status: "pendiente",
      requestedAt: new Date().toISOString(),
      ads,
    };
    await writeState(state);
    res.json(publicState(state, true));
  }));

  // Cancelar una solicitud que nadie tomó (o que quedó colgada).
  router.delete("/", requireAuth, wrap(async (_req, res) => {
    const state = await readState();
    if (!["pendiente", "procesando"].includes(state.status)) return res.json(publicState(state, await agente.hay()));
    const next = { ...state, status: "cancelado", finishedAt: new Date().toISOString() };
    await writeState(next);
    res.json(publicState(next, await agente.hay()));
  }));

  /* ---------- agente ---------- */
  router.get("/agent", requireAgent, wrap(async (_req, res) => {
    res.json(await readState());
  }));

  router.post("/agent/claim", requireAgent, wrap(async (req, res) => {
    const state = await readState();
    if (state.id !== req.body?.id || state.status !== "pendiente") {
      return res.status(409).json({ error: "La solicitud ya no está pendiente", state: publicState(state, true) });
    }
    const next = { ...state, status: "procesando", claimedAt: new Date().toISOString() };
    await writeState(next);
    res.json(next);
  }));

  /**
   * Envío directo de datos de fatiga, sin que nadie haya pulsado el botón
   * (por ejemplo cuando el usuario le dice a Claude "sincroniza").
   * Si hay una solicitud de fatiga abierta, la da por resuelta; si hay una de
   * inversión en curso, no la toca. body: { datos }
   */
  router.post("/agent/fatiga", requireAgent, wrap(async (req, res) => {
    const finishedAt = new Date().toISOString();
    const state = await readState();
    const abierta = ["pendiente", "procesando"].includes(state.status);
    const base = state.tipo === "fatiga" && abierta
      ? { metrica_rectora: state.metrica, objetivo: state.objetivo, etiqueta_resultado: state.etiqueta }
      : {};
    const r = await guardarFatiga(req.body?.datos, base, finishedAt);
    if (r.error) return res.status(400).json({ error: r.error });
    if (!(abierta && state.tipo !== "fatiga")) {
      const next = state.tipo === "fatiga" && abierta
        ? { ...state, status: "listo", finishedAt, ...r }
        : { id: crypto.randomUUID(), tipo: "fatiga", status: "listo", requestedAt: finishedAt, finishedAt, directo: true, ...r };
      await writeState(next);
    }
    res.json({ ok: true, ...r });
  }));

  /**
   * body: {
   *   id, periodo: "last_30d" | "2026-09-01..2026-09-17",
   *   results: [{ nombre, spend, compras?, impresiones?, clics?, ctr?, cuentas? }],
   *   error?: "mensaje"
   * }
   * `spend` va en soles (la app calcula el CPA en S/).
   */
  router.post("/agent/result", requireAgent, wrap(async (req, res) => {
    const state = await readState();
    const { id, periodo = "", results = [], error } = req.body ?? {};
    if (state.id !== id || !["pendiente", "procesando"].includes(state.status)) {
      return res.status(409).json({ error: "La solicitud no coincide o ya terminó", state: publicState(state, true) });
    }
    const finishedAt = new Date().toISOString();

    if (error) {
      await writeState({ ...state, status: "error", error: String(error).slice(0, 500), finishedAt });
      return res.json({ ok: true });
    }
    if (state.tipo === "fatiga") {
      const r = await guardarFatiga(
        req.body?.datos,
        { metrica_rectora: state.metrica, objetivo: state.objetivo, etiqueta_resultado: state.etiqueta },
        finishedAt
      );
      if (r.error) return res.status(400).json({ error: r.error });
      await writeState({ ...state, status: "listo", finishedAt, ...r });
      return res.json({ ok: true, ...r });
    }

    if (!Array.isArray(results)) return res.status(400).json({ error: "results debe ser un arreglo" });

    const byName = new Map(results.filter((r) => r && typeof r.nombre === "string").map((r) => [r.nombre, r]));
    const nameById = new Map(state.ads.map((a) => [a.id, a.nombre]));

    const row = await kv.get(ADKEY);
    const ads = row ? JSON.parse(row.value) : [];
    const found = new Set();
    let updated = 0;
    const next = ads.map((ad) => {
      const r = byName.get(nameById.get(ad.id));
      const spend = num(r?.spend);
      if (!r || spend === null) return ad;
      found.add(r.nombre);
      updated++;
      return {
        ...ad,
        // Solo la inversión: los pedidos confirmados siguen siendo manuales.
        spend: round2(spend),
        meta: {
          compras: num(r.compras),
          impresiones: num(r.impresiones),
          clics: num(r.clics),
          ctr: num(r.ctr),
          cuentas: Array.isArray(r.cuentas) ? r.cuentas.map(String) : [],
          periodo: String(periodo),
          syncedAt: finishedAt,
        },
      };
    });
    if (updated) await kv.set(ADKEY, JSON.stringify(next));

    const notFound = state.ads.map((a) => a.nombre).filter((n) => !found.has(n));
    await writeState({ ...state, status: "listo", finishedAt, periodo: String(periodo), updated, notFound });
    res.json({ ok: true, updated, notFound });
  }));

  return router;
}
