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
 */

const ADKEY = "nova-ads:all:v1";
const STATE_KEY = "meta_sync";
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
  // Lo que ve el navegador: sin la lista completa de ads.
  const publicState = ({ ads, ...rest }) => ({ ...rest, total: ads?.length ?? 0 });

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
    const ads = (Array.isArray(req.body?.ads) ? req.body.ads : [])
      .filter((a) => a && typeof a.id === "string" && typeof a.nombre === "string")
      .map(({ id, nombre }) => ({ id, nombre }));
    if (!ads.length) return res.status(400).json({ error: "No hay ads lanzados para sincronizar" });
    const state = {
      id: crypto.randomUUID(),
      status: "pendiente",
      requestedAt: new Date().toISOString(),
      ads,
    };
    await writeState(state);
    res.json(publicState(state));
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
