import crypto from "node:crypto";
import express from "express";

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
 *     página Fatiga (esquema en src/fatiga/motor.js).
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

  const readState = async () => {
    const raw = await kv.metaGet(STATE_KEY);
    return raw ? JSON.parse(raw) : IDLE;
  };
  const writeState = (state) => kv.metaSet(STATE_KEY, JSON.stringify(state));
  // Lo que ve el navegador: sin la lista completa de ads, y si hay un agente
  // que pueda responder (sin SYNC_TOKEN nadie puede tomar la solicitud).
  const publicState = ({ ads, ...rest }) => ({
    tipo: "inversion", ...rest, total: ads?.length ?? 0, agente: !!process.env.SYNC_TOKEN,
  });
  const SIN_TOKEN = "El servidor no tiene SYNC_TOKEN: agrégalo en las variables de entorno (Coolify) para que Claude pueda responder.";

  const requireAgent = (req, res, next) => {
    const expected = process.env.SYNC_TOKEN;
    if (!expected) return res.status(503).json({ error: "SYNC_TOKEN no está configurado en el servidor" });
    const given = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!given || !safeEqual(given, expected)) return res.status(401).json({ error: "Token inválido" });
    next();
  };

  /* ---------- navegador ---------- */
  router.get("/", requireAuth, wrap(async (_req, res) => {
    res.json(publicState(await readState()));
  }));

  router.post("/", requireAuth, wrap(async (req, res) => {
    if (!process.env.SYNC_TOKEN) return res.status(503).json({ error: SIN_TOKEN });
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
      return res.json(publicState(state));
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
    res.json(publicState(state));
  }));

  // Cancelar una solicitud que nadie tomó (o que quedó colgada).
  router.delete("/", requireAuth, wrap(async (_req, res) => {
    const state = await readState();
    if (!["pendiente", "procesando"].includes(state.status)) return res.json(publicState(state));
    const next = { ...state, status: "cancelado", finishedAt: new Date().toISOString() };
    await writeState(next);
    res.json(publicState(next));
  }));

  /* ---------- agente ---------- */
  router.get("/agent", requireAgent, wrap(async (_req, res) => {
    res.json(await readState());
  }));

  router.post("/agent/claim", requireAgent, wrap(async (req, res) => {
    const state = await readState();
    if (state.id !== req.body?.id || state.status !== "pendiente") {
      return res.status(409).json({ error: "La solicitud ya no está pendiente", state: publicState(state) });
    }
    const next = { ...state, status: "procesando", claimedAt: new Date().toISOString() };
    await writeState(next);
    res.json(next);
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
      return res.status(409).json({ error: "La solicitud no coincide o ya terminó", state: publicState(state) });
    }
    const finishedAt = new Date().toISOString();

    if (error) {
      await writeState({ ...state, status: "error", error: String(error).slice(0, 500), finishedAt });
      return res.json({ ok: true });
    }
    if (state.tipo === "fatiga") {
      const datos = req.body?.datos;
      if (!datos || !Array.isArray(datos.diario) || !datos.diario.length) {
        return res.status(400).json({ error: "datos.diario debe ser un arreglo con filas" });
      }
      const bien = datos.diario.every((f) => f && typeof f.fecha === "string" && f.ad_id != null);
      if (!bien) return res.status(400).json({ error: "Cada fila necesita fecha (AAAA-MM-DD) y ad_id" });
      const guardado = {
        meta: {
          metrica_rectora: state.metrica,
          objetivo: state.objetivo,
          etiqueta_resultado: state.etiqueta,
          ...(datos.meta || {}),
          fuente: "mcp",
          actualizado: finishedAt,
        },
        anuncios: Array.isArray(datos.anuncios) ? datos.anuncios : [],
        diario: datos.diario,
      };
      await kv.set(FATIGA_KEY, JSON.stringify(guardado));
      const anuncios = new Set(datos.diario.map((f) => String(f.ad_id))).size;
      await writeState({ ...state, status: "listo", finishedAt, filas: datos.diario.length, anuncios });
      return res.json({ ok: true, filas: datos.diario.length, anuncios });
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
