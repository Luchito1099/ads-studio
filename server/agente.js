import crypto from "node:crypto";

/**
 * Clave del canal de agente (la que usa Claude para dejar datos en la app).
 *
 * Puede venir de dos lados:
 *   1. La variable de entorno SYNC_TOKEN (manda sobre todo lo demás).
 *   2. Una clave generada desde Ajustes y guardada en la base, igual que la
 *      clave de la extensión Nova Swipe.
 *
 * Así el usuario puede dejar todo andando desde la app cuando no tiene forma
 * cómoda de tocar las variables de entorno del servidor.
 */

const META = "sync_token";

const safeEqual = (a, b) => {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

export function crearAgente(kv) {
  const leer = async () => {
    const env = (process.env.SYNC_TOKEN || "").trim();
    if (env) return { clave: env, origen: "entorno" };
    const guardada = (await kv.metaGet(META)) || "";
    return { clave: guardada, origen: guardada ? "app" : null };
  };

  return {
    leer,
    hay: async () => !!(await leer()).clave,
    /** Genera y guarda una clave nueva. No se puede si manda la variable de entorno. */
    generar: async () => {
      if ((process.env.SYNC_TOKEN || "").trim()) {
        throw Object.assign(new Error("El servidor ya define SYNC_TOKEN por variable de entorno"), { status: 409 });
      }
      const clave = crypto.randomBytes(32).toString("hex");
      await kv.metaSet(META, clave);
      return clave;
    },
    borrar: async () => kv.metaSet(META, ""),
    /** Middleware: exige Authorization: Bearer <clave>. */
    requireAgente: (req, res, next) => {
      leer()
        .then(({ clave }) => {
          if (!clave) {
            return res.status(503).json({
              error: "La app todavía no tiene clave para Claude: genérala en Ajustes → Conexión con Claude (o define SYNC_TOKEN en el servidor).",
            });
          }
          const dada = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
          if (!dada || !safeEqual(dada, clave)) return res.status(401).json({ error: "Clave inválida" });
          next();
        })
        .catch(next);
    },
  };
}
