import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";

// En Coolify esto apunta al volumen persistente (ej. /data/nova.db).
// En local, a ./data/nova.db.
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "nova.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
// WAL: mejor concurrencia lectura/escritura y menos riesgo de corrupción.
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS kv (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const stmts = {
  get: db.prepare("SELECT key, value FROM kv WHERE key = ?"),
  all: db.prepare("SELECT key, value, updated_at FROM kv ORDER BY key"),
  set: db.prepare(`
    INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `),
  del: db.prepare("DELETE FROM kv WHERE key = ?"),
  metaGet: db.prepare("SELECT value FROM meta WHERE key = ?"),
  metaSet: db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)"),
};

export const kv = {
  get: (key) => stmts.get.get(key) ?? null,
  all: () => stmts.all.all(),
  set: (key, value) => stmts.set.run(key, value, new Date().toISOString()),
  delete: (key) => stmts.del.run(key),
};

/**
 * Secreto para firmar la cookie de sesión.
 *
 * Si no se define SESSION_SECRET se genera uno y se guarda en la base, para
 * que las sesiones sobrevivan a los reinicios del contenedor. Definirlo como
 * variable de entorno es preferible: permite invalidar todas las sesiones
 * cambiándolo.
 */
export function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const stored = stmts.metaGet.get("session_secret");
  if (stored) return stored.value;
  const generated = crypto.randomBytes(32).toString("hex");
  stmts.metaSet.run("session_secret", generated);
  return generated;
}

export { DB_PATH };
export default db;
