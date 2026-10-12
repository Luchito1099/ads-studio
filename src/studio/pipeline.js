import { copyText, openModal } from "./guion.js";
import { $, byId, esc, esTodos, ic, mine, normTxt, pidReal, prod, S, save, toast, UI, uid } from "./nucleo.js";
import { formModal, render, setTop } from "./vista.js";

/**
 * Content Pipeline: del primer apunte al anuncio subido a Meta.
 *
 * Seis columnas, como en el diseño. Los estáticos y los carruseles saltan
 * Edición: pasan de Producción a Revisión. Una pieza no avanza si le falta algo
 * (eso lo decide `falta`), así nadie manda a grabar un guion a medias.
 *
 * Las piezas lanzadas salen del tablero: su vida sigue en Testing.
 */

export const COLS = [
  ['idea', 'Idea', 'Referente, insight o tema'],
  ['guion', 'Guion / Brief', 'Video: guion · Estático: textos'],
  ['produccion', 'Producción', 'Grabar o diseñar'],
  ['edicion', 'Edición', 'Solo video'],
  ['revision', 'Revisión', 'Checklist antes de salir'],
  ['listo', 'Listo para salir', 'Ads → Testing · Orgánico → publicar'],
];
const FUERA = ['lanzado', 'testing', 'resultado'];
const LANES = { ads: ['ADS', '#ccfbf1', '#0f766e', 'Ads'], org: ['ORG', '#fce7f3', '#be185d', 'Orgánico'] };
const TIPOS = {
  video: ['Video', '#0f172a', '#ffffff', 'H'],
  estatico: ['Estático', '#e0e7ff', '#4338ca', 'V'],
  carrusel: ['Carrusel', '#fef3c7', '#a16207', 'T'],
};
const CHECKS = {
  video: ['Hook visible en los primeros 3 s', 'Subtítulos en todo el video', 'Formato 9:16 sin bordes negros', 'Precio y oferta correctos', 'CTA con pago contraentrega'],
  estatico: ['Texto legible en el celular', 'Producto protagonista', 'Precio y oferta correctos', 'Medidas 1:1 y 4:5 exportadas', 'Logo y colores de marca'],
  carrusel: ['La tarjeta 1 engancha sola', 'Una idea por tarjeta', 'Texto legible en el celular', 'Última tarjeta con CTA', 'Medidas 1:1 exportadas'],
};
const NOM_DEF = { sep: '_', toks: [['marca', 1], ['producto', 1], ['id', 1], ['version', 1], ['canal', 1], ['formato', 1], ['angulo', 1], ['etapa', 1], ['fecha', 0]] };

/* ---------- lo que una pieza es, leyendo lo que ya tiene ---------- */
export const tipoDe = (p) => p.tipo || (p.format === 'carrusel' ? 'carrusel' : p.format === 'imagen' ? 'estatico' : 'video');
const laneDe = (p) => p.lane || 'ads';
const colDe = (p) => (FUERA.includes(p.status) ? null : (COLS.some(c => c[0] === p.status) ? p.status : 'idea'));
const bloques = (p) => p.script?.blocks || [];
const hooksDe = (p) => bloques(p).filter(b => (b.tipo || 'Hook') === 'Hook');
/** Cuántos días lleva en esta columna. */
const dias = (p) => Math.max(0, Math.floor((Date.now() - (p.desde || p.created || Date.now())) / 86400000));
const checks = (p) => (p.checks || []).filter(Boolean).length;

/** Qué le falta a una pieza para pasar de columna. null si puede avanzar. */
export function falta(p) {
  const col = colDe(p), t = tipoDe(p), hs = hooksDe(p);
  const conTexto = hs.filter(h => (h.voz || h.texto || '').trim()).length;
  if (col === 'idea' && !p.title.trim()) return 'Ponle un título a la pieza.';
  if (col === 'guion') {
    if (laneDe(p) === 'ads' && !p.angleId) return 'Elige el ángulo: la idea de venta que usa esta pieza.';
    if (t === 'video') {
      if (!conTexto) return 'Escribe al menos un hook.';
      if (!bloques(p).some(b => b.tipo === 'Body' || (b.voz || '').trim())) return 'Escribe el body.';
      if (!(p.copy?.cta || '').trim() && !bloques(p).some(b => b.tipo === 'CTA')) return 'Escribe el CTA.';
    } else {
      if (t === 'carrusel' && conTexto < 2) return 'Un carrusel necesita al menos 2 tarjetas con texto.';
      if (!conTexto) return 'Escribe el texto principal.';
      if (!(p.copy?.principal || '').trim()) return 'Escribe el copy del anuncio.';
    }
  }
  if (col === 'produccion') {
    const faltan = hs.filter(h => !h.estado || h.estado === 'pend').length;
    if (faltan) return `Faltan ${t === 'video' ? 'grabar' : 'diseñar'} ${faltan} ${t === 'carrusel' ? 'tarjeta' : t === 'video' ? 'hook' : 'versión'}${faltan > 1 ? 's' : ''}.`;
  }
  if (col === 'edicion' && hs.some(h => h.estado !== 'ok')) return `Faltan editar ${hs.filter(h => h.estado !== 'ok').length} versión(es).`;
  if (col === 'revision' && checks(p) < 5) return `Completa el checklist (${checks(p)}/5).`;
  return null;
}
const siguiente = (p) => {
  const i = COLS.findIndex(c => c[0] === colDe(p));
  if (i < 0) return null;
  if (tipoDe(p) !== 'video' && COLS[i + 1]?.[0] === 'edicion') return 'revision';
  return COLS[i + 1]?.[0] || null;
};

/* ---------- nomenclatura ---------- */
const nom = () => S.nomenclatura || (S.nomenclatura = JSON.parse(JSON.stringify(NOM_DEF)));
const corto = (t, n = 6) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').trim().split(/\s+/).filter(w => w.length > 2)[0]?.slice(0, n) || '';
const TOKENS = {
  marca: ['Marca', 'Código corto de la marca', (p) => corto(S.marca || 'NOVA', 3)],
  producto: ['Producto', 'Tobillera → TOB', (p) => corto(byId(S.products, p.productId)?.name, 3)],
  id: ['ID de la pieza', 'Con esto Testing encuentra la pieza', (p) => String(p.code || '').replace(/_/g, '')],
  version: ['Versión', 'H1, H2… en video · V1, V2… en estáticos', (p, k) => k],
  canal: ['Canal', 'WEB o WA: Testing usa el embudo de ese canal', (p) => (laneDe(p) === 'org' ? '' : (p.canal || 'WEB'))],
  formato: ['Formato', 'UGC, VOZOFF, UNBOX…', (p) => corto(byId(S.concepts, p.conceptId)?.name)],
  angulo: ['Ángulo', 'Trabajo de pie → PIE', (p) => corto(byId(S.angles, p.angleId)?.name)],
  etapa: ['Etapa', 'TOFU, MOFU o BOFU', (p) => p.stage || ''],
  fecha: ['Fecha de lanzamiento', 'AAMMDD', () => { const d = new Date(); return String(d.getFullYear()).slice(2) + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }],
};
export function nombreAnuncio(p, k, n = nom()) {
  return n.toks.filter(t => t[1]).map(t => TOKENS[t[0]][2](p, k)).filter(Boolean).join(n.sep);
}
export const nombresDe = (p) => {
  const t = tipoDe(p), hs = hooksDe(p);
  if (t === 'carrusel') return [nombreAnuncio(p, '')];
  return (hs.length ? hs : [{}]).map((h, i) => nombreAnuncio(p, TIPOS[t][3] + (i + 1)));
};

/* ---------- crear ---------- */
export function newPiece(o = {}) {
  const tipo = o.tipo || 'video';
  const pre = { video: 'SCR_', estatico: 'EST_', carrusel: 'CAR_' }[tipo];
  S.seq[pidReal()] = (S.seq[pidReal()] || 0) + 1;
  const n = S.seq[pidReal()];
  const p = {
    id: uid('pc'), productId: pidReal(), code: pre + String(n).padStart(3, '0'), title: 'Nueva pieza',
    tipo, format: tipo === 'carrusel' ? 'carrusel' : tipo === 'estatico' ? 'imagen' : 'video',
    lane: 'ads', canal: 'WEB', conceptId: '', angleId: '', hookId: '', status: 'idea', stage: '',
    spend: null, conf: null, delivered: null, mediaIds: [], checks: [false, false, false, false, false],
    copy: { principal: '', titulo: '', cta: 'Comprar' }, board: null, created: Date.now(), desde: Date.now(), ...o,
  };
  if (p.stage && !p.board) p.board = { x: Math.random() * .6, y: Math.random() };
  S.pieces.push(p); save(); return p;
}

/* ---------- el tablero ---------- */
export function vPipeline() {
  const f = UI.pipe || (UI.pipe = { lane: 'todos', stage: 'todas', angulo: '' });
  const todas = mine(S.pieces);
  const enTablero = todas.filter(p => colDe(p));
  const list = enTablero.filter(p => (f.lane === 'todos' || laneDe(p) === f.lane)
    && (f.stage === 'todas' || p.stage === f.stage || (f.stage === 'sin' && !p.stage))
    && (!f.angulo || p.angleId === f.angulo));
  const lanzadas = todas.filter(p => FUERA.includes(p.status));

  setTop('Content Pipeline', `${esc(S.marca || 'NOVA')} / ${esc(prod().name)}`,
    `<button class="btn ghost" id="pnom" title="${esc(nombreAnuncio(ejemplo(), 'H1'))}">${ic('pen','sm')}Nomenclatura
       <span class="mono hint" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nombreAnuncio(ejemplo(), 'H1'))}</span></button>
     <div class="segtabs">${[['todos', 'Todos', enTablero.length], ['ads', 'Ads', enTablero.filter(p => laneDe(p) === 'ads').length], ['org', 'Orgánico', enTablero.filter(p => laneDe(p) === 'org').length]]
       .map(([k, l, n]) => `<button class="${f.lane === k ? 'on' : ''}" data-plane="${k}">${l}<span>${n}</span></button>`).join('')}</div>
     <div class="nueva"><span>${ic('plus','sm')}Nueva</span>
       ${Object.entries(TIPOS).map(([k, t]) => `<button data-nueva="${k}">${t[0]}</button>`).join('')}</div>`);

  const sesion = list.filter(p => tipoDe(p) === 'video' && ['guion', 'produccion'].includes(colDe(p)) && hooksDe(p).some(h => !h.estado || h.estado === 'pend'));
  const pendSesion = sesion.reduce((a, p) => a + hooksDe(p).filter(h => !h.estado || h.estado === 'pend').length, 0);

  $('#body').innerHTML = `
   <div class="pfiltros">
     <div class="fchips">${[['todas', 'Todas'], ['TOFU', 'TOFU'], ['MOFU', 'MOFU'], ['BOFU', 'BOFU'], ['sin', 'Sin etapa']]
       .map(([k, l]) => `<button class="fchip ${f.stage === k ? 'on' : ''}" data-pstage="${k}">${l}</button>`).join('')}</div>
     <label class="visually-hidden" for="pang">Ángulo</label>
     <select id="pang" class="fsel"><option value="">Todos los ángulos</option>${mine(S.angles).map(a => `<option value="${a.id}" ${f.angulo === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
   </div>

   <div class="psalud">
     <section class="psbox">
       ${COLS.map(([k, l]) => {
         const en = list.filter(p => colDe(p) === k);
         const prom = en.length ? Math.round(10 * en.reduce((a, p) => a + dias(p), 0) / en.length) / 10 : 0;
         const lento = prom >= 2;
         return `<div class="pscol ${lento ? 'lento' : ''}">
           <div class="pshint">${l}${lento ? ic('warn', 'sm') : ''}</div>
           <div><b class="mono">${en.length}</b> <span class="${lento ? 'malo' : 'hint'}">${prom} d prom.</span></div>
         </div>`; }).join('')}
     </section>
     <section class="psesion">
       <div class="psh">${ic('video','sm')}<b>Sesión de grabación</b><span class="hint" style="margin-left:auto">${sesion.length} pieza${sesion.length === 1 ? '' : 's'} · ${pendSesion} hooks</span></div>
       <div class="pschips">${sesion.length ? sesion.map(p => { const n = hooksDe(p).filter(h => !h.estado || h.estado === 'pend').length;
           return `<button data-abrir="${p.id}"><b class="mono">${esc(p.code)}</b> ${colDe(p) === 'guion' ? 'body + ' : ''}${n} hook${n === 1 ? '' : 's'}</button>`; }).join('')
         : '<span class="hint">Nada pendiente por grabar.</span>'}</div>
       <div class="hint" style="color:#64748b">Solo videos. Los estáticos van a diseño.</div>
     </section>
   </div>

   <div class="ptablero">
     ${COLS.map(([k, l, sub], i) => {
       const items = list.filter(p => colDe(p) === k);
       return `<section class="pcol" data-col="${k}">
         <div class="pcolh"><span class="mono">${String(i + 1).padStart(2, '0')}</span><b>${l}</b><span class="mono n">${items.length}</span></div>
         <div class="hint">${sub}</div>
         ${items.map(tarjeta).join('') || '<div class="pvacio">Arrastra una pieza aquí</div>'}
       </section>`; }).join('')}
   </div>
   <div class="hint" style="display:flex;align-items:center;gap:8px;margin-top:10px">${ic('check','sm')}
     Haz clic en una tarjeta para editarla. Los estáticos y carruseles saltan Edición: pasan de Producción a Revisión.</div>
   ${lanzadas.length ? `<section class="panel planzadas">
     <div class="hint">Ya lanzadas · su vida sigue en Testing</div>
     ${lanzadas.map(p => `<div class="prow"><span class="mono">${esc(p.code)}</span><span>${esc(p.title)}</span>
       <span style="margin-left:auto;display:flex;gap:4px">${nombresDe(p).map(n => `<span class="chip mono sm">${esc(n)}</span>`).join('')}</span></div>`).join('')}
   </section>` : ''}`;

  // filtros y acciones
  document.querySelectorAll('[data-plane]').forEach(b => b.onclick = () => { f.lane = b.dataset.plane; render(); });
  document.querySelectorAll('[data-pstage]').forEach(b => b.onclick = () => { f.stage = b.dataset.pstage; render(); });
  $('#pang').onchange = e => { f.angulo = e.target.value; render(); };
  document.querySelectorAll('[data-nueva]').forEach(b => b.onclick = () => {
    const p = newPiece({ tipo: b.dataset.nueva, stage: ['TOFU', 'MOFU', 'BOFU'].includes(f.stage) ? f.stage : '', angleId: f.angulo, lane: f.lane === 'org' ? 'org' : 'ads' });
    openModal(p.id);
  });
  $('#pnom').onclick = abrirNomenclatura;
  document.querySelectorAll('[data-abrir]').forEach(b => b.onclick = () => openModal(b.dataset.abrir));
  // tarjetas: abrir y arrastrar
  document.querySelectorAll('.pcard').forEach(c => {
    c.onclick = () => openModal(c.dataset.id);
    c.onkeydown = e => { if (e.key === 'Enter') openModal(c.dataset.id); };
    c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/piece', c.dataset.id); c.classList.add('dragging'); });
    c.addEventListener('dragend', () => c.classList.remove('dragging'));
  });
  document.querySelectorAll('.pcol').forEach(col => {
    col.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('text/piece')) { e.preventDefault(); col.classList.add('over'); } });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', e => {
      const id = e.dataTransfer.getData('text/piece'); if (!id) return;
      e.preventDefault(); e.stopPropagation(); col.classList.remove('over');
      mover(byId(S.pieces, id), col.dataset.col);
    });
  });
}
const ejemplo = () => mine(S.pieces).find(p => colDe(p)) || { code: 'SCR_046', productId: pidReal(), stage: 'TOFU', canal: 'WEB', lane: 'ads', conceptId: S.concepts[0]?.id, angleId: mine(S.angles)[0]?.id };

/** Mueve una pieza de columna, pero solo si no le falta nada por el camino. */
export function mover(p, destino) {
  if (!p || !destino) return;
  const desde = colDe(p);
  if (destino === desde) return;
  const iDesde = COLS.findIndex(c => c[0] === desde), iHasta = COLS.findIndex(c => c[0] === destino);
  if (tipoDe(p) !== 'video' && destino === 'edicion') { toast('Los estáticos y carruseles no pasan por Edición: van de Producción a Revisión.'); return; }
  if (iHasta > iDesde) {
    let paso = { ...p };
    for (let i = iDesde; i < iHasta; i++) {
      if (tipoDe(p) !== 'video' && COLS[i][0] === 'edicion') continue;
      paso.status = COLS[i][0];
      const g = falta(paso);
      if (g) { toast(`No puede pasar a ${COLS[i + 1][1]}: ${g}`); return; }
    }
  }
  p.status = destino; p.desde = Date.now(); save(); render();
  toast(`${p.code} pasó a ${COLS[iHasta][1]}`);
}
/** Lanzar: sale del tablero y su vida sigue en Testing. */
export function lanzar(p) {
  const nombres = nombresDe(p);
  p.status = 'lanzado'; p.desde = Date.now(); p.lanzada = Date.now(); save(); render();
  toast(p.lane === 'org' ? `${p.code} publicado` : `${p.code} lanzado: ${nombres.length} anuncio${nombres.length === 1 ? '' : 's'} pasan a Testing`);
}

function tarjeta(p) {
  const t = TIPOS[tipoDe(p)], lane = LANES[laneDe(p)], ang = byId(S.angles, p.angleId), con = byId(S.concepts, p.conceptId);
  const hs = hooksDe(p), d = dias(p), lento = d >= 3, col = colDe(p);
  const ref = p.refId ? byId(S.refs, p.refId) : null;
  const g = falta(p);
  const etiqueta = tipoDe(p) === 'carrusel' ? 'Tarjetas' : tipoDe(p) === 'estatico' ? 'Versiones' : 'Hooks';
  const estado = { pend: ['#f1f5f9', '#475569', '#cbd5e1'], rec: ['#e0e7ff', '#4338ca', '#a5b4fc'], ok: ['#ccfbf1', '#0f766e', '#5eead4'] };
  return `<article class="pcard" draggable="true" data-id="${p.id}" tabindex="0" role="button" aria-label="Abrir ${esc(p.code)}">
    <div class="pcr">
      <span class="mono pcid">${esc(p.code)}</span>
      <span class="pclane" style="background:${lane[1]};color:${lane[2]}">${lane[0]}</span>
      ${p.stage ? `<span class="chip ${p.stage} sm">${p.stage}</span>` : ''}
      <span class="mono pcd ${lento ? 'malo' : ''}">${d}d</span>
    </div>
    <div class="pct">${esc(p.title || 'Sin título')}</div>
    <div class="pcm">
      <span class="pctipo" style="background:${t[1]};color:${t[2]}">${t[0]}</span>
      ${con ? esc(con.name) : ''}
      ${ang ? `<span class="chip ang sm">${esc(ang.name)}</span>` : (laneDe(p) === 'ads' ? '<span class="pcsin">Sin ángulo</span>' : '')}
    </div>
    ${ref ? `<div class="pcref">${ic('ref','sm')}<span>Ref: ${esc(ref.brand || 'referencia')}${ref.adId ? ' · ' + esc(ref.adId) : ''}</span></div>` : ''}
    ${hs.length ? `<div class="pchooks"><span class="hint">${etiqueta}</span>${hs.map((h, i) => {
        const e = estado[h.estado || 'pend'];
        return `<span class="mono pchk" style="background:${e[0]};color:${e[1]};border-color:${e[2]}">${t[3]}${i + 1}</span>`; }).join('')}</div>` : ''}
    ${col === 'revision' ? `<div class="pcbar"><span><i style="width:${checks(p) * 20}%"></i></span><span class="mono">${checks(p)}/5</span></div>` : ''}
    <div class="pcf">
      <span class="pcav">${esc((S.usuario || 'L').charAt(0))}</span>
      <span class="hint">${ic('link','sm')}${p.mediaIds?.length || 0}</span>
      <span class="pcnext ${g ? '' : 'ok'}">${col === 'listo' ? 'Listo' : g ? 'Incompleta' : 'Puede avanzar'}</span>
    </div>
  </article>`;
}

/* ---------- nomenclatura ---------- */
function abrirNomenclatura() {
  const n = JSON.parse(JSON.stringify(nom()));
  const ej = ejemplo();
  const pintar = () => {
    const prev = [['Video', { ...ej, tipo: 'video' }, 'H1'], ['Estático', { ...ej, tipo: 'estatico' }, 'V2'], ['Carrusel', { ...ej, tipo: 'carrusel' }, '']];
    return `
    <p class="hint" style="margin:0">Así se va a llamar cada anuncio al lanzarlo. Testing reconoce cada fila del Excel por el <b>ID y la versión</b>; el resto te sirve para leer el nombre rápido en el Administrador de anuncios.</p>
    <div class="nomprev">
      <div class="hint">Vista previa</div>
      ${prev.map(([l, p, k]) => `<div><span>${l}</span><b class="mono">${esc(nombreAnuncio(p, k, n))}</b></div>`).join('')}
    </div>
    <div class="nomrows">
      <div class="hint">Partes del nombre · en orden</div>
      ${n.toks.map(([k, on], i) => { const T = TOKENS[k], fijo = ['id', 'version', 'canal'].includes(k);
        return `<div class="nomrow">
          <button class="nomck ${on ? 'on' : ''} ${fijo ? 'fijo' : ''}" data-nck="${i}" aria-pressed="${!!on}">${on ? ic('check','sm') : ''}</button>
          <span style="flex:1;min-width:0"><b class="${on ? '' : 'hint'}">${T[0]}</b>${fijo ? '<span class="chip win sm">Obligatorio</span>' : ''}<span class="hint" style="display:block">${T[1]}</span></span>
          <span class="mono hint">${esc(T[2](ej, 'H1') || '—')}</span>
          <button class="iconbtn" data-nup="${i}" aria-label="Subir">${ic('updown','sm')}</button>
        </div>`; }).join('')}
    </div>
    <div class="field" style="flex-direction:row;align-items:center;gap:8px"><b style="font-size:12px">Separador</b>
      ${[['_', 'Guion bajo _'], ['-', 'Guion -'], ['|', 'Barra |']].map(([v, l]) => `<button class="chipb mono ${n.sep === v ? 'on dark' : ''}" data-nsep="${v}">${l}</button>`).join('')}</div>
    <div class="panel" style="padding:11px 13px;display:flex;flex-wrap:wrap;align-items:center;gap:8px">
      <div style="flex:1 1 300px" class="hint"><b style="color:var(--ink)">Para que el ERP también cruce:</b> en Meta, en Parámetros de URL de cada anuncio, pega esto. Así cada pedido llega con el nombre del anuncio.</div>
      <code class="mono" style="background:var(--line2);border-radius:7px;padding:5px 9px">utm_content={{ad.name}}</code>
      <button class="btn ghost sm" id="nomutm" type="button">Copiar</button>
    </div>`;
  };
  formModal('Nomenclatura de anuncios', pintar(), () => { S.nomenclatura = n; save(); render(); toast('Nomenclatura guardada'); });
  const refrescar = () => { const c = document.querySelector('.ov .modal .mb'); if (c) { c.innerHTML = pintar(); enlazar(); } };
  const enlazar = () => {
    document.querySelectorAll('[data-nck]').forEach(b => b.onclick = () => {
      const i = +b.dataset.nck; if (['id', 'version', 'canal'].includes(n.toks[i][0])) return;
      n.toks[i][1] = n.toks[i][1] ? 0 : 1; refrescar();
    });
    document.querySelectorAll('[data-nup]').forEach(b => b.onclick = () => {
      const i = +b.dataset.nup; if (i === 0) return;
      [n.toks[i - 1], n.toks[i]] = [n.toks[i], n.toks[i - 1]]; refrescar();
    });
    document.querySelectorAll('[data-nsep]').forEach(b => b.onclick = () => { n.sep = b.dataset.nsep; refrescar(); });
    const u = document.querySelector('#nomutm');
    if (u) u.onclick = async () => { toast(await copyText('utm_content={{ad.name}}') ? 'Parámetro copiado' : 'No se pudo copiar'); };
  };
  setTimeout(enlazar, 0);
}
