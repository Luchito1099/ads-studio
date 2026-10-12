import { autoExtraer } from "./extraccion.js";
import { renderModal } from "./guion.js";
import { $, PID, S, UI, byId, ensureRef, esc, ic, linkSource, save, thumbCache, toast, uid } from "./nucleo.js";
import { DB } from "./persistencia.js";
import { openRef } from "./ref-detalle.js";
import { render } from "./vista.js";

/** Archivos: miniaturas, subir, arrastrar y el visor a pantalla completa. */

/* ============ MEDIOS ============ */
export function makeThumb(file){
  return new Promise(resolve=>{
    const done=(thumb,meta={})=>resolve({thumb,...meta});
    const draw=(src,w,h)=>{const max=420;const k=Math.min(1,max/Math.max(w,h));const c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);c.getContext('2d').drawImage(src,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.78);};
    const url=URL.createObjectURL(file);
    if(file.type.startsWith('image/')){
      const img=new Image();img.onload=()=>{const t=draw(img,img.naturalWidth,img.naturalHeight);URL.revokeObjectURL(url);done(t,{w:img.naturalWidth,h:img.naturalHeight});};
      img.onerror=()=>{URL.revokeObjectURL(url);done(null);};img.src=url;
    }else if(file.type.startsWith('video/')){
      const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='metadata';
      let fired=false;const fail=setTimeout(()=>{if(!fired){fired=true;URL.revokeObjectURL(url);done(null);}},8000);
      v.onloadedmetadata=()=>{v.currentTime=Math.min(1,(v.duration||2)/3);};
      v.onseeked=()=>{if(fired)return;fired=true;clearTimeout(fail);let t=null;try{t=draw(v,v.videoWidth,v.videoHeight);}catch(e){}
        const meta={w:v.videoWidth,h:v.videoHeight,duration:v.duration};URL.revokeObjectURL(url);done(t,meta);};
      v.onerror=()=>{if(fired)return;fired=true;clearTimeout(fail);URL.revokeObjectURL(url);done(null);};
      v.src=url;
    }else{URL.revokeObjectURL(url);done(null);}
  });
}
export async function addMedia(file){
  const {thumb,w,h,duration}=await makeThumb(file);
  const id=uid('m');const kind=file.type.startsWith('video/')?'video':'image';
  await DB.put('media',{id,blob:file,type:file.type,kind,name:file.name||'pegado',thumb,w,h,duration,size:file.size});
  thumbCache[id]={thumb,kind,duration};
  return id;
}
export async function thumbOf(id){ if(!id)return null; if(thumbCache[id])return thumbCache[id];
  const m=await DB.meta(id); if(!m)return null; thumbCache[id]={thumb:m.thumb,kind:m.kind,duration:m.duration}; return thumbCache[id]; }
export function thumbHTML(id,label='Sin imagen'){
  // placeholder que se hidrata
  return `<div class="thumb" data-thumb="${id||''}">${id?'':`<span>${esc(label)}</span>`}</div>`;
}
export async function hydrateThumbs(root=document){
  const els=[...root.querySelectorAll('[data-thumb]')].filter(e=>e.dataset.thumb&&!e.dataset.ok);
  for(const el of els){ el.dataset.ok='1'; const t=await thumbOf(el.dataset.thumb);
    if(!t){el.innerHTML='<span>Archivo no encontrado</span>';continue;}
    el.innerHTML=(t.thumb?`<img src="${t.thumb}" alt="">`:`<span>${t.kind==='video'?'Video':'Imagen'}</span>`)+
      (t.kind==='video'?`<span class="badge">${ic('video','sm')}${t.duration?fmtDur(t.duration):'Video'}</span>`:'');
  }
}
const fmtDur=s=>{s=Math.round(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
export async function openViewer(id){
  const m=await DB.get('media',id); if(!m)return;
  const url=URL.createObjectURL(m.blob);
  const v=document.createElement('div');v.className='viewer';v.setAttribute('role','dialog');v.setAttribute('aria-label','Vista ampliada');
  v.innerHTML=(m.kind==='video'?`<video src="${url}" controls autoplay></video>`:`<img src="${url}" alt="">`)+`<button class="btn ghost" style="position:fixed;top:16px;right:16px" aria-label="Cerrar">${ic('x')}</button>`;
  const close=()=>{URL.revokeObjectURL(url);v.remove();document.removeEventListener('keydown',k);};
  const k=e=>{if(e.key==='Escape')close();};
  v.addEventListener('click',e=>{if(e.target===v||e.target.closest('button'))close();});
  document.addEventListener('keydown',k);document.body.appendChild(v);
}

/* entrada de archivos: pegar, soltar, elegir */
export function filesFrom(list){return [...(list||[])].filter(f=>f.type.startsWith('image/')||f.type.startsWith('video/'));}
export async function ingest(files,{toPiece=null}={}){
  files=filesFrom(files); if(!files.length){toast('Solo se aceptan imágenes y videos');return;}
  toast(files.length>1?`Procesando ${files.length} archivos…`:'Procesando archivo…');
  const ids=[];for(const f of files){ids.push(await addMedia(f));}
  if(toPiece){ toPiece.mediaIds.push(...ids); UI.modalTab='creativos'; save(); renderModal(); toast(ids.length>1?`${ids.length} archivos agregados a la pieza`:'Archivo agregado a la pieza'); }
  else{
    for(const id of ids){ const m=thumbCache[id]; S.refs.unshift({id:uid('r'),productId:PID(),mediaId:id,kind:m.kind,format:m.kind==='image'?'imagen':'',brand:'',source:'Sin fuente',conceptId:'',angleId:'',stage:'',notes:'',link:'',created:Date.now()}); }
    S.refs.slice(0,ids.length).forEach(r=>autoExtraer(ensureRef(r)));
    save(); UI.view='referencias'; render(); if(ids.length===1)openRef(S.refs[0].id,'datos'); toast(ids.length>1?`${ids.length} referencias guardadas`:'Referencia guardada');
  }
}
document.addEventListener('paste',e=>{
  const tag=(e.target.tagName||'').toLowerCase();
  const files=[...(e.clipboardData?.items||[])].filter(i=>i.kind==='file').map(i=>i.getAsFile()).filter(Boolean);
  if(files.length){ e.preventDefault(); const piece=UI.modal?byId(S.pieces,UI.modal):null; ingest(files,{toPiece:piece}); return; }
  if(tag==='input'||tag==='textarea')return;
  const text=e.clipboardData?.getData('text')||'';
  if(/^https?:\/\//.test(text.trim())&&!UI.modal){ e.preventDefault();
    S.refs.unshift({id:uid('r'),productId:PID(),mediaId:null,kind:'link',brand:'',source:linkSource(text),conceptId:'',angleId:'',stage:'',notes:'',link:text.trim(),created:Date.now()});
    UI.view='referencias';save();render();openRef(S.refs[0].id,'datos');toast('Enlace guardado en la biblioteca');}
});
let pickTarget=null;
// Se escucha desde document: así importar el módulo no toca el DOM todavía.
document.addEventListener('change',e=>{ if(e.target.id!=='filepick')return; ingest(e.target.files,{toPiece:pickTarget}); e.target.value=''; });
export function pick(piece=null){pickTarget=piece;$('#filepick').click();}
window.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files'))e.preventDefault();});
window.addEventListener('drop',e=>{ if(!e.dataTransfer.files.length)return; e.preventDefault(); const piece=UI.modal?byId(S.pieces,UI.modal):null; ingest(e.dataTransfer.files,{toPiece:piece}); });
function dropZone(text){return `<div class="drop" id="drop">
   <div class="ic">${ic('up')}</div>
   <div style="flex-grow:1"><b>${text}</b><div class="hint">Arrastra aquí los videos que descargas con Nova Swipe, pega una captura con <kbd>Ctrl</kbd> + <kbd>V</kbd> o pega el enlace del anuncio.</div></div>
   <button class="btn" id="bpick">${ic('up')}Subir archivos</button></div>`;}
function wireDrop(piece=null){
  const d=$('#drop'); if(!d)return;
  d.addEventListener('dragover',e=>{e.preventDefault();d.classList.add('over');});
  d.addEventListener('dragleave',()=>d.classList.remove('over'));
  d.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();d.classList.remove('over');ingest(e.dataTransfer.files,{toPiece:piece});});
  $('#bpick').onclick=()=>pick(piece);
}
