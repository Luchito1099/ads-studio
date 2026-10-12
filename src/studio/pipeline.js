import { openModal } from "./guion.js";
import { thumbHTML } from "./medios.js";
import { $, PID, S, STATUS, UI, byId, columnOf, cpa, esc, fmtIcon, ic, mine, money, opt, prod, result, save, toast, tope, uid } from "./nucleo.js";
import { render, setTop } from "./vista.js";

/** Content Pipeline: el tablero de piezas por estado. */

/* ============ PIPELINE ============ */
export function newPiece(o={}){
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
export function vPipeline(){
  setTop('Content Pipeline',`Piezas de ${prod().name} del guion al resultado · arrastra las tarjetas entre columnas`,`<button class="btn" id="pnew">${ic('plus','sm')}Nueva pieza</button>`);
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
