import { openModal } from "./guion.js";
import { hydrateThumbs, thumbHTML } from "./medios.js";
import { $, PID, S, STAGES, STAGE_INFO, byId, emptyLanes, esc, ic, mine, prod, save, toast } from "./nucleo.js";
import { newPiece } from "./pipeline.js";
import { render, setTop } from "./vista.js";

/** Embudo: las piezas repartidas en TOFU, MOFU y BOFU. */

/* ============ EMBUDO (pizarra) ============ */
export function vEmbudo(){
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
