import "./studio.css";
import MotorFatiga from "./motor-fatiga.js";
import { DB, migrarLegado, fatigaPendiente } from "./persistencia.js";
import { logout } from "../storage.js";
/* ============ ICONOS ============ */
const IC={
 ref:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
 angle:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
 ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
 book:'<path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2zM13 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5z"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
 insta:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>',
 music:'<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
 yt:'<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',
 pin:'<path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
 store:'<path d="M4 9h16l-1-5H5zM5 9v11h14V9M9 20v-6h6v6"/>',
 spark:'<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/>',
 concept:'<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
 hook:'<path d="M4 7h16M4 12h10M4 17h7"/>',
 pipe:'<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>',
 funnel:'<path d="M3 4h18l-7 8v6l-4 2v-8L3 4z"/>',
 chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
 pareto:'<path d="M3 20h18"/><rect x="4" y="6" width="3" height="14"/><rect x="9" y="11" width="3" height="9"/><rect x="14" y="15" width="3" height="5"/><path d="M5 5c5 1 9 4 15 13"/>',
 battery:'<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2M6 10v4"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 up:'<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>',
 video:'<rect x="2" y="5" width="15" height="14" rx="2"/><path d="m17 10 5-3v10l-5-3"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
 text:'<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
 cards:'<rect x="2" y="6" width="14" height="14" rx="2"/><path d="M8 2h12a2 2 0 0 1 2 2v12"/>',
 x:'<path d="M18 6 6 18M6 6l12 12"/>',
 play:'<path d="M7 4l12 8-12 8z"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
 check:'<path d="M5 12l5 5L20 7"/>',
 down:'<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
 link:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'
};
const ic=(n,cls='')=>`<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=p=>p+'_'+Math.random().toString(36).slice(2,9);
const $=s=>document.querySelector(s);

/* ============ BASE DE DATOS ============ */
// Persistencia en el servidor: ver persistencia.js (misma interfaz que el IndexedDB del prototipo).

/* ============ ESTADO ============ */
const STAGES=['TOFU','MOFU','BOFU'];
const STAGE_INFO={TOFU:['Descubrimiento','No te conocen. Detener el scroll y mostrar el problema.'],MOFU:['Consideración','Ya te vieron. Demostrar y comparar.'],BOFU:['Decisión','Casi compran. Resolver objeciones y dar la oferta.']};
const STATUS=[['idea','Idea','#8b5cf6','Nace de una referencia'],['guion','Guion','#94a3b8','Escrito, por aprobar'],['produccion','Producción','#0ea5e9','Voz, edición o diseño'],['lanzado','Lanzado','#10b981','En Meta, sumando datos'],['testing','Testing','#f59e0b','Juntando muestra'],['resultado','Resultado','#0f172a','Se decide solo por CPA real']];
const FORMATS=[['video','Video con voz','video','VID'],['video_texto','Video solo texto','text','TXT'],['imagen','Imagen','image','IMG'],['carrusel','Carrusel','cards','CAR']];
const HOOK_TYPES=['Hablado','Texto en pantalla','Visual','Primera línea del copy'];

let S=null; // estado
let UI={view:'pipeline',selRef:null,refFilter:'todas',stageFilter:'todas',modal:null};
const thumbCache={};

function seed(){
  const p1={id:'p_novaflex',name:'NOVAFLEX',code:'NOVAFLEX'},p2={id:'p_novafit',name:'NovaFit Pro',code:'NOVAFIT'};
  const A=(id,pid,name,deseo,desc,stage)=>({id,productId:pid,name,deseo,desc,stage});
  const angles=[
    A('a_dolor','p_novaflex','Alivio del dolor','Dejar de sentir molestia al moverse','Para quien ya siente el tobillo al entrenar o jugar.','TOFU'),
    A('a_activo','p_novaflex','Seguir activo','No dejar de entrenar ni jugar','No es de lesión: es de no parar.','TOFU'),
    A('a_padres','p_novaflex','Padre-hijo','Tranquilidad cuando su hijo entrena','Le habla al papá o mamá del niño que juega fútbol o vóley.','TOFU'),
    A('a_chimpun','p_novaflex','Entra en el chimpún','Soporte sin incomodidad','1 mm, no abulta, se usa todo el partido.','MOFU'),
    A('a_venda','p_novaflex','Adiós a la venda','Ahorrar tiempo antes del partido','Se pone en segundos vs. vendarse cada vez.','BOFU'),
    A('a_rodilla','p_novafit','Rodilla sin molestia al caminar','Moverse con confianza','Soporte debajo de la rótula para el día a día.','TOFU')
  ];
  const concepts=['Problema → Solución','Educativo / ¿Sabías que…?','Antes / Después','Antes / Ahora','Demostración','Us vs Them / Comparativo','Rompe-objeción','Oferta pack x2','UGC / Creador con celular','POV','Meme'].map((n,i)=>({id:'c_'+i,name:n}));
  const cid=n=>concepts.find(c=>c.name.startsWith(n)).id;
  const hooks=[
    {id:'h_1',productId:'p_novaflex',text:'Me dolía el tobillo… pero no quería dejar de entrenar.',type:'Hablado',conceptId:cid('Problema'),angleId:'a_dolor',stage:'TOFU',origin:'Propio'},
    {id:'h_2',productId:'p_novaflex',text:'Si te duele el tobillo al entrenar… esto te interesa.',type:'Hablado',conceptId:cid('Rompe'),angleId:'a_dolor',stage:'BOFU',origin:'Propio'},
    {id:'h_3',productId:'p_novaflex',text:'¿Sabes cuál es la lesión más común en niños que juegan fútbol?',type:'Hablado',conceptId:cid('Educativo'),angleId:'a_padres',stage:'TOFU',origin:'Propio'},
    {id:'h_4',productId:'p_novaflex',text:'Esto me devolvió la estabilidad al entrenar.',type:'Hablado',conceptId:cid('Antes / Después'),angleId:'a_activo',stage:'TOFU',origin:'Propio'},
    {id:'h_5',productId:'p_novaflex',text:'Pichangueros en 2016 vs. ahora',type:'Texto en pantalla',conceptId:cid('Antes / Ahora'),angleId:'a_venda',stage:'TOFU',origin:'Referencia'}
  ];
  const P=(id,code,title,format,concept,angle,hook,status,stage,spend,conf,x,y)=>({id,productId:'p_novaflex',code,title,format,conceptId:cid(concept),angleId:angle,hookId:hook,status,stage,spend,conf,delivered:null,mediaIds:[],copy:{principal:'',titulo:'',cta:'Comprar'},board:stage?{x,y}:null,created:Date.now()});
  const pieces=[
    P('pc_1','SCR_001','Entrenar a pesar del dolor','video','Problema','a_dolor','h_1','testing','TOFU',180,9,.05,.5),
    P('pc_2','SCR_002','Te hablo directo si te pasa esto','video','Rompe','a_dolor','h_2','lanzado','BOFU',90,3,.1,.4),
    P('pc_3','SCR_003','Antes vs después','video','Antes / Después','a_activo','h_4','guion','TOFU',null,null,.3,.5),
    P('pc_4','SCR_004','Lesión más común en niños','video','Educativo','a_padres','h_3','produccion',null,null,null,0,0),
    P('pc_5','IDEA_01','Pichangueros en 2016 vs. ahora','video_texto','Antes / Ahora','a_venda','h_5','idea',null,null,null,0,0)
  ];
  const lanes={};
  lanes['p_novaflex']={
    TOFU:{objetivo:'Ventas → landing',auds:['Deportistas Lima · amplio','Padres de niños que entrenan','Advantage+']},
    MOFU:{objetivo:'Mensajes → WhatsApp',auds:['Vieron 50% del video · 14 d','Visitaron landing · 7 d']},
    BOFU:{objetivo:'Mensajes → WhatsApp',auds:['Chat sin pedido · 14 d','Formulario sin enviar · 7 d']}};
  return {v:1,products:[p1,p2],productId:'p_novaflex',angles,concepts,hooks,pieces,refs:[],lanes,
    settings:{topeUSD:5,tc:3.7,muestra:10},seq:{p_novaflex:5,p_novafit:0}};
}
let saveT;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>DB.put('kv',S,'state').catch(e=>toast('No se pudo guardar: '+e.message)),150);}
const PID=()=>S.productId;
const prod=()=>S.products.find(p=>p.id===PID());
const mine=arr=>arr.filter(x=>x.productId===PID());
const byId=(arr,id)=>arr.find(x=>x.id===id);
const tope=()=>S.settings.topeUSD*S.settings.tc;
const cpa=p=>p.spend&&p.conf?p.spend/p.conf:null;
const money=v=>v==null||isNaN(v)?'—':'S/'+(Math.round(v*10)/10).toFixed(1);
function result(p){ if(!(p.status==='testing'||p.status==='lanzado'||p.status==='resultado'))return null;
  const c=cpa(p); if(c==null||(p.conf||0)<S.settings.muestra) return 'TBD';
  return c<=tope()?'Ganador':'Perdedor'; }
function columnOf(p){ const r=result(p); if((p.status==='testing'||p.status==='lanzado')&&(r==='Ganador'||r==='Perdedor'))return 'resultado'; return p.status; }

function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),2400);}

/* ============ MEDIOS ============ */
function makeThumb(file){
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
async function addMedia(file){
  const {thumb,w,h,duration}=await makeThumb(file);
  const id=uid('m');const kind=file.type.startsWith('video/')?'video':'image';
  await DB.put('media',{id,blob:file,type:file.type,kind,name:file.name||'pegado',thumb,w,h,duration,size:file.size});
  thumbCache[id]={thumb,kind,duration};
  return id;
}
async function thumbOf(id){ if(!id)return null; if(thumbCache[id])return thumbCache[id];
  const m=await DB.meta(id); if(!m)return null; thumbCache[id]={thumb:m.thumb,kind:m.kind,duration:m.duration}; return thumbCache[id]; }
function thumbHTML(id,label='Sin imagen'){
  // placeholder que se hidrata
  return `<div class="thumb" data-thumb="${id||''}">${id?'':`<span>${esc(label)}</span>`}</div>`;
}
async function hydrateThumbs(root=document){
  const els=[...root.querySelectorAll('[data-thumb]')].filter(e=>e.dataset.thumb&&!e.dataset.ok);
  for(const el of els){ el.dataset.ok='1'; const t=await thumbOf(el.dataset.thumb);
    if(!t){el.innerHTML='<span>Archivo no encontrado</span>';continue;}
    el.innerHTML=(t.thumb?`<img src="${t.thumb}" alt="">`:`<span>${t.kind==='video'?'Video':'Imagen'}</span>`)+
      (t.kind==='video'?`<span class="badge">${ic('video','sm')}${t.duration?fmtDur(t.duration):'Video'}</span>`:'');
  }
}
const fmtDur=s=>{s=Math.round(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
async function openViewer(id){
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
function filesFrom(list){return [...(list||[])].filter(f=>f.type.startsWith('image/')||f.type.startsWith('video/'));}
async function ingest(files,{toPiece=null}={}){
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
function linkSource(u){ u=String(u||'');
  if(/facebook\.com\/ads\/library/i.test(u))return 'Biblioteca de Meta';
  if(/ads\.tiktok\.com|creativecenter/i.test(u))return 'TikTok Creative Center';
  if(/instagram\.com/i.test(u))return 'Instagram';
  if(/tiktok\.com/i.test(u))return 'TikTok';
  if(/facebook\.com|fb\.watch|fb\.com/i.test(u))return 'Facebook';
  if(/youtube\.com|youtu\.be/i.test(u))return 'YouTube';
  if(/pinterest\.|pin\.it/i.test(u))return 'Pinterest';
  return u?'Otro enlace':'Sin fuente'; }
let pickTarget=null;
$('#filepick').addEventListener('change',e=>{ingest(e.target.files,{toPiece:pickTarget});e.target.value='';});
function pick(piece=null){pickTarget=piece;$('#filepick').click();}
window.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files'))e.preventDefault();});
window.addEventListener('drop',e=>{ if(!e.dataTransfer.files.length)return; e.preventDefault(); const piece=UI.modal?byId(S.pieces,UI.modal):null; ingest(e.dataTransfer.files,{toPiece:piece}); });

/* ============ RENDER GENERAL ============ */
const VIEWS=[['Crear',[['ideas','spark','Ideas de contenido'],['referencias','ref','Biblioteca'],['angulos','angle','Ángulos de venta'],['conceptos','concept','Conceptos'],['hooks','hook','Hooks']]],
  ['Producir',[['pipeline','pipe','Pipeline']]],['Lanzar',[['embudo','funnel','Embudo']]],['Medir',[['analisis','pareto','Análisis 80/20'],['fatiga','battery','Fatiga'],['competencia','store','Competencia'],['tracker','chart','Tracker']]]];
function counts(){return {ideas:mine(S.ideas).filter(i=>['nueva','aprobada'].includes(i.estado)).length,referencias:mine(S.refs).length,angulos:mine(S.angles).length,conceptos:S.concepts.length,hooks:mine(S.hooks).length,pipeline:mine(S.pieces).length,embudo:mine(S.pieces).filter(p=>p.stage).length,tracker:mine(S.pieces).filter(p=>['lanzado','testing','resultado'].includes(p.status)).length,analisis:S.metaData?.[PID()]?.anuncios?.length||'',fatiga:S.metaData?.[PID()]?.anuncios?.length?'':'',competencia:(S.competidores||[]).length||''};}
function renderSide(){
  const c=counts();
  $('#side').innerHTML=`
   <div class="logo"><div class="mk">N</div><div><b>Studio de Ads</b><span>NOVA</span></div></div>
   <div class="prod"><label for="prodsel">Producto</label>
     <select id="prodsel">${S.products.map(p=>`<option value="${p.id}" ${p.id===PID()?'selected':''}>${esc(p.name)}</option>`).join('')}<option value="__new">+ Agregar producto</option></select></div>
   ${VIEWS.map(([g,items])=>`<div class="grp">${g}</div>`+items.map(([id,i,l])=>`<button class="nav ${UI.view===id?'on':''}" data-view="${id}">${ic(i)}<span>${l}</span><span class="n">${c[id]}</span></button>`).join('')).join('')}
   <div class="side-foot">
     <button id="bset">Ajustes</button>
     <button id="bexp">Exportar datos</button>
     <button id="bimp">Importar datos</button>
     <button id="bout">Cerrar sesión</button>
   </div>`;
  $('#prodsel').onchange=e=>{ if(e.target.value==='__new'){ const n=prompt('Nombre del producto');
      if(n&&n.trim()){const code=n.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,12)||'PROD';const p={id:uid('p'),name:n.trim(),code};S.products.push(p);S.productId=p.id;S.lanes[p.id]=emptyLanes();S.seq[p.id]=0;save();}
      render();return;}
    S.productId=e.target.value;UI.selRef=null;save();render();};
  document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{UI.view=b.dataset.view;render();});
  $('#bset').onclick=openSettings;$('#bout').onclick=async()=>{await logout();location.reload();};$('#bexp').onclick=exportData;$('#bimp').onclick=()=>$('#importpick').click();
}
function emptyLanes(){return {TOFU:{objetivo:'Ventas → landing',auds:[]},MOFU:{objetivo:'Mensajes → WhatsApp',auds:[]},BOFU:{objetivo:'Mensajes → WhatsApp',auds:[]}};}
function setTop(title,sub,actions=''){ $('#top').innerHTML=`<div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div class="act">${actions}</div>`; }
function render(){ renderSide(); const v=UI.view;
  ({ideas:vIdeas,referencias:vRefs,angulos:vAngles,conceptos:vConcepts,hooks:vHooks,pipeline:vPipeline,embudo:vEmbudo,tracker:vTracker,analisis:vAnalisis,fatiga:vFatiga,competencia:vCompetencia})[v]();
  hydrateThumbs(); }

const opt=(arr,sel,empty='—')=>`<option value="">${empty}</option>`+arr.map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${esc(x.name)}</option>`).join('');
const stageOpt=(sel,empty='Sin etapa')=>`<option value="">${empty}</option>`+STAGES.map(s=>`<option ${s===sel?'selected':''}>${s}</option>`).join('');
const fmtIcon=f=>{const x=FORMATS.find(a=>a[0]===f)||FORMATS[0];return `<span class="chip" title="${x[1]}" aria-label="${x[1]}">${ic(x[2],'sm')}</span>`;};

/* ============ BIBLIOTECA (referencias) ============ */
const JOBS={}; const LIBS={whisper:null,ocr:null};
const REF_SOURCES=['Biblioteca de Meta','TikTok Creative Center','Facebook','Instagram','TikTok','YouTube','Pinterest','Tienda de la competencia','Grabación propia','Sin fuente','Otro enlace'];
const SOURCE_LEGADO={'Subido':'Sin fuente','Biblioteca de anuncios':'Biblioteca de Meta','Enlace':'Otro enlace','Propio':'Grabación propia'};
function ensureRef(r){ if(!r.extract)r.extract={status:'',frames:[],transcript:[],ocr:[],blocks:[],analysis:null}; if(r.rating==null)r.rating=0; if(r.startedAt==null)r.startedAt=''; if(r.versiones==null)r.versiones=0; if(!r.adCopy)r.adCopy={titulo:'',descripcion:'',boton:'',destino:''}; if(!r.format)r.format=r.kind==='image'?'imagen':''; if(r.collection==null)r.collection=''; if(SOURCE_LEGADO[r.source])r.source=SOURCE_LEGADO[r.source]; if(!REF_SOURCES.includes(r.source))r.source=r.link?linkSource(r.link):'Sin fuente'; if(r.fav==null)r.fav=false; return r; }
const tstr=s=>{s=Math.max(0,Math.round(s||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
/* Fechas que llegan de la Biblioteca de Meta: "25 de junio de 2026", "Jun 25, 2026"… */
const MESES3=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function fechaISO(txt){
  const t=String(txt||'').trim(); if(!t)return '';
  const iso=t.match(/([0-9]{4})-([0-9]{2})-([0-9]{2})/); if(iso)return iso[0];
  const n=normTxt(t);
  const es=n.match(/([0-9]{1,2}) de ([a-z]+)[a-z ]*?([0-9]{4})/)||n.match(/([0-9]{1,2}) ([a-z]{3,}) ([0-9]{4})/);
  if(es){ const p=es[2].slice(0,3)==='set'?'sep':es[2].slice(0,3); const m=MESES3.indexOf(p);
    if(m>=0)return `${es[3]}-${String(m+1).padStart(2,'0')}-${es[1].padStart(2,'0')}`; }
  const d=new Date(t); return isNaN(d)?'':d.toISOString().slice(0,10);
}
const diasActivo=r=>{ const f=fechaISO(r.startedAt); if(!f)return null; const d=Math.floor((Date.now()-Date.parse(f+'T00:00:00'))/86400000); return d>=0?d:null; };
function senalDias(d){
  if(d==null)return null;
  if(d<7)return {tono:'nuevo',texto:`Recién sale: lleva ${d} día${d===1?'':'s'}. Todavía no dice si funciona.`};
  if(d<30)return {tono:'medio',texto:`Lleva ${d} días activo: sobrevivió a la prueba, algo está funcionando.`};
  if(d<60)return {tono:'bien',texto:`Lleva ${d} días activo: es un anuncio que ya probó su rentabilidad.`};
  return {tono:'bien',texto:`Lleva ${d} días activo: casi seguro le está vendiendo a la marca.`};
}
function loadScript(src){return new Promise((res,rej)=>{if(document.querySelector(`script[src="${src}"]`))return res();const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('No se pudo cargar '+src.split('/npm/')[1]));document.head.appendChild(s);});}
function setJob(id,step,pct,msg){ JOBS[id]={step,pct,msg}; document.querySelectorAll(`[data-prog="${id}"]`).forEach(el=>{el.hidden=false;el.querySelector('span').textContent=msg;el.querySelector('i').style.width=Math.round(pct)+'%';}); }
function endJob(id){ delete JOBS[id]; }
function progHTML(id){ const j=JOBS[id]; return `<div class="prog" data-prog="${id}" ${j?'':'hidden'}><div class="bar"><i style="width:${j?j.pct:0}%"></i></div><span>${esc(j?j.msg:'')}</span></div>`; }

async function loadWhisper(model,onProgress){
  if(LIBS.whisper&&LIBS.whisper.model===model)return LIBS.whisper.pipe;
  const T=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1');
  const opts={progress_callback:p=>{if(p.status==='progress'&&p.total)onProgress(p.loaded/p.total);}};
  let pipe;
  try{ if(navigator.gpu){ pipe=await T.pipeline('automatic-speech-recognition',`onnx-community/whisper-${model}`,{...opts,device:'webgpu'}); } }catch(e){ pipe=null; }
  if(!pipe) pipe=await T.pipeline('automatic-speech-recognition',`onnx-community/whisper-${model}`,opts);
  LIBS.whisper={model,pipe}; return pipe;
}
async function loadOCR(){
  if(LIBS.ocr)return LIBS.ocr;
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
  const w=await Tesseract.createWorker('spa+eng');
  await w.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});
  LIBS.ocr=w; return w;
}
function seekTo(v,t){return new Promise(res=>{const on=()=>{v.removeEventListener('seeked',on);res();};v.addEventListener('seeked',on);v.currentTime=Math.min(t,Math.max(0,(v.duration||t)-0.05));});}
async function captureFrames(blob,onStep){
  const url=URL.createObjectURL(blob); const v=document.createElement('video'); v.muted=true; v.playsInline=true; v.preload='auto'; v.src=url;
  await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(new Error('El navegador no pudo abrir este video'));});
  // Algunos webm no traen la duración hasta leerse completos: se fuerza su cálculo.
  if(!isFinite(v.duration)){ await new Promise(res=>{const on=()=>{if(isFinite(v.duration)){v.removeEventListener('durationchange',on);res();}};v.addEventListener('durationchange',on);v.currentTime=1e7;setTimeout(res,4000);}); }
  const dur=isFinite(v.duration)?v.duration:0; const step=Math.min(3,Math.max(1,dur/30)); const out=[];
  const small=document.createElement('canvas'), big=document.createElement('canvas');
  for(let t=Math.min(.3,dur/2); t<dur && out.length<40; t+=step){
    await seekTo(v,t);
    const w=v.videoWidth,h=v.videoHeight; if(!w)continue;
    small.width=180; small.height=Math.round(h*180/w); small.getContext('2d').drawImage(v,0,0,small.width,small.height);
    big.width=Math.min(900,w); big.height=Math.round(h*big.width/w); big.getContext('2d').drawImage(v,0,0,big.width,big.height);
    const bc=document.createElement('canvas'); bc.width=big.width; bc.height=big.height; bc.getContext('2d').drawImage(big,0,0);
    out.push({t,thumb:small.toDataURL('image/jpeg',.7),canvas:bc});
    onStep(out.length/Math.max(1,Math.ceil(dur/step)));
  }
  URL.revokeObjectURL(url); return {frames:out,duration:dur};
}
async function audioMono16k(blob){
  const buf=await blob.arrayBuffer(); const Ctx=window.AudioContext||window.webkitAudioContext;
  const ctx=new Ctx({sampleRate:16000}); try{ const a=await ctx.decodeAudioData(buf);
    if(a.numberOfChannels===1)return a.getChannelData(0);
    const L=a.getChannelData(0),R=a.getChannelData(1),m=new Float32Array(L.length); for(let i=0;i<L.length;i++)m[i]=(L[i]+R[i])/2; return m;
  }finally{ctx.close();}
}
const normTxt=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9ñ ]+/g,' ').replace(/\s+/g,' ').trim();
function similar(a,b){const A=new Set(normTxt(a).split(' ')),B=new Set(normTxt(b).split(' '));if(!A.size||!B.size)return 0;let i=0;A.forEach(w=>{if(B.has(w))i++;});return i/Math.max(A.size,B.size);}
/* ---- texto en pantalla (OCR) ----
 * Tesseract lee mal el fotograma tal cual: texto chico sobre fondos con mucho
 * detalle. Se agranda el fotograma, se aíslan las letras claras (blancas o
 * amarillas, lo típico en TikTok y Reels) y las oscuras, y solo se aceptan
 * líneas con buena confianza y que parecen palabras. Si no hay texto, no se
 * inventa: el tramo queda vacío.
 */
function prepararOCR(src){
  const escala=Math.min(2.2,1280/src.width);
  const W=Math.round(src.width*escala),H=Math.round(src.height*escala);
  const base=document.createElement('canvas');base.width=W;base.height=H;
  const cx=base.getContext('2d',{willReadFrequently:true});cx.imageSmoothingQuality='high';cx.drawImage(src,0,0,W,H);
  const d=cx.getImageData(0,0,W,H).data;
  const claro=new ImageData(W,H),oscuro=new ImageData(W,H);
  for(let i=0;i<d.length;i+=4){
    const r=d[i],g=d[i+1],b=d[i+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b),lum=0.299*r+0.587*g+0.114*b;
    const letraClara=(lum>200&&mx-mn<45)||(r>200&&g>170&&b<110);
    const letraOscura=lum<55&&mx-mn<40;
    claro.data[i]=claro.data[i+1]=claro.data[i+2]=letraClara?0:255;claro.data[i+3]=255;
    oscuro.data[i]=oscuro.data[i+1]=oscuro.data[i+2]=letraOscura?0:255;oscuro.data[i+3]=255;
  }
  return [claro,oscuro].map(img=>{const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').putImageData(img,0,0);return c;});
}
const OCR_PALABRA=/^[¿¡"“'(]*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9$][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9%$.,'’\/-]*[?!.,:;"”')]*$/;
const OCR_VOCAL=/[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]/;
const soloLetras=t=>t.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g,'');
function palabraOCR(t){
  t=t.trim(); if(!OCR_PALABRA.test(t))return false;
  const nucleo=t.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9%$]/g,''); if(!nucleo)return false;
  if(/^(S\/|\$)?\d+([.,]\d+)?%?$/.test(t.replace(/[¿¡"“”'()?!.,:;]+$/,'')))return true; // precios, porcentajes, cantidades
  const letras=soloLetras(nucleo);
  if(letras.length<=1)return /^[aeoyuAEOYUóÓ]$/.test(letras)&&nucleo.length===1;
  if(!OCR_VOCAL.test(letras)||/(.)\1\1/i.test(letras))return false;
  if(/[a-záéíóúñ][A-ZÁÉÍÓÚÑ]/.test(letras))return false; // mezcla rara de mayúsculas
  if(letras.length>=5&&!/[aeiouáéíóú][^aeiouáéíóú]|[^aeiouáéíóú][aeiouáéíóú]/i.test(letras))return false;
  return true;
}
/* Devuelve { texto, dudoso }: lo que se leyó con confianza y, aparte, lo que se
 * leyó mal. Lo dudoso no se mezcla con el guion, pero se guarda para poder
 * mostrar "texto en pantalla ilegible · ver lo leído" en vez de dejarlo en blanco. */
async function leerTextoPantalla(worker,fuente){
  const hallado=[],turbio=[];
  for(const lienzo of prepararOCR(fuente)){
    const {data}=await worker.recognize(lienzo);
    const lineas=data.lines||(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[]));
    for(const l of lineas){
      const todas=(l.words||[]).filter(w=>w.text.trim());
      if(!todas.length)continue;
      const crudo=todas.map(w=>w.text.trim()).join(' ');
      const buenas=todas.filter(w=>w.confidence>=65&&palabraOCR(w.text));
      // Se toleran palabras dudosas sueltas (fotogramas de transición) si queda una frase clara.
      const claro=l.confidence>=70
        &&buenas.length/todas.length>=0.6
        &&!(buenas.length<2&&soloLetras(buenas[0]?.text||'').length<5)
        &&buenas.some(w=>soloLetras(w.text).length>=3)
        &&buenas.filter(w=>soloLetras(w.text).length<=2).length<=buenas.length/2
        &&buenas.reduce((s,w)=>s+soloLetras(w.text).length,0)>=4;
      if(claro)hallado.push({texto:buenas.map(w=>w.text.trim()).join(' '),y:l.bbox?.y0??0});
      else if(soloLetras(crudo).length>=4)turbio.push({texto:crudo,y:l.bbox?.y0??0});
    }
  }
  const juntar=arr=>{const u=[];arr.sort((a,b)=>a.y-b.y).forEach(h=>{if(!u.some(x=>similar(x.texto,h.texto)>.6))u.push(h);});return u.map(x=>x.texto).join(' / ');};
  return {texto:juntar(hallado),dudoso:juntar(turbio).slice(0,280)};
}
function cleanOCR(text){ return String(text||'').split('\n').map(l=>l.trim()).filter(l=>{const w=l.split(/\s+/).filter(x=>/[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/.test(x));return w.length>=1&&l.length>=3&&w.join('').length/l.replace(/\s/g,'').length>.6;}).join(' ').trim(); }
function buildBlocks(ref){
  const ex=ref.extract, dur=ex.duration||0; const tr=ex.transcript||[], oc=ex.ocr||[];
  const frameAt=t=>{let best=0;(ex.frames||[]).forEach((f,i)=>{if(Math.abs(f.t-t)<Math.abs(ex.frames[best].t-t))best=i;});return ex.frames.length?best:-1;};
  const ocrIn=(a,b)=>[...new Set(oc.filter(o=>o.t>=a&&o.t<b&&o.text).map(o=>o.text))].join(' / ');
  const ilegIn=(a,b)=>[...new Set(oc.filter(o=>o.t>=a&&o.t<b&&!o.text&&o.dudoso).map(o=>o.dudoso))].join(' / ');
  const segs=[];
  if(tr.length){ let cur=null; tr.forEach(c=>{ if(!cur)cur={start:c.start,end:c.end,voz:c.text}; else {cur.end=c.end;cur.voz+=' '+c.text;}
      if(cur.end-cur.start>=3){segs.push(cur);cur=null;} }); if(cur)segs.push(cur); }
  else if(oc.length){ oc.forEach((o,i)=>{const end=i+1<oc.length?oc[i+1].t:dur;segs.push({start:o.t,end,voz:''});}); }
  else{ for(let t=0;t<Math.max(dur,1);t+=3)segs.push({start:t,end:Math.min(dur,t+3),voz:''}); }
  return segs.map((s,i)=>({id:uid('b'),tipo:i===0?'Hook':(i===segs.length-1&&segs.length>2?'CTA':''),tiempo:`${tstr(s.start)}–${tstr(s.end)}`,start:s.start,end:s.end,voz:s.voz.trim(),texto:ocrIn(s.start,Math.max(s.end,s.start+.01)),ilegible:ilegIn(s.start,Math.max(s.end,s.start+.01)),visual:'',frame:frameAt(s.start)}));
}
async function runExtract(ref,{voz=true,texto=true}={}){
  ensureRef(ref); if(JOBS[ref.id])return; if(!ref.mediaId){toast('Adjunta primero el archivo de este anuncio');return;}
  const m=await DB.get('media',ref.mediaId); if(!m||!m.blob){toast('El archivo original no está en este navegador');return;}
  const ex=ref.extract; ex.status='procesando';
  try{
    if(m.kind==='image'){
      setJob(ref.id,'ocr',10,'Leyendo texto de la imagen…');
      const img=await createImageBitmap(m.blob); const c=document.createElement('canvas'); c.width=Math.min(1200,img.width); c.height=Math.round(img.height*c.width/img.width); c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      const w=await loadOCR(); setJob(ref.id,'ocr',50,'Leyendo texto de la imagen…');
      const {texto:txt,dudoso}=await leerTextoPantalla(w,c);
      ex.frames=[{t:0,thumb:thumbCache[ref.mediaId]?.thumb||''}]; ex.ocr=(txt||dudoso)?[{t:0,text:txt,dudoso}]:[]; ex.transcript=[]; ex.duration=0;
      ex.blocks=[{id:uid('b'),tipo:'Hook',tiempo:'',start:0,voz:'',texto:txt,ilegible:txt?'':dudoso,visual:'',frame:0}];
    }else{
      setJob(ref.id,'frames',2,'Sacando fotogramas…');
      const {frames,duration}=await captureFrames(m.blob,p=>setJob(ref.id,'frames',2+p*23,`Sacando fotogramas… ${Math.round(p*100)}%`));
      ex.duration=duration; ex.frames=frames.map(f=>({t:f.t,thumb:f.thumb}));
      ex.transcript=[];
      if(voz){
        setJob(ref.id,'audio',27,'Leyendo el audio…');
        let audio=null; try{audio=await audioMono16k(m.blob);}catch(e){toast('No se pudo leer el audio: se extrae solo el texto en pantalla');}
        if(audio){
          const pipe=await loadWhisper(S.settings.whisper||'base',p=>setJob(ref.id,'model',28+p*12,`Descargando modelo de voz (solo la primera vez)… ${Math.round(p*100)}%`));
          setJob(ref.id,'asr',42,'Transcribiendo la voz… puede tardar un poco');
          const out=await pipe(audio,{language:'spanish',task:'transcribe',return_timestamps:true,chunk_length_s:30,stride_length_s:5});
          ex.transcript=(out.chunks||[{timestamp:[0,duration],text:out.text||''}]).map(c=>({start:c.timestamp[0]||0,end:c.timestamp[1]??duration,text:String(c.text||'').trim()})).filter(c=>c.text);
        }
      }
      ex.ocr=[];
      // Si el lector de texto no carga o falla a medias, igual se guarda la voz.
      if(texto){
       try{
        const w=await loadOCR(); let prev='', ultimoOCR=-9;
        for(let i=0;i<frames.length;i++){
          setJob(ref.id,'ocr',62+36*(i/frames.length),`Leyendo texto en pantalla… ${i+1}/${frames.length}`);
          if(duration>60&&i>0&&frames[i].t-ultimoOCR<1.5)continue; ultimoOCR=frames[i].t;
          const {texto:txt,dudoso}=await leerTextoPantalla(w,frames[i].canvas);
          if(!txt){
            const antes=ex.ocr[ex.ocr.length-1];
            if(dudoso&&!(antes&&!antes.text&&similar(dudoso,antes.dudoso)>=.5))ex.ocr.push({t:frames[i].t,text:'',dudoso});
            prev='';continue;
          }
          const ult=[...ex.ocr].reverse().find(o=>o.text);
          // Mismo texto que el fotograma anterior: se queda la lectura más completa.
          if(prev&&ult&&similar(txt,ult.text)>=.5){ if(txt.length>ult.text.length)ult.text=txt; }
          else ex.ocr.push({t:frames[i].t,text:txt});
          prev=txt;
        }
       }catch(err){ console.warn('OCR',err); toast('No se pudo leer el texto en pantalla: se guarda el resto del guion'); }
      }
      setJob(ref.id,'build',99,'Armando el guion…');
      ex.blocks=buildBlocks(ref);
    }
    ex.status='listo'; ex.at=Date.now(); if(!ref.format)ref.format=m.kind==='image'?'imagen':(ex.transcript.length?'video':'video_texto');
    save(); toast('Guion extraído');
  }catch(err){ console.error(err); ex.status='error'; ex.error=err.message; save(); toast('No se pudo extraer: '+err.message); }
  finally{ endJob(ref.id); if(UI.view==='referencias')render(); if(UI.refOpen===ref.id){ if(ex.status==='listo')UI.refTab='guion'; renderRefModal(); } }
}

/* ---- extracción automática ----
 * Lo que llega con archivo (Nova Swipe, arrastrado o adjuntado) se extrae solo:
 * de a uno, para no saturar el navegador. Se apaga desde Ajustes. */
const COLA_AUTO=[]; let colaCorriendo=false;
function autoExtraer(r){
  if(!r||!r.mediaId||r.kind==='link')return;
  if(S.settings&&S.settings.autoExtraer===false)return;
  ensureRef(r); const ex=r.extract;
  if(ex.status==='listo'||ex.status==='procesando'||JOBS[r.id])return;
  if((ex.intentos||0)>=2||COLA_AUTO.includes(r.id))return;
  COLA_AUTO.push(r.id); correrColaAuto();
}
async function correrColaAuto(){
  if(colaCorriendo)return; colaCorriendo=true;
  try{
    while(COLA_AUTO.length){
      const r=byId(S.refs,COLA_AUTO.shift()); if(!r)continue;
      ensureRef(r); if(r.extract.status==='listo'||JOBS[r.id])continue;
      r.extract.intentos=(r.extract.intentos||0)+1;
      await runExtract(r,{voz:r.kind!=='image',texto:true});
    }
  }finally{ colaCorriendo=false; }
}

/* ---- fuentes, colecciones y marcas ---- */
const SOURCE_GROUPS=[
  ['Anuncios pagados',[['Biblioteca de Meta','book','#1d4ed8'],['TikTok Creative Center','spark','#0f172a']]],
  ['Redes sociales',[['Facebook','globe','#1d4ed8'],['Instagram','insta','#db2777'],['TikTok','music','#0f172a'],['YouTube','yt','#dc2626'],['Pinterest','pin','#dc2626']]],
  ['Otros',[['Tienda de la competencia','store','#7c3aed'],['Grabación propia','video','#0d9488'],['Sin fuente','up','#64748b'],['Otro enlace','link','#64748b']]]
];
const SOURCE_INFO=Object.fromEntries(SOURCE_GROUPS.flatMap(([,l])=>l.map(([n,i,c])=>[n,{icon:i,color:c}])));
const srcIcon=(s,cls='sm')=>{const x=SOURCE_INFO[s]||SOURCE_INFO['Otro enlace'];return `<span style="color:${x.color};display:inline-flex">${ic(x.icon,cls)}</span>`;};
const porClasificar=r=>!r.brand||!r.conceptId||!r.stage;
const libCollections=()=>{ if(!S.libCollections)S.libCollections=[]; const set=new Set(S.libCollections); S.refs.forEach(r=>{if(r.collection&&!set.has(r.collection)){set.add(r.collection);S.libCollections.push(r.collection);}}); return S.libCollections; };
const SORTS=[['recientes','Más recientes'],['antiguas','Más antiguas'],['calificadas','Mejor calificadas'],['marca','Marca (A–Z)'],['duracion','Más cortos']];

function libState(){ return UI.lib||(UI.lib={scope:'producto',tab:'todas',fuente:'',coleccion:'',marca:'',formato:'',etapa:'',concepto:'',angulo:'',q:'',orden:'recientes',vista:'grid'}); }
function libScope(){ const f=libState(); return S.refs.map(ensureRef).filter(r=>f.scope==='todos'||r.productId===PID()); }
function libFiltered(){
  const f=libState(); const q=normTxt(f.q);
  const list=libScope().filter(r=>
    (f.tab==='todas'||(f.tab==='clasificar'&&porClasificar(r))||(f.tab==='favoritas'&&r.fav)||(f.tab==='guion'&&r.extract.status==='listo'))
    &&(!f.fuente||r.source===f.fuente)&&(!f.coleccion||r.collection===f.coleccion)&&(!f.marca||r.brand===f.marca)
    &&(!f.formato||(f.formato==='link'?r.kind==='link':r.format===f.formato))&&(!f.etapa||r.stage===f.etapa)&&(!f.concepto||r.conceptId===f.concepto)&&(!f.angulo||r.angleId===f.angulo)
    &&(!q||normTxt([r.brand,r.adId,r.notes,r.collection,r.link,r.source,r.adText,...(r.extract.transcript||[]).map(t=>t.text),...(r.extract.ocr||[]).map(o=>o.text),r.extract.analysis?JSON.stringify(r.extract.analysis):''].join(' ')).includes(q)));
  const cmp={recientes:(a,b)=>(b.created||0)-(a.created||0),antiguas:(a,b)=>(a.created||0)-(b.created||0),calificadas:(a,b)=>(b.rating||0)-(a.rating||0)||(b.fav?1:0)-(a.fav?1:0),
    marca:(a,b)=>(a.brand||'~').localeCompare(b.brand||'~','es'),duracion:(a,b)=>(a.extract.duration||thumbCache[a.mediaId]?.duration||9999)-(b.extract.duration||thumbCache[b.mediaId]?.duration||9999)}[f.orden];
  return list.sort(cmp);
}
function vRefs(){
  const f=libState(); const all=libScope(); const list=libFiltered();
  const cnt=fn=>all.filter(fn).length;
  const fuenteN=s=>all.filter(r=>r.source===s).length;
  const brands=Object.entries(all.reduce((o,r)=>{if(r.brand)o[r.brand]=(o[r.brand]||0)+1;return o;},{})).sort((a,b)=>b[1]-a[1]);
  const cols=libCollections();
  const pend=all.filter(r=>r.mediaId&&r.extract.status!=='listo'&&!JOBS[r.id]).length;
  const hayFiltros=f.fuente||f.coleccion||f.marca||f.formato||f.etapa||f.concepto||f.angulo||f.q;
  setTop('Biblioteca',`Anuncios de otras marcas y redes · ${f.scope==='todos'?'todos los productos':prod().name}`,
    `<div class="lsearch">${ic('search','sm')}<label class="visually-hidden" for="lq">Buscar en la biblioteca</label><input id="lq" value="${esc(f.q)}" placeholder="Buscar marca, frase dicha o texto en pantalla…"></div>
     ${pend?`<button class="btn ghost" id="lall" title="Extraer el guion de los anuncios que aún no lo tienen">Extraer pendientes (${pend})</button>`:''}
     <div class="menuwrap"><button class="btn" id="ladd" aria-haspopup="true" aria-expanded="false">${ic('plus','sm')}Agregar</button>
       <div class="menu" id="laddmenu" hidden>
         <button data-add="subir">${ic('up','sm')}<span><b>Subir videos o imágenes</b><small>Varios a la vez</small></span></button>
         <button data-add="enlace">${ic('link','sm')}<span><b>Pegar un enlace</b><small>Biblioteca de Meta, TikTok, Instagram…</small></span></button>
         <button data-add="ext">${ic('ext','sm')}<span><b>Extensión Nova Swipe</b><small>Captura desde Chrome</small></span></button>
       </div></div>`);
  const navItem=(key,val,label,n,icon)=>`<button class="lnav ${f[key]===val?'on':''}" data-lf="${key}" data-v="${esc(val)}">${icon||''}<span class="lbl">${esc(label)}</span><span class="n">${n}</span></button>`;
  $('#body').innerHTML=`<div class="libwrap">
   <aside class="lside">
     <div class="seg2">${[['producto',prod().name],['todos','Todos']].map(([k,l])=>`<button data-scope="${k}" class="${f.scope===k?'on':''}">${esc(l)}</button>`).join('')}</div>
     <div class="lgrp">Fuentes</div>
     ${navItem('fuente','','Todas las fuentes',all.length)}
     ${SOURCE_GROUPS.map(([g,items])=>`<div class="lsub">${g}</div>`+items.map(([n])=>navItem('fuente',n,n,fuenteN(n),srcIcon(n))).join('')).join('')}
     <div class="lgrp" style="display:flex;align-items:center">Colecciones<button class="iconbtn" id="lcolnew" aria-label="Nueva colección" title="Nueva colección">${ic('plus','sm')}</button></div>
     ${cols.length?cols.map(c=>navItem('coleccion',c,c,all.filter(r=>r.collection===c).length)).join(''):'<p class="hint" style="margin:2px 10px">Agrupa anuncios por tema o campaña.</p>'}
     <div class="lgrp">Marcas</div>
     ${brands.length?brands.slice(0,12).map(([b,n])=>navItem('marca',b,b,n)).join(''):'<p class="hint" style="margin:2px 10px">Pon la marca al clasificar.</p>'}
     <div class="extcard">
       <div style="display:flex;gap:8px;align-items:center">${ic('ext','sm')}<b>Nova Swipe</b></div>
       <p>Guarda anuncios desde Chrome directo a esta biblioteca.</p>
       <button class="btn sm" id="lext">Descargar extensión</button>
     </div>
   </aside>
   <section class="lmain">
     <div class="ltabs">
       ${[['todas','Todas',all.length],['clasificar','Por clasificar',cnt(porClasificar)],['favoritas','Favoritas',cnt(r=>r.fav)],['guion','Con guion',cnt(r=>r.extract.status==='listo')]].map(([k,l,n])=>`<button class="${f.tab===k?'on':''}" data-tab="${k}">${l}<span>${n}</span></button>`).join('')}
       <span style="margin-left:auto;display:flex;gap:8px;align-items:center">
         <label class="visually-hidden" for="lsort">Ordenar</label><select id="lsort" class="fsel">${SORTS.map(([k,l])=>`<option value="${k}" ${f.orden===k?'selected':''}>${l}</option>`).join('')}</select>
         <div class="vtog" role="group" aria-label="Vista"><button data-vista="grid" class="${f.vista==='grid'?'on':''}" aria-label="Cuadrícula">${ic('ref','sm')}</button><button data-vista="lista" class="${f.vista==='lista'?'on':''}" aria-label="Lista">${ic('hook','sm')}</button></div>
       </span>
     </div>
     <div class="lfilters">
       <label class="visually-hidden" for="lff">Formato</label><select id="lff" class="fsel" data-sel="formato"><option value="">Formato</option>${FORMATS.map(x=>`<option value="${x[0]}" ${f.formato===x[0]?'selected':''}>${x[1]}</option>`).join('')}<option value="link" ${f.formato==='link'?'selected':''}>Solo enlace</option></select>
       <label class="visually-hidden" for="lfe">Etapa</label><select id="lfe" class="fsel" data-sel="etapa">${stageOpt(f.etapa,'Etapa')}</select>
       <label class="visually-hidden" for="lfc">Concepto</label><select id="lfc" class="fsel" data-sel="concepto">${opt(S.concepts,f.concepto,'Concepto')}</select>
       <label class="visually-hidden" for="lfa">Ángulo</label><select id="lfa" class="fsel" data-sel="angulo">${opt(f.scope==='todos'?S.angles:mine(S.angles),f.angulo,'Ángulo')}</select>
       ${[['fuente','Fuente'],['coleccion','Colección'],['marca','Marca']].filter(([k])=>f[k]).map(([k,l])=>`<span class="chip">${l}: ${esc(f[k])}<button class="chipx" data-clear="${k}" aria-label="Quitar filtro ${l}">×</button></span>`).join('')}
       ${hayFiltros?'<button class="linkbtn" id="lclear">Limpiar filtros</button>':''}
       <span class="muted" style="margin-left:auto;font-size:13px">${list.length} anuncio${list.length===1?'':'s'}</span>
     </div>
     ${list.length?(f.vista==='grid'?`<div class="lib">${list.map(libCard).join('')}</div>`:libTable(list))
       :all.length?`<div class="empty">Nada coincide con estos filtros. <button class="linkbtn" id="lclear2">Limpiar filtros</button></div>`
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
   </section></div>`;
  // búsqueda
  const lq=$('#lq'); lq.oninput=()=>{f.q=lq.value;clearTimeout(lq._t);lq._t=setTimeout(()=>{const pos=lq.selectionStart;render();const n=$('#lq');n.focus();n.setSelectionRange(pos,pos);},250);};
  if($('#lall'))$('#lall').onclick=async()=>{for(const r of all.filter(r=>r.mediaId&&r.extract.status!=='listo')){await runExtract(r,{voz:true,texto:true});}};
  // menú agregar
  const menu=$('#laddmenu'),ladd=$('#ladd');
  ladd.onclick=e=>{e.stopPropagation();menu.hidden=!menu.hidden;ladd.setAttribute('aria-expanded',String(!menu.hidden));};
  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{menu.hidden=true;const a=b.dataset.add;if(a==='subir')pick();else if(a==='enlace')addLink();else openExtension();});
  $('#lext').onclick=openExtension;
  // navegación lateral y filtros
  document.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{f.scope=b.dataset.scope;render();});
  document.querySelectorAll('[data-lf]').forEach(b=>b.onclick=()=>{const k=b.dataset.lf,v=b.dataset.v;f[k]=f[k]===v&&v?'':v;render();});
  document.querySelectorAll('.ltabs [data-tab]').forEach(b=>b.onclick=()=>{f.tab=b.dataset.tab;render();});
  document.querySelectorAll('[data-sel]').forEach(s=>s.onchange=()=>{f[s.dataset.sel]=s.value;render();});
  document.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>{f[b.dataset.clear]='';render();});
  const limpiar=()=>{Object.assign(f,{fuente:'',coleccion:'',marca:'',formato:'',etapa:'',concepto:'',angulo:'',q:''});render();};
  if($('#lclear'))$('#lclear').onclick=limpiar; if($('#lclear2'))$('#lclear2').onclick=limpiar;
  $('#lsort').onchange=e=>{f.orden=e.target.value;render();};
  document.querySelectorAll('[data-vista]').forEach(b=>b.onclick=()=>{f.vista=b.dataset.vista;render();});
  $('#lcolnew').onclick=()=>{const n=prompt('Nombre de la colección');if(n&&n.trim()){const c=n.trim();if(!libCollections().includes(c))S.libCollections.push(c);save();f.coleccion=c;render();}};
  // tarjetas
  document.querySelectorAll('[data-fav]').forEach(b=>b.onclick=e=>{e.stopPropagation();const r=byId(S.refs,b.dataset.fav);r.fav=!r.fav;save();render();});
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
  S.refs.unshift({id:uid('r'),productId:PID(),mediaId:null,kind:'link',brand:'',source:linkSource(u),conceptId:'',angleId:'',stage:'',notes:'',link:u.trim(),created:Date.now()});
  save();render();openRef(S.refs[0].id,'datos');toast('Enlace guardado');
}
function libCard(r){
  const ex=r.extract; const ready=ex.status==='listo';
  const hook=ready?(ex.analysis?.hook?.texto||ex.blocks[0]?.voz||ex.blocks[0]?.texto||''):'';
  const dur=ex.duration||thumbCache[r.mediaId]?.duration;
  return `<div class="libcard" data-id="${r.id}" tabindex="0" role="button" aria-label="Abrir ${esc(r.brand||'referencia')}">
    <div style="position:relative">
    ${r.kind==='link'?`<div class="thumb" style="aspect-ratio:9/16;background:#f1f5f9;color:#334155;flex-direction:column;gap:8px">${srcIcon(r.source,'')}<span style="font-weight:600">${esc(r.source)}</span><span style="font-size:11px;padding:0 14px;text-align:center;color:#64748b">Solo enlace · adjunta el video para extraer su guion</span></div>`:
      `<div class="thumb" style="aspect-ratio:9/16" data-thumb="${r.mediaId}"></div>`}
      <button class="favbtn ${r.fav?'on':''}" data-fav="${r.id}" aria-label="${r.fav?'Quitar de favoritas':'Marcar como favorita'}" aria-pressed="${!!r.fav}">${ic('star','sm')}</button>
      ${ready?'<span class="readybadge">Guion</span>':''}
    </div>
    <div class="lb">
      <div style="display:flex;align-items:center;gap:6px"><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.brand||'Sin marca')}</b>${r.rating?`<span class="muted" style="margin-left:auto;font-size:12px" aria-label="${r.rating} de 5">${'★'.repeat(r.rating)}</span>`:''}</div>
      <span class="muted" style="font-size:12px;display:flex;gap:5px;align-items:center">${srcIcon(r.source)}${esc(r.source)}${dur?' · '+tstr(dur):''}</span>
      ${r.adId?`<span class="muted" style="font-size:11px;font-family:ui-monospace,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="ID del anuncio o publicación">ID ${esc(r.adId)}</span>`:''}
      ${hook?`<span class="hookline">“${esc(hook.slice(0,90))}”</span>`:''}
      <div style="display:flex;gap:5px;flex-wrap:wrap">${ex.status==='error'?'<span class="chip lose">Error al extraer</span>':''}${r.stage?`<span class="chip ${r.stage}">${r.stage}</span>`:''}${r.conceptId?`<span class="chip">${esc(byId(S.concepts,r.conceptId)?.name||'')}</span>`:''}${porClasificar(r)?'<span class="chip warn">Por clasificar</span>':''}</div>
      ${progHTML(r.id)}
    </div></div>`;
}
function libTable(list){
  return `<div class="panel" style="overflow:auto"><table><thead><tr><th></th><th>Marca</th><th>Fuente</th><th>Formato</th><th>Etapa</th><th>Concepto</th><th>Colección</th><th>Guion</th><th>Agregado</th><th></th></tr></thead><tbody>
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
async function openExtension(){
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
        <div style="display:flex;gap:6px"><label class="visually-hidden" for="xkey">Clave</label><input id="xkey" readonly value="${esc(st.clave||'')}" type="password" style="flex-grow:1;height:34px;border:1px solid var(--line);border-radius:8px;padding:0 10px;font-family:ui-monospace,Menlo,monospace;font-size:12px"><button class="btn ghost sm" id="xshow">Mostrar</button><button class="btn ghost sm" id="xcopy">Copiar</button><button class="btn ghost sm" id="xnew">Regenerar</button></div>
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
let bandejaActiva=false;
async function traerBandeja(){
  if(bandejaActiva||!S)return; bandejaActiva=true;
  try{
    const r=await fetch('/api/inbox',{credentials:'same-origin'}); if(!r.ok)return;
    const {items=[]}=await r.json(); if(!items.length)return;
    const listos=[];
    for(const it of items){ try{await recibirSwipe(it);listos.push(it.id);}catch(e){console.warn('Nova Swipe',e);} }
    if(!listos.length)return;
    save();
    await fetch('/api/inbox/ack',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:listos})});
    if(UI.view==='referencias'&&!UI.refOpen)render(); else renderSide();
    toast(listos.length===1?'Llegó 1 anuncio desde Nova Swipe':`Llegaron ${listos.length} anuncios desde Nova Swipe`);
  }catch(e){console.warn(e);}finally{bandejaActiva=false;}
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

function openRef(id,tab){UI.refOpen=id;UI.refTab=tab||(byId(S.refs,id).extract?.status==='listo'?'guion':'datos');UI.refPrompt=false;renderRefModal();}
function closeRef(){UI.refOpen=null;$('#rov')?.remove();render();}
function buildRefPrompt(r){
  const ex=r.extract;
  const lines=(ex.blocks||[]).map((b,i)=>`${i+1}. [${b.tiempo||'—'}] voz: ${b.voz||'—'} | texto en pantalla: ${b.texto||'—'}`).join('\n');
  return `Analiza este anuncio de ${r.brand||'una marca'} (${r.source}) para aprender por qué funciona y adaptarlo a mi producto.

## Anuncio
- Tipo: ${r.kind==='image'?'Imagen':'Video'}${ex.duration?`, ${Math.round(ex.duration)} segundos`:''}
- Notas mías: ${r.notes||'—'}
- Transcripción y texto en pantalla por tramos (extraído automáticamente, puede tener errores de lectura):
${lines||'—'}

## Mi producto
- ${prod().name}: ${prod().brief?prod().brief.replace(/\n+/g,' · '):'[describe beneficios, precio y oferta]'}
- Vendo contra entrega en Perú, con tono peruano natural y sin promesas médicas.

## Qué necesito
1. Clasifica cada tramo con su función (Hook, Problema, Agitación, Demostración, Prueba / testimonio, Beneficio, Comparación, Objeción, Oferta, CTA) y corrige errores obvios de lectura.
2. Explica el hook y por qué detiene el scroll.
3. Detecta el concepto creativo, el ángulo de venta y la etapa del embudo donde funcionaría (TOFU, MOFU o BOFU).
4. Saca frases con lenguaje real del público que pueda reutilizar.
5. Propón una adaptación para ${prod().name} sin copiar el anuncio.

Responde SOLO con un JSON válido con esta forma:
{
  "formato": "video | video_texto | imagen | carrusel",
  "concepto": "",
  "angulo": "",
  "etapa": "TOFU | MOFU | BOFU",
  "hook": {"texto": "", "tipo": "Hablado | Texto en pantalla | Visual", "por_que_funciona": ""},
  "bloques": [{"tipo": "", "tiempo": "", "voz": "", "texto_pantalla": "", "visual": ""}],
  "por_que_funciona": "",
  "lenguaje_del_publico": [""],
  "adaptacion": {"hook": "", "idea": ""}
}`;
}
function applyRefAnalysis(r,d){
  const ex=r.extract;
  if(Array.isArray(d.bloques)&&d.bloques.length){
    const old=ex.blocks||[];
    ex.blocks=d.bloques.map((b,i)=>({id:uid('b'),tipo:b.tipo||'',tiempo:b.tiempo||old[i]?.tiempo||'',start:old[i]?.start||0,voz:b.voz||'',texto:b.texto_pantalla||b.texto||'',visual:b.visual||'',frame:old[i]?.frame??-1}));
  }
  ex.analysis={hook:d.hook||null,por_que:d.por_que_funciona||'',lenguaje:(d.lenguaje_del_publico||[]).filter(Boolean),adaptacion:d.adaptacion||null,angulo:d.angulo||'',concepto:d.concepto||''};
  if(d.etapa&&STAGES.includes(d.etapa)&&!r.stage)r.stage=d.etapa;
  if(d.concepto&&!r.conceptId){const k=normTxt(d.concepto);const c=S.concepts.find(c=>normTxt(c.name)===k)||S.concepts.find(c=>normTxt(c.name).startsWith(k)||k.startsWith(normTxt(c.name)));if(c)r.conceptId=c.id;}
  if(d.formato&&FORMATS.some(f=>f[0]===d.formato))r.format=d.formato;
  if(ex.status!=='listo'){ex.status='listo';ex.at=Date.now();}
}
function pieceFromRef(r,useAdapt=false){
  const ex=r.extract,a=ex.analysis;
  const p=newPiece({title:useAdapt&&a?.adaptacion?.hook?a.adaptacion.hook.slice(0,60):(r.brand?`Basado en ${r.brand}`:'Basado en referencia'),
    conceptId:r.conceptId,angleId:r.angleId,stage:r.stage,format:r.format||(r.kind==='image'?'imagen':'video'),status:'idea',refId:r.id});
  p.script={blocks:(ex.blocks||[]).map(b=>({id:uid('b'),tipo:b.tipo||'',tiempo:b.tiempo||'',voz:'',texto:'',visual:`Como en la referencia (${b.tiempo||'—'})${b.voz?': "'+b.voz.slice(0,80)+'"':''}`}))};
  if(useAdapt&&a?.adaptacion?.hook&&p.script.blocks[0]){ if(p.format==='video')p.script.blocks[0].voz=a.adaptacion.hook; else p.script.blocks[0].texto=a.adaptacion.hook; }
  save(); closeRef(); openModal(p.id,'guion');
}
/* Sugerencias a partir del guion extraído y del copy: son un atajo, no un
 * automatismo. Solo se aplican si el usuario toca el chip. */
function sugerencias(r){
  const ex=r.extract||{};
  const t=normTxt([(ex.blocks||[]).map(b=>`${b.voz||''} ${b.texto||''}`).join(' '),r.adText||''].join(' '));
  if(!t)return {stage:'',concepto:''};
  const tiene=(...ws)=>ws.some(w=>t.includes(w));
  let stage='';
  if(tiene('compra','pide','pedido','oferta','descuento','ultimas unidades','promocion','precio','solo hoy','contra entrega','whatsapp','envio gratis','link','clic aqui'))stage='BOFU';
  else if(tiene('probe','probo','mi mama','resultados','despues de','recomiendo','comprobado','me funciono','testimonio','reseña'))stage='MOFU';
  else stage='TOFU';
  let concepto='';
  if(tiene('dolor','cansado','cansada','sufr','molestia','no aguant','problema'))concepto='Problema → Solución';
  else if(tiene('probe','probo','mi mama','me compre','les cuento','testimonio'))concepto='Testimonio';
  else if(tiene('antes','despues'))concepto='Antes y después';
  else if(tiene('como usar','paso a paso','tutorial','asi se','se coloca'))concepto='Demostración';
  const yaCon=concepto&&S.concepts.some(c=>c.id===r.conceptId&&normTxt(c.name)===normTxt(concepto));
  return {stage:stage===r.stage?'':stage,concepto:yaCon?'':concepto};
}
function aplicarConcepto(r,nombre){
  let c=S.concepts.find(x=>normTxt(x.name)===normTxt(nombre))||S.concepts.find(x=>normTxt(x.name).startsWith(normTxt(nombre).slice(0,8)));
  if(!c){c={id:uid('c'),name:nombre};S.concepts.push(c);}
  r.conceptId=c.id;
}
/* ---- storyboard: la tira de escenas como imagen para compartir ---- */
function sbCaption(r,i){
  const b=(r.extract.blocks||[]).find(x=>x.frame===i);
  return b?{voz:b.voz||'',texto:b.texto||'',tipo:b.tipo||''}:{voz:'',texto:'',tipo:''};
}
function openStoryboard(r){
  ensureRef(r);
  if(!r.extract.frames||r.extract.frames.length<2)return toast('Este anuncio todavía no tiene fotogramas');
  if(!UI.sb)UI.sb={cols:4,voz:true,texto:true,off:[]};
  renderStoryboard(r);
}
function renderStoryboard(r){
  const ex=r.extract,sb=UI.sb;
  $('#sbov')?.remove();
  const dentro=i=>!sb.off.includes(i);
  const total=ex.frames.length,incluidas=ex.frames.filter((f,i)=>dentro(i)).length;
  const ov=document.createElement('div');ov.className='ov';ov.id='sbov';
  ov.innerHTML=`<div class="modal sbmodal" role="dialog" aria-modal="true" aria-label="Storyboard">
    <div class="mh"><div style="min-width:0"><b>Storyboard · ${esc(r.brand||'Referencia')}</b>
      <div class="muted" style="font-size:13px">${esc(r.source)}${ex.duration?' · '+tstr(ex.duration):''} · ${incluidas} de ${total} escenas en la captura</div></div>
      <button class="btn ghost sm" id="sbx" style="margin-left:auto" aria-label="Cerrar">${ic('x','sm')}</button></div>
    <div class="sbbar">
      <div class="seg sm">${[3,4,6].map(c=>`<button data-cols="${c}" class="${sb.cols===c?'on':''}">${c} columnas</button>`).join('')}</div>
      <label class="ck"><input type="checkbox" id="sbv" ${sb.voz?'checked':''}> Voz</label>
      <label class="ck"><input type="checkbox" id="sbt" ${sb.texto?'checked':''}> Texto en pantalla</label>
      <button class="lnk" id="sball">Incluir todas</button>
      <span class="hint">Toca una escena para quitarla de la captura</span>
      <span style="margin-left:auto;display:flex;gap:6px"><button class="btn ghost sm" id="sbcopy">${ic('copy','sm')}Copiar imagen</button><button class="btn sm" id="sbdl">${ic('down','sm')}Guardar captura</button></span>
    </div>
    <div class="sbgrid" style="grid-template-columns:repeat(${sb.cols},minmax(0,1fr))">
      ${ex.frames.map((f,i)=>{const c=sbCaption(r,i);return `<div class="sbc ${dentro(i)?'':'off'}" data-sc="${i}" role="button" tabindex="0" aria-pressed="${dentro(i)}">
        <div class="sbimg"><img src="${f.thumb}" alt="Escena ${i+1}"><span class="n">${i+1}</span>${dentro(i)?`<span class="mk">${ic('check','sm')}</span>`:''}</div>
        <div class="sbcap"><div class="l"><b>${tstr(f.t)}</b>${c.tipo?`<span class="chip ${c.tipo==='Hook'?'win':''}">${esc(c.tipo.toUpperCase())}</span>`:''}</div>
          ${sb.voz&&c.voz?`<p>“${esc(c.voz)}”</p>`:''}${sb.texto&&c.texto?`<p class="ptxt">${esc(c.texto)}</p>`:''}</div></div>`;}).join('')}
    </div></div>`;
  document.body.appendChild(ov);
  const q=s=>ov.querySelector(s);
  const cerrar=()=>ov.remove();
  q('#sbx').onclick=cerrar; ov.addEventListener('mousedown',e=>{if(e.target===ov)cerrar();});
  ov.querySelectorAll('[data-cols]').forEach(b=>b.onclick=()=>{sb.cols=+b.dataset.cols;renderStoryboard(r);});
  q('#sbv').onchange=e=>{sb.voz=e.target.checked;renderStoryboard(r);};
  q('#sbt').onchange=e=>{sb.texto=e.target.checked;renderStoryboard(r);};
  q('#sball').onclick=()=>{sb.off=[];renderStoryboard(r);};
  const alternar=i=>{sb.off=sb.off.includes(i)?sb.off.filter(x=>x!==i):[...sb.off,i];renderStoryboard(r);};
  ov.querySelectorAll('[data-sc]').forEach(c=>{const i=+c.dataset.sc;c.onclick=()=>alternar(i);c.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();alternar(i);}};});
  q('#sbdl').onclick=async()=>{
    const b=await storyboardPNG(r); if(!b)return toast('Elige al menos una escena');
    const a=document.createElement('a');a.href=URL.createObjectURL(b);
    a.download='storyboard_'+(r.brand||'anuncio').replace(/[^a-zA-Z0-9-]+/g,'_')+'.png';
    a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);toast('Captura guardada');
  };
  q('#sbcopy').onclick=async()=>{
    const b=await storyboardPNG(r); if(!b)return toast('Elige al menos una escena');
    try{ await navigator.clipboard.write([new ClipboardItem({'image/png':b})]); toast('Imagen copiada'); }
    catch(e){ toast('Tu navegador no deja copiar imágenes: usa “Guardar captura”'); }
  };
}
async function storyboardPNG(r){
  const ex=r.extract,sb=UI.sb||{cols:4,voz:true,texto:true,off:[]};
  const escenas=ex.frames.map((f,i)=>({t:f.t,thumb:f.thumb,i})).filter(f=>!sb.off.includes(f.i));
  if(!escenas.length)return null;
  const imgs=await Promise.all(escenas.map(f=>new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>res(null);im.src=f.thumb;})));
  const caps=escenas.map(f=>{const c=sbCaption(r,f.i);const l=[];if(sb.voz&&c.voz)l.push('“'+c.voz+'”');if(sb.texto&&c.texto)l.push('Texto: '+c.texto);return {tipo:c.tipo,txt:l.join('  ')};});
  const W=240,pad=28,gap=18,cols=Math.min(sb.cols,escenas.length),alturaLinea=19;
  const FUENTE='Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
  const medidor=document.createElement('canvas').getContext('2d');
  medidor.font='14px '+FUENTE;
  const envolver=t=>{const out=[];let ln='';for(const p of String(t).split(' ')){const pr=ln?ln+' '+p:p;if(medidor.measureText(pr).width>W-6&&ln){out.push(ln);ln=p;}else ln=pr;}if(ln)out.push(ln);return out.slice(0,6);};
  const lineas=caps.map(c=>c.txt?envolver(c.txt):[]);
  const altoImg=k=>{const im=imgs[k];return im?Math.round(W*im.height/im.width):Math.round(W*16/9);};
  const filas=[];const orden=escenas.map((_,k)=>k);
  for(let i=0;i<orden.length;i+=cols)filas.push(orden.slice(i,i+cols));
  const medidas=filas.map(f=>({hImg:Math.max(...f.map(altoImg)),hTxt:26+Math.max(...f.map(k=>lineas[k].length))*alturaLinea}));
  const cvW=pad*2+cols*W+(cols-1)*gap;
  const cvH=pad*2+56+medidas.reduce((s,m)=>s+m.hImg+m.hTxt+gap,0);
  const cv=document.createElement('canvas');cv.width=cvW;cv.height=cvH;
  const cx=cv.getContext('2d');
  cx.fillStyle='#ffffff';cx.fillRect(0,0,cvW,cvH);
  cx.fillStyle='#0f172a';cx.font='700 20px '+FUENTE;
  cx.fillText('Storyboard · '+(r.brand||'Referencia'),pad,pad+18);
  cx.fillStyle='#64748b';cx.font='13px '+FUENTE;
  cx.fillText((r.source||'')+(ex.duration?' · '+tstr(ex.duration):'')+' · '+escenas.length+' escenas',pad,pad+40);
  let y=pad+56;
  filas.forEach((fila,fi)=>{
    const m=medidas[fi];
    fila.forEach((k,col)=>{
      const x=pad+col*(W+gap),im=imgs[k];
      cx.fillStyle='#e2e8f0';cx.fillRect(x,y,W,m.hImg);
      if(im)cx.drawImage(im,x,y,W,altoImg(k));
      cx.fillStyle='rgba(15,23,42,.82)';cx.fillRect(x,y+m.hImg-24,54,24);
      cx.fillStyle='#ffffff';cx.font='700 12px '+FUENTE;
      cx.fillText(tstr(escenas[k].t),x+8,y+m.hImg-7);
      const ty=y+m.hImg+18;
      cx.fillStyle='#0f172a';cx.font='700 12px '+FUENTE;
      cx.fillText('Escena '+(escenas[k].i+1)+(caps[k].tipo?' · '+caps[k].tipo:''),x,ty);
      cx.fillStyle='#334155';cx.font='14px '+FUENTE;
      lineas[k].forEach((l,li)=>cx.fillText(l,x,ty+20+li*alturaLinea));
    });
    y+=m.hImg+m.hTxt+gap;
  });
  return await new Promise(res=>cv.toBlob(res,'image/png'));
}
function renderRefModal(){
  const r=byId(S.refs,UI.refOpen); if(!r){UI.refOpen=null;return;} ensureRef(r);
  const keep=$('#rov')?.querySelector('.rright')?.scrollTop||0; const vt=$('#rov video.player')?.currentTime||0;
  $('#rov')?.remove();
  const ex=r.extract,tab=UI.refTab||'guion',ready=ex.status==='listo';
  const ov=document.createElement('div');ov.className='ov';ov.id='rov';
  const tabBtn=(k,l)=>`<button role="tab" aria-selected="${tab===k}" data-rtab="${k}" class="${tab===k?'on':''}">${l}</button>`;
  let right='';
  if(tab==='guion'){
    const modo=UI.refModo==='editar'?'editar':'leer';
    const bl=ex.blocks||[];
    const palabras=bl.reduce((n,b)=>n+(b.voz?normTxt(b.voz).split(' ').filter(Boolean).length:0),0);
    const porMin=ex.duration>4&&palabras?Math.round(palabras/(ex.duration/60)):0;
    const legibles=bl.filter(b=>b.texto).length, ilegibles=bl.filter(b=>!b.texto&&b.ilegible).length;
    const hook=bl[0];
    const ilegHTML=(b,i)=>b.texto?'':b.ilegible?`<button class="lnk ileg" data-ileg="${i}">${ic('text','sm')}Texto en pantalla ilegible · ver lo leído</button>
        <div class="ilegbox" data-ilegbox="${i}" hidden><span>“${esc(b.ilegible)}”</span><button class="lnk" data-usar="${i}">Usar este texto</button></div>`:'';
    right=ready&&bl.length?`
      <div class="rstats">${ex.duration?`<span><b>${tstr(ex.duration)}</b>duración</span>`:''}<span><b>${bl.length}</b>tramo${bl.length===1?'':'s'}</span>${palabras?`<span><b>${palabras}</b>palabras</span>`:''}${porMin?`<span><b>${porMin}</b>/min</span>`:''}<span><b>${legibles}</b>texto${legibles===1?'':'s'} en pantalla legible${legibles===1?'':'s'}${ilegibles?` · ${ilegibles} ilegible${ilegibles===1?'':'s'} oculto${ilegibles===1?'':'s'}`:''}</span></div>
      <div class="rbar">
        <div class="seg sm" role="tablist">${[['leer','Leer'],['editar','Editar tramos']].map(([m,l])=>`<button role="tab" aria-selected="${modo===m}" data-rmodo="${m}" class="${modo===m?'on':''}">${l}</button>`).join('')}</div>
        <span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">${ilegibles?'<button class="btn ghost sm" id="rclean">Borrar textos ilegibles</button>':''}<button class="btn ghost sm" id="rcopy">Copiar guion</button><button class="btn sm" id="rtopiece">Crear pieza con esta estructura</button></span>
      </div>
      ${hook&&(hook.voz||hook.texto)?`<div class="hookbox"><div class="section-t">HOOK · ${esc(hook.tiempo||tstr(hook.start||0))}</div>
        <p>“${esc((hook.voz||hook.texto).slice(0,260))}”</p>
        ${r.kind==='video'?`<button class="lnk" data-play="${hook.start||0}">${ic('play','sm')}Ver el hook</button>`:''}</div>`:''}
      ${modo==='leer'?`<div class="tlread">${bl.map((b,i)=>`<div class="tr" data-play="${b.start||0}" role="button" tabindex="0" aria-label="Ir a ${esc(b.tiempo||'')}">
          <span class="t">${esc((b.tiempo||'').split('–')[0]||tstr(b.start||0))}</span>
          <div class="c">${b.tipo?`<span class="chip ${b.tipo==='Hook'?'win':''}">${esc(b.tipo.toUpperCase())}</span>`:''}
            <p>${b.voz?esc(b.voz):'<span class="muted">Sin voz en este tramo</span>'}</p>
            ${b.texto?`<p class="ptxt">${ic('text','sm')}${esc(b.texto)}</p>`:ilegHTML(b,i)}
          </div></div>`).join('')}</div>`
      :`<div class="tl">${bl.map((b,i)=>`<div class="tlr" data-b="${i}">
        <button class="tlf" data-seek="${b.start||0}" aria-label="Ir a ${esc(b.tiempo)}">${b.frame>=0&&ex.frames[b.frame]?.thumb?`<img src="${ex.frames[b.frame].thumb}" alt="">`:''}<span>${esc(b.tiempo||'—')}</span></button>
        <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
          <label class="visually-hidden" for="tt-${i}">Función del tramo</label>
          <select id="tt-${i}" data-bf="tipo" class="fsel" style="align-self:stretch"><option value="">Asignar función</option>${BLOCK_TYPES.map(t=>`<option ${t===b.tipo?'selected':''}>${t}</option>`).join('')}</select>
          <div class="field"><label for="tv-${i}">Voz</label><textarea id="tv-${i}" data-bf="voz" rows="2">${esc(b.voz)}</textarea></div>
          ${b.texto||!b.ilegible?`<div class="field"><label for="tx-${i}">Texto en pantalla</label><textarea id="tx-${i}" data-bf="texto" rows="2">${esc(b.texto)}</textarea></div>`:ilegHTML(b,i)}
          ${b.visual?`<div class="hint">Visual: ${esc(b.visual)}</div>`:''}
        </div></div>`).join('')}</div>`}`
    :`<div class="empty" style="text-align:left;display:flex;flex-direction:column;gap:10px">
        <b style="color:var(--ink)">${ex.status==='procesando'||JOBS[r.id]?'Extrayendo el guion…':'Todavía no hay guion extraído'}</b>
        <span>${r.kind==='link'?'Este es solo un enlace. Descarga el video con Nova Swipe y adjúntalo para poder extraerlo.':ex.status==='procesando'||JOBS[r.id]?'Se sacan los fotogramas, se transcribe la voz y se lee el texto en pantalla. Todo corre en tu navegador: puedes seguir trabajando.':'Se extrae solo apenas llega el archivo. Si quieres, toca “Extraer guion” para hacerlo ahora.'}</span>
        ${ex.status==='error'?`<span style="color:var(--red)">Último intento: ${esc(ex.error||'error')}</span>`:''}
      </div>`;
  }else if(tab==='desglose'){
    const a=ex.analysis;
    right=`<div class="panel" style="padding:14px;background:#f8fafc;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>Desglose con IA</b><span class="hint">Usa el guion extraído y la ficha de ${esc(prod().name)}.</span><button class="btn sm" id="rgp" style="margin-left:auto">${UI.refPrompt?'Regenerar prompt':'Generar prompt'}</button></div>
        ${UI.refPrompt?`<div class="field"><label for="rpt">Prompt</label><textarea id="rpt" style="min-height:200px;font-family:ui-monospace,Menlo,monospace;font-size:12px">${esc(buildRefPrompt(r))}</textarea></div>
        <div><button class="btn sm" id="rpc">Copiar prompt</button></div>
        <div class="field"><label for="rpa">Pega la respuesta de la IA</label><textarea id="rpa" placeholder='{"hook": {...}, "bloques": [...]}'></textarea></div>
        <div style="display:flex;gap:8px"><button class="btn sm" id="rpapply">Aplicar desglose</button><button class="btn ghost sm" id="rpx">Cerrar</button></div>`:''}
      </div>
      ${a?`<div class="panel" style="padding:14px;display:flex;flex-direction:column;gap:12px">
        ${a.hook?`<div><div class="section-t">Hook</div><p style="margin:6px 0 2px;font-size:15px;font-weight:700">“${esc(a.hook.texto)}”</p><span class="chip">${esc(a.hook.tipo||'')}</span><p class="hint" style="margin:6px 0 0">${esc(a.hook.por_que_funciona||'')}</p></div>`:''}
        ${a.por_que?`<div><div class="section-t">Por qué funciona</div><p style="margin:6px 0 0;line-height:1.5">${esc(a.por_que)}</p></div>`:''}
        <div style="display:flex;gap:6px;flex-wrap:wrap">${a.concepto?`<span class="chip">Concepto: ${esc(a.concepto)}</span>`:''}${a.angulo?`<span class="chip ang">Ángulo: ${esc(a.angulo)}</span>`:''}${r.stage?`<span class="chip ${r.stage}">${r.stage}</span>`:''}</div>
        ${a.lenguaje?.length?`<div><div class="section-t">Lenguaje del público</div><div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">${a.lenguaje.map((l,i)=>`<div style="display:flex;gap:8px;align-items:center"><span style="flex-grow:1">“${esc(l)}”</span><button class="btn ghost sm" data-lh="${i}">Guardar como hook</button></div>`).join('')}</div></div>`:''}
        ${a.adaptacion?.hook||a.adaptacion?.idea?`<div class="panel" style="padding:12px;background:#f0fdfa;border-color:#99f6e4"><div class="section-t">Adaptación para ${esc(prod().name)}</div>${a.adaptacion.hook?`<p style="margin:6px 0 2px;font-weight:700">“${esc(a.adaptacion.hook)}”</p>`:''}<p class="hint" style="margin:0">${esc(a.adaptacion.idea||'')}</p>
          <div style="display:flex;gap:6px;margin-top:8px"><button class="btn sm" id="radapt">Crear pieza con esta adaptación</button><button class="btn ghost sm" id="raidea">Guardar como idea</button>${a.adaptacion.hook?'<button class="btn ghost sm" id="rahook">Guardar hook</button>':''}</div></div>`:''}
      </div>`:''}`;
  }else{
    const dias=diasActivo(r), senal=senalDias(dias), sug=sugerencias(r);
    const cuerpo=(r.adText||'').trim();
    const lineas=cuerpo?cuerpo.split(String.fromCharCode(10)).map(x=>x.trim()).filter(Boolean):[];
    const primera=lineas.length>1||(lineas[0]||'').length<160?lineas[0]||'':'';
    const resto=(primera?lineas.slice(1):lineas).join(' ');
    const prodName=byId(S.products,r.productId)?.name||'';
    right=`<div class="dwrap">
      ${senal?`<div class="panel dcard"><div class="dsenal ${senal.tono}"><b>${dias}</b><span>días activo</span></div>
        <div style="min-width:0"><div class="section-t">Señal de rendimiento</div><p style="margin:4px 0 0">${esc(senal.texto)}</p></div></div>`:''}
      <div class="panel dcard apilada">
        <div class="dtop">
          <div class="field"><label for="dstart">Activo desde</label><input type="date" id="dstart" data-rf="startedAt" value="${esc(fechaISO(r.startedAt))}"></div>
          <div class="field"><label for="dver">Versiones</label><input type="number" min="0" step="1" id="dver" data-rfn="versiones" value="${Number(r.versiones)||0}"></div>
          <div class="field"><span class="lbl">Tu calificación</span><div class="stars" id="drate">${[1,2,3,4,5].map(n=>`<button data-n="${n}" class="${r.rating>=n?'on':''}" aria-label="${n} de 5">★</button>`).join('')}</div></div>
          <button class="btn ghost sm" id="dfav">${ic('star','sm')}${r.fav?'Quitar de favoritas':'Marcar favorita'}</button>
        </div>
      </div>
      <div class="panel dcard apilada">
        <div class="rbar"><b>Clasificación</b><span class="hint" style="margin-left:auto">Así lo encuentras en filtros y en el análisis 80/20</span></div>
        <div class="field"><span class="lbl">Etapa del embudo</span><div class="chips">${STAGES.map(s=>`<button class="chipb ${r.stage===s?'on '+s:''}" data-stage="${s}">${s} · ${s==='TOFU'?'Descubrimiento':s==='MOFU'?'Consideración':'Decisión'}</button>`).join('')}</div>
          ${sug.stage?`<button class="sugb" data-sugstage="${sug.stage}">${ic('spark','sm')}Sugerido: ${sug.stage}</button>`:''}</div>
        <div class="field"><span class="lbl">Formato</span><div class="chips">${FORMATS.map(f=>`<button class="chipb ${r.format===f[0]?'on dark':''}" data-fmt="${f[0]}">${f[1]}</button>`).join('')}</div></div>
        <div class="grid2">
          <div class="field"><label for="dc">Concepto</label><select id="dc" data-rf="conceptId">${opt(S.concepts,r.conceptId)}</select></div>
          <div class="field"><label for="dco">Colección</label><select id="dco" data-rf="collection"><option value="">Sin colección</option>${libCollections().map(c=>`<option ${c===r.collection?'selected':''}>${esc(c)}</option>`).join('')}<option value="__nueva">+ Nueva colección…</option></select></div>
        </div>
        ${sug.concepto?`<button class="sugb" data-sugcon="${esc(sug.concepto)}">${ic('spark','sm')}Sugerido: ${esc(sug.concepto)}</button>`:''}
        ${S.angles.some(a=>a.productId===r.productId)?`<div class="field"><span class="lbl">Ángulo de venta para ${esc(prodName)}</span><div class="chips">${S.angles.filter(a=>a.productId===r.productId).map(a=>`<button class="chipb ${r.angleId===a.id?'on dark':''}" data-ang="${a.id}">${esc(a.name)}</button>`).join('')}</div></div>`:''}
      </div>
      <div class="panel dcard apilada">
        <div class="rbar"><b>Copy del anuncio</b><button class="btn ghost sm" id="dcopy" style="margin-left:auto">${ic('copy','sm')}Copiar copy</button></div>
        ${primera?`<div class="copyhook"><span class="section-t">Primera línea (el hook del copy)</span><p>${esc(primera)}</p><button class="lnk" id="dhook">+ Guardar en hooks</button></div>`:''}
        ${resto?`<p class="copybody">${esc(resto)}</p>`:''}
        <div class="grid4">
          <div class="field"><label for="dct">Título</label><input id="dct" data-rc="titulo" value="${esc(r.adCopy.titulo)}" placeholder="—"></div>
          <div class="field"><label for="dcd">Descripción</label><input id="dcd" data-rc="descripcion" value="${esc(r.adCopy.descripcion)}" placeholder="—"></div>
          <div class="field"><label for="dcb">Botón</label><input id="dcb" data-rc="boton" value="${esc(r.adCopy.boton)}" placeholder="Ej. Comprar"></div>
          <div class="field"><label for="dcz">Lleva a</label><input id="dcz" data-rc="destino" value="${esc(r.adCopy.destino)}" placeholder="Ej. WhatsApp"></div>
        </div>
        ${cuerpo?`<details class="dorig"><summary>Ver texto original capturado</summary><p class="hint" style="white-space:pre-line;margin:8px 0 0">${esc(cuerpo)}</p></details>`:'<p class="hint" style="margin:0">Nova Swipe guarda aquí el texto del anuncio cuando lo captura.</p>'}
      </div>
      <div class="panel dcard apilada">
        <b>Origen</b>
        <div class="grid2"><div class="field"><label for="db">Marca</label><input id="db" data-rf="brand" value="${esc(r.brand)}" placeholder="Ej. FLAIR Fútbol"></div>
        <div class="field"><label for="ds">Fuente</label><select id="ds" data-rf="source">${REF_SOURCES.map(x=>`<option ${x===r.source?'selected':''}>${x}</option>`).join('')}</select></div></div>
        <div class="grid2"><div class="field"><label for="did">ID del anuncio o publicación</label><div class="withbtn"><input id="did" data-rf="adId" value="${esc(r.adId||'')}" placeholder="Se completa solo con Nova Swipe"><button class="btn ghost sm" data-cop="did" aria-label="Copiar ID">${ic('copy','sm')}</button></div></div>
        <div class="field"><label for="dl">Enlace al anuncio</label><div class="withbtn"><input id="dl" data-rf="link" value="${esc(r.link)}" placeholder="https://www.facebook.com/ads/library/?id=…"><button class="btn ghost sm" data-cop="dl" aria-label="Copiar enlace">${ic('copy','sm')}</button></div></div></div>
      </div>
      <div class="panel dcard apilada"><div class="field"><label for="dn">Notas</label><textarea id="dn" data-rf="notes" placeholder="Qué te llamó la atención y qué harías distinto para ${esc(prodName)}">${esc(r.notes)}</textarea></div></div>
      <div class="dfoot"><span class="ok">${ic('check','sm')}Los cambios se guardan solos</span><button class="lnk danger" id="ddel">Eliminar de la biblioteca</button></div>
    </div>`;
  }
  ov.innerHTML=`<div class="modal" style="max-width:1180px" role="dialog" aria-modal="true" aria-labelledby="rt">
    <div class="mh"><b id="rt">${esc(r.brand||'Referencia sin marca')}</b>${r.adId?`<span class="chip" style="font-family:ui-monospace,Menlo,monospace" title="ID del anuncio o publicación">ID ${esc(r.adId)}</span>`:''}<span class="muted" style="font-size:13px">${esc(r.source)}${ex.duration?' · '+tstr(ex.duration):''}</span>${ready?'<span class="chip win">Guion extraído</span>':''}<button class="btn ghost sm" id="rx" style="margin-left:auto" aria-label="Cerrar">${ic('x','sm')}</button></div>
    <div class="rgrid">
      <div class="rleft">
        <div class="rplayer" id="rplayer">${r.mediaId?'':`<div class="rsube">${ic(r.kind==='link'?'link':'up')}<p>${r.kind==='link'?'Solo enlace: carga el video o la imagen para extraer el guion':'Carga el video o la imagen para ver la sincronización con el guion'}</p><button class="btn sm" id="rpick">Elegir archivo</button></div>`}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${r.mediaId?`<button class="btn sm" id="rex" ${JOBS[r.id]?'disabled':''}>${ready?'Volver a extraer':'Extraer guion'}</button>`:`<button class="btn sm" id="rattach">Adjuntar archivo</button>`}
          ${r.link?`<a class="btn ghost sm" href="${esc(r.link)}" target="_blank" rel="noopener">Abrir anuncio</a>`:''}
          ${r.mediaId?`<button class="btn ghost sm" id="rdl">Descargar</button>`:''}
        </div>
        ${r.mediaId&&r.kind==='video'?`<details class="opex"><summary>Opciones de extracción</summary><div style="display:flex;gap:14px;font-size:13px;padding:8px 2px 0"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="optv" checked> Transcribir voz</label><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="opto" checked> Leer texto en pantalla</label></div></details>`:''}
        ${progHTML(r.id)}
        ${ex.frames?.length>1?`<div class="panel fpanel">
          <button class="fhead" id="rfrtog" aria-expanded="${UI.refFrames!==false}"><b>Fotogramas</b><span class="muted">${ex.frames.length} escenas</span><span class="car">${ic(UI.refFrames!==false?'up':'down','sm')}</span></button>
          ${UI.refFrames!==false?`<div class="frames">${ex.frames.map(fr=>`<button data-seek="${fr.t}" aria-label="Ir a ${tstr(fr.t)}"><img src="${fr.thumb}" alt=""><span>${tstr(fr.t)}</span></button>`).join('')}</div>
          <button class="btn ghost sm" id="rsb" style="width:100%;justify-content:center">${ic('grid','sm')}Ver como storyboard</button>`:''}
        </div>`:''}
      </div>
      <div class="rright">
        <div class="seg" role="tablist" style="margin-bottom:12px">${tabBtn('guion','Guion extraído')}${tabBtn('desglose','Desglose con IA')}${tabBtn('datos','Datos')}</div>
        ${right}
      </div>
    </div></div>`;
  document.body.appendChild(ov);
  const q=s=>ov.querySelector(s);
  (async()=>{ if(!r.mediaId)return; const m=await DB.get('media',r.mediaId); const box=q('#rplayer'); if(!box)return;
    if(!m?.blob){box.innerHTML=`<div style="color:#cbd5e1;padding:30px;text-align:center">Archivo no disponible en este navegador</div>`;return;}
    const url=URL.createObjectURL(m.blob); ov._url=url;
    box.innerHTML=m.kind==='video'?`<video class="player" src="${url}" controls playsinline></video>`:`<img src="${url}" alt="">`;
    const v=box.querySelector('video'); if(v&&vt)v.currentTime=vt; })();
  q('.rright').scrollTop=keep;
  const close=()=>{if(ov._url)URL.revokeObjectURL(ov._url);closeRef();};
  q('#rx').onclick=close; ov.addEventListener('mousedown',e=>{if(e.target===ov)close();});
  if(!window._escRef){window._escRef=true;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&UI.refOpen&&!UI.modal&&!document.querySelector('.viewer')){const o=$('#rov');if(o?._url)URL.revokeObjectURL(o._url);closeRef();}});}
  ov.querySelectorAll('[data-rtab]').forEach(b=>b.onclick=()=>{UI.refTab=b.dataset.rtab;renderRefModal();});
  const irA=t=>{const v=q('video.player');if(!v)return;v.currentTime=Number(t)||0;v.play().catch(()=>{});};
  ov.querySelectorAll('[data-seek]').forEach(b=>b.onclick=()=>irA(b.dataset.seek));
  ov.querySelectorAll('[data-play]').forEach(b=>{b.onclick=()=>irA(b.dataset.play);b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();irA(b.dataset.play);}};});
  if(q('#rfrtog'))q('#rfrtog').onclick=()=>{UI.refFrames=UI.refFrames===false;renderRefModal();};
  if(q('#rsb'))q('#rsb').onclick=()=>openStoryboard(r);
  if(q('#rex'))q('#rex').onclick=()=>{const voz=q('#optv')?q('#optv').checked:false,texto=q('#opto')?q('#opto').checked:true;runExtract(r,{voz,texto});renderRefModal();};
  const adjuntar=()=>{const inp=document.createElement('input');inp.type='file';inp.accept='image/*,video/*';inp.onchange=async()=>{const fl=filesFrom(inp.files)[0];if(!fl)return;const id=await addMedia(fl);r.mediaId=id;r.kind=thumbCache[id].kind;save();renderRefModal();toast('Archivo adjuntado');autoExtraer(r);};inp.click();};
  if(q('#rattach'))q('#rattach').onclick=adjuntar;
  if(q('#rpick'))q('#rpick').onclick=adjuntar;
  if(q('#rdl'))q('#rdl').onclick=async()=>{const m=await DB.get('media',r.mediaId);if(!m?.blob)return;const a=document.createElement('a');a.href=URL.createObjectURL(m.blob);a.download=(r.brand||'referencia').replace(/[^\w-]+/g,'_')+'.'+((m.type.split('/')[1]||'bin').split(';')[0]);a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);};
  if(tab==='guion'&&ready){
    ov.querySelectorAll('.tlr').forEach(row=>{const b=ex.blocks[+row.dataset.b];row.querySelectorAll('[data-bf]').forEach(inp=>inp.addEventListener(inp.tagName==='SELECT'?'change':'input',()=>{b[inp.dataset.bf]=inp.value;save();}));});
    q('#rcopy').onclick=async()=>{const t=ex.blocks.map(b=>`[${b.tiempo}]${b.tipo?' '+b.tipo:''}\nVoz: ${b.voz||'—'}\nTexto: ${b.texto||'—'}`).join('\n\n');toast(await copyText(t)?'Guion copiado':'No se pudo copiar');};
    q('#rtopiece').onclick=()=>pieceFromRef(r,false);
    ov.querySelectorAll('[data-rmodo]').forEach(b=>b.onclick=()=>{UI.refModo=b.dataset.rmodo;renderRefModal();});
    ov.querySelectorAll('[data-ileg]').forEach(b=>b.onclick=()=>{const c=ov.querySelector(`[data-ilegbox="${b.dataset.ileg}"]`);if(c)c.hidden=!c.hidden;});
    ov.querySelectorAll('[data-usar]').forEach(b=>b.onclick=()=>{const bl=ex.blocks[+b.dataset.usar];bl.texto=bl.ilegible;bl.ilegible='';save();renderRefModal();});
    if(q('#rclean'))q('#rclean').onclick=()=>{ex.blocks.forEach(b=>{b.ilegible='';});ex.ocr=(ex.ocr||[]).filter(o=>o.text);save();renderRefModal();toast('Se quitaron los textos ilegibles');};
  }
  if(tab==='desglose'){
    q('#rgp').onclick=()=>{UI.refPrompt=true;renderRefModal();};
    if(q('#rpc')){
      q('#rpc').onclick=async()=>{toast(await copyText(q('#rpt').value,q('#rpt'))?'Prompt copiado':'Selecciona y copia el texto');};
      q('#rpx').onclick=()=>{UI.refPrompt=false;renderRefModal();};
      q('#rpapply').onclick=()=>{try{const d=parseAI(q('#rpa').value);applyRefAnalysis(r,d);UI.refPrompt=false;save();renderRefModal();toast('Desglose aplicado');}catch(err){toast('No se pudo leer: '+err.message);}};
    }
    const a=ex.analysis;
    ov.querySelectorAll('[data-lh]').forEach(b=>b.onclick=()=>{S.hooks.push({id:uid('h'),productId:PID(),text:a.lenguaje[+b.dataset.lh],type:'Hablado',conceptId:r.conceptId,angleId:r.angleId,stage:r.stage,origin:'Referencia'});save();toast('Hook guardado');});
    if(q('#radapt'))q('#radapt').onclick=()=>pieceFromRef(r,true);
    if(q('#raidea'))q('#raidea').onclick=()=>{if(!S.ideas)S.ideas=[];newIdea({productId:r.productId,titulo:(a.adaptacion.hook||`Adaptar ${r.brand||'referencia'}`).slice(0,90),descripcion:a.adaptacion.idea||'',hook:a.adaptacion.hook||'',formato:r.format||'',angleId:r.angleId,conceptId:r.conceptId,stage:r.stage,origen:'Referencia',refId:r.id});toast('Idea guardada');};
    if(q('#rahook'))q('#rahook').onclick=()=>{S.hooks.push({id:uid('h'),productId:PID(),text:a.adaptacion.hook,type:a.hook?.tipo||'Hablado',conceptId:r.conceptId,angleId:r.angleId,stage:r.stage,origin:'Referencia'});save();toast('Hook guardado');};
  }
  if(tab==='datos'){
    ov.querySelectorAll('[data-rf]').forEach(inp=>inp.addEventListener(inp.tagName==='SELECT'?'change':'input',()=>{
      if(inp.dataset.rf==='collection'&&inp.value==='__nueva'){const n=prompt('Nombre de la colección');if(n&&n.trim()){const c=n.trim();if(!libCollections().includes(c))S.libCollections.push(c);r.collection=c;}save();renderRefModal();return;}
      r[inp.dataset.rf]=inp.value;save();}));
    ov.querySelectorAll('[data-rfn]').forEach(inp=>inp.addEventListener('input',()=>{r[inp.dataset.rfn]=Math.max(0,Number(inp.value)||0);save();}));
    ov.querySelectorAll('[data-rc]').forEach(inp=>inp.addEventListener('input',()=>{r.adCopy[inp.dataset.rc]=inp.value;save();}));
    ov.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>{r.stage=r.stage===b.dataset.stage?'':b.dataset.stage;save();renderRefModal();});
    ov.querySelectorAll('[data-fmt]').forEach(b=>b.onclick=()=>{r.format=r.format===b.dataset.fmt?'':b.dataset.fmt;save();renderRefModal();});
    ov.querySelectorAll('[data-ang]').forEach(b=>b.onclick=()=>{r.angleId=r.angleId===b.dataset.ang?'':b.dataset.ang;save();renderRefModal();});
    if(q('[data-sugstage]'))q('[data-sugstage]').onclick=e=>{r.stage=e.currentTarget.dataset.sugstage;save();renderRefModal();};
    if(q('[data-sugcon]'))q('[data-sugcon]').onclick=e=>{aplicarConcepto(r,e.currentTarget.dataset.sugcon);save();renderRefModal();};
    ov.querySelectorAll('[data-cop]').forEach(b=>b.onclick=async()=>{const el=q('#'+b.dataset.cop);toast(await copyText(el.value,el)?'Copiado':'No se pudo copiar');});
    if(q('#dcopy'))q('#dcopy').onclick=async()=>{const t=[r.adText,r.adCopy.titulo&&`Título: ${r.adCopy.titulo}`,r.adCopy.descripcion&&`Descripción: ${r.adCopy.descripcion}`,r.adCopy.boton&&`Botón: ${r.adCopy.boton}`,r.adCopy.destino&&`Lleva a: ${r.adCopy.destino}`].filter(Boolean).join(String.fromCharCode(10));toast(await copyText(t)?'Copy copiado':'No se pudo copiar');};
    if(q('#dhook'))q('#dhook').onclick=()=>{const txt=(r.adText||'').split(String.fromCharCode(10)).map(x=>x.trim()).find(Boolean)||'';if(!txt)return;S.hooks.push({id:uid('h'),productId:PID(),text:txt,type:'Primera línea del copy',conceptId:r.conceptId,angleId:r.angleId,stage:r.stage,origin:'Referencia'});save();toast('Hook guardado');};
    q('#dfav').onclick=()=>{r.fav=!r.fav;save();renderRefModal();};
    ov.querySelectorAll('#drate button').forEach(b=>b.onclick=()=>{const n=+b.dataset.n;r.rating=r.rating===n?0:n;save();renderRefModal();});
    q('#ddel').onclick=async()=>{if(!confirm('¿Eliminar esta referencia de la biblioteca?'))return;const used=S.pieces.some(p=>p.mediaIds.includes(r.mediaId));if(r.mediaId&&!used)await DB.del('media',r.mediaId);S.refs=S.refs.filter(x=>x.id!==r.id);if(ov._url)URL.revokeObjectURL(ov._url);closeRef();};
  }
}
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

/* ============ IDEAS DE CONTENIDO ============ */
const IDEA_ESTADOS=[['nueva','Nueva',''],['aprobada','Aprobada','win'],['convertida','En pipeline','TOFU'],['descartada','Descartada','lose']];
const IDEA_ORIGENES=['Propio','Referencia','Comentarios / chats','Tendencia','Competencia','IA'];
const IDEA_PRIO=[['alta','Alta','lose'],['media','Media','warn'],['baja','Baja','']];
const ideaEstado=k=>IDEA_ESTADOS.find(e=>e[0]===k)||IDEA_ESTADOS[0];
const ideaPrio=k=>IDEA_PRIO.find(e=>e[0]===k)||IDEA_PRIO[1];
function newIdea(o={}){
  const i={id:uid('i'),productId:PID(),titulo:'',descripcion:'',hook:'',formato:'',angleId:'',conceptId:'',stage:'',origen:'Propio',prioridad:'media',estado:'nueva',refId:'',pieceId:'',created:Date.now(),...o};
  S.ideas.unshift(i); save(); return i;
}
function ideaToPiece(i){
  let hookId='';
  if(i.hook){const h={id:uid('h'),productId:i.productId,text:i.hook,type:i.formato==='video'?'Hablado':'Texto en pantalla',conceptId:i.conceptId,angleId:i.angleId,stage:i.stage,origin:i.origen==='IA'?'Claude':(i.origen==='Referencia'?'Referencia':'Propio')};S.hooks.push(h);hookId=h.id;}
  const p=newPiece({title:i.titulo.slice(0,70)||'Idea sin título',format:i.formato||'video',angleId:i.angleId,conceptId:i.conceptId,stage:i.stage,hookId,status:'idea',refId:i.refId||undefined});
  if(i.hook||i.descripcion){
    applyTemplate(p);
    if(p.script.blocks[0]&&!i.hook)p.script.blocks[0].visual=i.descripcion.slice(0,160);
  }
  if(i.descripcion)p.notas=i.descripcion;
  i.estado='convertida'; i.pieceId=p.id; save();
  return p;
}
function buildIdeasPrompt(n){
  const pr=prod();
  const angs=mine(S.angles).map(a=>`- ${a.name}${a.deseo?`: ${a.deseo}`:''}${a.stage?` (${a.stage})`:''}`).join('\n')||'- [aún no hay ángulos: propón los tuyos]';
  const cons=S.concepts.map(c=>c.name).join(', ');
  const ganadores=mine(S.pieces).filter(p=>result(p)==='Ganador'||p.historico==='Ganador').map(p=>`- ${p.title} (${byId(S.angles,p.angleId)?.name||'sin ángulo'} · ${byId(S.concepts,p.conceptId)?.name||'sin concepto'})`).join('\n');
  const ya=mine(S.ideas).filter(i=>i.estado!=='descartada').map(i=>`- ${i.titulo}`).slice(0,40).join('\n');
  const refs=mine(S.refs).filter(r=>r.extract?.analysis?.por_que).slice(0,5).map(r=>`- ${r.brand||'Referencia'}: ${r.extract.analysis.por_que}`).join('\n');
  return `Actúa como estratega creativo de anuncios para Meta de una marca de e-commerce contra entrega en Perú.

## Producto
- ${pr.name}: ${pr.brief?pr.brief.replace(/\s*\n+\s*/g,' · '):'[completa la ficha del producto: beneficios reales, precio, packs, garantía]'}

## Ángulos de venta
${angs}

## Conceptos disponibles
${cons}
${ganadores?`\n## Lo que ya ganó (partir de aquí para variantes)\n${ganadores}\n`:''}${refs?`\n## Aprendizajes de referencias\n${refs}\n`:''}${ya?`\n## Ideas que ya tengo (no las repitas)\n${ya}\n`:''}
## Qué necesito
${n} ideas de contenido nuevas y distintas entre sí para ${pr.name}, repartidas entre TOFU, MOFU y BOFU y entre varios ángulos y conceptos. Cada idea debe poder grabarse con celular en un día.

## Reglas
- Español peruano natural, sin tono de comercial de TV.
- Sin promesas médicas ni palabras como "cura", "protege" o "protección": habla de soporte, estabilidad y comodidad.
- Formatos simples y directos. No inventes precios.
- Usa los nombres exactos de los ángulos y conceptos de arriba cuando apliquen.

Responde SOLO con un JSON válido con esta forma:
{
  "ideas": [
    {"titulo": "", "descripcion": "qué se ve y por qué funcionaría", "hook": "", "formato": "video | video_texto | imagen | carrusel", "angulo": "", "concepto": "", "etapa": "TOFU | MOFU | BOFU", "prioridad": "alta | media | baja"}
  ]
}`;
}
function applyIdeas(d){
  const lista=Array.isArray(d)?d:d.ideas;
  if(!Array.isArray(lista)||!lista.length)throw new Error('La respuesta no trae "ideas"');
  const porNombre=(arr,n)=>{if(!n)return '';const k=normTxt(n);const x=arr.find(a=>normTxt(a.name)===k)||arr.find(a=>normTxt(a.name).includes(k)||k.includes(normTxt(a.name)));return x?x.id:'';};
  let n=0;
  for(const x of lista.slice().reverse()){
    if(!x||!String(x.titulo||'').trim())continue;
    newIdea({titulo:String(x.titulo).trim(),descripcion:String(x.descripcion||'').trim(),hook:String(x.hook||'').trim(),
      formato:FORMATS.some(f=>f[0]===x.formato)?x.formato:'',angleId:porNombre(mine(S.angles),x.angulo),conceptId:porNombre(S.concepts,x.concepto),
      stage:STAGES.includes(x.etapa)?x.etapa:'',prioridad:IDEA_PRIO.some(p=>p[0]===x.prioridad)?x.prioridad:'media',origen:'IA'});
    n++;
  }
  return n;
}
function vIdeas(){
  const f=UI.ideas||(UI.ideas={estado:'activas',etapa:'',angulo:'',q:''});
  const all=mine(S.ideas);
  const q=normTxt(f.q);
  const list=all.filter(i=>(f.estado==='activas'?['nueva','aprobada'].includes(i.estado):f.estado==='todas'||i.estado===f.estado)
    &&(!f.etapa||i.stage===f.etapa)&&(!f.angulo||i.angleId===f.angulo)
    &&(!q||normTxt([i.titulo,i.descripcion,i.hook].join(' ')).includes(q)))
    .sort((a,b)=>({alta:0,media:1,baja:2}[a.prioridad]-{alta:0,media:1,baja:2}[b.prioridad])||b.created-a.created);
  const cnt=k=>all.filter(i=>i.estado===k).length;
  setTop('Ideas de contenido',`Banco de ideas de ${prod().name} antes de convertirlas en piezas · ${cnt('nueva')} nuevas, ${cnt('aprobada')} aprobadas`,
    `<label class="visually-hidden" for="iq">Buscar ideas</label><input id="iq" value="${esc(f.q)}" placeholder="Buscar ideas…" style="height:38px;width:220px;border:1px solid var(--line);border-radius:9px;padding:0 12px">
     <button class="btn ghost" id="igen">${ic('concept','sm')}Generar con IA</button><button class="btn" id="inew">${ic('plus','sm')}Idea</button>`);
  $('#body').innerHTML=`<div style="display:flex;flex-direction:column;gap:14px">
    <div class="panel" style="padding:10px 12px;display:flex;gap:10px;align-items:center">
      <span class="muted" style="display:flex">${ic('concept')}</span>
      <label class="visually-hidden" for="iquick">Nueva idea rápida</label>
      <input id="iquick" placeholder="Anota una idea y presiona Enter (ej. POV: el primer partido después de la lesión)" style="flex-grow:1;height:38px;border:1px solid var(--line);border-radius:9px;padding:0 12px">
    </div>
    ${UI.ideaPrompt?`<div class="panel" style="padding:14px;background:#f8fafc;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>Generar ideas con IA</b><span class="hint">Usa la ficha de ${esc(prod().name)}, sus ángulos, lo que ya ganó y las ideas que ya tienes.</span>
        <label class="hint" for="inum" style="margin-left:auto">Cantidad</label><select id="inum" class="fsel">${[5,10,15,20].map(n=>`<option ${n===(UI.ideaN||10)?'selected':''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label for="ipt">Prompt listo para Claude o ChatGPT</label><textarea id="ipt" style="min-height:200px;font-family:ui-monospace,Menlo,monospace;font-size:12px">${esc(buildIdeasPrompt(UI.ideaN||10))}</textarea></div>
      <div><button class="btn sm" id="ipc">Copiar prompt</button></div>
      <div class="field"><label for="ipa">Pega aquí la respuesta de la IA</label><textarea id="ipa" placeholder='{"ideas": [...]}'></textarea></div>
      <div style="display:flex;gap:8px"><button class="btn sm" id="ipapply">Agregar ideas</button><button class="btn ghost sm" id="ipx">Cerrar</button></div>
    </div>`:''}
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <div class="seg" id="ifs">${[['activas','Activas'],['nueva','Nuevas'],['aprobada','Aprobadas'],['convertida','En pipeline'],['descartada','Descartadas'],['todas','Todas']].map(([k,l])=>`<button data-k="${k}" class="${f.estado===k?'on':''}">${l}</button>`).join('')}</div>
      <label class="visually-hidden" for="ife">Etapa</label><select id="ife" class="fsel">${stageOpt(f.etapa,'Todas las etapas')}</select>
      <label class="visually-hidden" for="ifa">Ángulo</label><select id="ifa" class="fsel">${opt(mine(S.angles),f.angulo,'Todos los ángulos')}</select>
    </div>
    ${list.length?`<div class="ideas">${list.map(ideaCard).join('')}</div>`:`<div class="empty">${all.length?'Ninguna idea coincide con los filtros.':`Aún no hay ideas para ${esc(prod().name)}. Anota la primera arriba o genera varias con IA.`}</div>`}
  </div>`;
  const iq=$('#iq'); iq.oninput=()=>{f.q=iq.value;clearTimeout(iq._t);iq._t=setTimeout(()=>{const pos=iq.selectionStart;render();const n=$('#iq');n.focus();n.setSelectionRange(pos,pos);},250);};
  $('#inew').onclick=()=>ideaForm();
  $('#igen').onclick=()=>{UI.ideaPrompt=!UI.ideaPrompt;render();};
  $('#iquick').onkeydown=e=>{if(e.key==='Enter'&&e.target.value.trim()){newIdea({titulo:e.target.value.trim()});render();$('#iquick').focus();toast('Idea guardada');}};
  document.querySelectorAll('#ifs button').forEach(b=>b.onclick=()=>{f.estado=b.dataset.k;render();});
  $('#ife').onchange=e=>{f.etapa=e.target.value;render();};$('#ifa').onchange=e=>{f.angulo=e.target.value;render();};
  if(UI.ideaPrompt){
    $('#inum').onchange=e=>{UI.ideaN=+e.target.value;$('#ipt').value=buildIdeasPrompt(UI.ideaN);};
    $('#ipc').onclick=async()=>{toast(await copyText($('#ipt').value,$('#ipt'))?'Prompt copiado':'Selecciona y copia el texto');};
    $('#ipx').onclick=()=>{UI.ideaPrompt=false;render();};
    $('#ipapply').onclick=()=>{try{const n=applyIdeas(parseAIList($('#ipa').value));UI.ideaPrompt=false;f.estado='activas';render();toast(`${n} ideas agregadas`);}catch(err){toast('No se pudo leer: '+err.message);}};
  }
  document.querySelectorAll('[data-idea]').forEach(card=>{
    const i=byId(S.ideas,card.dataset.idea);
    card.querySelectorAll('[data-ia]').forEach(b=>b.onclick=()=>{
      const a=b.dataset.ia;
      if(a==='editar')return ideaForm(i);
      if(a==='aprobar'){i.estado='aprobada';save();render();toast('Idea aprobada');}
      if(a==='reabrir'){i.estado='nueva';save();render();}
      if(a==='descartar'){i.estado='descartada';save();render();toast('Idea descartada');}
      if(a==='pieza'){const p=ideaToPiece(i);render();openModal(p.id,'guion');toast(`${p.code} creada en Idea`);}
      if(a==='ver'){const p=byId(S.pieces,i.pieceId);if(p)openModal(p.id);else toast('La pieza ya no existe');}
      if(a==='ref'){UI.view='referencias';render();openRef(i.refId);}
    });
  });
}
function parseAIList(text){
  const t=String(text||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  if(t.startsWith('['))return JSON.parse(t);
  return parseAI(t);
}
function ideaCard(i){
  const [,elab,ecls]=ideaEstado(i.estado); const [,plab,pcls]=ideaPrio(i.prioridad);
  const ang=byId(S.angles,i.angleId), con=byId(S.concepts,i.conceptId), fm=FORMATS.find(x=>x[0]===i.formato);
  const piece=i.pieceId?byId(S.pieces,i.pieceId):null;
  return `<article class="panel icard" data-idea="${i.id}">
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="chip ${ecls}">${elab}</span><span class="chip ${pcls}" title="Prioridad">${plab}</span>${i.stage?`<span class="chip ${i.stage}">${i.stage}</span>`:''}<span class="muted" style="margin-left:auto;font-size:12px">${esc(i.origen)}</span></div>
    <h3>${esc(i.titulo)}</h3>
    ${i.hook?`<p class="hookline" style="-webkit-line-clamp:3">“${esc(i.hook)}”</p>`:''}
    ${i.descripcion?`<p class="muted" style="margin:0;line-height:1.45;font-size:13px">${esc(i.descripcion)}</p>`:''}
    <div style="display:flex;gap:5px;flex-wrap:wrap">${fm?`<span class="chip">${ic(fm[2],'sm')}${esc(fm[1])}</span>`:''}${ang?`<span class="chip ang">${esc(ang.name)}</span>`:''}${con?`<span class="chip">${esc(con.name)}</span>`:''}</div>
    <div class="iact">
      ${i.estado==='convertida'?`<button class="btn ghost sm" data-ia="ver">${piece?`Ver ${esc(piece.code)}`:'Ver pieza'}</button>`:
        `${i.estado==='nueva'?'<button class="btn ghost sm" data-ia="aprobar">Aprobar</button>':''}<button class="btn sm" data-ia="pieza">Convertir en pieza</button>`}
      ${i.refId&&byId(S.refs,i.refId)?'<button class="btn ghost sm" data-ia="ref">Ver referencia</button>':''}
      <span style="margin-left:auto;display:flex;gap:4px">
        ${i.estado==='descartada'?'<button class="btn ghost sm" data-ia="reabrir">Recuperar</button>':i.estado!=='convertida'?'<button class="btn ghost sm" data-ia="descartar">Descartar</button>':''}
        <button class="btn ghost sm" data-ia="editar">Editar</button>
      </span>
    </div>
  </article>`;
}
function ideaForm(i=null){
  const d=i||{titulo:'',descripcion:'',hook:'',formato:'',angleId:'',conceptId:'',stage:'',origen:'Propio',prioridad:'media',estado:'nueva'};
  formModal(i?'Editar idea':'Nueva idea',`
    <div class="field"><label for="it">Idea</label><input id="it" value="${esc(d.titulo)}" placeholder="Ej. POV: el primer partido después de la lesión"></div>
    <div class="field"><label for="id2">Qué se ve y por qué funcionaría</label><textarea id="id2">${esc(d.descripcion)}</textarea></div>
    <div class="field"><label for="ih">Hook (opcional)</label><input id="ih" value="${esc(d.hook)}" placeholder="La primera frase o texto en pantalla"></div>
    <div class="grid3">
      <div class="field"><label for="if">Formato</label><select id="if"><option value="">—</option>${FORMATS.map(x=>`<option value="${x[0]}" ${x[0]===d.formato?'selected':''}>${x[1]}</option>`).join('')}</select></div>
      <div class="field"><label for="ia2">Ángulo</label><select id="ia2">${opt(mine(S.angles),d.angleId)}</select></div>
      <div class="field"><label for="ic2">Concepto</label><select id="ic2">${opt(S.concepts,d.conceptId)}</select></div>
    </div>
    <div class="grid3">
      <div class="field"><label for="ie">Etapa</label><select id="ie">${stageOpt(d.stage)}</select></div>
      <div class="field"><label for="io">Origen</label><select id="io">${IDEA_ORIGENES.map(o=>`<option ${o===d.origen?'selected':''}>${o}</option>`).join('')}</select></div>
      <div class="field"><label for="ip">Prioridad</label><select id="ip">${IDEA_PRIO.map(([k,l])=>`<option value="${k}" ${k===d.prioridad?'selected':''}>${l}</option>`).join('')}</select></div>
    </div>
    ${i?`<div class="field"><label for="is">Estado</label><select id="is">${IDEA_ESTADOS.map(([k,l])=>`<option value="${k}" ${k===d.estado?'selected':''}>${l}</option>`).join('')}</select></div>`:''}`,
    ()=>{const v={titulo:$('#it').value.trim(),descripcion:$('#id2').value.trim(),hook:$('#ih').value.trim(),formato:$('#if').value,angleId:$('#ia2').value,conceptId:$('#ic2').value,stage:$('#ie').value,origen:$('#io').value,prioridad:$('#ip').value};
      if(!v.titulo){toast('Escribe la idea');return false;}
      if(i){Object.assign(i,v,{estado:$('#is').value});save();}else newIdea(v);
      render();},
    i?()=>{if(!confirm('¿Eliminar esta idea?'))return false;S.ideas=S.ideas.filter(x=>x.id!==i.id);save();render();}:null);
}

/* ============ ÁNGULOS ============ */
function vAngles(){
  setTop('Ángulos de venta',`El deseo o dolor que empuja la compra de ${prod().name}. Un ángulo puede usar muchos conceptos.`,`<button class="btn" id="anew">${ic('plus','sm')}Ángulo</button>`);
  const list=mine(S.angles);
  $('#body').innerHTML=list.length?`<div class="angles">${list.map(a=>{
    const ps=mine(S.pieces).filter(p=>p.angleId===a.id);const hs=mine(S.hooks).filter(h=>h.angleId===a.id);
    const wins=ps.filter(p=>result(p)==='Ganador').length;
    const spend=ps.reduce((s,p)=>s+(p.spend||0),0),conf=ps.reduce((s,p)=>s+(p.conf||0),0);
    const thumbs=ps.filter(p=>p.mediaIds.length).slice(0,4);
    return `<article class="panel acard">
      <div style="display:flex;align-items:center;gap:8px"><h3>${esc(a.name)}</h3>${a.stage?`<span class="chip ${a.stage}" style="margin-left:auto">${a.stage}</span>`:''}</div>
      <p><b>Deseo:</b> ${esc(a.deseo||'—')}</p>
      <p class="muted">${esc(a.desc||'')}</p>
      ${thumbs.length?`<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">${thumbs.map(p=>`<div style="aspect-ratio:1">${thumbHTML(p.mediaIds[0])}</div>`).join('')}</div>`:''}
      <div class="stats"><span><b>${ps.length}</b>piezas</span><span><b>${hs.length}</b>hooks</span><span><b>${wins}</b>ganadores</span><span><b>${conf?money(spend/conf):'—'}</b>CPA real</span></div>
      <div style="display:flex;gap:6px"><button class="btn ghost sm" data-edit="${a.id}">Editar</button><button class="btn ghost sm" data-go="${a.id}">Ver piezas</button></div>
    </article>`;}).join('')}</div>`:`<div class="empty">Define el primer ángulo de ${esc(prod().name)}: ¿qué dolor o deseo resuelve?</div>`;
  document.querySelectorAll('.acard .thumb').forEach(t=>t.style.height='100%');
  $('#anew').onclick=()=>angleForm();
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>angleForm(byId(S.angles,b.dataset.edit)));
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{UI.angleFilter=b.dataset.go;UI.view='pipeline';render();});
}
function angleForm(a=null){
  const d=a||{name:'',deseo:'',desc:'',stage:''};
  formModal(a?'Editar ángulo':'Nuevo ángulo',`
    <div class="field"><label for="fn">Nombre</label><input id="fn" value="${esc(d.name)}" placeholder="Ej. Entra en el chimpún"></div>
    <div class="field"><label for="fd">Deseo o dolor del cliente</label><input id="fd" value="${esc(d.deseo)}" placeholder="Ej. Soporte sin incomodidad"></div>
    <div class="field"><label for="fx">A quién le habla y cómo</label><textarea id="fx">${esc(d.desc)}</textarea></div>
    <div class="field"><label for="fs">Etapa donde mejor funciona</label><select id="fs">${stageOpt(d.stage,'Cualquiera')}</select></div>`,
    ()=>{const v={name:$('#fn').value.trim(),deseo:$('#fd').value.trim(),desc:$('#fx').value.trim(),stage:$('#fs').value};
      if(!v.name){toast('Ponle nombre al ángulo');return false;}
      if(a)Object.assign(a,v);else S.angles.push({id:uid('a'),productId:PID(),...v});save();render();},
    a?()=>{if(!confirm('¿Eliminar este ángulo?'))return false;S.angles=S.angles.filter(x=>x.id!==a.id);S.pieces.forEach(p=>{if(p.angleId===a.id)p.angleId='';});save();render();}:null);
}

/* ============ CONCEPTOS ============ */
function vConcepts(){
  setTop('Conceptos','El formato creativo: cómo cuentas el ángulo. Compartidos entre productos.',`<button class="btn" id="cnew">${ic('plus','sm')}Concepto</button>`);
  const rows=S.concepts.map(c=>{const ps=mine(S.pieces).filter(p=>p.conceptId===c.id);const wins=ps.filter(p=>result(p)==='Ganador').length;
    const spend=ps.reduce((s,p)=>s+(p.spend||0),0),conf=ps.reduce((s,p)=>s+(p.conf||0),0);
    const st=wins?'<span class="chip win">Validado</span>':ps.some(p=>['lanzado','testing'].includes(p.status))?'<span class="chip warn">En prueba</span>':'<span class="chip">Sin probar</span>';
    return `<tr><td><b>${esc(c.name)}</b></td><td class="num">${mine(S.refs).filter(r=>r.conceptId===c.id).length}</td><td class="num">${mine(S.hooks).filter(h=>h.conceptId===c.id).length}</td><td class="num">${ps.length}</td><td class="num">${wins}</td><td class="num">${conf?money(spend/conf):'—'}</td><td>${st}</td><td style="text-align:right"><button class="btn ghost sm" data-ren="${c.id}">Renombrar</button></td></tr>`;}).join('');
  $('#body').innerHTML=`<div class="panel" style="padding:12px 16px;margin-bottom:14px;display:flex;gap:10px;align-items:center"><span class="chip">Regla A/B</span><span class="muted">Las variantes de hook se prueban solo sobre conceptos validados en ${esc(prod().name)}.</span></div>
    <div class="panel" style="overflow:auto"><table><thead><tr><th>Concepto</th><th class="num">Referencias</th><th class="num">Hooks</th><th class="num">Piezas</th><th class="num">Ganadores</th><th class="num">CPA real</th><th>Estado</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  $('#cnew').onclick=()=>{const n=prompt('Nombre del concepto');if(n&&n.trim()){S.concepts.push({id:uid('c'),name:n.trim()});save();render();}};
  document.querySelectorAll('[data-ren]').forEach(b=>b.onclick=()=>{const c=byId(S.concepts,b.dataset.ren);const n=prompt('Nuevo nombre',c.name);if(n&&n.trim()){c.name=n.trim();save();render();}});
}

/* ============ HOOKS ============ */
function vHooks(){
  setTop('Hooks',`Primeros segundos, titular o primera línea del copy de ${prod().name}`,`<button class="btn" id="hnew">${ic('plus','sm')}Hook</button>`);
  const f=UI.hookStage||'todas';
  const list=mine(S.hooks).filter(h=>f==='todas'||h.stage===f);
  $('#body').innerHTML=`<div class="seg" id="hf" style="margin-bottom:12px">${['todas',...STAGES].map(s=>`<button data-k="${s}" class="${f===s?'on':''}">${s==='todas'?'Todas las etapas':s}</button>`).join('')}</div>
   <div class="panel" style="overflow:auto">${list.length?`<table><thead><tr><th>Hook</th><th>Tipo</th><th>Ángulo</th><th>Concepto</th><th>Etapa</th><th>Origen</th><th>Usado en</th><th></th></tr></thead><tbody>
   ${list.map(h=>{const used=mine(S.pieces).filter(p=>p.hookId===h.id).map(p=>p.code).join(', ');
     return `<tr><td style="min-width:320px;white-space:normal"><b>${esc(h.text)}</b></td><td><span class="chip">${esc(h.type)}</span></td><td>${h.angleId?`<span class="chip ang">${esc(byId(S.angles,h.angleId)?.name||'')}</span>`:'—'}</td><td>${esc(byId(S.concepts,h.conceptId)?.name||'—')}</td><td>${h.stage?`<span class="chip ${h.stage}">${h.stage}</span>`:'—'}</td><td class="muted">${esc(h.origin||'')}</td><td class="muted">${esc(used||'—')}</td><td style="text-align:right"><button class="btn ghost sm" data-h="${h.id}">Editar</button></td></tr>`;}).join('')}
   </tbody></table>`:`<div class="empty" style="border:0">Sin hooks en esta etapa.</div>`}</div>`;
  document.querySelectorAll('#hf button').forEach(b=>b.onclick=()=>{UI.hookStage=b.dataset.k;render();});
  $('#hnew').onclick=()=>hookForm();
  document.querySelectorAll('[data-h]').forEach(b=>b.onclick=()=>hookForm(byId(S.hooks,b.dataset.h)));
}
function hookForm(h=null){
  const d=h||{text:'',type:'Hablado',angleId:'',conceptId:'',stage:'',origin:'Propio'};
  formModal(h?'Editar hook':'Nuevo hook',`
    <div class="field"><label for="ht">Hook</label><textarea id="ht" placeholder="Ej. ¿Todavía te vendas antes de cada partido?">${esc(d.text)}</textarea></div>
    <div class="grid2"><div class="field"><label for="hy">Tipo</label><select id="hy">${HOOK_TYPES.map(t=>`<option ${t===d.type?'selected':''}>${t}</option>`).join('')}</select></div>
    <div class="field"><label for="ho">Origen</label><select id="ho">${['Propio','Referencia','Claude','Comentarios / chats'].map(t=>`<option ${t===d.origin?'selected':''}>${t}</option>`).join('')}</select></div></div>
    <div class="grid3"><div class="field"><label for="ha">Ángulo</label><select id="ha">${opt(mine(S.angles),d.angleId)}</select></div>
    <div class="field"><label for="hc">Concepto</label><select id="hc">${opt(S.concepts,d.conceptId)}</select></div>
    <div class="field"><label for="hs">Etapa</label><select id="hs">${stageOpt(d.stage)}</select></div></div>`,
    ()=>{const v={text:$('#ht').value.trim(),type:$('#hy').value,origin:$('#ho').value,angleId:$('#ha').value,conceptId:$('#hc').value,stage:$('#hs').value};
      if(!v.text){toast('Escribe el hook');return false;} if(h)Object.assign(h,v);else S.hooks.push({id:uid('h'),productId:PID(),...v});save();render();},
    h?()=>{if(!confirm('¿Eliminar este hook?'))return false;S.hooks=S.hooks.filter(x=>x.id!==h.id);save();render();}:null);
}

/* ============ PIPELINE ============ */
function newPiece(o={}){
  S.seq[PID()]=(S.seq[PID()]||0)+1; const n=S.seq[PID()];
  const p={id:uid('pc'),productId:PID(),code:'SCR_'+String(n).padStart(3,'0'),title:'Nueva pieza',format:'video',conceptId:'',angleId:'',hookId:'',status:'guion',stage:'',spend:null,conf:null,delivered:null,mediaIds:[],copy:{principal:'',titulo:'',cta:'Comprar'},board:null,created:Date.now(),...o};
  if(p.stage&&!p.board)p.board={x:Math.random()*.6,y:Math.random()};
  S.pieces.push(p);save();return p;
}
function pieceCard(p){
  const ang=byId(S.angles,p.angleId);const r=result(p);const c=cpa(p);
  return `<div class="pcard" draggable="true" data-id="${p.id}" tabindex="0" role="button" aria-label="Abrir ${esc(p.code)} ${esc(p.title)}">
    ${p.mediaIds.length?`<div style="position:relative">${thumbHTML(p.mediaIds[0])}${p.mediaIds.length>1?`<span class="count" style="position:absolute;right:6px;top:6px;background:rgba(15,23,42,.8);color:#fff;border-radius:6px;font-size:11px;font-weight:700;padding:2px 6px">+${p.mediaIds.length-1}</span>`:''}</div>`:''}
    <div class="pb">
      <div class="row"><span class="id">${esc(p.code)}</span><span style="margin-left:auto;display:flex;gap:4px">${p.stage?`<span class="chip ${p.stage}">${p.stage}</span>`:''}${fmtIcon(p.format)}</span></div>
      <div class="t">${esc(p.title)}</div>
      ${ang?`<div><span class="chip ang">${esc(ang.name)}</span></div>`:''}
      ${(p.script?.blocks||[]).length?`<div class="muted" style="font-size:12px">Guion · ${p.script.blocks.length} ${p.format==='carrusel'?'tarjetas':'bloques'}</div>`:(['idea','guion'].includes(p.status)?`<div class="muted" style="font-size:12px">Sin guion</div>`:'')}
      ${p.spend||p.conf?`<div class="mets"><div><span class="muted">Gasto</span><b>${money(p.spend)}</b></div><div><span class="muted">Conf.</span><b>${p.conf??'—'}</b></div><div><span class="muted">CPA real</span><b style="color:${c==null?'inherit':c<=tope()?'var(--bofu)':'var(--red)'}">${money(c)}</b></div></div>`:''}
      ${r||p.historico?`<div style="display:flex;gap:4px;flex-wrap:wrap">${r?`<span class="chip ${r==='Ganador'?'win':r==='Perdedor'?'lose':''}">${r==='TBD'?`TBD · ${p.conf||0}/${S.settings.muestra} conf.`:r}</span>`:''}${p.historico?`<span class="chip" title="Marcado a mano antes de la migración. Solo informativo: el resultado lo decide el CPA real.">Histórico: ${p.historico}</span>`:''}</div>`:''}
    </div></div>`;
}
function vPipeline(){
  setTop('Pipeline',`Piezas de ${prod().name} del guion al resultado · arrastra las tarjetas entre columnas`,`<button class="btn" id="pnew">${ic('plus','sm')}Nueva pieza</button>`);
  const sf=UI.stageFilter, af=UI.angleFilter||'';
  const list=mine(S.pieces).filter(p=>(sf==='todas'||p.stage===sf||(sf==='sin'&&!p.stage))&&(!af||p.angleId===af));
  $('#body').innerHTML=`
   <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
     <div class="seg" id="sf">${[['todas','Todas'],['TOFU','TOFU'],['MOFU','MOFU'],['BOFU','BOFU'],['sin','Sin etapa']].map(([k,l])=>`<button data-k="${k}" class="${sf===k?'on':''}">${l}</button>`).join('')}</div>
     <label class="visually-hidden" for="af">Filtrar por ángulo</label>
     <select id="af" style="height:30px;border:1px solid var(--line);border-radius:8px;padding:0 8px;background:#fff">${opt(mine(S.angles),af,'Todos los ángulos')}</select>
   </div>
   <div class="kanban">${STATUS.map(([k,l,col,sub])=>{const items=list.filter(p=>columnOf(p)===k);
     return `<section class="col" data-col="${k}"><div class="colh"><span class="dot" style="background:${col}"></span><b>${l}</b><span>${items.length}</span></div><div class="colsub">${sub}</div>
       ${items.map(pieceCard).join('')||(k==='resultado'?`<div class="empty" style="padding:16px;font-size:12px">Aparecen solos al llegar a ${S.settings.muestra} confirmados. Tope ${money(tope())}.</div>`:'')}</section>`;}).join('')}</div>`;
  document.querySelectorAll('#sf button').forEach(b=>b.onclick=()=>{UI.stageFilter=b.dataset.k;render();});
  $('#af').onchange=e=>{UI.angleFilter=e.target.value;render();};
  $('#pnew').onclick=()=>{const p=newPiece({angleId:af,stage:['TOFU','MOFU','BOFU'].includes(sf)?sf:''});openModal(p.id);};
  document.querySelectorAll('.pcard').forEach(c=>{
    c.onclick=()=>openModal(c.dataset.id); c.onkeydown=e=>{if(e.key==='Enter')openModal(c.dataset.id);};
    c.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/piece',c.dataset.id);c.classList.add('dragging');});
    c.addEventListener('dragend',()=>c.classList.remove('dragging'));
  });
  document.querySelectorAll('.col').forEach(col=>{
    col.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('text/piece')){e.preventDefault();col.classList.add('over');}});
    col.addEventListener('dragleave',()=>col.classList.remove('over'));
    col.addEventListener('drop',e=>{const id=e.dataTransfer.getData('text/piece');if(!id)return;e.preventDefault();e.stopPropagation();col.classList.remove('over');
      const p=byId(S.pieces,id);const k=col.dataset.col;
      if(k==='resultado'){ if(!['Ganador','Perdedor'].includes(result({...p,status:'testing'}))){toast(`Aún no hay muestra: se decide al llegar a ${S.settings.muestra} confirmados`);return;} p.status='testing'; }
      else p.status=k; save();render();});
  });
}

/* ============ MODAL DE PIEZA ============ */
function openModal(id,tab='guion'){UI.modal=id;UI.modalTab=tab;UI.promptOpen=false;renderModal();}
function closeModal(){UI.modal=null;$('#ov')?.remove();render();}
function suggestCode(p){ const ang=byId(S.angles,p.angleId); const angS=(ang?.name||'ANGULO').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,10);
  const f=(FORMATS.find(x=>x[0]===p.format)||FORMATS[0])[3]; const n=(p.code.match(/\d+/)||['1'])[0].padStart(3,'0');
  return `AD_${prod().code}_${angS}_${f}_${n}_A`; }
const BLOCK_TYPES=['Hook','Problema','Agitación','Demostración','Prueba / testimonio','Beneficio','Comparación','Objeción','Oferta','CTA'];
const TEMPLATES={
  video:[['Hook','0–3 s'],['Problema','3–8 s'],['Demostración','8–18 s'],['Prueba / testimonio','18–24 s'],['Oferta','24–28 s'],['CTA','28–30 s']],
  video_texto:[['Hook','0–2 s'],['Comparación','2–5 s'],['Demostración','5–8 s'],['CTA','8–10 s']],
  imagen:[['Hook','Imagen']],
  carrusel:[['Hook','Tarjeta 1'],['Problema','Tarjeta 2'],['Beneficio','Tarjeta 3'],['Oferta','Tarjeta 4']]
};
const STAGE_GOAL={TOFU:'Detener el scroll de alguien que no conoce la marca y mostrarle el problema. CTA a la landing.',MOFU:'Demostrar que funciona y compararlo contra lo que ya usan. CTA a WhatsApp.',BOFU:'Resolver objeciones (talla, si incomoda, pago) y cerrar con la oferta. CTA a WhatsApp.'};
const hasVoice=f=>f==='video';
function ensureScript(p){ if(!p.script)p.script={blocks:[]}; if(!p.copy)p.copy={principal:'',titulo:'',cta:'Comprar'}; return p.script; }
function applyTemplate(p){
  const sc=ensureScript(p); const hook=byId(S.hooks,p.hookId);
  sc.blocks=(TEMPLATES[p.format]||TEMPLATES.video).map(([tipo,tiempo],i)=>({id:uid('b'),tipo,tiempo,voz:i===0&&hook&&hasVoice(p.format)?hook.text:'',texto:i===0&&hook&&!hasVoice(p.format)?hook.text:'',visual:''}));
}
function buildPrompt(p){
  const pr=prod(),ang=byId(S.angles,p.angleId),con=byId(S.concepts,p.conceptId),hook=byId(S.hooks,p.hookId),ref=p.refId?byId(S.refs,p.refId):null;
  const fmt=(FORMATS.find(f=>f[0]===p.format)||FORMATS[0])[1];
  const whatsapp=p.stage==='MOFU'||p.stage==='BOFU';
  const fmtRules={
    video:'Video vertical con voz (UGC con celular). 20–30 segundos. Cada bloque lleva voz, texto en pantalla de 2 a 3 palabras y la toma a grabar.',
    video_texto:'Video vertical SIN voz: la historia se cuenta solo con texto en pantalla y tomas. 8–12 segundos. Máximo 2 a 3 palabras por frame. Deja "voz" vacío.',
    imagen:'Imagen estática. Un solo bloque: "texto_pantalla" es el titular dentro de la imagen (máximo 6 palabras) y "visual" describe la composición. El peso de la venta va en el copy. Deja "voz" y "tiempo" vacíos.',
    carrusel:'Carrusel de 3 a 5 tarjetas. Cada bloque es una tarjeta: titular corto en "texto_pantalla" y "visual" con la imagen. Deja "voz" vacío.'
  }[p.format]||'';
  const actuales=(p.script?.blocks||[]).filter(b=>b.voz||b.texto||b.visual);
  return `Actúa como guionista de anuncios para Meta de una marca de e-commerce contra entrega en Perú.

## Pieza
- Producto: ${pr.name}
- Formato: ${fmt}
- Etapa del embudo: ${p.stage||'[elige TOFU, MOFU o BOFU]'}${p.stage?` — objetivo: ${STAGE_GOAL[p.stage]}`:''}
- Ángulo de venta: ${ang?`${ang.name}. Deseo o dolor: ${ang.deseo||'—'}. ${ang.desc||''}`:'[define el ángulo]'}
- Concepto creativo: ${con?con.name:'[elige un concepto]'}
- Hook base: ${hook?`"${hook.text}" (${hook.type})`:'[propón uno]'}
${ref?`- Referencia de inspiración: ${ref.brand||'sin marca'} (${ref.source}). Lo que rescato: ${ref.notes||'—'}${ref.extract?.analysis?.por_que?' Por qué funciona: '+ref.extract.analysis.por_que:''}\n`:''}- Datos del producto y oferta: ${pr.brief?pr.brief.replace(/\n+/g,' · '):'[completa aquí: beneficios reales, precio, packs, garantía]'}

## Reglas
- Español peruano natural, como habla la gente (pichanga, chimpún, pata cuando encaje). Nada de tono de comercial de TV.
- Sin promesas médicas ni palabras como "cura", "protege" o "protección". Habla de soporte, estabilidad y comodidad.
- ${fmtRules}
- Directo y corto: los formatos simples rinden más que los elaborados.
- Oferta: pago contra entrega en Lima; provincia con adelanto de S/30. No inventes precios: usa solo los que te doy.
- CTA: ${whatsapp?'"Enviar mensaje" a WhatsApp, e incluye el mensaje prellenado que enviará el cliente.':'"Comprar" hacia la landing.'}
- El texto en pantalla, la primera línea del copy y el título NO deben repetir la misma frase.
${actuales.length?`\n## Borrador actual (mejóralo, no lo ignores)\n${actuales.map((b,i)=>`${i+1}. [${b.tipo}${b.tiempo?' · '+b.tiempo:''}] voz: ${b.voz||'—'} | texto: ${b.texto||'—'} | visual: ${b.visual||'—'}`).join('\n')}\n`:''}
${ref?.extract?.blocks?.length?`## Guion de la referencia (toma la estructura, NO copies las frases)\n${ref.extract.blocks.map((b,i)=>`${i+1}. [${b.tipo||'—'} · ${b.tiempo||''}] voz: ${b.voz||'—'} | texto: ${b.texto||'—'}`).join('\n')}\n\n`:''}## Formato de respuesta
Responde SOLO con un JSON válido, sin texto antes ni después, con esta forma:
{
  "bloques": [
    {"tipo": "Hook | Problema | Agitación | Demostración | Prueba / testimonio | Beneficio | Comparación | Objeción | Oferta | CTA", "tiempo": "0–3 s", "voz": "", "texto_pantalla": "", "visual": ""}
  ],
  "copy": {"texto_principal": "", "titulo": "", "cta": "${whatsapp?'Enviar mensaje':'Comprar'}"${whatsapp?', "mensaje_prellenado": ""':''}},
  "hooks_alternativos": ["", ""]
}`;
}
function parseAI(text){
  let t=String(text||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  const a=t.indexOf('{'),b=t.lastIndexOf('}'); if(a<0||b<0)throw new Error('No encontré un JSON en la respuesta');
  return JSON.parse(t.slice(a,b+1));
}
async function copyText(t,fallbackEl){
  try{await navigator.clipboard.writeText(t);return true;}catch(e){ if(fallbackEl){fallbackEl.focus();fallbackEl.select();try{return document.execCommand('copy');}catch(_){}} return false; }
}
const voiceSecs=blocks=>{const w=blocks.reduce((s,b)=>s+String(b.voz||'').trim().split(/\s+/).filter(Boolean).length,0);return Math.round(w/2.5);};

function renderModal(){
  const p=byId(S.pieces,UI.modal); if(!p){UI.modal=null;return;}
  ensureScript(p); const tab=UI.modalTab||'guion';
  const keepScroll=$('#ov')?.scrollTop||0;
  $('#ov')?.remove();
  const ov=document.createElement('div');ov.className='ov';ov.id='ov';
  const c=cpa(p),r=result(p),voice=hasVoice(p.format),blocks=p.script.blocks;
  const tabBtn=(k,l,n)=>`<button role="tab" aria-selected="${tab===k}" data-tab="${k}" class="${tab===k?'on':''}">${l}${n!=null?` <span style="opacity:.7">${n}</span>`:''}</button>`;
  let content='';
  if(tab==='guion'){
    content=`<div style="padding:18px;display:flex;flex-direction:column;gap:14px">
      <div class="grid3">
        <div class="field"><label for="mfo">Formato</label><select id="mfo">${FORMATS.map(f=>`<option value="${f[0]}" ${f[0]===p.format?'selected':''}>${f[1]}</option>`).join('')}</select></div>
        <div class="field"><label for="man">Ángulo de venta</label><select id="man">${opt(mine(S.angles),p.angleId,'Elegir ángulo')}</select></div>
        <div class="field"><label for="mse">Etapa</label><select id="mse">${stageOpt(p.stage)}</select></div>
      </div>
      <div class="grid2">
        <div class="field"><label for="mco">Concepto</label><select id="mco">${opt(S.concepts,p.conceptId,'Elegir')}</select></div>
        <div class="field"><label for="mho">Hook</label><select id="mho"><option value="">—</option>${mine(S.hooks).map(h=>`<option value="${h.id}" ${h.id===p.hookId?'selected':''}>${esc(h.text.slice(0,70))}</option>`).join('')}</select></div>
      </div>

      <div class="panel" style="padding:14px;background:#f8fafc;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <b>Generar con IA</b><span class="hint">Arma el prompt con el producto, ángulo, concepto, hook, etapa y tus reglas.</span>
          <button class="btn sm" id="gp" style="margin-left:auto">Generar prompt</button>
        </div>
        ${UI.promptOpen?`
        <div class="field"><label for="pbrief">Ficha de ${esc(prod().name)} (se guarda y se reutiliza en todos sus prompts)</label><textarea id="pbrief" placeholder="Beneficios reales, material, talla, precio, packs, garantía, envío">${esc(prod().brief||'')}</textarea></div>
        <div class="field"><label for="ptxt">Prompt listo para Claude o ChatGPT</label><textarea id="ptxt" style="min-height:220px;font-family:ui-monospace,Menlo,monospace;font-size:12px">${esc(buildPrompt(p))}</textarea></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" id="pcopy">Copiar prompt</button><span class="hint" style="align-self:center">Revisa lo que quede entre corchetes antes de enviarlo.</span></div>
        <div class="field"><label for="pans">Pega aquí la respuesta de la IA</label><textarea id="pans" placeholder='{"bloques": [...], "copy": {...}}'></textarea></div>
        <div style="display:flex;gap:8px"><button class="btn sm" id="papply">Aplicar al guion y al copy</button><button class="btn ghost sm" id="pclose">Cerrar</button></div>`:''}
      </div>

      <div style="display:flex;align-items:center;gap:8px">
        <b style="font-size:15px">Guion</b>
        <span class="hint">${voice?`Video con voz · ~${voiceSecs(blocks)} s de voz`:p.format==='imagen'?'Imagen · un bloque con titular y visual':p.format==='carrusel'?'Carrusel · un bloque por tarjeta':'Video solo texto · el texto en pantalla es el guion'}</span>
        <span style="margin-left:auto;display:flex;gap:6px">${blocks.length?'':`<button class="btn ghost sm" id="tpl">Usar estructura base</button>`}<button class="btn ghost sm" id="addb">${ic('plus','sm')}${p.format==='carrusel'?'Tarjeta':'Bloque'}</button></span>
      </div>
      ${blocks.length?`<div style="display:flex;flex-direction:column;gap:10px">${blocks.map((b,i)=>`
        <div class="panel" style="padding:12px;display:grid;grid-template-columns:150px minmax(0,1fr);gap:12px" data-block="${b.id}">
          <div style="display:flex;flex-direction:column;gap:6px">
            <span class="muted" style="font-size:12px;font-weight:700">${p.format==='carrusel'?'Tarjeta':'Bloque'} ${i+1}</span>
            <label class="visually-hidden" for="bt-${b.id}">Tipo de bloque</label>
            <select id="bt-${b.id}" data-bf="tipo" style="height:32px;border:1px solid var(--line);border-radius:8px;padding:0 6px;background:#fff">${BLOCK_TYPES.map(t=>`<option ${t===b.tipo?'selected':''}>${t}</option>`).join('')}</select>
            ${p.format!=='imagen'?`<label class="visually-hidden" for="bti-${b.id}">Tiempo</label><input id="bti-${b.id}" data-bf="tiempo" value="${esc(b.tiempo)}" placeholder="${p.format==='carrusel'?'Tarjeta':'0–3 s'}" style="height:32px;border:1px solid var(--line);border-radius:8px;padding:0 8px">`:''}
            <div style="display:flex;gap:4px;margin-top:auto">
              <button class="btn ghost sm" data-mv="-1" aria-label="Subir bloque" ${i===0?'disabled':''}>↑</button>
              <button class="btn ghost sm" data-mv="1" aria-label="Bajar bloque" ${i===blocks.length-1?'disabled':''}>↓</button>
              <button class="btn ghost sm" data-del aria-label="Eliminar bloque">${ic('x','sm')}</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:${voice?'repeat(3,minmax(0,1fr))':'repeat(2,minmax(0,1fr))'};gap:10px">
            ${voice?`<div class="field"><label for="bv-${b.id}">Voz</label><textarea id="bv-${b.id}" data-bf="voz" placeholder="Lo que dice el creador">${esc(b.voz)}</textarea></div>`:''}
            <div class="field"><label for="bx-${b.id}">${p.format==='imagen'?'Titular en la imagen':'Texto en pantalla'}</label><textarea id="bx-${b.id}" data-bf="texto" placeholder="${p.format==='imagen'?'Máx. 6 palabras':'2–3 palabras'}">${esc(b.texto)}</textarea></div>
            <div class="field"><label for="bs-${b.id}">${p.format==='imagen'?'Composición':'Toma / visual'}</label><textarea id="bs-${b.id}" data-bf="visual" placeholder="Qué se ve y cómo se graba">${esc(b.visual)}</textarea></div>
          </div>
        </div>`).join('')}</div>`:`<div class="empty">Sin guion todavía. Usa la estructura base o genera el prompt y pega la respuesta.</div>`}
    </div>`;
  }else if(tab==='creativos'){
    content=`<div class="mb">
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="section-t">Creativos</div>
        <div class="drop" id="drop" style="padding:10px 12px"><div class="ic">${ic('up')}</div><div style="flex-grow:1"><b style="font-size:13px">Pega, arrastra o sube</b><div class="hint">La primera es la miniatura de la tarjeta.</div></div><button class="btn sm" id="bpick">Subir</button></div>
        ${p.mediaIds.length?`<div class="gallery">${p.mediaIds.map((m,i)=>`<div class="g ${i===0?'cover':''}"><button style="border:0;padding:0;background:none;width:100%;cursor:zoom-in" data-view="${m}" aria-label="Ver en grande">${thumbHTML(m)}</button>
          <button class="x" data-rm="${m}" aria-label="Quitar archivo">×</button>${i>0?`<button class="btn ghost sm" data-cover="${m}" style="position:absolute;left:4px;bottom:4px;height:24px;font-size:11px">Usar de portada</button>`:''}</div>`).join('')}</div>`:`<div class="empty" style="padding:18px">Sin creativos todavía.</div>`}
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="section-t">Copy del anuncio</div>
        <div class="field"><label for="mcp">Texto principal</label><textarea id="mcp" style="min-height:160px" placeholder="La primera línea es un segundo hook: tiene que funcionar sola.">${esc(p.copy.principal)}</textarea></div>
        <div class="grid2"><div class="field"><label for="mct">Título</label><input id="mct" value="${esc(p.copy.titulo)}" placeholder="Beneficio u oferta"></div>
        <div class="field"><label for="mcc">Botón</label><select id="mcc">${['Comprar','Enviar mensaje','Más información','Pedir ahora'].map(x=>`<option ${x===p.copy.cta?'selected':''}>${x}</option>`).join('')}</select></div></div>
        ${p.stage==='MOFU'||p.stage==='BOFU'||p.copy.cta==='Enviar mensaje'?`<div class="field"><label for="mwa">Mensaje prellenado de WhatsApp</label><input id="mwa" value="${esc(p.copy.mensaje||'')}" placeholder="Ej. Hola, quiero la tobillera"></div>`:''}
        ${p.copy.alternativos?.length?`<div class="field"><span style="font-size:12px;font-weight:600">Hooks alternativos sugeridos</span>${p.copy.alternativos.map((h,i)=>`<div style="display:flex;gap:6px;align-items:center"><span style="flex-grow:1">${esc(h)}</span><button class="btn ghost sm" data-savehook="${i}">Guardar en hooks</button></div>`).join('')}</div>`:''}
      </div></div>`;
  }else{
    content=`<div style="padding:18px;display:flex;flex-direction:column;gap:12px">
      <div class="grid2">
        <div class="field"><label for="mti">Título interno</label><input id="mti" value="${esc(p.title)}"></div>
        <div class="field"><label for="mst">Estado</label><select id="mst">${STATUS.filter(s=>s[0]!=='resultado').map(s=>`<option value="${s[0]}" ${s[0]===p.status?'selected':''}>${s[1]}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label for="mcode">Nombre del anuncio</label><div style="display:flex;gap:6px"><input id="mcode" value="${esc(p.adName||'')}" placeholder="${esc(suggestCode(p))}" style="font-family:ui-monospace,Menlo,monospace;font-size:12px"><button class="btn ghost sm" id="msug" style="height:38px">Sugerir</button></div></div>
      <div class="section-t">Resultados</div>
      <div class="grid3">
        <div class="field"><label for="msp">Gasto S/</label><input id="msp" type="number" min="0" step="0.1" value="${p.spend??''}"></div>
        <div class="field"><label for="mcf">Confirmados</label><input id="mcf" type="number" min="0" step="1" value="${p.conf??''}"></div>
        <div class="field"><label for="mde">Entregados</label><input id="mde" type="number" min="0" step="1" value="${p.delivered??''}"></div>
      </div>
      <div class="panel" style="padding:10px 12px;display:flex;gap:10px;align-items:center;background:#f8fafc"><span class="muted">CPA real</span><b style="font-size:16px">${money(c)}</b><span class="muted">tope ${money(tope())}</span>${r?`<span class="chip ${r==='Ganador'?'win':r==='Perdedor'?'lose':''}" style="margin-left:auto">${r}</span>`:''}</div>
    </div>`;
  }
  ov.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt">
    <div class="mh"><b id="mt">${esc(p.code)}</b><span style="font-weight:600">${esc(p.title)}</span>${p.stage?`<span class="chip ${p.stage}">${p.stage}</span>`:''}<span class="muted" style="font-size:13px">${esc(prod().name)}</span><button class="btn ghost sm" id="mx" style="margin-left:auto" aria-label="Cerrar">${ic('x','sm')}</button></div>
    <div class="seg" role="tablist" style="padding:10px 18px 0" id="mtabs">${tabBtn('guion','Guion',blocks.length||null)}${tabBtn('creativos','Creativos y copy',p.mediaIds.length||null)}${tabBtn('datos','Estado y resultados')}</div>
    ${content}
    <div class="mf"><button class="btn danger" id="mdel" style="margin-right:auto">Eliminar pieza</button><button class="btn" id="mok">Listo</button></div>
  </div>`;
  document.body.appendChild(ov); ov.scrollTop=keepScroll; hydrateThumbs(ov);
  const q=s=>ov.querySelector(s);
  ov.addEventListener('mousedown',e=>{if(e.target===ov)closeModal();});
  if(!window._escModal){window._escModal=true;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&UI.modal&&!document.querySelector('.viewer'))closeModal();});}
  q('#mx').onclick=closeModal;q('#mok').onclick=closeModal;
  ov.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{UI.modalTab=b.dataset.tab;renderModal();});
  q('#mdel').onclick=()=>{if(!confirm('¿Eliminar esta pieza?'))return;S.pieces=S.pieces.filter(x=>x.id!==p.id);save();closeModal();};
  const chg=(sel,fn)=>{const el=q(sel);if(el)el.addEventListener('change',e=>{fn(e.target.value);save();renderModal();});};
  const txt=(sel,fn)=>{const el=q(sel);if(el)el.addEventListener('input',e=>{fn(e.target.value);save();});};

  if(tab==='guion'){
    chg('#mfo',v=>p.format=v);chg('#man',v=>p.angleId=v);chg('#mco',v=>p.conceptId=v);chg('#mho',v=>p.hookId=v);
    chg('#mse',v=>{p.stage=v;if(v&&!p.board)p.board={x:Math.random()*.6,y:Math.random()};if(!v)p.board=null;});
    q('#gp').onclick=()=>{UI.promptOpen=true;renderModal();setTimeout(()=>q('#ptxt')&&ov.querySelector('#ptxt').scrollIntoView({block:'center'}),0);};
    if(q('#pcopy')){
      q('#pcopy').onclick=async()=>{const ok=await copyText(ov.querySelector('#ptxt').value,ov.querySelector('#ptxt'));toast(ok?'Prompt copiado':'Selecciona el texto y cópialo');};
      q('#pclose').onclick=()=>{UI.promptOpen=false;renderModal();};
      q('#pbrief').addEventListener('input',e=>{prod().brief=e.target.value;save();ov.querySelector('#ptxt').value=buildPrompt(p);});
      q('#papply').onclick=()=>{
        try{
          const d=parseAI(ov.querySelector('#pans').value);
          if(!Array.isArray(d.bloques)||!d.bloques.length)throw new Error('La respuesta no trae "bloques"');
          p.script.blocks=d.bloques.map(b=>({id:uid('b'),tipo:BLOCK_TYPES.includes(b.tipo)?b.tipo:(b.tipo||'Hook'),tiempo:b.tiempo||'',voz:b.voz||'',texto:b.texto_pantalla||b.texto||'',visual:b.visual||''}));
          if(d.copy){p.copy.principal=d.copy.texto_principal||p.copy.principal;p.copy.titulo=d.copy.titulo||p.copy.titulo;if(d.copy.cta)p.copy.cta=d.copy.cta;if(d.copy.mensaje_prellenado)p.copy.mensaje=d.copy.mensaje_prellenado;}
          if(Array.isArray(d.hooks_alternativos))p.copy.alternativos=d.hooks_alternativos.filter(Boolean);
          if(p.status==='idea')p.status='guion';
          UI.promptOpen=false;save();renderModal();toast(`Guion con ${p.script.blocks.length} bloques aplicado`);
        }catch(err){toast('No se pudo leer: '+err.message);}
      };
    }
    if(q('#tpl'))q('#tpl').onclick=()=>{applyTemplate(p);save();renderModal();};
    q('#addb').onclick=()=>{p.script.blocks.push({id:uid('b'),tipo:p.script.blocks.length?'Beneficio':'Hook',tiempo:'',voz:'',texto:'',visual:''});save();renderModal();};
    ov.querySelectorAll('[data-block]').forEach(el=>{
      const b=p.script.blocks.find(x=>x.id===el.dataset.block);
      el.querySelectorAll('[data-bf]').forEach(inp=>{
        const ev=inp.tagName==='SELECT'?'change':'input';
        inp.addEventListener(ev,()=>{b[inp.dataset.bf]=inp.value;save(); if(inp.dataset.bf==='voz'){const h=ov.querySelector('.hint');} });
      });
      el.querySelector('[data-del]').onclick=()=>{p.script.blocks=p.script.blocks.filter(x=>x!==b);save();renderModal();};
      el.querySelectorAll('[data-mv]').forEach(m=>m.onclick=()=>{const i=p.script.blocks.indexOf(b),j=i+Number(m.dataset.mv);if(j<0||j>=p.script.blocks.length)return;[p.script.blocks[i],p.script.blocks[j]]=[p.script.blocks[j],p.script.blocks[i]];save();renderModal();});
    });
  }else if(tab==='creativos'){
    const d=q('#drop');
    d.addEventListener('dragover',e=>{e.preventDefault();d.classList.add('over');});d.addEventListener('dragleave',()=>d.classList.remove('over'));
    d.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();d.classList.remove('over');ingest(e.dataTransfer.files,{toPiece:p});});
    q('#bpick').onclick=()=>pick(p);
    ov.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>openViewer(b.dataset.view));
    ov.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{p.mediaIds=p.mediaIds.filter(x=>x!==b.dataset.rm);save();renderModal();});
    ov.querySelectorAll('[data-cover]').forEach(b=>b.onclick=()=>{p.mediaIds=[b.dataset.cover,...p.mediaIds.filter(x=>x!==b.dataset.cover)];save();renderModal();});
    txt('#mcp',v=>p.copy.principal=v);txt('#mct',v=>p.copy.titulo=v);txt('#mwa',v=>p.copy.mensaje=v);chg('#mcc',v=>p.copy.cta=v);
    ov.querySelectorAll('[data-savehook]').forEach(b=>b.onclick=()=>{const t=p.copy.alternativos[+b.dataset.savehook];
      S.hooks.push({id:uid('h'),productId:PID(),text:t,type:hasVoice(p.format)?'Hablado':'Texto en pantalla',conceptId:p.conceptId,angleId:p.angleId,stage:p.stage,origin:'Claude'});
      p.copy.alternativos.splice(+b.dataset.savehook,1);save();renderModal();toast('Hook guardado');});
  }else{
    txt('#mti',v=>p.title=v);txt('#mcode',v=>p.adName=v);chg('#mst',v=>p.status=v);
    const num=(sel,key)=>q(sel).addEventListener('change',e=>{p[key]=e.target.value===''?null:Number(e.target.value);save();renderModal();});
    num('#msp','spend');num('#mcf','conf');num('#mde','delivered');
    q('#msug').onclick=()=>{p.adName=suggestCode(p);save();renderModal();};
  }
}

/* ============ EMBUDO (pizarra) ============ */
function vEmbudo(){
  setTop('Embudo',`Arrastra las piezas de ${prod().name} a TOFU, MOFU o BOFU · muévelas libremente dentro de cada etapa`,`<button class="btn ghost" id="enew">${ic('plus','sm')}Nueva pieza</button>`);
  if(!S.lanes[PID()])S.lanes[PID()]=emptyLanes();
  const L=S.lanes[PID()];const ps=mine(S.pieces);
  const tray=ps.filter(p=>!p.stage);
  $('#body').style.overflow='hidden';
  $('#body').innerHTML=`<div class="boardwrap">
    <aside class="panel tray" id="tray" aria-label="Piezas sin etapa">
      <b>Sin etapa <span class="muted" style="font-weight:500">${tray.length}</span></b>
      <div class="hint">Arrastra una pieza a la pizarra. Suelta aquí para quitarle la etapa.</div>
      ${tray.map(p=>`<div class="titem" data-id="${p.id}">${thumbHTML(p.mediaIds[0],p.format==='imagen'?'IMG':'VID')}<div><b>${esc(p.title)}</b><div class="muted" style="font-size:11px">${esc(p.code)}</div></div></div>`).join('')||'<div class="empty" style="padding:14px;font-size:12px">Todas las piezas tienen etapa.</div>'}
    </aside>
    <div class="board" id="board">
      ${STAGES.map(s=>{const n=ps.filter(p=>p.stage===s).length;return `<section class="lane ${s}" data-stage="${s}">
        <div class="lanehead">
          <div style="display:flex;align-items:center;gap:8px"><span class="chip ${s}">${s}</span><b>${STAGE_INFO[s][0]}</b></div>
          <p>${STAGE_INFO[s][1]}</p>
          <label class="visually-hidden" for="obj-${s}">Objetivo ${s}</label>
          <select id="obj-${s}" data-obj="${s}">${['Ventas → landing','Mensajes → WhatsApp','Clientes potenciales','Interacción'].map(o=>`<option ${o===L[s].objetivo?'selected':''}>${o}</option>`).join('')}</select>
          <div class="auds">${L[s].auds.map((a,i)=>`<span class="chip">${esc(a)}<button data-rma="${s}:${i}" aria-label="Quitar público ${esc(a)}">×</button></span>`).join('')}</div>
          <label class="visually-hidden" for="aud-${s}">Agregar público a ${s}</label>
          <input id="aud-${s}" data-aud="${s}" placeholder="+ Público y ventana (Enter)">
        </div>
        <span class="lanecount">${n} pieza${n===1?'':'s'}</span>
      </section>`;}).join('')}
      ${ps.filter(p=>p.stage&&p.board).map(p=>boardItem(p)).join('')}
    </div>
  </div>`;
  $('#enew').onclick=()=>{const p=newPiece({});openModal(p.id);};
  document.querySelectorAll('[data-obj]').forEach(sel=>sel.onchange=e=>{L[sel.dataset.obj].objetivo=e.target.value;save();});
  document.querySelectorAll('[data-aud]').forEach(inp=>inp.onkeydown=e=>{if(e.key==='Enter'&&inp.value.trim()){L[inp.dataset.aud].auds.push(inp.value.trim());save();render();setTimeout(()=>$('#aud-'+inp.dataset.aud)?.focus(),0);}});
  document.querySelectorAll('[data-rma]').forEach(b=>b.onclick=()=>{const [s,i]=b.dataset.rma.split(':');L[s].auds.splice(+i,1);save();render();});
  wireBoard();
}
function boardPos(p){const idx=STAGES.indexOf(p.stage);const cl=v=>Math.max(0,Math.min(1,Number(v)||0));const x=cl(p.board.x),y=cl(p.board.y);
  return `left:calc(238px + ${x} * (100% - 238px - 140px));top:calc(${idx} * 33.333% + 8px + ${y} * (33.333% - 166px))`;}
function boardItem(p){
  const ang=byId(S.angles,p.angleId);
  return `<div class="bitem" data-id="${p.id}" style="${boardPos(p)}" tabindex="0" role="button" aria-label="${esc(p.code)} en ${p.stage}. Doble clic para abrir">
    ${thumbHTML(p.mediaIds[0],p.format==='imagen'?'Imagen':'Video')}
    <div class="bb"><b>${esc(p.title)}</b><span>${esc(p.code)}${ang?' · '+esc(ang.name):''}</span></div></div>`;
}
function wireBoard(){
  const board=$('#board'),tray=$('#tray');
  const laneAt=(x,y)=>{const els=[...board.querySelectorAll('.lane')];return els.find(l=>{const r=l.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;});};
  const headW=230;
  function startDrag(el,e,fromTray){
    if(e.button!==0)return; e.preventDefault();
    const id=el.dataset.id;const p=byId(S.pieces,id);
    const r=el.getBoundingClientRect();const offX=e.clientX-r.left,offY=e.clientY-r.top;
    const ghost=el.cloneNode(true);ghost.classList.add('ghost-drag');ghost.style.width=(fromTray?140:r.width)+'px';ghost.style.left=r.left+'px';ghost.style.top=r.top+'px';
    if(fromTray){ghost.className='bitem ghost-drag';ghost.innerHTML=boardItem({...p,board:{x:0,y:0},stage:'TOFU'}).replace(/^<div[^>]*>|<\/div>$/g,'');}
    document.body.appendChild(ghost);hydrateThumbs(ghost);el.style.opacity='.35';
    let moved=false;let hot=null;
    const move=ev=>{moved=true;ghost.style.left=(ev.clientX-offX)+'px';ghost.style.top=(ev.clientY-offY)+'px';
      const l=laneAt(ev.clientX,ev.clientY);if(hot!==l){hot?.classList.remove('hot');hot=l;hot?.classList.add('hot');}
      const tr=tray.getBoundingClientRect();tray.classList.toggle('over',ev.clientX>=tr.left&&ev.clientX<=tr.right&&ev.clientY>=tr.top&&ev.clientY<=tr.bottom);};
    const up=ev=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);ghost.remove();el.style.opacity='';hot?.classList.remove('hot');tray.classList.remove('over');
      if(!moved){ if(!fromTray)return; }
      const tr=tray.getBoundingClientRect();
      if(ev.clientX>=tr.left&&ev.clientX<=tr.right&&ev.clientY>=tr.top&&ev.clientY<=tr.bottom){ if(p.stage){p.stage='';p.board=null;save();render();toast('Pieza sin etapa');} return; }
      const l=laneAt(ev.clientX,ev.clientY); if(!l){return;}
      const br=board.getBoundingClientRect();
      const lr=l.getBoundingClientRect();const cl=v=>Math.max(0,Math.min(1,v));
      const x=cl((ev.clientX-offX-(br.left+238))/Math.max(1,br.width-238-140));
      const y=cl((ev.clientY-offY-(lr.top+8))/Math.max(1,lr.height-166));
      const prev=p.stage; p.stage=l.dataset.stage; p.board={x,y}; save(); render();
      if(prev!==p.stage)toast(`${p.code} ahora está en ${p.stage}`);
    };
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
  }
  board.querySelectorAll('.bitem').forEach(el=>{
    el.addEventListener('pointerdown',e=>startDrag(el,e,false));
    el.addEventListener('dblclick',()=>openModal(el.dataset.id));
    el.addEventListener('keydown',e=>{if(e.key==='Enter')openModal(el.dataset.id);});
  });
  tray.querySelectorAll('.titem').forEach(el=>{
    el.addEventListener('pointerdown',e=>startDrag(el,e,true));
    el.addEventListener('dblclick',()=>openModal(el.dataset.id));
  });
}

/* ============ TRACKER ============ */
function vTracker(){
  $('#body').style.overflow='';
  setTop('Tracker',`Resultados de ${prod().name} · CPA real con tope de ${money(tope())} ($${S.settings.topeUSD} × ${S.settings.tc})`,`<button class="btn ghost" id="tset">Ajustes de CPA</button>`);
  const ps=mine(S.pieces);
  const agg=s=>{const x=ps.filter(p=>p.stage===s);const sp=x.reduce((a,p)=>a+(p.spend||0),0),cf=x.reduce((a,p)=>a+(p.conf||0),0);return {n:x.length,sp,cf,c:cf?sp/cf:null};};
  const angRows=mine(S.angles).map(a=>{const x=ps.filter(p=>p.angleId===a.id);const sp=x.reduce((s,p)=>s+(p.spend||0),0),cf=x.reduce((s,p)=>s+(p.conf||0),0);return {a,n:x.length,sp,cf,c:cf?sp/cf:null};});
  const maxC=Math.max(tope()*1.6,...angRows.map(r=>r.c||0));
  $('#body').innerHTML=`
   <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:14px">
    ${STAGES.map(s=>{const g=agg(s);return `<div class="panel" style="padding:16px"><div style="display:flex;align-items:center;gap:8px"><span class="chip ${s}">${s}</span><span class="muted">${g.n} piezas</span></div>
      <div style="display:flex;gap:18px;margin-top:10px"><div><div class="muted" style="font-size:12px">Gasto</div><b style="font-size:20px">${money(g.sp)}</b></div><div><div class="muted" style="font-size:12px">Confirmados</div><b style="font-size:20px">${g.cf}</b></div><div><div class="muted" style="font-size:12px">CPA real</div><b style="font-size:20px;color:${g.c==null?'inherit':g.c<=tope()?'var(--bofu)':'var(--red)'}">${money(g.c)}</b></div></div></div>`;}).join('')}
   </div>
   <div class="panel" style="padding:16px;margin-bottom:14px">
     <b>CPA real por ángulo de venta</b>
     <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
      ${angRows.map(r=>`<div style="display:grid;grid-template-columns:200px 1fr 80px 70px;gap:12px;align-items:center">
        <span>${esc(r.a.name)}</span>
        <div style="position:relative;height:12px;background:var(--line2);border-radius:99px">${r.c?`<div style="width:${Math.min(100,r.c/maxC*100)}%;height:12px;border-radius:99px;background:${r.c<=tope()?'#10b981':'#ef4444'}"></div>`:''}<div title="Tope" style="position:absolute;top:-4px;bottom:-4px;left:${tope()/maxC*100}%;width:2px;background:var(--ink)"></div></div>
        <b class="num" style="text-align:right">${money(r.c)}</b><span class="muted" style="text-align:right">${r.n} piezas</span></div>`).join('')||'<span class="muted">Sin ángulos</span>'}
     </div>
     <div class="hint" style="margin-top:8px">La línea negra marca el tope de CPA.</div>
   </div>
   <div class="panel" style="overflow:auto"><table><thead><tr><th></th><th>Pieza</th><th>Etapa</th><th>Ángulo</th><th>Concepto</th><th>Estado</th><th class="num">Gasto S/</th><th class="num">Confirmados</th><th class="num">Entregados</th><th class="num">CPA real</th><th>Resultado</th></tr></thead><tbody>
   ${ps.map(p=>{const c=cpa(p),r=result(p);return `<tr>
     <td style="width:56px"><button style="border:0;padding:0;background:none;width:44px;height:44px;display:block" data-open="${p.id}" aria-label="Abrir ${esc(p.code)}"><div style="width:44px;height:44px">${thumbHTML(p.mediaIds[0],'—')}</div></button></td>
     <td><b>${esc(p.code)}</b><div class="muted" style="font-size:12px">${esc(p.title)}</div></td>
     <td>${p.stage?`<span class="chip ${p.stage}">${p.stage}</span>`:'—'}</td>
     <td>${p.angleId?`<span class="chip ang">${esc(byId(S.angles,p.angleId)?.name||'')}</span>`:'—'}</td>
     <td class="muted">${esc(byId(S.concepts,p.conceptId)?.name||'—')}</td>
     <td>${esc(STATUS.find(s=>s[0]===p.status)?.[1]||'')}</td>
     <td class="num"><input class="cell" type="number" min="0" step="0.1" value="${p.spend??''}" data-f="spend" data-id="${p.id}" aria-label="Gasto ${esc(p.code)}"></td>
     <td class="num"><input class="cell" type="number" min="0" value="${p.conf??''}" data-f="conf" data-id="${p.id}" aria-label="Confirmados ${esc(p.code)}"></td>
     <td class="num"><input class="cell" type="number" min="0" value="${p.delivered??''}" data-f="delivered" data-id="${p.id}" aria-label="Entregados ${esc(p.code)}"></td>
     <td class="num"><b>${money(c)}</b></td>
     <td>${r?`<span class="chip ${r==='Ganador'?'win':r==='Perdedor'?'lose':''}">${r}</span>`:'—'}</td></tr>`;}).join('')}
   </tbody></table></div>`;
  document.querySelectorAll('.thumb').forEach(t=>{if(t.closest('[data-open]'))t.style.height='44px';});
  document.querySelectorAll('input.cell').forEach(inp=>inp.onchange=()=>{const p=byId(S.pieces,inp.dataset.id);p[inp.dataset.f]=inp.value===''?null:Number(inp.value);save();render();});
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openModal(b.dataset.open));
  $('#tset').onclick=openSettings;
}

/* ============ DATOS DE META (importación) ============ */
const ALIAS_META={
  fecha:['dia','day','fecha','date','date_start','inicio del informe','reporting starts','fecha de inicio del informe'],
  ad_id:['identificador del anuncio','id del anuncio','ad id','ad_id'],
  nombre:['nombre del anuncio','ad name','ad_name','anuncio'],
  campana:['nombre de la campana','campaign name','campaign_name','campana'],
  conjunto:['nombre del conjunto de anuncios','ad set name','adset_name','conjunto de anuncios','nombre del conjunto'],
  gasto:['importe gastado','amount spent','amount_spent','spend','gasto','inversion','importe gastado total'],
  impresiones:['impresiones','impressions'], alcance:['alcance','reach'],
  clics:['clics en el enlace','link clicks','link_click','inline_link_clicks','clics en enlaces','clics'],
  resultados:['resultados','results'],
  valor:['valor de conversion de compras','purchases conversion value','valor de los resultados','valor de conversion'],
  vistas_3s:['reproducciones de video de 3 segundos','reproducciones de 3 segundos del video','3-second video plays','3 second video plays','video_play_actions']
};
const normH=t=>String(t||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\((cop|usd|mxn|eur|pen|clp|ars)\)/g,'').replace(/\s+/g,' ').trim();
function numMeta(v,miles){ if(v==null)return 0; if(typeof v==='number')return v; let s=String(v).trim().replace('%','').replace(/[$\s\u00a0]|S\//g,''); if(!s||s==='-'||s==='—')return 0;
  if(miles&&/^-?\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  else if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(s.includes(',')){const p=s.split(',');s=p.length===2&&p[1].length<=2?s.replace(',','.'):s.replace(/,/g,'');}
  const n=parseFloat(s); return isNaN(n)?0:n; }
function parseCSV(text){
  text=text.replace(/^\uFEFF/,''); const first=text.split(/\r?\n/)[0]; const del=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':(first.includes('\t')?'\t':',');
  const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
    else if(c==='"')q=true; else if(c===del){row.push(cur);cur='';} else if(c==='\n'||c==='\r'){ if(c==='\r'&&text[i+1]==='\n')i++; row.push(cur);cur=''; if(row.some(x=>x!==''))rows.push(row); row=[]; } else cur+=c; }
  if(cur!==''||row.length){row.push(cur);if(row.some(x=>x!==''))rows.push(row);}
  return rows;
}
const isoDate=s=>{s=String(s||'').trim(); let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m)return `${m[1]}-${m[2]}-${m[3]}`; m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; return null; };
function csvToDatos(text){
  const rows=parseCSV(text); if(rows.length<2)throw new Error('El CSV está vacío');
  const head=rows[0]; const nh=head.map(normH); const map={};
  for(const [campo,al] of Object.entries(ALIAS_META)){const i=nh.findIndex((h,ix)=>al.includes(h)&&!Object.values(map).includes(ix));if(i>=0)map[campo]=i;}
  if(map.fecha==null)throw new Error('Falta la columna de día: exporta con desglose por día');
  if(map.ad_id==null&&map.nombre==null)throw new Error('Falta el nombre o ID del anuncio: exporta a nivel de anuncio');
  const moneda=/\(pen\)/i.test(head.join(' '))?'PEN':/\(usd\)/i.test(head.join(' '))?'USD':'';
  const agg=new Map(),ads=new Map();
  for(const r of rows.slice(1)){
    const fecha=isoDate(r[map.fecha]); if(!fecha)continue;
    const nombre=map.nombre!=null?r[map.nombre]:''; const id=(map.ad_id!=null&&r[map.ad_id])?String(r[map.ad_id]).trim():nombre; if(!id)continue;
    const k=id+'|'+fecha; const o=agg.get(k)||{fecha,ad_id:id,gasto:0,impresiones:0,alcance:0,clics:0,resultados:0,valor:0};
    o.gasto+=numMeta(r[map.gasto],true); o.impresiones+=numMeta(r[map.impresiones],true); o.alcance+=numMeta(r[map.alcance],true);
    o.clics+=numMeta(r[map.clics],true); o.resultados+=numMeta(r[map.resultados],true); o.valor+=numMeta(r[map.valor],true);
    if(map.vistas_3s!=null)o.vistas_3s=(o.vistas_3s||0)+numMeta(r[map.vistas_3s],true);
    agg.set(k,o);
    if(!ads.has(id))ads.set(id,{id,nombre:nombre||id,campana:map.campana!=null?r[map.campana]:'',conjunto:map.conjunto!=null?r[map.conjunto]:''});
  }
  return {meta:{moneda,fuente:'csv'},anuncios:[...ads.values()],diario:[...agg.values()]};
}
function productForAd(a){
  const t=[a.campana,a.conjunto,a.nombre].join(' ').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const hits=S.products.filter(p=>p.code&&t.includes(p.code.toUpperCase())).sort((x,y)=>y.code.length-x.code.length);
  return hits[0]?.id||PID();
}
function importDatos(d,label){
  if(!d||!Array.isArray(d.diario)||!d.diario.length)throw new Error('No encontré filas diarias');
  if(!S.metaData)S.metaData={};
  const adProd=new Map((d.anuncios||[]).map(a=>[a.id,productForAd(a)]));
  const counts={};
  const byProd={};
  for(const r of d.diario){const pid=adProd.get(r.ad_id)||PID();(byProd[pid]=byProd[pid]||{rows:[],ids:new Set()}).rows.push(r);byProd[pid].ids.add(r.ad_id);}
  for(const [pid,g] of Object.entries(byProd)){
    const cur=S.metaData[pid]||{meta:{},anuncios:[],diario:[]};
    const rowMap=new Map(cur.diario.map(r=>[r.ad_id+'|'+r.fecha,r]));
    g.rows.forEach(r=>{const x={fecha:r.fecha,ad_id:String(r.ad_id),gasto:+r.gasto||0,impresiones:+r.impresiones||0,alcance:+r.alcance||0,clics:+r.clics||0,resultados:+r.resultados||0,valor:+r.valor||0};if(r.vistas_3s!=null)x.vistas_3s=+r.vistas_3s||0;rowMap.set(x.ad_id+'|'+x.fecha,x);});
    const adMap=new Map(cur.anuncios.map(a=>[a.id,a]));
    (d.anuncios||[]).filter(a=>g.ids.has(a.id)).forEach(a=>adMap.set(a.id,Object.assign({},adMap.get(a.id)||{},{id:String(a.id),nombre:a.nombre,campana:a.campana||'',conjunto:a.conjunto||'',fecha_inicio:a.fecha_inicio||adMap.get(a.id)?.fecha_inicio,frecuencia_acumulada:a.frecuencia_acumulada??adMap.get(a.id)?.frecuencia_acumulada})));
    S.metaData[pid]={meta:{...cur.meta,...(d.meta||{}),moneda:(d.meta&&d.meta.moneda)||cur.meta.moneda||'USD'},anuncios:[...adMap.values()],diario:[...rowMap.values()],importedAt:Date.now(),label};
    counts[pid]=g.ids.size;
  }
  PREP_CACHE.clear(); save();
  return Object.entries(counts).map(([pid,n])=>`${byId(S.products,pid)?.name}: ${n} anuncios`).join(' · ');
}
function openImport(){
  formModal('Importar datos de Meta',`
    <p style="margin:0;line-height:1.5">Sube el CSV del <b>Administrador de anuncios</b> a nivel de <b>anuncio</b>, con desglose por <b>día</b>. Columnas necesarias: día, nombre o ID del anuncio, campaña, conjunto, importe gastado, impresiones, alcance, clics en el enlace y resultados. Suma “reproducciones de 3 segundos” para el hook rate.</p>
    <p class="hint" style="margin:0">También acepta el JSON del predictor de fatiga. Los anuncios se asignan al producto cuyo código aparece en el nombre de la campaña (NOVAFLEX, NOVAFIT…); el resto va a ${esc(prod().name)}. Si reimportas un periodo, se actualiza sin duplicar.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="impfile" type="button">Elegir CSV o JSON</button>${SAMPLE_OK()?'<button class="btn ghost" id="impsample" type="button">Cargar ejemplo real: nova shop, 90 días</button>':''}</div>
    <div class="hint" id="impmsg"></div>`,()=>{render();});
  $('#impfile').onclick=()=>{const inp=document.createElement('input');inp.type='file';inp.accept='.csv,.txt,.json,text/csv,application/json';
    inp.onchange=async()=>{const f=inp.files[0];if(!f)return;try{const t=await f.text();const d=/\.json$/i.test(f.name)?JSON.parse(t):csvToDatos(t);const msg=importDatos(d,f.name);$('#impmsg').textContent='Importado · '+msg;toast('Datos importados');}catch(e){$('#impmsg').textContent='No se pudo importar: '+e.message;}};inp.click();};
  if($('#impsample'))$('#impsample').onclick=()=>{import('./sample-nova.json').then(m=>{const d=JSON.parse(JSON.stringify(m.default));const msg=importDatos(d,'Ejemplo nova shop 90 d');$('#impmsg').textContent='Importado · '+msg;toast('Ejemplo cargado');}).catch(e=>{$('#impmsg').textContent='Error: '+e.message;});};
}
const SAMPLE_OK=()=>true;
const PREP_CACHE=new Map();
function dataset(){ const d=S.metaData?.[PID()]; if(!d||!d.diario?.length)return null;
  const key=PID()+':'+d.importedAt; if(PREP_CACHE.has(key))return PREP_CACHE.get(key);
  const copy={meta:d.meta,anuncios:d.anuncios.map(a=>({...a})),diario:d.diario.map(r=>({...r}))};
  const prep=MotorFatiga.preparar(copy); const out={d,prep}; PREP_CACHE.clear(); PREP_CACHE.set(key,out); return out; }
const curMoneda=()=>S.metaData?.[PID()]?.meta?.moneda||'USD';
const objetivoMeta=()=>curMoneda()==='USD'?S.settings.topeUSD:S.settings.topeUSD*S.settings.tc;
const mm=v=>v==null||!isFinite(v)?'—':(curMoneda()==='USD'?'$'+v.toFixed(2):'S/'+v.toFixed(1));
const mmBig=v=>v==null||!isFinite(v)?'—':(curMoneda()==='USD'?'$':'S/')+Math.round(v).toLocaleString('es-PE');
const pc=(v,d=0)=>v==null||!isFinite(v)?'—':(v*100).toFixed(d)+'%';
const dpc=v=>v==null||!isFinite(v)?'':`<span class="delta ${v>0?'up':'down'}">${v>0?'+':''}${Math.round(v*100)}%</span>`;
function pieceForAd(adId,nombre){ return mine(S.pieces).find(p=>(p.adIds||[]).includes(adId))||mine(S.pieces).find(p=>p.adName&&nombre&&p.adName.trim()===nombre.trim()); }
function emptyData(title){
  setTop(title,`Sin datos de Meta para ${prod().name}`,`<button class="btn" id="imp1">Importar datos de Meta</button>`);
  $('#body').innerHTML=`<div class="empty" style="max-width:640px;margin:40px auto;text-align:left;display:flex;flex-direction:column;gap:10px">
    <b style="color:var(--ink);font-size:16px">Importa el rendimiento diario de tus anuncios</b>
    <span>Exporta desde el Administrador de anuncios: nivel <b>Anuncios</b>, desglose <b>Por día</b>, formato CSV. Con eso se calcula el 80/20 y la fatiga de cada anuncio.</span>
    <div><button class="btn" id="imp2">Importar datos de Meta</button></div></div>`;
  $('#imp1').onclick=openImport;$('#imp2').onclick=openImport;
}
const PERIODS=[7,14,30,60,90];

/* ============ ANÁLISIS 80/20 ============ */
function baseName(n){return String(n||'').replace(/\.mp4/ig,'').replace(/\s*-\s*copia.*$/i,'').replace(/\s+/g,' ').trim();}
function dimKey(dim,a,piece){
  switch(dim){
    case 'anuncio':return [a.id,a.nombre+(a.conjunto?' · '+a.conjunto:'')];
    case 'creativo':return [baseName(a.nombre).toLowerCase(),baseName(a.nombre)];
    case 'campana':return [a.campana||'—',a.campana||'Sin campaña'];
    case 'conjunto':return [a.conjunto||'—',a.conjunto||'Sin conjunto'];
    case 'formato':return [a.formato,a.formato==='video'?'Video':'Imagen'];
    case 'angulo':{const x=piece&&byId(S.angles,piece.angleId);return x?[x.id,x.name]:['_','Sin vincular'];}
    case 'concepto':{const x=piece&&byId(S.concepts,piece.conceptId);return x?[x.id,x.name]:['_','Sin vincular'];}
    case 'etapa':return piece?.stage?[piece.stage,piece.stage]:['_','Sin vincular'];
  }
}
function vAnalisis(){
  const ds=dataset(); if(!ds)return emptyData('Análisis 80/20');
  const {d,prep}=ds; const U=UI.an||(UI.an={dias:30,dim:'anuncio',orden:'resultados'});
  const hasta=prep.maxD,desde=hasta-U.dias+1,pDesde=desde-U.dias;
  const tope=objetivoMeta();
  const groups=new Map(); const tot={g:0,r:0,imp:0,cl:0,v3:0,iv:0}, prev={g:0,r:0,imp:0,cl:0};
  const daily=new Map(); for(let x=desde;x<=hasta;x++)daily.set(x,{g:0,r:0});
  for(const [id,rows] of prep.porAnuncio){
    const a=prep.info.get(id); const piece=pieceForAd(id,a.nombre); const [k,label]=dimKey(U.dim,a,piece);
    for(const r of rows){
      if(r._d<pDesde||r._d>hasta)continue;
      if(r._d<desde){prev.g+=r.gasto||0;prev.r+=r.resultados||0;prev.imp+=r.impresiones||0;prev.cl+=r.clics||0;continue;}
      let G=groups.get(k); if(!G){G={k,label,g:0,r:0,imp:0,cl:0,v3:0,iv:0,ads:new Set(),pieces:new Set(),first:null};groups.set(k,G);}
      G.g+=r.gasto||0;G.r+=r.resultados||0;G.imp+=r.impresiones||0;G.cl+=r.clics||0; if(r.vistas_3s!=null){G.v3+=r.vistas_3s;G.iv+=r.impresiones||0;tot.v3+=r.vistas_3s;tot.iv+=r.impresiones||0;}
      G.ads.add(id); if(piece){G.pieces.add(piece.id);} if(U.dim==='anuncio')G.adId=id;
      tot.g+=r.gasto||0;tot.r+=r.resultados||0;tot.imp+=r.impresiones||0;tot.cl+=r.clics||0;
      const dd=daily.get(r._d);dd.g+=r.gasto||0;dd.r+=r.resultados||0;
    }
  }
  let items=[...groups.values()].filter(G=>G.g>0||G.r>0);
  const key=U.orden==='gasto'?'g':'r';
  items.sort((x,y)=>(y[key]-x[key])||(y.g-x.g));
  let cum=0; const T=tot[key]||1;
  items.forEach(G=>{G.cpa=G.r?G.g/G.r:null;G.ctr=G.imp?G.cl/G.imp:null;G.hook=G.iv?G.v3/G.iv:null;G.shG=tot.g?G.g/tot.g:0;G.shR=tot.r?G.r/tot.r:0;
    const prevCum=cum; cum+=G[key]/T; G.cum=cum; G.core=prevCum<0.8; G.efi=G.shG?G.shR/G.shG:null;
    G.accion=G.core?(G.cpa!=null&&G.cpa<=tope?'Escalar':'Vigilar CPA'):(G.shG>=0.03&&(G.cpa==null||G.cpa>tope)?'Recortar':(G.cpa!=null&&G.cpa<=tope?'Darle más presupuesto':'Dejar en prueba'));});
  const core=items.filter(G=>G.core); const tail=items.filter(G=>!G.core);
  const coreShareN=items.length?core.length/items.length:0;
  const tailG=tail.reduce((s,G)=>s+G.g,0), tailR=tail.reduce((s,G)=>s+G.r,0);
  const recortar=items.filter(G=>G.accion==='Recortar'); const escalar=items.filter(G=>G.accion==='Escalar'||G.accion==='Darle más presupuesto');
  const recG=recortar.reduce((s,G)=>s+G.g,0)/U.dias;
  const cpaT=tot.r?tot.g/tot.r:null, cpaP=prev.r?prev.g/prev.r:null;
  const dimLabels=[['anuncio','Anuncio'],['creativo','Creativo (mismo nombre)'],['campana','Campaña'],['conjunto','Conjunto'],['formato','Formato'],['angulo','Ángulo'],['concepto','Concepto'],['etapa','Etapa']];
  const unlinked=['angulo','concepto','etapa'].includes(U.dim)?items.find(G=>G.k==='_'):null;
  setTop('Análisis 80/20',`${prod().name} · ${MotorFatiga.aFecha(desde)} a ${MotorFatiga.aFecha(hasta)} · objetivo CPA ${mm(tope)}`,`<button class="btn ghost" id="aimp">Actualizar datos</button>`);
  const top=items.slice(0,24), restV=items.slice(24).reduce((s,G)=>s+G[key],0);
  $('#body').innerHTML=`
   <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
     <div class="seg" id="ap">${PERIODS.map(n=>`<button data-n="${n}" class="${U.dias===n?'on':''}">${n} días</button>`).join('')}</div>
     <label class="visually-hidden" for="adim">Agrupar por</label><select id="adim" class="fsel" style="height:30px">${dimLabels.map(([k,l])=>`<option value="${k}" ${U.dim===k?'selected':''}>Agrupar por ${l.toLowerCase()}</option>`).join('')}</select>
     <div class="seg" id="ao">${[['resultados','80/20 de resultados'],['gasto','80/20 de gasto']].map(([k,l])=>`<button data-k="${k}" class="${U.orden===k?'on':''}">${l}</button>`).join('')}</div>
   </div>
   <div class="kpis">
     ${kpi('Gasto',mmBig(tot.g),dpc(prev.g?tot.g/prev.g-1:null))}
     ${kpi(d.meta.etiqueta_resultado||'Resultados',Math.round(tot.r).toLocaleString('es-PE'),dpc(prev.r?tot.r/prev.r-1:null))}
     ${kpi('CPA',`<span style="color:${cpaT!=null&&cpaT<=tope?'var(--bofu)':'var(--red)'}">${mm(cpaT)}</span>`,dpc(cpaP&&cpaT?cpaT/cpaP-1:null),true)}
     ${kpi('CTR',pc(tot.imp?tot.cl/tot.imp:null,2),dpc(prev.imp&&tot.imp?(tot.cl/tot.imp)/(prev.cl/prev.imp)-1:null))}
     ${kpi('Hook rate',pc(tot.iv?tot.v3/tot.iv:null,1),tot.iv&&tot.v3/tot.iv>.85?'<span title="Un valor tan alto suele ser reproducciones iniciadas, no de 3 segundos">Revisa: parece “reproducciones iniciadas”</span>':'')}
   </div>
   <div class="an-grid">
     <section class="panel" style="padding:18px">
       <h2 class="h2">La regla 80/20 en ${esc(prod().name)}</h2>
       <p class="lead"><b>${core.length} de ${items.length}</b> (${pc(coreShareN)}) ${U.orden==='gasto'?'se llevan el 80% del gasto':'generan el 80% de los resultados'}.
       ${U.orden==='resultados'&&tail.length?` El resto usó <b>${pc(tot.g?tailG/tot.g:0)}</b> del gasto para traer <b>${pc(tot.r?tailR/tot.r:0)}</b> de los resultados.`:''}</p>
       ${paretoSVG(top,key,restV,T,tope)}
       <div class="legend"><span><i style="background:var(--accent)"></i>Núcleo que hace el 80%</span><span><i style="background:#cbd5e1"></i>Cola</span><span><i style="background:none;border:2px solid var(--red)"></i>CPA sobre el objetivo</span><span><i style="background:var(--ink);height:2px"></i>Acumulado</span></div>
     </section>
     <section class="panel" style="padding:18px;display:flex;flex-direction:column;gap:12px">
       <h2 class="h2">Dónde poner la plata</h2>
       ${recortar.length?`<div class="callout warn"><b>Recortar ~${mmBig(recG)}/día</b><span>${recortar.length} ${recortar.length===1?'grupo gasta':'grupos gastan'} ${pc(recortar.reduce((s,G)=>s+G.shG,0))} del presupuesto con CPA sobre el objetivo o sin resultados.</span></div>`:'<div class="callout ok"><b>Sin fugas grandes</b><span>Ningún grupo de la cola gasta más del 3% con CPA malo.</span></div>'}
       ${escalar.length?`<div class="callout ok"><b>Mover a lo que funciona</b><span>${escalar.slice(0,3).map(G=>`${esc(G.label)} (${mm(G.cpa)})`).join(', ')}${escalar.length>3?` y ${escalar.length-3} más`:''}.</span></div>`:`<div class="callout"><b>Nada bajo el objetivo</b><span>Ningún grupo tiene CPA menor o igual a ${mm(tope)}. Revisa la oferta o la landing antes de escalar.</span></div>`}
       ${unlinked&&unlinked.shG>0.2?`<div class="callout"><b>${pc(unlinked.shG)} del gasto sin vincular</b><span>Vincula los anuncios a sus piezas (agrupa por anuncio) para ver ángulos, conceptos y etapas.</span></div>`:''}
       <div><div class="section-t" style="margin-bottom:8px">Gasto y ${esc((d.meta.etiqueta_resultado||'resultados').toLowerCase())} por día</div>${dailySVG([...daily.entries()],tope)}</div>
       <p class="hint" style="margin:0">Ojo: son resultados que reporta Meta. Tu CPA real sale de los pedidos entregados.</p>
     </section>
   </div>
   <section class="panel" style="overflow:auto;margin-top:14px">
     <table class="tbl"><thead><tr><th>#</th><th>${esc(dimLabels.find(x=>x[0]===U.dim)[1])}</th><th class="num">Gasto</th><th class="num">% gasto</th><th class="num">${esc(d.meta.etiqueta_resultado||'Resultados')}</th><th class="num">% result.</th><th class="num">Acumulado</th><th class="num">CPA</th><th class="num">CTR</th><th class="num">Hook</th><th class="num" title="% de resultados ÷ % de gasto">Eficiencia</th><th>Acción</th>${U.dim==='anuncio'?'<th>Pieza</th>':''}</tr></thead><tbody>
     ${items.map((G,i)=>{const piece=U.dim==='anuncio'?pieceForAd(G.adId,prep.info.get(G.adId)?.nombre):null;
       const acc={'Escalar':'win','Darle más presupuesto':'win','Vigilar CPA':'warn','Recortar':'lose','Dejar en prueba':''}[G.accion];
       return `<tr class="${G.core?'core':''}"><td class="muted">${i+1}</td>
       <td style="min-width:260px;white-space:normal"><div style="display:flex;gap:8px;align-items:center">${piece?.mediaIds?.[0]?`<div style="width:34px;height:44px;flex-shrink:0">${thumbHTML(piece.mediaIds[0])}</div>`:''}<div><b>${esc(G.label)}</b>${U.dim==='anuncio'?`<div class="muted" style="font-size:12px">${esc(prep.info.get(G.adId)?.campana||'')}</div>`:`<div class="muted" style="font-size:12px">${G.ads.size} anuncio${G.ads.size===1?'':'s'}</div>`}</div></div></td>
       <td class="num">${mmBig(G.g)}</td><td class="num">${pc(G.shG,1)}</td><td class="num">${Math.round(G.r)}</td><td class="num">${pc(G.shR,1)}</td>
       <td class="num"><div class="cumbar"><i style="width:${Math.min(100,G.cum*100)}%"></i></div>${pc(G.cum)}</td>
       <td class="num"><b style="color:${G.cpa==null?'inherit':G.cpa<=tope?'var(--bofu)':'var(--red)'}">${mm(G.cpa)}</b></td>
       <td class="num">${pc(G.ctr,2)}</td><td class="num">${pc(G.hook,0)}</td>
       <td class="num">${G.efi==null?'—':`<b style="color:${G.efi>=1?'var(--bofu)':'var(--red)'}">${G.efi.toFixed(2)}×</b>`}</td>
       <td><span class="chip ${acc}">${G.accion}</span></td>
       ${U.dim==='anuncio'?`<td><label class="visually-hidden" for="lk-${i}">Vincular pieza</label><select id="lk-${i}" class="fsel" data-link="${esc(G.adId)}" style="max-width:150px"><option value="">Vincular…</option>${mine(S.pieces).map(p=>`<option value="${p.id}" ${piece?.id===p.id?'selected':''}>${esc(p.code)} · ${esc(p.title.slice(0,24))}</option>`).join('')}</select></td>`:''}</tr>`;}).join('')}
     </tbody></table></section>`;
  $('#aimp').onclick=openImport;
  document.querySelectorAll('#ap button').forEach(b=>b.onclick=()=>{U.dias=+b.dataset.n;render();});
  document.querySelectorAll('#ao button').forEach(b=>b.onclick=()=>{U.orden=b.dataset.k;render();});
  $('#adim').onchange=e=>{U.dim=e.target.value;render();};
  document.querySelectorAll('[data-link]').forEach(s=>s.onchange=()=>{const ad=s.dataset.link;mine(S.pieces).forEach(p=>{p.adIds=(p.adIds||[]).filter(x=>x!==ad);});if(s.value){const p=byId(S.pieces,s.value);p.adIds=[...(p.adIds||[]),ad];}save();render();toast(s.value?'Anuncio vinculado':'Vínculo quitado');});
}
function kpi(l,v,delta,invert){const txt=delta&&delta.includes('class="delta')?`${delta} vs periodo anterior`:delta;return `<div class="panel kpi"><span>${l}</span><b>${v}</b>${delta?`<em class="${invert?'inv':''}">${txt}</em>`:''}</div>`;}
function paretoSVG(items,key,restV,T,tope){
  if(!items.length)return '<div class="empty">Sin datos en este periodo.</div>';
  const W=860,H=280,pl=44,pr=40,pt=14,pb=34; const all=[...items]; if(restV>0)all.push({label:'Resto',[key]:restV,rest:true});
  const n=all.length, bw=(W-pl-pr)/n, max=Math.max(...all.map(x=>x[key]))||1;
  let cum=0; const pts=all.map((x,i)=>{cum+=x[key]/T;return [pl+bw*i+bw/2,pt+(H-pt-pb)*(1-Math.min(1,cum))];});
  const y80=pt+(H-pt-pb)*.2;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Diagrama de Pareto">
    ${[0,.5,1].map(f=>`<line x1="${pl}" x2="${W-pr}" y1="${pt+(H-pt-pb)*(1-f)}" y2="${pt+(H-pt-pb)*(1-f)}" stroke="#eef2f6"/>`).join('')}
    ${all.map((x,i)=>{const h=(H-pt-pb)*(x[key]/max);const bad=!x.rest&&(x.cpa==null?x.g>0:x.cpa>tope);
      return `<rect x="${pl+bw*i+bw*.14}" y="${H-pb-h}" width="${bw*.72}" height="${Math.max(0,h)}" rx="3" fill="${x.rest?'#e2e8f0':x.core?'#0d9488':'#cbd5e1'}" ${bad?'stroke="#dc2626" stroke-width="2"':''}><title>${esc(x.label)}: ${key==='g'?mmBig(x[key]):Math.round(x[key])}${x.cpa!=null?' · CPA '+mm(x.cpa):''}</title></rect>
      <text x="${pl+bw*i+bw/2}" y="${H-pb+14}" font-size="10" text-anchor="middle" fill="#64748b">${x.rest?'Resto':i+1}</text>`;}).join('')}
    <line x1="${pl}" x2="${W-pr}" y1="${y80}" y2="${y80}" stroke="#0f172a" stroke-dasharray="4 4" stroke-width="1"/>
    <text x="${W-pr+4}" y="${y80+4}" font-size="11" fill="#0f172a" font-weight="700">80%</text>
    <polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#0f172a" stroke-width="2"/>
    ${pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="#0f172a"/>`).join('')}
    <text x="${pl-8}" y="${pt+4}" font-size="10" text-anchor="end" fill="#64748b">${key==='g'?mmBig(max):Math.round(max)}</text>
    <text x="${pl-8}" y="${H-pb}" font-size="10" text-anchor="end" fill="#64748b">0</text>
  </svg>`;
}
function dailySVG(days,tope){
  const W=420,H=150,pl=8,pr=8,pt=10,pb=18; const n=days.length||1; const bw=(W-pl-pr)/n;
  const maxG=Math.max(1,...days.map(([,v])=>v.g)); const cpas=days.map(([,v])=>v.r?v.g/v.r:null); const maxC=Math.max(tope*1.8,...cpas.filter(Boolean));
  const y=c=>pt+(H-pt-pb)*(1-Math.min(1,c/maxC));
  const line=cpas.map((c,i)=>c==null?null:[pl+bw*i+bw/2,y(c)]).filter(Boolean);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Gasto diario y CPA">
    ${days.map(([,v],i)=>{const h=(H-pt-pb)*(v.g/maxG);return `<rect x="${pl+bw*i+bw*.15}" y="${H-pb-h}" width="${bw*.7}" height="${h}" fill="#e2e8f0"><title>${mmBig(v.g)} · ${Math.round(v.r)} res.</title></rect>`;}).join('')}
    <line x1="${pl}" x2="${W-pr}" y1="${y(tope)}" y2="${y(tope)}" stroke="#059669" stroke-dasharray="4 3"/>
    <polyline points="${line.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#0f172a" stroke-width="1.8"/>
    <text x="${W-pr}" y="${y(tope)-4}" font-size="10" text-anchor="end" fill="#059669">objetivo ${mm(tope)}</text>
    <text x="${pl}" y="${H-4}" font-size="10" fill="#64748b">${MotorFatiga.aFecha(days[0][0]).slice(5)}</text><text x="${W-pr}" y="${H-4}" font-size="10" text-anchor="end" fill="#64748b">${MotorFatiga.aFecha(days[days.length-1][0]).slice(5)}</text>
  </svg><div class="legend" style="margin-top:4px"><span><i style="background:#e2e8f0"></i>Gasto</span><span><i style="background:#0f172a;height:2px"></i>CPA del día</span></div>`;
}

/* ============ FATIGA (motor del predictor) ============ */
const GRUPOS_F=[['ya','Actuar ya','lose'],['semana','Esta semana','warn'],['monitoreo','Bajo monitoreo · rinden, no apagar',''],['revisar','Revisar · no es fatiga',''],['sanos','Sanos','win'],['esperar','Sin datos suficientes','']];
const ETAPA_COL={fatigado:'#dc2626',desarrollo:'#f97316',temprana:'#eab308',sano:'#10b981',sin_datos:'#94a3b8'};
function vFatiga(){
  const ds=dataset(); if(!ds)return emptyData('Fatiga');
  const {d,prep}=ds; const U=UI.fa||(UI.fa={dias:14,campana:'',open:null});
  const meta={...d.meta,metrica_rectora:'cpa',objetivo:objetivoMeta(),locale:'es-PE'};
  let R; try{ R=MotorFatiga.analizar(prep,meta,{dias:U.dias,filtros:{campana:U.campana}}); }catch(e){ $('#body').innerHTML=`<div class="empty">No se pudo analizar: ${esc(e.message)}</div>`; return; }
  const res=R.resumen;
  setTop('Fatiga creativa',`${prod().name} · ${R.rango.desde} a ${R.rango.hasta} vs los ${R.rango.dias} días anteriores · objetivo CPA ${mm(meta.objetivo)}`,`<button class="btn ghost" id="fimp">Actualizar datos</button>`);
  const distG=Object.entries(R.distribucion); const totG=distG.reduce((s,[,v])=>s+v.gasto,0)||1;
  const rowHTML=a=>{
    const piece=pieceForAd(a.id,a.nombre); const pr=a.prediccion;
    const predTxt=!pr?'—':pr.estado==='cruzado'?'Ya cruzó':pr.estado==='proyectado'?`~${pr.dias} días`:pr.estado==='lejano'?'+60 días':'Estable';
    const rend=a.rendimiento.estado; const rc={rinde:'win',limite:'warn',no_rinde:'lose',sin_datos:''}[rend];
    const open=U.open===a.id;
    return `<div class="frow ${open?'open':''}">
      <button class="fmain" data-fopen="${esc(a.id)}" aria-expanded="${open}">
        <div class="fthumb">${piece?.mediaIds?.[0]?thumbHTML(piece.mediaIds[0]):`<div class="thumb" style="height:100%">${ic(a.formato==='video'?'video':'image')}</div>`}</div>
        <div class="fname"><b>${esc(a.nombre)}</b><span>${esc(a.campana)}${a.conjunto?' · '+esc(a.conjunto):''}</span></div>
        <div class="fidx"><div class="bar"><i style="width:${a.indice||0}%;background:${ETAPA_COL[a.etapa]}"></i></div><span><b>${a.indice??'—'}</b> ${esc(MotorFatiga.ETAPAS[a.etapa].nombre)}</span></div>
        <div class="fcol"><span class="chip ${rc}">${esc(MotorFatiga.RENDIMIENTO[rend])}</span><small>CPA ${mm(a.actual.cpa)}</small></div>
        <div class="fcol"><b>${pc(a.actual.ctr,2)}</b><small>${a.deltas.ctr==null?'CTR':`CTR ${MotorFatiga.fmtPct(a.deltas.ctr)}`}</small></div>
        <div class="fcol"><b>${predTxt}</b><small>fatiga</small></div>
        <div class="fact">${esc(a.accion.texto)}</div>
      </button>
      ${open?fDetail(a,piece,prep,R):''}
    </div>`;
  };
  $('#body').innerHTML=`
   <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
     <div class="seg" id="fp">${PERIODS.map(n=>`<button data-n="${n}" class="${U.dias===n?'on':''}">${n} días</button>`).join('')}</div>
     <label class="visually-hidden" for="fc">Campaña</label><select id="fc" class="fsel" style="height:30px;max-width:320px"><option value="">Todas las campañas</option>${prep.campanas.map(c=>`<option ${c===U.campana?'selected':''}>${esc(c)}</option>`).join('')}</select>
     ${R.coberturaPrevia<.8?`<span class="chip warn">Hay pocos datos del periodo anterior: la comparación es parcial</span>`:''}
   </div>
   <div class="kpis">
     ${kpi('Gasto en anuncios fatigados',`<span style="color:${res.pctGastoEnFatiga>=.3?'var(--red)':'inherit'}">${pc(res.pctGastoEnFatiga)}</span>`,'')}
     ${kpi('Actuar ya',res.accionYa,'')}
     ${kpi('Creativos a producir',`${res.reemplazos} + ${res.variantes}`,'<span>relevos + variantes de ganadores</span>')}
     ${kpi('CPM de la cuenta',MotorFatiga.fmtPct(R.mercado.dCpm),R.mercado.caro?'<span class="delta up">subasta más cara</span>':'')}
     ${kpi('Analizados',`${res.analizados} de ${res.totalAnuncios}`,'')}
   </div>
   <div class="an-grid" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)">
     <section class="panel" style="padding:16px"><h2 class="h2">Gasto por estado de fatiga</h2>
       <div class="stack">${distG.filter(([,v])=>v.gasto>0).map(([k,v])=>`<i style="width:${v.gasto/totG*100}%;background:${ETAPA_COL[k]}" title="${esc(MotorFatiga.ETAPAS[k].nombre)} ${pc(v.gasto/totG)}"></i>`).join('')}</div>
       <div class="legend">${distG.map(([k,v])=>`<span><i style="background:${ETAPA_COL[k]}"></i>${esc(MotorFatiga.ETAPAS[k].nombre)} · ${v.n} · ${pc(v.gasto/totG)}</span>`).join('')}</div></section>
     <section class="panel" style="padding:16px"><h2 class="h2">Alcance y presupuesto</h2><p style="margin:6px 0 0;line-height:1.5">${esc(R.cuenta.veredictoAlcance)}</p>
       ${res.proximos.length?`<p class="hint" style="margin:10px 0 0">Próximos en fatigarse: ${res.proximos.slice(0,3).map(a=>`${esc(a.nombre)} (~${a.prediccion.dias} d)`).join(', ')}.</p>`:''}</section>
   </div>
   ${GRUPOS_F.map(([g,label,cls])=>R.grupos[g].length?`<section class="fgroup"><h2 class="h2"><span class="chip ${cls}">${R.grupos[g].length}</span> ${label}</h2>${R.grupos[g].map(rowHTML).join('')}</section>`:'').join('')}
   <p class="hint">Método del predictor de fatiga: CTR contra su propio pico, frecuencia, alcance por gasto y CPC descontando mercado, y hook rate. Un anuncio que rinde no se apaga: se le prepara relevo.</p>`;
  $('#fimp').onclick=openImport;
  document.querySelectorAll('#fp button').forEach(b=>b.onclick=()=>{U.dias=+b.dataset.n;U.open=null;render();});
  $('#fc').onchange=e=>{U.campana=e.target.value;U.open=null;render();};
  document.querySelectorAll('[data-fopen]').forEach(b=>b.onclick=()=>{U.open=U.open===b.dataset.fopen?null:b.dataset.fopen;render();});
  document.querySelectorAll('[data-relevo]').forEach(b=>b.onclick=e=>{e.stopPropagation();const a=R.anuncios.find(x=>x.id===b.dataset.relevo);const base=pieceForAd(a.id,a.nombre);
    const p=newPiece({title:`Relevo de ${a.nombre}`.slice(0,70),status:'idea',angleId:base?.angleId||'',conceptId:base?.conceptId||'',stage:base?.stage||'',format:base?.format||(a.formato==='video'?'video':'imagen'),hookId:base?.hookId||'',refId:base?.refId});
    if(base?.script?.blocks?.length)p.script={blocks:base.script.blocks.map(x=>({...x,id:uid('b'),voz:'',texto:'',visual:`Variar respecto a ${base.code}: ${x.voz||x.texto||x.visual||''}`.slice(0,140)}))};
    save();openModal(p.id,'guion');toast('Relevo creado en Ideas');});
  document.querySelectorAll('[data-flink]').forEach(s=>s.onchange=()=>{const ad=s.dataset.flink;mine(S.pieces).forEach(p=>{p.adIds=(p.adIds||[]).filter(x=>x!==ad);});if(s.value){const p=byId(S.pieces,s.value);p.adIds=[...(p.adIds||[]),ad];}save();render();});
}
function fDetail(a,piece,prep,R){
  const rows=prep.porAnuncio.get(a.id)||[]; const hasta=prep.maxD; const from=hasta-44;
  const byD=new Map(rows.map(r=>[r._d,r])); const days=[];for(let x=from;x<=hasta;x++)days.push(x);
  const raw=days.map(x=>{const r=byD.get(x);return r&&r.impresiones>=100?r.clics/r.impresiones:null;});
  const sm=days.map((x,i)=>{let c=0,im=0;for(let j=x-2;j<=x;j++){const r=byD.get(j);if(r){c+=r.clics||0;im+=r.impresiones||0;}}return im>=200?c/im:null;});
  const p=a.prediccion; const vals=[...raw,...sm,p?.pico,p?.umbral].filter(v=>v!=null); const max=Math.max(0.001,...vals)*1.15;
  const W=640,H=180,pl=38,pr=10,pt=10,pb=20; const X=i=>pl+(W-pl-pr)*i/(days.length-1), Y=v=>pt+(H-pt-pb)*(1-v/max);
  const path=arr=>{let s='',pen=false;arr.forEach((v,i)=>{if(v==null){pen=false;return;}s+=(pen?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)+' ';pen=true;});return s;};
  let proj='';
  if(p&&p.ajuste&&(p.estado==='proyectado'||p.estado==='lejano')){const end=Math.min(hasta+(p.dias||14),hasta+30);const xE=pl+(W-pl-pr)*((end-from)/(days.length-1));const clip=Math.min(W-pr,xE);
    const v0=Math.max(0,p.ajuste.m*hasta+p.ajuste.b),v1=Math.max(0,p.ajuste.m*end+p.ajuste.b); const yE=Y(v0+(v1-v0)*((clip-X(days.length-1))/Math.max(1,xE-X(days.length-1))));
    proj=`<line x1="${X(days.length-1)}" y1="${Y(v0)}" x2="${clip}" y2="${yE}" stroke="#f97316" stroke-width="2" stroke-dasharray="6 4"/>`;}
  const ap=Object.entries(a.aportes||{}).filter(([,v])=>v>0).sort((x,y)=>y[1]-x[1]); const apMax=Math.max(1,...ap.map(([,v])=>v));
  const NOMS={desgaste:'CTR vs su pico',ctr:'CTR vs antes',tendencia:'Tendencia del CTR',frecuencia:'Frecuencia',alcance:'Alcance por gasto',cpc:'CPC',hook:'Hook rate'};
  const acct=S.settings.adAccount||''; const amUrl=/^\d+$/.test(a.id)&&acct?`https://adsmanager.facebook.com/adsmanager/manage/ads?act=${acct}&selected_ad_ids=${a.id}`:'';
  return `<div class="fdet">
    <div>
      <div class="section-t">CTR diario (últimos 45 días)</div>
      <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="CTR diario y proyección">
        ${p?`<line x1="${pl}" x2="${W-pr}" y1="${Y(p.pico)}" y2="${Y(p.pico)}" stroke="#059669" stroke-dasharray="4 4"/><text x="${pl+4}" y="${Y(p.pico)-4}" font-size="10" fill="#059669">pico ${pc(p.pico,2)}</text>
        <line x1="${pl}" x2="${W-pr}" y1="${Y(p.umbral)}" y2="${Y(p.umbral)}" stroke="#dc2626" stroke-dasharray="4 4"/><text x="${pl+4}" y="${Y(p.umbral)+12}" font-size="10" fill="#dc2626">umbral de fatiga ${pc(p.umbral,2)}</text>`:''}
        ${raw.map((v,i)=>v==null?'':`<circle cx="${X(i)}" cy="${Y(v)}" r="2" fill="#93c5fd"/>`).join('')}
        <path d="${path(sm)}" fill="none" stroke="#2563eb" stroke-width="2.2"/>${proj}
        <text x="${pl-6}" y="${pt+8}" font-size="10" text-anchor="end" fill="#64748b">${pc(max,1)}</text><text x="${pl-6}" y="${H-pb}" font-size="10" text-anchor="end" fill="#64748b">0</text>
        <text x="${pl}" y="${H-4}" font-size="10" fill="#64748b">${MotorFatiga.aFecha(from).slice(5)}</text><text x="${W-pr}" y="${H-4}" font-size="10" text-anchor="end" fill="#64748b">${MotorFatiga.aFecha(hasta).slice(5)}</text>
      </svg>
      <div class="legend"><span><i style="background:#93c5fd"></i>CTR del día</span><span><i style="background:#2563eb;height:2px"></i>Suavizado 3 días</span>${proj?'<span><i style="background:#f97316;height:2px"></i>Proyección</span>':''}</div>
      <div class="grid3" style="margin-top:10px;font-size:13px">
        <div><span class="muted">Gasto</span><br><b>${mm(a.actual.gasto)}</b> ${dpc(a.deltas.gasto)}</div>
        <div><span class="muted">Frecuencia</span><br><b>${a.actual.frecuencia?.toFixed(2)??'—'}</b> ${dpc(a.deltas.frecuencia)}</div>
        <div><span class="muted">CPC</span><br><b>${mm(a.actual.cpc)}</b> ${dpc(a.deltas.cpc)}</div>
        <div><span class="muted">CPM</span><br><b>${mm(a.actual.cpm)}</b> ${dpc(a.deltas.cpm)}</div>
        <div><span class="muted">Hook rate</span><br><b>${pc(a.actual.hook,0)}</b> ${dpc(a.deltas.hook)}</div>
        <div><span class="muted">Días de vida</span><br><b>${a.diasVida??'—'}</b></div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><div class="section-t">Por qué</div><ul class="whys">${a.razones.length?a.razones.map(r=>`<li>${esc(r.texto)}</li>`).join(''):`<li>${esc(a.etapa==='sin_datos'?(a.motivoSinDatos||'Muestra insuficiente.'):'Sin señales de desgaste relevantes.')}</li>`}${(a.avisos||[]).map(v=>`<li class="aviso">${esc(v.texto)}</li>`).join('')}</ul></div>
      ${ap.length?`<div><div class="section-t">Qué empuja el índice</div>${ap.map(([k,v])=>`<div class="apbar"><span>${NOMS[k]||k}</span><div><i style="width:${v/apMax*100}%"></i></div><b>${Math.round(v)}</b></div>`).join('')}</div>`:''}
      <div class="field"><label for="fl-${esc(a.id)}">Pieza del Studio</label><select id="fl-${esc(a.id)}" data-flink="${esc(a.id)}"><option value="">Sin vincular</option>${mine(S.pieces).map(pp=>`<option value="${pp.id}" ${piece?.id===pp.id?'selected':''}>${esc(pp.code)} · ${esc(pp.title.slice(0,30))}</option>`).join('')}</select></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${['ya','semana','monitoreo'].includes(a.accion.grupo)?`<button class="btn sm" data-relevo="${esc(a.id)}">Crear relevo en Ideas</button>`:''}${amUrl?`<a class="btn ghost sm" href="${amUrl}" target="_blank" rel="noopener">Abrir en Ads Manager</a>`:''}</div>
    </div>
  </div>`;
}

/* ============ FORMULARIOS GENÉRICOS ============ */
function formModal(title,inner,onSave,onDelete){
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
function openSettings(){
  formModal('Ajustes',`
    <div class="grid3">
     <div class="field"><label for="stu">Tope CPA (USD)</label><input id="stu" type="number" step="0.1" value="${S.settings.topeUSD}"></div>
     <div class="field"><label for="stc">Tipo de cambio</label><input id="stc" type="number" step="0.01" value="${S.settings.tc}"></div>
     <div class="field"><label for="stm">Muestra mínima</label><input id="stm" type="number" step="1" value="${S.settings.muestra}"></div>
    </div>
    <div class="field"><label for="sta">ID de la cuenta publicitaria (para abrir anuncios en Ads Manager)</label><input id="sta" value="${esc(S.settings.adAccount||'')}" placeholder="Ej. 338354625956825"></div>
    <div class="field"><label class="ck" for="stauto"><input type="checkbox" id="stauto" ${S.settings.autoExtraer===false?'':'checked'}> Extraer el guion solo, apenas llega un video o una imagen</label></div>
    <div class="field"><label for="stw">Modelo para transcribir voz</label><select id="stw">${[['tiny','Rápido (menos preciso, ~40 MB)'],['base','Equilibrado (~80 MB)'],['small','Preciso (más lento, ~250 MB)']].map(([k,l])=>`<option value="${k}" ${k===(S.settings.whisper||'base')?'selected':''}>${l}</option>`).join('')}</select></div><div class="hint">Una pieza pasa a Resultado cuando llega a la muestra mínima de confirmados. Gana si su CPA real es igual o menor al tope.</div>`,
    ()=>{S.settings.topeUSD=+$('#stu').value||5;S.settings.tc=+$('#stc').value||3.7;S.settings.muestra=Math.max(1,+$('#stm').value||10);S.settings.whisper=$('#stw').value;S.settings.autoExtraer=$('#stauto').checked;S.settings.adAccount=$('#sta').value.trim();PREP_CACHE.clear();save();render();});
}

/* ============ EXPORTAR / IMPORTAR ============ */
async function exportData(){
  const data=JSON.parse(JSON.stringify(S)); data.thumbs={};
  const ids=new Set([...S.refs.map(r=>r.mediaId),...S.pieces.flatMap(p=>p.mediaIds)].filter(Boolean));
  for(const id of ids){const t=await thumbOf(id);if(t)data.thumbs[id]=t;}
  const blob=new Blob([JSON.stringify(data)],{type:'application/json'});const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='studio-de-ads-'+new Date().toISOString().slice(0,10)+'.json';a.click();
  toast('Datos exportados (sin los videos originales)');
}
$('#importpick').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const d=JSON.parse(await f.text());if(!d.pieces||!d.products)throw new Error('Archivo no válido');
    if(!confirm('Esto reemplaza los datos actuales. ¿Continuar?'))return;
    for(const [id,t] of Object.entries(d.thumbs||{})){const ex=await DB.get('media',id);if(!ex)await DB.put('media',{id,blob:null,type:'',kind:t.kind,name:'importado',thumb:t.thumb,duration:t.duration});thumbCache[id]=t;}
    delete d.thumbs;S=d;save();render();toast('Datos importados');
  }catch(err){toast('No se pudo importar: '+err.message);}
});

/* ============ COMPETENCIA ============
 * El Studio guarda a quién vigilar; Claude consulta la Biblioteca de anuncios
 * de Meta y deja aquí los anuncios activos de cada marca (server/competencia.js).
 * Lo que se ve: cuántos tienen activos y desde cuándo, cuáles llevan más tiempo
 * (sus ganadores) y qué ángulos, formatos y ofertas repiten.
 */
let COMP=null, compCargando=false;
const compLista=()=>{ if(!S.competidores)S.competidores=[]; return S.competidores; };
const compId=c=>c.id||(c.nombre||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'sin-nombre';
const dias=f=>{const t=Date.parse((f||'')+'T00:00:00');return isNaN(t)?null:Math.max(0,Math.floor((Date.now()-t)/86400000));};
function haceTexto(iso){
  const t=Date.parse(iso||''); if(isNaN(t))return 'nunca';
  const m=Math.round((Date.now()-t)/60000);
  if(m<2)return 'recién'; if(m<60)return `hace ${m} min`;
  const h=Math.round(m/60); if(h<24)return `hace ${h} h`;
  const d=Math.round(h/24); return d===1?'ayer':`hace ${d} días`;
}
async function traerCompetencia(){
  if(compCargando)return COMP; compCargando=true;
  try{ const r=await fetch('/api/competencia',{credentials:'same-origin'}); if(r.ok)COMP=await r.json(); }
  catch(e){ console.warn('competencia',e); }
  finally{ compCargando=false; }
  return COMP;
}
/* Página de la Biblioteca de anuncios: se acepta el ID o la URL con view_all_page_id. */
function pageIdDe(txt){
  const t=String(txt||'').trim(); if(!t)return '';
  const m=t.match(/view_all_page_id=([0-9]+)/)||t.match(/[?&]id=([0-9]+)/)||t.match(/^([0-9]{6,})$/);
  return m?m[1]:'';
}
const compDatos=c=>COMP?.competencia?.[compId(c)]||null;
function compResumen(d){
  if(!d?.ads?.length)return null;
  const edades=d.ads.map(a=>dias(a.inicio)).filter(n=>n!=null);
  const prom=edades.length?Math.round(edades.reduce((s,n)=>s+n,0)/edades.length):null;
  const h=d.historico||[];
  const previo=h.length>1?h[h.length-2]:null;
  return {activos:d.ads.length,prom,viejo:edades.length?Math.max(...edades):null,
    nuevos:h[h.length-1]?.nuevos||0,cambio:previo?d.ads.length-previo.total:null};
}
/* Ángulos, formatos y ofertas: se leen de lo que ya guardaste de esa marca. */
const OFERTAS=[[/env[ií]o gratis/i,'Envío gratis'],[/contra ?entrega/i,'Pago contra entrega'],[/2 ?x ?1|2x1/i,'2x1'],
  [/[0-9]{1,2} ?% ?(de )?(dcto|descuento|off)/i,'Descuento %'],[/[uú]ltimas unidades|stock limitado/i,'Urgencia por stock'],
  [/garant[ií]a/i,'Garantía'],[/gratis/i,'Algo gratis'],[/s\/ ?[0-9]+|[0-9]+ ?soles/i,'Precio a la vista'],
  [/whatsapp|wasap/i,'Cierra por WhatsApp'],[/delivery|env[ií]o a todo/i,'Envío a todo el país']];
function perfilMarca(nombre){
  const clave=normTxt(nombre);
  const refs=S.refs.map(ensureRef).filter(r=>clave&&normTxt(r.brand||'').includes(clave));
  if(!refs.length)return {refs:[],formatos:[],angulos:[],etapas:[],ofertas:[],hooks:[]};
  const cuenta=(arr)=>{const m=new Map();arr.filter(Boolean).forEach(x=>m.set(x,(m.get(x)||0)+1));
    return [...m.entries()].sort((a,b)=>b[1]-a[1]).map(([k,n])=>({k,n}));};
  const texto=refs.map(r=>[r.adText,(r.extract.blocks||[]).map(b=>`${b.voz||''} ${b.texto||''}`).join(' ')].join(' ')).join(' ');
  const ofertas=OFERTAS.filter(([re])=>re.test(texto)).map(([,l])=>l);
  const hooks=refs.map(r=>(r.extract.blocks||[])[0]).filter(Boolean).map(b=>(b.voz||b.texto||'').trim()).filter(t=>t.length>12).slice(0,6);
  return {refs,
    formatos:cuenta(refs.map(r=>FORMATS.find(f=>f[0]===r.format)?.[1])),
    angulos:cuenta(refs.map(r=>byId(S.angles,r.angleId)?.name)),
    etapas:cuenta(refs.map(r=>r.stage)),
    ofertas,hooks};
}
function vCompetencia(){
  const lista=compLista();
  setTop('Competencia','Qué está corriendo la competencia ahora mismo y desde cuándo',
    `<button class="btn ghost" id="crefresh">${ic('search','sm')}Actualizar</button><button class="btn" id="cadd">${ic('plus','sm')}Agregar competidor</button>`);
  const sinAgente=COMP&&COMP.agente===false;
  $('#body').innerHTML=`
    ${sinAgente?`<div class="panel" style="padding:14px 16px;margin-bottom:14px;background:var(--amber-bg);border-color:#fde68a;color:var(--amber)">
      Falta <b>SYNC_TOKEN</b> en el servidor: sin esa clave Claude no puede dejar aquí los anuncios activos.</div>`:''}
    ${lista.length?`<div class="cgrid">${lista.map(compCard).join('')}</div>
      ${COMP?'':'<div class="hint" style="margin-top:12px">Cargando la última revisión…</div>'}
      <div class="panel" style="padding:16px;margin-top:16px">
        <div class="section-t">Cómo se actualiza</div>
        <p class="hint" style="margin:6px 0 10px">Dile a Claude <b>revisa la competencia</b> (o usa <code>/competencia</code>). Él consulta la Biblioteca de anuncios de Meta y deja aquí los anuncios activos de cada marca. Para quedarte con uno completo —video, copy y guion— ábrelo y guárdalo con Nova Swipe.</p>
        <button class="btn ghost sm" id="ccopy">${ic('copy','sm')}Copiar la instrucción</button>
      </div>`
    :`<div class="empty" style="text-align:left;display:flex;flex-direction:column;gap:10px;max-width:640px">
        <b style="color:var(--ink)">Todavía no vigilas a nadie</b>
        <span>Agrega las marcas con las que compites. Claude revisa su Biblioteca de anuncios y te dice cuántos anuncios tienen activos, desde cuándo corren y cuáles son sus ganadores (los que llevan más tiempo sin apagarse).</span>
        <span class="hint">Necesitas el ID de la página o el enlace de su Biblioteca de anuncios. Si no lo tienes, con el nombre de la marca y una palabra clave del producto también funciona.</span>
        <button class="btn" id="cadd2" style="align-self:flex-start">${ic('plus','sm')}Agregar competidor</button>
      </div>`}`;
  $('#cadd').onclick=()=>compForm();
  if($('#cadd2'))$('#cadd2').onclick=()=>compForm();
  $('#crefresh').onclick=async()=>{await traerCompetencia();render();toast(COMP?.competencia&&Object.keys(COMP.competencia).length?'Datos actualizados':'Todavía no hay revisiones');};
  if($('#ccopy'))$('#ccopy').onclick=async()=>{toast(await copyText('Revisa la competencia en NOVA Studio: trae los anuncios activos de cada marca configurada y envíalos con la skill /competencia.')?'Instrucción copiada':'No se pudo copiar');};
  document.querySelectorAll('[data-comp]').forEach(b=>b.onclick=()=>openComp(b.dataset.comp));
  document.querySelectorAll('[data-compedit]').forEach(b=>b.onclick=e=>{e.stopPropagation();compForm(byId(compLista(),b.dataset.compedit));});
  if(!COMP)traerCompetencia().then(()=>{if(UI.view==='competencia')render();});
}
function compCard(c){
  const d=compDatos(c),r=compResumen(d);
  const perfil=perfilMarca(c.nombre);
  return `<div class="ccard" data-comp="${c.id}" tabindex="0" role="button" aria-label="Ver ${esc(c.nombre)}">
    <div class="ch"><b>${esc(c.nombre)}</b><span class="chip">${esc(c.pais||'PE')}</span>
      <button class="btn ghost sm" data-compedit="${c.id}" aria-label="Editar ${esc(c.nombre)}">${ic('concept','sm')}</button></div>
    ${r?`<div class="cnum"><b>${r.activos}</b><span>anuncios activos</span>
        ${r.cambio!=null&&r.cambio!==0?`<span class="chip ${r.cambio>0?'warn':'win'}">${r.cambio>0?'+':''}${r.cambio} vs. la revisión anterior</span>`:''}</div>
      <div class="cmini">
        <div><b>${r.prom!=null?r.prom:'—'}</b><span>días de antigüedad media</span></div>
        <div><b>${r.viejo!=null?r.viejo:'—'}</b><span>días el más viejo</span></div>
        <div><b>${perfil.refs.length}</b><span>guardados en Biblioteca</span></div>
      </div>
      <div class="hint">Revisado ${haceTexto(d.revisado)}</div>`
    :`<div class="cnum vacio"><b>—</b><span>sin revisar todavía</span></div>
      <div class="hint">Pídele a Claude que revise la competencia.</div>`}
  </div>`;
}
function compForm(c){
  const nuevo=!c;
  c=c||{id:'',nombre:'',pageIds:[],terminos:'',pais:'PE',productId:PID(),notas:''};
  formModal(nuevo?'Agregar competidor':'Editar competidor',`
    <div class="field"><label for="cfn">Marca o tienda</label><input id="cfn" value="${esc(c.nombre)}" placeholder="Ej. Ireca Shop"></div>
    <div class="field"><label for="cfp">Página en la Biblioteca de anuncios</label><input id="cfp" value="${esc((c.pageIds||[]).join(', '))}" placeholder="Pega el enlace de su Biblioteca o el ID de la página">
      <span class="hint">Abre su Biblioteca de anuncios en Facebook y pega aquí la dirección. Puedes poner varias separadas por coma.</span></div>
    <div class="field"><label for="cft">Palabras clave del producto</label><input id="cft" value="${esc(c.terminos||'')}" placeholder="Ej. rodillera artemisa">
      <span class="hint">Se usan para encontrar sus anuncios si no tienes el ID de la página.</span></div>
    <div class="grid2">
      <div class="field"><label for="cfpa">País</label><input id="cfpa" value="${esc(c.pais||'PE')}" maxlength="2" placeholder="PE"></div>
      <div class="field"><label for="cfpr">Producto tuyo con el que compite</label><select id="cfpr">${opt(S.products,c.productId||PID())}</select></div>
    </div>
    <div class="field"><label for="cfnt">Notas</label><textarea id="cfnt" placeholder="Qué miras de esta marca">${esc(c.notas||'')}</textarea></div>`,
    ()=>{
      const nombre=$('#cfn').value.trim();
      if(!nombre){toast('Ponle nombre a la marca');return false;}
      const paginas=$('#cfp').value.split(',').map(pageIdDe).filter(Boolean);
      const datos={nombre,pageIds:paginas,terminos:$('#cft').value.trim(),
        pais:($('#cfpa').value.trim().toUpperCase()||'PE').slice(0,2),productId:$('#cfpr').value,notas:$('#cfnt').value.trim()};
      if(nuevo){ const id=compId(datos); if(compLista().some(x=>x.id===id)){toast('Ya vigilas esa marca');return false;}
        compLista().push({id,...datos,creado:Date.now()}); toast('Competidor agregado: pídele a Claude que revise'); }
      else Object.assign(c,datos);
      save();render();
    },
    nuevo?null:()=>{
      if(!confirm(`¿Dejar de vigilar a ${c.nombre}?`))return false;
      S.competidores=compLista().filter(x=>x.id!==c.id);
      fetch(`/api/competencia/${encodeURIComponent(c.id)}`,{method:'DELETE',credentials:'same-origin'}).catch(()=>{});
      if(COMP?.competencia)delete COMP.competencia[c.id];
      save();render();toast('Competidor eliminado');
    });
}
function openComp(id){
  const c=byId(compLista(),id); if(!c)return;
  const d=compDatos(c),perfil=perfilMarca(c.nombre);
  const ads=[...(d?.ads||[])].sort((a,b)=>(dias(b.inicio)??-1)-(dias(a.inicio)??-1));
  const guardados=new Set(S.refs.map(r=>r.adId).filter(Boolean));
  const fila=a=>{const n=dias(a.inicio),ya=guardados.has(a.adId);
    return `<tr><td><b style="font-size:15px">${n!=null?n:'—'}</b> <span class="muted">días</span></td>
      <td>${a.inicio?esc(a.inicio):'<span class="muted">sin fecha</span>'}</td>
      <td style="min-width:200px;white-space:normal">${esc(a.titulo||'—')}${a.pagina&&normTxt(a.pagina)!==normTxt(c.nombre)?`<div class="muted" style="font-size:12px">${esc(a.pagina)}</div>`:''}</td>
      <td style="font-family:ui-monospace,Menlo,monospace;font-size:12px">${esc(a.adId)}</td>
      <td>${ya?'<span class="chip win">Ya guardado</span>':''}</td>
      <td style="text-align:right"><a class="btn ghost sm" href="${esc(a.enlace)}" target="_blank" rel="noopener">${ya?'Abrir':'Abrir y guardar'}</a></td></tr>`;};
  const chips=arr=>arr.slice(0,6).map(x=>`<span class="chip">${esc(x.k)} · ${x.n}</span>`).join('')||'<span class="muted">—</span>';
  const ov=document.createElement('div');ov.className='ov';ov.id='cov';
  ov.innerHTML=`<div class="modal" style="max-width:1080px" role="dialog" aria-modal="true" aria-label="${esc(c.nombre)}">
    <div class="mh"><div style="min-width:0"><b>${esc(c.nombre)}</b>
      <div class="muted" style="font-size:13px">${d?`${ads.length} anuncios activos · revisado ${haceTexto(d.revisado)}`:'Sin revisar todavía'}${c.pais?' · '+esc(c.pais):''}</div></div>
      <button class="btn ghost sm" id="cx" style="margin-left:auto" aria-label="Cerrar">${ic('x','sm')}</button></div>
    <div style="padding:16px 18px;max-height:76vh;overflow-y:auto;display:flex;flex-direction:column;gap:14px">
      ${ads.length?`<div class="panel" style="padding:14px 16px">
        <div class="section-t">Sus ganadores: los que llevan más tiempo sin apagarse</div>
        <p class="hint" style="margin:6px 0 0">Un anuncio que lleva semanas activo casi siempre es el que les está vendiendo. Ábrelo y guárdalo con Nova Swipe para extraerle el guion.</p>
        <div style="overflow:auto;margin-top:10px"><table><thead><tr><th>Activo</th><th>Desde</th><th>Título del botón</th><th>ID</th><th></th><th></th></tr></thead>
          <tbody>${ads.map(fila).join('')}</tbody></table></div></div>`
      :`<div class="empty" style="text-align:left"><b style="color:var(--ink)">Todavía no hay anuncios</b><br><span>Pídele a Claude: <b>revisa la competencia</b>.</span></div>`}
      <div class="panel" style="padding:14px 16px">
        <div class="section-t">Ángulos, formatos y ofertas que usan</div>
        ${perfil.refs.length?`<div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
          <div><span class="lbl">Formatos</span><div class="chips">${chips(perfil.formatos)}</div></div>
          <div><span class="lbl">Ángulos</span><div class="chips">${chips(perfil.angulos)}</div></div>
          <div><span class="lbl">Etapas del embudo</span><div class="chips">${chips(perfil.etapas)}</div></div>
          <div><span class="lbl">Ofertas que repiten</span><div class="chips">${perfil.ofertas.map(o=>`<span class="chip ang">${esc(o)}</span>`).join('')||'<span class="muted">—</span>'}</div></div>
          ${perfil.hooks.length?`<div><span class="lbl">Sus hooks</span><ul class="whys" style="margin:6px 0 0;padding-left:18px">${perfil.hooks.map(h=>`<li>“${esc(h)}”</li>`).join('')}</ul></div>`:''}
        </div>`:`<p class="hint" style="margin:8px 0 0">Esto se arma con los anuncios de ${esc(c.nombre)} que tengas en la Biblioteca. Guarda dos o tres con Nova Swipe y aquí verás qué ángulos, formatos y ofertas repiten.</p>`}
      </div>
      ${c.notas?`<div class="panel" style="padding:14px 16px"><div class="section-t">Tus notas</div><p class="hint" style="margin:6px 0 0;white-space:pre-line">${esc(c.notas)}</p></div>`:''}
    </div></div>`;
  document.body.appendChild(ov);
  const cerrar=()=>ov.remove();
  ov.querySelector('#cx').onclick=cerrar;
  ov.addEventListener('mousedown',e=>{if(e.target===ov)cerrar();});
}
/* ============ ARRANQUE ============ */
(async()=>{
  let lecturaFallida=false;
  try{await DB.open();S=await DB.get('kv','state');}catch(e){console.warn(e);lecturaFallida=true;}
  if(lecturaFallida){S=seed();toast('No se pudo leer la base: recarga la página. Los cambios no se guardarán.');}
  else if(!S){ try{S=await migrarLegado(seed,thumbCache);}catch(e){console.warn('Migración',e);S=null;}
    if(S)toast(`Datos anteriores migrados: ${S.migradoDesde.guiones} guiones y ${S.migradoDesde.banco} del banco`);
    else S=seed();
    save(); }
  S.pieces.forEach(p=>{ensureScript(p);});
  S.refs.forEach(ensureRef); if(!S.settings.whisper)S.settings.whisper='base'; if(!S.metaData)S.metaData={}; if(!S.ideas)S.ideas=[]; if(S.settings.adAccount==null)S.settings.adAccount='338354625956825'; S.pieces.forEach(p=>{if(!p.adIds)p.adIds=[];});
  const pend=lecturaFallida?null:await fatigaPendiente(S);
  if(pend){ try{importDatos(pend.datos,pend.label);S.settings.fatigaSync=pend.marca;save();toast('Datos de Meta actualizados');}catch(e){console.warn(e);} }
  const oldRender=render;
  setTimeout(traerBandeja,500);
  // Lo que quedo sin guion (llego con la pestana cerrada o fallo a medias) se extrae solo.
  const recientes=Date.now()-7*86400000;
  setTimeout(()=>{S.refs.filter(r=>r.mediaId&&!r.extract.status&&(r.swipeId||(r.created||0)>recientes)).slice(0,5).forEach(autoExtraer);},3000);
  render=function(){ $('#body').style.overflow=''; oldRender(); };
  render();
})();
