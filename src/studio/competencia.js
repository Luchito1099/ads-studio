import { openSettings } from "./ajustes.js";
import { traerBandeja } from "./biblioteca.js";
import { copyText } from "./guion.js";
import { hydrateThumbs, thumbHTML } from "./medios.js";
import { $, FORMATS, PID, S, UI, byId, ensureRef, esc, ic, normTxt, opt, save, toast } from "./nucleo.js";
import { openRef } from "./ref-detalle.js";
import { formModal, render, setTop } from "./vista.js";

/** Competencia: qué tiene activo hoy cada marca vigilada. */

/* ============ COMPETENCIA ============
 * El Studio guarda a quién vigilar; Claude consulta la Biblioteca de anuncios
 * de Meta y deja aquí los anuncios activos de cada marca (server/competencia.js).
 * Lo que se ve: cuántos tienen activos y desde cuándo, cuáles llevan más tiempo
 * (sus ganadores) y qué ángulos, formatos y ofertas repiten.
 */
let COMP=null, compCargando=false;
/** Olvida la última revisión que quedó en memoria: la próxima vista la vuelve a pedir. */
export function olvidarCompetencia(){ COMP=null; }
const compLista=()=>{ if(!S.competidores)S.competidores=[]; return S.competidores; };
const compId=c=>c.id||(c.nombre||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'sin-nombre';
export const dias=f=>{const t=Date.parse((f||'')+'T00:00:00');return isNaN(t)?null:Math.max(0,Math.floor((Date.now()-t)/86400000));};
function haceTexto(iso){
  const t=Date.parse(iso||''); if(isNaN(t))return 'nunca';
  const m=Math.round((Date.now()-t)/60000);
  if(m<2)return 'recién'; if(m<60)return `hace ${m} min`;
  const h=Math.round(m/60); if(h<24)return `hace ${h} h`;
  const d=Math.round(h/24); return d===1?'ayer':`hace ${d} días`;
}
async function traerCompetencia(){
  if(compCargando)return COMP; compCargando=true;
  try{ const r=await fetch('/api/competencia',{credentials:'same-origin'}); if(r.ok){COMP=await r.json();COMP.t=Date.now();} }
  catch(e){ console.warn('competencia',e); }
  finally{ compCargando=false; }
  return COMP;
}
/* Página de la Biblioteca de anuncios: se acepta el ID o la URL con view_all_page_id. */
function pageIdDe(txt){
  const t=String(txt||'').trim(); if(!t)return '';
  const m=t.match(/view_all_page_id=([0-9]+)/)||t.match(/[?&]id=([0-9]+)/)||t.match(/^([0-9]{6,})$/);
  return m?m[1]:'';
}
const compDatos=c=>COMP?.competencia?.[compId(c)]||null;
const compActivos=d=>(d?.ads||[]).filter(a=>a.activo!==false);
const compApagados=d=>(d?.ads||[]).filter(a=>a.activo===false);
/* Cuánto corrió un anuncio: hasta hoy si sigue vivo, hasta que se apagó si no. */
function compVida(a){
  const ini=Date.parse((a.inicio||'')+'T00:00:00'); if(isNaN(ini))return null;
  const fin=a.activo===false&&a.apagado?Date.parse(a.apagado+'T00:00:00'):Date.now();
  return Math.max(0,Math.floor((fin-ini)/86400000));
}
function compResumen(d){
  if(!d?.ads?.length)return null;
  const act=compActivos(d),apa=compApagados(d);
  const edades=act.map(a=>dias(a.inicio)).filter(n=>n!=null);
  const prom=edades.length?Math.round(edades.reduce((s,n)=>s+n,0)/edades.length):null;
  const vidas=apa.map(compVida).filter(n=>n!=null);
  const h=d.historico||[];
  const previo=h.length>1?h[h.length-2]:null;
  return {activos:act.length,apagados:apa.length,prom,viejo:edades.length?Math.max(...edades):null,
    vida:vidas.length?Math.round(vidas.reduce((s,n)=>s+n,0)/vidas.length):null,
    nuevos:h[h.length-1]?.nuevos||0,cambio:previo?act.length-previo.total:null};
}
/* Ángulos, formatos y ofertas: se leen de lo que ya guardaste de esa marca. */
const OFERTAS=[[/env[ií]o gratis/i,'Envío gratis'],[/contra ?entrega/i,'Pago contra entrega'],[/2 ?x ?1|2x1/i,'2x1'],
  [/[0-9]{1,2} ?% ?(de )?(dcto|descuento|off)/i,'Descuento %'],[/[uú]ltimas unidades|stock limitado/i,'Urgencia por stock'],
  [/garant[ií]a/i,'Garantía'],[/gratis/i,'Algo gratis'],[/s\/ ?[0-9]+|[0-9]+ ?soles/i,'Precio a la vista'],
  [/whatsapp|wasap/i,'Cierra por WhatsApp'],[/delivery|env[ií]o a todo/i,'Envío a todo el país']];
function perfilMarca(nombre){
  const clave=normTxt(nombre);
  const refs=S.refs.map(ensureRef).filter(r=>clave&&normTxt(r.brand||'').includes(clave));
  if(!refs.length)return {refs:[],formatos:[],angulos:[],etapas:[],ofertas:[],hooks:[]};
  const cuenta=(arr)=>{const m=new Map();arr.filter(Boolean).forEach(x=>m.set(x,(m.get(x)||0)+1));
    return [...m.entries()].sort((a,b)=>b[1]-a[1]).map(([k,n])=>({k,n}));};
  const texto=refs.map(r=>[r.adText,(r.extract.blocks||[]).map(b=>`${b.voz||''} ${b.texto||''}`).join(' ')].join(' ')).join(' ');
  const ofertas=OFERTAS.filter(([re])=>re.test(texto)).map(([,l])=>l);
  const hooks=refs.map(r=>(r.extract.blocks||[])[0]).filter(Boolean).map(b=>(b.voz||b.texto||'').trim()).filter(t=>t.length>12).slice(0,6);
  return {refs,
    formatos:cuenta(refs.map(r=>FORMATS.find(f=>f[0]===r.format)?.[1])),
    angulos:cuenta(refs.map(r=>byId(S.angles,r.angleId)?.name)),
    etapas:cuenta(refs.map(r=>r.stage)),
    ofertas,hooks};
}
export function vCompetencia(){
  const lista=compLista();
  setTop('Competencia','Qué está corriendo la competencia ahora mismo y desde cuándo',
    `<button class="btn ghost" id="crefresh">${ic('search','sm')}Actualizar</button><button class="btn" id="cadd">${ic('plus','sm')}Agregar competidor</button>`);
  const sinAgente=COMP&&COMP.agente===false;
  $('#body').innerHTML=`
    ${sinAgente?`<div class="panel" style="padding:14px 16px;margin-bottom:14px;background:var(--amber-bg);border-color:#fde68a;color:var(--amber)">
      Falta la clave para que Claude pueda dejar aquí los anuncios activos.
      <button class="lnk" id="cclave" style="margin-left:6px">Generarla en Ajustes</button></div>`:''}
    ${lista.length?`<div class="cgrid">${lista.map(compCard).join('')}</div>
      ${COMP?'':'<div class="hint" style="margin-top:12px">Cargando la última revisión…</div>'}
      <div class="panel" style="padding:16px;margin-top:16px">
        <div class="section-t">Cómo se actualiza</div>
        <p class="hint" style="margin:6px 0 10px">Dile a Claude <b>revisa la competencia</b> (o usa <code>/competencia</code>). Él consulta la Biblioteca de anuncios de Meta y deja aquí los anuncios activos de cada marca. Para quedarte con uno completo —video, copy y guion— ábrelo y guárdalo con Nova Swipe.</p>
        <button class="btn ghost sm" id="ccopy">${ic('copy','sm')}Copiar la instrucción</button>
      </div>`
    :`<div class="empty" style="text-align:left;display:flex;flex-direction:column;gap:10px;max-width:640px">
        <b style="color:var(--ink)">Todavía no vigilas a nadie</b>
        <span>Agrega las marcas con las que compites. Claude revisa su Biblioteca de anuncios y te dice cuántos anuncios tienen activos, desde cuándo corren y cuáles son sus ganadores (los que llevan más tiempo sin apagarse).</span>
        <span class="hint">Necesitas el ID de la página o el enlace de su Biblioteca de anuncios. Si no lo tienes, con el nombre de la marca y una palabra clave del producto también funciona.</span>
        <button class="btn" id="cadd2" style="align-self:flex-start">${ic('plus','sm')}Agregar competidor</button>
      </div>`}`;
  if($('#cclave'))$('#cclave').onclick=openSettings;
  $('#cadd').onclick=()=>compForm();
  if($('#cadd2'))$('#cadd2').onclick=()=>compForm();
  $('#crefresh').onclick=async()=>{await traerCompetencia();render();toast(COMP?.competencia&&Object.keys(COMP.competencia).length?'Datos actualizados':'Todavía no hay revisiones');};
  if($('#ccopy'))$('#ccopy').onclick=async()=>{toast(await copyText('Revisa la competencia en NOVA Studio: trae los anuncios activos de cada marca configurada y envíalos con la skill /competencia.')?'Instrucción copiada':'No se pudo copiar');};
  document.querySelectorAll('[data-comp]').forEach(b=>b.onclick=()=>openComp(b.dataset.comp));
  document.querySelectorAll('[data-compedit]').forEach(b=>b.onclick=e=>{e.stopPropagation();compForm(byId(compLista(),b.dataset.compedit));});
  // Se refresca al entrar si no hay datos, si faltaba la clave o si ya está viejo.
  if(!COMP||COMP.agente===false||Date.now()-(COMP.t||0)>60000)traerCompetencia().then(()=>{if(UI.view==='competencia')render();});
}
function compCard(c){
  const d=compDatos(c),r=compResumen(d);
  const perfil=perfilMarca(c.nombre);
  return `<div class="ccard" data-comp="${c.id}" tabindex="0" role="button" aria-label="Ver ${esc(c.nombre)}">
    <div class="ch"><b>${esc(c.nombre)}</b><span class="chip">${esc(c.pais||'PE')}</span>
      <button class="btn ghost sm" data-compedit="${c.id}" aria-label="Editar ${esc(c.nombre)}">${ic('concept','sm')}</button></div>
    ${r?`<div class="cnum"><b>${r.activos}</b><span>anuncios activos</span>
        ${r.cambio!=null&&r.cambio!==0?`<span class="chip ${r.cambio>0?'warn':'win'}">${r.cambio>0?'+':''}${r.cambio} vs. la revisión anterior</span>`:''}</div>
      <div class="cmini">
        <div><b>${r.prom!=null?r.prom:'—'}</b><span>días de antigüedad media</span></div>
        <div><b>${r.viejo!=null?r.viejo:'—'}</b><span>días el más viejo</span></div>
        <div><b>${r.apagados||0}</b><span>apagados en el archivo</span></div>
      </div>
      <div class="hint">Revisado ${haceTexto(d.revisado)}</div>`
    :`<div class="cnum vacio"><b>—</b><span>sin revisar todavía</span></div>
      <div class="hint">Pídele a Claude que revise la competencia.</div>`}
  </div>`;
}
function compForm(c){
  const nuevo=!c;
  c=c||{id:'',nombre:'',pageIds:[],terminos:'',pais:'PE',productId:PID(),notas:''};
  formModal(nuevo?'Agregar competidor':'Editar competidor',`
    <div class="field"><label for="cfn">Marca o tienda</label><input id="cfn" value="${esc(c.nombre)}" placeholder="Ej. Ireca Shop"></div>
    <div class="field"><label for="cfp">Página en la Biblioteca de anuncios</label><input id="cfp" value="${esc((c.pageIds||[]).join(', '))}" placeholder="Pega el enlace de su Biblioteca o el ID de la página">
      <span class="hint">Abre su Biblioteca de anuncios en Facebook y pega aquí la dirección. Puedes poner varias separadas por coma.</span></div>
    <div class="field"><label for="cft">Palabras clave del producto</label><input id="cft" value="${esc(c.terminos||'')}" placeholder="Ej. rodillera artemisa">
      <span class="hint">Se usan para encontrar sus anuncios si no tienes el ID de la página.</span></div>
    <div class="grid2">
      <div class="field"><label for="cfpa">País</label><input id="cfpa" value="${esc(c.pais||'PE')}" maxlength="2" placeholder="PE"></div>
      <div class="field"><label for="cfpr">Producto tuyo con el que compite</label><select id="cfpr">${opt(S.products,c.productId||PID())}</select></div>
    </div>
    <div class="field"><label for="cfnt">Notas</label><textarea id="cfnt" placeholder="Qué miras de esta marca">${esc(c.notas||'')}</textarea></div>`,
    ()=>{
      const nombre=$('#cfn').value.trim();
      if(!nombre){toast('Ponle nombre a la marca');return false;}
      const paginas=$('#cfp').value.split(',').map(pageIdDe).filter(Boolean);
      const datos={nombre,pageIds:paginas,terminos:$('#cft').value.trim(),
        pais:($('#cfpa').value.trim().toUpperCase()||'PE').slice(0,2),productId:$('#cfpr').value,notas:$('#cfnt').value.trim()};
      if(nuevo){ const id=compId(datos); if(compLista().some(x=>x.id===id)){toast('Ya vigilas esa marca');return false;}
        compLista().push({id,...datos,creado:Date.now()}); toast('Competidor agregado: pídele a Claude que revise'); }
      else Object.assign(c,datos);
      save();render();
    },
    nuevo?null:()=>{
      if(!confirm(`¿Dejar de vigilar a ${c.nombre}?`))return false;
      S.competidores=compLista().filter(x=>x.id!==c.id);
      fetch(`/api/competencia/${encodeURIComponent(c.id)}`,{method:'DELETE',credentials:'same-origin'}).catch(()=>{});
      if(COMP?.competencia)delete COMP.competencia[c.id];
      save();render();toast('Competidor eliminado');
    });
}
/* Detalle del competidor: sus anuncios activos con la previsualización de los
 * que ya están en la Biblioteca. Meta no entrega el creativo ni el copy por la
 * Biblioteca de anuncios: eso lo trae Nova Swipe, así que desde aquí se puede
 * pedir que los vaya a buscar. */
const compRefDe=adId=>adId?S.refs.map(ensureRef).find(r=>r.adId===adId):null;
function compAnuncioCard(a,c){
  const apagado=a.activo===false, n=apagado?compVida(a):dias(a.inicio), ref=compRefDe(a.adId);
  const ex=ref?.extract;
  const hook=ex?.status==='listo'?((ex.blocks||[])[0]?.voz||(ex.blocks||[])[0]?.texto||''):'';
  const copy=(ref?.adText||'').split(String.fromCharCode(10)).map(x=>x.trim()).find(Boolean)||'';
  const tono=apagado?'off':n>=60?'win':n>=30?'warn':'';
  return `<article class="acomp ${ref?'tiene':''} ${apagado?'apagado':''}" data-ad="${esc(a.adId)}">
    <div class="ath">${ref?.mediaId?thumbHTML(ref.mediaId):`<div class="thumb sinmedia">${ic(ref?'image':'ext')}<span>${ref?'Sin archivo':'Falta el creativo'}</span></div>`}
      <span class="adias ${tono}">${n!=null?n:'—'} d</span></div>
    <div class="acuerpo">
      <div class="atop"><b>${esc(a.titulo||ref?.adCopy?.boton||'Sin título de botón')}</b>
        <span class="muted">${apagado?`${a.inicio?esc(a.inicio):'?'} → ${esc(a.apagado||'')} · apagado`:a.inicio?`desde ${esc(a.inicio)}`:'sin fecha'}${a.pagina&&normTxt(a.pagina)!==normTxt(c.nombre)?' · '+esc(a.pagina):''}</span></div>
      ${hook?`<p class="ahook">“${esc(hook.slice(0,150))}”</p>`:''}
      ${copy?`<p class="acopy">${esc(copy.slice(0,180))}</p>`:''}
      ${!ref?`<p class="hint" style="margin:0">Guárdalo con Nova Swipe y aquí verás el video, el copy y su guion.</p>`:
        !hook?`<p class="hint" style="margin:0">${ex?.status==='procesando'?'Guardado: extrayendo el guion…':'Guardado en la Biblioteca, sin guion todavía.'}</p>`:''}
      <div class="aacc">
        ${ref?`<button class="btn ghost sm" data-verref="${ref.id}">${ic('ref','sm')}Ver ficha</button>`:''}
        <a class="btn ghost sm" href="${esc(a.enlace)}" target="_blank" rel="noopener">${ic('ext','sm')}${ref?'Ver en Meta':'Abrir y guardar'}</a>
        <span class="amono">${esc(a.adId)}</span>
      </div>
    </div></article>`;
}
function openComp(id){
  const c=byId(compLista(),id); if(!c)return;
  UI.compOpen=id;
  const d=compDatos(c),perfil=perfilMarca(c.nombre);
  const ads=compActivos(d).sort((a,b)=>(dias(b.inicio)??-1)-(dias(a.inicio)??-1));
  const apagados=compApagados(d).sort((a,b)=>(compVida(b)??-1)-(compVida(a)??-1));
  const guardados=ads.filter(a=>compRefDe(a.adId)).length;
  const r=compResumen(d);
  // Tandas: cuántos lanzaron el mismo día. Muestra su ritmo de prueba.
  const porDia=new Map();
  ads.forEach(a=>{ if(a.inicio)porDia.set(a.inicio,(porDia.get(a.inicio)||0)+1); });
  const tandas=[...porDia.entries()].filter(([,n])=>n>1).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,4);
  const pagina=(c.pageIds||[])[0]||(d?.pageIds||[])[0]||'';
  const chips=arr=>arr.slice(0,6).map(x=>`<span class="chip">${esc(x.k)} · ${x.n}</span>`).join('')||'<span class="muted">—</span>';
  const ov=document.createElement('div');ov.className='ov';ov.id='cov';
  ov.innerHTML=`<div class="modal" style="max-width:1120px" role="dialog" aria-modal="true" aria-label="${esc(c.nombre)}">
    <div class="mh"><div style="min-width:0"><b>${esc(c.nombre)}</b>
      <div class="muted" style="font-size:13px">${d?`${ads.length} anuncios activos · revisado ${haceTexto(d.revisado)}`:'Sin revisar todavía'}${c.pais?' · '+esc(c.pais):''}</div></div>
      <span style="margin-left:auto;display:flex;gap:6px;align-items:center">
        ${ads.length&&guardados<ads.length?`<button class="btn sm" id="ctraer">${ic('down','sm')}Traer creativos</button>`:''}
        ${pagina?`<a class="btn ghost sm" href="https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${esc(c.pais||'PE')}&view_all_page_id=${esc(pagina)}" target="_blank" rel="noopener">${ic('ext','sm')}Su biblioteca</a>`:''}
        <button class="btn ghost sm" id="cx" aria-label="Cerrar">${ic('x','sm')}</button></span></div>
    <div class="ccont">
      ${r?`<div class="cstats">
        <div><b>${r.activos}</b><span>activos</span></div>
        <div><b>${r.prom??'—'}</b><span>días de antigüedad media</span></div>
        <div><b>${r.viejo??'—'}</b><span>días el más viejo</span></div>
        <div><b>${guardados}/${ads.length}</b><span>con creativo guardado</span></div>
        ${r.apagados?`<div><b>${r.apagados}</b><span>apagados${r.vida!=null?` · duraron ${r.vida} días`:''}</span></div>`:''}
      </div>`:''}
      ${guardados<ads.length?`<div class="cavisa">${ic('ext','sm')}<div><b>Faltan ${ads.length-guardados} creativos.</b>
        <span>Meta no entrega el video ni el copy en esta consulta: los trae Nova Swipe. Toca <b>Traer creativos</b> y la extensión los abre y los guarda sola.
        Hazlo mientras sigan activos: cuando la marca apaga un anuncio, Meta lo saca de su biblioteca y el video ya no se puede recuperar.</span></div></div>`:''}
      ${ads.length?`<div class="section-t">Sus ganadores: los que llevan más tiempo sin apagarse</div>
        <p class="hint" style="margin:4px 0 10px">Un anuncio que lleva semanas activo casi siempre es el que les está vendiendo.</p>
        <div class="agrid">${ads.map(a=>compAnuncioCard(a,c)).join('')}</div>`
      :`<div class="empty" style="text-align:left"><b style="color:var(--ink)">Todavía no hay anuncios</b><br><span>Pídele a Claude: <b>revisa la competencia</b>.</span></div>`}
      ${apagados.length?`<div class="panel" style="padding:14px 16px;margin-top:14px">
        <button class="fhead" id="cverapagados" aria-expanded="${UI.compApagados?'true':'false'}"><b>Ya no están corriendo</b><span class="muted">${apagados.length} anuncio${apagados.length===1?'':'s'} guardado${apagados.length===1?'':'s'}</span><span class="car">${ic(UI.compApagados?'up':'down','sm')}</span></button>
        <p class="hint" style="margin:6px 0 0">Los guardo aunque la marca los apague: saber que un anuncio corrió ${apagados[0]&&compVida(apagados[0])!=null?compVida(apagados[0])+' días':'meses'} y después lo bajaron dice tanto como verlo activo.</p>
        ${UI.compApagados?`<div class="agrid" style="margin-top:12px">${apagados.map(a=>compAnuncioCard(a,c)).join('')}</div>`:''}
      </div>`:''}
      ${tandas.length?`<div class="panel" style="padding:14px 16px;margin-top:14px">
        <div class="section-t">Cómo prueban</div>
        <p class="hint" style="margin:6px 0 8px">Días en que lanzaron varios anuncios de golpe: ese es su ritmo de prueba.</p>
        <div class="chips">${tandas.map(([f,n])=>`<span class="chip">${esc(f)} · ${n} anuncios</span>`).join('')}</div></div>`:''}
      <div class="panel" style="padding:14px 16px;margin-top:14px">
        <div class="section-t">Ángulos, formatos y ofertas que usan</div>
        ${perfil.refs.length?`<div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
          <div><span class="lbl">Formatos</span><div class="chips">${chips(perfil.formatos)}</div></div>
          <div><span class="lbl">Ángulos</span><div class="chips">${chips(perfil.angulos)}</div></div>
          <div><span class="lbl">Etapas del embudo</span><div class="chips">${chips(perfil.etapas)}</div></div>
          <div><span class="lbl">Ofertas que repiten</span><div class="chips">${perfil.ofertas.map(o=>`<span class="chip ang">${esc(o)}</span>`).join('')||'<span class="muted">—</span>'}</div></div>
          ${perfil.hooks.length?`<div><span class="lbl">Sus hooks</span><ul class="whys" style="margin:6px 0 0;padding-left:18px">${perfil.hooks.map(h=>`<li>“${esc(h)}”</li>`).join('')}</ul></div>`:''}
        </div>`:`<p class="hint" style="margin:8px 0 0">Se arma con los anuncios de ${esc(c.nombre)} que tengas en la Biblioteca. Guarda dos o tres y aquí verás qué repiten.</p>`}
      </div>
      ${c.notas?`<div class="panel" style="padding:14px 16px;margin-top:14px"><div class="section-t">Tus notas</div><p class="hint" style="margin:6px 0 0;white-space:pre-line">${esc(c.notas)}</p></div>`:''}
    </div></div>`;
  document.body.appendChild(ov);
  hydrateThumbs(ov);
  const cerrar=()=>{UI.compOpen=null;ov.remove();};
  ov.querySelector('#cx').onclick=cerrar;
  ov.addEventListener('mousedown',e=>{if(e.target===ov)cerrar();});
  ov.querySelectorAll('[data-verref]').forEach(b=>b.onclick=()=>{cerrar();UI.view='referencias';render();openRef(b.dataset.verref,'guion');});
  if(ov.querySelector('#cverapagados'))ov.querySelector('#cverapagados').onclick=()=>{UI.compApagados=!UI.compApagados;ov.remove();openComp(id);};
  const traer=ov.querySelector('#ctraer');
  if(traer)traer.onclick=()=>pedirCreativos(c,[...ads,...apagados].filter(a=>!compRefDe(a.adId)),traer);
}
/* Le pide a Nova Swipe que abra los anuncios que faltan y los guarde.
 * El puente es el propio script de la extensión, que escucha en esta página. */
/* La extensión ya guardó: ahora hay que esperar a que la bandeja los traiga
 * a la Biblioteca para poder mostrar la previsualización. */
async function esperarCreativos(adIds,ms=15000){
  const hasta=Date.now()+ms;
  while(Date.now()<hasta){
    await traerBandeja();
    if(adIds.every(id=>S.refs.some(r=>r.adId===id)))return true;
    await new Promise(r=>setTimeout(r,800));
  }
  return false;
}
function pedirCreativos(c,faltan,boton){
  if(!faltan.length)return toast('Ya tienes todos los creativos');
  const lote=faltan.slice(0,12);
  let respondio=false;
  const alOir=e=>{
    if(e.source!==window||e.data?.tipo!=='nova:traer:estado')return;
    respondio=true;
    const d=e.data;
    if(d.error){toast('Nova Swipe: '+d.error);boton.disabled=false;boton.innerHTML=`${ic('down','sm')}Traer creativos`;return;}
    if(d.fin){
      window.removeEventListener('message',alOir);
      boton.innerHTML=`${ic('down','sm')}Guardando en la Biblioteca…`;
      toast(`Nova Swipe guardó ${d.listos} de ${lote.length}`);
      esperarCreativos(lote.map(a=>a.adId)).then(()=>{
        boton.disabled=false;boton.innerHTML=`${ic('down','sm')}Traer creativos`;
        if(UI.compOpen===c.id){ $('#cov')?.remove(); openComp(c.id); }
      });
      return;
    }
    boton.innerHTML=d.inicio?`${ic('down','sm')}Abriendo anuncios…`:`${ic('down','sm')}Trayendo ${d.hechos||0}/${lote.length}…`;
  };
  window.addEventListener('message',alOir);
  boton.disabled=true;boton.innerHTML=`${ic('down','sm')}Abriendo Nova Swipe…`;
  window.postMessage({tipo:'nova:traer',marca:c.nombre,productId:c.productId||PID(),
    anuncios:lote.map(a=>({adId:a.adId,enlace:a.enlace}))},location.origin);
  setTimeout(()=>{
    if(respondio)return;
    window.removeEventListener('message',alOir);
    boton.disabled=false;boton.innerHTML=`${ic('down','sm')}Traer creativos`;
    toast('No encontré Nova Swipe en este navegador: descárgala desde Biblioteca e instálala.');
  },2500);
}
