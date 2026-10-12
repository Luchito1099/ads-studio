import { kpi } from "./analisis.js";
import { PERIODS, dataset, dpc, emptyData, mm, objetivoMeta, openImport, pc, pieceForAd } from "./datos.js";
import { openModal } from "./guion.js";
import { thumbHTML } from "./medios.js";
import MotorFatiga from "./motor-fatiga.js";
import { $, S, UI, byId, esc, ic, mine, prod, save, toast, uid } from "./nucleo.js";
import { newPiece } from "./pipeline.js";
import { render, setTop } from "./vista.js";

/** Fatiga: qué anuncio ya se quemó y qué hacer con él. */

/* ============ FATIGA (motor del predictor) ============ */
const GRUPOS_F=[['ya','Actuar ya','lose'],['semana','Esta semana','warn'],['monitoreo','Bajo monitoreo · rinden, no apagar',''],['revisar','Revisar · no es fatiga',''],['sanos','Sanos','win'],['esperar','Sin datos suficientes','']];
const ETAPA_COL={fatigado:'#dc2626',desarrollo:'#f97316',temprana:'#eab308',sano:'#10b981',sin_datos:'#94a3b8'};
export function vFatiga(){
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
