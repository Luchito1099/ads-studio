#!/usr/bin/env node
/**
 * Devuelve a la base un respaldo completo bajado desde Ajustes.
 *
 *   node scripts/restaurar.mjs novitools-respaldo-2026-10-12.zip
 *   node scripts/restaurar.mjs respaldo.zip --forzar      (sin preguntar)
 *   node scripts/restaurar.mjs respaldo.zip --solo-ver    (no escribe nada)
 *
 * Escribe en la misma base que usa el servidor: lee DB_HOST/DB_NAME/… o
 * DATABASE_URL del entorno o del .env de la raíz, y si no hay nada, el SQLite
 * de data/nova.db. Los videos van a S3 si S3_BUCKET está configurado.
 *
 * Nunca borra: agrega y sobrescribe lo que venga en el respaldo. Antes de
 * tocar nada muestra cuántos anuncios hay ahora y cuántos trae el archivo, y
 * pide confirmación si la base tiene más de los que vienen.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import readline from "node:readline/promises";
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

/* ---------------------------------------------------------------------------
 * Leer el zip (los respaldos van sin comprimir; igual se acepta deflate por si
 * alguien lo volvió a empaquetar con otra herramienta).
 * ------------------------------------------------------------------------- */
function abrirZip(buf) {
  let fin = buf.length - 22;
  while (fin >= 0 && buf.readUInt32LE(fin) !== 0x06054b50) fin--;
  if (fin < 0) throw new Error("No parece un .zip (no encontré el final del índice)");
  let total = buf.readUInt16LE(fin + 10);
  let inicio = buf.readUInt32LE(fin + 16);

  // zip64: el índice de verdad está antes, apuntado por el localizador.
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
    const lnombre = buf.readUInt16LE(p + 28);
    const lextra = buf.readUInt16LE(p + 30);
    const lcom = buf.readUInt16LE(p + 32);
    const nombre = buf.toString("utf8", p + 46, p + 46 + lnombre);
    let offset = buf.readUInt32LE(p + 42);
    if (offset === 0xffffffff) {
      // está en el campo extra 0x0001
      let e = p + 46 + lnombre;
      const finExtra = e + lextra;
      while (e + 4 <= finExtra) {
        const id = buf.readUInt16LE(e), tam = buf.readUInt16LE(e + 2);
        if (id === 0x0001) { offset = Number(buf.readBigUInt64LE(e + 4 + (crudo === 0xffffffff ? 8 : 0) + (comprimido === 0xffffffff ? 8 : 0))); break; }
        e += 4 + tam;
      }
    }
    archivos.push({ nombre, metodo, comprimido, crudo, offset });
    p += 46 + lnombre + lextra + lcom;
  }

  const datos = (a) => {
    const ln = buf.readUInt16LE(a.offset + 26);
    const lx = buf.readUInt16LE(a.offset + 28);
    const ini = a.offset + 30 + ln + lx;
    const trozo = buf.subarray(ini, ini + a.comprimido);
    if (a.metodo === 0) return trozo;
    if (a.metodo === 8) return zlib.inflateRawSync(trozo);
    throw new Error(`"${a.nombre}" usa un método de compresión que no sé leer (${a.metodo})`);
  };
  return { archivos, datos };
}

const mb = (n) => (n / 1048576).toFixed(1) + " MB";
const cuenta = (valor, campo) => { try { const S = JSON.parse(valor); return Array.isArray(S?.[campo]) ? S[campo].length : 0; } catch { return 0; } };

/* ------------------------------------------------------------------------- */
const args = process.argv.slice(2);
const archivo = args.find((a) => !a.startsWith("--"));
const forzar = args.includes("--forzar");
const soloVer = args.includes("--solo-ver");

if (!archivo) {
  console.error("Uso: node scripts/restaurar.mjs <respaldo.zip> [--forzar] [--solo-ver]");
  process.exit(1);
}
if (!fs.existsSync(archivo)) {
  console.error(`No existe el archivo ${archivo}`);
  process.exit(1);
}

leerEnv();
const { openStore } = await import("../server/db.js");
const { openBlobs } = await import("../server/blobs.js");
const { almacenArchivos } = await import("../server/media.js");

const zip = abrirZip(fs.readFileSync(archivo));
const manifiesto = zip.archivos.find((a) => a.nombre === "manifiesto.json");
const estado = zip.archivos.find((a) => a.nombre === "estado.json");
if (!estado) {
  console.error("Este zip no tiene estado.json: no es un respaldo del Studio.");
  process.exit(1);
}
const { items } = JSON.parse(zip.datos(estado).toString("utf8"));
const medios = zip.archivos.filter((a) => a.nombre.startsWith("medios/") && a.crudo > 0);
const info = manifiesto ? JSON.parse(zip.datos(manifiesto).toString("utf8")) : null;
const filaEstado = items.find((i) => i.key === ESTADO);
const traeAnuncios = filaEstado ? cuenta(filaEstado.value, "refs") : 0;

console.log(`\nRespaldo: ${path.basename(archivo)}`);
if (info?.hechoEl) console.log(`  hecho el ${new Date(info.hechoEl).toLocaleString("es-PE")}`);
console.log(`  ${items.length} claves · ${medios.length} archivos · ${mb(medios.reduce((s, a) => s + a.crudo, 0))}`);
console.log(`  anuncios en la Biblioteca: ${traeAnuncios}`);

const kv = await openStore();
const blobs = openBlobs();
const almacen = almacenArchivos({ kv, blobs });
const ahora = await kv.get(ESTADO);
const tieneAhora = ahora ? cuenta(ahora.value, "refs") : 0;
console.log(`\nBase de destino: ${kv.label}`);
console.log(`  anuncios ahora mismo: ${tieneAhora}${blobs ? ` · archivos a ${blobs.label}` : ""}`);

if (soloVer) { console.log("\n--solo-ver: no escribí nada."); await kv.close?.(); process.exit(0); }

if (tieneAhora > traeAnuncios && !forzar) {
  console.log(`\nOJO: la base tiene ${tieneAhora} anuncios y el respaldo trae ${traeAnuncios}.`);
  console.log("Restaurar deja los del respaldo. Los archivos de medios no se borran.");
}
if (!forzar) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const r = (await rl.question("\n¿Restauro? (escribe SI) ")).trim();
  rl.close();
  if (r !== "SI") { console.log("No hice nada."); await kv.close?.(); process.exit(0); }
}

let claves = 0;
for (const it of items) { await kv.set(it.key, it.value); claves++; }
console.log(`Claves escritas: ${claves}`);

let puestos = 0, pesados = 0;
for (const a of medios) {
  const id = a.nombre.slice("medios/".length).replace(/\.[a-z0-9]+$/i, "");
  const datos = zip.datos(a);
  const mime = info?.archivos?.find((x) => x.id === id)?.mime || "application/octet-stream";
  await almacen.guardar(id, Buffer.from(datos), mime);
  puestos++; pesados += datos.length;
  if (puestos % 10 === 0) process.stdout.write(`  ${puestos}/${medios.length} archivos…\r`);
}
console.log(`Archivos restaurados: ${puestos} · ${mb(pesados)}            `);

const final = await kv.get(ESTADO);
console.log(`\nLISTO: la Biblioteca quedó con ${final ? cuenta(final.value, "refs") : 0} anuncios.`);
await kv.close?.();
