/**
 * Guardia del estado del Studio.
 *
 * Todo lo que ve el usuario —la Biblioteca completa, las piezas, los hooks—
 * vive en una sola clave (`studio:state:v2`) que se reescribe entera en cada
 * guardado. Un error en el navegador puede mandar un estado con la mitad de
 * los anuncios y borrarlos para siempre sin que nadie se entere.
 *
 * Por eso el servidor:
 *   1. Guarda una copia de seguridad antes de pisar el estado.
 *   2. Rechaza un guardado que venga con menos anuncios (o piezas, hooks,
 *      productos) de los que ya había, salvo que el usuario lo haya pedido
 *      a propósito (borrar o importar: `permitir=1`).
 *
 * Borrar de a uno sigue funcionando: el margen tolera bajas pequeñas.
 */

const ESTADO = "studio:state:v2";
const PREFIJO = "studio:respaldo:";
const MAX_RESPALDOS = 20;
const MARGEN = 3;              // bajas pequeñas (borrar un anuncio) pasan sin permiso
const CADA_MS = 20 * 60 * 1000; // una copia cada 20 minutos como mucho

const LISTAS = [
  ["refs", "anuncios de la Biblioteca"],
  ["pieces", "piezas"],
  ["hooks", "hooks"],
  ["products", "productos"],
];

const cuenta = (obj, campo) => (Array.isArray(obj?.[campo]) ? obj[campo].length : null);

/** Qué listas encogieron más de lo tolerable. Devuelve [] si todo está bien. */
export function perdidas(antes, ahora) {
  const malas = [];
  for (const [campo, nombre] of LISTAS) {
    const a = cuenta(antes, campo), b = cuenta(ahora, campo);
    if (a === null || b === null) continue;
    if (b < a - MARGEN) malas.push({ campo, nombre, antes: a, ahora: b });
  }
  return malas;
}

export function crearGuardia(kv) {
  let ultimaCopia = 0;

  const respaldos = async () => (await kv.all())
    .filter((r) => r.key.startsWith(PREFIJO))
    .map((r) => r.key)
    .sort();

  /** Copia el estado actual antes de pisarlo, y deja solo las últimas. */
  const copiar = async (valor, forzar) => {
    const ahora = Date.now();
    if (!forzar && ahora - ultimaCopia < CADA_MS) return;
    ultimaCopia = ahora;
    await kv.set(PREFIJO + new Date(ahora).toISOString().replace(/[:.]/g, "-"), valor);
    const viejas = await respaldos();
    for (const k of viejas.slice(0, Math.max(0, viejas.length - MAX_RESPALDOS))) await kv.delete(k);
  };

  return {
    esEstado: (key) => key === ESTADO,
    respaldos,
    /**
     * Devuelve null si se puede escribir, o el error a responder.
     * Guarda la copia de seguridad cuando corresponde.
     */
    async revisar(valorNuevo, permitido) {
      const fila = await kv.get(ESTADO);
      if (!fila) return null;                       // primera escritura: nada que perder
      let antes = null, ahora = null;
      try { antes = JSON.parse(fila.value); ahora = JSON.parse(valorNuevo); } catch { return null; }
      const malas = perdidas(antes, ahora);
      if (malas.length && !permitido) {
        await copiar(fila.value, true);
        const d = malas[0];
        return {
          error: `El guardado venía con ${d.ahora} ${d.nombre} y en el servidor hay ${d.antes}. ` +
            `No se guardó nada para no perderlos: recarga la página y vuelve a intentarlo.`,
          detalle: malas,
        };
      }
      await copiar(fila.value, malas.length > 0);
      return null;
    },
  };
}
