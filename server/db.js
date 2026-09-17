import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Almacén clave-valor con dos backends intercambiables:
 *
 *   - Postgres, si existe DATABASE_URL (recomendado en producción).
 *   - SQLite en DB_PATH, si no. Es lo que se usa en local sin configurar nada.
 *
 * Ambos exponen la misma interfaz async, así que el resto del servidor no
 * sabe cuál está debajo.
 */

// En Coolify esto apunta al volumen persistente (ej. /data/nova.db).
// En local, a ./data/nova.db.
export const SQLITE_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "nova.db");

export async function openSqlite(file) {
  const { default: Database } = await import("better-sqlite3");
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
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
    CREATE TABLE IF NOT EXISTS blob (
      id         TEXT PRIMARY KEY,
      mime       TEXT NOT NULL,
      data       BLOB NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const stmts = {
    get: db.prepare("SELECT key, value FROM kv WHERE key = ?"),
    all: db.prepare("SELECT key, value, updated_at FROM kv ORDER BY key"),
    count: db.prepare("SELECT COUNT(*) AS n FROM kv"),
    set: db.prepare(`
      INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `),
    del: db.prepare("DELETE FROM kv WHERE key = ?"),
    metaGet: db.prepare("SELECT value FROM meta WHERE key = ?"),
    metaSet: db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)"),
    blobGet: db.prepare("SELECT mime, data FROM blob WHERE id = ?"),
    blobSet: db.prepare("INSERT OR REPLACE INTO blob (id, mime, data, created_at) VALUES (?, ?, ?, ?)"),
    blobDel: db.prepare("DELETE FROM blob WHERE id = ?"),
  };

  return {
    kind: "sqlite",
    label: `SQLite ${file}`,
    get: async (key) => stmts.get.get(key) ?? null,
    all: async () => stmts.all.all(),
    count: async () => stmts.count.get().n,
    set: async (key, value) => void stmts.set.run(key, value, new Date().toISOString()),
    delete: async (key) => void stmts.del.run(key),
    metaGet: async (key) => stmts.metaGet.get(key)?.value ?? null,
    metaSet: async (key, value) => void stmts.metaSet.run(key, value),
    blobGet: async (id) => stmts.blobGet.get(id) ?? null,
    blobSet: async (id, mime, data) => void stmts.blobSet.run(id, mime, data, new Date().toISOString()),
    blobDel: async (id) => void stmts.blobDel.run(id),
    close: async () => db.close(),
  };
}

/**
 * DATABASE_SSL:
 *   (vacío)  lo que diga la URL
 *   require  TLS sin validar el certificado (RDS, Supabase, Neon sin CA)
 *   verify   TLS validando el certificado
 *   false    sin TLS
 * Si usas esta variable, no pongas `sslmode` en la URL: la URL tiene prioridad.
 */
function sslOption() {
  switch ((process.env.DATABASE_SSL || "").toLowerCase()) {
    case "require": return { rejectUnauthorized: false };
    case "verify": return { rejectUnauthorized: true };
    case "false": return false;
    default: return undefined;
  }
}

export async function openPostgres(url) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: url, ssl: sslOption(), max: 5 });
  // Sin esto, un corte de la conexión inactiva tumba el proceso.
  pool.on("error", (err) => console.error("[nova] Error en conexión Postgres inactiva:", err.message));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kv (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blob (
      id         TEXT PRIMARY KEY,
      mime       TEXT NOT NULL,
      data       BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const upsert = `
    INSERT INTO kv (key, value, updated_at) VALUES ($1, $2, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
  `;
  const { hostname, port, pathname } = new URL(url);

  return {
    kind: "postgres",
    label: `Postgres ${hostname}${port ? ":" + port : ""}${pathname}`,
    get: async (key) => (await pool.query("SELECT key, value FROM kv WHERE key = $1", [key])).rows[0] ?? null,
    all: async () => (await pool.query("SELECT key, value, updated_at FROM kv ORDER BY key")).rows,
    count: async () => (await pool.query("SELECT COUNT(*)::int AS n FROM kv")).rows[0].n,
    set: async (key, value) => void (await pool.query(upsert, [key, value])),
    delete: async (key) => void (await pool.query("DELETE FROM kv WHERE key = $1", [key])),
    metaGet: async (key) => (await pool.query("SELECT value FROM meta WHERE key = $1", [key])).rows[0]?.value ?? null,
    metaSet: async (key, value) =>
      void (await pool.query(
        "INSERT INTO meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [key, value]
      )),
    blobGet: async (id) => (await pool.query("SELECT mime, data FROM blob WHERE id = $1", [id])).rows[0] ?? null,
    blobSet: async (id, mime, data) =>
      void (await pool.query(
        "INSERT INTO blob (id, mime, data) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data",
        [id, mime, data]
      )),
    blobDel: async (id) => void (await pool.query("DELETE FROM blob WHERE id = $1", [id])),
    /** Escribe todas las filas o ninguna. */
    async setMany(rows, meta = []) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const { key, value } of rows) await client.query(upsert, [key, value]);
        for (const { key, value } of meta) {
          await client.query("INSERT INTO meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING", [key, value]);
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

export function openStore() {
  const url = process.env.DATABASE_URL;
  return url ? openPostgres(url) : openSqlite(SQLITE_PATH);
}

/**
 * Secreto para firmar la cookie de sesión.
 *
 * Si no se define SESSION_SECRET se genera uno y se guarda en la base, para
 * que las sesiones sobrevivan a los reinicios del contenedor. Definirlo como
 * variable de entorno es preferible: permite invalidar todas las sesiones
 * cambiándolo.
 */
export async function getSessionSecret(store) {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const stored = await store.metaGet("session_secret");
  if (stored) return stored;
  const generated = crypto.randomBytes(32).toString("hex");
  await store.metaSet("session_secret", generated);
  return generated;
}
