import React, { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Minus, Upload, Sparkles, Settings2, X, RefreshCw, Info,
} from "lucide-react";
import {
  preparar, evaluarCuenta, sumarDias, diasEntre, ETAPAS, ETAPA, GRUPOS, SENALES, METRICAS_CUENTA, REND_LABEL, delta, CONFIG_BASE,
} from "./motor.js";
import { normalizarCsv } from "./normalizar.js";
import { generarDemo } from "./demo.js";

export const FATIGA_KEY = "nova-fatiga:datos:v1";
const CONFIG_KEY = "nova-fatiga:config:v1";
const RANGOS = [7, 14, 30, 60, 90];

/* ---------------- formato ---------------- */
function formateadores(moneda) {
  let dinero;
  try { dinero = new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda || "PEN", maximumFractionDigits: 2 }); }
  catch { dinero = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }); }
  const entero = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });
  const nulo = (fn) => (v) => (v == null || !Number.isFinite(v) ? "—" : fn(v));
  return {
    moneda: nulo((v) => dinero.format(v)),
    entero: nulo((v) => entero.format(v)),
    decimal: nulo((v) => v.toFixed(2)),
    pct: nulo((v) => `${(v * 100).toFixed(2)}%`),
    tipo(t, v) { return this[t](v); },
  };
}
const signo = (d) => (d == null ? "—" : `${d > 0 ? "+" : ""}${(d * 100).toFixed(0)}%`);
const fechaCorta = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : "");

/* ---------------- piezas ---------------- */
function Grafico({ config, height = 220 }) {
  const lienzo = useRef(null);
  useEffect(() => {
    const chart = new Chart(lienzo.current, config);
    return () => chart.destroy();
  }, [config]);
  return <div className="relative w-full" style={{ height }}><canvas ref={lienzo} /></div>;
}

function Sparkline({ valores, color = "#0d9488" }) {
  const pts = valores.map((v, i) => [i, v]).filter(([, v]) => v != null && Number.isFinite(v));
  if (pts.length < 2) return <div className="h-7" />;
  const ys = pts.map(([, v]) => v);
  const min = Math.min(...ys), max = Math.max(...ys);
  const w = 100, h = 28, n = valores.length - 1 || 1;
  const d = pts.map(([i, v]) => `${((i / n) * w).toFixed(1)},${(h - 2 - ((v - min) / (max - min || 1)) * (h - 4)).toFixed(1)}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-7 w-full"><polyline points={d} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></svg>;
}

function Tarjeta({ titulo, children, className = "", extra }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>
      {titulo && <div className="mb-3 flex items-center gap-2"><h3 className="text-[13px] font-bold text-slate-700">{titulo}</h3>{extra && <div className="ml-auto">{extra}</div>}</div>}
      {children}
    </section>
  );
}

const Etiqueta = ({ etapa }) => {
  const e = ETAPA[etapa];
  return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: e.color + "26", color: etapa === "tempranas" ? "#c2410c" : e.color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: e.color }} />{e.label}</span>;
};

const REND_COLOR = { rinde: "#047857", limite: "#c2410c", no_rinde: "#be123c", sin_datos: "#64748b" };

function textoPrediccion(p) {
  switch (p.estado) {
    case "cruzo": return "Ya cruzó el umbral de fatiga (CTR 30% bajo su pico).";
    case "proyectado": return `Cruzaría el umbral en ~${p.dias} días (confianza ${p.confianza}).`;
    case "lejano": return `Más de ${CONFIG_BASE.horizonteDias} días para cruzar el umbral.`;
    case "estable": return "CTR estable o subiendo: sin fecha de fatiga.";
    case "sin_tendencia": return "Pocos días con entrega para proyectar.";
    default: return "Sin historia suficiente para calcular su pico.";
  }
}

/* ---------------- detalle de un anuncio ---------------- */
function Detalle({ a, prep, per, f, etiquetaRes, metrica, objetivo, onClose }) {
  const grafico = useMemo(() => {
    const porDia = prep.filas.get(a.id);
    const desde = sumarDias(per.actual.hasta, -Math.min(89, diasEntre(prep.rango.desde, per.actual.hasta)));
    const extra = a.pred.estado === "proyectado" ? a.pred.dias : 0;
    const fechas = [];
    for (let d = desde; d <= sumarDias(per.actual.hasta, extra); d = sumarDias(d, 1)) fechas.push(d);
    const ctr = fechas.map((d) => { const r = porDia?.get(d); return r && r.impresiones >= 100 ? (r.clics / r.impresiones) * 100 : null; });
    const suave = fechas.map((d) => a.pred.puntos?.find((p) => p.fecha === d)?.y * 100 || null);
    const r = a.pred.recta;
    const proy = fechas.map((d) => (r && d >= a.pred.desde ? (r.intercepto + r.pendiente * diasEntre(a.pred.desde, d)) * 100 : null));
    const lineaFija = (v) => fechas.map(() => (v == null ? null : v * 100));
    return {
      type: "line",
      data: {
        labels: fechas.map(fechaCorta),
        datasets: [
          { label: "CTR diario", data: ctr, borderColor: "#94a3b8", backgroundColor: "#94a3b8", pointRadius: 1.5, borderWidth: 1, spanGaps: false },
          { label: "CTR suavizado (3 días)", data: suave, borderColor: "#0d9488", pointRadius: 0, borderWidth: 2, spanGaps: true },
          { label: "Tendencia y proyección", data: proy, borderColor: "#f97316", borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5 },
          { label: "Pico sostenido", data: lineaFija(a.pico?.ctr), borderColor: "#10b981", pointRadius: 0, borderWidth: 1 },
          { label: "Umbral de fatiga", data: lineaFija(a.pred.umbral), borderColor: "#e11d48", borderDash: [2, 3], pointRadius: 0, borderWidth: 1.5 },
        ],
      },
      options: {
        maintainAspectRatio: false, animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y?.toFixed(2)}%` } } },
        scales: { y: { ticks: { callback: (v) => `${v}%` } }, x: { ticks: { maxTicksLimit: 10 } } },
      },
    };
  }, [a, prep, per]);

  const filas = [
    ["CTR del periodo", f.pct(a.actual.ctr), `antes ${f.pct(a.previo.ctr)} (${signo(delta(a.actual.ctr, a.previo.ctr))})`],
    ["CTR últimos 7 días", f.pct(a.ult7.ctr), a.pico ? `pico ${f.pct(a.pico.ctr)} (${fechaCorta(a.pico.desde)}–${fechaCorta(a.pico.hasta)})` : "sin pico"],
    ["Umbral de fatiga", f.pct(a.pred.umbral), a.caidaPico != null ? `hoy ${Math.round(a.caidaPico * 100)}% bajo el pico` : ""],
    ["Frecuencia", f.decimal(a.actual.frecuencia), `antes ${f.decimal(a.previo.frecuencia)}${a.frecuencia_acumulada != null ? ` · acumulada ${a.frecuencia_acumulada}` : ""}`],
    ["CPC", f.moneda(a.actual.cpc), `antes ${f.moneda(a.previo.cpc)}`],
    ["Inversión", f.moneda(a.actual.gasto), `antes ${f.moneda(a.previo.gasto)}`],
    [etiquetaRes, f.entero(a.actual.resultados), metrica === "roas" ? `ROAS ${f.decimal(a.actual.roas)} (objetivo ${f.decimal(objetivo)})` : `costo ${f.moneda(a.actual.cpr)} (objetivo ${f.moneda(objetivo)})`],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="my-4 w-full max-w-4xl rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="break-all font-mono text-[13px] font-bold text-slate-800">{a.nombre}</div>
            <div className="mt-0.5 text-[11px] text-slate-400">{[a.campana, a.conjunto, a.formato, `${a.vida} días de vida`].filter(Boolean).join(" · ")}</div>
          </div>
          <button onClick={onClose} className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Etiqueta etapa={a.etapa} />
            {a.indice != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Índice {a.indice}</span>}
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: REND_COLOR[a.rend.estado], background: REND_COLOR[a.rend.estado] + "1a" }}>{REND_LABEL[a.rend.estado]}</span>
            {a.causa && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">Causa probable: {a.causa}</span>}
          </div>
          <div className="rounded-xl bg-slate-900 px-4 py-3 text-white">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{a.grupo}</div>
            <div className="text-[14px] font-bold">{a.accion}</div>
            <div className="mt-1 text-[12px] text-slate-300">{textoPrediccion(a.pred)}</div>
          </div>
          {a.etapa !== "sin_datos" && <Grafico config={grafico} height={260} />}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
              {filas.map(([k, v, s]) => (
                <div key={k} className="flex items-baseline gap-2 px-3 py-2 text-[12px]">
                  <span className="w-36 shrink-0 text-slate-500">{k}</span>
                  <span className="font-bold text-slate-800">{v}</span>
                  <span className="ml-auto text-right text-[11px] text-slate-400">{s}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Qué empuja el índice</div>
              {Object.keys(a.senales).length === 0 && <p className="text-[12px] text-slate-400">{a.motivo || "Sin señales."}</p>}
              <div className="space-y-1.5">
                {SENALES.filter((s) => a.senales[s.key] != null).map((s) => (
                  <div key={s.key} className="flex items-center gap-2 text-[12px]">
                    <span className="w-40 shrink-0 text-slate-600">{s.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-400" style={{ width: `${a.senales[s.key] * 100}%` }} /></div>
                    <span className="w-14 text-right font-mono text-[11px] text-slate-500">+{a.aportes[s.key].toFixed(1)}</span>
                  </div>
                ))}
              </div>
              {a.avisos.length > 0 && (
                <ul className="mt-3 space-y-1 text-[11px] text-slate-500">
                  {a.avisos.map((t) => <li key={t} className="flex gap-1"><Info size={12} className="mt-0.5 shrink-0" />{t}</li>)}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- página ---------------- */
export default function FatigaView({ sync, onPedir, onCancelar, version }) {
  const [datos, setDatos] = useState(undefined);
  const [esDemo, setEsDemo] = useState(false);
  const [config, setConfig] = useState({ cuenta: "", metrica: "cpa", objetivo: "", etiqueta: "Compras" });
  const [verConfig, setVerConfig] = useState(false);
  const [rango, setRango] = useState({ dias: 14 });
  const [campana, setCampana] = useState("");
  const [orden, setOrden] = useState({ key: "indice", dir: "desc" });
  const [metricaTend, setMetricaTend] = useState("ctr");
  const [porGasto, setPorGasto] = useState(true);
  const [sel, setSel] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const archivo = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await window.storage.get(CONFIG_KEY);
        if (c?.value) setConfig((p) => ({ ...p, ...JSON.parse(c.value) }));
      } catch {}
      try {
        const d = await window.storage.get(FATIGA_KEY);
        setDatos(d?.value ? JSON.parse(d.value) : null);
        setEsDemo(false);
      } catch {
        setDatos(null);
      }
    })();
  }, [version]);

  const guardarConfig = (next) => {
    setConfig(next);
    window.storage.set(CONFIG_KEY, JSON.stringify(next)).catch(() => {});
  };

  const subir = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setMensaje({ error: true, textos: ["Por ahora se aceptan archivos .csv. En el Administrador de anuncios: Informes → Exportar datos de la tabla → .csv."] });
      return;
    }
    try {
      const { datos: d, avisos, resumen } = normalizarCsv(await file.text(), {
        cuenta: config.cuenta || file.name.replace(/\.csv$/i, ""),
        metrica_rectora: config.metrica,
        objetivo: Number(config.objetivo) || null,
        etiqueta_resultado: config.etiqueta,
      });
      await window.storage.set(FATIGA_KEY, JSON.stringify(d));
      setDatos(d); setEsDemo(false); setRango({ dias: 14 }); setCampana("");
      setMensaje({ error: false, textos: [`Cargados ${resumen.anuncios} anuncios, ${resumen.filas} filas (${resumen.desde} a ${resumen.hasta}).`, ...avisos] });
    } catch (err) {
      setMensaje({ error: true, textos: [err.message || "No se pudo leer el archivo."] });
    }
  };

  const verDemo = () => { setDatos(generarDemo()); setEsDemo(true); setRango({ dias: 14 }); setCampana(""); setMensaje(null); };

  const syncFatiga = sync?.tipo === "fatiga" ? sync : null;
  const ocupado = sync?.status === "pendiente" || sync?.status === "procesando";
  const pedir = () => {
    if (!config.cuenta.trim()) { setVerConfig(true); setMensaje({ error: true, textos: ["Indica la cuenta de Meta (ID o nombre) para que Claude sepa qué leer."] }); return; }
    setMensaje(null);
    onPedir(config).catch((err) => setMensaje({ error: true, textos: [err.message] }));
  };

  const prep = useMemo(() => (datos?.diario?.length ? preparar(datos) : null), [datos]);
  const objetivo = Number(config.objetivo) || null;
  const res = useMemo(() => {
    if (!prep) return null;
    const r = rango.desde
      ? { desde: rango.desde < prep.rango.desde ? prep.rango.desde : rango.desde, hasta: rango.hasta > prep.rango.hasta ? prep.rango.hasta : rango.hasta }
      : { dias: rango.dias };
    try {
      return evaluarCuenta(prep, { ...r, campana: campana || undefined, metrica: config.metrica, objetivo: objetivo ?? prep.meta.objetivo });
    } catch (err) {
      console.error(err);
      return { error: err.message };
    }
  }, [prep, rango, campana, config.metrica, objetivo]);

  const f = useMemo(() => formateadores(prep?.meta.moneda), [prep]);
  const etiquetaRes = prep?.meta.etiqueta_resultado || config.etiqueta || "Resultados";

  /* ---- gráficos ---- */
  const graficos = useMemo(() => {
    if (!res || res.error) return {};
    const labels = res.serieActual.map((d) => fechaCorta(d.fecha));
    const indexar = (serie, k) => {
      const base = serie.slice(0, 3).map((d) => d[k]).filter((v) => v != null);
      const b = base.reduce((s, v) => s + v, 0) / (base.length || 1);
      return serie.map((d) => (d[k] != null && b ? (d[k] / b) * 100 : null));
    };
    const alcance = {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Inversión", data: indexar(res.serieActual, "gasto"), borderColor: "#0f172a", pointRadius: 0, borderWidth: 2, tension: 0.3 },
          { label: "Alcance", data: indexar(res.serieActual, "alcance"), borderColor: "#0d9488", pointRadius: 0, borderWidth: 2, tension: 0.3 },
          { label: "Frecuencia", data: indexar(res.serieActual, "frecuencia"), borderColor: "#f97316", pointRadius: 0, borderWidth: 2, tension: 0.3 },
        ],
      },
      options: { maintainAspectRatio: false, animation: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y?.toFixed(0)}` } } }, scales: { y: { title: { display: true, text: "Índice (inicio = 100)", font: { size: 10 } } } } },
    };
    const conDatos = res.termometro.filter((e) => (porGasto ? e.gasto : e.anuncios) > 0);
    const dona = {
      type: "doughnut",
      data: { labels: conDatos.map((e) => e.label), datasets: [{ data: conDatos.map((e) => (porGasto ? e.gasto : e.anuncios)), backgroundColor: conDatos.map((e) => e.color), borderWidth: 2, borderColor: "#fff" }] },
      options: { maintainAspectRatio: false, animation: false, cutout: "62%", plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: (c) => `${c.label}: ${porGasto ? f.moneda(c.parsed) : c.parsed + " anuncios"}` } } } },
    };
    const m = METRICAS_CUENTA.find((x) => x.key === metricaTend);
    const escala = m.tipo === "pct" ? 100 : 1;
    const tendencia = {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: `${m.label} · periodo`, data: res.serieActual.map((d) => (d[m.key] == null ? null : d[m.key] * escala)), borderColor: "#0d9488", backgroundColor: "#0d948822", fill: true, pointRadius: 0, borderWidth: 2, tension: 0.3 },
          { label: "Periodo anterior", data: res.seriePrevia.map((d) => (d[m.key] == null ? null : d[m.key] * escala)), borderColor: "#94a3b8", borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5, tension: 0.3 },
        ],
      },
      options: { maintainAspectRatio: false, animation: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${m.tipo === "pct" ? c.parsed.y?.toFixed(2) + "%" : f.tipo(m.tipo, c.parsed.y)}` } } } },
    };
    const evaluados = res.anuncios.filter((a) => a.indice != null);
    const maxGasto = Math.max(1, ...evaluados.map((a) => a.actual.gasto));
    const matriz = {
      type: "scatter",
      data: {
        datasets: [
          ...ETAPAS.filter((e) => e.key !== "sin_datos").map((e) => ({
            label: e.label,
            data: evaluados.filter((a) => a.etapa === e.key).map((a) => ({ x: a.indice, y: a.rend.ratio == null ? 0 : Math.min(2, a.rend.ratio), nombre: a.nombre, sinRend: a.rend.ratio == null, r: 4 + 10 * Math.sqrt(a.actual.gasto / maxGasto) })),
            backgroundColor: e.color + "cc", borderColor: e.color,
            pointRadius: (c) => c.raw?.r ?? 5, pointStyle: (c) => (c.raw?.sinRend ? "rectRot" : "circle"),
          })),
          { type: "line", label: "Corte fatiga", data: [{ x: CONFIG_BASE.cortes.desarrollo, y: 0 }, { x: CONFIG_BASE.cortes.desarrollo, y: 2 }], borderColor: "#cbd5e1", borderDash: [4, 4], pointRadius: 0, borderWidth: 1 },
          { type: "line", label: "Objetivo", data: [{ x: 0, y: 1 }, { x: 100, y: 1 }], borderColor: "#cbd5e1", borderDash: [4, 4], pointRadius: 0, borderWidth: 1 },
        ],
      },
      options: {
        maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { labels: { boxWidth: 10, font: { size: 11 }, filter: (i) => !["Corte fatiga", "Objetivo"].includes(i.text) } },
          tooltip: { filter: (c) => c.raw?.nombre, callbacks: { label: (c) => `${c.raw.nombre} · índice ${c.raw.x} · ${c.raw.sinRend ? "rendimiento sin datos" : `rendimiento ×${c.raw.y.toFixed(2)}`}` } },
        },
        scales: {
          x: { min: 0, max: 100, title: { display: true, text: "Índice de fatiga →", font: { size: 10 } } },
          y: { min: 0, max: 2.1, ticks: { callback: (v) => (v <= 2 ? v : "") }, title: { display: true, text: "Rendimiento vs objetivo (1 = cumple)", font: { size: 10 } } },
        },
      },
    };
    return { alcance, dona, tendencia, matriz };
  }, [res, metricaTend, porGasto, f]);

  /* ---- tabla ---- */
  const filasTabla = useMemo(() => {
    if (!res?.anuncios) return [];
    const val = (a) => {
      switch (orden.key) {
        case "nombre": return a.nombre.toLowerCase();
        case "indice": return a.indice ?? -1;
        case "rend": return a.rend.ratio ?? -1;
        case "gasto": return a.actual.gasto;
        case "ctr": return a.actual.ctr ?? -1;
        case "dctr": return delta(a.actual.ctr, a.previo.ctr) ?? 0;
        case "frecuencia": return a.actual.frecuencia ?? -1;
        case "dias": return a.pred.estado === "cruzo" ? 0 : a.pred.dias ?? 999;
        default: return 0;
      }
    };
    const mul = orden.dir === "asc" ? 1 : -1;
    return [...res.anuncios].sort((x, y) => (val(x) < val(y) ? -mul : val(x) > val(y) ? mul : 0));
  }, [res, orden]);
  const Th = ({ k, children, className = "" }) => (
    <th onClick={() => setOrden((o) => ({ key: k, dir: o.key === k && o.dir === "desc" ? "asc" : "desc" }))} className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 hover:text-slate-700 ${className}`}>
      {children}{orden.key === k ? (orden.dir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  const seleccionado = sel && res?.anuncios?.find((a) => a.id === sel);

  /* ---- encabezado (siempre visible) ---- */
  const estadoClaude = syncFatiga && {
    pendiente: "Esperando a Claude…",
    procesando: "Claude está leyendo la cuenta…",
    listo: `Datos recibidos: ${syncFatiga.anuncios ?? "?"} anuncios, ${syncFatiga.filas ?? "?"} filas`,
    error: `Error: ${syncFatiga.error}`,
    cancelado: "Solicitud cancelada",
  }[syncFatiga.status];

  const campo = "w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
  const cabecera = (
    <Tarjeta>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600"><Activity size={18} /></div>
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold text-slate-800">Predictor de fatiga creativa</h2>
          <p className="text-[11px] text-slate-400">
            {prep
              ? `${esDemo ? "Datos de demostración" : prep.meta.cuenta || "Cuenta"} · ${prep.anuncios.length} anuncios · ${prep.rango.desde} a ${prep.rango.hasta}${prep.meta.fuente ? ` · fuente ${prep.meta.fuente}` : ""}${prep.meta.actualizado && !esDemo ? ` · actualizado ${new Date(prep.meta.actualizado).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}`
              : "¿Ya está fatigado? ¿Se está fatigando? ¿Cuándo? ¿Hay que actuar o solo vigilar?"}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {estadoClaude && <span className={`text-[11px] ${syncFatiga.status === "error" ? "text-rose-600" : "text-slate-400"}`}>{estadoClaude}</span>}
          {ocupado && <button onClick={onCancelar} className="text-[11px] font-semibold text-slate-500 underline hover:text-rose-600">Cancelar</button>}
          <button onClick={pedir} disabled={ocupado} className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-teal-700 disabled:cursor-wait disabled:opacity-70">
            <RefreshCw size={14} className={ocupado && syncFatiga ? "animate-spin" : ""} /> Pedir datos a Claude
          </button>
          <button onClick={() => archivo.current?.click()} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"><Upload size={14} /> Subir CSV</button>
          <button onClick={verDemo} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"><Sparkles size={14} /> Demo</button>
          <button onClick={() => setVerConfig((v) => !v)} title="Configurar" className={`rounded-lg border border-slate-200 p-2 hover:bg-slate-50 ${verConfig ? "bg-slate-100 text-teal-700" : "bg-white text-slate-500"}`}><Settings2 size={15} /></button>
          <input ref={archivo} type="file" accept=".csv,text/csv" className="hidden" onChange={subir} />
        </div>
      </div>
      {verConfig && (
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Cuenta de Meta (ID o nombre)
            <input className={campo + " mt-1 font-normal normal-case tracking-normal"} value={config.cuenta} onChange={(e) => guardarConfig({ ...config, cuenta: e.target.value })} placeholder="act_123… o novashop_soles" />
          </label>
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Métrica rectora
            <select className={campo + " mt-1 font-normal normal-case tracking-normal"} value={config.metrica} onChange={(e) => guardarConfig({ ...config, metrica: e.target.value })}>
              <option value="cpa">Costo por resultado (CPA)</option>
              <option value="roas">ROAS</option>
            </select>
          </label>
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Objetivo ({config.metrica === "roas" ? "ROAS" : "costo máximo"})
            <input type="number" min="0" step="any" className={campo + " mt-1 font-normal normal-case tracking-normal"} value={config.objetivo} onChange={(e) => guardarConfig({ ...config, objetivo: e.target.value })} placeholder="Vacío = promedio de la cuenta" />
          </label>
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Qué es un resultado
            <input className={campo + " mt-1 font-normal normal-case tracking-normal"} value={config.etiqueta} onChange={(e) => guardarConfig({ ...config, etiqueta: e.target.value })} placeholder="Compras, leads, conversaciones" />
          </label>
        </div>
      )}
      {sync && sync.agente === false && (
        <div className="mt-3 flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>El servidor no tiene <b>SYNC_TOKEN</b>, así que Claude no puede enviar datos. Agrégalo en las variables de entorno de Coolify y vuelve a desplegar.</span>
        </div>
      )}
      {mensaje && (
        <div className={`mt-3 rounded-lg px-3 py-2 text-[12px] ${mensaje.error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`}>
          {mensaje.textos.map((t) => <div key={t}>{t}</div>)}
        </div>
      )}
    </Tarjeta>
  );

  if (datos === undefined) return <div className="py-16 text-center text-slate-400">Cargando…</div>;

  if (!prep) {
    return (
      <div className="space-y-4">
        {cabecera}
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <Activity size={28} className="mx-auto text-slate-300" />
          <p className="mt-3 text-[14px] font-semibold text-slate-600">Aún no hay datos de fatiga</p>
          <div className="mx-auto mt-3 max-w-xl space-y-3 text-left text-[12px] text-slate-500">
            <p><b>Opción 1 · Pedir datos a Claude:</b> configura la cuenta y pulsa el botón. Claude lee 90 días de la cuenta con el conector de Meta y los deja acá.</p>
            <div>
              <p><b>Opción 2 · Subir un CSV del Administrador de anuncios:</b></p>
              <ol className="ml-5 mt-1 list-decimal space-y-0.5">
                <li>Pestaña <b>Anuncios</b> (no Campañas ni Conjuntos), rango de los <b>últimos 90 días</b>.</li>
                <li><b>Desglose → Por tiempo → Día</b>. Sin esto no hay tendencias.</li>
                <li>Columnas: campaña, conjunto, nombre e identificador del anuncio, importe gastado, impresiones, alcance, clics en el enlace, resultados, valor de conversión y reproducciones de video de 3 segundos.</li>
                <li><b>Informes → Exportar datos de la tabla → .csv</b>. Sin desgloses de edad ni ubicación.</li>
              </ol>
            </div>
            <p><b>Opción 3:</b> pulsa <b>Demo</b> para ver la página con 10 anuncios de ejemplo.</p>
          </div>
        </div>
      </div>
    );
  }

  if (res?.error) return <div className="space-y-4">{cabecera}<Tarjeta><p className="text-[13px] text-rose-600">No se pudieron analizar los datos: {res.error}</p></Tarjeta></div>;

  const { per, ctx, actual, previo, alcance, grupos, termometro, demanda, direcciones } = res;
  const totalTermo = termometro.reduce((s, e) => s + (porGasto ? e.gasto : e.anuncios), 0) || 1;
  const actuarYa = grupos["Actuar ya"].length;
  const bajoMonitoreo = grupos["Bajo monitoreo"];
  const proximos = res.anuncios
    .filter((a) => a.etapa !== "sin_datos" && ["cruzo", "proyectado", "lejano"].includes(a.pred.estado))
    .sort((x, y) => (x.pred.dias ?? 999) - (y.pred.dias ?? 999));
  const kpis = METRICAS_CUENTA.filter((m) => (ctx.metrica === "roas" ? m.key !== "cpr" : m.key !== "roas") && m.key !== "impresiones");

  return (
    <div className="space-y-4">
      {cabecera}

      {/* Rango */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
          {RANGOS.map((d) => (
            <button key={d} onClick={() => setRango({ dias: d })} className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ${!rango.desde && rango.dias === d ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{d} días</button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-[12px] text-slate-500">
          <input type="date" min={prep.rango.desde} max={prep.rango.hasta} value={per.actual.desde} onChange={(e) => e.target.value && setRango({ desde: e.target.value, hasta: e.target.value > per.actual.hasta ? e.target.value : per.actual.hasta })} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px]" />
          <span>a</span>
          <input type="date" min={prep.rango.desde} max={prep.rango.hasta} value={per.actual.hasta} onChange={(e) => e.target.value && setRango({ desde: e.target.value < per.actual.desde ? e.target.value : per.actual.desde, hasta: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px]" />
        </div>
        <span className="rounded-md border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-500">vs {per.previo.desde} a {per.previo.hasta}</span>
        {prep.campanas.length > 1 && (
          <select value={campana} onChange={(e) => setCampana(e.target.value)} className="ml-auto rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px]">
            <option value="">Todas las campañas</option>
            {prep.campanas.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
      </div>
      {per.previo.desde < prep.rango.desde && (
        <p className="-mt-2 text-[11px] text-orange-600">El periodo anterior empieza antes de los datos disponibles ({prep.rango.desde}): la comparación es parcial.</p>
      )}

      {/* Termómetro */}
      <Tarjeta titulo={actuarYa ? `${actuarYa} ${actuarYa === 1 ? "anuncio necesita" : "anuncios necesitan"} acción ya` : "Ningún anuncio necesita acción inmediata"}
        extra={<button onClick={() => setPorGasto((v) => !v)} className="text-[11px] font-semibold text-teal-700 hover:underline">{porGasto ? "Ver por anuncios" : "Ver por inversión"}</button>}>
        <div className="flex h-5 w-full overflow-hidden rounded-full bg-slate-100">
          {termometro.map((e) => {
            const v = porGasto ? e.gasto : e.anuncios;
            return v > 0 ? <div key={e.key} title={`${e.label}: ${porGasto ? f.moneda(v) : v}`} style={{ width: `${(v / totalTermo) * 100}%`, background: e.color }} /> : null;
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
          {termometro.map((e) => (
            <span key={e.key} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: e.color }} />{e.label}: <b className="text-slate-700">{e.anuncios}</b>{porGasto && e.gasto > 0 && <> · {Math.round((e.gasto / totalTermo) * 100)}%</>}</span>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-slate-600">
          {bajoMonitoreo.length > 0 && <>{bajoMonitoreo.length} {bajoMonitoreo.length === 1 ? "rinde" : "rinden"} con señales de fatiga y se {bajoMonitoreo.length === 1 ? "monitorea" : "monitorean"} (no se apagan). </>}
          {proximos.find((a) => a.pred.estado === "proyectado") && (() => { const p = proximos.find((a) => a.pred.estado === "proyectado"); return <>Próximo en fatigarse: <b className="font-mono">{p.nombre}</b> en ~{p.pred.dias} días. </>; })()}
          Objetivo: {ctx.metrica === "roas" ? `ROAS ${f.decimal(ctx.objetivo)}` : `${f.moneda(ctx.objetivo)} por ${etiquetaRes.toLowerCase().replace(/s$/, "")}`}{ctx.objetivoEsPromedio && " (promedio de la cuenta)"}.
        </p>
      </Tarjeta>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {kpis.map((m) => {
          const d = delta(actual[m.key], previo[m.key]);
          const bueno = m.mejor == null || d == null || Math.abs(d) < 0.02 ? null : (d > 0) === (m.mejor === "sube");
          const dir = direcciones[m.key];
          const Icono = dir === "subiendo" ? ArrowUpRight : dir === "bajando" ? ArrowDownRight : Minus;
          return (
            <div key={m.key} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400" title={m.label}>{m.label}</div>
              <div className="mt-1 text-[18px] font-extrabold leading-tight text-slate-800">{f.tipo(m.tipo, actual[m.key])}</div>
              <div className="flex items-center gap-1 text-[11px]">
                <span className={bueno == null ? "text-slate-400" : bueno ? "text-emerald-600" : "text-rose-600"}>{signo(d)}</span>
                <span className="flex items-center text-slate-400" title="Dirección dentro del periodo"><Icono size={12} />{dir}</span>
              </div>
              <Sparkline valores={res.serieActual.map((x) => x[m.key])} color={bueno === false ? "#e11d48" : "#0d9488"} />
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="¿El alcance sigue al presupuesto?" className="lg:col-span-2">
          <div className={`mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] ${alcance.estado === "alerta" ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-600"}`}>
            {alcance.estado === "alerta" ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <Info size={14} className="mt-0.5 shrink-0" />}
            <span>{alcance.texto}{alcance.dInv != null && <> Inversión {signo(alcance.dInv)}, alcance {signo(alcance.dAlc)}, CPM de la cuenta {signo(res.deltaCpmCuenta)}.</>}</span>
          </div>
          <Grafico config={graficos.alcance} height={220} />
        </Tarjeta>
        <Tarjeta titulo={porGasto ? "Inversión por etapa" : "Anuncios por etapa"}>
          <Grafico config={graficos.dona} height={250} />
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Tendencia vs periodo anterior" extra={
          <select value={metricaTend} onChange={(e) => setMetricaTend(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px]">
            {METRICAS_CUENTA.filter((m) => m.key !== "impresiones" && m.key !== "resultados").map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        }>
          <Grafico config={graficos.tendencia} height={260} />
        </Tarjeta>
        <Tarjeta titulo="Matriz fatiga vs rendimiento">
          <Grafico config={graficos.matriz} height={260} />
          <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-slate-500">
            <span>↖ Arriba izq.: mantener y escalar</span><span>↗ Arriba der.: rinde con fatiga, vigilar</span>
            <span>↙ Abajo izq.: no es fatiga, revisar mensaje</span><span>↘ Abajo der.: apagar y reemplazar</span>
            <span className="col-span-2">Tamaño = inversión · rombo = sin datos de rendimiento</span>
          </div>
        </Tarjeta>
      </div>

      {/* Línea de tiempo */}
      <Tarjeta titulo="¿Cuándo se fatiga cada uno?">
        {proximos.length === 0 && <p className="text-[12px] text-slate-400">Ningún anuncio tiene una tendencia de caída proyectable.</p>}
        <div className="space-y-1.5">
          {proximos.slice(0, 15).map((a) => {
            const dias = a.pred.estado === "cruzo" ? 0 : Math.min(a.pred.dias, 60);
            return (
              <button key={a.id} onClick={() => setSel(a.id)} className="flex w-full items-center gap-3 rounded-md px-1 py-0.5 text-left hover:bg-slate-50">
                <span className="w-64 shrink-0 truncate font-mono text-[11px] text-slate-600" title={a.nombre}>{a.nombre}</span>
                <div className="relative h-3 flex-1 rounded-full bg-slate-100">
                  {a.pred.estado === "cruzo"
                    ? <div className="absolute inset-y-0 left-0 w-2 rounded-full bg-rose-600" />
                    : <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(dias / 60) * 100}%`, background: dias <= 10 ? "#f97316" : dias <= 30 ? "#fdba74" : "#10b981", opacity: a.pred.confianza === "baja" ? 0.45 : 1 }} />}
                </div>
                <span className="w-32 shrink-0 text-right text-[11px] text-slate-500">
                  {a.pred.estado === "cruzo" ? "ya cruzó" : a.pred.estado === "lejano" ? "> 60 días" : `~${a.pred.dias} días`}{a.pred.confianza && a.pred.estado !== "cruzo" ? ` · ${a.pred.confianza}` : ""}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-slate-400">Extrapolación lineal de las últimas 3 semanas; con confianza baja (barra tenue) tómala como señal, no como fecha. La fatiga suele acelerarse al final.</p>
      </Tarjeta>

      {/* Tabla */}
      <Tarjeta titulo="Índice por anuncio">
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-[12px]">
            <thead className="border-b border-slate-100">
              <tr>
                <Th k="nombre">Anuncio</Th><Th k="indice">Etapa · índice</Th><Th k="rend">Rendimiento</Th><Th k="gasto">Inversión</Th>
                <Th k="ctr">CTR</Th><Th k="dctr">Δ CTR</Th><Th k="frecuencia">Frec.</Th><Th k="dias">Fatiga en</Th>
                <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filasTabla.map((a) => {
                const dctr = delta(a.actual.ctr, a.previo.ctr);
                return (
                  <tr key={a.id} onClick={() => setSel(a.id)} className="cursor-pointer hover:bg-slate-50">
                    <td className="max-w-[260px] px-3 py-2"><div className="truncate font-mono text-[11px] text-slate-700" title={a.nombre}>{a.nombre}</div><div className="truncate text-[10px] text-slate-400">{a.campana}</div></td>
                    <td className="px-3 py-2"><div className="flex items-center gap-1.5"><Etiqueta etapa={a.etapa} />{a.indice != null && <b className="text-slate-700">{a.indice}</b>}</div></td>
                    <td className="px-3 py-2" style={{ color: REND_COLOR[a.rend.estado] }}>{REND_LABEL[a.rend.estado]}{a.rend.ratio != null && a.rend.ratio > 0 && <span className="text-slate-400"> ×{a.rend.ratio.toFixed(2)}</span>}</td>
                    <td className="px-3 py-2 text-slate-600">{f.moneda(a.actual.gasto)}</td>
                    <td className="px-3 py-2 text-slate-600">{f.pct(a.actual.ctr)}</td>
                    <td className={`px-3 py-2 ${dctr == null ? "text-slate-400" : dctr < -0.05 ? "text-rose-600" : dctr > 0.05 ? "text-emerald-600" : "text-slate-500"}`}>{signo(dctr)}</td>
                    <td className="px-3 py-2 text-slate-600">{f.decimal(a.actual.frecuencia)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{a.etapa === "sin_datos" ? "—" : a.pred.estado === "cruzo" ? "ya cruzó" : a.pred.estado === "proyectado" ? `~${a.pred.dias} d` : a.pred.estado === "lejano" ? "> 60 d" : a.pred.estado === "estable" ? "estable" : "—"}</td>
                    <td className="max-w-[280px] px-3 py-2 text-slate-600"><div className="line-clamp-2">{a.accion}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      {/* Plan de acción */}
      <Tarjeta titulo="Plan de acción" extra={<span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">Demanda creativa: {demanda.reemplazos} reemplazos + {demanda.variantes} variantes</span>}>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {GRUPOS.filter((g) => g !== "Sin datos").map((g) => (
            <div key={g} className="rounded-xl bg-slate-50 p-2.5">
              <div className="mb-2 flex items-center justify-between text-[12px] font-bold text-slate-700">{g}<span className="rounded-full bg-white px-1.5 text-[10px] text-slate-500">{grupos[g].length}</span></div>
              <div className="space-y-1.5">
                {grupos[g].length === 0 && <p className="text-[11px] text-slate-400">—</p>}
                {grupos[g].map((a) => (
                  <button key={a.id} onClick={() => setSel(a.id)} className="block w-full rounded-lg bg-white p-2 text-left shadow-sm hover:ring-1 hover:ring-teal-200">
                    <div className="truncate font-mono text-[10px] font-bold text-slate-700" title={a.nombre}>{a.nombre}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{a.accion}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {grupos["Sin datos"].length > 0 && (
          <details className="mt-3 text-[11px] text-slate-500">
            <summary className="cursor-pointer font-semibold">{grupos["Sin datos"].length} sin datos suficientes</summary>
            <ul className="mt-1 space-y-0.5">{grupos["Sin datos"].map((a) => <li key={a.id}><span className="font-mono">{a.nombre}</span>: {a.motivo}</li>)}</ul>
          </details>
        )}
      </Tarjeta>

      <p className="px-1 text-[10px] leading-relaxed text-slate-400">
        Un anuncio que rinde no se apaga: se prepara relevo y se monitorea. El índice descuenta cambios de presupuesto y del CPM de la cuenta. La frecuencia usa el alcance diario sumado (sirve para tendencias, no es alcance único). Los datos no incluyen el creativo ni métricas del sitio: si el CTR se sostiene y cae la conversión, revisa el destino.
      </p>

      {seleccionado && <Detalle a={seleccionado} prep={prep} per={per} f={f} etiquetaRes={etiquetaRes} metrica={ctx.metrica} objetivo={ctx.objetivo} onClose={() => setSel(null)} />}
    </div>
  );
}
