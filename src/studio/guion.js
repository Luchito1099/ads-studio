import { hydrateThumbs, ingest, openViewer, pick, thumbHTML } from "./medios.js";
import { $, FORMATS, PID, S, STATUS, UI, byId, cpa, esc, ic, mine, money, opt, prod, result, save, stageOpt, toast, tope, uid } from "./nucleo.js";
import { render } from "./vista.js";

/** El editor de guion y copy de una pieza. */

/* ============ MODAL DE PIEZA ============ */
export function openModal(id,tab='guion'){UI.modal=id;UI.modalTab=tab;UI.promptOpen=false;renderModal();}
function closeModal(){UI.modal=null;$('#ov')?.remove();render();}
function suggestCode(p){ const ang=byId(S.angles,p.angleId); const angS=(ang?.name||'ANGULO').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,10);
  const f=(FORMATS.find(x=>x[0]===p.format)||FORMATS[0])[3]; const n=(p.code.match(/\d+/)||['1'])[0].padStart(3,'0');
  return `AD_${prod().code}_${angS}_${f}_${n}_A`; }
export const BLOCK_TYPES=['Hook','Problema','Agitación','Demostración','Prueba / testimonio','Beneficio','Comparación','Objeción','Oferta','CTA'];
const TEMPLATES={
  video:[['Hook','0–3 s'],['Problema','3–8 s'],['Demostración','8–18 s'],['Prueba / testimonio','18–24 s'],['Oferta','24–28 s'],['CTA','28–30 s']],
  video_texto:[['Hook','0–2 s'],['Comparación','2–5 s'],['Demostración','5–8 s'],['CTA','8–10 s']],
  imagen:[['Hook','Imagen']],
  carrusel:[['Hook','Tarjeta 1'],['Problema','Tarjeta 2'],['Beneficio','Tarjeta 3'],['Oferta','Tarjeta 4']]
};
const STAGE_GOAL={TOFU:'Detener el scroll de alguien que no conoce la marca y mostrarle el problema. CTA a la landing.',MOFU:'Demostrar que funciona y compararlo contra lo que ya usan. CTA a WhatsApp.',BOFU:'Resolver objeciones (talla, si incomoda, pago) y cerrar con la oferta. CTA a WhatsApp.'};
const hasVoice=f=>f==='video';
export function ensureScript(p){ if(!p.script)p.script={blocks:[]}; if(!p.copy)p.copy={principal:'',titulo:'',cta:'Comprar'}; return p.script; }
export function applyTemplate(p){
  const sc=ensureScript(p); const hook=byId(S.hooks,p.hookId);
  sc.blocks=(TEMPLATES[p.format]||TEMPLATES.video).map(([tipo,tiempo],i)=>({id:uid('b'),tipo,tiempo,voz:i===0&&hook&&hasVoice(p.format)?hook.text:'',texto:i===0&&hook&&!hasVoice(p.format)?hook.text:'',visual:''}));
}
function buildPrompt(p){
  const pr=prod(),ang=byId(S.angles,p.angleId),con=byId(S.concepts,p.conceptId),hook=byId(S.hooks,p.hookId),ref=p.refId?byId(S.refs,p.refId):null;
  const fmt=(FORMATS.find(f=>f[0]===p.format)||FORMATS[0])[1];
  const whatsapp=p.stage==='MOFU'||p.stage==='BOFU';
  const fmtRules={
    video:'Video vertical con voz (UGC con celular). 20–30 segundos. Cada bloque lleva voz, texto en pantalla de 2 a 3 palabras y la toma a grabar.',
    video_texto:'Video vertical SIN voz: la historia se cuenta solo con texto en pantalla y tomas. 8–12 segundos. Máximo 2 a 3 palabras por frame. Deja "voz" vacío.',
    imagen:'Imagen estática. Un solo bloque: "texto_pantalla" es el titular dentro de la imagen (máximo 6 palabras) y "visual" describe la composición. El peso de la venta va en el copy. Deja "voz" y "tiempo" vacíos.',
    carrusel:'Carrusel de 3 a 5 tarjetas. Cada bloque es una tarjeta: titular corto en "texto_pantalla" y "visual" con la imagen. Deja "voz" vacío.'
  }[p.format]||'';
  const actuales=(p.script?.blocks||[]).filter(b=>b.voz||b.texto||b.visual);
  return `Actúa como guionista de anuncios para Meta de una marca de e-commerce contra entrega en Perú.

## Pieza
- Producto: ${pr.name}
- Formato: ${fmt}
- Etapa del embudo: ${p.stage||'[elige TOFU, MOFU o BOFU]'}${p.stage?` — objetivo: ${STAGE_GOAL[p.stage]}`:''}
- Ángulo de venta: ${ang?`${ang.name}. Deseo o dolor: ${ang.deseo||'—'}. ${ang.desc||''}`:'[define el ángulo]'}
- Formato creativo: ${con?con.name:'[elige un formato]'}
- Hook base: ${hook?`"${hook.text}" (${hook.type})`:'[propón uno]'}
${ref?`- Referencia de inspiración: ${ref.brand||'sin marca'} (${ref.source}). Lo que rescato: ${ref.notes||'—'}${ref.extract?.analysis?.por_que?' Por qué funciona: '+ref.extract.analysis.por_que:''}\n`:''}- Datos del producto y oferta: ${pr.brief?pr.brief.replace(/\n+/g,' · '):'[completa aquí: beneficios reales, precio, packs, garantía]'}

## Reglas
- Español peruano natural, como habla la gente (pichanga, chimpún, pata cuando encaje). Nada de tono de comercial de TV.
- Sin promesas médicas ni palabras como "cura", "protege" o "protección". Habla de soporte, estabilidad y comodidad.
- ${fmtRules}
- Directo y corto: los formatos simples rinden más que los elaborados.
- Oferta: pago contra entrega en Lima; provincia con adelanto de S/30. No inventes precios: usa solo los que te doy.
- CTA: ${whatsapp?'"Enviar mensaje" a WhatsApp, e incluye el mensaje prellenado que enviará el cliente.':'"Comprar" hacia la landing.'}
- El texto en pantalla, la primera línea del copy y el título NO deben repetir la misma frase.
${actuales.length?`\n## Borrador actual (mejóralo, no lo ignores)\n${actuales.map((b,i)=>`${i+1}. [${b.tipo}${b.tiempo?' · '+b.tiempo:''}] voz: ${b.voz||'—'} | texto: ${b.texto||'—'} | visual: ${b.visual||'—'}`).join('\n')}\n`:''}
${ref?.extract?.blocks?.length?`## Guion de la referencia (toma la estructura, NO copies las frases)\n${ref.extract.blocks.map((b,i)=>`${i+1}. [${b.tipo||'—'} · ${b.tiempo||''}] voz: ${b.voz||'—'} | texto: ${b.texto||'—'}`).join('\n')}\n\n`:''}## Formato de respuesta
Responde SOLO con un JSON válido, sin texto antes ni después, con esta forma:
{
  "bloques": [
    {"tipo": "Hook | Problema | Agitación | Demostración | Prueba / testimonio | Beneficio | Comparación | Objeción | Oferta | CTA", "tiempo": "0–3 s", "voz": "", "texto_pantalla": "", "visual": ""}
  ],
  "copy": {"texto_principal": "", "titulo": "", "cta": "${whatsapp?'Enviar mensaje':'Comprar'}"${whatsapp?', "mensaje_prellenado": ""':''}},
  "hooks_alternativos": ["", ""]
}`;
}
export function parseAI(text){
  let t=String(text||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  const a=t.indexOf('{'),b=t.lastIndexOf('}'); if(a<0||b<0)throw new Error('No encontré un JSON en la respuesta');
  return JSON.parse(t.slice(a,b+1));
}
export async function copyText(t,fallbackEl){
  try{await navigator.clipboard.writeText(t);return true;}catch(e){ if(fallbackEl){fallbackEl.focus();fallbackEl.select();try{return document.execCommand('copy');}catch(_){}} return false; }
}
const voiceSecs=blocks=>{const w=blocks.reduce((s,b)=>s+String(b.voz||'').trim().split(/\s+/).filter(Boolean).length,0);return Math.round(w/2.5);};

export function renderModal(){
  const p=byId(S.pieces,UI.modal); if(!p){UI.modal=null;return;}
  ensureScript(p); const tab=UI.modalTab||'guion';
  const keepScroll=$('#ov')?.scrollTop||0;
  $('#ov')?.remove();
  const ov=document.createElement('div');ov.className='ov';ov.id='ov';
  const c=cpa(p),r=result(p),voice=hasVoice(p.format),blocks=p.script.blocks;
  const tabBtn=(k,l,n)=>`<button role="tab" aria-selected="${tab===k}" data-tab="${k}" class="${tab===k?'on':''}">${l}${n!=null?` <span style="opacity:.7">${n}</span>`:''}</button>`;
  let content='';
  if(tab==='guion'){
    content=`<div style="padding:18px;display:flex;flex-direction:column;gap:14px">
      <div class="grid3">
        <div class="field"><label for="mfo">Formato</label><select id="mfo">${FORMATS.map(f=>`<option value="${f[0]}" ${f[0]===p.format?'selected':''}>${f[1]}</option>`).join('')}</select></div>
        <div class="field"><label for="man">Ángulo de venta</label><select id="man">${opt(mine(S.angles),p.angleId,'Elegir ángulo')}</select></div>
        <div class="field"><label for="mse">Etapa</label><select id="mse">${stageOpt(p.stage)}</select></div>
      </div>
      <div class="grid2">
        <div class="field"><label for="mco">Formato creativo</label><select id="mco">${opt(S.concepts,p.conceptId,'Elegir')}</select></div>
        <div class="field"><label for="mho">Hook</label><select id="mho"><option value="">—</option>${mine(S.hooks).map(h=>`<option value="${h.id}" ${h.id===p.hookId?'selected':''}>${esc(h.text.slice(0,70))}</option>`).join('')}</select></div>
      </div>

      <div class="panel" style="padding:14px;background:#f8fafc;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <b>Generar con IA</b><span class="hint">Arma el prompt con el producto, ángulo, concepto, hook, etapa y tus reglas.</span>
          <button class="btn sm" id="gp" style="margin-left:auto">Generar prompt</button>
        </div>
        ${UI.promptOpen?`
        <div class="field"><label for="pbrief">Ficha de ${esc(prod().name)} (se guarda y se reutiliza en todos sus prompts)</label><textarea id="pbrief" placeholder="Beneficios reales, material, talla, precio, packs, garantía, envío">${esc(prod().brief||'')}</textarea></div>
        <div class="field"><label for="ptxt">Prompt listo para Claude o ChatGPT</label><textarea id="ptxt" style="min-height:220px;font-family:var(--mono);font-size:12px">${esc(buildPrompt(p))}</textarea></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" id="pcopy">Copiar prompt</button><span class="hint" style="align-self:center">Revisa lo que quede entre corchetes antes de enviarlo.</span></div>
        <div class="field"><label for="pans">Pega aquí la respuesta de la IA</label><textarea id="pans" placeholder='{"bloques": [...], "copy": {...}}'></textarea></div>
        <div style="display:flex;gap:8px"><button class="btn sm" id="papply">Aplicar al guion y al copy</button><button class="btn ghost sm" id="pclose">Cerrar</button></div>`:''}
      </div>

      <div style="display:flex;align-items:center;gap:8px">
        <b style="font-size:15px">Guion</b>
        <span class="hint">${voice?`Video con voz · ~${voiceSecs(blocks)} s de voz`:p.format==='imagen'?'Imagen · un bloque con titular y visual':p.format==='carrusel'?'Carrusel · un bloque por tarjeta':'Video solo texto · el texto en pantalla es el guion'}</span>
        <span style="margin-left:auto;display:flex;gap:6px">${blocks.length?'':`<button class="btn ghost sm" id="tpl">Usar estructura base</button>`}<button class="btn ghost sm" id="addb">${ic('plus','sm')}${p.format==='carrusel'?'Tarjeta':'Bloque'}</button></span>
      </div>
      ${blocks.length?`<div style="display:flex;flex-direction:column;gap:10px">${blocks.map((b,i)=>`
        <div class="panel" style="padding:12px;display:grid;grid-template-columns:150px minmax(0,1fr);gap:12px" data-block="${b.id}">
          <div style="display:flex;flex-direction:column;gap:6px">
            <span class="muted" style="font-size:12px;font-weight:700">${p.format==='carrusel'?'Tarjeta':'Bloque'} ${i+1}</span>
            <label class="visually-hidden" for="bt-${b.id}">Tipo de bloque</label>
            <select id="bt-${b.id}" data-bf="tipo" style="height:32px;border:1px solid var(--line);border-radius:8px;padding:0 6px;background:#fff">${BLOCK_TYPES.map(t=>`<option ${t===b.tipo?'selected':''}>${t}</option>`).join('')}</select>
            ${p.format!=='imagen'?`<label class="visually-hidden" for="bti-${b.id}">Tiempo</label><input id="bti-${b.id}" data-bf="tiempo" value="${esc(b.tiempo)}" placeholder="${p.format==='carrusel'?'Tarjeta':'0–3 s'}" style="height:32px;border:1px solid var(--line);border-radius:8px;padding:0 8px">`:''}
            <div style="display:flex;gap:4px;margin-top:auto">
              <button class="btn ghost sm" data-mv="-1" aria-label="Subir bloque" ${i===0?'disabled':''}>↑</button>
              <button class="btn ghost sm" data-mv="1" aria-label="Bajar bloque" ${i===blocks.length-1?'disabled':''}>↓</button>
              <button class="btn ghost sm" data-del aria-label="Eliminar bloque">${ic('x','sm')}</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:${voice?'repeat(3,minmax(0,1fr))':'repeat(2,minmax(0,1fr))'};gap:10px">
            ${voice?`<div class="field"><label for="bv-${b.id}">Voz</label><textarea id="bv-${b.id}" data-bf="voz" placeholder="Lo que dice el creador">${esc(b.voz)}</textarea></div>`:''}
            <div class="field"><label for="bx-${b.id}">${p.format==='imagen'?'Titular en la imagen':'Texto en pantalla'}</label><textarea id="bx-${b.id}" data-bf="texto" placeholder="${p.format==='imagen'?'Máx. 6 palabras':'2–3 palabras'}">${esc(b.texto)}</textarea></div>
            <div class="field"><label for="bs-${b.id}">${p.format==='imagen'?'Composición':'Toma / visual'}</label><textarea id="bs-${b.id}" data-bf="visual" placeholder="Qué se ve y cómo se graba">${esc(b.visual)}</textarea></div>
          </div>
        </div>`).join('')}</div>`:`<div class="empty">Sin guion todavía. Usa la estructura base o genera el prompt y pega la respuesta.</div>`}
    </div>`;
  }else if(tab==='creativos'){
    content=`<div class="mb">
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="section-t">Creativos</div>
        <div class="drop" id="drop" style="padding:10px 12px"><div class="ic">${ic('up')}</div><div style="flex-grow:1"><b style="font-size:13px">Pega, arrastra o sube</b><div class="hint">La primera es la miniatura de la tarjeta.</div></div><button class="btn sm" id="bpick">Subir</button></div>
        ${p.mediaIds.length?`<div class="gallery">${p.mediaIds.map((m,i)=>`<div class="g ${i===0?'cover':''}"><button style="border:0;padding:0;background:none;width:100%;cursor:zoom-in" data-view="${m}" aria-label="Ver en grande">${thumbHTML(m)}</button>
          <button class="x" data-rm="${m}" aria-label="Quitar archivo">×</button>${i>0?`<button class="btn ghost sm" data-cover="${m}" style="position:absolute;left:4px;bottom:4px;height:24px;font-size:11px">Usar de portada</button>`:''}</div>`).join('')}</div>`:`<div class="empty" style="padding:18px">Sin creativos todavía.</div>`}
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="section-t">Copy del anuncio</div>
        <div class="field"><label for="mcp">Texto principal</label><textarea id="mcp" style="min-height:160px" placeholder="La primera línea es un segundo hook: tiene que funcionar sola.">${esc(p.copy.principal)}</textarea></div>
        <div class="grid2"><div class="field"><label for="mct">Título</label><input id="mct" value="${esc(p.copy.titulo)}" placeholder="Beneficio u oferta"></div>
        <div class="field"><label for="mcc">Botón</label><select id="mcc">${['Comprar','Enviar mensaje','Más información','Pedir ahora'].map(x=>`<option ${x===p.copy.cta?'selected':''}>${x}</option>`).join('')}</select></div></div>
        ${p.stage==='MOFU'||p.stage==='BOFU'||p.copy.cta==='Enviar mensaje'?`<div class="field"><label for="mwa">Mensaje prellenado de WhatsApp</label><input id="mwa" value="${esc(p.copy.mensaje||'')}" placeholder="Ej. Hola, quiero la tobillera"></div>`:''}
        ${p.copy.alternativos?.length?`<div class="field"><span style="font-size:12px;font-weight:600">Hooks alternativos sugeridos</span>${p.copy.alternativos.map((h,i)=>`<div style="display:flex;gap:6px;align-items:center"><span style="flex-grow:1">${esc(h)}</span><button class="btn ghost sm" data-savehook="${i}">Guardar en hooks</button></div>`).join('')}</div>`:''}
      </div></div>`;
  }else{
    content=`<div style="padding:18px;display:flex;flex-direction:column;gap:12px">
      <div class="grid2">
        <div class="field"><label for="mti">Título interno</label><input id="mti" value="${esc(p.title)}"></div>
        <div class="field"><label for="mst">Estado</label><select id="mst">${STATUS.filter(s=>s[0]!=='resultado').map(s=>`<option value="${s[0]}" ${s[0]===p.status?'selected':''}>${s[1]}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label for="mcode">Nombre del anuncio</label><div style="display:flex;gap:6px"><input id="mcode" value="${esc(p.adName||'')}" placeholder="${esc(suggestCode(p))}" style="font-family:var(--mono);font-size:12px"><button class="btn ghost sm" id="msug" style="height:38px">Sugerir</button></div></div>
      <div class="section-t">Resultados</div>
      <div class="grid3">
        <div class="field"><label for="msp">Gasto S/</label><input id="msp" type="number" min="0" step="0.1" value="${p.spend??''}"></div>
        <div class="field"><label for="mcf">Confirmados</label><input id="mcf" type="number" min="0" step="1" value="${p.conf??''}"></div>
        <div class="field"><label for="mde">Entregados</label><input id="mde" type="number" min="0" step="1" value="${p.delivered??''}"></div>
      </div>
      <div class="panel" style="padding:10px 12px;display:flex;gap:10px;align-items:center;background:#f8fafc"><span class="muted">CPA real</span><b style="font-size:16px">${money(c)}</b><span class="muted">tope ${money(tope())}</span>${r?`<span class="chip ${r==='Ganador'?'win':r==='Perdedor'?'lose':''}" style="margin-left:auto">${r}</span>`:''}</div>
    </div>`;
  }
  ov.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt">
    <div class="mh"><b id="mt">${esc(p.code)}</b><span style="font-weight:600">${esc(p.title)}</span>${p.stage?`<span class="chip ${p.stage}">${p.stage}</span>`:''}<span class="muted" style="font-size:13px">${esc(prod().name)}</span><button class="btn ghost sm" id="mx" style="margin-left:auto" aria-label="Cerrar">${ic('x','sm')}</button></div>
    <div class="seg" role="tablist" style="padding:10px 18px 0" id="mtabs">${tabBtn('guion','Guion',blocks.length||null)}${tabBtn('creativos','Creativos y copy',p.mediaIds.length||null)}${tabBtn('datos','Estado y resultados')}</div>
    ${content}
    <div class="mf"><button class="btn danger" id="mdel" style="margin-right:auto">Eliminar pieza</button><button class="btn" id="mok">Listo</button></div>
  </div>`;
  document.body.appendChild(ov); ov.scrollTop=keepScroll; hydrateThumbs(ov);
  const q=s=>ov.querySelector(s);
  ov.addEventListener('mousedown',e=>{if(e.target===ov)closeModal();});
  if(!window._escModal){window._escModal=true;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&UI.modal&&!document.querySelector('.viewer'))closeModal();});}
  q('#mx').onclick=closeModal;q('#mok').onclick=closeModal;
  ov.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{UI.modalTab=b.dataset.tab;renderModal();});
  q('#mdel').onclick=()=>{if(!confirm('¿Eliminar esta pieza?'))return;S.pieces=S.pieces.filter(x=>x.id!==p.id);save();closeModal();};
  const chg=(sel,fn)=>{const el=q(sel);if(el)el.addEventListener('change',e=>{fn(e.target.value);save();renderModal();});};
  const txt=(sel,fn)=>{const el=q(sel);if(el)el.addEventListener('input',e=>{fn(e.target.value);save();});};

  if(tab==='guion'){
    chg('#mfo',v=>p.format=v);chg('#man',v=>p.angleId=v);chg('#mco',v=>p.conceptId=v);chg('#mho',v=>p.hookId=v);
    chg('#mse',v=>{p.stage=v;if(v&&!p.board)p.board={x:Math.random()*.6,y:Math.random()};if(!v)p.board=null;});
    q('#gp').onclick=()=>{UI.promptOpen=true;renderModal();setTimeout(()=>q('#ptxt')&&ov.querySelector('#ptxt').scrollIntoView({block:'center'}),0);};
    if(q('#pcopy')){
      q('#pcopy').onclick=async()=>{const ok=await copyText(ov.querySelector('#ptxt').value,ov.querySelector('#ptxt'));toast(ok?'Prompt copiado':'Selecciona el texto y cópialo');};
      q('#pclose').onclick=()=>{UI.promptOpen=false;renderModal();};
      q('#pbrief').addEventListener('input',e=>{prod().brief=e.target.value;save();ov.querySelector('#ptxt').value=buildPrompt(p);});
      q('#papply').onclick=()=>{
        try{
          const d=parseAI(ov.querySelector('#pans').value);
          if(!Array.isArray(d.bloques)||!d.bloques.length)throw new Error('La respuesta no trae "bloques"');
          p.script.blocks=d.bloques.map(b=>({id:uid('b'),tipo:BLOCK_TYPES.includes(b.tipo)?b.tipo:(b.tipo||'Hook'),tiempo:b.tiempo||'',voz:b.voz||'',texto:b.texto_pantalla||b.texto||'',visual:b.visual||''}));
          if(d.copy){p.copy.principal=d.copy.texto_principal||p.copy.principal;p.copy.titulo=d.copy.titulo||p.copy.titulo;if(d.copy.cta)p.copy.cta=d.copy.cta;if(d.copy.mensaje_prellenado)p.copy.mensaje=d.copy.mensaje_prellenado;}
          if(Array.isArray(d.hooks_alternativos))p.copy.alternativos=d.hooks_alternativos.filter(Boolean);
          if(p.status==='idea')p.status='guion';
          UI.promptOpen=false;save();renderModal();toast(`Guion con ${p.script.blocks.length} bloques aplicado`);
        }catch(err){toast('No se pudo leer: '+err.message);}
      };
    }
    if(q('#tpl'))q('#tpl').onclick=()=>{applyTemplate(p);save();renderModal();};
    q('#addb').onclick=()=>{p.script.blocks.push({id:uid('b'),tipo:p.script.blocks.length?'Beneficio':'Hook',tiempo:'',voz:'',texto:'',visual:''});save();renderModal();};
    ov.querySelectorAll('[data-block]').forEach(el=>{
      const b=p.script.blocks.find(x=>x.id===el.dataset.block);
      el.querySelectorAll('[data-bf]').forEach(inp=>{
        const ev=inp.tagName==='SELECT'?'change':'input';
        inp.addEventListener(ev,()=>{b[inp.dataset.bf]=inp.value;save(); if(inp.dataset.bf==='voz'){const h=ov.querySelector('.hint');} });
      });
      el.querySelector('[data-del]').onclick=()=>{p.script.blocks=p.script.blocks.filter(x=>x!==b);save();renderModal();};
      el.querySelectorAll('[data-mv]').forEach(m=>m.onclick=()=>{const i=p.script.blocks.indexOf(b),j=i+Number(m.dataset.mv);if(j<0||j>=p.script.blocks.length)return;[p.script.blocks[i],p.script.blocks[j]]=[p.script.blocks[j],p.script.blocks[i]];save();renderModal();});
    });
  }else if(tab==='creativos'){
    const d=q('#drop');
    d.addEventListener('dragover',e=>{e.preventDefault();d.classList.add('over');});d.addEventListener('dragleave',()=>d.classList.remove('over'));
    d.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();d.classList.remove('over');ingest(e.dataTransfer.files,{toPiece:p});});
    q('#bpick').onclick=()=>pick(p);
    ov.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>openViewer(b.dataset.view));
    ov.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{p.mediaIds=p.mediaIds.filter(x=>x!==b.dataset.rm);save();renderModal();});
    ov.querySelectorAll('[data-cover]').forEach(b=>b.onclick=()=>{p.mediaIds=[b.dataset.cover,...p.mediaIds.filter(x=>x!==b.dataset.cover)];save();renderModal();});
    txt('#mcp',v=>p.copy.principal=v);txt('#mct',v=>p.copy.titulo=v);txt('#mwa',v=>p.copy.mensaje=v);chg('#mcc',v=>p.copy.cta=v);
    ov.querySelectorAll('[data-savehook]').forEach(b=>b.onclick=()=>{const t=p.copy.alternativos[+b.dataset.savehook];
      S.hooks.push({id:uid('h'),productId:PID(),text:t,type:hasVoice(p.format)?'Hablado':'Texto en pantalla',conceptId:p.conceptId,angleId:p.angleId,stage:p.stage,origin:'Claude'});
      p.copy.alternativos.splice(+b.dataset.savehook,1);save();renderModal();toast('Hook guardado');});
  }else{
    txt('#mti',v=>p.title=v);txt('#mcode',v=>p.adName=v);chg('#mst',v=>p.status=v);
    const num=(sel,key)=>q(sel).addEventListener('change',e=>{p[key]=e.target.value===''?null:Number(e.target.value);save();renderModal();});
    num('#msp','spend');num('#mcf','conf');num('#mde','delivered');
    q('#msug').onclick=()=>{p.adName=suggestCode(p);save();renderModal();};
  }
}
