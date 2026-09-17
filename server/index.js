import path from "node:path";
import fs from "node:fs";
import express from "express";
import cookieParser from "cookie-parser";

import { openStore, getSessionSecret } from "./db.js";
import { openBlobs } from "./blobs.js";
import { makeImages, isImageKey, objectKeyOf, parseDataUrl } from "./images.js";
import { importFromSqlite } from "./migrate.js";
import { syncRouter } from "./sync.js";
import {
  COOKIE_NAME,
  setSessionSecret,
  cookieOptions,
  issueToken,
  passwordMatches,
  requireAuth,
  tokenIsValid,
  loginRateLimit,
  recordFailure,
  clearFailures,
} from "./auth.js";

/* ---------------- arranque: base + S3 ---------------- */
let kv;
try {
  kv = await openStore();
} catch (err) {
  console.error("[nova] No se pudo abrir la base de datos:", err.message);
  process.exit(1);
}

const blobs = openBlobs();
if (blobs) {
  // Solo avisa: HeadBucket pide s3:ListBucket, que a veces no se concede
  // aunque subir y leer objetos funcione.
  blobs.check().catch((err) =>
    console.warn(`[nova] Aviso: no se pudo verificar ${blobs.label} (${err.name}). Revisa bucket, región y credenciales.`)
  );
}
const images = makeImages(blobs);

try {
  await importFromSqlite(kv, images);
} catch (err) {
  console.error("[nova] Falló la importación desde SQLite:", err.message);
  process.exit(1);
}
setSessionSecret(await getSessionSecret(kv));

// Express 4 no captura errores de handlers async: sin esto una promesa
// rechazada deja la petición colgada.
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DIST = path.join(process.cwd(), "dist");

// Coolify pone Traefik delante: sin esto req.secure y req.ip son incorrectos.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Las miniaturas del banco llegan como data URL, por eso el límite alto.
app.use(express.json({ limit: "12mb" }));
app.use(cookieParser());

/* ---------------- salud ---------------- */
app.get("/api/health", (_req, res) => res.json({ ok: true }));

/* ---------------- sesión ---------------- */
app.get("/api/session", (req, res) => {
  res.json({ authenticated: tokenIsValid(req.cookies?.[COOKIE_NAME]) });
});

app.post("/api/login", loginRateLimit, (req, res) => {
  if (!passwordMatches(req.body?.password)) {
    recordFailure(req);
    return res.status(401).json({ error: "Contraseña incorrecta" });
  }
  clearFailures(req);
  res.cookie(COOKIE_NAME, issueToken(), cookieOptions(req));
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(req), maxAge: undefined });
  res.json({ ok: true });
});

/* ---------------- almacenamiento (window.storage) ---------------- */
const readKey = (req, res) => {
  const key = req.query.key;
  if (typeof key !== "string" || !key || key.length > 512) {
    res.status(400).json({ error: "Clave inválida" });
    return null;
  }
  return key;
};

app.get("/api/kv", requireAuth, wrap(async (req, res) => {
  const key = readKey(req, res);
  if (key === null) return;
  const row = await kv.get(key);
  if (!row) return res.status(404).json({ error: "No encontrado" });
  res.json({ key: row.key, value: images.toClient(key, row.value) });
}));

app.put("/api/kv", requireAuth, wrap(async (req, res) => {
  const key = readKey(req, res);
  if (key === null) return;
  const { value } = req.body ?? {};
  if (typeof value !== "string") {
    return res.status(400).json({ error: "El campo 'value' debe ser string" });
  }
  const prev = isImageKey(key) ? await kv.get(key) : null;
  const stored = await images.toStored(key, value);
  await kv.set(key, stored);
  if (prev) await images.discard(prev.value, stored);
  res.status(204).end();
}));

app.delete("/api/kv", requireAuth, wrap(async (req, res) => {
  const key = readKey(req, res);
  if (key === null) return;
  const prev = isImageKey(key) ? await kv.get(key) : null;
  await kv.delete(key);
  if (prev) await images.discard(prev.value);
  res.status(204).end();
}));

// Sirve las imágenes del banco. Pasan por acá (y no directo desde S3) para
// que el bucket siga privado y solo las vea quien tiene sesión.
app.get("/api/img", requireAuth, wrap(async (req, res) => {
  const key = readKey(req, res);
  if (key === null) return;
  const row = isImageKey(key) ? await kv.get(key) : null;
  if (!row) return res.status(404).end();

  // `v` cambia con cada subida, así que la respuesta puede cachearse.
  res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  const objectKey = objectKeyOf(row.value);
  if (objectKey && blobs) {
    try {
      const obj = await blobs.get(objectKey);
      res.type(obj.ContentType || "application/octet-stream");
      obj.Body.on("error", (err) => res.destroy(err)).pipe(res);
    } catch (err) {
      if (err.name === "NoSuchKey") return res.status(404).end();
      throw err;
    }
    return;
  }
  const img = parseDataUrl(row.value);
  if (!img) return res.status(404).end();
  res.type(img.type).send(img.buffer);
}));

/* ---------------- sincronización con Meta (vía Claude) ---------------- */
app.use("/api/sync", syncRouter({ kv, requireAuth, wrap }));

// Respaldo manual: descarga todo el contenido de la base en un JSON.
// Las imágenes que están en S3 aparecen como puntero `s3:…`; el archivo
// en sí se respalda desde el bucket.
app.get("/api/export", requireAuth, wrap(async (_req, res) => {
  res.setHeader("Content-Disposition", 'attachment; filename="nova-backup.json"');
  res.json({ exportedAt: new Date().toISOString(), items: await kv.all() });
}));

/* ---------------- frontend ---------------- */
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false }));
  // SPA: cualquier ruta que no sea /api devuelve index.html.
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(DIST, "index.html")));
} else {
  console.warn(`[nova] No existe ${DIST}. Corre "npm run build" para servir el frontend.`);
}

app.use((err, _req, res, _next) => {
  console.error("[nova] Error:", err);
  if (!res.headersSent) res.status(500).json({ error: "Error del servidor" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[nova] Escuchando en http://0.0.0.0:${PORT}`);
  console.log(`[nova] Base de datos: ${kv.label}`);
  console.log(`[nova] Imágenes: ${blobs ? blobs.label : "dentro de la base (S3 no configurado)"}`);
});
