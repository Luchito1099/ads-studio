import express from "express";

/**
 * Archivos del Studio (videos e imágenes de la biblioteca y de las piezas).
 *
 * Van a S3 si está configurado; si no, a la tabla `blob` de la base. Los
 * metadatos (miniatura, duración, tipo) los guarda el navegador en el kv con
 * la clave `studio:media:{id}`; acá solo viven los bytes.
 */

const ID = /^[\w-]{1,64}$/;
const LIMITE = process.env.MEDIA_MAX_MB ? `${process.env.MEDIA_MAX_MB}mb` : "300mb";

export function mediaRouter({ kv, blobs, requireAuth, wrap }) {
  const router = express.Router();
  const objectKey = (id) => blobs.keyFor(`media/${id}`);

  const leerId = (req, res) => {
    if (!ID.test(req.params.id)) {
      res.status(400).json({ error: "Id inválido" });
      return null;
    }
    return req.params.id;
  };

  router.put("/:id", requireAuth, express.raw({ type: () => true, limit: LIMITE }), wrap(async (req, res) => {
    const id = leerId(req, res);
    if (!id) return;
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: "Archivo vacío" });
    const mime = req.get("content-type") || "application/octet-stream";
    if (blobs) await blobs.put(objectKey(id), req.body, mime);
    else await kv.blobSet(id, mime, req.body);
    res.status(204).end();
  }));

  router.get("/:id", requireAuth, wrap(async (req, res) => {
    const id = leerId(req, res);
    if (!id) return;
    // Los ids no se reutilizan: el contenido nunca cambia.
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    if (blobs) {
      try {
        const obj = await blobs.get(objectKey(id));
        res.type(obj.ContentType || "application/octet-stream");
        if (obj.ContentLength) res.setHeader("Content-Length", obj.ContentLength);
        obj.Body.on("error", (err) => res.destroy(err)).pipe(res);
        return;
      } catch (err) {
        // Archivos subidos antes de configurar S3 siguen en la base.
        if (err.name !== "NoSuchKey") throw err;
      }
    }
    const row = await kv.blobGet(id);
    if (!row) return res.status(404).end();
    res.type(row.mime).send(Buffer.from(row.data));
  }));

  router.delete("/:id", requireAuth, wrap(async (req, res) => {
    const id = leerId(req, res);
    if (!id) return;
    if (blobs) await blobs.delete(objectKey(id)).catch(() => {});
    await kv.blobDel(id);
    res.status(204).end();
  }));

  return router;
}
