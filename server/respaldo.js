import express from "express";
import { escribirZip } from "./zip.js";

/**
 * Respaldo completo: un .zip con TODO lo del Studio, videos incluidos.
 *
 * `Exportar datos` del menú baja un JSON con los textos y las miniaturas, pero
 * los videos originales se quedan en el servidor. Si la base se pierde, se
 * pierden. Esto baja las dos cosas juntas:
 *
 *   estado.json        todas las claves de la base (la Biblioteca entera)
 *   medios/m123.mp4    cada archivo, con su id de nombre
 *   manifiesto.json    cuántos anuncios y cuántos archivos van adentro
 *   LEEME.txt          qué es esto y cómo se devuelve
 *
 * El zip se va escribiendo a la respuesta a medida que se leen los archivos:
 * nunca hay más de un video en memoria, pese un giga la biblioteca.
 * Para devolverlo: `node scripts/restaurar.mjs <archivo.zip>`.
 */

const ESTADO = "studio:state:v2";
const PREFIJO_MEDIA = "studio:media:";
const PREFIJO_RESPALDO = "studio:respaldo:";

const EXT = {
  "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm", "video/x-matroska": ".mkv",
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif",
};
const extensionDe = (mime) => EXT[String(mime || "").split(";")[0].trim().toLowerCase()] || "";
const hoy = () => new Date().toISOString().slice(0, 10);

/** Cuenta lo que importa del estado sin reventar si viene raro. */
function resumenEstado(valor) {
  try {
    const S = JSON.parse(valor);
    const n = (c) => (Array.isArray(S?.[c]) ? S[c].length : 0);
    return { anuncios: n("refs"), piezas: n("pieces"), hooks: n("hooks"), productos: n("products") };
  } catch {
    return { anuncios: 0, piezas: 0, hooks: 0, productos: 0 };
  }
}

/** Todos los ids de archivos: los que están en la base, los del estado y los de S3. */
async function idsDeMedios(kv, filas) {
  const ids = new Set(await kv.blobIds());
  for (const f of filas) if (f.key.startsWith(PREFIJO_MEDIA)) ids.add(f.key.slice(PREFIJO_MEDIA.length));
  const estado = filas.find((f) => f.key === ESTADO);
  if (estado) {
    try {
      const S = JSON.parse(estado.value);
      for (const r of S.refs || []) if (r.mediaId) ids.add(r.mediaId);
      for (const p of S.pieces || []) for (const m of p.mediaIds || []) if (m) ids.add(m);
    } catch { /* si el estado no se puede leer, quedan los de la base */ }
  }
  return [...ids].filter(Boolean).sort();
}

export function respaldoRouter({ kv, almacen, requireAuth, wrap }) {
  const router = express.Router();

  /** Lo que entraría en el respaldo, para mostrarlo antes de bajarlo. */
  router.get("/resumen", requireAuth, wrap(async (_req, res) => {
    const filas = await kv.all();
    const estado = filas.find((f) => f.key === ESTADO);
    const { n, bytes } = await kv.blobStats();
    res.json({
      ...resumenEstado(estado?.value),
      claves: filas.filter((f) => !f.key.startsWith(PREFIJO_RESPALDO)).length,
      medios: (await idsDeMedios(kv, filas)).length,
      enLaBase: n,
      bytes,
    });
  }));

  router.get("/", requireAuth, wrap(async (_req, res) => {
    const filas = await kv.all();
    const estado = filas.find((f) => f.key === ESTADO);
    const cuentas = resumenEstado(estado?.value);
    // Las copias automáticas del guardia son del mismo estado que ya va adentro:
    // meterlas multiplicaría el peso del archivo sin agregar nada.
    const items = filas.filter((f) => !f.key.startsWith(PREFIJO_RESPALDO));
    const ids = await idsDeMedios(kv, filas);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="novitools-respaldo-${hoy()}.zip"`);
    res.setHeader("Cache-Control", "no-store");

    const zip = escribirZip(res);
    await zip.agregar("estado.json", Buffer.from(JSON.stringify({ respaldadoEl: new Date().toISOString(), items }), "utf8"));

    const guardados = [];
    const faltan = [];
    for (const id of ids) {
      let archivo = null;
      try {
        archivo = await almacen.leer(id);
      } catch (err) {
        console.warn(`[nova] Respaldo: no se pudo leer ${id}: ${err.message}`);
      }
      if (!archivo) { faltan.push(id); continue; }
      const nombre = `medios/${id}${extensionDe(archivo.mime)}`;
      await zip.agregar(nombre, archivo.data);
      guardados.push({ id, nombre, mime: archivo.mime, bytes: archivo.data.length });
    }

    const pesaMedios = guardados.reduce((s, m) => s + m.bytes, 0);
    await zip.agregar("manifiesto.json", Buffer.from(JSON.stringify({
      hechoEl: new Date().toISOString(),
      ...cuentas,
      claves: items.length,
      medios: guardados.length,
      bytesDeMedios: pesaMedios,
      faltan,
      archivos: guardados,
    }, null, 2), "utf8"));

    await zip.agregar("LEEME.txt", Buffer.from(
      [
        "RESPALDO COMPLETO DE NOVITOOLS STUDIO ADS",
        `Hecho el ${new Date().toLocaleString("es-PE")}`,
        "",
        `Anuncios en la Biblioteca: ${cuentas.anuncios}`,
        `Piezas: ${cuentas.piezas}`,
        `Archivos (videos e imágenes): ${guardados.length} · ${(pesaMedios / 1048576).toFixed(1)} MB`,
        faltan.length ? `OJO: ${faltan.length} archivo(s) no se pudieron leer: ${faltan.join(", ")}` : "Todos los archivos se leyeron bien.",
        "",
        "Qué hay adentro",
        "  estado.json      todo lo que la app guarda: anuncios, guiones, piezas, hooks, ajustes.",
        "  medios/          los videos y las imágenes, con el id que usa la app de nombre.",
        "  manifiesto.json  el detalle de lo que entró, archivo por archivo.",
        "",
        "Cómo se devuelve",
        "  Desde la carpeta del proyecto, con el servidor apuntando a la base donde quieras",
        "  restaurar:",
        "",
        "      node scripts/restaurar.mjs ruta/al/respaldo.zip",
        "",
        "  Muestra primero qué va a escribir y pide confirmación. Con --forzar no pregunta.",
        "  No borra nada que no esté en el respaldo.",
        "",
        "Este archivo se puede abrir como cualquier .zip: los videos están tal cual,",
        "sin comprimir, listos para verlos aunque la app ya no exista.",
      ].join("\n"), "utf8"));

    await zip.cerrar();
    res.end();
    console.log(`[nova] Respaldo enviado: ${cuentas.anuncios} anuncios, ${guardados.length} archivos, ${(pesaMedios / 1048576).toFixed(1)} MB${faltan.length ? `, ${faltan.length} sin leer` : ""}`);
  }));

  return router;
}
