import { applyTemplate, copyText, openModal, parseAI } from "./guion.js";
import { $, FORMATS, PID, S, STAGES, UI, byId, esc, ic, mine, normTxt, opt, prod, result, save, stageOpt, toast, uid } from "./nucleo.js";
import { newPiece } from "./pipeline.js";
import { openRef } from "./ref-detalle.js";
import { formModal, render, setTop } from "./vista.js";

/** Ideas de contenido. */

/* ============ IDEAS DE CONTENIDO ============ */
const IDEA_ESTADOS=[['nueva','Nueva',''],['aprobada','Aprobada','win'],['convertida','En pipeline','TOFU'],['descartada','Descartada','lose']];
const IDEA_ORIGENES=['Propio','Referencia','Comentarios / chats','Tendencia','Competencia','IA'];
const IDEA_PRIO=[['alta','Alta','lose'],['media','Media','warn'],['baja','Baja','']];
const ideaEstado=k=>IDEA_ESTADOS.find(e=>e[0]===k)||IDEA_ESTADOS[0];
const ideaPrio=k=>IDEA_PRIO.find(e=>e[0]===k)||IDEA_PRIO[1];
export function newIdea(o={}){
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

## Formatos disponibles
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
export function vIdeas(){
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
      <div class="field"><label for="ipt">Prompt listo para Claude o ChatGPT</label><textarea id="ipt" style="min-height:200px;font-family:var(--mono);font-size:12px">${esc(buildIdeasPrompt(UI.ideaN||10))}</textarea></div>
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
      <div class="field"><label for="if">Tipo de archivo</label><select id="if"><option value="">—</option>${FORMATS.map(x=>`<option value="${x[0]}" ${x[0]===d.formato?'selected':''}>${x[1]}</option>`).join('')}</select></div>
      <div class="field"><label for="ia2">Ángulo</label><select id="ia2">${opt(mine(S.angles),d.angleId)}</select></div>
      <div class="field"><label for="ic2">Formato creativo</label><select id="ic2">${opt(S.concepts,d.conceptId)}</select></div>
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
