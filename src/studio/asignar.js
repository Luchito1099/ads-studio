import { $, PID, S, STAGES, UI, byId, esc, ic, mine, normTxt, prod, save, toast, uid } from "./nucleo.js";
import { sugerencias } from "./ref-detalle.js";
import { render } from "./vista.js";

/**
 * Popup "Asignar al embudo": le pone producto, etapa, formato y ángulo a un
 * anuncio de la Biblioteca.
 *
 * Solo escribe en campos que el anuncio ya tenía (productId, stage, conceptId,
 * angleId). No crea tablas ni toca el archivo: un anuncio sin asignar y uno
 * asignado son el mismo registro con esos campos llenos.
 *
 * Con una cola (la bandeja "Sin asignar") el botón pasa a "Asignar y siguiente"
 * y se puede vaciar la bandeja sin salir del popup.
 */

const ETAPA_SUB = { TOFU: 'Atraer', MOFU: 'Confiar', BOFU: 'Convertir' };

export function abrirAsignar(id, cola = []) {
  const r = byId(S.refs, id);
  if (!r) return;
  const sug = sugerencias(r);
  const sugConcepto = sug.concepto ? S.concepts.find(c => normTxt(c.name) === normTxt(sug.concepto)) : null;
  UI.asig = {
    id, cola: cola.filter(x => x !== id),
    productId: r.productId || PID(),
    stage: r.stage || sug.stage || '',
    conceptId: r.conceptId || sugConcepto?.id || '',
    angleId: r.angleId || '',
    sug: { stage: sug.stage || '', conceptId: sugConcepto?.id || '', nombre: sug.concepto || '' },
  };
  pintar();
}

const cerrar = () => { UI.asig = null; $('#asigov')?.remove(); render(); };

function pintar() {
  const A = UI.asig;
  const r = A && byId(S.refs, A.id);
  if (!r) return cerrar();
  $('#asigov')?.remove();

  const ov = document.createElement('div');
  ov.className = 'ov'; ov.id = 'asigov';
  const ex = r.extract || {};
  const hook = ex.analysis?.hook?.texto || ex.blocks?.[0]?.voz || ex.blocks?.[0]?.texto || '';
  const conceptos = S.concepts;
  const angulos = mine(S.angles);
  const faltan = A.cola.length;
  const listo = A.stage && A.conceptId;
  const haySug = A.sug.stage || A.sug.conceptId;
  const distinta = haySug && (A.stage !== A.sug.stage || A.conceptId !== A.sug.conceptId);
  const nConcepto = (id) => S.refs.filter(x => x.conceptId === id).length;

  ov.innerHTML = `<div class="modal asig" role="dialog" aria-modal="true" aria-labelledby="asigt">
    <div class="mh">
      <b id="asigt">Asignar al embudo</b>
      ${faltan ? `<span class="chip">Bandeja · faltan ${faltan}</span>` : ''}
      <button class="btn ghost sm" data-x style="margin-left:auto" aria-label="Cerrar">${ic('x','sm')}</button>
    </div>
    <div class="asigbody">
      <aside class="asigref">
        <div class="thumb" style="aspect-ratio:9/16" data-thumb="${esc(r.mediaId || '')}">${hook ? `<span class="hookover">${esc(hook.slice(0, 80))}</span>` : ''}</div>
        <b>${esc(r.brand || 'Sin marca')}</b>
        <span class="hint">${esc(r.source)}${r.startedAt ? ` · desde ${esc(r.startedAt)}` : ''}</span>
        <button class="linkbtn" data-ver>Ver la ficha completa →</button>
      </aside>
      <div class="asigpasos">
        ${haySug ? `<div class="asigia">
          <span class="iatag">IA</span>
          <div>Sugerencia: <b>${esc(A.sug.stage || '—')}${A.sug.nombre ? ' · ' + esc(A.sug.nombre) : ''}</b>. Sale de lo que se dice y se ve en el anuncio.</div>
          ${distinta ? '<button class="btn ghost sm" data-sug>Usar sugerencia</button>' : ''}
        </div>` : ''}

        ${S.products.length > 1 ? `<div class="asigpaso">
          <div class="asigt">1 · Producto</div>
          <div class="chips">${S.products.map(p => `<button class="chipb ${p.id === A.productId ? 'on dark' : ''}" data-prod="${p.id}">${esc(p.name)}</button>`).join('')}</div>
        </div>` : ''}

        <div class="asigpaso">
          <div class="asigt">${S.products.length > 1 ? '2' : '1'} · Etapa del embudo</div>
          <div class="asigetapas">${STAGES.map(s => `<button class="asigetapa ${s} ${A.stage === s ? 'on' : ''}" data-etapa="${s}">
            <b>${s}</b><span>${ETAPA_SUB[s]}</span>${A.sug.stage === s ? '<i class="iatag">IA</i>' : ''}</button>`).join('')}</div>
        </div>

        <div class="asigpaso">
          <div class="asigt">${S.products.length > 1 ? '3' : '2'} · Formato <span class="hint">· cómo está hecho el anuncio</span></div>
          <div class="asigformatos">${conceptos.map(c => `<button class="asigfmt ${c.id === A.conceptId ? 'on' : ''}" data-fmt="${c.id}">
            <span>${esc(c.name)}</span>${A.sug.conceptId === c.id ? '<i class="iatag">IA</i>' : ''}<em>${nConcepto(c.id)}</em></button>`).join('')}
            <button class="asigfmt nuevo" data-fmtnuevo>${ic('plus','sm')}<span>Nuevo formato</span></button></div>
        </div>

        <div class="asigpaso">
          <div class="asigt">${S.products.length > 1 ? '4' : '3'} · Ángulo <span class="hint">· opcional</span></div>
          <div class="chips">${angulos.length ? angulos.map(a => `<button class="chipb ${a.id === A.angleId ? 'on' : ''}" data-ang="${a.id}">${esc(a.name)}</button>`).join('')
            : '<span class="hint">Todavía no hay ángulos de venta para este producto.</span>'}</div>
        </div>

        <div class="asigresumen">
          ${ic('funnel','sm')}
          <b>${esc(prod().name)}</b><span>›</span>
          <b class="${A.stage}">${A.stage || '—'}</b><span>›</span>
          <b>${esc(byId(S.concepts, A.conceptId)?.name || 'elige un formato')}</b>
          ${A.angleId ? `<span class="chip ang">${esc(byId(S.angles, A.angleId)?.name || '')}</span>` : ''}
        </div>
      </div>
    </div>
    <div class="mf">
      ${faltan ? '<button class="btn ghost" data-saltar>Saltar</button>' : ''}
      <button class="btn ghost" data-x style="margin-left:auto">Cancelar</button>
      <button class="btn" data-guardar ${listo ? '' : 'disabled'}>${ic('check','sm')}${faltan ? 'Asignar y siguiente' : 'Asignar'}</button>
    </div>
  </div>`;
  document.body.appendChild(ov);

  const q = s => ov.querySelector(s);
  ov.querySelectorAll('[data-x]').forEach(b => b.onclick = cerrar);
  ov.addEventListener('mousedown', e => { if (e.target === ov) cerrar(); });
  if (!window._escAsig) { window._escAsig = true; document.addEventListener('keydown', e => { if (e.key === 'Escape' && UI.asig) cerrar(); }); }

  const toca = (patch) => { Object.assign(UI.asig, patch); pintar(); };
  ov.querySelectorAll('[data-prod]').forEach(b => b.onclick = () => toca({ productId: b.dataset.prod }));
  ov.querySelectorAll('[data-etapa]').forEach(b => b.onclick = () => toca({ stage: UI.asig.stage === b.dataset.etapa ? '' : b.dataset.etapa }));
  ov.querySelectorAll('[data-fmt]').forEach(b => b.onclick = () => toca({ conceptId: UI.asig.conceptId === b.dataset.fmt ? '' : b.dataset.fmt }));
  ov.querySelectorAll('[data-ang]').forEach(b => b.onclick = () => toca({ angleId: UI.asig.angleId === b.dataset.ang ? '' : b.dataset.ang }));
  if (q('[data-sug]')) q('[data-sug]').onclick = () => toca({ stage: A.sug.stage || A.stage, conceptId: A.sug.conceptId || A.conceptId });
  q('[data-fmtnuevo]').onclick = () => {
    const n = prompt('Nombre del formato (UGC, Testimonio, Demostración…)');
    if (!n || !n.trim()) return;
    const c = { id: uid('c'), name: n.trim() };
    S.concepts.push(c); save();
    toca({ conceptId: c.id });
  };
  q('[data-ver]').onclick = () => { const id = A.id; cerrar(); import('./ref-detalle.js').then(m => m.openRef(id, 'datos')); };
  if (q('[data-saltar]')) q('[data-saltar]').onclick = () => siguiente();

  q('[data-guardar]').onclick = () => {
    if (!listo) return;
    Object.assign(r, { productId: A.productId, stage: A.stage, conceptId: A.conceptId, angleId: A.angleId });
    save();
    toast(`Asignado a ${A.stage} · ${byId(S.concepts, A.conceptId)?.name || ''}`);
    siguiente();
  };

  // la miniatura de verdad la pinta el hidratador de medios
  import('./medios.js').then(m => m.hydrateThumbs(ov));
}

/** Pasa al siguiente de la bandeja, o cierra si ya no queda ninguno. */
function siguiente() {
  const cola = UI.asig?.cola || [];
  const quedan = cola.filter(id => { const r = byId(S.refs, id); return r && (!r.stage || !r.conceptId); });
  if (!quedan.length) { const habia = cola.length; cerrar(); if (habia) toast('Bandeja vacía: todo asignado'); return; }
  abrirAsignar(quedan[0], quedan);
}
