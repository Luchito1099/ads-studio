import { abrirAsignar } from "./asignar.js";
import { JOBS, autoExtraer, progHTML, runExtract, tstr } from "./extraccion.js";
import { copyText } from "./guion.js";
import { makeThumb, pick, thumbHTML } from "./medios.js";
import { renderSide } from "./menu.js";
import { $, avisoGuardado, byId, diasActivo, ensureRef, esc, fechaISO, FORMATS, ic, linkSource, mine, normTxt, opt, PID, pidReal, prod, S, save, stageOpt, thumbCache, toast, UI, uid } from "./nucleo.js";
import { DB } from "./persistencia.js";
import { openRef, sugerencias } from "./ref-detalle.js";
import { render, setTop } from "./vista.js";

/** Biblioteca de anuncios: la rejilla, los filtros y lo que llega de Nova Swipe. */

/* ---- fuentes, colecciones y canales ---- */
const SOURCE_GROUPS=[
  ['Anuncios pagados',[['Biblioteca de Meta','book','#2563eb'],['TikTok Creative Center','spark','#0f172a']]],
  ['Redes sociales',[['Facebook','globe','#1d4ed8'],['Instagram','insta','#db2777'],['TikTok','music','#0f172a'],['YouTube','yt','#dc2626'],['Pinterest','pin','#be123c']]],
  ['Otros',[['Tienda de la competencia','store','#7c3aed'],['Grabación propia','video','#0d9488'],['Sin fuente','up','#64748b'],['Otro enlace','link','#64748b']]]
];
const SOURCE_INFO=Object.fromEntries(SOURCE_GROUPS.flatMap(([,l])=>l.map(([n,i,c])=>[n,{icon:i,color:c}])));
const srcIcon=(s,cls='sm')=>{const x=SOURCE_INFO[s]||SOURCE_INFO['Otro enlace'];return `<span style="color:${x.color};display:inline-flex">${ic(x.icon,cls)}</span>`;};
/* Los canales del diseño: lo demás (grabación propia, enlaces sueltos) se
 * agrupa en "Otros" para que la fila de filtros no se haga interminable. */
const CANALES=[['Biblioteca de Meta','Meta Ads'],['TikTok','TikTok'],['Instagram','Instagram'],['Facebook','Facebook'],['YouTube','YouTube'],['Pinterest','Pinterest']];
const sinAsignar=r=>!r.stage||!r.conceptId;
export const libCollections=()=>{ if(!S.libCollections)S.libCollections=[]; const set=new Set(S.libCollections); S.refs.forEach(r=>{if(r.collection&&!set.has(r.collection)){set.add(r.collection);S.libCollections.push(r.collection);}}); return S.libCollections; };
const SORTS=[['recientes','Más recientes'],['antiguas','Más antiguas'],['calificadas','Mejor calificadas'],['marca','Marca (A–Z)'],['duracion','Más cortos']];
const TIPOS=[['','Todo tipo'],['video','Video'],['imagen','Imagen'],['carrusel','Carrusel'],['link','Solo enlace']];

function libState(){ return UI.lib||(UI.lib={scope:'producto',tab:'todas',fuente:'',coleccion:'',marca:'',formato:'',etapa:'',concepto:'',angulo:'',q:'',orden:'recientes',vista:'grid'}); }
function libScope(){ const f=libState(); return S.refs.map(ensureRef).filter(r=>f.scope==='todos'||r.productId===PID()); }
function libFiltered(){
  const f=libState(); const q=normTxt(f.q);
  const list=libScope().filter(r=>
    (f.tab==='todas'||(f.tab==='clasificar'&&sinAsignar(r))||(f.tab==='asignados'&&!sinAsignar(r))||(f.tab==='favoritas'&&r.fav)||(f.tab==='guion'&&r.extract.status==='listo'))
    &&(!f.fuente||(f.fuente==='otros'?!CANALES.some(([c])=>c===r.source):r.source===f.fuente))&&(!f.coleccion||r.collection===f.coleccion)&&(!f.marca||r.brand===f.marca)
    &&(!f.formato||(f.formato==='link'?r.kind==='link':r.format===f.formato||(f.formato==='video'&&r.kind==='video'&&!r.format)||(f.formato==='imagen'&&r.kind==='image'&&!r.format)))
    &&(!f.etapa||r.stage===f.etapa)&&(!f.concepto||r.conceptId===f.concepto)&&(!f.angulo||r.angleId===f.angulo)
    &&(!q||normTxt([r.brand,r.adId,r.notes,r.collection,r.link,r.source,r.adText,...(r.extract.transcript||[]).map(t=>t.text),...(r.extract.ocr||[]).map(o=>o.text),r.extract.analysis?JSON.stringify(r.extract.analysis):''].join(' ')).includes(q)));
  const cmp={recientes:(a,b)=>(b.created||0)-(a.created||0),antiguas:(a,b)=>(a.created||0)-(b.created||0),calificadas:(a,b)=>(b.rating||0)-(a.rating||0)||(b.fav?1:0)-(a.fav?1:0),
    marca:(a,b)=>(a.brand||'~').localeCompare(b.brand||'~','es'),duracion:(a,b)=>(a.extract.duration||thumbCache[a.mediaId]?.duration||9999)-(b.extract.duration||thumbCache[b.mediaId]?.duration||9999)}[f.orden];
  return list.sort(cmp);
}
/** "Hoy", "Ayer", "Hace 3 días"… para la esquina de cada tarjeta. */
function cuando(ms){
  if(!ms)return '';
  const d=Math.floor((Date.now()-ms)/86400000);
  if(d<=0)return 'Hoy'; if(d===1)return 'Ayer'; if(d<7)return `Hace ${d} días`;
  if(d<30)return `Hace ${Math.floor(d/7)} sem`;
  return new Date(ms).toLocaleDateString('es-PE',{day:'2-digit',month:'short'});
}
export function vRefs(){
  const f=libState(); const all=libScope(); const list=libFiltered();
  const cnt=fn=>all.filter(fn).length;
  const bandejaIds=all.filter(sinAsignar).map(r=>r.id);
  const brands=Object.entries(all.reduce((o,r)=>{if(r.brand)o[r.brand]=(o[r.brand]||0)+1;return o;},{})).sort((a,b)=>b[1]-a[1]);
  const cols=libCollections();
  const pend=all.filter(r=>r.mediaId&&r.extract.status!=='listo'&&!JOBS[r.id]).length;
  const hayFiltros=f.fuente||f.coleccion||f.marca||f.formato||f.etapa||f.concepto||f.angulo||f.q;
  const canalN=s=>all.filter(r=>s==='otros'?!CANALES.some(([c])=>c===r.source):r.source===s).length;
  setTop('Biblioteca',`${esc(S.marca||'NOVA')} · ${f.scope==='todos'?'todos los productos':prod().name}`,
    `<div class="lsearch">${ic('search','sm')}<label class="visually-hidden" for="lq">Buscar en la biblioteca</label><input id="lq" value="${esc(f.q)}" placeholder="Buscar marca, frase dicha o texto en pantalla…"></div>
     ${pend?`<button class="btn ghost" id="lall" title="Extraer el guion de los anuncios que aún no lo tienen">Extraer pendientes (${pend})</button>`:''}
     <div class="menuwrap"><button class="btn" id="ladd" aria-haspopup="true" aria-expanded="false">${ic('plus','sm')}Agregar</button>
       <div class="menu" id="laddmenu" hidden>
         <button data-add="subir">${ic('up','sm')}<span><b>Subir videos o imágenes</b><small>Varios a la vez</small></span></button>
         <button data-add="enlace">${ic('link','sm')}<span><b>Pegar un enlace</b><small>Biblioteca de Meta, TikTok, Instagram…</small></span></button>
         <button data-add="ext">${ic('ext','sm')}<span><b>Extensión Nova Swipe</b><small>Captura desde Chrome</small></span></button>
       </div></div>`);
  const fchip=(key,val,label,n,extra='')=>`<button class="fchip ${f[key]===val?'on':''}" data-lf="${key}" data-v="${esc(val)}" aria-pressed="${f[key]===val}">${extra}${esc(label)}${n!==undefined?`<em>${n}</em>`:''}</button>`;
  $('#body').innerHTML=`${avisoBandeja()}
   ${bandejaIds.length?`<section class="lbandeja">
     <span class="lbico">${ic('down')}</span>
     <div style="min-width:0">
       <b>${bandejaIds.length} anuncio${bandejaIds.length===1?'':'s'} sin asignar</b>
       <p>Ponles etapa y formato para que aparezcan en el Embudo y cuenten en los reportes. Son ${bandejaIds.length===1?'uno':'unos pocos'} clics.</p>
       <div class="lbchips">${Object.entries(all.filter(sinAsignar).reduce((o,r)=>{const k=r.brand||'Sin marca';o[k]=(o[k]||0)+1;return o;},{})).sort((a,b)=>b[1]-a[1]).slice(0,5)
         .map(([b,n])=>`<span>${n} ${esc(b)}</span>`).join('')}</div>
     </div>
     <button class="btn claro" id="lrevisar">Revisar bandeja</button>
   </section>`:''}
   <div class="lmain">
     <div class="ltabs">
       <div class="segtabs" role="group" aria-label="Estado">
       ${[['todas','Todos',all.length],['clasificar','Sin asignar',cnt(sinAsignar)],['asignados','Asignados',cnt(r=>!sinAsignar(r))],['favoritas','Favoritas',cnt(r=>r.fav)],['guion','Con guion',cnt(r=>r.extract.status==='listo')]]
         .map(([k,l,n])=>`<button class="${f.tab===k?'on':''}" data-tab="${k}" aria-pressed="${f.tab===k}">${l}<span>${n}</span></button>`).join('')}
       </div>
       <span style="margin-left:auto;display:flex;gap:8px;align-items:center">
         <label class="visually-hidden" for="lsort">Ordenar</label><select id="lsort" class="fsel">${SORTS.map(([k,l])=>`<option value="${k}" ${f.orden===k?'selected':''}>${l}</option>`).join('')}</select>
         <div class="vtog" role="group" aria-label="Vista"><button data-vista="grid" class="${f.vista==='grid'?'on':''}" aria-label="Cuadrícula">${ic('ref','sm')}</button><button data-vista="lista" class="${f.vista==='lista'?'on':''}" aria-label="Lista">${ic('hook','sm')}</button></div>
       </span>
     </div>
     <div class="lfilters">
       ${S.products.length>1?`<label class="visually-hidden" for="lfp">Producto</label><select id="lfp" class="fsel" data-scopesel>
         <option value="producto">${esc(prod().name)}</option><option value="todos" ${f.scope==='todos'?'selected':''}>Todos los productos</option></select>`:''}
       <div class="fchips" role="group" aria-label="Tipo">${TIPOS.map(([v,l])=>fchip('formato',v,l)).join('')}</div>
       ${brands.length?`<label class="visually-hidden" for="lfm">Marca del anuncio</label><select id="lfm" class="fsel" data-sel="marca"><option value="">Todas las marcas</option>${brands.map(([b,n])=>`<option value="${esc(b)}" ${f.marca===b?'selected':''}>${esc(b)} (${n})</option>`).join('')}</select>`:''}
       ${cols.length?`<label class="visually-hidden" for="lfcol">Colección</label><select id="lfcol" class="fsel" data-sel="coleccion"><option value="">Colecciones</option>${cols.map(c=>`<option value="${esc(c)}" ${f.coleccion===c?'selected':''}>${esc(c)}</option>`).join('')}</select>`:''}
       <label class="visually-hidden" for="lfe">Etapa</label><select id="lfe" class="fsel" data-sel="etapa">${stageOpt(f.etapa,'Etapa')}</select>
       <label class="visually-hidden" for="lfc">Formato</label><select id="lfc" class="fsel" data-sel="concepto">${opt(S.concepts,f.concepto,'Formato')}</select>
       <label class="visually-hidden" for="lfa">Ángulo</label><select id="lfa" class="fsel" data-sel="angulo">${opt(f.scope==='todos'?S.angles:mine(S.angles),f.angulo,'Ángulo')}</select>
       ${hayFiltros?'<button class="linkbtn" id="lclear">Limpiar filtros</button>':''}
       <span class="muted" style="margin-left:auto;font-size:13px">${list.length} anuncio${list.length===1?'':'s'}</span>
     </div>
     <div class="lcanal" role="group" aria-label="Canal">
       <span class="lcl">Canal</span>
       ${fchip('fuente','','Todos',all.length)}
       ${CANALES.map(([v,l])=>fchip('fuente',v,l,canalN(v),`<i class="dot" style="background:${SOURCE_INFO[v].color}"></i>`)).join('')}
       ${canalN('otros')?fchip('fuente','otros','Otros',canalN('otros')):''}
       <button class="linkbtn" id="lcomp" style="margin-left:auto">${ic('store','sm')}Vigilar competencia</button>
     </div>
     ${list.length?(f.vista==='grid'?`<div class="lib">${list.map(libCard).join('')}</div>`:libTable(list))
       :all.length?`<div class="empty">${f.tab==='clasificar'?'Todo asignado: la bandeja está vacía.':'Nada coincide con estos filtros.'} <button class="linkbtn" id="lclear2">Limpiar filtros</button></div>`
       :`<div class="lempty">
          <h2>Tu biblioteca de anuncios empieza aquí</h2>
          <p>Todo lo que te inspire, venga de donde venga, queda en un solo lugar con su guion extraído.</p>
          <div class="lempty-cards">
            <button data-add="ext">${ic('ext')}<b>Captura con Nova Swipe</b><span>Desde la Biblioteca de anuncios, TikTok o Instagram, con un clic.</span></button>
            <button data-add="subir">${ic('up')}<b>Sube videos o imágenes</b><span>Varios a la vez. También puedes soltarlos en cualquier parte de esta pantalla.</span></button>
            <button data-add="enlace">${ic('link')}<b>Pega un enlace</b><span>Queda guardado con su fuente y le adjuntas el video después.</span></button>
          </div>
          <p class="hint">Atajo: copia una captura y presiona <kbd>Ctrl</kbd> + <kbd>V</kbd>.</p>
        </div>`}
   </div>`;
  // búsqueda
  const lq=$('#lq'); lq.oninput=()=>{f.q=lq.value;clearTimeout(lq._t);lq._t=setTimeout(()=>{const pos=lq.selectionStart;render();const n=$('#lq');n.focus();n.setSelectionRange(pos,pos);},250);};
  if($('#lall'))$('#lall').onclick=async()=>{for(const r of all.filter(r=>r.mediaId&&r.extract.status!=='listo')){await runExtract(r,{voz:true,texto:true});}};
  // menú agregar
  const menu=$('#laddmenu'),ladd=$('#ladd');
  ladd.onclick=e=>{e.stopPropagation();menu.hidden=!menu.hidden;ladd.setAttribute('aria-expanded',String(!menu.hidden));};
  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{menu.hidden=true;const a=b.dataset.add;if(a==='subir')pick();else if(a==='enlace')addLink();else openExtension();});
  $('#lcomp').onclick=()=>{UI.view='competencia';render();};
  if($('#lrevisar'))$('#lrevisar').onclick=()=>abrirAsignar(bandejaIds[0],bandejaIds);
  if($('#lbandeja'))$('#lbandeja').onclick=async()=>{toast('Revisando la bandeja…');await traerBandeja();if(!bandeja.pendientes&&!bandeja.error)toast('Bandeja vacía: no hay nada esperando');render();};
  // filtros
  document.querySelectorAll('[data-lf]').forEach(b=>b.onclick=()=>{const k=b.dataset.lf,v=b.dataset.v;f[k]=f[k]===v&&v?'':v;render();});
  document.querySelectorAll('.ltabs [data-tab]').forEach(b=>b.onclick=()=>{f.tab=b.dataset.tab;render();});
  document.querySelectorAll('[data-sel]').forEach(s=>s.onchange=()=>{f[s.dataset.sel]=s.value;render();});
  if($('#lfp'))$('#lfp').onchange=e=>{f.scope=e.target.value;render();};
  const limpiar=()=>{Object.assign(f,{fuente:'',coleccion:'',marca:'',formato:'',etapa:'',concepto:'',angulo:'',q:''});render();};
  if($('#lclear'))$('#lclear').onclick=limpiar; if($('#lclear2'))$('#lclear2').onclick=limpiar;
  $('#lsort').onchange=e=>{f.orden=e.target.value;render();};
  document.querySelectorAll('[data-vista]').forEach(b=>b.onclick=()=>{f.vista=b.dataset.vista;render();});
  // tarjetas
  document.querySelectorAll('[data-fav]').forEach(b=>b.onclick=e=>{e.stopPropagation();const r=byId(S.refs,b.dataset.fav);r.fav=!r.fav;save();render();});
  document.querySelectorAll('[data-asignar]').forEach(b=>b.onclick=e=>{e.stopPropagation();abrirAsignar(b.dataset.asignar,bandejaIds);});
  // "Asignar" a secas acepta la sugerencia de la IA sin abrir el popup
  document.querySelectorAll('[data-acepta]').forEach(b=>b.onclick=e=>{e.stopPropagation();
    const r=byId(S.refs,b.dataset.acepta),s=sugerencias(r);
    const c=S.concepts.find(x=>normTxt(x.name)===normTxt(s.concepto));
    if(!s.stage||!c)return abrirAsignar(r.id,bandejaIds);
    r.stage=s.stage;r.conceptId=c.id;save();toast(`Asignado a ${s.stage} · ${c.name}`);render();});
  document.querySelectorAll('.libcard,.lrow').forEach(c=>{
    c.onclick=()=>openRef(c.dataset.id);
    c.onkeydown=e=>{if(e.key==='Enter')openRef(c.dataset.id);};
    const r=byId(S.refs,c.dataset.id); if(r.kind!=='video'||!r.mediaId||!c.classList.contains('libcard'))return;
    let url=null,vid=null,tm=null;
    c.addEventListener('mouseenter',()=>{tm=setTimeout(async()=>{const m=await DB.get('media',r.mediaId);if(!m?.blob)return;url=URL.createObjectURL(m.blob);vid=document.createElement('video');vid.src=url;vid.muted=true;vid.loop=true;vid.playsInline=true;vid.className='hoverv';c.querySelector('.thumb').appendChild(vid);vid.play().catch(()=>{});},350);});
    c.addEventListener('mouseleave',()=>{clearTimeout(tm);if(vid){vid.remove();vid=null;}if(url){URL.revokeObjectURL(url);url=null;}});
  });
}
function addLink(){
  const u=prompt('Pega el enlace del anuncio (Biblioteca de Meta, TikTok, Instagram…)');
  if(!u||!/^https?:\/\//.test(u.trim())){if(u)toast('Eso no parece un enlace');return;}
  S.refs.unshift({id:uid('r'),productId:pidReal(),mediaId:null,kind:'link',brand:'',source:linkSource(u),conceptId:'',angleId:'',stage:'',notes:'',link:u.trim(),created:Date.now()});
  save();render();openRef(S.refs[0].id,'datos');toast('Enlace guardado');
}
/** Todas las tarjetas miden lo mismo: miniatura fija arriba y ficha abajo. */
function libCard(r){
  const ex=r.extract; const ready=ex.status==='listo';
  const hook=ready?(ex.analysis?.hook?.texto||ex.blocks[0]?.voz||ex.blocks[0]?.texto||''):'';
  const dur=ex.duration||thumbCache[r.mediaId]?.duration;
  const tipo=r.kind==='link'?'Enlace':r.format==='carrusel'?'Carrusel':r.kind==='image'?'Imagen':'Video';
  const dias=r.startedAt?diasActivo(r):null;
  const con=byId(S.concepts,r.conceptId);
  const sug=sinAsignar(r)?sugerencias(r):null;
  const canal=(CANALES.find(([c])=>c===r.source)||[r.source,r.source])[1];
  return `<article class="libcard" data-id="${r.id}" tabindex="0" role="button" aria-label="Abrir ${esc(r.brand||'anuncio')}">
    ${r.kind==='link'
      ?`<div class="thumb enlace">${srcIcon(r.source,'')}<span>${esc(r.source)}</span><small>Solo enlace · adjunta el archivo para extraer el guion</small></div>`
      :`<div class="thumb" data-thumb="${r.mediaId}"></div>`}
    ${hook?`<span class="hookover">${esc(hook.slice(0,80))}</span>`:''}
    <span class="tipotag">${esc(tipo)}</span>
    ${dias!=null?`<span class="diastag">${dias}d</span>`:dur?`<span class="diastag">${tstr(dur)}</span>`:''}
    <button class="favbtn ${r.fav?'on':''}" data-fav="${r.id}" aria-label="${r.fav?'Quitar de favoritas':'Marcar como favorita'}" aria-pressed="${!!r.fav}">${ic('star','sm')}</button>
    <span class="srcpill"><i class="dot" style="background:${(SOURCE_INFO[r.source]||SOURCE_INFO['Otro enlace']).color}"></i>${esc(canal)}</span>
    <div class="lb">
      <div class="lrow1"><b>${esc(r.brand||'Sin marca')}</b><span>${cuando(r.created)}</span></div>
      <div class="lrow2"><i class="dot" style="background:#84cc16"></i><b>${esc(S.marca||'NOVA')}</b><span class="lprod">· ${esc(byId(S.products,r.productId)?.name||'sin producto')}</span>${ex.status==='error'?'<span class="chip lose sm">Error</span>':''}</div>
      ${sinAsignar(r)
        ?`<div class="liasug">${sug&&(sug.stage||sug.concepto)?`<span class="iatag">IA sugiere</span>${sug.stage?`<span class="chip ${sug.stage}">${sug.stage}</span>`:''}${sug.concepto?`<b>${esc(sug.concepto)}</b>`:''}`:'<span class="hint">Sin etapa ni formato</span>'}</div>
         <div class="lacc">${sug&&sug.stage&&sug.concepto?`<button class="btn sm" data-acepta="${r.id}" title="Acepta la sugerencia de la IA">Asignar</button>`:''}<button class="btn ghost sm" data-asignar="${r.id}">${sug&&sug.stage&&sug.concepto?'Cambiar':'Asignar'}</button></div>`
        :`<div class="lasig">
            <span class="chip ${r.stage}">${r.stage}</span>
            <span class="lfmt">${esc(con?.name||'Sin formato')}</span>
            ${r.angleId?`<span class="chip ang sm">${esc(byId(S.angles,r.angleId)?.name||'')}</span>`:''}
            <button class="lcambiar" data-asignar="${r.id}">Cambiar</button>
          </div>`}
      ${progHTML(r.id)}
    </div></article>`;
}
function libTable(list){
  return `<div class="panel" style="overflow:auto"><table><thead><tr><th></th><th>Marca</th><th>Canal</th><th>Tipo</th><th>Etapa</th><th>Formato</th><th>Colección</th><th>Guion</th><th>Agregado</th><th></th></tr></thead><tbody>
  ${list.map(r=>`<tr class="lrow" data-id="${r.id}" tabindex="0" style="cursor:pointer">
    <td style="width:52px"><div style="width:40px;height:52px">${r.mediaId?thumbHTML(r.mediaId):`<div class="thumb" style="height:52px;background:#f1f5f9">${srcIcon(r.source)}</div>`}</div></td>
    <td><b>${esc(r.brand||'Sin marca')}</b>${r.notes?`<div class="muted" style="font-size:12px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.notes)}</div>`:''}</td>
    <td><span style="display:inline-flex;gap:5px;align-items:center">${srcIcon(r.source)}${esc(r.source)}</span></td>
    <td>${esc(FORMATS.find(x=>x[0]===r.format)?.[1]||(r.kind==='link'?'Enlace':'—'))}</td>
    <td>${r.stage?`<span class="chip ${r.stage}">${r.stage}</span>`:'—'}</td>
    <td>${esc(byId(S.concepts,r.conceptId)?.name||'—')}</td>
    <td>${esc(r.collection||'—')}</td>
    <td>${r.extract.status==='listo'?'<span class="chip win">Listo</span>':r.extract.status==='error'?'<span class="chip lose">Error</span>':'—'}</td>
    <td class="muted">${r.created?new Date(r.created).toLocaleDateString('es-PE',{day:'2-digit',month:'short'}):''}</td>
    <td><button class="favbtn inline ${r.fav?'on':''}" data-fav="${r.id}" aria-label="${r.fav?'Quitar de favoritas':'Marcar como favorita'}" aria-pressed="${!!r.fav}">${ic('star','sm')}</button></td>
  </tr>`).join('')}</tbody></table></div>`;
}

document.addEventListener('click',e=>{const m=document.getElementById('laddmenu');if(m&&!m.hidden&&!e.target.closest('.menuwrap')){m.hidden=true;document.getElementById('ladd')?.setAttribute('aria-expanded','false');}});
document.addEventListener('keydown',e=>{const m=document.getElementById('laddmenu');if(e.key==='Escape'&&m&&!m.hidden){m.hidden=true;document.getElementById('ladd')?.focus();}});

/* ---- extensión Nova Swipe ---- */
export async function openExtension(){
  let st={};
  try{const r=await fetch('/api/swipe/status',{credentials:'same-origin'});st=r.ok?await r.json():{};}catch{}
  const ov=document.createElement('div');ov.className='ov';
  const cuando=st.ultimoUso?new Date(st.ultimoUso).toLocaleString('es-PE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):null;
  ov.innerHTML=`<div class="modal" style="max-width:720px" role="dialog" aria-modal="true" aria-labelledby="xt">
    <div class="mh">${ic('ext')}<b id="xt">Extensión Nova Swipe</b>${cuando?`<span class="chip win">Conectada · último envío ${cuando}</span>`:'<span class="chip">Sin envíos todavía</span>'}<button class="btn ghost sm" data-c style="margin-left:auto" aria-label="Cerrar">${ic('x','sm')}</button></div>
    <div style="padding:18px;display:flex;flex-direction:column;gap:14px">
      <p style="margin:0;line-height:1.5">Guarda anuncios de la <b>Biblioteca de anuncios de Meta</b>, TikTok, Instagram, Facebook, YouTube o cualquier web directo a esta biblioteca, con su video o imagen, la marca y el enlace.</p>
      <div class="grid2">
        <div class="panel" style="padding:12px;display:flex;flex-direction:column;gap:8px"><b>1. Descárgala</b><span class="hint">Viene lista para usar: ya trae la dirección de tu Studio y tu clave.</span><button class="btn sm" id="xdl" style="align-self:flex-start">${ic('up','sm')}Descargar extensión (.zip)</button></div>
        <div class="panel" style="padding:12px;display:flex;flex-direction:column;gap:8px"><b>2. Instálala en Chrome</b><ol class="hint" style="margin:0;padding-left:18px;line-height:1.6"><li>Descomprime el .zip en una carpeta que no vayas a borrar.</li><li>Abre <code>chrome://extensions</code> y activa <b>Modo de desarrollador</b>.</li><li>Pulsa <b>Cargar descomprimida</b> y elige la carpeta.</li><li>Fíjala en la barra con el ícono de la pieza de rompecabezas.</li></ol></div>
      </div>
      <div class="panel" style="padding:12px;display:flex;flex-direction:column;gap:6px"><b>3. Úsala</b>
        <ul class="hint" style="margin:0;padding-left:18px;line-height:1.6;list-style:disc">
          <li><b>Clic derecho</b> sobre un video, imagen o enlace → <i>Guardar en Nova Studio</i>.</li>
          <li><b>Ícono de la extensión</b> → elige el producto, la marca y los videos o imágenes detectados en la página, y pulsa <i>Enviar</i>.</li>
          <li>Lo enviado aparece en esta biblioteca en unos segundos, en <b>Por clasificar</b>.</li>
        </ul></div>
      <div class="panel" style="padding:12px;display:flex;flex-direction:column;gap:8px;background:#f8fafc">
        <b>Clave de conexión</b>
        <div style="display:flex;gap:6px"><label class="visually-hidden" for="xkey">Clave</label><input id="xkey" readonly value="${esc(st.clave||'')}" type="password" style="flex-grow:1;height:34px;border:1px solid var(--line);border-radius:8px;padding:0 10px;font-family:var(--mono);font-size:12px"><button class="btn ghost sm" id="xshow">Mostrar</button><button class="btn ghost sm" id="xcopy">Copiar</button><button class="btn ghost sm" id="xnew">Regenerar</button></div>
        <span class="hint">Si instalaste la extensión desde otro lado o regeneras la clave, pégala en las opciones de la extensión junto con esta dirección: <code>${esc(location.origin)}</code></span>
      </div>
      <details class="hint"><summary style="cursor:pointer">Publicarla en Chrome Web Store</summary>
        <p style="margin:6px 0">Descarga la versión sin clave, crea una cuenta de desarrollador en Chrome Web Store (pago único de USD 5) y sube el .zip. Después de la revisión de Google se instala como cualquier extensión y cada persona pega su dirección y clave en las opciones.</p>
        <button class="btn ghost sm" id="xdlstore">Descargar versión para Chrome Web Store</button></details>
    </div></div>`;
  document.body.appendChild(ov);
  const q=s=>ov.querySelector(s); const close=()=>ov.remove();
  ov.querySelectorAll('[data-c]').forEach(b=>b.onclick=close); ov.addEventListener('mousedown',e=>{if(e.target===ov)close();});
  const bajar=async(conClave)=>{
    try{const r=await fetch(`/api/swipe/extension.zip${conClave?'?config=1':''}`,{credentials:'same-origin'});if(!r.ok)throw new Error(`Error ${r.status}`);
      const a=document.createElement('a');a.href=URL.createObjectURL(await r.blob());a.download=conClave?'nova-swipe.zip':'nova-swipe-webstore.zip';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);
      toast('Extensión descargada');}catch(e){toast('No se pudo descargar: '+e.message);}
  };
  q('#xdl').onclick=()=>bajar(true); q('#xdlstore').onclick=()=>bajar(false);
  q('#xshow').onclick=()=>{const k=q('#xkey');k.type=k.type==='password'?'text':'password';q('#xshow').textContent=k.type==='password'?'Mostrar':'Ocultar';};
  q('#xcopy').onclick=async()=>{toast(await copyText(q('#xkey').value)?'Clave copiada':'No se pudo copiar');};
  q('#xnew').onclick=async()=>{if(!confirm('La extensión instalada dejará de funcionar hasta que pegues la clave nueva o la vuelvas a descargar. ¿Regenerar?'))return;
    const r=await fetch('/api/swipe/token',{method:'POST',credentials:'same-origin'});if(!r.ok)return toast('No se pudo regenerar');
    const d=await r.json();q('#xkey').value=d.clave;toast('Clave nueva generada');};
}

/* ---- bandeja: lo que envía la extensión ---- */
let bandejaTarea=null;
// Si ya hay una lectura en curso se devuelve esa misma: quien la espera sabe
// cuándo terminó de verdad (lo usa "Traer creativos").
export function traerBandeja(){
  if(!S)return Promise.resolve();
  if(!bandejaTarea)bandejaTarea=leerBandeja().finally(()=>{bandejaTarea=null;});
  return bandejaTarea;
}
async function leerBandeja(){
  try{
    const r=await fetch('/api/inbox',{credentials:'same-origin'});
    if(!r.ok){ bandeja={pendientes:bandeja.pendientes,error:`El servidor respondió ${r.status} al leer la bandeja`}; pintarBandeja(); return; }
    const {items=[]}=await r.json();
    if(!items.length){ const habia=bandeja.pendientes; bandeja={pendientes:0,error:''}; if(habia)pintarBandeja(); return; }
    const listos=[]; let fallo='';
    for(const it of items){
      try{ await recibirSwipe(it); listos.push(it.id); }
      catch(e){ console.warn('Nova Swipe',e); fallo=fallo||(e.message||'no se pudo guardar'); }
    }
    bandeja={pendientes:items.length-listos.length,error:fallo};
    if(!listos.length){ pintarBandeja(); return; }
    // Se confirma la recepción solo si el guardado funcionó: si no, el anuncio
    // sigue en la bandeja del servidor y se reintenta, en vez de perderse.
    try{ await DB.put('kv',S,'state'); avisoGuardado(''); }
    catch(e){ avisoGuardado(e.message||'error al guardar'); bandeja={pendientes:items.length,error:'No se pudo guardar: '+(e.message||'')}; pintarBandeja(); return; }
    await fetch('/api/inbox/ack',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:listos})});
    if(UI.view==='referencias'&&!UI.refOpen)render(); else renderSide();
    toast(listos.length===1?'Llegó 1 anuncio desde Nova Swipe':`Llegaron ${listos.length} anuncios desde Nova Swipe`);
  }catch(e){ console.warn(e); bandeja={pendientes:bandeja.pendientes,error:e.message||'sin conexión con el servidor'}; pintarBandeja(); }
}
/* Lo que quedó esperando en la bandeja se ve en la Biblioteca: antes fallaba
 * en silencio y el usuario solo notaba que sus anuncios no aparecían. */
let bandeja={pendientes:0,error:''};
function pintarBandeja(){ if(UI.view==='referencias'&&!UI.refOpen)render(); }
function avisoBandeja(){
  if(!bandeja.pendientes&&!bandeja.error)return '';
  return `<div class="panel" style="padding:12px 14px;margin-bottom:12px;background:var(--amber-bg);border-color:#fde68a;color:var(--amber);display:flex;gap:10px;align-items:center;flex-wrap:wrap">
    ${ic('ext','sm')}<div style="min-width:0;flex-grow:1">
      <b>${bandeja.pendientes?`${bandeja.pendientes} anuncio${bandeja.pendientes===1?'':'s'} de Nova Swipe sin entrar`:'La bandeja de Nova Swipe falló'}</b>
      <div style="font-size:13px;line-height:1.4">${bandeja.error?esc(bandeja.error):'Están guardados en el servidor pero el Studio no pudo traerlos.'}</div>
    </div>
    <button class="btn ghost sm" id="lbandeja">Reintentar</button></div>`;
}
async function recibirSwipe(it){
  if(S.refs.some(r=>r.swipeId===it.id))return;
  const productId=(it.productId&&byId(S.products,it.productId)?.id)||S.products.find(p=>p.code===it.productCode)?.id||PID();
  let mediaId=null,kind='link',format='';
  if(it.mediaId){
    const res=await fetch(`/api/media/${encodeURIComponent(it.mediaId)}`,{credentials:'same-origin'});
    if(res.ok){
      const blob=await res.blob();
      const type=it.mime||blob.type||'';
      const file=new File([blob],it.fileName||'nova-swipe',{type});
      const t=await makeThumb(file);
      kind=type.startsWith('video/')?'video':'image'; format=kind==='image'?'imagen':'';
      await DB.put('media',{id:it.mediaId,type,kind,name:file.name,thumb:t.thumb,w:t.w,h:t.h,duration:t.duration,size:blob.size,hasBlob:true});
      thumbCache[it.mediaId]={thumb:t.thumb,kind,duration:t.duration};
      mediaId=it.mediaId;
    }
  }
  const inicio=fechaISO(it.startedAt);
  const notas=[it.notes,!inicio&&it.startedAt?`Activo desde: ${it.startedAt}`:''].filter(Boolean).join(String.fromCharCode(10));
  const nuevo=ensureRef({id:uid('r'),swipeId:it.id,productId,mediaId,kind,format,brand:it.brand||'',source:SOURCE_INFO[it.source]?it.source:linkSource(it.link||it.pageUrl||''),
    conceptId:'',angleId:'',stage:'',notes:notas,link:it.link||it.pageUrl||'',adText:it.adText||'',adId:it.adId||'',startedAt:inicio,
    adCopy:{titulo:it.titulo||'',descripcion:it.descripcion||'',boton:it.boton||'',destino:it.destino||''},
    created:Date.parse(it.capturedAt)||Date.now(),rating:0,fav:false,collection:it.collection||''});
  S.refs.unshift(nuevo);
  autoExtraer(nuevo);
}
setInterval(traerBandeja,15000);
window.addEventListener('focus',()=>traerBandeja());
