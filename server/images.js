/**
 * Traduce las claves de imagen (`nova-refimg:{id}`) entre lo que maneja el
 * componente y lo que se guarda.
 *
 * El componente guarda y lee data URLs y las usa directo como `src`. Con S3:
 *   - al escribir, la data URL se sube al bucket y en la base queda un
 *     puntero `s3:{objeto}`;
 *   - al leer, el puntero se devuelve como `/api/img?...`, que el <img>
 *     carga con la cookie de sesión. El bucket nunca queda público.
 *
 * Las filas antiguas que aún tienen la data URL se devuelven tal cual.
 */

export const IMG_PREFIX = "nova-refimg:";
export const isImageKey = (key) => key.startsWith(IMG_PREFIX);

const POINTER = "s3:";
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export function parseDataUrl(value) {
  const m = /^data:([\w/+.-]+);base64,(.*)$/s.exec(value);
  if (!m) return null;
  return { type: m[1], buffer: Buffer.from(m[2], "base64") };
}

export const objectKeyOf = (stored) => (stored?.startsWith(POINTER) ? stored.slice(POINTER.length) : null);

export function makeImages(blobs) {
  return {
    enabled: !!blobs,

    /** Valor que llega del navegador -> valor que se guarda en la base. */
    async toStored(key, value) {
      if (!blobs || !isImageKey(key)) return value;
      const img = parseDataUrl(value);
      if (!img) return value;
      const id = key.slice(IMG_PREFIX.length).replace(/[^\w-]/g, "_");
      // Nombre nuevo en cada subida: así la URL cambia y el navegador no
      // muestra la imagen anterior desde su caché.
      const objectKey = blobs.keyFor(`refimg/${id}/${Date.now()}.${EXT[img.type] || "bin"}`);
      await blobs.put(objectKey, img.buffer, img.type);
      return POINTER + objectKey;
    },

    /** Valor guardado -> valor que recibe el navegador. */
    toClient(key, stored) {
      const objectKey = objectKeyOf(stored);
      if (!objectKey) return stored;
      return `/api/img?key=${encodeURIComponent(key)}&v=${encodeURIComponent(objectKey.split("/").pop())}`;
    },

    /** Borra del bucket el objeto de `stored` si ya no es el vigente. */
    async discard(stored, current = null) {
      const objectKey = objectKeyOf(stored);
      if (!blobs || !objectKey || stored === current) return;
      try {
        await blobs.delete(objectKey);
      } catch (err) {
        console.warn(`[nova] No se pudo borrar ${objectKey} de S3:`, err.message);
      }
    },
  };
}
