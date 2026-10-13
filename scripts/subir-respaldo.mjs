#!/usr/bin/env node
/**
 * Devuelve un respaldo completo a una app que ya está corriendo, por HTTP.
 *
 *   NOVA_URL=https://… APP_PASSWORD=… node scripts/subir-respaldo.mjs respaldo.zip
 *   … --solo-ver    dice qué haría y no escribe nada
 *
 * Sirve cuando la base vive dentro del contenedor y no se puede tocar desde
 * fuera: entra con la contraseña de la app y usa sus propios endpoints
 * (`PUT /api/media/:id` y `PUT /api/kv`), los mismos que usa el navegador.
 *
 * Primero suben los archivos y al final las claves, para que ninguna ficha
 * apunte a un video que todavía no llegó. Comprueba cada archivo después de
 * subirlo y, si algo falla, no escribe el estado y lo dice.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ESTADO = "studio:state:v2";

function leerEnv() {
  const archivo = path.join(RAIZ, ".env");
  if (!fs.existsSync(archivo)) return;
  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(linea);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

/** Lector de zip (los respaldos van sin comprimir; también acepta deflate). */
function abrirZip(buf) {
  let fin = buf.length - 22;
  while (fin >= 0 && buf.readUInt32LE(fin) !== 0x06054b50) fin--;
  if (fin < 0) throw new Error("No parece un .zip");
  let total = buf.readUInt16LE(fin + 10);
  let inicio = buf.readUInt32LE(fin + 16);
  const loc = fin - 20;
  if (loc >= 0 && buf.readUInt32LE(loc) === 0x07064b50) {
    const z64 = Number(buf.readBigUInt64LE(loc + 8));
    if (buf.readUInt32LE(z64) === 0x06064b50) {
      total = Number(buf.readBigUInt64LE(z64 + 32));
      inicio = Number(buf.readBigUInt64LE(z64 + 48));
    }
  }
  const archivos = [];
  let p = inicio;
  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Índice del zip dañado");
    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const crudo = buf.readUInt32LE(p + 24);
    const ln = buf.readUInt16LE(p + 28), lx = buf.readUInt16LE(p + 30), lc = buf.readUInt16LE(p + 32);
    const nombre = buf.toString("utf8", p + 46, p + 46 + ln);
    let offset = buf.readUInt32LE(p + 42);
    if (offset === 0xffffffff) {
      let e = p + 46 + ln;
      const finExtra = e + lx;
      while (e + 4 <= finExtra) {
        const id = buf.readUInt16LE(e), tam = buf.readUInt16LE(e + 2);
        if (id === 0x0001) { offset = Number(buf.readBigUInt64LE(e + 4 + (crudo === 0xffffffff ? 8 : 0) + (comprimido === 0xffffffff ? 8 : 0))); break; }
        e += 4 + tam;
      }
    }
    archivos.push({ nombre, metodo, comprimido, crudo, offset });
    p += 46 + ln + lx + lc;
  }
  const datos = (a) => {
    const ln = buf.readUInt16LE(a.offset + 26), lx = buf.readUInt16LE(a.offset + 28);
    const ini = a.offset + 30 + ln + lx;
    const trozo = buf.subarray(ini, ini + a.comprimido);
    if (a.metodo === 0) return trozo;
    if (a.metodo === 8) return zlib.inflateRawSync(trozo);
    throw new Error(`"${a.nombre}": compresión desconocida (${a.metodo})`);
  };
  return { archivos, datos };
}

const mb = (n) => (n / 1048576).toFixed(1) + " MB";
const cuenta = (valor, campo) => { try { const S = JSON.parse(valor); return Array.isArray(S?.[campo]) ? S[campo].length : 0; } catch { return 0; } };

/* ------------------------------------------------------------------------- */
leerEnv();
const args = process.argv.slice(2);
const archivo = args.find((a) => !a.startsWith("--"));
const soloVer = args.includes("--solo-ver");
const BASE = (process.env.NOVA_URL || "").replace(/\/+$/, "");
const CLAVE = process.env.APP_PASSWORD || "";

if (!archivo || !BASE || !(CLAVE || process.env.COOKIE)) {
  console.error("Uso: NOVA_URL=… APP_PASSWORD=… node scripts/subir-respaldo.mjs <respaldo.zip> [--solo-ver]");
  process.exit(1);
}
if (!fs.existsSync(archivo)) { console.error(`No existe ${archivo}`); process.exit(1); }

const zip = abrirZip(fs.readFileSync(archivo));
const entradaEstado = zip.archivos.find((a) => a.nombre === "estado.json");
if (!entradaEstado) { console.error("El zip no tiene estado.json: no es un respaldo del Studio."); process.exit(1); }
const { items, meta = [] } = JSON.parse(zip.datos(entradaEstado).toString("utf8"));
const manifiesto = zip.archivos.find((a) => a.nombre === "manifiesto.json");
const info = manifiesto ? JSON.parse(zip.datos(manifiesto).toString("utf8")) : null;
const medios = zip.archivos.filter((a) => a.nombre.startsWith("medios/") && a.crudo > 0);
const fila = items.find((i) => i.key === ESTADO);
const traeAnuncios = fila ? cuenta(fila.value, "refs") : 0;

console.log(`\nRespaldo: ${path.basename(archivo)}`);
console.log(`  ${items.length} claves · ${medios.length} archivos · ${mb(medios.reduce((s, a) => s + a.crudo, 0))}`);
console.log(`  anuncios: ${traeAnuncios}`);

/* ---- entrar ---- */
let cookie = process.env.COOKIE || "";
if (!cookie) {
  const r = await fetch(BASE + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: CLAVE }) });
  if (!r.ok) { console.error(`No pude entrar en ${BASE}: ${r.status}`); process.exit(1); }
  cookie = (r.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
}
const estado = await (await fetch(BASE + "/api/estado", { headers: { cookie } })).json();
const actual = await (await fetch(BASE + "/api/kv?key=" + encodeURIComponent(ESTADO), { headers: { cookie } })).json().catch(() => null);
const tieneAhora = actual?.value ? cuenta(actual.value, "refs") : 0;
console.log(`\nDestino: ${BASE}`);
console.log(`  ${estado.base} · anuncios ahora mismo: ${tieneAhora}`);

if (soloVer) { console.log("\n--solo-ver: no escribí nada."); process.exit(0); }
if (tieneAhora > traeAnuncios) console.log(`\nOJO: allá hay ${tieneAhora} anuncios y el respaldo trae ${traeAnuncios}.`);

/* ---- primero los archivos ---- */
let subidos = 0, bytes = 0;
const malos = [];
for (const a of medios) {
  const id = a.nombre.slice("medios/".length).replace(/\.[a-z0-9]+$/i, "");
  const datos = zip.datos(a);
  const mime = info?.archivos?.find((x) => x.id === id)?.mime || "application/octet-stream";
  let ok = false;
  for (let intento = 1; intento <= 3 && !ok; intento++) {
    try {
      const r = await fetch(`${BASE}/api/media/${encodeURIComponent(id)}`, {
        method: "PUT", headers: { cookie, "Content-Type": mime }, body: datos,
      });
      ok = r.ok;
      if (!ok && intento === 3) malos.push(`${id} (HTTP ${r.status})`);
    } catch (e) {
      if (intento === 3) malos.push(`${id} (${e.cause?.code || e.message})`);
    }
  }
  if (ok) { subidos++; bytes += datos.length; }
  process.stdout.write(`  ${subidos}/${medios.length} archivos · ${mb(bytes)}        \r`);
}
console.log("");
if (malos.length) {
  console.error(`\nNo subieron ${malos.length}: ${malos.slice(0, 10).join(", ")}`);
  console.error("No escribí las fichas: vuelve a correrlo (los que ya subieron se saltan solos).");
  process.exit(1);
}

/* ---- y al final las claves ---- */
let claves = 0;
for (const it of items) {
  const r = await fetch(`${BASE}/api/kv?key=${encodeURIComponent(it.key)}&permitir=1`, {
    method: "PUT", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ value: it.value }),
  });
  if (!r.ok) { console.error(`\nFalló la clave ${it.key}: ${r.status} ${(await r.text()).slice(0, 140)}`); process.exit(1); }
  claves++;
  if (claves % 20 === 0) process.stdout.write(`  ${claves}/${items.length} claves        \r`);
}
console.log(`  ${claves}/${items.length} claves        `);

/* Las claves de servicio van al final: si la base es nueva, la extensión vuelve
 * a funcionar sin reinstalarla. */
if (meta.length) {
  const cuerpo = {};
  for (const m of meta) cuerpo[m.key] = m.value;
  const r = await fetch(BASE + "/api/respaldo/meta", { method: "POST", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  console.log(r.ok ? `  claves de servicio devueltas: ${meta.map((m) => m.key).join(", ")}`
    : `  OJO: no pude devolver las claves de servicio (${r.status}). La extensión va a necesitar que la descargues de nuevo.`);
}

const final = await (await fetch(BASE + "/api/kv?key=" + encodeURIComponent(ESTADO), { headers: { cookie } })).json();
console.log(`\nLISTO: la Biblioteca de ${BASE} quedó con ${cuenta(final.value, "refs")} anuncios y ${subidos} archivos.`);
