/**
 * Motor del Predictor de Fatiga Creativa.
 *
 * Toda la lógica vive acá (umbrales, señales, predicción y matriz de decisión)
 * para que la página y cualquier resumen lean los mismos números.
 * Metodología: señales ponderadas que descuentan presupuesto y mercado,
 * pisos por caída desde el pico, causa (creativo o audiencia), proyección
 * lineal de días hasta la fatiga y una matriz etapa × rendimiento.
 *
 * Datos de entrada (esquema):
 *   { meta: { cuenta, moneda, metrica_rectora, objetivo, etiqueta_resultado, fuente },
 *     anuncios: [{ id, nombre, campana, conjunto, fecha_inicio, frecuencia_acumulada, formato, etapa }],
 *     diario:   [{ fecha, ad_id, gasto, impresiones, alcance, clics, resultados, valor, vistas_3s }] }
 */

export const CONFIG_BASE = {
  pesos: { desgaste: 24, ctr: 18, tendencia: 10, frecuencia: 16, alcance: 12, cpc: 12, hook: 8 },
  rampas: {
    desgaste: [0.10, 0.40],
    ctr: [0.05, 0.30],
    tendencia: [0.05, 0.30],
    frecuencia: [0.04, 0.22],
    alcance: [0.05, 0.30],
    cpc: [0.05, 0.30],
    hook: [0.05, 0.25],
  },
  cortes: { tempranas: 25, desarrollo: 45, fatigado: 65 },
  caidaCtrFatiga: 0.30, // umbral de fatiga = pico × (1 − esto)
  pisoFatigado: 0.45, // CTR 45% bajo el pico → fatigado
  pisoDesarrollo: 0.30, // CTR 30% bajo el pico → mínimo fatiga en desarrollo
  diasAlertaPrediccion: 10,
  horizonteDias: 60,
  ventanaPico: 7,
  minImprPico: 1500,
  diasExcluidosInicio: 2,
  ventanaTendencia: 21,
  minImprDiaTendencia: 200,
  minPuntosTendencia: 5,
  escalado: { umbral: 0.5, cpc: 0.7, alcance: 0.7, frecuencia: 0.8 },
  frecAcumuladaAlta: { prospeccion: 3, retargeting: 6 },
  margenLimite: 0.25,
  minDiasVida: 7,
  minImpresiones: 2000,
  minDiasEntrega: 4,
  minImprPrevio: 1000,
  minDiasSinPrevio: 14,
  direccion: { minCambio: 0.08, minR2: 0.15 },
  alertaAlcanceCuenta: 0.10,
};

export const ETAPAS = [
  { key: "sano", label: "Sano", color: "#10b981" },
  { key: "tempranas", label: "Señales tempranas", color: "#fdba74" },
  { key: "desarrollo", label: "Fatiga en desarrollo", color: "#f97316" },
  { key: "fatigado", label: "Fatigado", color: "#e11d48" },
  { key: "sin_datos", label: "Sin datos suficientes", color: "#94a3b8" },
];
export const ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.key, e]));

export const GRUPOS = ["Actuar ya", "Esta semana", "Bajo monitoreo", "Revisar (no es fatiga)", "Sanos", "Sin datos"];

// Acción y grupo del plan por etapa × rendimiento.
export const MATRIZ = {
  sano: {
    rinde: ["Mantener y considerar escalar", "Sanos"],
    limite: ["Mantener", "Sanos"],
    no_rinde: ["Revisar mensaje u oferta (no es fatiga)", "Revisar (no es fatiga)"],
    sin_datos: ["Mantener y medir rendimiento", "Sanos"],
  },
  tempranas: {
    rinde: ["Monitorear y preparar variantes", "Bajo monitoreo"],
    limite: ["Preparar reemplazo", "Esta semana"],
    no_rinde: ["Preparar reemplazo y bajarle prioridad", "Esta semana"],
    sin_datos: ["Preparar variantes y medir rendimiento", "Bajo monitoreo"],
  },
  desarrollo: {
    rinde: ["No apagar: monitoreo cada 48 h y variantes ya", "Bajo monitoreo"],
    limite: ["Lanzar reemplazo esta semana", "Esta semana"],
    no_rinde: ["Reemplazar ahora", "Actuar ya"],
    sin_datos: ["Preparar reemplazo; confirma el rendimiento antes de apagar", "Esta semana"],
  },
  fatigado: {
    rinde: ["No apagar todavía: lanzar relevo y rotar cuando pruebe", "Bajo monitoreo"],
    limite: ["Reemplazar ahora", "Actuar ya"],
    no_rinde: ["Apagar y reemplazar", "Actuar ya"],
    sin_datos: ["Lanzar reemplazo; confirma el rendimiento antes de apagar", "Esta semana"],
  },
};
const ACCION_AUDIENCIA = "Creativo sano, audiencia saturándose: amplía público antes de tocar el creativo";

export const SENALES = [
  { key: "desgaste", label: "Desgaste vs pico" },
  { key: "ctr", label: "CTR vs periodo anterior" },
  { key: "tendencia", label: "Tendencia del CTR" },
  { key: "frecuencia", label: "Frecuencia" },
  { key: "alcance", label: "Alcance por presupuesto" },
  { key: "cpc", label: "CPC sobre mercado" },
  { key: "hook", label: "Hook rate" },
];

/* ---------------- utilidades ---------------- */
const DIA = 86400000;
const toMs = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const sumarDias = (s, n) => new Date(toMs(s) + n * DIA).toISOString().slice(0, 10);
export const diasEntre = (a, b) => Math.round((toMs(b) - toMs(a)) / DIA);
export function* rangoFechas(desde, hasta) {
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) yield d;
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const rampa = (x, [a, b]) => (x == null || Number.isNaN(x) ? null : clamp01((x - a) / (b - a)));
export const delta = (a, b) => (a != null && b != null && b !== 0 ? a / b - 1 : null);
const div = (a, b) => (b > 0 ? a / b : null);

const CAMPOS = ["gasto", "impresiones", "alcance", "clics", "resultados", "valor", "vistas_3s"];
const vacio = () => ({ gasto: 0, impresiones: 0, alcance: 0, clics: 0, resultados: 0, valor: 0, vistas_3s: 0, dias: 0 });

export function metricas(t) {
  return {
    ...t,
    ctr: div(t.clics, t.impresiones),
    cpc: div(t.gasto, t.clics),
    cpm: t.impresiones > 0 ? (t.gasto / t.impresiones) * 1000 : null,
    frecuencia: div(t.impresiones, t.alcance),
    cpr: div(t.gasto, t.resultados),
    roas: div(t.valor, t.gasto),
    hook: t.vistas_3s > 0 ? div(t.vistas_3s, t.impresiones) : null,
  };
}

/** Recta de mínimos cuadrados sobre [{x, y}]. */
export function regresion(puntos) {
  const n = puntos.length;
  if (n < 2) return null;
  let sx = 0, sy = 0;
  for (const p of puntos) { sx += p.x; sy += p.y; }
  const mx = sx / n, my = sy / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of puntos) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
    syy += (p.y - my) ** 2;
  }
  if (!sxx) return null;
  const pendiente = sxy / sxx;
  return { n, pendiente, intercepto: my - pendiente * mx, r2: syy ? (sxy * sxy) / (sxx * syy) : 0, media: my };
}

/* ---------------- preparación ---------------- */
const RMK = /rmk|remarketing|retargeting|visitantes|carrito/i;

export function preparar(datos) {
  const filas = new Map(); // ad_id -> Map(fecha -> fila)
  const fechas = new Set();
  for (const f of datos.diario || []) {
    if (!f?.ad_id || !f.fecha) continue;
    const id = String(f.ad_id);
    if (!filas.has(id)) filas.set(id, new Map());
    const porDia = filas.get(id);
    const acc = porDia.get(f.fecha) || { fecha: f.fecha, ...Object.fromEntries(CAMPOS.map((k) => [k, 0])) };
    for (const k of CAMPOS) acc[k] += Number(f[k]) || 0;
    porDia.set(f.fecha, acc);
    fechas.add(f.fecha);
  }
  const orden = [...fechas].sort();
  const metaAnuncios = new Map((datos.anuncios || []).map((a) => [String(a.id), a]));
  const anuncios = [...filas.keys()].map((id) => {
    const m = metaAnuncios.get(id) || {};
    const conEntrega = [...filas.get(id).values()].filter((f) => f.impresiones > 0).map((f) => f.fecha).sort();
    const etapa = m.etapa || (RMK.test(`${m.campana || ""} ${m.conjunto || ""}`) ? "retargeting" : "prospeccion");
    const tieneVideo = [...filas.get(id).values()].some((f) => f.vistas_3s > 0);
    return {
      id,
      nombre: m.nombre || id,
      campana: m.campana || "",
      conjunto: m.conjunto || "",
      inicio: m.fecha_inicio || conEntrega[0] || orden[0],
      frecuencia_acumulada: m.frecuencia_acumulada ?? null,
      formato: m.formato || (tieneVideo ? "video" : "imagen"),
      etapa,
    };
  });
  return {
    meta: datos.meta || {},
    anuncios,
    filas,
    rango: { desde: orden[0], hasta: orden[orden.length - 1] },
    campanas: [...new Set(anuncios.map((a) => a.campana).filter(Boolean))].sort(),
  };
}

export function periodos(prep, { dias = 14, desde, hasta } = {}) {
  const fin = hasta || prep.rango.hasta;
  const ini = desde || sumarDias(fin, -(dias - 1));
  const len = diasEntre(ini, fin) + 1;
  return {
    actual: { desde: ini, hasta: fin, dias: len },
    previo: { desde: sumarDias(ini, -len), hasta: sumarDias(ini, -1), dias: len },
  };
}

function sumarRango(porDia, desde, hasta) {
  const t = vacio();
  if (!porDia) return t;
  for (const [fecha, f] of porDia) {
    if (fecha < desde || fecha > hasta) continue;
    for (const k of CAMPOS) t[k] += f[k];
    if (f.impresiones > 0) t.dias++;
  }
  return t;
}

/** Serie diaria sumada de un conjunto de anuncios. */
export function serieDiaria(prep, ids, desde, hasta) {
  return [...rangoFechas(desde, hasta)].map((fecha) => {
    const t = vacio();
    for (const id of ids) {
      const f = prep.filas.get(id)?.get(fecha);
      if (!f) continue;
      for (const k of CAMPOS) t[k] += f[k];
      if (f.impresiones > 0) t.dias++;
    }
    return { fecha, ...metricas(t) };
  });
}

/** Subiendo / bajando / estable dentro del periodo. */
export function direccion(valores, cfg = CONFIG_BASE) {
  const pts = valores.map((y, x) => ({ x, y })).filter((p) => p.y != null && Number.isFinite(p.y));
  const r = regresion(pts);
  if (!r) return "estable";
  const x0 = pts[0].x, x1 = pts[pts.length - 1].x;
  const y0 = r.intercepto + r.pendiente * x0, y1 = r.intercepto + r.pendiente * x1;
  const cambio = y0 ? (y1 - y0) / Math.abs(y0) : 0;
  if (Math.abs(cambio) < cfg.direccion.minCambio || r.r2 < cfg.direccion.minR2) return "estable";
  return cambio > 0 ? "subiendo" : "bajando";
}

/* ---------------- CTR: pico, suavizado, predicción ---------------- */
function picoSostenido(porDia, inicio, hasta, cfg) {
  const desdeValido = sumarDias(inicio, cfg.diasExcluidosInicio);
  let mejor = null;
  for (let fin = sumarDias(desdeValido, cfg.ventanaPico - 1); fin <= hasta; fin = sumarDias(fin, 1)) {
    const ini = sumarDias(fin, -(cfg.ventanaPico - 1));
    const t = sumarRango(porDia, ini, fin);
    if (t.impresiones < cfg.minImprPico) continue;
    const ctr = t.clics / t.impresiones;
    if (!mejor || ctr > mejor.ctr) mejor = { ctr, desde: ini, hasta: fin };
  }
  return mejor;
}

/** CTR suavizado a 3 días en los días con entrega mínima, como puntos {x, y, fecha}. */
function ctrSuavizado(porDia, desde, hasta, cfg) {
  const pts = [];
  for (const fecha of rangoFechas(desde, hasta)) {
    const f = porDia.get(fecha);
    if (!f || f.impresiones < cfg.minImprDiaTendencia) continue;
    const t = sumarRango(porDia, sumarDias(fecha, -2), fecha);
    pts.push({ x: diasEntre(desde, fecha), y: t.clics / t.impresiones, fecha });
  }
  return pts;
}

function prediccion(porDia, pico, ctrActual, hasta, cfg) {
  if (!pico || ctrActual == null) return { estado: "sin_pico" };
  const umbral = pico.ctr * (1 - cfg.caidaCtrFatiga);
  const desde = sumarDias(hasta, -(cfg.ventanaTendencia - 1));
  const pts = ctrSuavizado(porDia, desde, hasta, cfg);
  const r = pts.length >= cfg.minPuntosTendencia ? regresion(pts) : null;
  const confianza = !r ? null : r.r2 >= 0.5 ? "alta" : r.r2 >= 0.25 ? "media" : "baja";
  const base = { umbral, pendiente: r?.pendiente ?? null, r2: r?.r2 ?? null, confianza, puntos: pts, recta: r, desde };
  if (ctrActual <= umbral) return { ...base, estado: "cruzo", dias: 0 };
  if (!r) return { ...base, estado: "sin_tendencia" };
  if (r.pendiente >= 0) return { ...base, estado: "estable" };
  const dias = (ctrActual - umbral) / Math.abs(r.pendiente);
  return { ...base, estado: dias > cfg.horizonteDias ? "lejano" : "proyectado", dias: Math.max(1, Math.ceil(dias)) };
}

/* ---------------- rendimiento ---------------- */
function rendimiento(m, obj, cfg) {
  const { metrica, objetivo } = obj;
  if (!objetivo) return { estado: "sin_datos", ratio: null };
  if (metrica === "roas") {
    if (!m.valor) {
      const cpaRef = obj.cpaCuenta;
      return { estado: cpaRef && m.gasto >= 2 * cpaRef ? "no_rinde" : "sin_datos", ratio: m.gasto > 0 ? 0 : null };
    }
    const ratio = m.roas / objetivo;
    return { estado: ratio >= 1 ? "rinde" : ratio >= 1 - cfg.margenLimite ? "limite" : "no_rinde", ratio, valor: m.roas };
  }
  if (!m.resultados) {
    return { estado: m.gasto >= 2 * objetivo ? "no_rinde" : "sin_datos", ratio: m.gasto >= 2 * objetivo ? 0 : null };
  }
  const ratio = objetivo / m.cpr;
  return { estado: ratio >= 1 ? "rinde" : ratio >= 1 / (1 + cfg.margenLimite) ? "limite" : "no_rinde", ratio, valor: m.cpr };
}

export const REND_LABEL = { rinde: "Rinde", limite: "En el límite", no_rinde: "No rinde", sin_datos: "Sin datos" };

const etapaDeIndice = (i, c) => (i >= c.fatigado ? "fatigado" : i >= c.desarrollo ? "desarrollo" : i >= c.tempranas ? "tempranas" : "sano");

/* ---------------- evaluación por anuncio ---------------- */
export function evaluarAnuncio(prep, ad, per, ctx, cfg = CONFIG_BASE) {
  const porDia = prep.filas.get(ad.id);
  const { actual: pa, previo: pp } = per;
  const actual = metricas(sumarRango(porDia, pa.desde, pa.hasta));
  const previo = metricas(sumarRango(porDia, pp.desde, pp.hasta));
  const ult7 = metricas(sumarRango(porDia, sumarDias(pa.hasta, -6), pa.hasta));
  const vida = diasEntre(ad.inicio, pa.hasta) + 1;
  const pico = picoSostenido(porDia, ad.inicio, pa.hasta, cfg);
  const pred = prediccion(porDia, pico, ult7.ctr, pa.hasta, cfg);
  const caidaPico = pico && ult7.ctr != null ? 1 - ult7.ctr / pico.ctr : null;
  const rend = rendimiento(actual, ctx, cfg);
  const base = { ...ad, actual, previo, ult7, vida, pico, pred, caidaPico, rend, avisos: [] };

  // Muestra mínima
  const fmt = (n) => Math.round(n).toLocaleString("es-PE");
  const conPrevio = previo.impresiones >= cfg.minImprPrevio;
  let motivo = null;
  if (actual.impresiones === 0) motivo = "Sin entrega en el periodo";
  else if (vida < cfg.minDiasVida) motivo = `Solo ${vida} días de vida (mínimo ${cfg.minDiasVida})`;
  else if (actual.impresiones < cfg.minImpresiones) motivo = `${fmt(actual.impresiones)} impresiones en el periodo (mínimo ${fmt(cfg.minImpresiones)})`;
  else if (actual.dias < cfg.minDiasEntrega) motivo = `${actual.dias} días con entrega (mínimo ${cfg.minDiasEntrega})`;
  else if (!conPrevio && !(actual.dias >= cfg.minDiasSinPrevio && pico)) {
    motivo = "Sin periodo anterior comparable ni historia suficiente para calcular su pico";
  }
  if (motivo) {
    return { ...base, senales: {}, aportes: {}, indice: null, etapa: "sin_datos", causa: null, motivo, accion: motivo, grupo: "Sin datos" };
  }
  if (!conPrevio) base.avisos.push("Sin periodo anterior comparable: se juzga solo contra su pico y su tendencia.");

  // Señales
  const s = {};
  if (caidaPico != null) s.desgaste = rampa(caidaPico, cfg.rampas.desgaste);

  const tend = regresion(ctrSuavizado(porDia, pa.desde, pa.hasta, cfg));
  if (tend && tend.n >= cfg.minPuntosTendencia && tend.media > 0) {
    const cambio = (tend.pendiente * (pa.dias - 1)) / tend.media;
    s.tendencia = rampa(-cambio, cfg.rampas.tendencia) * tend.r2;
  }

  let dInv = null;
  if (conPrevio) {
    const dCpm = ctx.deltaCpmCuenta ?? 0;
    dInv = delta(actual.gasto, previo.gasto);
    const dCtr = delta(actual.ctr, previo.ctr);
    if (dCtr != null) s.ctr = rampa(-dCtr, cfg.rampas.ctr);
    const dFreq = delta(actual.frecuencia, previo.frecuencia);
    if (dFreq != null) s.frecuencia = rampa(dFreq, cfg.rampas.frecuencia);
    const dAlc = delta(actual.alcance, previo.alcance);
    if (dAlc != null && dInv != null) {
      const ajustado = ((1 + dAlc) / (1 + dInv)) * (1 + dCpm) - 1;
      s.alcance = rampa(-ajustado, cfg.rampas.alcance);
    }
    const dCpc = delta(actual.cpc, previo.cpc);
    if (dCpc != null) s.cpc = rampa((1 + dCpc) / (1 + dCpm) - 1, cfg.rampas.cpc);
    const dHook = delta(actual.hook, previo.hook);
    if (dHook != null) s.hook = rampa(-dHook, cfg.rampas.hook);

    if (dInv != null && dInv >= cfg.escalado.umbral) {
      for (const k of ["cpc", "alcance", "frecuencia"]) if (s[k] != null) s[k] *= cfg.escalado[k];
      base.avisos.push(`La inversión subió ${Math.round(dInv * 100)}%: CPC, alcance y frecuencia se leen con descuento por escalado.`);
    }
  }
  const limFrec = cfg.frecAcumuladaAlta[ad.etapa] ?? cfg.frecAcumuladaAlta.prospeccion;
  if (ad.frecuencia_acumulada != null && ad.frecuencia_acumulada > limFrec) {
    s.frecuencia = Math.max(s.frecuencia ?? 0, 0.5);
    base.avisos.push(`Frecuencia acumulada ${ad.frecuencia_acumulada.toFixed(1)} (alta para ${ad.etapa}).`);
  }

  // Índice
  let num = 0, den = 0;
  for (const [k, v] of Object.entries(s)) {
    if (v == null) { delete s[k]; continue; }
    num += cfg.pesos[k] * v;
    den += cfg.pesos[k];
  }
  let indice = den ? (100 * num) / den : 0;
  const aportes = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, den ? (100 * cfg.pesos[k] * v) / den : 0]));

  // Pisos
  const c = cfg.cortes;
  if (caidaPico != null && caidaPico >= cfg.pisoFatigado) indice = Math.max(indice, c.fatigado);
  else if (caidaPico != null && caidaPico >= cfg.pisoDesarrollo) indice = Math.max(indice, c.desarrollo);
  if (pred.estado === "proyectado" && pred.dias <= cfg.diasAlertaPrediccion && ["alta", "media"].includes(pred.confianza)) {
    indice = Math.max(indice, c.tempranas);
  }

  // Causa probable
  const respuestaCae = (s.desgaste ?? 0) >= 0.3 || (s.ctr ?? 0) >= 0.2 || (s.hook ?? 0) >= 0.2 || (s.tendencia ?? 0) >= 0.4;
  const presionAudiencia = (s.frecuencia ?? 0) >= 0.5 || (s.alcance ?? 0) >= 0.5;
  let causa = respuestaCae ? "creativo" : null;
  if (presionAudiencia && !respuestaCae) {
    causa = "audiencia";
    indice = Math.min(indice, c.desarrollo - 1);
  }

  indice = Math.round(indice);
  const etapa = etapaDeIndice(indice, c);
  let [accion, grupo] = MATRIZ[etapa][rend.estado];
  if (causa === "audiencia") [accion, grupo] = [ACCION_AUDIENCIA, "Revisar (no es fatiga)"];

  return { ...base, senales: s, aportes, indice, etapa, causa, accion, grupo, dInv };
}

/* ---------------- evaluación de la cuenta ---------------- */
export const METRICAS_CUENTA = [
  { key: "gasto", label: "Inversión", tipo: "moneda", mejor: null },
  { key: "alcance", label: "Alcance (diario sumado)", tipo: "entero", mejor: "sube" },
  { key: "impresiones", label: "Impresiones", tipo: "entero", mejor: "sube" },
  { key: "frecuencia", label: "Frecuencia", tipo: "decimal", mejor: "baja" },
  { key: "ctr", label: "CTR (enlace)", tipo: "pct", mejor: "sube" },
  { key: "cpc", label: "CPC", tipo: "moneda", mejor: "baja" },
  { key: "cpm", label: "CPM", tipo: "moneda", mejor: "baja" },
  { key: "cpr", label: "Costo por resultado", tipo: "moneda", mejor: "baja" },
  { key: "roas", label: "ROAS", tipo: "decimal", mejor: "sube" },
  { key: "resultados", label: "Resultados", tipo: "entero", mejor: "sube" },
];

export function evaluarCuenta(prep, opciones = {}, cfg = CONFIG_BASE) {
  const per = periodos(prep, opciones);
  const todos = prep.anuncios.map((a) => a.id);
  const ids = opciones.campana ? prep.anuncios.filter((a) => a.campana === opciones.campana).map((a) => a.id) : todos;

  // Mercado: CPM de toda la cuenta, sin filtros.
  const totalCuenta = (p) => {
    const t = vacio();
    for (const id of todos) {
      const r = sumarRango(prep.filas.get(id), p.desde, p.hasta);
      for (const k of CAMPOS) t[k] += r[k];
    }
    return metricas(t);
  };
  const deltaCpmCuenta = delta(totalCuenta(per.actual).cpm, totalCuenta(per.previo).cpm);

  const serieActual = serieDiaria(prep, ids, per.actual.desde, per.actual.hasta);
  const seriePrevia = serieDiaria(prep, ids, per.previo.desde, per.previo.hasta);
  const sumaSerie = (serie) => {
    const t = vacio();
    for (const d of serie) { for (const k of CAMPOS) t[k] += d[k]; if (d.impresiones > 0) t.dias++; }
    return metricas(t);
  };
  const actual = sumaSerie(serieActual);
  const previo = sumaSerie(seriePrevia);

  const metrica = opciones.metrica || prep.meta.metrica_rectora || "cpa";
  const objetivoDeclarado = Number(opciones.objetivo ?? prep.meta.objetivo) || null;
  const promedio = metrica === "roas" ? actual.roas : actual.cpr;
  const ctx = {
    metrica,
    objetivo: objetivoDeclarado || promedio,
    objetivoEsPromedio: !objetivoDeclarado,
    cpaCuenta: actual.cpr,
    deltaCpmCuenta,
  };

  const anuncios = prep.anuncios
    .filter((a) => ids.includes(a.id))
    .map((a) => evaluarAnuncio(prep, a, per, ctx, cfg))
    .filter((a) => a.actual.impresiones > 0 || a.previo.impresiones > 0);

  // ¿El alcance sigue al presupuesto?
  const dAlc = delta(actual.alcance, previo.alcance);
  const dInv = delta(actual.gasto, previo.gasto);
  let alcance = { estado: "sin_datos", texto: "Sin periodo anterior para comparar." };
  if (dAlc != null && dInv != null) {
    const ajustado = ((1 + dAlc) / (1 + dInv)) * (1 + (deltaCpmCuenta ?? 0)) - 1;
    alcance = ajustado <= -cfg.alertaAlcanceCuenta
      ? { estado: "alerta", ajustado, texto: `El alcance cae ${Math.round(-ajustado * 100)}% más de lo que explican el presupuesto y el mercado: saturación o desgaste.` }
      : { estado: "ok", ajustado, texto: ajustado >= cfg.alertaAlcanceCuenta
          ? `El alcance crece ${Math.round(ajustado * 100)}% por encima de lo que explica el presupuesto.`
          : "El alcance sigue al presupuesto una vez descontado el mercado." };
    alcance.dAlc = dAlc; alcance.dInv = dInv;
  }

  const grupos = Object.fromEntries(GRUPOS.map((g) => [g, []]));
  for (const a of anuncios) grupos[a.grupo].push(a);
  for (const g of GRUPOS) grupos[g].sort((x, y) => (y.indice ?? -1) - (x.indice ?? -1) || y.actual.gasto - x.actual.gasto);

  const termometro = ETAPAS.map((e) => {
    const lista = anuncios.filter((a) => a.etapa === e.key);
    return { ...e, anuncios: lista.length, gasto: lista.reduce((s, a) => s + a.actual.gasto, 0) };
  });

  const reemplazos = grupos["Actuar ya"].length + grupos["Esta semana"].length;
  const variantes = grupos["Bajo monitoreo"].length + grupos["Sanos"].filter((a) => a.rend.estado === "rinde").length;

  const direcciones = Object.fromEntries(METRICAS_CUENTA.map((m) => [m.key, direccion(serieActual.map((d) => d[m.key]), cfg)]));

  return {
    per, ctx, deltaCpmCuenta, actual, previo, serieActual, seriePrevia, direcciones,
    alcance, anuncios, grupos, termometro,
    demanda: { reemplazos, variantes, total: reemplazos + variantes },
  };
}
