#!/usr/bin/env node
/**
 * Convierte respuestas de `ads_library_search` (MCP de Meta Ads) en la foto de
 * anuncios activos de un competidor y la envía al Studio. Lo usa Claude en
 * /competencia, así los IDs y las fechas nunca se transcriben a mano.
 *
 *   node scripts/competencia.mjs --lista
 *       Muestra a quién hay que vigilar (lo que el usuario configuró en el Studio).
 *
 *   node scripts/competencia.mjs --competidor "ireca-shop" --nombre "Ireca Shop" \
 *     --archivos r1.json r2.json [--paginas 755431924321700,135173] [--pais PE] \
 *     [--enviar] [--salida foto.json]
 *
 * Cada archivo puede ser la respuesta tal cual ({"results": "{...}"}), el objeto
 * con {ads:[...]} o un arreglo de anuncios. Con --paginas solo se quedan los
 * anuncios de esas páginas (útil cuando la búsqueda fue por palabra clave).
 * NOVA_URL y SYNC_TOKEN se leen del entorno o del .env de la raíz.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function argumentos(argv) {
  const out = { archivos: [] };
  let clave = null;
  for (const a of argv) {
    if (a.startsWith("--")) {
      clave = a.slice(2);
      if (clave === "enviar" || clave === "lista") { out[clave] = true; clave = null; }
      continue;
    }
    if (clave === "archivos") out.archivos.push(a);
    else if (clave) { out[clave] = a; clave = null; }
  }
  return out;
}

function leerEnv() {
  const archivo = path.join(RAIZ, ".env");
  if (!fs.existsSync(archivo)) return;
  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(linea);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

/** Saca la lista de anuncios de una respuesta del MCP, venga como venga. */
function anuncios(archivo) {
  let crudo = JSON.parse(fs.readFileSync(archivo, "utf8"));
  if (typeof crudo === "string") crudo = JSON.parse(crudo);
  if (typeof crudo.results === "string") crudo = JSON.parse(crudo.results);
  else if (crudo.results && typeof crudo.results === "object") crudo = crudo.results;
  if (Array.isArray(crudo)) return crudo;
  if (Array.isArray(crudo.ads)) return crudo.ads;
  if (Array.isArray(crudo.data)) return crudo.data;
  throw new Error(`${archivo}: no encontré la lista de anuncios`);
}

const fecha = (v) => {
  if (v == null || v === "") return "";
  const n = Number(v);
  const d = Number.isFinite(n) && n > 1e8 ? new Date(n * 1000) : new Date(v);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
};

leerEnv();
const args = argumentos(process.argv.slice(2));
const URL_BASE = (process.env.NOVA_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.SYNC_TOKEN || "";
const pedir = async (ruta, opts = {}) => {
  if (!URL_BASE || !TOKEN) {
    console.error("Faltan NOVA_URL o SYNC_TOKEN (variables de entorno o .env de la raíz).");
    process.exit(1);
  }
  const r = await fetch(URL_BASE + ruta, {
    ...opts,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(opts.headers || {}) },
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error(`El Studio respondió ${r.status}: ${cuerpo.error || ""}`);
    process.exit(1);
  }
  return cuerpo;
};

if (args.lista) {
  const { competidores = [] } = await pedir("/api/competencia/agente");
  if (!competidores.length) {
    console.log("El usuario todavía no configuró competidores en el Studio (Medir → Competencia).");
  } else {
    for (const c of competidores) {
      const paginas = c.pageIds.length ? `páginas ${c.pageIds.join(", ")}` : "sin ID de página";
      const visto = c.revisado ? `revisado ${c.revisado.slice(0, 10)} (${c.activos} activos)` : "sin revisar";
      console.log(`- ${c.id} · ${c.nombre} · ${c.pais} · ${paginas}${c.terminos ? ` · términos "${c.terminos}"` : ""} · ${visto}`);
    }
  }
  process.exit(0);
}

if (!args.archivos.length) {
  console.error("Falta --archivos con al menos una respuesta de ads_library_search (o usa --lista).");
  process.exit(1);
}
if (!args.competidor && !args.nombre) {
  console.error("Falta --competidor <id> o --nombre <marca>.");
  process.exit(1);
}

const paginas = (args.paginas || "").split(",").map((x) => x.trim()).filter(Boolean);
const porId = new Map();
for (const archivo of args.archivos) {
  for (const a of anuncios(archivo)) {
    const adId = String(a.id ?? a.adId ?? "").trim();
    if (!adId) continue;
    const pageId = String(a.page_id ?? a.pageId ?? "").trim();
    if (paginas.length && !paginas.includes(pageId)) continue;
    porId.set(adId, {
      adId,
      titulo: a.ad_creative_link_title ?? a.titulo ?? "",
      inicio: fecha(a.ad_delivery_start_time ?? a.inicio ?? a.ad_creation_time),
      pagina: a.page_name ?? a.pagina ?? "",
      pageId,
      enlace: a.ad_snapshot_url ?? a.enlace ?? `https://www.facebook.com/ads/library/?id=${adId}`,
    });
  }
}

const ads = [...porId.values()].sort((x, y) => String(x.inicio).localeCompare(String(y.inicio)));
const foto = {
  competidores: [{
    id: args.competidor || "",
    nombre: args.nombre || args.competidor,
    pais: (args.pais || "PE").toUpperCase(),
    pageIds: paginas,
    nota: args.nota || "",
    ads,
  }],
};

if (args.salida) fs.writeFileSync(args.salida, JSON.stringify(foto, null, 2));
console.log(`${ads.length} anuncios activos de ${foto.competidores[0].nombre}` + (ads.length ? ` · el más antiguo empezó el ${ads[0].inicio || "sin fecha"}` : ""));

if (args.enviar) {
  const r = await pedir("/api/competencia/agente", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(foto),
  });
  for (const c of r.competidores || []) console.log(`Enviado: ${c.nombre} · ${c.activos} activos · ${c.nuevos} nuevos`);
} else if (!args.salida) {
  console.log(JSON.stringify(foto, null, 2));
}
