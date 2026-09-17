/**
 * Convierte un CSV exportado del Administrador de anuncios (nivel anuncio,
 * desglose por día) al esquema del motor. Reconoce encabezados en español e
 * inglés, ignora la fila de totales, entiende "1.725.602" y "1,44" y detecta
 * la moneda del encabezado ("Importe gastado (PEN)").
 */

const quitarTildes = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Cada campo: lista de prefijos aceptados (sin tildes, en minúscula).
const COLUMNAS = {
  dia: ["dia", "day"],
  inicio: ["inicio del informe", "reporting starts"],
  fin: ["fin del informe", "reporting ends"],
  anuncio: ["nombre del anuncio", "ad name"],
  ad_id: ["identificador del anuncio", "id del anuncio", "ad id"],
  campana: ["nombre de la campana", "campaign name"],
  conjunto: ["nombre del conjunto de anuncios", "ad set name"],
  gasto: ["importe gastado", "amount spent"],
  impresiones: ["impresiones", "impressions"],
  alcance: ["alcance", "reach"],
  clics: ["clics en el enlace", "link clicks"],
  resultados: ["resultados", "results"],
  valor: ["valor de conversion de compras", "purchases conversion value", "valor de conversion", "conversion value"],
  vistas_3s: ["reproducciones de video de 3 segundos", "3-second video plays", "reproducciones de 3 segundos"],
};

/** CSV con comillas; detecta `,` `;` o tabulador. */
export function parsearCsv(texto) {
  const limpio = texto.replace(/^\uFEFF/, "");
  const primera = limpio.slice(0, limpio.indexOf("\n") + 1 || undefined);
  const sep = [",", ";", "\t"].sort((a, b) => primera.split(b).length - primera.split(a).length)[0];
  const filas = [];
  let fila = [], campo = "", comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((x) => x.trim() !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some((x) => x.trim() !== "")) filas.push(fila);
  return filas;
}

function numero(valor, espanol) {
  let s = String(valor ?? "").replace(/[^\d.,-]/g, "");
  if (!s || s === "-") return 0;
  if (s.includes(".") && s.includes(",")) {
    // El último separador es el decimal.
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (espanol) {
    s = s.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  } else {
    s = s.replace(/,(?=\d{3}(\D|$))/g, "").replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function fechaIso(valor) {
  const s = String(valor || "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); // dd/mm/aaaa
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export class ErrorDatos extends Error {}

export function normalizarCsv(texto, meta = {}) {
  const filas = parsearCsv(texto);
  if (filas.length < 2) throw new ErrorDatos("El archivo está vacío.");
  const encabezados = filas[0].map(quitarTildes);
  const idx = {};
  for (const [campo, nombres] of Object.entries(COLUMNAS)) {
    // "resultados" no debe tomar "costo por resultados" ni "indicador de resultados".
    idx[campo] = encabezados.findIndex((h) => nombres.some((n) => h === n || h.startsWith(n + " (") || (campo !== "resultados" && campo !== "alcance" && h.startsWith(n))));
  }
  const espanol = encabezados.some((h) => h.startsWith("importe gastado") || h.startsWith("impresiones"));
  const moneda = (/\(([A-Z]{3})\)/.exec(filas[0][idx.gasto] || "") || [])[1] || meta.moneda || "PEN";

  let colFecha = idx.dia;
  if (colFecha < 0 && idx.inicio >= 0 && idx.fin >= 0) {
    const unDia = filas.slice(1).every((f) => !f[idx.inicio] || f[idx.inicio] === f[idx.fin]);
    if (unDia) colFecha = idx.inicio;
  }
  if (colFecha < 0) throw new ErrorDatos("No hay columna de día. En el Administrador de anuncios usa Desglose → Por tiempo → Día y vuelve a exportar.");
  if (idx.anuncio < 0 && idx.ad_id < 0) throw new ErrorDatos("No hay columna de anuncio. Exporta desde la pestaña Anuncios (no Campañas ni Conjuntos).");
  for (const campo of ["gasto", "impresiones", "clics"]) {
    if (idx[campo] < 0) throw new ErrorDatos(`Falta la columna "${COLUMNAS[campo][0]}".`);
  }
  if (idx.alcance < 0) throw new ErrorDatos('Falta la columna "Alcance".');

  const anuncios = new Map();
  const acumulado = new Map();
  let procesadas = 0;
  for (const f of filas.slice(1)) {
    const fecha = fechaIso(f[colFecha]);
    const nombre = (f[idx.anuncio] ?? "").trim();
    const id = (idx.ad_id >= 0 && f[idx.ad_id]?.trim()) || nombre;
    if (!fecha || !id) continue; // fila de totales o vacía
    if (!anuncios.has(id)) {
      anuncios.set(id, { id, nombre: nombre || id, campana: f[idx.campana]?.trim() || "", conjunto: f[idx.conjunto]?.trim() || "" });
    }
    procesadas++;
    const clave = `${id}|${fecha}`;
    const acc = acumulado.get(clave) || { fecha, ad_id: id, gasto: 0, impresiones: 0, alcance: 0, clics: 0, resultados: 0, valor: 0, vistas_3s: 0 };
    for (const campo of ["gasto", "impresiones", "alcance", "clics", "resultados", "valor", "vistas_3s"]) {
      if (idx[campo] >= 0) acc[campo] += numero(f[idx[campo]], espanol);
    }
    acumulado.set(clave, acc);
  }
  const diario = [...acumulado.values()];
  if (!diario.length) throw new ErrorDatos("No se encontraron filas con fecha y anuncio.");

  const fechas = [...new Set(diario.map((d) => d.fecha))].sort();
  const avisos = [];
  const dias = fechas.length;
  if (dias < 28) avisos.push(`Solo ${dias} días de datos: la comparación y la proyección pierden fuerza (ideal 60 a 90).`);
  if (idx.resultados < 0) avisos.push("No vino la columna de resultados: el rendimiento saldrá sin datos.");
  if (idx.vistas_3s < 0) avisos.push("No vinieron reproducciones de 3 segundos: el hook rate no se usa.");
  if (acumulado.size < procesadas) avisos.push("Había varias filas por día y anuncio (desgloses de edad o ubicación): se sumaron y el alcance puede quedar inflado.");

  return {
    datos: {
      meta: { ...meta, moneda, fuente: "csv", actualizado: new Date().toISOString() },
      anuncios: [...anuncios.values()],
      diario,
    },
    avisos,
    resumen: { anuncios: anuncios.size, filas: diario.length, desde: fechas[0], hasta: fechas[fechas.length - 1] },
  };
}
