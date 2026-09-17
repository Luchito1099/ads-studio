import crypto from "node:crypto";

// Lo fija index.js al arrancar, cuando ya hay conexión con la base.
let SECRET = null;
export const setSessionSecret = (secret) => { SECRET = secret; };
export const COOKIE_NAME = "nova_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

const APP_PASSWORD = process.env.APP_PASSWORD || "";

if (!APP_PASSWORD) {
  console.error(
    "[nova] FALTA APP_PASSWORD. Define la variable de entorno con la contraseña de acceso."
  );
  process.exit(1);
}
if (APP_PASSWORD.length < 8) {
  console.warn("[nova] Aviso: APP_PASSWORD tiene menos de 8 caracteres.");
}

/** Comparación en tiempo constante: comparamos hashes para no filtrar la longitud. */
export function passwordMatches(candidate) {
  const a = crypto.createHash("sha256").update(String(candidate ?? "")).digest();
  const b = crypto.createHash("sha256").update(APP_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

export function issueToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + MAX_AGE_MS })).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function tokenIsValid(token) {
  if (typeof token !== "string" || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  const given = Buffer.from(sig);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

export function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: "lax",
    // Detrás del proxy de Coolify (HTTPS) la cookie va como secure.
    secure: process.env.COOKIE_SECURE === "true" || req.secure,
    maxAge: MAX_AGE_MS,
    path: "/",
  };
}

export function requireAuth(req, res, next) {
  if (tokenIsValid(req.cookies?.[COOKIE_NAME])) return next();
  res.status(401).json({ error: "No autenticado" });
}

/* -------- freno anti fuerza bruta (en memoria, por IP) -------- */
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function loginRateLimit(req, res, next) {
  const ip = req.ip || "desconocida";
  const now = Date.now();
  const entry = attempts.get(ip);

  if (entry && now - entry.first > WINDOW_MS) attempts.delete(ip);

  const current = attempts.get(ip);
  if (current && current.count >= MAX_ATTEMPTS) {
    const mins = Math.ceil((WINDOW_MS - (now - current.first)) / 60000);
    return res.status(429).json({ error: `Demasiados intentos. Espera ${mins} min.` });
  }
  next();
}

export function recordFailure(req) {
  const ip = req.ip || "desconocida";
  const entry = attempts.get(ip);
  if (entry) entry.count += 1;
  else attempts.set(ip, { count: 1, first: Date.now() });
}

export function clearFailures(req) {
  attempts.delete(req.ip || "desconocida");
}
