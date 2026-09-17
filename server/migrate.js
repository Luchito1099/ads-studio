import fs from "node:fs";
import { openSqlite, SQLITE_PATH } from "./db.js";
import { isImageKey } from "./images.js";

/**
 * Datos por defecto de un Postgres nuevo: si la base está vacía y existe el
 * SQLite que se usaba antes (DB_PATH o SQLITE_IMPORT_PATH), copia todo su
 * contenido. Las imágenes se suben a S3 en el camino, si está configurado.
 *
 * Solo corre con la base vacía, así que es seguro dejarlo activo: nunca pisa
 * datos existentes. La escritura es una sola transacción; si algo falla, la
 * base queda vacía y se reintenta en el próximo arranque.
 *
 * Si no hay SQLite, no se importa nada y la app carga sus datos de ejemplo.
 */
export async function importFromSqlite(store, images) {
  if (store.kind !== "postgres") return;
  if ((await store.count()) > 0) return;

  const file = process.env.SQLITE_IMPORT_PATH || SQLITE_PATH;
  if (!fs.existsSync(file)) {
    console.log("[nova] Postgres vacío y sin SQLite que importar: la app cargará los datos de ejemplo.");
    return;
  }

  console.log(`[nova] Postgres vacío: importando ${file}…`);
  const src = await openSqlite(file);
  try {
    const rows = [];
    let uploaded = 0;
    for (const { key, value } of await src.all()) {
      const stored = await images.toStored(key, value);
      if (isImageKey(key) && stored !== value) uploaded++;
      rows.push({ key, value: stored });
    }
    const secret = await src.metaGet("session_secret");
    await store.setMany(rows, secret ? [{ key: "session_secret", value: secret }] : []);
    console.log(`[nova] Importadas ${rows.length} claves (${uploaded} imágenes subidas a S3).`);
  } finally {
    await src.close();
  }
}
