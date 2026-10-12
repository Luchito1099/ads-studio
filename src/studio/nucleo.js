import { DB } from "./persistencia.js";

/**
 * Núcleo del Studio: el estado, el guardado y lo que usan todas las pantallas.
 *
 * Aquí vive `S`, el objeto con todo lo del usuario, la Biblioteca incluida. Se
 * guarda entero en una sola clave, así que nadie lo reemplaza salvo el arranque y
 * la restauración de un respaldo (setS); el resto lo modifica por dentro.
 */

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
 updown:'<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>',
 pen:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
 flask:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/>',
 trophy:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/>',
 cal:'<path d="M4 4h16v16H4zM4 9h16M9 4v16"/>',
 link:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'
};
export const ic=(n,cls='')=>`<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const uid=p=>p+'_'+Math.random().toString(36).slice(2,9);
export const $=s=>document.querySelector(s);

/* ============ BASE DE DATOS ============ */
// Persistencia en el servidor: ver persistencia.js (misma interfaz que el IndexedDB del prototipo).

/* ============ ESTADO ============ */
export const STAGES=['TOFU','MOFU','BOFU'];
export const STAGE_INFO={TOFU:['Descubrimiento','No te conocen. Detener el scroll y mostrar el problema.'],MOFU:['Consideración','Ya te vieron. Demostrar y comparar.'],BOFU:['Decisión','Casi compran. Resolver objeciones y dar la oferta.']};
export const STATUS=[['idea','Idea','#8b5cf6','Nace de una referencia'],['guion','Guion','#94a3b8','Escrito, por aprobar'],['produccion','Producción','#0ea5e9','Voz, edición o diseño'],['lanzado','Lanzado','#10b981','En Meta, sumando datos'],['testing','Testing','#f59e0b','Juntando muestra'],['resultado','Resultado','#0f172a','Se decide solo por CPA real']];
export const FORMATS=[['video','Video con voz','video','VID'],['video_texto','Video solo texto','text','TXT'],['imagen','Imagen','image','IMG'],['carrusel','Carrusel','cards','CAR']];
export const HOOK_TYPES=['Hablado','Texto en pantalla','Visual','Primera línea del copy'];

export let S=null; // estado
export let UI={view:'pipeline',selRef:null,refFilter:'todas',stageFilter:'todas',modal:null};
export const thumbCache={};

export function seed(){
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
export function save(){clearTimeout(saveT);saveT=setTimeout(()=>DB.put('kv',S,'state').then(()=>avisoGuardado('')).catch(e=>{avisoGuardado(e.message||'error desconocido');toast('No se pudo guardar: '+e.message);}),150);}
/* Un guardado fallido es grave: lo que agregaste desaparece al recargar. No se
 * puede quedar en un aviso que se desvanece. */
export function avisoGuardado(err){
  const previo=document.getElementById('savefail');
  if(!err){ previo?.remove(); return; }
  const el=previo||document.createElement('div');
  el.id='savefail'; el.className='savefail';
  el.innerHTML=`<div><b>No se guardaron los últimos cambios</b><span>${esc(err)} · si recargas ahora, los pierdes</span></div><button class="btn sm" id="savere">Reintentar</button>`;
  if(!previo)document.body.appendChild(el);
  el.querySelector('#savere').onclick=()=>{ toast('Guardando…'); save(); };
}
export const PID=()=>S.productId;
export const prod=()=>S.products.find(p=>p.id===PID());
export const mine=arr=>arr.filter(x=>x.productId===PID());
export const byId=(arr,id)=>arr.find(x=>x.id===id);
export const tope=()=>S.settings.topeUSD*S.settings.tc;
export const cpa=p=>p.spend&&p.conf?p.spend/p.conf:null;
export const money=v=>v==null||isNaN(v)?'—':'S/'+(Math.round(v*10)/10).toFixed(1);
export function result(p){ if(!(p.status==='testing'||p.status==='lanzado'||p.status==='resultado'))return null;
  const c=cpa(p); if(c==null||(p.conf||0)<S.settings.muestra) return 'TBD';
  return c<=tope()?'Ganador':'Perdedor'; }
export function columnOf(p){ const r=result(p); if((p.status==='testing'||p.status==='lanzado')&&(r==='Ganador'||r==='Perdedor'))return 'resultado'; return p.status; }

export function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),2400);}
export function linkSource(u){ u=String(u||'');
  if(/facebook\.com\/ads\/library/i.test(u))return 'Biblioteca de Meta';
  if(/ads\.tiktok\.com|creativecenter/i.test(u))return 'TikTok Creative Center';
  if(/instagram\.com/i.test(u))return 'Instagram';
  if(/tiktok\.com/i.test(u))return 'TikTok';
  if(/facebook\.com|fb\.watch|fb\.com/i.test(u))return 'Facebook';
  if(/youtube\.com|youtu\.be/i.test(u))return 'YouTube';
  if(/pinterest\.|pin\.it/i.test(u))return 'Pinterest';
  return u?'Otro enlace':'Sin fuente'; }
export function emptyLanes(){return {TOFU:{objetivo:'Ventas → landing',auds:[]},MOFU:{objetivo:'Mensajes → WhatsApp',auds:[]},BOFU:{objetivo:'Mensajes → WhatsApp',auds:[]}};}

export const opt=(arr,sel,empty='—')=>`<option value="">${empty}</option>`+arr.map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${esc(x.name)}</option>`).join('');
export const stageOpt=(sel,empty='Sin etapa')=>`<option value="">${empty}</option>`+STAGES.map(s=>`<option ${s===sel?'selected':''}>${s}</option>`).join('');
export const fmtIcon=f=>{const x=FORMATS.find(a=>a[0]===f)||FORMATS[0];return `<span class="chip" title="${x[1]}" aria-label="${x[1]}">${ic(x[2],'sm')}</span>`;};
export const REF_SOURCES=['Biblioteca de Meta','TikTok Creative Center','Facebook','Instagram','TikTok','YouTube','Pinterest','Tienda de la competencia','Grabación propia','Sin fuente','Otro enlace'];
const SOURCE_LEGADO={'Subido':'Sin fuente','Biblioteca de anuncios':'Biblioteca de Meta','Enlace':'Otro enlace','Propio':'Grabación propia'};
export function ensureRef(r){ if(!r.extract)r.extract={status:'',frames:[],transcript:[],ocr:[],blocks:[],analysis:null}; if(r.rating==null)r.rating=0; if(r.startedAt==null)r.startedAt=''; if(r.versiones==null)r.versiones=0; if(!r.adCopy)r.adCopy={titulo:'',descripcion:'',boton:'',destino:''}; if(!r.format)r.format=r.kind==='image'?'imagen':''; if(r.collection==null)r.collection=''; if(SOURCE_LEGADO[r.source])r.source=SOURCE_LEGADO[r.source]; if(!REF_SOURCES.includes(r.source))r.source=r.link?linkSource(r.link):'Sin fuente'; if(r.fav==null)r.fav=false; return r; }
/* Fechas que llegan de la Biblioteca de Meta: "25 de junio de 2026", "Jun 25, 2026"… */
const MESES3=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
export function fechaISO(txt){
  const t=String(txt||'').trim(); if(!t)return '';
  const iso=t.match(/([0-9]{4})-([0-9]{2})-([0-9]{2})/); if(iso)return iso[0];
  const n=normTxt(t);
  const es=n.match(/([0-9]{1,2}) de ([a-z]+)[a-z ]*?([0-9]{4})/)||n.match(/([0-9]{1,2}) ([a-z]{3,}) ([0-9]{4})/);
  if(es){ const p=es[2].slice(0,3)==='set'?'sep':es[2].slice(0,3); const m=MESES3.indexOf(p);
    if(m>=0)return `${es[3]}-${String(m+1).padStart(2,'0')}-${es[1].padStart(2,'0')}`; }
  const d=new Date(t); return isNaN(d)?'':d.toISOString().slice(0,10);
}
export const diasActivo=r=>{ const f=fechaISO(r.startedAt); if(!f)return null; const d=Math.floor((Date.now()-Date.parse(f+'T00:00:00'))/86400000); return d>=0?d:null; };
export function senalDias(d){
  if(d==null)return null;
  if(d<7)return {tono:'nuevo',texto:`Recién sale: lleva ${d} día${d===1?'':'s'}. Todavía no dice si funciona.`};
  if(d<30)return {tono:'medio',texto:`Lleva ${d} días activo: sobrevivió a la prueba, algo está funcionando.`};
  if(d<60)return {tono:'bien',texto:`Lleva ${d} días activo: es un anuncio que ya probó su rentabilidad.`};
  return {tono:'bien',texto:`Lleva ${d} días activo: casi seguro le está vendiendo a la marca.`};
}
export const normTxt=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9ñ ]+/g,' ').replace(/\s+/g,' ').trim();

/**
 * Reemplaza el estado completo. Solo lo usan el arranque y la restauración de un
 * respaldo: el resto del Studio modifica `S` por dentro y llama a save().
 */
export function setS(nuevo){ S=nuevo; }
