import { counts } from "./menu.js";
import MotorFatiga from "./motor-fatiga.js";
import { $, PID, S, byId, esc, mine, prod, save, toast } from "./nucleo.js";
import { formModal, render, setTop } from "./vista.js";

/** Datos de Meta: leer el archivo exportado y dejarlo listo para analizar. */

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
export function importDatos(d,label){
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
export function openImport(){
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
export const PREP_CACHE=new Map();
export function dataset(){ const d=S.metaData?.[PID()]; if(!d||!d.diario?.length)return null;
  const key=PID()+':'+d.importedAt; if(PREP_CACHE.has(key))return PREP_CACHE.get(key);
  const copy={meta:d.meta,anuncios:d.anuncios.map(a=>({...a})),diario:d.diario.map(r=>({...r}))};
  const prep=MotorFatiga.preparar(copy); const out={d,prep}; PREP_CACHE.clear(); PREP_CACHE.set(key,out); return out; }
const curMoneda=()=>S.metaData?.[PID()]?.meta?.moneda||'USD';
export const objetivoMeta=()=>curMoneda()==='USD'?S.settings.topeUSD:S.settings.topeUSD*S.settings.tc;
export const mm=v=>v==null||!isFinite(v)?'—':(curMoneda()==='USD'?'$'+v.toFixed(2):'S/'+v.toFixed(1));
export const mmBig=v=>v==null||!isFinite(v)?'—':(curMoneda()==='USD'?'$':'S/')+Math.round(v).toLocaleString('es-PE');
export const pc=(v,d=0)=>v==null||!isFinite(v)?'—':(v*100).toFixed(d)+'%';
export const dpc=v=>v==null||!isFinite(v)?'':`<span class="delta ${v>0?'up':'down'}">${v>0?'+':''}${Math.round(v*100)}%</span>`;
export function pieceForAd(adId,nombre){ return mine(S.pieces).find(p=>(p.adIds||[]).includes(adId))||mine(S.pieces).find(p=>p.adName&&nombre&&p.adName.trim()===nombre.trim()); }
export function emptyData(title){
  setTop(title,`Sin datos de Meta para ${prod().name}`,`<button class="btn" id="imp1">Importar datos de Meta</button>`);
  $('#body').innerHTML=`<div class="empty" style="max-width:640px;margin:40px auto;text-align:left;display:flex;flex-direction:column;gap:10px">
    <b style="color:var(--ink);font-size:16px">Importa el rendimiento diario de tus anuncios</b>
    <span>Exporta desde el Administrador de anuncios: nivel <b>Anuncios</b>, desglose <b>Por día</b>, formato CSV. Con eso se calcula el 80/20 y la fatiga de cada anuncio.</span>
    <div><button class="btn" id="imp2">Importar datos de Meta</button></div></div>`;
  $('#imp1').onclick=openImport;$('#imp2').onclick=openImport;
}
export const PERIODS=[7,14,30,60,90];

/* ============ LOS DATOS, LISTOS PARA ANALIZAR ============ */
function baseName(n){return String(n||'').replace(/\.mp4/ig,'').replace(/\s*-\s*copia.*$/i,'').replace(/\s+/g,' ').trim();}
export function dimKey(dim,a,piece){
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
