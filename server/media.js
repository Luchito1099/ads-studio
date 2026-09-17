import express from "express";

/**
 * Archivos del Studio (videos e imágenes de la biblioteca y de las piezas).
 *
 * Van a S3 si está configurado; si no, a la tabla `blob` de la base. Los
 * metadatos (miniatura, duración, tipo) los guarda el navegador en el kv con
 * la clave `studio:media:{id}`; acá solo viven los bytes.
 */

export const MEDIA_ID = /^[\w-]{1,64}$/;
export const MEDIA_LIMITE = process.env.MEDIA_MAX_MB ? `${process.env.MEDIA_MAX_MB}mb` : "300mb";

/** Guardar, leer y borrar bytes, en S3 o en la base. Lo usan la app y la extensión. */
export function almacenArchivos({ kv, blobs }) {
  const objectKey = (id) => blobs.keyFor(`media/${id}`);
  return {
    async guardar(id, buffer, mime) {
      if (blobs) await blobs.put(objectKey(id), buffer, mime);
      else await kv.blobSet(id, mime, buffer);
    },
    /** Escribe el archivo en `res`; devuelve false si no existe. */
    async enviar(id, res) {
      if (blobs) {
        try {
          const obj = await blobs.get(objectKey(id));
          res.type(obj.ContentType || "application/octet-stream");
          if (obj.ContentLength) res.setHeader("Content-Length", obj.ContentLength);
          obj.Body.on("error", (err) => res.destroy(err)).pipe(res);
          return true;
        } catch (err) {
          // Archivos subidos antes de configurar S3 siguen en la base.
          if (err.name !== "NoSuchKey") throw err;
        }
      }
      const row = await kv.blobGet(id);
      if (!row) return false;
      res.type(row.mime).send(Buffer.from(row.data));
      return true;
    },
    async borrar(id) {
      if (blobs) await blobs.delete(objectKey(id)).catch(() => {});
      await kv.blobDel(id);
    },
  };
}

/** Recibe el cuerpo crudo y lo guarda con el id de la ruta. */
export function subidaCruda(almacen) {
  return [
    express.raw({ type: () => true, limit: MEDIA_LIMITE }),
    async (req, res) => {
      if (!MEDIA_ID.test(req.params.id)) return res.status(400).json({ error: "Id inválido" });
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: "Archivo vacío" });
      await almacen.guardar(req.params.id, req.body, req.get("content-type") || "application/octet-stream");
      res.status(204).end();
    },
  ];
}

export function mediaRouter({ almacen, requireAuth, wrap }) {
  const router = express.Router();
  const [raw, subir] = subidaCruda(almacen);

  router.put("/:id", requireAuth, raw, wrap(subir));

  router.get("/:id", requireAuth, wrap(async (req, res) => {
    if (!MEDIA_ID.test(req.params.id)) return res.status(400).json({ error: "Id inválido" });
    // Los ids no se reutilizan: el contenido nunca cambia.
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    if (!(await almacen.enviar(req.params.id, res))) res.status(404).end();
  }));

  router.delete("/:id", requireAuth, wrap(async (req, res) => {
    if (!MEDIA_ID.test(req.params.id)) return res.status(400).json({ error: "Id inválido" });
    await almacen.borrar(req.params.id);
    res.status(204).end();
  }));

  return router;
}
