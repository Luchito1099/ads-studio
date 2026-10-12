import { logout } from "../storage.js";
import { exportData, openSettings } from "./ajustes.js";
import { $, PID, S, TODOS, UI, emptyLanes, esc, esTodos, ic, mine, normTxt, prod, save, toast, uid } from "./nucleo.js";
import { abrirNav, render } from "./vista.js";

/** El menú lateral: la marca, el producto y las tres familias de pantallas. */

/* Las tres secciones del diseño. `pronto` marca las pantallas que todavía no
 * están hechas: se ven en el menú, pero avisan en qué fase llegan. */
export const VIEWS = [
  ['Creativos', [
    ['embudo', 'funnel', 'Embudo'],
    ['pipeline', 'pipe', 'Content Pipeline'],
    ['hooks', 'hook', 'Hooks'],
    ['referencias', 'ref', 'Biblioteca'],
  ]],
  ['Resultados', [
    ['testing', 'flask', 'Testing'],
    ['ganadores', 'trophy', 'Ganadores'],
    ['metricas', 'chart', 'Métricas'],
    ['competencia', 'store', 'Competencia'],
  ]],
  ['Operación', [
    ['plan', 'cal', 'Plan de implementación'],
    ['tareas', 'check', 'Tareas'],
  ]],
];

export function counts() {
  const meta = S.metaData?.[PID()]?.anuncios?.length || 0;
  return {
    embudo: mine(S.pieces).filter(p => p.stage).length,
    pipeline: mine(S.pieces).length,
    hooks: mine(S.hooks).length,
    referencias: mine(S.refs).filter(r => !r.stage || !r.conceptId).length,
    testing: meta || '',
    ganadores: mine(S.pieces).filter(p => p.status === 'resultado').length || '',
    metricas: '',
    competencia: (S.competidores || []).length || '',
    plan: '',
    tareas: '',
  };
}

const marcaColor = () => '#84cc16';

export function renderSide() {
  const c = counts();
  const abierta = !!UI.marcaOpen;
  const marca = S.marca || 'NOVA';
  const nRefs = p => S.refs.filter(r => r.productId === p.id).length;
  $('#side').innerHTML = `
   <div class="logo"><div class="mk">${ic('funnel')}</div><div><b>noviitools</b><span>STUDIO ADS</span></div></div>

   <div class="slbl">Marca</div>
   <button class="marca" id="bmarca" aria-expanded="${abierta}">
     <span class="mk" style="background:${marcaColor()}">${esc(marca.charAt(0))}</span>
     <span class="mtx"><b>${esc(marca)}</b><span>${S.products.length} producto${S.products.length === 1 ? '' : 's'}</span></span>
     ${ic('updown', 'sm')}
   </button>
   ${abierta ? `<div class="mardrop">
     <button class="marop on"><span class="mk" style="background:${marcaColor()}">${esc(marca.charAt(0))}</span><span>${esc(marca)}</span>${ic('check','sm')}</button>
     <button class="marop" id="bmarcaren"><span class="mk vacio">${ic('pen','sm')}</span><span>Cambiar el nombre</span></button>
     <button class="marop" id="bmarcanew"><span class="mk vacio">${ic('plus','sm')}</span><span>Nueva marca</span></button>
   </div>` : ''}

   <div class="prodwrap">
     <button class="prodbtn ${esTodos() ? '' : 'on'}" id="bprod" aria-expanded="${!!UI.prodOpen}">
       ${ic('box','sm')}<span>${esc(prod().name)}</span>${ic('chev','sm')}</button>
     ${UI.prodOpen ? `<div class="proddrop">
       ${S.products.length > 5 ? `<label class="prodbuscar">${ic('search','sm')}<input id="bprodq" placeholder="Buscar producto" value="${esc(UI.prodQ || '')}"></label>` : ''}
       <button class="prod ${esTodos() ? 'on' : ''}" data-prod="${TODOS}"><span class="pth vacio"></span><span class="pnm">Todos los productos</span><span class="pn">${S.refs.length}</span></button>
       ${S.products.filter(p => !UI.prodQ || normTxt(p.name).includes(normTxt(UI.prodQ))).map(p => `<button class="prod ${p.id === PID() ? 'on' : ''}" data-prod="${p.id}">
          <span class="pth"></span><span class="pnm">${esc(p.name)}</span><span class="pn">${nRefs(p)}</span></button>`).join('')}
       <button class="prod nuevo" id="bprodnew"><span class="pth vacio">${ic('plus','sm')}</span><span class="pnm">Agregar producto</span></button>
     </div>` : ''}
   </div>

   <div class="sdiv"></div>

   ${VIEWS.map(([g, items]) => `<div class="grp">${g}</div>` + items.map(([id, i, l]) => `
     <button class="nav ${UI.view === id ? 'on' : ''}" data-view="${id}">${ic(i)}<span>${l}</span>${c[id] ? `<span class="n">${c[id]}</span>` : ''}</button>`).join('')).join('')}

   <div class="side-foot">
     <div class="yo"><span class="av">${esc((marca || 'L').charAt(0))}</span><div><b>${esc(S.usuario || 'Luchito')}</b><span>Dueño</span></div>
       <button class="iconbtn" id="bset" aria-label="Ajustes" title="Ajustes">${ic('concept','sm')}</button></div>
     <div class="foot2">
       ${window.__instalar ? `<button id="binstalar">${ic('down','sm')}Instalar</button>` : ''}
       <button id="bexp">Exportar</button>
       <button id="bimp">Importar</button>
       <button id="bout">Salir</button>
     </div>
   </div>`;

  $('#bmarca').onclick = () => { UI.marcaOpen = !UI.marcaOpen; renderSide(); };
  if ($('#bmarcaren')) $('#bmarcaren').onclick = () => {
    const n = prompt('Nombre de la marca', marca);
    if (n && n.trim()) { S.marca = n.trim(); save(); }
    UI.marcaOpen = false; render();
  };
  if ($('#bmarcanew')) $('#bmarcanew').onclick = () => {
    UI.marcaOpen = false; renderSide();
    toast('Por ahora el Studio trabaja con una marca y varios productos. Dime cuándo quieres la segunda y la agrego.');
  };
  $('#bprod').onclick = () => { UI.prodOpen = !UI.prodOpen; renderSide(); };
  document.querySelectorAll('[data-prod]').forEach(b => b.onclick = () => { S.productId = b.dataset.prod; UI.selRef = null; UI.prodOpen = false; save(); render(); });
  if ($('#bprodq')) { const q = $('#bprodq'); q.oninput = () => { UI.prodQ = q.value; renderSide(); $('#bprodq').focus(); }; }
  if ($('#bprodnew')) $('#bprodnew').onclick = () => {
    const n = prompt('Nombre del producto');
    if (!n || !n.trim()) return;
    const code = n.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12) || 'PROD';
    const p = { id: uid('p'), name: n.trim(), code };
    S.products.push(p); S.productId = p.id; S.lanes[p.id] = emptyLanes(); S.seq[p.id] = 0; save(); render();
  };
  document.querySelectorAll('.nav').forEach(b => b.onclick = () => { UI.view = b.dataset.view; abrirNav(false); render(); });
  if ($('#binstalar')) $('#binstalar').onclick = instalarApp;
  $('#bset').onclick = openSettings;
  $('#bout').onclick = async () => { await logout(); location.reload(); };
  $('#bexp').onclick = exportData;
  $('#bimp').onclick = () => $('#importpick').click();
}

/* Instalar la app en el celular: el navegador avisa cuándo se puede y
 * guardamos el aviso para usarlo al tocar el botón. */
export async function instalarApp() {
  const ev = window.__instalar;
  if (!ev) { toast('Abre esta página en Chrome (Android) o Safari (iPhone) para instalarla'); return; }
  ev.prompt();
  const r = await ev.userChoice.catch(() => ({ outcome: 'dismissed' }));
  window.__instalar = null;
  toast(r.outcome === 'accepted' ? 'Instalada: búscala como NOVA Ads' : 'Instalación cancelada');
  renderSide();
}
addEventListener('nova:instalable', () => { if (S && $('#side')) renderSide(); });
