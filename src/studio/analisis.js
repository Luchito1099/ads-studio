import { PERIODS, dataset, dimKey, dpc, emptyData, mm, mmBig, objetivoMeta, openImport, pc, pieceForAd } from "./datos.js";
import { thumbHTML } from "./medios.js";
import MotorFatiga from "./motor-fatiga.js";
import { $, S, UI, byId, esc, mine, prod, save, toast, tope } from "./nucleo.js";
import { render, setTop } from "./vista.js";

/** Análisis 80/20: dónde se va el gasto y de dónde vienen las ventas. */

export function vAnalisis(){
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
  const dimLabels=[['anuncio','Anuncio'],['creativo','Creativo (mismo nombre)'],['campana','Campaña'],['conjunto','Conjunto'],['formato','Tipo de archivo'],['angulo','Ángulo'],['concepto','Formato'],['etapa','Etapa']];
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
export function kpi(l,v,delta,invert){const txt=delta&&delta.includes('class="delta')?`${delta} vs periodo anterior`:delta;return `<div class="panel kpi"><span>${l}</span><b>${v}</b>${delta?`<em class="${invert?'inv':''}">${txt}</em>`:''}</div>`;}
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
