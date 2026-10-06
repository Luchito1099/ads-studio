import express from "express";
import { crearAgente } from "./agente.js";

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

  const { requireAgente, hay } = crearAgente(kv);

  /* ---------- navegador ---------- */
  router.get("/", requireAuth, wrap(async (_req, res) => {
    res.json({ agente: await hay(), competencia: await leer() });
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
      activos: guardado[clave(c)]?.ads?.filter((a) => a.activo !== false).length ?? null,
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
      const antes = new Map(previo.ads.map((a) => [a.adId, a]));
      const activos = [];
      for (const a of c.ads) {
        const adId = texto(a.adId ?? a.id, 60);
        if (!adId || activos.some((x) => x.adId === adId)) continue;
        const viejo = antes.get(adId);
        activos.push({
          adId,
          titulo: texto(a.titulo ?? a.ad_creative_link_title, 200) || viejo?.titulo || "",
          inicio: fechaISO(a.inicio ?? a.ad_delivery_start_time) || viejo?.inicio || "",
          pagina: texto(a.pagina ?? a.page_name, 120) || viejo?.pagina || "",
          pageId: texto(a.pageId ?? a.page_id, 40) || viejo?.pageId || "",
          enlace: texto(a.enlace ?? a.ad_snapshot_url, 400) || viejo?.enlace || `https://www.facebook.com/ads/library/?id=${adId}`,
          visto: viejo?.visto || fecha,
          activo: true,
          apagado: "",
        });
        if (activos.length >= MAX_ADS) break;
      }
      /* Lo que ya no aparece no se borra: queda archivado con la fecha en que
       * dejó de verse. Un anuncio que corrió cuatro meses y se apagó sigue
       * siendo la mejor pista de lo que a esa marca le funcionó. */
      const vivos = new Set(activos.map((a) => a.adId));
      const apagadosAntes = previo.ads.filter((a) => !vivos.has(a.adId));
      const archivados = apagadosAntes.map((a) => ({ ...a, activo: false, apagado: a.apagado || fecha }));
      const nuevos = previo.ads.length ? activos.filter((a) => !antes.has(a.adId)).length : 0;
      const apagados = apagadosAntes.filter((a) => a.activo !== false).length;
      // Si hay que recortar, se van los archivados más antiguos, nunca los activos.
      archivados.sort((x, y) => String(y.apagado).localeCompare(String(x.apagado)));
      const ads = [...activos, ...archivados.slice(0, Math.max(0, MAX_ADS * 2 - activos.length))];
      const historico = [...(previo.historico || []).filter((h) => h.fecha !== fecha),
        { fecha, total: activos.length, nuevos, apagados }].slice(-MAX_HIST);
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
      resumen.push({ id, nombre: todo[id].nombre, activos: activos.length, nuevos, apagados, archivados: archivados.length });
    }
    await guardar(todo);
    res.json({ ok: true, revisado, competidores: resumen });
  }));

  return router;
}
