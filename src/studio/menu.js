import { logout } from "../storage.js";
import { exportData, openSettings } from "./ajustes.js";
import { $, PID, S, UI, emptyLanes, esc, ic, mine, save, toast, uid } from "./nucleo.js";
import { abrirNav, render } from "./vista.js";

/** El menú lateral: las dos familias de pantallas, la marca y el pie. */

const VIEWS=[
  ['Creativos',[['embudo','funnel','Embudo'],['pipeline','pipe','Content Pipeline'],['hooks','hook','Hooks'],['referencias','ref','Biblioteca'],['conceptos','concept','Formatos'],['angulos','angle','Ángulos de venta'],['ideas','spark','Ideas de contenido']]],
  ['Resultados',[['analisis','pareto','Análisis 80/20'],['fatiga','battery','Fatiga'],['competencia','store','Competencia'],['tracker','chart','Tracker']]]];
export function counts(){return {ideas:mine(S.ideas).filter(i=>['nueva','aprobada'].includes(i.estado)).length,referencias:mine(S.refs).length,angulos:mine(S.angles).length,conceptos:S.concepts.length,hooks:mine(S.hooks).length,pipeline:mine(S.pieces).length,embudo:mine(S.pieces).filter(p=>p.stage).length,tracker:mine(S.pieces).filter(p=>['lanzado','testing','resultado'].includes(p.status)).length,analisis:S.metaData?.[PID()]?.anuncios?.length||'',fatiga:S.metaData?.[PID()]?.anuncios?.length?'':'',competencia:(S.competidores||[]).length||''};}
export function renderSide(){
  const c=counts();
  $('#side').innerHTML=`
   <div class="logo"><div class="mk">${ic('funnel')}</div><div><b>novitools</b><span>STUDIO ADS</span></div></div>
   <div class="marca"><span class="mk">${esc((S.marca||'NOVA').charAt(0))}</span><div style="min-width:0"><b>${esc(S.marca||'NOVA')}</b><span>${S.products.length} producto${S.products.length===1?'':'s'}</span></div></div>
   <div class="prod"><label for="prodsel">Producto</label>
     <select id="prodsel">${S.products.map(p=>`<option value="${p.id}" ${p.id===PID()?'selected':''}>${esc(p.name)}</option>`).join('')}<option value="__new">+ Agregar producto</option></select></div>
   ${VIEWS.map(([g,items])=>`<div class="grp">${g}</div>`+items.map(([id,i,l])=>`<button class="nav ${UI.view===id?'on':''}" data-view="${id}">${ic(i)}<span>${l}</span><span class="n">${c[id]}</span></button>`).join('')).join('')}
   <div class="side-foot">
     ${window.__instalar?`<button id="binstalar">${ic('down','sm')}Instalar en el celular</button>`:''}
     <button id="bset">Ajustes</button>
     <button id="bexp">Exportar datos</button>
     <button id="bimp">Importar datos</button>
     <button id="bout">Cerrar sesión</button>
   </div>`;
  $('#prodsel').onchange=e=>{ if(e.target.value==='__new'){ const n=prompt('Nombre del producto');
      if(n&&n.trim()){const code=n.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,12)||'PROD';const p={id:uid('p'),name:n.trim(),code};S.products.push(p);S.productId=p.id;S.lanes[p.id]=emptyLanes();S.seq[p.id]=0;save();}
      render();return;}
    S.productId=e.target.value;UI.selRef=null;save();render();};
  document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{UI.view=b.dataset.view;abrirNav(false);render();});
  if($('#binstalar'))$('#binstalar').onclick=instalarApp;
  $('#bset').onclick=openSettings;$('#bout').onclick=async()=>{await logout();location.reload();};$('#bexp').onclick=exportData;$('#bimp').onclick=()=>$('#importpick').click();
}
/* Instalar la app en el celular: Chrome avisa cuándo se puede y guardamos el
 * aviso para usarlo al tocar el botón. */
export async function instalarApp(){
  const ev=window.__instalar;
  if(!ev){ toast('Abre el Studio en Chrome del celular y toca “Instalar aplicación” en su menú'); return; }
  ev.prompt();
  const r=await ev.userChoice.catch(()=>({outcome:'dismissed'}));
  window.__instalar=null;
  toast(r.outcome==='accepted'?'Instalada: búscala como NOVA Ads':'Instalación cancelada');
  renderSide();
}
addEventListener('nova:instalable',()=>{ if(S&&$('#side'))renderSide(); });
