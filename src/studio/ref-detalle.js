import { libCollections } from "./biblioteca.js";
import { dias } from "./competencia.js";
import { JOBS, autoExtraer, progHTML, runExtract, tstr } from "./extraccion.js";
import { BLOCK_TYPES, copyText, openModal, parseAI } from "./guion.js";
import { newIdea } from "./ideas.js";
import { addMedia, filesFrom } from "./medios.js";
import { $, FORMATS, PID, REF_SOURCES, S, STAGES, UI, byId, diasActivo, ensureRef, esc, fechaISO, ic, normTxt, opt, prod, save, senalDias, thumbCache, toast, uid } from "./nucleo.js";
import { DB, permitirBorrado } from "./persistencia.js";
import { newPiece } from "./pipeline.js";
import { render } from "./vista.js";

/** La ficha de un anuncio guardado: guion, datos, copy y storyboard. */

export function openRef(id,tab){
  UI.refOpen=id;UI.refTab=tab||(byId(S.refs,id).extract?.status==='listo'?'guion':'datos');UI.refPrompt=false;
  renderRefModal();
  // Los fotogramas viven aparte del estado: se traen al abrir la ficha.
  const r=byId(S.refs,id);
  if(r?.extract?.nframes&&!(r.extract.frames||[]).length){
    DB.cargarFrames(r).then(()=>{ if(UI.refOpen===id)renderRefModal(); }).catch(()=>{});
  }
}
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
export function sugerencias(r){
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
export function renderRefModal(){
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
        ${UI.refPrompt?`<div class="field"><label for="rpt">Prompt</label><textarea id="rpt" style="min-height:200px;font-family:var(--mono);font-size:12px">${esc(buildRefPrompt(r))}</textarea></div>
        <div><button class="btn sm" id="rpc">Copiar prompt</button></div>
        <div class="field"><label for="rpa">Pega la respuesta de la IA</label><textarea id="rpa" placeholder='{"hook": {...}, "bloques": [...]}'></textarea></div>
        <div style="display:flex;gap:8px"><button class="btn sm" id="rpapply">Aplicar desglose</button><button class="btn ghost sm" id="rpx">Cerrar</button></div>`:''}
      </div>
      ${a?`<div class="panel" style="padding:14px;display:flex;flex-direction:column;gap:12px">
        ${a.hook?`<div><div class="section-t">Hook</div><p style="margin:6px 0 2px;font-size:15px;font-weight:700">“${esc(a.hook.texto)}”</p><span class="chip">${esc(a.hook.tipo||'')}</span><p class="hint" style="margin:6px 0 0">${esc(a.hook.por_que_funciona||'')}</p></div>`:''}
        ${a.por_que?`<div><div class="section-t">Por qué funciona</div><p style="margin:6px 0 0;line-height:1.5">${esc(a.por_que)}</p></div>`:''}
        <div style="display:flex;gap:6px;flex-wrap:wrap">${a.concepto?`<span class="chip">Formato: ${esc(a.concepto)}</span>`:''}${a.angulo?`<span class="chip ang">Ángulo: ${esc(a.angulo)}</span>`:''}${r.stage?`<span class="chip ${r.stage}">${r.stage}</span>`:''}</div>
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
        <div class="field"><span class="lbl">Tipo de archivo</span><div class="chips">${FORMATS.map(f=>`<button class="chipb ${r.format===f[0]?'on dark':''}" data-fmt="${f[0]}">${f[1]}</button>`).join('')}</div></div>
        <div class="grid2">
          <div class="field"><label for="dc">Formato creativo</label><select id="dc" data-rf="conceptId">${opt(S.concepts,r.conceptId)}</select></div>
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
    <div class="mh"><b id="rt">${esc(r.brand||'Referencia sin marca')}</b>${r.adId?`<span class="chip" style="font-family:var(--mono)" title="ID del anuncio o publicación">ID ${esc(r.adId)}</span>`:''}<span class="muted" style="font-size:13px">${esc(r.source)}${ex.duration?' · '+tstr(ex.duration):''}</span>${ready?'<span class="chip win">Guion extraído</span>':''}<button class="btn ghost sm" id="rx" style="margin-left:auto" aria-label="Cerrar">${ic('x','sm')}</button></div>
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
        ${(ex.frames?.length||ex.nframes||0)>1?`<div class="panel fpanel">
          <button class="fhead" id="rfrtog" aria-expanded="${UI.refFrames!==false}"><b>Fotogramas</b><span class="muted">${ex.frames?.length||ex.nframes||0} escenas${ex.frames?.length?'':' · cargando…'}</span><span class="car">${ic(UI.refFrames!==false?'up':'down','sm')}</span></button>
          ${UI.refFrames!==false?`<div class="frames">${(ex.frames||[]).map(fr=>`<button data-seek="${fr.t}" aria-label="Ir a ${tstr(fr.t)}"><img src="${fr.thumb}" alt=""><span>${tstr(fr.t)}</span></button>`).join('')}</div>
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
    q('#ddel').onclick=async()=>{if(!confirm('¿Eliminar esta referencia de la biblioteca?'))return;const used=S.pieces.some(p=>p.mediaIds.includes(r.mediaId));if(r.mediaId&&!used)await DB.del('media',r.mediaId);await DB.borrarFrames(r.id);permitirBorrado();S.refs=S.refs.filter(x=>x.id!==r.id);if(ov._url)URL.revokeObjectURL(ov._url);closeRef();};
  }
}
