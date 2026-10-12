/**
 * Zip mínimo sin compresión (método "stored"), sin dependencias.
 *
 * `crearZip` arma el archivo entero en memoria: sirve para la extensión, que
 * pesa unos pocos KB. `escribirZip` lo va mandando a un stream a medida que se
 * agregan archivos, que es lo que necesita el respaldo completo: nunca tiene en
 * memoria más de un video a la vez y aguanta bibliotecas de varios GB.
 */

const TABLA = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function fechaDos(d) {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    fecha: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** archivos: [{ nombre: "carpeta/archivo.js", datos: Buffer }] */
export function crearZip(archivos) {
  const { hora, fecha } = fechaDos(new Date());
  const locales = [];
  const centrales = [];
  let offset = 0;

  for (const { nombre, datos } of archivos) {
    const n = Buffer.from(nombre, "utf8");
    const crc = crc32(datos);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versión necesaria
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(0, 8); // sin compresión
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(fecha, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(n.length, 26);
    local.writeUInt16LE(0, 28);
    locales.push(local, n, datos);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(hora, 12);
    central.writeUInt16LE(fecha, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    centrales.push(central, n);

    offset += local.length + n.length + datos.length;
  }

  const tamCentral = centrales.reduce((s, b) => s + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(tamCentral, 12);
  fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locales, ...centrales, fin]);
}

/* ---------------------------------------------------------------------------
 * Zip al vuelo
 * ------------------------------------------------------------------------- */

const U32 = 0xffffffff;
const U16 = 0xffff;

/**
 * Va escribiendo un zip en `salida` (un stream, normalmente la respuesta HTTP).
 *
 *   const zip = escribirZip(res);
 *   await zip.agregar("medios/m1.mp4", buffer);
 *   await zip.cerrar();
 *
 * Cuando el paquete pasa de 4 GB o de 65.535 archivos escribe las estructuras
 * zip64, que es lo que entienden el Explorador de Windows, Finder y 7-Zip.
 * `forzarZip64` existe para poder probar ese camino con archivos chicos.
 */
export function escribirZip(salida, { forzarZip64 = false } = {}) {
  const { hora, fecha } = fechaDos(new Date());
  const centrales = [];
  let offset = 0;
  let total = 0;

  const escribir = (buf) =>
    new Promise((ok, falla) => salida.write(buf, (err) => (err ? falla(err) : ok())));

  return {
    get archivos() { return total; },
    get bytes() { return offset; },

    async agregar(nombre, datos) {
      if (datos.length > U32) throw new Error(`"${nombre}" pasa de 4 GB: el zip no lo soporta`);
      const n = Buffer.from(nombre, "utf8");
      const crc = crc32(datos);

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(forzarZip64 ? 45 : 20, 4);
      local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
      local.writeUInt16LE(0, 8); // sin compresión
      local.writeUInt16LE(hora, 10);
      local.writeUInt16LE(fecha, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(datos.length, 18);
      local.writeUInt32LE(datos.length, 22);
      local.writeUInt16LE(n.length, 26);
      local.writeUInt16LE(0, 28);
      await escribir(local);
      await escribir(n);
      if (datos.length) await escribir(datos);

      // El dato que se desborda primero es la posición del archivo dentro del zip.
      const grande = forzarZip64 || offset > U32;
      const extra = grande ? Buffer.alloc(12) : Buffer.alloc(0);
      if (grande) {
        extra.writeUInt16LE(0x0001, 0);
        extra.writeUInt16LE(8, 2);
        extra.writeBigUInt64LE(BigInt(offset), 4);
      }
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(45, 4);
      central.writeUInt16LE(grande ? 45 : 20, 6);
      central.writeUInt16LE(0x0800, 8);
      central.writeUInt16LE(0, 10);
      central.writeUInt16LE(hora, 12);
      central.writeUInt16LE(fecha, 14);
      central.writeUInt32LE(crc, 16);
      central.writeUInt32LE(datos.length, 20);
      central.writeUInt32LE(datos.length, 24);
      central.writeUInt16LE(n.length, 28);
      central.writeUInt16LE(extra.length, 30);
      central.writeUInt32LE(grande ? U32 : offset, 42);
      centrales.push(central, n, extra);

      offset += local.length + n.length + datos.length;
      total++;
    },

    async cerrar() {
      const inicioCentral = offset;
      const tamCentral = centrales.reduce((s, b) => s + b.length, 0);
      for (const b of centrales) await escribir(b);

      const grande = forzarZip64 || inicioCentral > U32 || tamCentral > U32 || total > U16;
      if (grande) {
        const z64 = Buffer.alloc(56);
        z64.writeUInt32LE(0x06064b50, 0);
        z64.writeBigUInt64LE(44n, 4); // tamaño de este registro, sin los 12 primeros bytes
        z64.writeUInt16LE(45, 12);
        z64.writeUInt16LE(45, 14);
        z64.writeBigUInt64LE(BigInt(total), 24);
        z64.writeBigUInt64LE(BigInt(total), 32);
        z64.writeBigUInt64LE(BigInt(tamCentral), 40);
        z64.writeBigUInt64LE(BigInt(inicioCentral), 48);
        const loc = Buffer.alloc(20);
        loc.writeUInt32LE(0x07064b50, 0);
        loc.writeBigUInt64LE(BigInt(inicioCentral + tamCentral), 8);
        loc.writeUInt32LE(1, 16);
        await escribir(z64);
        await escribir(loc);
      }
      const fin = Buffer.alloc(22);
      fin.writeUInt32LE(0x06054b50, 0);
      fin.writeUInt16LE(grande ? U16 : total, 8);
      fin.writeUInt16LE(grande ? U16 : total, 10);
      fin.writeUInt32LE(grande ? U32 : tamCentral, 12);
      fin.writeUInt32LE(grande ? U32 : inicioCentral, 16);
      await escribir(fin);
      return { archivos: total, bytes: inicioCentral + tamCentral + 22 };
    },
  };
}
