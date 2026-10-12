import { thumbHTML } from "./medios.js";
import { $, HOOK_TYPES, PID, S, STAGES, UI, byId, esc, ic, mine, money, opt, prod, result, save, stageOpt, toast, uid } from "./nucleo.js";
import { formModal, render, setTop } from "./vista.js";

/** Ángulos de venta, formatos y hooks. */

/* ============ ÁNGULOS ============ */
export function vAngles(){
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
export function vConcepts(){
  setTop('Formatos','Cómo se hace la pieza: UGC, voz en off, testimonio… Compartidos entre productos.',`<button class="btn" id="cnew">${ic('plus','sm')}Concepto</button>`);
  const rows=S.concepts.map(c=>{const ps=mine(S.pieces).filter(p=>p.conceptId===c.id);const wins=ps.filter(p=>result(p)==='Ganador').length;
    const spend=ps.reduce((s,p)=>s+(p.spend||0),0),conf=ps.reduce((s,p)=>s+(p.conf||0),0);
    const st=wins?'<span class="chip win">Validado</span>':ps.some(p=>['lanzado','testing'].includes(p.status))?'<span class="chip warn">En prueba</span>':'<span class="chip">Sin probar</span>';
    return `<tr><td><b>${esc(c.name)}</b></td><td class="num">${mine(S.refs).filter(r=>r.conceptId===c.id).length}</td><td class="num">${mine(S.hooks).filter(h=>h.conceptId===c.id).length}</td><td class="num">${ps.length}</td><td class="num">${wins}</td><td class="num">${conf?money(spend/conf):'—'}</td><td>${st}</td><td style="text-align:right"><button class="btn ghost sm" data-ren="${c.id}">Renombrar</button></td></tr>`;}).join('');
  $('#body').innerHTML=`<div class="panel" style="padding:12px 16px;margin-bottom:14px;display:flex;gap:10px;align-items:center"><span class="chip">Regla A/B</span><span class="muted">Las variantes de hook se prueban solo sobre conceptos validados en ${esc(prod().name)}.</span></div>
    <div class="panel" style="overflow:auto"><table><thead><tr><th>Formato</th><th class="num">Referencias</th><th class="num">Hooks</th><th class="num">Piezas</th><th class="num">Ganadores</th><th class="num">CPA real</th><th>Estado</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  $('#cnew').onclick=()=>{const n=prompt('Nombre del concepto');if(n&&n.trim()){S.concepts.push({id:uid('c'),name:n.trim()});save();render();}};
  document.querySelectorAll('[data-ren]').forEach(b=>b.onclick=()=>{const c=byId(S.concepts,b.dataset.ren);const n=prompt('Nuevo nombre',c.name);if(n&&n.trim()){c.name=n.trim();save();render();}});
}

/* ============ HOOKS ============ */
export function vHooks(){
  setTop('Hooks',`Primeros segundos, titular o primera línea del copy de ${prod().name}`,`<button class="btn" id="hnew">${ic('plus','sm')}Hook</button>`);
  const f=UI.hookStage||'todas';
  const list=mine(S.hooks).filter(h=>f==='todas'||h.stage===f);
  $('#body').innerHTML=`<div class="seg" id="hf" style="margin-bottom:12px">${['todas',...STAGES].map(s=>`<button data-k="${s}" class="${f===s?'on':''}">${s==='todas'?'Todas las etapas':s}</button>`).join('')}</div>
   <div class="panel" style="overflow:auto">${list.length?`<table><thead><tr><th>Hook</th><th>Tipo</th><th>Ángulo</th><th>Formato</th><th>Etapa</th><th>Origen</th><th>Usado en</th><th></th></tr></thead><tbody>
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
    <div class="field"><label for="hc">Formato creativo</label><select id="hc">${opt(S.concepts,d.conceptId)}</select></div>
    <div class="field"><label for="hs">Etapa</label><select id="hs">${stageOpt(d.stage)}</select></div></div>`,
    ()=>{const v={text:$('#ht').value.trim(),type:$('#hy').value,origin:$('#ho').value,angleId:$('#ha').value,conceptId:$('#hc').value,stage:$('#hs').value};
      if(!v.text){toast('Escribe el hook');return false;} if(h)Object.assign(h,v);else S.hooks.push({id:uid('h'),productId:PID(),...v});save();render();},
    h?()=>{if(!confirm('¿Eliminar este hook?'))return false;S.hooks=S.hooks.filter(x=>x.id!==h.id);save();render();}:null);
}
