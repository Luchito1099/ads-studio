import path from "node:path";
import fs from "node:fs";
import express from "express";
import cookieParser from "cookie-parser";

import { kv, DB_PATH } from "./db.js";
import {
  COOKIE_NAME,
  cookieOptions,
  issueToken,
  passwordMatches,
  requireAuth,
  tokenIsValid,
  loginRateLimit,
  recordFailure,
  clearFailures,
} from "./auth.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DIST = path.join(process.cwd(), "dist");

// Coolify pone Traefik delante: sin esto req.secure y req.ip son incorrectos.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Las miniaturas del banco se guardan como data URL, por eso el límite alto.
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

app.get("/api/kv", requireAuth, (req, res) => {
  const key = readKey(req, res);
  if (key === null) return;
  const row = kv.get(key);
  if (!row) return res.status(404).json({ error: "No encontrado" });
  res.json(row);
});

app.put("/api/kv", requireAuth, (req, res) => {
  const key = readKey(req, res);
  if (key === null) return;
  const { value } = req.body ?? {};
  if (typeof value !== "string") {
    return res.status(400).json({ error: "El campo 'value' debe ser string" });
  }
  kv.set(key, value);
  res.status(204).end();
});

app.delete("/api/kv", requireAuth, (req, res) => {
  const key = readKey(req, res);
  if (key === null) return;
  kv.delete(key);
  res.status(204).end();
});

// Respaldo manual: descarga todo el contenido de la base en un JSON.
app.get("/api/export", requireAuth, (_req, res) => {
  res.setHeader("Content-Disposition", 'attachment; filename="nova-backup.json"');
  res.json({ exportedAt: new Date().toISOString(), items: kv.all() });
});

/* ---------------- frontend ---------------- */
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false }));
  // SPA: cualquier ruta que no sea /api devuelve index.html.
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(DIST, "index.html")));
} else {
  console.warn(`[nova] No existe ${DIST}. Corre "npm run build" para servir el frontend.`);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[nova] Escuchando en http://0.0.0.0:${PORT}`);
  console.log(`[nova] Base de datos: ${DB_PATH}`);
});
