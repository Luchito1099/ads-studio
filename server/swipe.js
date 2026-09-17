import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { crearZip } from "./zip.js";
import { MEDIA_ID, subidaCruda } from "./media.js";

/**
 * Nova Swipe: la extensión de Chrome que guarda anuncios en la Biblioteca.
 *
 * La extensión se autentica con una clave propia (Authorization: Bearer) y
 * deja cada anuncio en una bandeja (`studio:inbox:v1`). El Studio abierto la
 * vacía cada pocos segundos y los agrega a su estado; así el servidor nunca
 * reescribe el estado que el navegador está editando.
 *
 *   Extensión                           Studio (cookie)
 *   PUT  /api/swipe/media/:id  ──┐      GET  /api/inbox
 *   POST /api/swipe/items      ──┴──>   POST /api/inbox/ack
 */

const INBOX_KEY = "studio:inbox:v1";
const STATE_KEY = "studio:state:v2";
const CLAVE_META = "swipe_token";
const USO_META = "swipe_last_used";
const DIR_EXTENSION = path.join(process.cwd(), "extension");
const MAX_BANDEJA = 500;

const iguales = (a, b) => {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};
const texto = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function swipeRouter({ kv, almacen, requireAuth, wrap }) {
  const router = express.Router();

  // Escrituras de la bandeja en fila: dos envíos simultáneos no se pisan.
  let cola = Promise.resolve();
  const enFila = (fn) => (cola = cola.then(fn, fn));

  const leerBandeja = async () => {
    const row = await kv.get(INBOX_KEY);
    return row ? JSON.parse(row.value) : [];
  };

  const clave = async (crear = false) => {
    let c = await kv.metaGet(CLAVE_META);
    if (!c && crear) {
      c = "nsw_" + crypto.randomBytes(24).toString("base64url");
      await kv.metaSet(CLAVE_META, c);
    }
    return c;
  };

  const requireExtension = wrap(async (req, res, next) => {
    const dada = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const esperada = await clave();
    if (!dada || !esperada || !iguales(dada, esperada)) {
      return res.status(401).json({ error: "Clave de Nova Swipe inválida. Descárgala de nuevo desde la Biblioteca o pega la clave actual en las opciones." });
    }
    next();
  });

  /* ---------- desde el Studio (sesión) ---------- */
  router.get("/swipe/status", requireAuth, wrap(async (_req, res) => {
    res.json({
      clave: await clave(true),
      ultimoUso: await kv.metaGet(USO_META),
      pendientes: (await leerBandeja()).length,
    });
  }));

  router.post("/swipe/token", requireAuth, wrap(async (_req, res) => {
    const nueva = "nsw_" + crypto.randomBytes(24).toString("base64url");
    await kv.metaSet(CLAVE_META, nueva);
    res.json({ clave: nueva });
  }));

  // ?config=1 incluye la dirección del Studio y la clave: lista para usar.
  router.get("/swipe/extension.zip", requireAuth, wrap(async (req, res) => {
    if (!fs.existsSync(DIR_EXTENSION)) return res.status(500).json({ error: "La extensión no está en el servidor" });
    const archivos = fs.readdirSync(DIR_EXTENSION, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile() && d.name !== "config.json")
      .map((d) => {
        const abs = path.join(d.parentPath ?? d.path, d.name);
        return { nombre: "nova-swipe/" + path.relative(DIR_EXTENSION, abs).split(path.sep).join("/"), datos: fs.readFileSync(abs) };
      });
    if (req.query.config === "1") {
      const config = { url: `${req.protocol}://${req.get("host")}`, token: await clave(true) };
      archivos.push({ nombre: "nova-swipe/config.json", datos: Buffer.from(JSON.stringify(config, null, 2)) });
    }
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${req.query.config === "1" ? "nova-swipe" : "nova-swipe-webstore"}.zip"`);
    res.send(crearZip(archivos));
  }));

  router.get("/inbox", requireAuth, wrap(async (_req, res) => {
    res.json({ items: await leerBandeja() });
  }));

  router.post("/inbox/ack", requireAuth, wrap(async (req, res) => {
    const ids = new Set(Array.isArray(req.body?.ids) ? req.body.ids.map(String) : []);
    await enFila(async () => {
      const items = await leerBandeja();
      await kv.set(INBOX_KEY, JSON.stringify(items.filter((i) => !ids.has(i.id))));
    });
    res.status(204).end();
  }));

  /* ---------- desde la extensión (clave) ---------- */
  router.get("/swipe/ping", requireExtension, (_req, res) => res.json({ ok: true, app: "NOVA Studio de Ads" }));

  router.get("/swipe/products", requireExtension, wrap(async (_req, res) => {
    const row = await kv.get(STATE_KEY);
    const S = row ? JSON.parse(row.value) : null;
    res.json({
      products: (S?.products || []).map(({ id, name, code }) => ({ id, name, code })),
      productId: S?.productId || null,
      collections: S?.libCollections || [],
    });
  }));

  const [raw, subir] = subidaCruda(almacen);
  router.put("/swipe/media/:id", requireExtension, raw, wrap(subir));

  router.post("/swipe/items", requireExtension, wrap(async (req, res) => {
    const b = req.body || {};
    const mediaId = texto(b.mediaId, 64);
    if (mediaId && !MEDIA_ID.test(mediaId)) return res.status(400).json({ error: "mediaId inválido" });
    const link = texto(b.link, 2000);
    if (!mediaId && !link) return res.status(400).json({ error: "Envía un archivo o un enlace" });
    const item = {
      id: "sw_" + crypto.randomBytes(9).toString("base64url"),
      mediaId: mediaId || null,
      mime: texto(b.mime, 100),
      fileName: texto(b.fileName, 200),
      link,
      pageUrl: texto(b.pageUrl, 2000),
      source: texto(b.source, 60),
      brand: texto(b.brand, 120),
      notes: texto(b.notes, 4000),
      adText: texto(b.adText, 4000),
      adId: texto(b.adId, 60),
      startedAt: texto(b.startedAt, 60),
      titulo: texto(b.titulo, 200),
      descripcion: texto(b.descripcion, 400),
      boton: texto(b.boton, 80),
      destino: texto(b.destino, 200),
      productId: texto(b.productId, 64),
      productCode: texto(b.productCode, 40),
      collection: texto(b.collection, 80),
      capturedAt: new Date().toISOString(),
    };
    await enFila(async () => {
      const items = await leerBandeja();
      if (items.length >= MAX_BANDEJA) throw Object.assign(new Error("La bandeja está llena: abre el Studio para que se vacíe."), { status: 503 });
      items.push(item);
      await kv.set(INBOX_KEY, JSON.stringify(items));
    }).catch((err) => {
      if (err.status) return res.status(err.status).json({ error: err.message });
      throw err;
    });
    if (res.headersSent) return;
    await kv.metaSet(USO_META, item.capturedAt);
    res.status(201).json({ ok: true, id: item.id });
  }));

  return router;
}
