import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Copy, Check, Trophy, X, ChevronLeft, ChevronRight, Pencil,
  Trash2, Film, Tag, LayoutGrid, TrendingUp, Award, Search, RotateCcw, Package,
  Lightbulb, Video, Image as ImageIcon, Layers, Sparkles, Star, ExternalLink,
  Upload, Link2, ArrowRight, Wand2, List, ArrowUpDown, RefreshCw
} from "lucide-react";
import { getSyncState, requestSync } from "./src/sync.js";

/* ---------------- helpers ---------------- */
const FONT = { fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" };

const STAGES = [
  { key: "guion",   label: "Guión",     hint: "Escrito, sin aprobar" },
  { key: "vo",      label: "Voz / VO",  hint: "Aprobado y generado" },
  { key: "edicion", label: "Edición",   hint: "En corte / montaje" },
  { key: "lanzado", label: "Lanzado",   hint: "En Meta / TikTok" },
  { key: "testing", label: "Testing",   hint: "Midiendo CPA real" },
  { key: "ganador", label: "Ganador",   hint: "Escala / itera" },
  { key: "muerto",  label: "Muerto",    hint: "Descartado" },
];
const STAGE_IDX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));
const STAGE_STYLE = {
  guion:   { dot: "#94a3b8", chip: "#f1f5f9", text: "#475569" },
  vo:      { dot: "#64748b", chip: "#f1f5f9", text: "#475569" },
  edicion: { dot: "#0ea5e9", chip: "#e0f2fe", text: "#0369a1" },
  lanzado: { dot: "#0d9488", chip: "#ccfbf1", text: "#0f766e" },
  testing: { dot: "#d97706", chip: "#fef3c7", text: "#b45309" },
  ganador: { dot: "#059669", chip: "#d1fae5", text: "#047857" },
  muerto:  { dot: "#e11d48", chip: "#ffe4e6", text: "#be123c" },
};

const PRODUCTOS = ["NOVAFLEX", "NOVAFIT", "KLYNEA", "XTRICK", "Nova Shop"];

/* --------- TAXONOMÍA (etiquetas controladas para el nombre del ad) --------- */
const FORMATOS = [
  { code: "UGC", label: "Creador con celular" },
  { code: "TESTI", label: "Testimonio a cámara" },
  { code: "DEMO", label: "Demostración de uso" },
  { code: "VSL", label: "Video sales letter" },
  { code: "ANTDES", label: "Antes / Después" },
  { code: "VOZOFF", label: "Voz en off + b-roll" },
  { code: "ESTATICA", label: "Imagen estática" },
  { code: "CARRU", label: "Carrusel" },
  { code: "GREEN", label: "Green screen / reacción" },
  { code: "UNBOX", label: "Unboxing" },
  { code: "HABLA", label: "Talking head" },
  { code: "SLIDE", label: "Slideshow" },
  { code: "MOTION", label: "Animación / motion" },
  { code: "SPLIT", label: "Split screen" },
  { code: "TREND", label: "Audio / trend viral" },
];
const CONCEPTOS = [
  { code: "PROBSOL", label: "Problema → Solución" },
  { code: "TRANSF", label: "Transformación personal" },
  { code: "HISTORIA", label: "Storytelling" },
  { code: "EDUCA", label: "Educativo / ¿Sabías que…?" },
  { code: "COMPARA", label: "Comparativa vs genéricas" },
  { code: "PRUEBA", label: "Prueba / demo en vivo" },
  { code: "LISTA", label: "Listicle / razones" },
  { code: "MIEDO", label: "Miedo / consecuencia" },
  { code: "AUTORIDAD", label: "Autoridad / experto" },
  { code: "OBJECION", label: "Rompe-objeción" },
  { code: "OFERTA", label: "Oferta / urgencia" },
  { code: "POV", label: "POV / día en la vida" },
  { code: "RETO", label: "Reto / desafío" },
  { code: "SORPRESA", label: "Gancho de sorpresa / dato" },
  { code: "FAQ", label: "Pregunta frecuente" },
];
const ANGULOS = [
  { code: "DOLOR", label: "Alivio del dolor" },
  { code: "PREVENCION", label: "Prevención de lesión" },
  { code: "ACTIVO", label: "Seguir activo / entrenar" },
  { code: "ESTETICA", label: "Verse / sentirse bien" },
  { code: "COMODIDAD", label: "Comodidad diaria" },
  { code: "PRECIO", label: "Precio / ahorro" },
  { code: "REGALO", label: "Regalo / para alguien" },
  { code: "PADRES", label: "Padre-hijo / protección" },
  { code: "PROFESIONAL", label: "Uso profesional / institucional" },
];
const F_MAP = Object.fromEntries(FORMATOS.map((x) => [x.code, x.label]));
const C_MAP = Object.fromEntries(CONCEPTOS.map((x) => [x.code, x.label]));
const A_MAP = Object.fromEntries(ANGULOS.map((x) => [x.code, x.label]));
const labelF = (c) => F_MAP[c] || c;
const labelC = (c) => C_MAP[c] || c;
const labelA = (c) => A_MAP[c] || c;

const token = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const todayStr = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };
const buildAdName = (a, seq) =>
  `AD_${token(a.producto) || "NA"}_${a.formato || "NA"}_${a.ccr || "NA"}_${token(a.angulo) || "NA"}_${String(seq).padStart(3, "0")}_${a.variant || "A"}`;
const scriptCompleto = (a) => [a.hook, a.body, a.cta].filter(Boolean).join("\n\n");
const copyText = async (txt) => {
  try { await navigator.clipboard.writeText(txt); } catch { const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch {} document.body.removeChild(ta); }
};
const uid = () => Math.random().toString(36).slice(2, 9);
const fechaHora = (iso) => new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
// Estados en los que el ad ya existe en Meta y tiene sentido traer su inversión.
const SYNC_STAGES = ["lanzado", "testing", "ganador", "muerto"];

function fileToDataUrl(file, max = 640, quality = 0.72) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        res(c.toDataURL("image/jpeg", quality));
      };
      img.onerror = rej; img.src = e.target.result;
    };
    reader.onerror = rej; reader.readAsDataURL(file);
  });
}

/* ---------------- seed ---------------- */
const SEED_ADS = [
  { id: uid(), num: 1, fecha: "23/04/2026", concepto: "Entrenar a pesar del dolor", producto: "NOVAFLEX", formato: "UGC", ccr: "PROBSOL", angulo: "DOLOR", variant: "A", hook: "Me dolía el tobillo… pero no quería dejar de entrenar.", body: "Como entreno seguido, necesitaba algo que me dé más estabilidad. Así que probé esto… Se ajusta súper bien y sientes el tobillo mucho más firme. No molesta, es ligera… y puedes moverte normal. Ahora entreno con más confianza, sin preocuparme por el tobillo.", cta: "Si entrenas, de verdad deberías probar esto.", clips: "", notas: "", estado: "testing", spend: 180, pedidos: 9 },
  { id: uid(), num: 2, fecha: "23/04/2026", concepto: "Te hablo directo si te pasa esto", producto: "NOVAFLEX", formato: "UGC", ccr: "OBJECION", angulo: "DOLOR", variant: "A", hook: "Si te duele el tobillo al entrenar… esto te interesa.", body: "Entrenar así sin soporte puede hacer que empeore. A mí me pasaba seguido, hasta que empecé a usar esto. Se ajusta bien, sientes el tobillo firme y puedes moverte normal. Es ligera, no molesta y la uso para entrenar sin problema. Ahora me siento mucho más seguro en cada movimiento.", cta: "Si entrenas, de verdad deberías probar esto.", clips: "", notas: "", estado: "lanzado", spend: 90, pedidos: 3 },
  { id: uid(), num: 3, fecha: "23/04/2026", concepto: "Antes vs después", producto: "NOVAFLEX", formato: "ANTDES", ccr: "TRANSF", angulo: "ACTIVO", variant: "A", hook: "Esto me devolvió la estabilidad al entrenar.", body: "Antes sentía el tobillo inestable en cada movimiento. Entrenaba, pero no me sentía seguro. Empecé a usar esto… y se siente mucho más firme sin limitar el movimiento. Ahora puedo entrenar normal, con más confianza.", cta: "Si entrenas, de verdad deberías probar esto.", clips: "", notas: "", estado: "guion", spend: 0, pedidos: 0 },
  { id: uid(), num: 4, fecha: "23/04/2026", concepto: "Lesión más común en niños", producto: "NOVAFLEX", formato: "UGC", ccr: "EDUCA", angulo: "PADRES", variant: "A", hook: "¿Sabes cuál es la lesión más común en niños que juegan fútbol?", body: "Los esguinces de tobillo son una de las lesiones más frecuentes durante entrenamientos y partidos. Esta tobillera ayuda a estabilizar y proteger el tobillo de tu hijo.", cta: "Consigue la tuya aquí.", clips: "", notas: "Ángulo padres — probar público madres 30-45.", estado: "edicion", spend: 0, pedidos: 0 },
];
const SEED_REFS = [
  { id: uid(), fecha: todayStr(), titulo: "Testimonio corredor cámara en mano", tipo: "video", producto: "NOVAFLEX", angulo: "Dolor + Seguir activo", fuente: "TikTok", url: "", imgUrl: "", imgKey: "", rescatar: ["Hook", "Edición / ritmo"], notas: "Empieza mostrando el dolor en primeros 2s, luego el producto puesto. Ritmo rápido, cortes cada 2s.", tags: ["testimonio", "running"], rating: 4, estado: "probar" },
  { id: uid(), fecha: todayStr(), titulo: "“Ningún padre quiere ver esto”", tipo: "hook", producto: "NOVAFLEX", angulo: "Padre / hijo fútbol", fuente: "Propio", url: "", imgUrl: "", imgKey: "", rescatar: ["Hook", "Ángulo"], notas: "Gancho de miedo/protección. Probar con B-roll de niño cayendo en la cancha.", tags: ["padres"], rating: 5, estado: "nueva" },
  { id: uid(), fecha: todayStr(), titulo: "Estática competencia — precio tachado", tipo: "competencia", producto: "NOVAFLEX", angulo: "Oferta", fuente: "Biblioteca de anuncios", url: "", imgUrl: "", imgKey: "", rescatar: ["Formato visual", "Oferta"], notas: "Layout con precio antes/después grande y sello de garantía. Copiar estructura, no el diseño.", tags: ["estatica", "oferta"], rating: 3, estado: "nueva" },
];

const ADKEY = "nova-ads:all:v1";
const REFKEY = "nova-refs:list:v1";
const imgKeyFor = (id) => `nova-refimg:${id}`;

/* ---------------- small UI ---------------- */
function Chip({ children, bg = "#f1f5f9", color = "#475569", icon }) {
  return <span style={{ background: bg, color }} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">{icon}{children}</span>;
}
function Stars({ value, onChange, size = 14 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={onChange ? () => onChange(n) : undefined} disabled={!onChange} className={onChange ? "cursor-pointer" : "cursor-default"}>
          <Star size={size} className={n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
        </button>
      ))}
    </div>
  );
}

/* ============================================================ SCRIPT CARD */
function Card({ ad, seq, onStage, onEdit, onDup, onCopy, copiedId }) {
  const idx = STAGE_IDX[ad.estado];
  const isTerminal = ad.estado === "ganador" || ad.estado === "muerto";
  const cpa = ad.pedidos > 0 ? ad.spend / ad.pedidos : null;
  const nombre = buildAdName(ad, ad.num);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md hover:border-slate-300">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Chip bg="#0f172a" color="#fff">SCR_{String(ad.num).padStart(3, "0")}</Chip>
        <Chip icon={<Package size={11} />}>{ad.producto}</Chip>
      </div>
      <div className="text-[13px] font-bold leading-snug text-slate-800">{ad.concepto}</div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Chip bg="#eef2ff" color="#4338ca" icon={<Film size={11} />}>{labelF(ad.formato)}</Chip>
        <Chip bg="#fef3c7" color="#b45309" icon={<Wand2 size={11} />}>{labelC(ad.ccr)}</Chip>
        <Chip bg="#ccfbf1" color="#0f766e" icon={<Tag size={11} />}>{labelA(ad.angulo)}</Chip>
      </div>
      <p className="mt-2 line-clamp-2 text-[11.5px] italic leading-snug text-slate-500">“{ad.hook}”</p>
      <div className="mt-2 truncate rounded bg-slate-900 px-2 py-1 font-mono text-[10px] text-teal-300" title={nombre}>{nombre}</div>
      {(cpa !== null || ad.spend > 0) && (
        <div className="mt-2 flex items-center gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px]">
          <span className="text-slate-500">Inv: <b className="text-slate-700">S/{ad.spend}</b></span>
          <span className="text-slate-500">Conf: <b className="text-slate-700">{ad.pedidos}</b></span>
          <span className="ml-auto font-bold" style={{ color: cpa !== null && cpa <= 25 ? "#059669" : "#b45309" }}>CPA {cpa !== null ? `S/${cpa.toFixed(1)}` : "—"}</span>
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-1 border-t border-slate-100 pt-2">
        {!isTerminal && (
          <>
            <button onClick={() => onStage(ad, STAGES[Math.max(0, idx - 1)].key)} disabled={idx === 0} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30" title="Retroceder"><ChevronLeft size={15} /></button>
            {ad.estado === "testing" ? (
              <>
                <button onClick={() => onStage(ad, "ganador")} className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"><Trophy size={12} /> Ganó</button>
                <button onClick={() => onStage(ad, "muerto")} className="flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-100"><X size={12} /> Murió</button>
              </>
            ) : (
              <button onClick={() => onStage(ad, STAGES[Math.min(4, idx + 1)].key)} className="flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-teal-700">Avanzar <ChevronRight size={13} /></button>
            )}
          </>
        )}
        {isTerminal && (
          <button onClick={() => onStage(ad, "testing")} className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200"><RotateCcw size={12} /> Reabrir</button>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <button onClick={() => onCopy(ad)} title="Copiar nombre + guión" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">{copiedId === ad.id ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}</button>
          <button onClick={() => onDup(ad)} title="Duplicar / iterar" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Award size={15} /></button>
          <button onClick={() => onEdit(ad)} title="Editar" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil size={15} /></button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ SCRIPT EDITOR */
function Editor({ ad, initial, nextNum, onSave, onDelete, onClose }) {
  const base = ad || {
    id: uid(), num: nextNum, fecha: todayStr(), concepto: "", producto: "NOVAFLEX",
    formato: "UGC", ccr: "PROBSOL", angulo: "DOLOR", variant: "A",
    hook: "", body: "", cta: "", clips: "", notas: "", estado: "guion", spend: 0, pedidos: 0, ...(initial || {}),
  };
  const [f, setF] = useState(base);
  const [otro, setOtro] = useState(!!(base.angulo && !ANGULOS.some((a) => a.code === base.angulo)));
  const [nameCopied, setNameCopied] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const nombre = buildAdName(f, f.num);
  const guion = scriptCompleto(f);

  const copyName = async () => {
    await copyText(nombre);
    setNameCopied(true); setTimeout(() => setNameCopied(false), 1400);
  };
  const copyScript = async () => {
    await copyText(guion);
    setScriptCopied(true); setTimeout(() => setScriptCopied(false), 1400);
  };

  const field = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
  const lbl = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500";

  const segs = [
    { k: "Prefijo", v: "AD" },
    { k: "Producto", v: token(f.producto) || "NA" },
    { k: "Formato", v: f.formato || "NA" },
    { k: "Concepto", v: f.ccr || "NA" },
    { k: "Ángulo", v: token(f.angulo) || "NA" },
    { k: "Sec.", v: String(f.num).padStart(3, "0") },
    { k: "Var.", v: f.variant || "A" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm" style={FONT}>
      <div className="my-4 w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-[15px] font-bold text-slate-800">{ad ? "Editar guión" : "Nuevo guión"}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div><label className={lbl}>Idea / concepto interno</label><input className={field} value={f.concepto} onChange={(e) => set("concepto", e.target.value)} placeholder="Nombre corto para reconocerlo (ej: Antes vs después)" /></div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Etiquetas del ad — arman el nombre</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2 sm:col-span-1"><label className={lbl}>Producto</label><select className={field} value={f.producto} onChange={(e) => set("producto", e.target.value)}>{PRODUCTOS.map((p) => <option key={p}>{p}</option>)}</select></div>
              <div className="col-span-2 sm:col-span-1"><label className={lbl}>Variante</label><select className={field} value={f.variant} onChange={(e) => set("variant", e.target.value)}>{["A", "B", "C", "D"].map((p) => <option key={p}>{p}</option>)}</select></div>
              <div className="col-span-2"><label className={lbl}>Formato</label><select className={field} value={f.formato} onChange={(e) => set("formato", e.target.value)}>{FORMATOS.map((x) => <option key={x.code} value={x.code}>{x.code} · {x.label}</option>)}</select></div>
              <div className="col-span-2"><label className={lbl}>Concepto creativo</label><select className={field} value={f.ccr} onChange={(e) => set("ccr", e.target.value)}>{CONCEPTOS.map((x) => <option key={x.code} value={x.code}>{x.code} · {x.label}</option>)}</select></div>
              <div className="col-span-2"><label className={lbl}>Ángulo de venta</label>
                <select className={field} value={otro ? "__OTRO__" : f.angulo}
                  onChange={(e) => { if (e.target.value === "__OTRO__") { setOtro(true); set("angulo", ""); } else { setOtro(false); set("angulo", e.target.value); } }}>
                  {ANGULOS.map((x) => <option key={x.code} value={x.code}>{x.code} · {x.label}</option>)}
                  <option value="__OTRO__">Otro (escribir)…</option>
                </select>
                {otro && <input className={field + " mt-2"} value={f.angulo} onChange={(e) => set("angulo", token(e.target.value))} placeholder="NUEVOANGULO (sin espacios)" />}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Guión</div>
              <button onClick={copyScript} disabled={!guion} className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-teal-700 ring-1 ring-slate-200 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40">{scriptCopied ? <Check size={12} /> : <Copy size={12} />} {scriptCopied ? "Copiado" : "Copiar guión"}</button>
            </div>
            <div className="mb-3"><label className={lbl}>Hook · 0–3s</label><textarea rows={2} className={field} value={f.hook} onChange={(e) => set("hook", e.target.value)} placeholder="Lo primero que detiene el scroll" /></div>
            <div className="mb-3"><label className={lbl}>Body · 3–12s</label><textarea rows={4} className={field} value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="Desarrollo, prueba, cómo se siente" /></div>
            <div><label className={lbl}>CTA · 12–15s</label><textarea rows={2} className={field} value={f.cta} onChange={(e) => set("cta", e.target.value)} placeholder="La llamada a la acción" /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Inversión (S/)</label><input type="number" className={field} value={f.spend} onChange={(e) => set("spend", +e.target.value || 0)} /></div>
            <div><label className={lbl}>Pedidos confirmados</label><input type="number" className={field} value={f.pedidos} onChange={(e) => set("pedidos", +e.target.value || 0)} /></div>
          </div>
          <p className="-mt-2 text-[11px] text-slate-400">CPA real = inversión ÷ pedidos confirmados (no “pagos iniciados” ni CPA de Meta).</p>
          {f.meta && (
            <div className="-mt-1 rounded-lg bg-sky-50 px-3 py-2 text-[11px] text-sky-800">
              <span className="font-bold">Meta ({f.meta.periodo || "sin periodo"}):</span>{" "}
              inversión S/ {Number(f.spend).toFixed(2)}
              {f.meta.compras != null && <> · {f.meta.compras} compras según Meta</>}
              {f.meta.impresiones != null && <> · {f.meta.impresiones.toLocaleString("es-PE")} impresiones</>}
              {f.meta.ctr != null && <> · CTR {f.meta.ctr}%</>}
              <span className="text-sky-600"> · sincronizado {fechaHora(f.meta.syncedAt)}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={lbl}>Clips usados</label><input className={field} value={f.clips} onChange={(e) => set("clips", e.target.value)} placeholder="Opcional" /></div>
            <div><label className={lbl}>Notas</label><input className={field} value={f.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Opcional" /></div>
          </div>

          {/* NOMBRE AUTO */}
          <div className="rounded-xl bg-slate-900 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Nombre del ad · llave de sincronización con IA</div>
              <button onClick={copyName} className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-teal-300 hover:bg-white/20">{nameCopied ? <Check size={12} /> : <Copy size={12} />} {nameCopied ? "Copiado" : "Copiar"}</button>
            </div>
            <div className="mt-2 break-all font-mono text-[13px] text-teal-300">{nombre}</div>
            <div className="mt-2.5 flex flex-wrap gap-1">
              {segs.map((s, i) => (
                <div key={i} className="rounded-md bg-white/5 px-2 py-1 text-center">
                  <div className="text-[8px] uppercase tracking-wide text-slate-500">{s.k}</div>
                  <div className="font-mono text-[11px] font-bold text-slate-200">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3.5">
          {ad && <button onClick={() => onDelete(ad)} className="flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-semibold text-rose-600 hover:bg-rose-50"><Trash2 size={15} /> Eliminar</button>}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button onClick={() => onSave({ ...f, nombre })} disabled={!f.concepto.trim()} className="rounded-lg bg-teal-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-teal-700 disabled:opacity-40">Guardar guión</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ REFERENCE CARD */
const REF_TIPOS = [
  { key: "idea", label: "Idea", Icon: Lightbulb, color: "#4338ca", chip: "#eef2ff" },
  { key: "video", label: "Video ref.", Icon: Video, color: "#0f766e", chip: "#ccfbf1" },
  { key: "imagen", label: "Imagen ad", Icon: ImageIcon, color: "#b45309", chip: "#fef3c7" },
  { key: "competencia", label: "Competencia", Icon: Layers, color: "#be123c", chip: "#ffe4e6" },
  { key: "hook", label: "Hook suelto", Icon: Sparkles, color: "#0369a1", chip: "#e0f2fe" },
];
const REF_TIPO_MAP = Object.fromEntries(REF_TIPOS.map((t) => [t.key, t]));
const FUENTES = ["TikTok", "Meta / Facebook", "Instagram", "YouTube", "Biblioteca de anuncios", "Competencia", "Propio", "Otro"];
const RESCATAR = ["Hook", "Edición / ritmo", "CTA", "Oferta", "Copy", "Formato visual", "Audio / música", "Ángulo"];
const REF_ESTADOS = [
  { key: "nueva", label: "Nueva", color: "#4338ca", chip: "#eef2ff" },
  { key: "probar", label: "Por probar", color: "#b45309", chip: "#fef3c7" },
  { key: "convertida", label: "Convertida", color: "#047857", chip: "#d1fae5" },
  { key: "descartada", label: "Descartada", color: "#64748b", chip: "#f1f5f9" },
];
const REF_ESTADO_MAP = Object.fromEntries(REF_ESTADOS.map((e) => [e.key, e]));

function RefCard({ r, thumb, onEdit, onConvert, onState, onOpenImg }) {
  const t = REF_TIPO_MAP[r.tipo];
  const est = REF_ESTADO_MAP[r.estado];
  const src = r.imgUrl || thumb;
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      {src ? (
        <button onClick={() => onOpenImg(src)} className="relative h-40 w-full overflow-hidden bg-slate-100">
          <img src={src} alt={r.titulo} className="h-full w-full object-cover" />
          <span className="absolute left-2 top-2"><Chip bg={t.chip} color={t.color} icon={<t.Icon size={11} />}>{t.label}</Chip></span>
        </button>
      ) : (
        <div className="flex h-16 items-center gap-2 px-3" style={{ background: t.chip }}>
          <t.Icon size={18} style={{ color: t.color }} />
          <span className="text-[12px] font-bold" style={{ color: t.color }}>{t.label}</span>
        </div>
      )}
      <div className="flex flex-1 flex-col p-3">
        <div className="text-[13px] font-bold leading-snug text-slate-800">{r.titulo}</div>
        <div className="mt-1"><Stars value={r.rating} /></div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {r.producto && <Chip icon={<Package size={11} />}>{r.producto}</Chip>}
          {r.angulo && <Chip bg="#ccfbf1" color="#0f766e" icon={<Tag size={11} />}>{r.angulo}</Chip>}
          {r.fuente && <Chip bg="#f1f5f9" color="#475569">{r.fuente}</Chip>}
        </div>
        {r.rescatar?.length > 0 && (
          <div className="mt-2">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Qué rescatar</div>
            <div className="mt-1 flex flex-wrap gap-1">{r.rescatar.map((x) => <Chip key={x} bg="#eef2ff" color="#4338ca">{x}</Chip>)}</div>
          </div>
        )}
        {r.notas && <p className="mt-2 text-[11.5px] leading-snug text-slate-500">{r.notas}</p>}
        {r.tags?.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{r.tags.map((x) => <span key={x} className="text-[10px] text-slate-400">#{x}</span>)}</div>}
        <div className="mt-auto flex items-center gap-1 border-t border-slate-100 pt-2.5">
          <select value={r.estado} onChange={(e) => onState(r, e.target.value)} style={{ background: est.chip, color: est.color }} className="rounded-md px-1.5 py-1 text-[11px] font-bold outline-none">
            {REF_ESTADOS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
          {r.url && <a href={r.url} target="_blank" rel="noreferrer" title="Abrir link" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><ExternalLink size={15} /></a>}
          <div className="ml-auto flex items-center gap-0.5">
            <button onClick={() => onConvert(r)} title="Convertir en guión" className="flex items-center gap-1 rounded-md bg-teal-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-teal-700"><ArrowRight size={12} /> A guión</button>
            <button onClick={() => onEdit(r)} title="Editar" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ REFERENCE EDITOR */
function RefEditor({ ref0, thumb, onSave, onDelete, onClose }) {
  const [f, setF] = useState(ref0 || {
    id: uid(), fecha: todayStr(), titulo: "", tipo: "idea", producto: "NOVAFLEX", angulo: "",
    fuente: "TikTok", url: "", imgUrl: "", imgKey: "", rescatar: [], notas: "", tags: [], rating: 3, estado: "nueva",
  });
  const [preview, setPreview] = useState(ref0 ? (ref0.imgUrl || thumb || "") : "");
  const [newImgData, setNewImgData] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleR = (x) => set("rescatar", f.rescatar.includes(x) ? f.rescatar.filter((y) => y !== x) : [...f.rescatar, x]);

  const handleFile = async (file) => {
    if (!file) return; setBusy(true);
    try { const d = await fileToDataUrl(file); setNewImgData(d); setPreview(d); set("imgUrl", ""); } catch {}
    setBusy(false);
  };
  const handlePaste = (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (item) { e.preventDefault(); handleFile(item.getAsFile()); }
  };
  const field = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
  const lbl = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm" style={FONT} onPaste={handlePaste}>
      <div className="my-4 w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-[15px] font-bold text-slate-800">{ref0 ? "Editar referencia" : "Nueva referencia"}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className={lbl}>Tipo</label>
            <div className="flex flex-wrap gap-1.5">
              {REF_TIPOS.map((t) => (
                <button key={t.key} onClick={() => set("tipo", t.key)} style={f.tipo === t.key ? { background: t.color, color: "#fff" } : {}} className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ${f.tipo === t.key ? "" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  <t.Icon size={13} /> {t.label}
                </button>
              ))}
            </div>
          </div>
          <div><label className={lbl}>Título / descripción corta</label><input className={field} value={f.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ej: Testimonio corredor cámara en mano" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Producto</label><select className={field} value={f.producto} onChange={(e) => set("producto", e.target.value)}>{PRODUCTOS.map((p) => <option key={p}>{p}</option>)}</select></div>
            <div><label className={lbl}>Fuente / plataforma</label><select className={field} value={f.fuente} onChange={(e) => set("fuente", e.target.value)}>{FUENTES.map((p) => <option key={p}>{p}</option>)}</select></div>
          </div>
          <div><label className={lbl}>Ángulo de venta</label><input className={field} value={f.angulo} onChange={(e) => set("angulo", e.target.value)} placeholder="Ej: Dolor + Seguir activo" /></div>
          <div>
            <label className={lbl}>Link del video / anuncio</label>
            <div className="relative"><Link2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className={field + " pl-8"} value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" /></div>
          </div>
          <div>
            <label className={lbl}>Imagen / miniatura</label>
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="preview" className="max-h-48 w-full rounded-lg object-contain" />
                  <button onClick={() => { setPreview(""); setNewImgData("__clear__"); set("imgUrl", ""); }} className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-slate-500 shadow hover:text-rose-600"><X size={14} /></button>
                </div>
              ) : (
                <div className="text-center">
                  <button onClick={() => fileRef.current?.click()} disabled={busy} className="mx-auto flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-100"><Upload size={15} /> {busy ? "Procesando…" : "Subir imagen"}</button>
                  <p className="mt-2 text-[11px] text-slate-400">o pega una captura (Ctrl+V) · o usa una URL abajo</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              <input className={field + " mt-2"} value={f.imgUrl} onChange={(e) => { set("imgUrl", e.target.value); setPreview(e.target.value); setNewImgData(null); }} placeholder="URL de imagen externa (opcional)" />
            </div>
          </div>
          <div>
            <label className={lbl}>Qué rescatar de esta referencia</label>
            <div className="flex flex-wrap gap-1.5">
              {RESCATAR.map((x) => (
                <button key={x} onClick={() => toggleR(x)} className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold ${f.rescatar.includes(x) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{x}</button>
              ))}
            </div>
          </div>
          <div><label className={lbl}>Notas — por qué funciona / qué copiar</label><textarea rows={3} className={field} value={f.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Ej: Hook de miedo en 2s, cortes rápidos, precio tachado grande…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Tags (coma)</label><input className={field} value={(f.tags || []).join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="running, oferta" /></div>
            <div><label className={lbl}>Prioridad</label><div className="pt-1.5"><Stars value={f.rating} onChange={(n) => set("rating", n)} size={20} /></div></div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3.5">
          {ref0 && <button onClick={() => onDelete(ref0)} className="flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-semibold text-rose-600 hover:bg-rose-50"><Trash2 size={15} /> Eliminar</button>}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button onClick={() => onSave(f, newImgData)} disabled={!f.titulo.trim()} className="rounded-lg bg-teal-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-teal-700 disabled:opacity-40">Guardar referencia</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ SCRIPT TABLE (vista lista) */
function ScriptTable({ ads, sort, onSort, onEdit, onStage, onDup, onCopy, copiedId }) {
  const Th = ({ k, children, right }) => (
    <th className={`sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 ${right ? "text-right" : "text-left"}`}>
      {k ? (
        <button onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-slate-700">
          {children}<ArrowUpDown size={11} className={sort.key === k ? "text-teal-600" : "text-slate-300"} />
        </button>
      ) : children}
    </th>
  );
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr>
            <Th k="num">ID</Th>
            <Th k="concepto">Idea</Th>
            <Th k="producto">Prod.</Th>
            <Th k="formato">Formato</Th>
            <Th k="ccr">Concepto</Th>
            <Th k="angulo">Ángulo</Th>
            <Th>Hook</Th>
            <Th k="estado">Etapa</Th>
            <Th>Nombre del ad</Th>
            <Th k="cpa" right>CPA</Th>
            <Th>Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {ads.length === 0 && <tr><td colSpan={11} className="px-3 py-8 text-center text-slate-400">Sin guiones</td></tr>}
          {ads.map((ad, i) => {
            const cpa = ad.pedidos > 0 ? ad.spend / ad.pedidos : null;
            const s = STAGE_STYLE[ad.estado];
            return (
              <tr key={ad.id} className={`border-t border-slate-100 hover:bg-teal-50/40 ${i % 2 ? "bg-slate-50/50" : ""}`}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] font-bold text-slate-500">SCR_{String(ad.num).padStart(3, "0")}</td>
                <td className="px-3 py-2 font-semibold text-slate-800"><button onClick={() => onEdit(ad)} className="text-left hover:text-teal-700">{ad.concepto}</button></td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{ad.producto}</td>
                <td className="whitespace-nowrap px-3 py-2"><Chip bg="#eef2ff" color="#4338ca">{labelF(ad.formato)}</Chip></td>
                <td className="whitespace-nowrap px-3 py-2"><Chip bg="#fef3c7" color="#b45309">{labelC(ad.ccr)}</Chip></td>
                <td className="whitespace-nowrap px-3 py-2"><Chip bg="#ccfbf1" color="#0f766e">{labelA(ad.angulo)}</Chip></td>
                <td className="max-w-[220px] truncate px-3 py-2 italic text-slate-500" title={ad.hook}>{ad.hook}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <select value={ad.estado} onChange={(e) => onStage(ad, e.target.value)} style={{ background: s.chip, color: s.text }} className="rounded-md px-1.5 py-1 text-[11px] font-bold outline-none">
                    {STAGES.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
                  </select>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[10px] text-slate-500">{buildAdName(ad, ad.num)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-bold" style={{ color: cpa !== null && cpa <= 25 ? "#059669" : cpa !== null ? "#b45309" : "#94a3b8" }}>{cpa !== null ? `S/${cpa.toFixed(1)}` : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => onCopy(ad)} title="Copiar" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">{copiedId === ad.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}</button>
                    <button onClick={() => onDup(ad)} title="Duplicar" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Award size={14} /></button>
                    <button onClick={() => onEdit(ad)} title="Editar" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil size={14} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================ APP */
export default function App() {
  const [ads, setAds] = useState([]);
  const [refs, setRefs] = useState([]);
  const [imgCache, setImgCache] = useState({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("pipeline");
  const [pipeMode, setPipeMode] = useState("board");
  const [sort, setSort] = useState({ key: "num", dir: "asc" });

  const [editing, setEditing] = useState(null);
  const [initial, setInitial] = useState(null);
  const [openEditor, setOpenEditor] = useState(false);
  const [convertRefId, setConvertRefId] = useState(null);

  const [refEditing, setRefEditing] = useState(null);
  const [openRef, setOpenRef] = useState(false);

  const [copiedId, setCopiedId] = useState(null);
  const [q, setQ] = useState("");
  const [prodFilter, setProdFilter] = useState("Todos");
  const [refTipoFilter, setRefTipoFilter] = useState("todas");
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const a = await window.storage.get(ADKEY);
        if (a && a.value) setAds(JSON.parse(a.value));
        else { setAds(SEED_ADS); await window.storage.set(ADKEY, JSON.stringify(SEED_ADS), false); }
      } catch { setAds(SEED_ADS); try { await window.storage.set(ADKEY, JSON.stringify(SEED_ADS), false); } catch {} }
      let refList = SEED_REFS;
      try {
        const r = await window.storage.get(REFKEY);
        if (r && r.value) refList = JSON.parse(r.value);
        else await window.storage.set(REFKEY, JSON.stringify(SEED_REFS), false);
      } catch { try { await window.storage.set(REFKEY, JSON.stringify(SEED_REFS), false); } catch {} }
      setRefs(refList);
      const cache = {};
      await Promise.all(refList.filter((x) => x.imgKey).map(async (x) => {
        try { const g = await window.storage.get(x.imgKey); if (g && g.value) cache[x.id] = g.value; } catch {}
      }));
      setImgCache(cache);
      setLoading(false);
    })();
  }, []);

  /* ---- sincronización con Meta: la app pide, Claude responde ---- */
  const [sync, setSync] = useState(null);
  const [syncErr, setSyncErr] = useState("");
  const syncActive = sync?.status === "pendiente" || sync?.status === "procesando";
  useEffect(() => { getSyncState().then(setSync).catch(() => {}); }, []);
  useEffect(() => {
    if (!syncActive) return;
    const t = setInterval(async () => {
      try {
        const s = await getSyncState();
        setSync(s);
        // El servidor ya escribió los ads: recargar para no pisarlos después.
        if (s.status === "listo") {
          const a = await window.storage.get(ADKEY);
          if (a && a.value) setAds(JSON.parse(a.value));
        }
      } catch {}
    }, 4000);
    return () => clearInterval(t);
  }, [syncActive]);
  const handleSync = async () => {
    setSyncErr("");
    const lanzados = ads.filter((a) => SYNC_STAGES.includes(a.estado)).map((a) => ({ id: a.id, nombre: buildAdName(a, a.num) }));
    if (!lanzados.length) { setSyncErr("No hay ads en Lanzado, Testing, Ganador o Muerto"); return; }
    try { setSync(await requestSync(lanzados)); } catch (e) { setSyncErr(e.message); }
  };
  const syncText = syncErr ? syncErr
    : sync?.status === "pendiente" ? "Esperando a Claude…"
    : sync?.status === "procesando" ? "Claude sincronizando…"
    : sync?.status === "listo" ? `${sync.updated}/${sync.total} ads · ${fechaHora(sync.finishedAt)}`
    : sync?.status === "error" ? `Error: ${sync.error}`
    : "";
  const syncTitle = sync?.status === "listo" && sync.notFound?.length
    ? `No encontrados en Meta:\n${sync.notFound.join("\n")}`
    : "Pide a Claude que traiga la inversión de Meta de los ads lanzados";

  const persistAds = (next) => { setAds(next); window.storage.set(ADKEY, JSON.stringify(next), false).catch(() => {}); };
  const persistRefs = (next) => { setRefs(next); window.storage.set(REFKEY, JSON.stringify(next), false).catch(() => {}); };
  const nextNum = useMemo(() => (ads.length ? Math.max(...ads.map((a) => a.num || 0)) + 1 : 1), [ads]);

  const filteredAds = useMemo(() => {
    const t = q.trim().toLowerCase();
    return ads.filter((a) => {
      if (prodFilter !== "Todos" && a.producto !== prodFilter) return false;
      if (!t) return true;
      return [a.concepto, a.angulo, a.formato, a.ccr, a.hook, a.body].join(" ").toLowerCase().includes(t);
    });
  }, [ads, q, prodFilter]);

  const handleSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));
  const sortedAds = useMemo(() => {
    const arr = [...filteredAds];
    const { key, dir } = sort; const mul = dir === "asc" ? 1 : -1;
    const val = (a) => {
      if (key === "cpa") return a.pedidos > 0 ? a.spend / a.pedidos : Infinity;
      if (key === "estado") return STAGE_IDX[a.estado];
      if (key === "num") return a.num;
      if (key === "formato") return labelF(a.formato);
      if (key === "ccr") return labelC(a.ccr);
      if (key === "angulo") return labelA(a.angulo);
      return (a[key] || "").toString().toLowerCase();
    };
    arr.sort((a, b) => { const va = val(a), vb = val(b); if (va < vb) return -1 * mul; if (va > vb) return 1 * mul; return 0; });
    return arr;
  }, [filteredAds, sort]);

  const handleStage = (ad, estado) => persistAds(ads.map((x) => (x.id === ad.id ? { ...x, estado } : x)));
  const handleSaveAd = (ad) => {
    const exists = ads.some((x) => x.id === ad.id);
    persistAds(exists ? ads.map((x) => (x.id === ad.id ? ad : x)) : [...ads, ad]);
    if (convertRefId) { persistRefs(refs.map((r) => (r.id === convertRefId ? { ...r, estado: "convertida" } : r))); setConvertRefId(null); }
    setOpenEditor(false); setEditing(null); setInitial(null);
  };
  const handleDeleteAd = (ad) => { persistAds(ads.filter((x) => x.id !== ad.id)); setOpenEditor(false); setEditing(null); };
  const handleDup = (ad) => persistAds([...ads, { ...ad, id: uid(), num: nextNum, fecha: todayStr(), estado: "guion", concepto: ad.concepto + " (v2)", variant: "B", spend: 0, pedidos: 0 }]);
  const handleCopy = async (ad) => {
    const txt = `${buildAdName(ad, ad.num)}\n\n${ad.concepto}\nFormato: ${labelF(ad.formato)} · Concepto: ${labelC(ad.ccr)} · Ángulo: ${labelA(ad.angulo)}\n\n${scriptCompleto(ad)}`;
    await copyText(txt);
    setCopiedId(ad.id); setTimeout(() => setCopiedId(null), 1400);
  };

  const filteredRefs = useMemo(() => {
    const t = q.trim().toLowerCase();
    return refs.filter((r) => {
      if (refTipoFilter !== "todas" && r.tipo !== refTipoFilter) return false;
      if (prodFilter !== "Todos" && r.producto !== prodFilter) return false;
      if (!t) return true;
      return [r.titulo, r.angulo, r.notas, (r.tags || []).join(" ")].join(" ").toLowerCase().includes(t);
    });
  }, [refs, q, prodFilter, refTipoFilter]);

  const handleSaveRef = async (r, newImgData) => {
    let next = { ...r };
    if (newImgData === "__clear__") {
      if (r.imgKey) { try { await window.storage.delete(r.imgKey); } catch {} setImgCache((c) => { const n = { ...c }; delete n[r.id]; return n; }); }
      next.imgKey = "";
    } else if (newImgData) {
      const key = imgKeyFor(r.id);
      try { await window.storage.set(key, newImgData, false); } catch {}
      next.imgKey = key; next.imgUrl = "";
      setImgCache((c) => ({ ...c, [r.id]: newImgData }));
    }
    const exists = refs.some((x) => x.id === r.id);
    persistRefs(exists ? refs.map((x) => (x.id === r.id ? next : x)) : [...refs, next]);
    setOpenRef(false); setRefEditing(null);
  };
  const handleDeleteRef = async (r) => {
    if (r.imgKey) { try { await window.storage.delete(r.imgKey); } catch {} }
    persistRefs(refs.filter((x) => x.id !== r.id));
    setOpenRef(false); setRefEditing(null);
  };
  const handleRefState = (r, estado) => persistRefs(refs.map((x) => (x.id === r.id ? { ...x, estado } : x)));
  const handleConvert = (r) => {
    setConvertRefId(r.id); setEditing(null);
    setInitial({ concepto: r.titulo, producto: r.producto, hook: r.tipo === "hook" ? r.titulo : "", notas: r.notas });
    setOpenEditor(true);
  };

  const stats = useMemo(() => {
    const winners = ads.filter((a) => a.estado === "ganador");
    const dead = ads.filter((a) => a.estado === "muerto").length;
    const live = ads.filter((a) => a.estado === "lanzado" || a.estado === "testing").length;
    const closed = winners.length + dead;
    const byX = (key, mapper) => { const o = {}; winners.forEach((a) => { const k = mapper(a[key]); o[k] = (o[k] || 0) + 1; }); return Object.entries(o).sort((x, y) => y[1] - x[1]); };
    return { total: ads.length, winners: winners.length, dead, live, hitRate: closed ? Math.round((winners.length / closed) * 100) : 0, angles: byX("angulo", labelA), formatos: byX("formato", labelF), conceptos: byX("ccr", labelC), winnerList: winners, refCount: refs.length };
  }, [ads, refs]);

  if (loading) return <div style={FONT} className="flex h-64 items-center justify-center text-slate-400">Cargando estudio…</div>;

  const tabBtn = (id, label, Icon, count) => (
    <button onClick={() => setView(id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${view === id ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
      <Icon size={15} /> {label}{count != null && <span className="rounded-full bg-slate-200/80 px-1.5 text-[10px] font-bold text-slate-500">{count}</span>}
    </button>
  );
  const RankBlock = ({ title, rows, icon }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2">{icon}<h3 className="text-[14px] font-bold text-slate-800">{title}</h3></div>
      <div className="mt-4 space-y-2.5">
        {rows.length === 0 && <p className="text-[12px] text-slate-400">Sin ganadores aún.</p>}
        {rows.map(([name, n]) => {
          const max = rows[0][1];
          return (
            <div key={name} className="flex items-center gap-3">
              <div className="w-36 shrink-0 truncate text-[12px] font-semibold text-slate-600">{name}</div>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate-100"><div className="flex h-full items-center rounded-md bg-teal-500 px-2 text-[11px] font-bold text-white" style={{ width: `${Math.max(12, (n / max) * 100)}%` }}>{n}</div></div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={FONT} className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white"><Film size={17} /></div>
            <div><div className="text-[15px] font-extrabold leading-none tracking-tight">NOVA · Studio de Ads</div><div className="text-[11px] text-slate-400">Banco · Pipeline · Ganadores</div></div>
          </div>
          <div className="ml-2 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
            {tabBtn("pipeline", "Pipeline", LayoutGrid)}
            {tabBtn("banco", "Banco", Lightbulb, stats.refCount)}
            {tabBtn("ganadores", "Ganadores", Trophy, stats.winners)}
            {tabBtn("metricas", "Métricas", TrendingUp)}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {view === "pipeline" && (
              <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
                <button onClick={() => setPipeMode("board")} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold ${pipeMode === "board" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><LayoutGrid size={14} /> Tablero</button>
                <button onClick={() => setPipeMode("lista")} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold ${pipeMode === "lista" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><List size={14} /> Lista</button>
              </div>
            )}
            {(view === "pipeline" || view === "banco") && (
              <>
                <div className="relative hidden sm:block"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="w-36 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-[13px] outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" /></div>
                <select value={prodFilter} onChange={(e) => setProdFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] outline-none focus:border-teal-500"><option>Todos</option>{PRODUCTOS.map((p) => <option key={p}>{p}</option>)}</select>
              </>
            )}
            <div className="flex items-center gap-2" title={syncTitle}>
              {syncText && <span className={`hidden max-w-[220px] truncate text-[11px] lg:inline ${syncErr || sync?.status === "error" ? "text-rose-600" : "text-slate-400"}`}>{syncText}</span>}
              <button onClick={handleSync} disabled={syncActive} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70">
                <RefreshCw size={15} className={syncActive ? "animate-spin" : ""} /> {syncActive ? "Sincronizando" : "Sincronizar Meta"}
              </button>
            </div>
            {view === "banco" ? (
              <button onClick={() => { setRefEditing(null); setOpenRef(true); }} className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-teal-700"><Plus size={16} /> Nueva referencia</button>
            ) : (
              <button onClick={() => { setEditing(null); setInitial(null); setConvertRefId(null); setOpenEditor(true); }} className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-teal-700"><Plus size={16} /> Nuevo guión</button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-5">
        {view === "pipeline" && pipeMode === "lista" && (
          <ScriptTable ads={sortedAds} sort={sort} onSort={handleSort} onEdit={(a) => { setEditing(a); setInitial(null); setOpenEditor(true); }} onStage={handleStage} onDup={handleDup} onCopy={handleCopy} copiedId={copiedId} />
        )}
        {view === "pipeline" && pipeMode === "board" && (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STAGES.map((st) => {
              const items = filteredAds.filter((a) => a.estado === st.key);
              const s = STAGE_STYLE[st.key];
              return (
                <div key={st.key} className="flex w-[280px] flex-shrink-0 flex-col">
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span style={{ background: s.dot }} className="h-2 w-2 rounded-full" />
                    <span className="text-[13px] font-bold text-slate-700">{st.label}</span>
                    <span className="rounded-full bg-slate-200 px-1.5 text-[11px] font-bold text-slate-500">{items.length}</span>
                    <span className="ml-auto text-[10px] text-slate-400">{st.hint}</span>
                  </div>
                  <div className="flex flex-col gap-2.5 rounded-xl bg-slate-100/70 p-2" style={{ minHeight: 120 }}>
                    {items.length === 0 && <div className="py-6 text-center text-[11px] text-slate-400">Sin guiones</div>}
                    {items.map((ad) => <Card key={ad.id} ad={ad} onStage={handleStage} onEdit={(a) => { setEditing(a); setInitial(null); setOpenEditor(true); }} onDup={handleDup} onCopy={handleCopy} copiedId={copiedId} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === "banco" && (
          <div>
            <div className="mb-4 flex flex-wrap gap-1.5">
              <button onClick={() => setRefTipoFilter("todas")} className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${refTipoFilter === "todas" ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"}`}>Todas</button>
              {REF_TIPOS.map((t) => (
                <button key={t.key} onClick={() => setRefTipoFilter(t.key)} style={refTipoFilter === t.key ? { background: t.color, color: "#fff" } : {}} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold ${refTipoFilter === t.key ? "" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"}`}><t.Icon size={13} /> {t.label}</button>
              ))}
            </div>
            {filteredRefs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
                <Lightbulb size={28} className="mx-auto text-slate-300" />
                <p className="mt-3 text-[14px] font-semibold text-slate-600">Tu banco está vacío</p>
                <p className="mt-1 text-[12px] text-slate-400">Guarda ideas, videos de referencia, ads en imagen y anuncios de la competencia. Luego conviértelos en guión con un clic.</p>
                <button onClick={() => { setRefEditing(null); setOpenRef(true); }} className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-[13px] font-bold text-white hover:bg-teal-700"><Plus size={16} /> Agregar la primera</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredRefs.map((r) => <RefCard key={r.id} r={r} thumb={imgCache[r.id]} onEdit={(x) => { setRefEditing(x); setOpenRef(true); }} onConvert={handleConvert} onState={handleRefState} onOpenImg={setLightbox} />)}
              </div>
            )}
          </div>
        )}

        {view === "ganadores" && (
          stats.winnerList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
              <Trophy size={28} className="mx-auto text-slate-300" />
              <p className="mt-3 text-[14px] font-semibold text-slate-600">Aún no tienes ganadores</p>
              <p className="mt-1 text-[12px] text-slate-400">Marca un creativo como “Ganó” desde Testing y aparecerá acá para escalar e iterar.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stats.winnerList.map((ad) => {
                const cpa = ad.pedidos > 0 ? ad.spend / ad.pedidos : null;
                return (
                  <div key={ad.id} className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2"><Trophy size={16} className="text-emerald-600" /><span className="text-[13px] font-extrabold text-slate-800">{ad.concepto}</span></div>
                    <div className="mt-2 flex flex-wrap gap-1.5"><Chip>{ad.producto}</Chip><Chip bg="#eef2ff" color="#4338ca">{labelF(ad.formato)}</Chip><Chip bg="#fef3c7" color="#b45309">{labelC(ad.ccr)}</Chip><Chip bg="#ccfbf1" color="#0f766e">{labelA(ad.angulo)}</Chip>{cpa !== null && <Chip bg="#d1fae5" color="#047857">CPA S/{cpa.toFixed(1)}</Chip>}</div>
                    <div className="mt-2 truncate rounded bg-slate-900 px-2 py-1 font-mono text-[10px] text-teal-300">{buildAdName(ad, ad.num)}</div>
                    <p className="mt-3 whitespace-pre-line text-[12px] leading-relaxed text-slate-600">{scriptCompleto(ad)}</p>
                    <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                      <button onClick={() => handleCopy(ad)} className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-200">{copiedId === ad.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />} Copiar</button>
                      <button onClick={() => handleDup(ad)} className="flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1.5 text-[12px] font-bold text-white hover:bg-teal-700"><Award size={13} /> Iterar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {view === "metricas" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { l: "Guiones", v: stats.total, c: "#0f172a" },
                { l: "En vivo", v: stats.live, c: "#0d9488" },
                { l: "Ganadores", v: stats.winners, c: "#059669" },
                { l: "Muertos", v: stats.dead, c: "#e11d48" },
                { l: "Tasa de acierto", v: stats.hitRate + "%", c: "#4338ca" },
              ].map((k) => (
                <div key={k.l} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{k.l}</div><div className="mt-1 text-[26px] font-extrabold leading-none" style={{ color: k.c }}>{k.v}</div></div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <RankBlock title="Ángulos que ganan" rows={stats.angles} icon={<Tag size={16} className="text-teal-600" />} />
              <RankBlock title="Formatos que ganan" rows={stats.formatos} icon={<Film size={16} className="text-indigo-600" />} />
              <RankBlock title="Conceptos que ganan" rows={stats.conceptos} icon={<Wand2 size={16} className="text-amber-600" />} />
            </div>
          </div>
        )}
      </main>

      {openEditor && <Editor ad={editing} initial={initial} nextNum={nextNum} onSave={handleSaveAd} onDelete={handleDeleteAd} onClose={() => { setOpenEditor(false); setEditing(null); setInitial(null); setConvertRefId(null); }} />}
      {openRef && <RefEditor ref0={refEditing} thumb={refEditing ? imgCache[refEditing.id] : null} onSave={handleSaveRef} onDelete={handleDeleteRef} onClose={() => { setOpenRef(false); setRefEditing(null); }} />}
      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 p-6" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="referencia" className="max-h-[90vh] max-w-full rounded-lg object-contain" />
          <button className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-700"><X size={18} /></button>
        </div>
      )}
    </div>
  );
}
