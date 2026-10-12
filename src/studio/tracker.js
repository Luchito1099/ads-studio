import { openSettings } from "./ajustes.js";
import { openModal } from "./guion.js";
import { thumbHTML } from "./medios.js";
import { $, S, STAGES, STATUS, byId, cpa, esc, mine, money, prod, result, save, tope } from "./nucleo.js";
import { render, setTop } from "./vista.js";

/** Tracker: lo que se lanzó y cómo va. */

/* ============ TRACKER ============ */
export function vTracker(){
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
   <div class="panel" style="overflow:auto"><table><thead><tr><th></th><th>Pieza</th><th>Etapa</th><th>Ángulo</th><th>Formato</th><th>Estado</th><th class="num">Gasto S/</th><th class="num">Confirmados</th><th class="num">Entregados</th><th class="num">CPA real</th><th>Resultado</th></tr></thead><tbody>
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
