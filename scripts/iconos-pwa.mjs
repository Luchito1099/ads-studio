#!/usr/bin/env node
/**
 * Genera los iconos de la app instalable (PWA) sin dependencias: cuadrado
 * turquesa con la "N" de NOVA. Se dibujan a mano porque no hay canvas en Node.
 *
 *   node scripts/iconos-pwa.mjs
 *
 * Escribe public/icon-192.png, public/icon-512.png y public/icon-maskable.png
 * (este último con margen, que es lo que Android recorta en círculo).
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONDO = [13, 148, 136]; // --accent
const TINTA = [255, 255, 255];

const tablaCRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = tablaCRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}
function png(ancho, alto, pixeles) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  const filas = Buffer.alloc((ancho * 4 + 1) * alto);
  for (let y = 0; y < alto; y++) {
    filas[y * (ancho * 4 + 1)] = 0;
    pixeles.copy(filas, y * (ancho * 4 + 1) + 1, y * ancho * 4, (y + 1) * ancho * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", ihdr),
    trozo("IDAT", zlib.deflateSync(filas, { level: 9 })),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

/** Distancia de un punto al segmento a-b: sirve para dibujar trazos con bordes suaves. */
function aTrazo(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function icono(lado, margen) {
  const px = Buffer.alloc(lado * lado * 4);
  const radio = lado * 0.22;                 // esquinas redondeadas
  const m = lado * margen;                   // aire alrededor de la letra
  const grosor = lado * 0.085;
  const x1 = m + lado * 0.1, x2 = lado - m - lado * 0.1;
  const y1 = m + lado * 0.08, y2 = lado - m - lado * 0.08;
  const trazos = [[x1, y2, x1, y1], [x1, y1, x2, y2], [x2, y2, x2, y1]]; // la "N"
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const i = (y * lado + x) * 4;
      // fondo con esquinas redondeadas (en el maskable el fondo llega al borde)
      const cx = Math.min(Math.max(x, radio), lado - radio), cy = Math.min(Math.max(y, radio), lado - radio);
      const fuera = margen > 0.1 ? false : Math.hypot(x - cx, y - cy) > radio;
      const dentroN = trazos.some((t) => aTrazo(x + 0.5, y + 0.5, ...t) <= grosor / 2);
      const [r, g, b] = dentroN ? TINTA : FONDO;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = fuera ? 0 : 255;
    }
  }
  return png(lado, lado, px);
}

const destino = path.join(RAIZ, "public");
fs.mkdirSync(destino, { recursive: true });
const archivos = [
  ["icon-192.png", icono(192, 0.22)],
  ["icon-512.png", icono(512, 0.22)],
  ["icon-maskable.png", icono(512, 0.3)],
];
for (const [nombre, datos] of archivos) {
  fs.writeFileSync(path.join(destino, nombre), datos);
  console.log(`${nombre} · ${(datos.length / 1024).toFixed(1)} KB`);
}
