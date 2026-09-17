/* Motor del Predictor de fatiga (skill predictor-de-fatiga) */
/*
 * Motor de fatiga creativa — Predictor de Fatiga · Esnidier Ruiz
 * Una sola fuente de verdad para la lógica: lo usa el dashboard (navegador)
 * y el resumen en texto (Node). Si cambias un umbral aquí, cambia en ambos.
 */
// Envoltorio UMD del prototipo reemplazado por un módulo ES; la lógica no cambia.
const MotorFatiga = (function () {
  'use strict';

  // ───────────────────────── Configuración ─────────────────────────
  const CONFIG_BASE = {
    minDiasVida: 7,            // antes de 7 días de vida solo se observa
    minImpresiones: 2000,      // impresiones mínimas en el periodo actual
    minImpresionesPrevio: 1000,// impresiones mínimas en el periodo previo
    minDiasEntrega: 4,
    minImpDiaTendencia: 200,   // un día cuenta para la tendencia si tuvo al menos esto
    // desgaste = CTR actual contra su propio pico; ctr = contra el periodo anterior
    pesos: { desgaste: 0.24, ctr: 0.18, tendencia: 0.10, frecuencia: 0.16, alcance: 0.12, cpc: 0.12, hook: 0.08 },
    // [variación donde la señal empieza a sumar, variación donde llega al máximo]
    rampas: {
      desgaste: [0.10, 0.40], ctr: [0.05, 0.30], tendencia: [0.05, 0.30], frecuencia: [0.04, 0.22],
      alcance: [0.05, 0.30], cpc: [0.05, 0.30], hook: [0.05, 0.25]
    },
    cortes: { fatigado: 65, desarrollo: 45, temprana: 25 },
    caidaCtrFatiga: 0.30,      // fatiga = CTR 30% por debajo de su pico sostenido
    caidaCtrSevera: 0.45,      // 45% bajo el pico = fatigado aunque el resto se vea bien
    margenLimite: 0.25,        // hasta 25% peor que el objetivo = "en el límite"
    escaladoFuerte: 0.50,      // +50% de inversión = efecto escalado
    recortePresupuesto: -0.25, // -25% de inversión = recorte relevante
    subastaCara: 0.15,         // CPM de toda la cuenta +15% = mercado más caro
    frecAcumuladaAlta: { prospeccion: 3, retargeting: 6 }
  };

  const ETAPAS = {
    fatigado:   { nombre: 'Fatigado', orden: 4 },
    desarrollo: { nombre: 'Fatiga en desarrollo', orden: 3 },
    temprana:   { nombre: 'Señales tempranas', orden: 2 },
    sano:       { nombre: 'Sano', orden: 1 },
    sin_datos:  { nombre: 'Sin datos suficientes', orden: 0 }
  };

  const RENDIMIENTO = {
    rinde: 'Rinde', limite: 'En el límite', no_rinde: 'No rinde', sin_datos: 'Sin datos'
  };

  // Matriz de decisión: etapa × rendimiento → acción.
  // Regla madre: un anuncio que rinde NO se apaga. Se monitorea y se le prepara relevo.
  const MATRIZ = {
    sano: {
      rinde:     { id: 'escalar',   grupo: 'sanos',      texto: 'Mantener y considerar escalar' },
      limite:    { id: 'mantener',  grupo: 'sanos',      texto: 'Mantener' },
      no_rinde:  { id: 'revisar',   grupo: 'revisar',    texto: 'Revisar mensaje u oferta (no es fatiga)' },
      sin_datos: { id: 'mantener',  grupo: 'sanos',      texto: 'Mantener' }
    },
    temprana: {
      rinde:     { id: 'monitorear', grupo: 'monitoreo', texto: 'Monitorear y preparar variantes' },
      limite:    { id: 'preparar',   grupo: 'semana',    texto: 'Preparar reemplazo' },
      no_rinde:  { id: 'preparar',   grupo: 'semana',    texto: 'Preparar reemplazo y bajarle prioridad' },
      sin_datos: { id: 'monitorear', grupo: 'monitoreo', texto: 'Monitorear' }
    },
    desarrollo: {
      rinde:     { id: 'monitorear', grupo: 'monitoreo', texto: 'No apagar: monitoreo cada 48 h y variantes ya' },
      limite:    { id: 'lanzar',     grupo: 'semana',    texto: 'Lanzar reemplazo esta semana' },
      no_rinde:  { id: 'reemplazar', grupo: 'ya',        texto: 'Reemplazar ahora' },
      sin_datos: { id: 'lanzar',     grupo: 'semana',    texto: 'Lanzar reemplazo esta semana' }
    },
    fatigado: {
      rinde:     { id: 'rotar',      grupo: 'monitoreo', texto: 'No apagar todavía: lanzar relevo y rotar cuando pruebe' },
      limite:    { id: 'reemplazar', grupo: 'ya',        texto: 'Reemplazar ahora' },
      no_rinde:  { id: 'apagar',     grupo: 'ya',        texto: 'Apagar y reemplazar' },
      sin_datos: { id: 'reemplazar', grupo: 'ya',        texto: 'Reemplazar ahora' }
    },
    sin_datos: {
      rinde:     { id: 'esperar', grupo: 'esperar', texto: 'Esperar más datos' },
      limite:    { id: 'esperar', grupo: 'esperar', texto: 'Esperar más datos' },
      no_rinde:  { id: 'esperar', grupo: 'esperar', texto: 'Esperar más datos' },
      sin_datos: { id: 'esperar', grupo: 'esperar', texto: 'Esperar más datos' }
    }
  };

  // ───────────────────────── Utilidades ─────────────────────────
  const DIA = 86400000;
  const aNum = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DIA;
  const aFecha = (n) => new Date(n * DIA).toISOString().slice(0, 10);
  const div = (a, b) => (b > 0 && isFinite(a)) ? a / b : null;
  const pct = (a, b) => (a == null || b == null || b === 0) ? null : a / b - 1;
  const ramp = (x, r) => x == null ? null : Math.max(0, Math.min(1, (x - r[0]) / (r[1] - r[0])));
  const fmtPct = (x) => x == null ? '—' : (x > 0 ? '+' : '') + Math.round(x * 100) + '%';
  const fmtAbs = (x) => x == null ? '—' : Math.abs(Math.round(x * 100)) + '%';
  const verbo = (x, sube, baja) => (x || 0) >= 0 ? sube : baja;

  function vacio() {
    return { gasto: 0, imp: 0, alcance: 0, clics: 0, res: 0, valor: 0, v3s: 0, impV3s: 0, dias: 0 };
  }
  function sumar(acc, r) {
    acc.gasto += r.gasto || 0;
    acc.imp += r.impresiones || 0;
    acc.alcance += r.alcance || 0;
    acc.clics += r.clics || 0;
    acc.res += r.resultados || 0;
    acc.valor += r.valor || 0;
    if (r.vistas_3s != null) { acc.v3s += r.vistas_3s; acc.impV3s += r.impresiones || 0; }
    if ((r.impresiones || 0) > 0) acc.dias++;
    return acc;
  }
  function metricas(a) {
    return {
      gasto: a.gasto, impresiones: a.imp, alcance: a.alcance, clics: a.clics,
      resultados: a.res, valor: a.valor, dias: a.dias,
      ctr: div(a.clics, a.imp),
      cpc: div(a.gasto, a.clics),
      cpm: a.imp > 0 ? a.gasto / a.imp * 1000 : null,
      frecuencia: div(a.imp, a.alcance),          // proxy: impresiones / alcance diario sumado
      hook: a.impV3s > 0 ? a.v3s / a.impV3s : null,
      cpa: div(a.gasto, a.res),
      roas: div(a.valor, a.gasto),
      alcancePorGasto: div(a.alcance, a.gasto)
    };
  }

  function ols(pts) {
    const n = pts.length;
    if (n < 2) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    for (const p of pts) { sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y; syy += p.y * p.y; }
    const den = n * sxx - sx * sx;
    if (den === 0) return null;
    const m = (n * sxy - sx * sy) / den;
    const b = (sy - m * sx) / n;
    const vy = n * syy - sy * sy;
    const r2 = vy > 0 ? Math.pow(n * sxy - sx * sy, 2) / (den * vy) : 0;
    return { m, b, r2 };
  }

  // CTR suavizado: media móvil de 3 días ponderada por impresiones
  function ctrSuavizado(rows, minImp) {
    const pts = [];
    for (let i = 0; i < rows.length; i++) {
      let c = 0, im = 0;
      for (let j = Math.max(0, i - 2); j <= i; j++) { c += rows[j].clics || 0; im += rows[j].impresiones || 0; }
      if ((rows[i].impresiones || 0) >= minImp && im > 0) pts.push({ x: rows[i]._d, y: c / im });
    }
    return pts;
  }

  function inferirEtapa(a) {
    const t = [a.campana, a.conjunto, a.nombre].filter(Boolean).join(' ');
    if (/(lookalike|\blal\b|similar|broad|abierto|amplio)/i.test(a.conjunto || '')) return 'prospeccion';
    return /(rmk|remarketing|retarget|\brt\b|\bbof\b|caliente|carrito|visitantes|abandono|interactu|engag|clientes actuales)/i.test(t)
      ? 'retargeting' : 'prospeccion';
  }

  // ───────────────────────── Preparación (se cachea) ─────────────────────────
  function preparar(datos) {
    const porAnuncio = new Map();
    let minD = Infinity, maxD = -Infinity;
    for (const r of datos.diario) {
      const d = aNum(r.fecha);
      r._d = d;
      if (d < minD) minD = d;
      if (d > maxD) maxD = d;
      if (!porAnuncio.has(r.ad_id)) porAnuncio.set(r.ad_id, []);
      porAnuncio.get(r.ad_id).push(r);
    }
    for (const arr of porAnuncio.values()) arr.sort((a, b) => a._d - b._d);

    const info = new Map((datos.anuncios || []).map((a) => [a.id, Object.assign({}, a)]));
    for (const id of porAnuncio.keys()) if (!info.has(id)) info.set(id, { id, nombre: id });

    for (const [id, arr] of porAnuncio) {
      const a = info.get(id);
      const primera = arr.find((r) => (r.impresiones || 0) > 0);
      const dPrimera = primera ? primera._d : null;
      a._primera = a.fecha_inicio ? Math.min(aNum(a.fecha_inicio), dPrimera ?? Infinity) : dPrimera;
      if (!a.formato) a.formato = arr.some((r) => (r.vistas_3s || 0) > 0) ? 'video' : 'imagen';
      if (!a.etapa) a.etapa = inferirEtapa(a);
      if (!a.nombre) a.nombre = id;
    }
    const campanas = [...new Set([...info.values()].map((a) => a.campana).filter(Boolean))].sort();
    return { porAnuncio, info, minD, maxD, campanas };
  }

  // ───────────────────────── Tendencias ─────────────────────────
  function tendenciaVentana(diarios, L, cfg) {
    const pts = ctrSuavizado(diarios, cfg.minImpDiaTendencia);
    if (pts.length < 5) return null;
    const f = ols(pts);
    if (!f) return null;
    const media = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    if (!media) return null;
    return { m: f.m, r2: f.r2, cambioRel: f.m * (L - 1) / media };
  }

  // Predicción: ¿en cuántos días el CTR cruza el umbral de fatiga (30% bajo su pico)?
  function prediccion(rows, hasta, cfg) {
    const hist = rows.filter((r) => r._d <= hasta && (r.impresiones || 0) > 0);
    if (hist.length < 7) return null;

    // pico sostenido: mejor CTR de 7 días calendario con muestra decente
    let pico = null;
    for (let i = 0; i < hist.length; i++) {
      let c = 0, im = 0;
      for (let j = i; j >= 0 && hist[j]._d > hist[i]._d - 7; j--) { c += hist[j].clics || 0; im += hist[j].impresiones || 0; }
      if (im >= 1500 && hist[i]._d - hist[0]._d >= 2) { const v = c / im; if (pico == null || v > pico) pico = v; }
    }
    // CTR actual: últimos 7 días
    let c7 = 0, i7 = 0;
    for (const r of hist) if (r._d > hasta - 7) { c7 += r.clics || 0; i7 += r.impresiones || 0; }
    const actual = i7 > 0 ? c7 / i7 : null;
    if (pico == null || actual == null) return null;
    const umbral = pico * (1 - cfg.caidaCtrFatiga);

    const recientes = hist.filter((r) => r._d > hasta - 21);
    const pts = ctrSuavizado(recientes, cfg.minImpDiaTendencia);
    const f = pts.length >= 5 ? ols(pts) : null;
    const base = { pico, umbral, actual, caidaDesdePico: actual / pico - 1, puntos: pts };

    if (actual <= umbral) return Object.assign(base, { estado: 'cruzado', dias: 0, confianza: f ? nivel(f.r2) : 'baja', ajuste: f });
    if (!f) return Object.assign(base, { estado: 'sin_tendencia', dias: null, confianza: 'baja', ajuste: null });
    if (f.m >= 0) return Object.assign(base, { estado: 'estable', dias: null, confianza: nivel(f.r2), ajuste: f });
    const dias = Math.max(1, Math.round((actual - umbral) / -f.m));
    return Object.assign(base, { estado: dias > 60 ? 'lejano' : 'proyectado', dias, confianza: nivel(f.r2), ajuste: f });
  }
  const nivel = (r2) => r2 >= 0.5 ? 'alta' : r2 >= 0.25 ? 'media' : 'baja';

  // ───────────────────────── Rendimiento ─────────────────────────
  function rendimiento(m, meta, ref) {
    const tipo = meta.metrica_rectora === 'roas' ? 'roas' : 'cpa';
    const obj = Number(meta.objetivo) > 0 ? Number(meta.objetivo) : ref[tipo];
    if (!obj) return { estado: 'sin_datos', ratio: null, tipo };
    if (tipo === 'roas') {
      if (!m.roas) return { estado: m.gasto >= ref.gastoMedio ? 'no_rinde' : 'sin_datos', ratio: m.gasto >= ref.gastoMedio ? 0 : null, tipo };
      const ratio = m.roas / obj; // >1 cumple
      return { estado: ratio >= 1 ? 'rinde' : ratio >= 1 / (1 + ref.margen) ? 'limite' : 'no_rinde', ratio, tipo };
    }
    if (!m.resultados) {
      const malo = m.gasto >= 2 * obj;
      return { estado: malo ? 'no_rinde' : 'sin_datos', ratio: malo ? 0 : null, tipo };
    }
    const ratio = obj / m.cpa; // >1 cumple
    return { estado: ratio >= 1 ? 'rinde' : ratio >= 1 / (1 + ref.margen) ? 'limite' : 'no_rinde', ratio, tipo };
  }

  // ───────────────────────── Análisis de un anuncio ─────────────────────────
  function evaluarAnuncio(a, rows, ctx) {
    const { cfg, desde, hasta, pDesde, L } = ctx;
    const A = vacio(), P = vacio(), diariosA = [];
    for (const r of rows) {
      if (r._d > hasta) break;
      if (r._d >= desde) { sumar(A, r); diariosA.push(r); }
      else if (r._d >= pDesde) sumar(P, r);
    }
    if (A.imp === 0) return null;

    const ma = metricas(A), mp = metricas(P);
    const diasVida = a._primera != null ? hasta - a._primera + 1 : null;
    const d = {
      ctr: pct(ma.ctr, mp.ctr), cpc: pct(ma.cpc, mp.cpc), cpm: pct(ma.cpm, mp.cpm),
      frecuencia: pct(ma.frecuencia, mp.frecuencia), alcance: pct(ma.alcance, mp.alcance),
      gasto: pct(ma.gasto, mp.gasto), hook: pct(ma.hook, mp.hook), cpa: pct(ma.cpa, mp.cpa),
      roas: pct(ma.roas, mp.roas), resultados: pct(ma.resultados, mp.resultados)
    };
    const mercado = ctx.dCpmCuenta ?? 0;

    // Alcance normalizado por presupuesto y por mercado:
    // si el presupuesto baja 30% y el alcance baja 30%, esto da 0 (no hay señal).
    const alcanceAjustado = (d.alcance != null && d.gasto != null)
      ? ((1 + d.alcance) / (1 + d.gasto)) * (1 + mercado) - 1 : null;
    // CPC que no explica el mercado: si toda la cuenta encareció 15%, eso se descuenta.
    const cpcCreativo = d.cpc != null ? (1 + d.cpc) / (1 + mercado) - 1 : null;

    const tend = tendenciaVentana(diariosA, L, cfg);
    const pred = prediccion(rows, hasta, cfg);
    const s = {
      desgaste: pred ? ramp(-pred.caidaDesdePico, cfg.rampas.desgaste) : null,
      ctr: ramp(d.ctr == null ? null : -d.ctr, cfg.rampas.ctr),
      tendencia: tend ? ramp(-tend.cambioRel, cfg.rampas.tendencia) * Math.min(1, tend.r2 / 0.3) : null,
      frecuencia: ramp(d.frecuencia, cfg.rampas.frecuencia),
      alcance: ramp(alcanceAjustado == null ? null : -alcanceAjustado, cfg.rampas.alcance),
      cpc: ramp(cpcCreativo, cfg.rampas.cpc),
      hook: a.formato === 'video' ? ramp(d.hook == null ? null : -d.hook, cfg.rampas.hook) : null
    };
    if (a.frecuencia_acumulada) {
      const lim = cfg.frecAcumuladaAlta[a.etapa] || 3;
      if (a.frecuencia_acumulada > lim) {
        s.frecuencia = Math.max(s.frecuencia || 0, Math.min(1, 0.5 + (a.frecuencia_acumulada - lim) / lim));
      }
    }

    const avisos = [];
    if (d.gasto != null && d.gasto >= cfg.escaladoFuerte) {
      avisos.push({ tipo: 'escalado', texto: `La inversión subió ${fmtAbs(d.gasto)}: parte del alza de CPC y frecuencia es efecto del escalado, no del creativo.` });
      if (s.cpc != null) s.cpc *= 0.7;
      if (s.alcance != null) s.alcance *= 0.7;
      if (s.frecuencia != null) s.frecuencia *= 0.8;
    }
    if (d.gasto != null && d.gasto <= cfg.recortePresupuesto) {
      avisos.push({ tipo: 'recorte', texto: `La inversión bajó ${fmtAbs(d.gasto)} y el alcance ${verbo(d.alcance, 'subió', 'bajó')} ${fmtAbs(d.alcance)}. Una caída de alcance proporcional al presupuesto es normal y no se cuenta como fatiga.` });
    }
    if (mercado >= cfg.subastaCara) {
      avisos.push({ tipo: 'mercado', texto: `El CPM de toda la cuenta subió ${fmtAbs(mercado)}. Ese encarecimiento se descontó del CPC y del alcance de este anuncio.` });
    }

    // Índice ponderado (las señales que no existen redistribuyen su peso)
    let tot = 0, wsum = 0;
    for (const k in cfg.pesos) if (s[k] != null) { tot += cfg.pesos[k] * s[k]; wsum += cfg.pesos[k]; }
    let indice = wsum > 0 ? Math.round(100 * tot / wsum) : null;
    const aportes = {};
    for (const k in cfg.pesos) aportes[k] = s[k] != null && wsum > 0 ? Math.round(100 * cfg.pesos[k] * s[k] / wsum) : null;

    // Sin caída en la respuesta al creativo no se declara fatiga creativa: es audiencia.
    const respuestaCae = (s.desgaste || 0) >= 0.3 || (s.ctr || 0) >= 0.2 || (s.hook || 0) >= 0.2 || (s.tendencia || 0) >= 0.4;
    const presionAudiencia = (s.frecuencia || 0) >= 0.5 || (s.alcance || 0) >= 0.5;
    let causa = null;
    if (indice != null) {
      if (!respuestaCae && presionAudiencia) {
        causa = 'audiencia';
        if (indice >= cfg.cortes.desarrollo) indice = cfg.cortes.desarrollo - 1;
      } else if (respuestaCae && indice >= cfg.cortes.temprana) causa = 'creativo';
    }

    // Sin periodo previo, un anuncio con 14+ días en el rango se juzga contra su propio pico y su tendencia
    const sinPrevio = P.imp < cfg.minImpresionesPrevio;
    const soloPropio = sinPrevio && A.dias >= 14 && pred != null;
    if (soloPropio) avisos.push({ tipo: 'sin_previo', texto: 'No hay periodo anterior con datos: este diagnóstico se basa en su CTR contra su propio pico y en su tendencia dentro del rango.' });
    const muestraOk = A.imp >= cfg.minImpresiones && (!sinPrevio || soloPropio) && A.dias >= Math.min(cfg.minDiasEntrega, L);
    const vidaOk = diasVida == null || diasVida >= cfg.minDiasVida;
    let etapa;
    let motivoSinDatos = null;
    if (!vidaOk) motivoSinDatos = `Tiene ${diasVida} días de vida: antes de ${cfg.minDiasVida} solo se observa.`;
    else if (sinPrevio && !soloPropio) motivoSinDatos = 'No tiene periodo anterior suficiente para comparar ni historia para medir su pico.';
    else if (!muestraOk) motivoSinDatos = 'Muestra insuficiente en el periodo (impresiones o días de entrega).';
    if (motivoSinDatos || indice == null) etapa = 'sin_datos';
    else if (indice >= cfg.cortes.fatigado) etapa = 'fatigado';
    else if (indice >= cfg.cortes.desarrollo) etapa = 'desarrollo';
    else if (indice >= cfg.cortes.temprana) etapa = 'temprana';
    else etapa = 'sano';

    // Piso por desgaste: si el CTR ya perdió 30% de su pico, la fatiga es un hecho
    if (etapa !== 'sin_datos' && pred) {
      if (pred.caidaDesdePico <= -cfg.caidaCtrSevera) etapa = 'fatigado';
      else if (pred.estado === 'cruzado' && (etapa === 'sano' || etapa === 'temprana')) etapa = 'desarrollo';
      // Predictivo: si cruza el umbral en 10 días o menos con tendencia confiable, ya es señal temprana
      else if (pred.estado === 'proyectado' && pred.dias <= 10 && pred.confianza !== 'baja' && etapa === 'sano') etapa = 'temprana';
    }
    if (etapa === 'sin_datos') indice = null;
    else if (etapa !== 'sano' && indice < (cfg.cortes[etapa] || 0)) indice = cfg.cortes[etapa]; // el índice refleja la etapa final

    const rend = rendimiento(ma, ctx.meta, ctx.ref);
    let accion = MATRIZ[etapa][rend.estado];
    if (causa === 'audiencia' && (etapa === 'sano' || etapa === 'temprana')) {
      accion = { id: 'audiencia', grupo: rend.estado === 'no_rinde' ? 'semana' : 'monitoreo', texto: 'Creativo sano, audiencia saturándose: amplía público antes de tocar el creativo' };
    }

    // Razones legibles, ordenadas por peso
    const razones = [];
    const add = (k, txt) => { if ((s[k] || 0) >= 0.2) razones.push({ k, peso: aportes[k] || 0, texto: txt }); };
    if (pred) add('desgaste', `El CTR de los últimos 7 días está ${fmtAbs(pred.caidaDesdePico)} por debajo de su mejor momento (pico de ${(pred.pico * 100).toLocaleString(ctx.meta.locale || 'es-CO', { maximumFractionDigits: 2 })}%).`);
    add('ctr', `El CTR bajó ${fmtAbs(d.ctr)} contra el periodo anterior.`);
    add('tendencia', `Dentro del periodo el CTR viene en picada: ${fmtAbs(tend && tend.cambioRel)} de punta a punta.`);
    add('frecuencia', a.frecuencia_acumulada && s.frecuencia >= 0.5 && (d.frecuencia || 0) < 0.04
      ? `La frecuencia acumulada va en ${a.frecuencia_acumulada.toFixed(1)}: alta para ${a.etapa === 'retargeting' ? 'retargeting' : 'prospección'}.`
      : `La frecuencia subió ${fmtAbs(d.frecuencia)}: la misma gente lo está viendo más veces.`);
    add('alcance', `El alcance por cada peso invertido cayó ${fmtAbs(alcanceAjustado)}, ya descontando presupuesto y mercado.`);
    add('cpc', `El CPC subió ${fmtAbs(cpcCreativo)} más de lo que explica el mercado.`);
    add('hook', `El hook rate cayó ${fmtAbs(d.hook)}: menos gente se detiene en los primeros 3 segundos.`);
    razones.sort((x, y) => y.peso - x.peso);
    if (causa === 'audiencia') razones.push({ k: 'causa', peso: 0, texto: 'El CTR se sostiene: el creativo sigue funcionando y lo que se agota es la audiencia. Amplía público o abre un conjunto nuevo antes de tocar el creativo.' });

    return {
      id: a.id, nombre: a.nombre, campana: a.campana || '', conjunto: a.conjunto || '',
      formato: a.formato, etapaEmbudo: a.etapa, preview: a.preview_url || null,
      diasVida, actual: ma, previo: mp, deltas: d, alcanceAjustado, cpcCreativo,
      tendencia: tend, senales: s, aportes, indice, etapa, causa, motivoSinDatos,
      rendimiento: rend, accion, prediccion: pred, avisos, razones
    };
  }

  // ───────────────────────── Análisis completo ─────────────────────────
  function analizar(prep, meta, opts) {
    opts = opts || {};
    const cfg = Object.assign({}, CONFIG_BASE, opts.config || {});
    const hasta = opts.hasta != null ? opts.hasta : prep.maxD;
    const desde = opts.desde != null ? opts.desde : hasta - (opts.dias || 14) + 1;
    const L = hasta - desde + 1;
    const pHasta = desde - 1, pDesde = desde - L;
    const f = opts.filtros || {};
    const pasa = (a) => (!f.campana || a.campana === f.campana) && (!f.formato || a.formato === f.formato) && (!f.etapa || a.etapa === f.etapa);

    // Mercado: CPM de TODA la cuenta (sin filtros) actual vs previo
    const mA = vacio(), mP = vacio();
    // Serie diaria de lo filtrado (actual + previo)
    const serie = new Map();
    for (let d = pDesde; d <= hasta; d++) serie.set(d, vacio());
    const tA = vacio(), tP = vacio();
    for (const [id, rows] of prep.porAnuncio) {
      const a = prep.info.get(id);
      const ok = pasa(a);
      for (const r of rows) {
        if (r._d < pDesde || r._d > hasta) continue;
        if (r._d >= desde) sumar(mA, r); else sumar(mP, r);
        if (!ok) continue;
        sumar(serie.get(r._d), r);
        if (r._d >= desde) sumar(tA, r); else sumar(tP, r);
      }
    }
    const cuentaActual = metricas(tA), cuentaPrevia = metricas(tP);
    const dCpmCuenta = pct(metricas(mA).cpm, metricas(mP).cpm);

    const nAnunciosActivos = [...prep.porAnuncio.keys()].filter((id) => pasa(prep.info.get(id))).length || 1;
    const ref = {
      cpa: cuentaActual.cpa, roas: cuentaActual.roas,
      gastoMedio: cuentaActual.gasto / nAnunciosActivos, margen: cfg.margenLimite
    };
    const ctx = { cfg, desde, hasta, pDesde, L, dCpmCuenta, meta, ref };

    const anuncios = [];
    for (const [id, rows] of prep.porAnuncio) {
      const a = prep.info.get(id);
      if (!pasa(a)) continue;
      const r = evaluarAnuncio(a, rows, ctx);
      if (r) anuncios.push(r);
    }

    // Distribución por etapa (conteo y gasto)
    const dist = {};
    for (const k in ETAPAS) dist[k] = { n: 0, gasto: 0 };
    for (const a of anuncios) { dist[a.etapa].n++; dist[a.etapa].gasto += a.actual.gasto; }

    // Grupos del plan de acción
    const grupos = { ya: [], semana: [], monitoreo: [], revisar: [], sanos: [], esperar: [] };
    for (const a of anuncios) grupos[a.accion.grupo].push(a);
    for (const g in grupos) grupos[g].sort((x, y) => (y.indice || 0) - (x.indice || 0));

    // Serie diaria + direcciones de la cuenta
    const dias = [], diasPrev = [];
    for (let d = desde; d <= hasta; d++) dias.push(Object.assign({ fecha: aFecha(d), d }, metricas(serie.get(d))));
    for (let d = pDesde; d <= pHasta; d++) diasPrev.push(Object.assign({ fecha: aFecha(d), d }, metricas(serie.get(d))));
    const kpis = ['gasto', 'alcance', 'impresiones', 'frecuencia', 'ctr', 'cpc', 'cpm', 'resultados', 'cpa', 'roas'];
    const direccion = {};
    for (const k of kpis) {
      const delta = pct(cuentaActual[k], cuentaPrevia[k]);
      const pts = dias.filter((x) => x[k] != null && x.impresiones > 0).map((x, i) => ({ x: i, y: x[k] }));
      const fit = pts.length >= 4 ? ols(pts) : null;
      const media = pts.length ? pts.reduce((s2, p) => s2 + p.y, 0) / pts.length : 0;
      const dentro = fit && media ? fit.m * (L - 1) / media : null;
      direccion[k] = {
        delta,
        vsPrevio: delta == null ? 'sin_dato' : Math.abs(delta) < 0.05 ? 'estable' : delta > 0 ? 'sube' : 'baja',
        dentro,
        dentroTexto: dentro == null ? 'sin_dato' : Math.abs(dentro) < 0.08 || (fit && fit.r2 < 0.15) ? 'estable' : dentro > 0 ? 'ascendente' : 'descendente'
      };
    }

    // ¿El alcance sigue al presupuesto? (descontando el encarecimiento del mercado)
    const dG = direccion.gasto.delta, dAl = direccion.alcance.delta;
    const merc = dCpmCuenta || 0;
    const brecha = (dG != null && dAl != null) ? ((1 + dAl) / (1 + dG)) * (1 + merc) - 1 : null;
    const notaMerc = Math.abs(merc) >= 0.05 ? ` (ya descontando que el CPM de la cuenta ${verbo(merc, 'subió', 'bajó')} ${fmtAbs(merc)})` : '';
    const frase = `La inversión ${verbo(dG, 'subió', 'bajó')} ${fmtAbs(dG)} y el alcance ${verbo(dAl, 'subió', 'bajó')} ${fmtAbs(dAl)}`;
    let veredictoAlcance = 'Sin periodo previo suficiente para comparar alcance y presupuesto.';
    let alcanceEstado = 'neutro';
    if (brecha != null) {
      if (brecha <= -0.10) {
        veredictoAlcance = `${frase}. El alcance cae más de lo que explica el presupuesto${notaMerc}: hay saturación o desgaste.`;
        alcanceEstado = 'riesgo';
      } else if ((1 + dAl) / (1 + dG) - 1 <= -0.10 && merc >= 0.05) {
        veredictoAlcance = `${frase}. El alcance cae más que la inversión, pero la diferencia la explica el mercado: el CPM de la cuenta subió ${fmtAbs(merc)}. No hay señal de saturación.`;
        alcanceEstado = 'vigilar';
      } else if (dG <= -0.10) {
        veredictoAlcance = `${frase}. La caída de alcance va en proporción al presupuesto${notaMerc}: es normal, no es fatiga.`;
        alcanceEstado = 'ok';
      } else if (brecha >= 0.10) {
        veredictoAlcance = `${frase}. El alcance rinde más que la inversión${notaMerc}: estás llegando a gente nueva de forma eficiente.`;
        alcanceEstado = 'ok';
      } else {
        veredictoAlcance = `${frase}. Se mueven en proporción${notaMerc}: no hay señal de saturación en la cuenta.`;
        alcanceEstado = 'ok';
      }
    }

    const analizados = anuncios.filter((a) => a.etapa !== 'sin_datos');
    const gastoFatiga = dist.fatigado.gasto + dist.desarrollo.gasto;
    const resumen = {
      totalAnuncios: anuncios.length,
      analizados: analizados.length,
      accionYa: grupos.ya.length,
      accionSemana: grupos.semana.length,
      monitoreo: grupos.monitoreo.length,
      pctGastoEnFatiga: cuentaActual.gasto > 0 ? gastoFatiga / cuentaActual.gasto : 0,
      reemplazos: grupos.ya.length + grupos.semana.length,
      variantes: grupos.monitoreo.length + grupos.sanos.filter((a) => a.accion.id === 'escalar').length,
      proximos: anuncios
        .filter((a) => a.prediccion && a.prediccion.estado === 'proyectado' && a.etapa !== 'fatigado')
        .sort((x, y) => x.prediccion.dias - y.prediccion.dias).slice(0, 5)
    };

    return {
      rango: { desde: aFecha(desde), hasta: aFecha(hasta), dias: L, previoDesde: aFecha(pDesde), previoHasta: aFecha(pHasta) },
      coberturaPrevia: Math.max(0, Math.min(pHasta, prep.maxD) - Math.max(pDesde, prep.minD) + 1) / L,
      mercado: { dCpm: dCpmCuenta, caro: (dCpmCuenta || 0) >= cfg.subastaCara },
      cuenta: { actual: cuentaActual, previo: cuentaPrevia, direccion, dias, diasPrev, brecha, veredictoAlcance, alcanceEstado },
      anuncios, distribucion: dist, grupos, resumen, cfg
    };
  }

  return { CONFIG_BASE, ETAPAS, RENDIMIENTO, MATRIZ, preparar, analizar, aNum, aFecha, fmtPct, fmtAbs };
})();

export default MotorFatiga;
