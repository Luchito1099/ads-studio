import crypto from "node:crypto";
import express from "express";

/**
 * Vigilancia de la competencia.
 *
 * La app no habla con Meta. El navegador guarda QUÉ páginas vigilar (dentro
 * del estado del Studio) y un agente de Claude, que sí tiene el MCP de Meta
 * Ads, consulta la Biblioteca de anuncios y deja aquí la foto del día.
 *
 *   Navegador (cookie)              Agente (Authorization: Bearer SYNC_TOKEN)
 *   GET /api/competencia  <──────   GET  /api/competencia/agente   (a quién vigilar)
 *                                   POST /api/competencia/agente   (anuncios activos)
 *
 * El agente nunca escribe el estado del Studio: así no pisa lo que el usuario
 * esté editando en el navegador. Ver .claude/skills/competencia/SKILL.md.
 */

const CLAVE = "studio:competencia:v1";
const STATE_KEY = "studio:state:v2";
const MAX_ADS = 400;
const MAX_HIST = 120;

const safeEqual = (a, b) => {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};
const texto = (v, max) => String(v ?? "").trim().slice(0, max);
const hoyISO = () => new Date().toISOString().slice(0, 10);
const fechaISO = (v) => {
  if (v == null || v === "") return "";
  const n = Number(v);
  const d = Number.isFinite(n) && n > 1e8 ? new Date(n * 1000) : new Date(v);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
};
const clave = (c) =>
  texto(c.id, 60) ||
  texto(c.nombre, 60).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
  "sin-nombre";

export function competenciaRouter({ kv, requireAuth, wrap }) {
  const router = express.Router();

  const leer = async () => {
    const raw = await kv.get(CLAVE);
    if (!raw) return {};
    try { return JSON.parse(raw.value) || {}; } catch { return {}; }
  };
  const guardar = (todo) => kv.set(CLAVE, JSON.stringify(todo));

  const requireAgente = (req, res, next) => {
    const esperado = process.env.SYNC_TOKEN;
    if (!esperado) return res.status(503).json({ error: "SYNC_TOKEN no está configurado en el servidor" });
    const dado = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!dado || !safeEqual(dado, esperado)) return res.status(401).json({ error: "Token inválido" });
    next();
  };

  /* ---------- navegador ---------- */
  router.get("/", requireAuth, wrap(async (_req, res) => {
    res.json({ agente: !!process.env.SYNC_TOKEN, competencia: await leer() });
  }));

  // Al borrar un competidor en el Studio, se borra también su historial.
  router.delete("/:id", requireAuth, wrap(async (req, res) => {
    const todo = await leer();
    if (todo[req.params.id]) { delete todo[req.params.id]; await guardar(todo); }
    res.json({ ok: true });
  }));

  /* ---------- agente ---------- */
  // A quién hay que vigilar, según lo que el usuario configuró en el Studio.
  router.get("/agente", requireAgente, wrap(async (_req, res) => {
    const fila = await kv.get(STATE_KEY);
    let S = null;
    try { S = fila ? JSON.parse(fila.value) : null; } catch { S = null; }
    const guardado = await leer();
    const competidores = (S?.competidores || []).map((c) => ({
      id: clave(c),
      nombre: texto(c.nombre, 120),
      pageIds: (Array.isArray(c.pageIds) ? c.pageIds : []).map((p) => texto(p, 40)).filter(Boolean),
      terminos: texto(c.terminos, 200),
      pais: texto(c.pais, 2).toUpperCase() || "PE",
      producto: (S?.products || []).find((p) => p.id === c.productId)?.name || "",
      revisado: guardado[clave(c)]?.revisado || null,
      activos: guardado[clave(c)]?.ads?.length ?? null,
    }));
    res.json({ competidores, revisadoUltimo: Object.values(guardado).map((c) => c.revisado).sort().pop() || null });
  }));

  // La foto del día: anuncios activos por competidor.
  router.post("/agente", requireAgente, wrap(async (req, res) => {
    const lista = Array.isArray(req.body?.competidores) ? req.body.competidores : [req.body];
    const limpios = lista.filter((c) => c && (c.nombre || c.id) && Array.isArray(c.ads));
    if (!limpios.length) return res.status(400).json({ error: "Envía competidores: [{ nombre, ads: [...] }]" });

    const todo = await leer();
    const fecha = hoyISO();
    const revisado = new Date().toISOString();
    const resumen = [];
    for (const c of limpios) {
      const id = clave(c);
      const previo = todo[id] || { ads: [], historico: [] };
      const vistos = new Map(previo.ads.map((a) => [a.adId, a.visto || fecha]));
      const ads = [];
      for (const a of c.ads) {
        const adId = texto(a.adId ?? a.id, 60);
        if (!adId || ads.some((x) => x.adId === adId)) continue;
        ads.push({
          adId,
          titulo: texto(a.titulo ?? a.ad_creative_link_title, 200),
          inicio: fechaISO(a.inicio ?? a.ad_delivery_start_time),
          pagina: texto(a.pagina ?? a.page_name, 120),
          pageId: texto(a.pageId ?? a.page_id, 40),
          enlace: texto(a.enlace ?? a.ad_snapshot_url, 400) || `https://www.facebook.com/ads/library/?id=${adId}`,
          visto: vistos.get(adId) || fecha,
        });
        if (ads.length >= MAX_ADS) break;
      }
      // Nuevo = no estaba en la foto anterior (aunque se revise dos veces el mismo día).
      const nuevos = previo.ads.length ? ads.filter((a) => !vistos.has(a.adId)).length : 0;
      const historico = [...(previo.historico || []).filter((h) => h.fecha !== fecha), { fecha, total: ads.length, nuevos }].slice(-MAX_HIST);
      todo[id] = {
        id,
        nombre: texto(c.nombre, 120) || previo.nombre || id,
        pais: texto(c.pais, 2).toUpperCase() || previo.pais || "PE",
        pageIds: (Array.isArray(c.pageIds) ? c.pageIds : previo.pageIds || []).map((p) => texto(p, 40)).filter(Boolean),
        nota: texto(c.nota, 300),
        revisado,
        ads,
        historico,
      };
      resumen.push({ id, nombre: todo[id].nombre, activos: ads.length, nuevos });
    }
    await guardar(todo);
    res.json({ ok: true, revisado, competidores: resumen });
  }));

  return router;
}
