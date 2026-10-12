import { $, esc, ic } from "./nucleo.js";

/** El marco de cada pantalla: cabecera, menú del celular y formularios chicos. */

let pintar=()=>{};
/** El arranque registra aquí cómo se pinta la pantalla actual. */
export function alPintar(fn){ pintar=fn; }
/** Vuelve a pintar la pantalla actual. */
export function render(){ pintar(); }

export function setTop(title,sub,actions=''){
  $('#top').innerHTML=`<button class="menubtn" id="navtog" aria-label="Abrir el menú">${ic('hook')}</button>
    <div class="tit"><p>${esc(sub)}</p><h1>${esc(title)}</h1></div><div class="act">${actions}</div>`;
  $('#navtog').onclick=()=>abrirNav(true);
}
/* En el celular el menú es un cajón que se corre desde la izquierda. */
export function abrirNav(abrir){
  document.body.classList.toggle('nav-abierta',abrir);
  const f=$('#navfondo'); if(f){ f.hidden=!abrir; f.onclick=()=>abrirNav(false); }
}

/* ============ FORMULARIOS GENÉRICOS ============ */
export function formModal(title,inner,onSave,onDelete){
  const ov=document.createElement('div');ov.className='ov';
  ov.innerHTML=`<div class="modal" style="max-width:560px" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="mh"><b>${esc(title)}</b><button class="btn ghost sm" style="margin-left:auto" data-c aria-label="Cerrar">${ic('x','sm')}</button></div>
    <div style="padding:18px;display:flex;flex-direction:column;gap:12px">${inner}</div>
    <div class="mf">${onDelete?'<button class="btn danger" data-d style="margin-right:auto">Eliminar</button>':''}<button class="btn ghost" data-c>Cancelar</button><button class="btn" data-s>Guardar</button></div></div>`;
  document.body.appendChild(ov);
  const close=()=>ov.remove();
  ov.querySelectorAll('[data-c]').forEach(b=>b.onclick=close);
  ov.addEventListener('mousedown',e=>{if(e.target===ov)close();});
  ov.querySelector('[data-s]').onclick=()=>{if(onSave()!==false)close();};
  if(onDelete)ov.querySelector('[data-d]').onclick=()=>{if(onDelete()!==false)close();};
  ov.querySelector('input,textarea,select')?.focus();
}
