#!/usr/bin/env node
/**
 * Copia el SQLite que está corriendo hoy a un Postgres nuevo, archivos incluidos.
 *
 * Se usa UNA vez, antes de cambiar el servidor a Postgres, y desde adentro del
 * contenedor que tiene la base viva:
 *
 *     cd /app
 *     DB_HOST=... DB_PORT=5432 DB_NAME=nova DB_USER=... DB_PASSWORD=... \
 *       node a-postgres.mjs
 *
 * No depende del resto del proyecto (solo de `better-sqlite3` y `pg`, que ya
 * están en node_modules), así que sirve aunque el contenedor tenga una versión
 * vieja de la app.
 *
 * Qué hace: crea las tablas si faltan, copia todas las claves, el secreto de
 * sesión (para no tener que volver a entrar) y cada video e imagen de la tabla
 * `blob`, comprobando el tamaño de cada archivo después de escribirlo.
 * No borra nada: si una clave ya existe en Postgres, la pisa con la del SQLite.
 */
import fs from "node:fs";

const ruta = process.env.SQLITE_IMPORT_PATH || process.env.DB_PATH || "/data/nova.db";
if (!fs.existsSync(ruta)) {
  console.error(`No encuentro la base SQLite en ${ruta}.`);
  console.error("Pásala con SQLITE_IMPORT_PATH=/ruta/al/nova.db");
  process.exit(1);
}

const { default: Database } = await import("better-sqlite3");
const { default: pg } = await import("pg");

const url = process.env.DATABASE_URL;
const conexion = url
  ? { connectionString: url }
  : {
      host: process.env.DB_HOST || process.env.PGHOST,
      port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
      database: process.env.DB_NAME || process.env.PGDATABASE,
      user: process.env.DB_USER || process.env.PGUSER,
      password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
    };
if (!url && (!conexion.host || !conexion.database || !conexion.user)) {
  console.error("Faltan datos de Postgres: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD (o DATABASE_URL).");
  process.exit(1);
}
if (/^(1|true|require)$/i.test(process.env.DB_SSL || "")) conexion.ssl = { rejectUnauthorized: false };

const mb = (n) => (n / 1048576).toFixed(1) + " MB";
const src = new Database(ruta, { readonly: true, fileMustExist: true });
const pool = new pg.Pool({ ...conexion, max: 2 });

const tabla = (n) => src.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(n);
const claves = tabla("kv") ? src.prepare("SELECT key, value FROM kv").all() : [];
const archivos = tabla("blob") ? src.prepare("SELECT id, mime, LENGTH(data) AS n FROM blob").all() : [];
const secreto = tabla("meta") ? src.prepare("SELECT value FROM meta WHERE key='session_secret'").get()?.value : null;
const estado = claves.find((r) => r.key === "studio:state:v2");
const anuncios = (() => { try { return JSON.parse(estado?.value || "{}").refs?.length ?? 0; } catch { return 0; } })();

console.log(`\nDe: ${ruta}`);
console.log(`  ${claves.length} claves · ${archivos.length} archivos · ${mb(archivos.reduce((s, a) => s + a.n, 0))}`);
console.log(`  anuncios en la Biblioteca: ${anuncios}`);
console.log(`A: ${conexion.database || url} en ${conexion.host || "(url)"}\n`);

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

const cliente = await pool.connect();
try {
  await cliente.query("BEGIN");
  for (const { key, value } of claves) {
    await cliente.query(
      `INSERT INTO kv (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value]
    );
  }
  if (secreto) {
    await cliente.query(
      `INSERT INTO meta (key, value) VALUES ('session_secret', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [secreto]
    );
  }
  await cliente.query("COMMIT");
  console.log(`Claves copiadas: ${claves.length}${secreto ? " (más el secreto de sesión)" : ""}`);
} catch (err) {
  await cliente.query("ROLLBACK");
  throw err;
} finally {
  cliente.release();
}

/* Los archivos van de a uno y se comprueban: con videos de varios MB una sola
 * transacción gigante se queda sin memoria, y acá importa más no perder nada. */
const leer = src.prepare("SELECT mime, data FROM blob WHERE id = ?");
let hechos = 0, bytes = 0;
const malos = [];
for (const { id, n } of archivos) {
  const fila = leer.get(id);
  const datos = Buffer.from(fila.data);
  await pool.query(
    `INSERT INTO blob (id, mime, data) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data`,
    [id, fila.mime || "application/octet-stream", datos]
  );
  const tam = (await pool.query("SELECT octet_length(data) AS n FROM blob WHERE id = $1", [id])).rows[0]?.n;
  if (Number(tam) !== datos.length) malos.push(`${id} (esperaba ${datos.length}, quedó ${tam})`);
  hechos++; bytes += datos.length;
  if (hechos % 5 === 0 || hechos === archivos.length) process.stdout.write(`  ${hechos}/${archivos.length} archivos · ${mb(bytes)}\r`);
}
console.log("");

const enDestino = await pool.query("SELECT (SELECT COUNT(*) FROM kv) AS claves, (SELECT COUNT(*) FROM blob) AS archivos");
const copia = await pool.query("SELECT value FROM kv WHERE key = 'studio:state:v2'");
const quedaron = (() => { try { return JSON.parse(copia.rows[0]?.value || "{}").refs?.length ?? 0; } catch { return 0; } })();
await pool.end();
src.close();

if (malos.length) {
  console.error(`\nATENCIÓN: ${malos.length} archivo(s) no quedaron bien:\n  ${malos.join("\n  ")}`);
  console.error("No cambies el servidor a Postgres todavía: vuelve a correr esto o avísame.");
  process.exit(1);
}
console.log(`\nLISTO: ${enDestino.rows[0].claves} claves y ${enDestino.rows[0].archivos} archivos en Postgres.`);
console.log(`La Biblioteca quedó con ${quedaron} anuncios (en el SQLite hay ${anuncios}).`);
if (quedaron !== anuncios) console.log("Los números no coinciden: revisa antes de cambiar el servidor.");
