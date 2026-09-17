#!/usr/bin/env node
/**
 * Convierte respuestas de `ads_get_ad_entities` (MCP de Meta Ads) en los datos
 * de la página Fatiga y los envía al servidor. Lo usa Claude en /sync-meta,
 * así los números nunca se transcriben a mano.
 *
 *   node scripts/fatiga-meta.mjs \
 *     --diario r1.json r2.json r3.json      respuestas con time_increment "1"
 *     --anuncios meta.json                  respuesta con id, name, campaign_name,
 *                                           adset_name, created_time, frequency
 *     --cuenta "nova shop" --moneda USD [--objetivo 5] [--metrica cpa|roas] [--etiqueta Compras]
 *     [--enviar]                            POST a $NOVA_URL/api/sync/agent/fatiga
 *     [--salida datos.json]                 o guardar en un archivo
 *
 * Cada archivo puede ser la respuesta tal cual ({"ad_entities": "[...]"}),
 * un arreglo de filas o {"data": [...]}. NOVA_URL y SYNC_TOKEN se leen del
 * entorno o del .env de la raíz.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function argumentos(argv) {
  const out = { diario: [] };
  let clave = null;
  for (const a of argv) {
    if (a.startsWith("--")) {
      clave = a.slice(2);
      if (clave === "enviar") { out.enviar = true; clave = null; }
      continue;
    }
    if (clave === "diario") out.diario.push(a);
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

function filas(archivo) {
  const crudo = JSON.parse(fs.readFileSync(archivo, "utf8"));
  if (Array.isArray(crudo)) return crudo;
  if (typeof crudo.ad_entities === "string") return JSON.parse(crudo.ad_entities);
  if (Array.isArray(crudo.ad_entities)) return crudo.ad_entities;
  if (Array.isArray(crudo.data)) return crudo.data;
  throw new Error(`${archivo}: formato no reconocido`);
}

/** "$1.234,56 USD", "$8,96", "12.5", 12.5 -> número */
function monto(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  let s = String(v).replace(/[^\d.,-]/g, "");
  if (s.includes(".") && s.includes(",")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Enteros o acciones de Meta ({value} / [{value}]) -> número */
function cantidad(v) {
  if (v == null || v === "") return 0;
  if (Array.isArray(v)) return v.reduce((s, x) => s + cantidad(x?.value ?? x), 0);
  if (typeof v === "object") return cantidad(v.value ?? v.values);
  return monto(v);
}

const args = argumentos(process.argv.slice(2));
if (!args.diario.length) {
  console.error("Falta --diario con al menos un archivo.");
  process.exit(1);
}

// Filas diarias, sin duplicados (la última gana).
const porClave = new Map();
for (const archivo of args.diario) {
  for (const f of filas(archivo)) {
    const fecha = f.date_start || f.fecha;
    if (!fecha || !f.id) continue;
    porClave.set(`${f.id}|${fecha}`, f);
  }
}

const nombres = new Map();
const totales = new Map();
const diario = [...porClave.values()].map((f) => {
  const id = String(f.id);
  if (f.name) nombres.set(id, f.name);
  const fila = {
    fecha: String(f.date_start || f.fecha).slice(0, 10),
    ad_id: id,
    gasto: Math.round(monto(f.amount_spent ?? f.spend) * 100) / 100,
    impresiones: cantidad(f.impressions),
    alcance: cantidad(f.reach),
    clics: cantidad(f.link_click ?? f.link_clicks),
    resultados: cantidad(f.omni_purchase ?? f.purchases ?? f.results),
    valor: Math.round(monto(f.omni_purchase_values ?? f.purchase_value ?? f.result_values) * 100) / 100,
    vistas_3s: cantidad(f.video_3_sec_views ?? f.video_play_actions),
  };
  const t = totales.get(id) || { imp: 0, vistas: 0 };
  t.imp += fila.impresiones; t.vistas += fila.vistas_3s;
  totales.set(id, t);
  return fila;
});
// Un anuncio de imagen puede traer unas pocas "reproducciones": si no llegan
// al 20% de las impresiones, no es video y el hook rate no aplica.
const noVideo = new Set([...totales].filter(([, t]) => t.vistas / (t.imp || 1) < 0.2).map(([id]) => id));
for (const f of diario) if (noVideo.has(f.ad_id)) f.vistas_3s = 0;

const metaAnuncios = new Map();
if (args.anuncios) {
  for (const a of filas(args.anuncios)) {
    metaAnuncios.set(String(a.id), a);
    if (a.name) nombres.set(String(a.id), a.name);
  }
}
const anuncios = [...totales.keys()].map((id) => {
  const m = metaAnuncios.get(id) || {};
  const frecuencia = m.frequency != null ? Number(m.frequency) : null;
  return {
    id,
    nombre: nombres.get(id) || id,
    campana: m.campaign_name || "",
    conjunto: m.adset_name || "",
    ...(m.created_time ? { fecha_inicio: String(m.created_time).slice(0, 10) } : {}),
    ...(Number.isFinite(frecuencia) ? { frecuencia_acumulada: Math.round(frecuencia * 100) / 100 } : {}),
    formato: noVideo.has(id) ? "imagen" : "video",
  };
});

const datos = {
  meta: {
    cuenta: args.cuenta || "",
    moneda: args.moneda || "PEN",
    ...(args.metrica ? { metrica_rectora: args.metrica } : {}),
    ...(args.objetivo ? { objetivo: Number(args.objetivo) } : {}),
    ...(args.etiqueta ? { etiqueta_resultado: args.etiqueta } : {}),
  },
  anuncios,
  diario,
};

const fechas = diario.map((f) => f.fecha).sort();
const resumen = {
  anuncios: anuncios.length,
  filas: diario.length,
  desde: fechas[0],
  hasta: fechas.at(-1),
  sinMetadatos: anuncios.filter((a) => !metaAnuncios.has(a.id)).length,
};
console.log(JSON.stringify(resumen));

if (args.salida) fs.writeFileSync(args.salida, JSON.stringify(datos));

if (args.enviar) {
  leerEnv();
  const { NOVA_URL, SYNC_TOKEN } = process.env;
  if (!NOVA_URL || !SYNC_TOKEN) {
    console.error("Faltan NOVA_URL o SYNC_TOKEN (entorno o .env).");
    process.exit(1);
  }
  const res = await fetch(`${NOVA_URL.replace(/\/$/, "")}/api/sync/agent/fatiga`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SYNC_TOKEN}` },
    body: JSON.stringify({ datos }),
  });
  const cuerpo = await res.text();
  console.log(`servidor ${res.status}: ${cuerpo}`);
  if (!res.ok) process.exit(1);
}
