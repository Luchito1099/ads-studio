import { openExtension } from "./biblioteca.js";
import { openModal } from "./guion.js";
import { hydrateThumbs, thumbHTML } from "./medios.js";
import { $, PID, S, STAGES, UI, byId, esc, ic, mine, normTxt, prod, save, toast } from "./nucleo.js";
import { newPiece } from "./pipeline.js";
import { openRef } from "./ref-detalle.js";
import { formModal, render, setTop } from "./vista.js";

/**
 * Embudo creativo: los formatos de cada etapa, no las piezas sueltas.
 *
 * La etapa y el grupo de cada formato salen de los anuncios que le asignaste en
 * la Biblioteca: si la mayoría de los referentes de "Testimonio" están en BOFU,
 * el formato se dibuja en BOFU. Se puede fijar a mano (c.stage) y entonces manda
 * eso. Ningún dato se inventa ni se reescribe: solo se cuenta lo que hay.
 *
 * Tres vistas, como en el diseño: Formatos (el lienzo), Colmena (qué está
 * probado) y Grilla (todo junto para buscar).
 */

const META = {
  TOFU: { nombre: 'Top Of The Funnel', sub: 'Atraer público nuevo', color: 'var(--tofu)', tinte: 'var(--tofu-bg)', linea: 'var(--tofu-line)' },
  MOFU: { nombre: 'Middle Of The Funnel', sub: 'Considerar y confiar', color: 'var(--mofu)', tinte: 'var(--mofu-bg)', linea: 'var(--mofu-line)' },
  BOFU: { nombre: 'Bottom Of The Funnel', sub: 'Convertir', color: 'var(--bofu)', tinte: 'var(--bofu-bg)', linea: 'var(--bofu-line)' },
};
const CUOTA_DEF = { TOFU: 4, MOFU: 3, BOFU: 2 };
const CAMPOS = [
  ['avatar', 'Avatar', 'a quién le vendes', 3, 'Edad, ciudad, qué hace, qué le pasó'],
  ['dolor', 'Dolor principal', 'el problema que siente', 3, 'Lo que le duele, le molesta o le da miedo'],
  ['deseo', 'Deseo / promesa', 'el resultado que quiere', 2, 'Cómo se ve su vida cuando se resuelve'],
  ['mecanismo', 'Mecanismo único', 'por qué tu producto sí funciona', 2, 'Lo que lo hace distinto a la alternativa'],
  ['oferta', 'Oferta', 'precio, packs, envío, pago', 2, 'Ej: 2 por S/ 99 · envío gratis · contraentrega'],
  ['objeciones', 'Objeciones', 'una por línea', 4, '¿Me va a quedar?\n¿Y si no funciona?'],
  ['angulos', 'Ángulos', 'uno por línea', 4, 'Trabajo de pie\nFútbol sin miedo'],
];

const est = () => UI.emb || (UI.emb = { vista: 'formatos', modo: 'referentes', tam: 'refs', zoom: 1, px: 0, py: 0, foco: null, q: '', getapa: 'Todas', gorigen: 'Todos' });

/* ---------- de los datos reales al embudo ---------- */
const refsDe = (c) => S.refs.filter(r => r.productId === PID() && r.conceptId === c.id);
const piezasDe = (c) => mine(S.pieces).filter(p => p.conceptId === c.id);
const hooksDe = (c) => mine(S.hooks).filter(h => h.conceptId === c.id);
/** La etapa de un formato: la fijada a mano o la que más repiten sus anuncios. */
function etapaDe(c) {
  if (c.stage) return c.stage;
  const cuenta = {};
  for (const r of refsDe(c)) if (r.stage) cuenta[r.stage] = (cuenta[r.stage] || 0) + 1;
  for (const p of piezasDe(c)) if (p.stage) cuenta[p.stage] = (cuenta[p.stage] || 0) + 1;
  return Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}
/** Video o estático, según lo que haya guardado en ese formato. */
function grupoDe(c) {
  if (c.grupo) return c.grupo === 'estatico' ? 'Estáticos' : 'Video';
  const rs = refsDe(c);
  const est = rs.filter(r => r.kind === 'image' || r.format === 'imagen' || r.format === 'carrusel').length;
  return est > rs.length / 2 && rs.length ? 'Estáticos' : 'Video';
}
const cuotas = () => (S.cuotas || (S.cuotas = {}))[PID()] || (S.cuotas[PID()] = { ...CUOTA_DEF });
const estrategia = () => (S.estrategia || (S.estrategia = {}))[S.marca || 'NOVA'] || {};
const angulosEstrategia = () => (estrategia().angulos || '').split('\n').map(s => s.trim()).filter(Boolean);
/** Lanzadas esta semana: lo que ya salió a Meta en los últimos 7 días. */
function hechasSemana(stage) {
  const desde = Date.now() - 7 * 86400000;
  return mine(S.pieces).filter(p => p.stage === stage && ['lanzado', 'testing', 'resultado'].includes(p.status) && (p.lanzada || p.created || 0) >= desde).length;
}

export function vEmbudo() {
  const f = est();
  const C = S.concepts.map(c => ({ c, stage: etapaDe(c), grupo: grupoDe(c), refs: refsDe(c).length, piezas: piezasDe(c).length }));
  const total = C.reduce((a, x) => a + (f.modo === 'creados' ? x.piezas : x.refs), 0);
  const cuenta = f.vista === 'formatos' ? `${C.filter(x => x.stage).length} formatos · ${total} ${f.modo === 'creados' ? 'piezas' : 'referencias'}`
    : f.vista === 'colmena' ? `${C.length} formatos · ${C.filter(x => x.piezas).length} con piezas`
    : `${total} elementos`;
  setTop('Embudo creativo', `${esc(S.marca || 'NOVA')} / ${esc(prod().name)} / Embudo`,
    `<div class="segtabs" role="tablist" aria-label="Vista">
       ${[['formatos', 'funnel', 'Formatos'], ['colmena', 'grid', 'Colmena'], ['grilla', 'ref', 'Grilla']].map(([k, i, l]) =>
         `<button class="${f.vista === k ? 'on' : ''}" data-ev="${k}" role="tab" aria-selected="${f.vista === k}">${ic(i, 'sm')}${l}</button>`).join('')}
     </div>
     <span class="muted" style="font-size:11.5px">${cuenta}</span>
     <button class="btn" id="enew">${ic('plus','sm')}Nueva pieza</button>`);

  if (f.vista === 'formatos') lienzo(C);
  else if (f.vista === 'colmena') colmena(C);
  else grilla(C);

  document.querySelectorAll('[data-ev]').forEach(b => b.onclick = () => { f.vista = b.dataset.ev; render(); });
  $('#enew').onclick = () => { const p = newPiece({}); openModal(p.id); };
}

/* ---------- vista Formatos: el lienzo ---------- */
function lienzo(C) {
  const f = est();
  const sinEtapa = C.filter(x => !x.stage);
  const visibles = STAGES.filter(s => !f.foco || f.foco === s);
  const q = cuotas();
  $('#body').style.overflow = 'hidden';
  $('#body').innerHTML = `<div class="lienzo" id="lienzo" style="background-position:${f.px}px ${f.py}px;background-size:${Math.round(22 * f.zoom)}px ${Math.round(22 * f.zoom)}px">
    <aside class="epanel" data-nodrag>
      <div style="display:flex;align-items:center">
        <div style="min-width:0"><div class="eyebrow">Embudo</div><b>${esc(S.marca || 'NOVA')}</b><div class="hint">${esc(prod().name)}</div></div>
        <button class="iconbtn" id="ecuotas" title="Cuotas semanales" aria-label="Cuotas semanales">${ic('concept','sm')}</button>
      </div>
      <div class="seg2" role="group" aria-label="Qué se cuenta">
        ${[['referentes', 'Referentes'], ['creados', 'Creados']].map(([k, l]) => `<button class="${f.modo === k ? 'on' : ''}" data-emodo="${k}">${l}</button>`).join('')}
      </div>
      <button class="btn ghost" id="eestrategia" style="justify-content:center;border-color:#99f6e4;background:var(--accent-bg);color:var(--accent-ink)">
        ${ic('book','sm')}Estrategia de venta${Object.keys(estrategia()).length ? '' : '<span class="punto"></span>'}</button>
      ${angulosEstrategia().length ? `<div class="eang"><span class="hint">Ángulos de venta · se combinan con cada formato</span>
        ${angulosEstrategia().map(a => `<span class="chip ang">${esc(a)}</span>`).join('')}</div>` : ''}
      <div class="ecuota">
        <div class="hint" style="display:flex;padding:0 6px 4px"><span>Cumplimiento semanal</span>
          <b class="mono" style="margin-left:auto;color:${STAGES.reduce((a, s) => a + hechasSemana(s), 0) >= STAGES.reduce((a, s) => a + q[s], 0) ? 'var(--accent-ink)' : 'var(--red)'}">
            ${STAGES.reduce((a, s) => a + hechasSemana(s), 0)} / ${STAGES.reduce((a, s) => a + q[s], 0)}</b></div>
        ${STAGES.map(s => { const hecho = hechasSemana(s), meta = q[s], pct = meta ? Math.min(100, Math.round(100 * hecho / meta)) : 100;
          return `<button class="efila ${f.foco === s ? 'on' : ''}" data-efoco="${s}" style="${f.foco === s ? `background:${META[s].tinte};box-shadow:inset 0 0 0 1px ${META[s].linea}` : ''}">
            <span style="font-weight:600;color:${META[s].color}">${META[s].nombre}</span>
            <span style="margin-left:auto;display:flex;align-items:center;gap:8px">
              <span class="ebar"><i style="width:${pct}%;background:${hecho >= meta ? 'var(--accent)' : META[s].color}"></i></span>
              <span class="mono" style="color:${hecho >= meta ? 'var(--accent-ink)' : 'var(--ink2)'}">${hecho} / ${meta}</span></span></button>`; }).join('')}
        ${f.foco ? '<button class="btn ghost sm" id="everall" style="margin-top:4px">Ver todas las etapas</button>' : ''}
      </div>
      <div class="hint" style="font-size:10px">Arrastra para mover · Ctrl + scroll para acercar · clic en una etapa para enfocarla</div>
    </aside>

    <div class="ezoom" data-nodrag>
      <button class="zb" id="ezout" aria-label="Alejar">−</button>
      <button class="zb mono" id="ezreset" aria-label="Restablecer zoom">${Math.round(f.zoom * 100)}%</button>
      <button class="zb" id="ezin" aria-label="Acercar">+</button>
      <span class="zsep"></span>
      <button class="zb" id="ezcenter" aria-label="Centrar" title="Centrar">${ic('angle','sm')}</button>
    </div>

    <div class="econt" style="transform:translate(${f.px}px,${f.py}px) scale(${f.zoom})">
      <div class="etitulo">
        <h2>Embudo de ${esc(S.marca || 'NOVA')}</h2>
        <div class="hint">${f.modo === 'creados' ? 'Piezas creadas en cada formato' : 'Referentes que inspiran cada formato'} · ${esc(prod().name)}</div>
      </div>
      ${visibles.map((s, i) => {
        const dentro = C.filter(x => x.stage === s);
        const grupos = ['Video', 'Estáticos'].map(g => [g, dentro.filter(x => x.grupo === g)]).filter(([, l]) => l.length);
        return `<section class="eetapa" style="border-color:${META[s].linea};background:rgba(255,255,255,.55)">
          <div style="text-align:center">
            <h3 style="color:${META[s].color}">${META[s].nombre}</h3>
            <div class="hint">${META[s].sub} · <span class="mono">${hechasSemana(s)}/${q[s]}</span> esta semana</div>
          </div>
          ${grupos.length ? `<div class="egrupos">${grupos.map(([g, items]) => `<div class="egrupo">
            <span class="egtag">${g}</span>
            <div class="ecards">${items.map(x => tarjetaFormato(x, s)).join('')}</div>
          </div>`).join('')}</div>`
          : `<div class="evacio">Todavía no hay formatos en ${s}. Asigna anuncios de la Biblioteca a esta etapa y aparecen aquí.</div>`}
        </section>
        ${i < visibles.length - 1 ? `<span class="eflecha">${ic('down','sm')}</span>` : ''}`;
      }).join('')}
      ${sinEtapa.length ? `<section class="eetapa sinetapa">
        <div style="text-align:center"><h3>Sin etapa</h3><div class="hint">Formatos que todavía no tienen anuncios asignados. Al asignar uno en la Biblioteca, el formato se coloca solo.</div></div>
        <div class="ecards">${sinEtapa.map(x => tarjetaFormato(x, '')).join('')}</div>
      </section>` : ''}
    </div>
  </div>`;

  hydrateThumbs();
  // panel
  document.querySelectorAll('[data-emodo]').forEach(b => b.onclick = () => { f.modo = b.dataset.emodo; render(); });
  document.querySelectorAll('[data-efoco]').forEach(b => b.onclick = () => { f.foco = f.foco === b.dataset.efoco ? null : b.dataset.efoco; f.px = 0; f.py = 0; render(); });
  if ($('#everall')) $('#everall').onclick = () => { f.foco = null; render(); };
  $('#ecuotas').onclick = abrirCuotas;
  $('#eestrategia').onclick = abrirEstrategia;
  // zoom y arrastre
  const z = (v) => { f.zoom = Math.min(1.6, Math.max(0.4, Math.round(v * 100) / 100)); render(); };
  $('#ezin').onclick = () => z(f.zoom + 0.1);
  $('#ezout').onclick = () => z(f.zoom - 0.1);
  $('#ezreset').onclick = () => z(1);
  $('#ezcenter').onclick = () => { f.zoom = 1; f.px = 0; f.py = 0; render(); };
  const el = $('#lienzo');
  el.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { f.zoom = Math.min(1.6, Math.max(0.4, Math.round(f.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) * 100) / 100)); }
    else { f.px -= e.deltaX; f.py -= e.deltaY; }
    aplicar();
  }, { passive: false });
  let arr = null, movido = false;
  const aplicar = () => {
    const c = el.querySelector('.econt');
    c.style.transform = `translate(${f.px}px,${f.py}px) scale(${f.zoom})`;
    el.style.backgroundPosition = `${f.px}px ${f.py}px`;
    el.style.backgroundSize = `${Math.round(22 * f.zoom)}px ${Math.round(22 * f.zoom)}px`;
    $('#ezreset').textContent = Math.round(f.zoom * 100) + '%';
  };
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('[data-nodrag]') || e.target.closest('.ecard')) return;
    arr = { x: e.clientX, y: e.clientY, px: f.px, py: f.py }; movido = false; el.classList.add('agarrando');
  });
  window.addEventListener('pointermove', e => {
    if (!arr) return;
    f.px = arr.px + (e.clientX - arr.x); f.py = arr.py + (e.clientY - arr.y);
    if (Math.abs(e.clientX - arr.x) + Math.abs(e.clientY - arr.y) > 4) movido = true;
    aplicar();
  });
  window.addEventListener('pointerup', () => { arr = null; el.classList.remove('agarrando'); setTimeout(() => { movido = false; }, 0); });
  document.querySelectorAll('.ecard').forEach(b => b.onclick = () => { if (!movido) abrirFormato(b.dataset.fmt); });
}

function tarjetaFormato(x, stage) {
  const f = est();
  const n = f.modo === 'creados' ? x.piezas : x.refs;
  const m = stage ? META[stage] : { color: 'var(--ink2)', tinte: 'var(--line2)', linea: 'var(--line)' };
  const refs = refsDe(x.c).slice(0, 3);
  return `<button class="ecard" data-fmt="${x.c.id}" aria-label="Abrir formato ${esc(x.c.name)}">
    <div class="ethumb" style="background:linear-gradient(180deg,${m.tinte},#fff)">
      ${stage ? `<span class="etag" style="background:${m.tinte};color:${m.color};border:1px solid ${m.linea}">${stage}</span>` : ''}
      <span class="eico" style="border-color:${m.linea};color:${m.color}">${ic(x.grupo === 'Video' ? 'play' : 'image', 'sm')}</span>
      <span class="efmt">${x.grupo === 'Video' ? 'VIDEO' : 'ESTÁTICO'}</span>
    </div>
    <div class="ecb">
      <div class="ecn">${esc(x.c.name)}</div>
      <div class="hint" style="color:${m.color};font-weight:600">Ver más</div>
      <div class="ecount">${n} ${f.modo === 'creados' ? (n === 1 ? 'pieza creada' : 'piezas creadas') : (n === 1 ? 'referencia' : 'referencias')}</div>
      <div class="emini">${refs.map(r => `<span class="emn" data-thumb="${esc(r.mediaId || '')}"></span>`).join('')}${x.refs > 3 ? `<span class="emn mas">+${x.refs - 3}</span>` : ''}</div>
    </div>
  </button>`;
}

/* ---------- vista Colmena ---------- */
function colmena(C) {
  const f = est();
  const valor = (x) => f.tam === 'refs' ? x.refs : f.tam === 'piezas' ? x.piezas : ganadoresDe(x.c);
  const max = Math.max(1, ...C.map(valor));
  const conGanador = C.filter(x => ganadoresDe(x.c) > 0);
  const sinProbar = C.filter(x => x.piezas === 0);
  const masRefs = [...C].sort((a, b) => b.refs - a.refs)[0];
  $('#body').style.overflow = '';
  $('#body').innerHTML = `<div class="colmena">
    <div class="colmain">
      <div class="colbar">
        <span class="hint">Tamaño del hexágono según</span>
        <div class="segtabs">${[['refs','Referentes'],['piezas','Piezas'],['ganadores','Ganadores']].map(([k,l])=>`<button class="${f.tam===k?'on':''}" data-etam="${k}">${l}</button>`).join('')}</div>
        <span class="hint" style="margin-left:auto">Color = cómo le fue · clic para abrir el formato</span>
      </div>
      <div class="colgrid">
        ${STAGES.map(s => { const dentro = C.filter(x => x.stage === s);
          const tests = dentro.reduce((a, x) => a + x.piezas, 0), wins = dentro.reduce((a, x) => a + ganadoresDe(x.c), 0);
          return `<section class="colbox" style="border-color:${META[s].linea};background:${META[s].tinte}">
            <div style="display:flex;align-items:baseline;gap:8px"><h2 style="color:${META[s].color}">${META[s].nombre}</h2><span class="hint">${s}</span></div>
            <div class="colnums"><span><b class="mono">${tests}</b> piezas</span><span><b class="mono" style="color:var(--accent-ink)">${wins}</b> ganadores</span><span><b class="mono">${dentro.filter(x => !x.piezas).length}</b> sin probar</span></div>
            <div class="colhex">${dentro.length ? dentro.map(x => hexa(x, valor(x), max)).join('') : '<span class="hint">Sin formatos en esta etapa</span>'}</div>
          </section>`; }).join('')}
      </div>
      <div class="colleg">${[['Con ganador','var(--accent)','#fff'],['En prueba','#fde68a','#713f12'],['Sin ganar','var(--bofu-bg)','var(--bofu)'],['Sin probar','var(--line)','var(--ink2)']]
        .map(([l,bg]) => `<span><i style="background:${bg}"></i>${l}</span>`).join('')}</div>
    </div>
    <aside class="coldiag">
      <div class="eyebrow">Diagnóstico</div>
      ${[['Más investigado','var(--ink2)', masRefs ? `${masRefs.c.name} · ${masRefs.refs} referentes` : 'Todavía nada', masRefs && masRefs.piezas ? `Ya tiene ${masRefs.piezas} pieza${masRefs.piezas === 1 ? '' : 's'}: sigue por ahí.` : 'Mucha investigación y ninguna pieza: conviértelo en guiones.'],
        ['Ganadores','var(--accent-ink)', conGanador.length ? conGanador.map(x => x.c.name).join(', ') : 'Todavía ninguno', conGanador.length ? 'Úsalos como referente propio y saca variaciones.' : 'Prioriza probar los formatos con más referentes.'],
        ['Sin probar','var(--mofu)', `${sinProbar.length} de ${C.length} formatos`, sinProbar.length ? `El siguiente: ${sinProbar.sort((a, b) => b.refs - a.refs)[0].c.name}, con ${sinProbar[0].refs} referentes listos.` : 'Todos los formatos tienen al menos una pieza.']]
        .map(([t, col, main, sub]) => `<div class="colcard"><div class="colct" style="color:${col}">${t}</div><div class="colcm">${esc(main)}</div><div class="hint">${esc(sub)}</div></div>`).join('')}
    </aside>
  </div>`;
  document.querySelectorAll('[data-etam]').forEach(b => b.onclick = () => { f.tam = b.dataset.etam; render(); });
  document.querySelectorAll('[data-hex]').forEach(b => b.onclick = () => abrirFormato(b.dataset.hex));
}
const ganadoresDe = (c) => mine(S.pieces).filter(p => p.conceptId === c.id && p.status === 'resultado').length;
function hexa(x, v, max) {
  const w = v ? Math.round(80 + 84 * Math.sqrt(v / max)) : 72;
  const wins = ganadoresDe(x.c);
  const col = wins ? ['var(--accent)', '#fff'] : x.piezas >= 3 ? ['var(--bofu-bg)', 'var(--bofu)'] : x.piezas ? ['#fde68a', '#713f12'] : ['var(--line)', 'var(--ink2)'];
  return `<button class="hex" data-hex="${x.c.id}" title="${esc(x.c.name)} · ${x.refs} referentes · ${x.piezas} piezas · ${wins} ganadores"
    style="width:${w}px;height:${Math.round(w * 1.1547)}px;background:${col[0]};color:${col[1]}">
    <span style="font-size:${w > 120 ? 11.5 : 10}px;font-weight:700;line-height:1.2;max-width:${Math.round(w * .72)}px">${esc(x.c.name)}</span>
    <span class="mono" style="font-size:13px;font-weight:700">${v}</span>
    <span style="font-size:9px;font-weight:600;opacity:.85">${wins ? 'Con ganador' : x.piezas >= 3 ? 'Sin ganar' : x.piezas ? 'En prueba' : 'Sin probar'}</span>
  </button>`;
}

/* ---------- vista Grilla ---------- */
function grilla(C) {
  const f = est();
  const q = normTxt(f.q);
  const items = [];
  for (const x of C) {
    if (f.gorigen !== 'Creados') for (const r of refsDe(x.c)) items.push({ tipo: 'Referente', r, c: x.c, stage: r.stage || x.stage });
    if (f.gorigen !== 'Referentes') for (const p of piezasDe(x.c)) items.push({ tipo: 'Creado', p, c: x.c, stage: p.stage || x.stage });
  }
  const list = items.filter(it => (f.getapa === 'Todas' || it.stage === f.getapa)
    && (!q || normTxt([it.c.name, it.r?.brand, it.p?.title, it.r?.notes].join(' ')).includes(q)));
  $('#body').style.overflow = '';
  $('#body').innerHTML = `<div class="egrilla">
    <div class="panel egfiltros">
      <div class="lsearch" style="flex:1 1 220px">${ic('search','sm')}<label class="visually-hidden" for="egq">Buscar</label><input id="egq" value="${esc(f.q)}" placeholder="Buscar hook, formato o marca"></div>
      <div class="fchips">${['Todas', ...STAGES].map(s => `<button class="fchip ${f.getapa === s ? 'on' : ''}" data-getapa="${s}">${s}</button>`).join('')}</div>
      <div class="segtabs">${['Todos','Referentes','Creados'].map(o => `<button class="${f.gorigen === o ? 'on' : ''}" data-gorigen="${o}">${o}</button>`).join('')}</div>
      <span class="muted" style="margin-left:auto;font-size:13px">${list.length} de ${items.length}</span>
    </div>
    ${list.length ? `<div class="lib">${list.map(it => it.tipo === 'Referente' ? tarjetaGrilla(it) : tarjetaGrillaPieza(it)).join('')}</div>`
      : '<div class="empty">Nada coincide con esos filtros.</div>'}
  </div>`;
  hydrateThumbs();
  const inp = $('#egq');
  inp.oninput = () => { f.q = inp.value; clearTimeout(inp._t); inp._t = setTimeout(() => { const p = inp.selectionStart; render(); const n = $('#egq'); n.focus(); n.setSelectionRange(p, p); }, 250); };
  document.querySelectorAll('[data-getapa]').forEach(b => b.onclick = () => { f.getapa = b.dataset.getapa; render(); });
  document.querySelectorAll('[data-gorigen]').forEach(b => b.onclick = () => { f.gorigen = b.dataset.gorigen; render(); });
  document.querySelectorAll('[data-gref]').forEach(b => b.onclick = () => openRef(b.dataset.gref));
  document.querySelectorAll('[data-gpieza]').forEach(b => b.onclick = () => openModal(b.dataset.gpieza));
}
function tarjetaGrilla(it) {
  const r = it.r;
  return `<article class="libcard" data-gref="${r.id}" tabindex="0" role="button">
    <div class="thumb" data-thumb="${esc(r.mediaId || '')}"></div>
    <span class="tipotag">Referente</span>
    ${it.stage ? `<span class="diastag" style="right:8px">${it.stage}</span>` : ''}
    <div class="lb"><div class="lrow1"><b>${esc(r.brand || 'Sin marca')}</b></div>
      <div class="lrow2"><span class="lprod">${esc(it.c.name)}</span></div></div></article>`;
}
function tarjetaGrillaPieza(it) {
  const p = it.p;
  return `<article class="libcard" data-gpieza="${p.id}" tabindex="0" role="button">
    <div class="thumb" data-thumb="${esc(p.mediaIds?.[0] || '')}"></div>
    <span class="tipotag" style="background:var(--accent)">Creado</span>
    ${it.stage ? `<span class="diastag" style="right:8px">${it.stage}</span>` : ''}
    <div class="lb"><div class="lrow1"><b>${esc(p.title)}</b></div>
      <div class="lrow2"><span class="mono">${esc(p.code)}</span><span class="lprod">· ${esc(it.c.name)}</span></div></div></article>`;
}

/* ---------- popup de un formato ---------- */
function abrirFormato(id) {
  const c = byId(S.concepts, id);
  if (!c) return;
  const f = est();
  f.fmtTab = f.fmtTab || 'refs';
  const pintar = () => {
    $('#fmtov')?.remove();
    const stage = etapaDe(c), m = stage ? META[stage] : null;
    const refs = refsDe(c), piezas = piezasDe(c), hooks = hooksDe(c);
    const ov = document.createElement('div');
    ov.className = 'ov'; ov.id = 'fmtov';
    ov.innerHTML = `<div class="modal" style="max-width:1040px" role="dialog" aria-modal="true" aria-labelledby="fmtt">
      <div class="mh">
        ${stage ? `<span class="chip ${stage}">${stage}</span>` : '<span class="chip">Sin etapa</span>'}
        <span class="chip" style="background:var(--ink);color:#fff">${esc(grupoDe({ ...c }))}</span>
        <b id="fmtt" style="font-size:19px">${esc(c.name)}</b>
        <span class="hint">${refs.length} referencias · ${piezas.length} piezas</span>
        <button class="btn ghost sm" data-x style="margin-left:auto" aria-label="Cerrar">${ic('x','sm')}</button>
      </div>
      <div class="fmtbody">
        <div class="grid2">
          <section class="panel" style="padding:14px 16px;background:#f8fafc">
            <div class="eyebrow">Por qué funciona</div>
            <p style="margin:6px 0 0;line-height:1.6">${esc(c.why || 'Todavía no escribiste por qué funciona este formato. Pulsa Editar y cuéntalo en una línea: te sirve a ti y a quien escriba los guiones.')}</p>
          </section>
          <section class="panel" style="padding:14px 16px;background:#f8fafc">
            <div class="eyebrow">Cómo se hace</div>
            <p style="margin:6px 0 0;line-height:1.6;white-space:pre-line">${esc(c.how || 'Sin pasos todavía.')}</p>
          </section>
        </div>
        <div class="fmtbar">
          <div class="segtabs">${[['refs', 'Referentes', refs.length], ['piezas', 'Creados', piezas.length], ['hooks', 'Hooks', hooks.length]]
            .map(([k, l, n]) => `<button class="${f.fmtTab === k ? 'on' : ''}" data-ftab="${k}">${l}<span>${n}</span></button>`).join('')}</div>
          <div style="margin-left:auto;display:flex;gap:8px">
            <button class="btn ghost sm" data-edit>${ic('pen','sm')}Editar formato</button>
            <button class="btn ghost sm" data-swipe>Importar de Nova Swipe</button>
            <button class="btn sm" data-nueva>+ Nueva pieza con este formato</button>
          </div>
        </div>
        ${f.fmtTab === 'refs' ? (refs.length ? `<div class="lib">${refs.map(r => `
            <article class="libcard" data-fref="${r.id}" tabindex="0" role="button">
              <div class="thumb" data-thumb="${esc(r.mediaId || '')}"></div>
              <span class="tipotag">${esc(r.source)}</span>
              <div class="lb"><div class="lrow1"><b>${esc(r.brand || 'Sin marca')}</b></div>
                <div class="lrow2"><span class="lprod">${r.startedAt ? 'desde ' + esc(r.startedAt) : esc(r.source)}</span></div></div></article>`).join('')}</div>`
          : '<div class="empty">Ningún anuncio de la Biblioteca tiene este formato todavía. Asígnalos desde la Biblioteca.</div>')
        : f.fmtTab === 'piezas' ? (piezas.length ? `<div class="panel" style="overflow:auto"><table><thead><tr><th>Pieza</th><th>Hook</th><th>Ángulo</th><th>Estado</th></tr></thead><tbody>
            ${piezas.map(p => `<tr data-fpieza="${p.id}" style="cursor:pointer"><td class="mono">${esc(p.code)}</td><td>${esc(p.script?.blocks?.[0]?.voz || p.title)}</td>
              <td>${byId(S.angles, p.angleId) ? `<span class="chip ang">${esc(byId(S.angles, p.angleId).name)}</span>` : '—'}</td>
              <td><span class="chip">${esc(p.status)}</span></td></tr>`).join('')}</tbody></table></div>`
          : '<div class="empty">Aún no hay piezas con este formato. Usa un referente o crea una nueva.</div>')
        : (hooks.length ? `<div class="panel" style="padding:4px 14px">${hooks.map(h => `<div class="hookrow"><span style="flex:1">“${esc(h.text)}”</span>${byId(S.angles, h.angleId) ? `<span class="chip ang">${esc(byId(S.angles, h.angleId).name)}</span>` : ''}</div>`).join('')}</div>`
          : '<div class="empty">Sin hooks guardados en este formato.</div>')}
      </div>
    </div>`;
    document.body.appendChild(ov);
    hydrateThumbs(ov);
    ov.querySelectorAll('[data-x]').forEach(b => b.onclick = () => ov.remove());
    ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
    ov.querySelectorAll('[data-ftab]').forEach(b => b.onclick = () => { f.fmtTab = b.dataset.ftab; pintar(); });
    ov.querySelectorAll('[data-fref]').forEach(b => b.onclick = () => { ov.remove(); openRef(b.dataset.fref); });
    ov.querySelectorAll('[data-fpieza]').forEach(b => b.onclick = () => { ov.remove(); openModal(b.dataset.fpieza); });
    ov.querySelector('[data-swipe]').onclick = () => { ov.remove(); openExtension(); };
    ov.querySelector('[data-nueva]').onclick = () => { ov.remove(); const p = newPiece({ conceptId: c.id, stage: etapaDe(c) || '' }); openModal(p.id); };
    ov.querySelector('[data-edit]').onclick = () => { ov.remove(); editarFormato(c); };
  };
  pintar();
}

function editarFormato(c) {
  formModal(`Formato · ${c.name}`, `
    <div class="field"><label for="fnom">Nombre</label><input id="fnom" value="${esc(c.name)}"></div>
    <div class="grid2">
      <div class="field"><label for="fet">Etapa fija</label><select id="fet"><option value="">Según sus anuncios (${etapaDe(c) || 'sin etapa'})</option>${STAGES.map(s => `<option ${c.stage === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label for="fgr">Grupo</label><select id="fgr"><option value="">Según sus anuncios (${grupoDe(c)})</option><option value="video" ${c.grupo === 'video' ? 'selected' : ''}>Video</option><option value="estatico" ${c.grupo === 'estatico' ? 'selected' : ''}>Estáticos</option></select></div>
    </div>
    <div class="field"><label for="fwhy">Por qué funciona</label><textarea id="fwhy" rows="3">${esc(c.why || '')}</textarea></div>
    <div class="field"><label for="fhow">Cómo se hace · un paso por línea</label><textarea id="fhow" rows="5">${esc(c.how || '')}</textarea></div>`,
    () => {
      c.name = $('#fnom').value.trim() || c.name;
      c.stage = $('#fet').value; c.grupo = $('#fgr').value;
      c.why = $('#fwhy').value.trim(); c.how = $('#fhow').value.trim();
      save(); render(); toast('Formato guardado');
    });
}

/* ---------- cuotas y estrategia ---------- */
function abrirCuotas() {
  const q = { ...cuotas() };
  formModal('Cuotas semanales', `
    <p class="hint" style="margin:0">Cuántas piezas quieres lanzar por semana en cada etapa. Alimenta el cumplimiento semanal del panel.</p>
    ${STAGES.map(s => `<div class="field" style="flex-direction:row;align-items:center;gap:12px">
      <div style="flex:1"><b style="color:${META[s].color}">${META[s].nombre}</b><div class="hint">${META[s].sub}</div></div>
      <input id="cu-${s}" type="number" min="0" max="50" value="${q[s]}" style="width:72px;text-align:center;font-family:var(--mono)">
    </div>`).join('')}`,
    () => { STAGES.forEach(s => { S.cuotas[PID()][s] = Math.max(0, Math.min(50, +$('#cu-' + s).value || 0)); }); save(); render(); toast('Cuotas guardadas'); });
}
function abrirEstrategia() {
  const e = { ...estrategia() };
  formModal(`Estrategia de venta · ${S.marca || 'NOVA'}`, `
    <p class="hint" style="margin:0">Esto es lo que le pasas a la IA cuando le pides guiones. Los ángulos salen de aquí y se usan como etiqueta en formatos y piezas.</p>
    ${CAMPOS.map(([k, l, ayuda, filas, ph]) => `<div class="field"><label for="es-${k}">${l} <span class="hint">· ${ayuda}</span></label>
      <textarea id="es-${k}" rows="${filas}" placeholder="${esc(ph)}">${esc(e[k] || '')}</textarea></div>`).join('')}
    <button class="btn ghost" id="escopiar" type="button">${ic('copy','sm')}Copiar para la IA</button>`,
    () => {
      const d = {}; CAMPOS.forEach(([k]) => { d[k] = $('#es-' + k).value.trim(); });
      S.estrategia[S.marca || 'NOVA'] = d; save(); render(); toast('Estrategia guardada');
    });
  setTimeout(() => {
    const b = document.querySelector('#escopiar');
    if (b) b.onclick = async () => {
      const txt = [`ESTRATEGIA DE VENTA · ${S.marca || 'NOVA'} · ${prod().name}`]
        .concat(CAMPOS.map(([k, l]) => { const v = ($('#es-' + k)?.value || '').trim(); return v ? `\n${l.toUpperCase()}:\n${v}` : ''; }).filter(Boolean)).join('\n');
      const { copyText } = await import('./guion.js');
      toast(await copyText(txt) ? 'Estrategia copiada: pégala junto a tu pedido de guiones' : 'No se pudo copiar');
    };
  }, 0);
}
