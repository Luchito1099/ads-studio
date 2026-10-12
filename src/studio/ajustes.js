import { olvidarCompetencia } from "./competencia.js";
import { PREP_CACHE } from "./datos.js";
import { copyText } from "./guion.js";
import { thumbOf } from "./medios.js";
import { instalarApp } from "./menu.js";
import { $, S, esc, ic, save, setS, thumbCache, toast } from "./nucleo.js";
import { DB, permitirBorrado } from "./persistencia.js";
import { formModal, render } from "./vista.js";

/** Ajustes: marca, almacenamiento, clave del agente y respaldos. */

/* Aviso de persistencia: si la base nace en cada arranque, cada despliegue
 * borra lo guardado (SQLite sin volumen). Mejor decirlo que dejar que el
 * usuario descubra que perdió sus anuncios. */
function bloqueAlmacen(e){
  if(!e)return '';
  const nacio=Date.parse(e.creado||'');
  const efimera=!e.postgres&&e.nueva;
  const fecha=isFinite(nacio)?new Date(nacio).toLocaleDateString('es-PE',{day:'numeric',month:'long',year:'numeric'}):'—';
  return `<div class="panel" style="padding:12px 14px;background:${efimera?'#fff7ed':'#f8fafc'};border-color:${efimera?'#fed7aa':'var(--line)'}">
    <div class="section-t">Dónde se guardan tus datos</div>
    <p class="hint" style="margin:6px 0 0">${esc(e.base)} · imágenes: ${esc(e.imagenes)}</p>
    ${efimera?`<p style="margin:8px 0 0;color:var(--amber);line-height:1.45;font-size:13px">
        <b>Ojo:</b> esta base se creó en el arranque de ahora (${esc(fecha)}), no antes. Es la señal de que el servidor
        no tiene disco persistente: cada vez que se actualiza la app, todo lo guardado vuelve a cero.
        En Coolify agrega un volumen que apunte a <code>/data</code>, o una base Postgres con <code>DATABASE_URL</code>.
        Mientras tanto, baja el <b>respaldo completo</b> de aquí abajo antes de cada actualización.</p>`
      :`<p class="hint" style="margin:6px 0 0">Base creada el ${esc(fecha)} · ${e.arranques} arranques del servidor: tus datos sobreviven a las actualizaciones.</p>`}
  </div>`;
}
/* El respaldo que de verdad sirve: el JSON de "Exportar datos" se lleva los
 * textos y las miniaturas, pero los videos originales se quedan en el servidor.
 * Este .zip se los lleva también, y se puede devolver con un solo comando. */
function bloqueRespaldo(r){
  const peso=r&&r.bytes?(r.bytes>=1048576?(r.bytes/1048576).toFixed(0)+' MB':Math.max(1,Math.round(r.bytes/1024))+' KB'):null;
  return `<div class="panel" style="padding:12px 14px">
    <div class="section-t">Respaldo completo</div>
    ${r?`<p class="hint" style="margin:6px 0 8px"><b class="mono">${r.anuncios}</b> anuncio${r.anuncios===1?'':'s'} · <b class="mono">${r.medios}</b> archivo${r.medios===1?'':'s'}${peso?` · <b class="mono">${peso}</b>`:''}. Todo eso entra en un solo .zip, videos incluidos.</p>`
      :`<p class="hint" style="margin:6px 0 8px">Baja en un solo .zip todo lo guardado, con los videos y las imágenes adentro.</p>`}
    <a class="btn" id="strespaldo" href="/api/respaldo" download>${ic('down','sm')}Descargar respaldo completo</a>
    <p class="hint" style="margin:8px 0 0">Tarda lo que pesen los videos. Para devolverlo, desde la carpeta del proyecto:
      <code>node scripts/restaurar.mjs respaldo.zip</code></p>
  </div>`;
}
/* Clave del canal de Claude: se puede generar desde aqui cuando no hay forma
 * comoda de tocar las variables de entorno del servidor. */
function bloqueClave(c){
  const enEntorno=c&&c.origen==='entorno';
  return `<div class="panel" style="padding:12px 14px">
    <div class="section-t">Conexión con Claude</div>
    <p class="hint" style="margin:6px 0 8px">Con esta clave Claude deja en la app los datos de Meta y los anuncios activos de la competencia. No es una credencial de Meta.</p>
    ${c&&c.hay?`<p class="hint" style="margin:0;color:var(--accent-ink)">${ic('check','sm')}${enEntorno?'Configurada en el servidor (SYNC_TOKEN).':'Lista: generada desde aquí y guardada en la base.'}</p>`
      :`<p class="hint" style="margin:0;color:var(--amber)">Todavía no hay clave: sin ella Claude no puede dejarte datos.</p>`}
    ${c&&c.clave?`<div class="withbtn" style="margin-top:8px"><input id="stkey" readonly value="${esc(c.clave)}" style="font-family:var(--mono);font-size:12px"><button class="btn ghost sm" id="stkeycopy">Copiar</button></div>
      <p class="hint" style="margin:6px 0 0">Pégala en el archivo <code>.env</code> de tu carpeta del proyecto, en la línea <code>SYNC_TOKEN=</code>. Después dile a Claude: <b>revisa la competencia</b>.</p>`:''}
    ${enEntorno?'':`<button class="btn sm" id="stkeynew" style="margin-top:8px">${c&&c.hay?'Generar una clave nueva':'Generar clave'}</button>`}
  </div>`;
}
/* Cómo llevarse el Studio al celular. No hay APK: en Android se instala desde
 * Chrome y queda como una app más, con su icono y a pantalla completa. */
function bloqueCelular(){
  const instalada=matchMedia('(display-mode: standalone)').matches;
  return `<div class="panel" style="padding:12px 14px">
    <div class="section-t">La app en el celular</div>
    ${instalada?`<p class="hint" style="margin:6px 0 0;color:var(--accent-ink)">${ic('check','sm')}Ya la estás usando instalada.</p>`
    :`<p class="hint" style="margin:6px 0 8px">Se instala desde el navegador y queda con su icono, a pantalla completa, sin pasar por ninguna tienda.</p>
      <button class="btn sm" id="stinstalar">${ic('down','sm')}Instalar ahora</button>
      <ul class="whys" style="margin:10px 0 0;padding-left:18px">
        <li><b>Android:</b> abre esta página en Chrome y toca <b>Instalar ahora</b>, o el menú ⋮ → <b>Instalar aplicación</b>.</li>
        <li><b>iPhone:</b> en Safari, botón Compartir → <b>Añadir a pantalla de inicio</b>.</li>
      </ul>`}
    <p class="hint" style="margin:10px 0 0">Ya instalada, al compartir un anuncio desde TikTok, Instagram o Facebook te aparece <b>NOVA Ads</b> en la lista: el enlace entra solo a la Biblioteca.</p>
  </div>`;
}
export async function openSettings(){
  let estado=null,clave=null,respaldo=null;
  try{ const r=await fetch('/api/estado',{credentials:'same-origin'}); if(r.ok)estado=await r.json(); }catch(e){}
  try{ const r=await fetch('/api/sync/clave',{credentials:'same-origin'}); if(r.ok)clave=await r.json(); }catch(e){}
  try{ const r=await fetch('/api/respaldo/resumen',{credentials:'same-origin'}); if(r.ok)respaldo=await r.json(); }catch(e){}
  formModal('Ajustes',`
    ${bloqueAlmacen(estado)}
    ${bloqueRespaldo(respaldo)}
    ${bloqueClave(clave)}
    ${bloqueCelular()}
    <div class="grid3">
     <div class="field"><label for="stu">Tope CPA (USD)</label><input id="stu" type="number" step="0.1" value="${S.settings.topeUSD}"></div>
     <div class="field"><label for="stc">Tipo de cambio</label><input id="stc" type="number" step="0.01" value="${S.settings.tc}"></div>
     <div class="field"><label for="stm">Muestra mínima</label><input id="stm" type="number" step="1" value="${S.settings.muestra}"></div>
    </div>
    <div class="field"><label for="sta">ID de la cuenta publicitaria (para abrir anuncios en Ads Manager)</label><input id="sta" value="${esc(S.settings.adAccount||'')}" placeholder="Ej. 338354625956825"></div>
    <div class="field"><label class="ck" for="stauto"><input type="checkbox" id="stauto" ${S.settings.autoExtraer===false?'':'checked'}> Extraer el guion solo, apenas llega un video o una imagen</label></div>
    <div class="field"><label for="stw">Modelo para transcribir voz</label><select id="stw">${[['tiny','Rápido (menos preciso, ~40 MB)'],['base','Equilibrado (~80 MB)'],['small','Preciso (más lento, ~250 MB)']].map(([k,l])=>`<option value="${k}" ${k===(S.settings.whisper||'base')?'selected':''}>${l}</option>`).join('')}</select></div><div class="hint">Una pieza pasa a Resultado cuando llega a la muestra mínima de confirmados. Gana si su CPA real es igual o menor al tope.</div>`,
    ()=>{S.settings.topeUSD=+$('#stu').value||5;S.settings.tc=+$('#stc').value||3.7;S.settings.muestra=Math.max(1,+$('#stm').value||10);S.settings.whisper=$('#stw').value;S.settings.autoExtraer=$('#stauto').checked;S.settings.adAccount=$('#sta').value.trim();PREP_CACHE.clear();save();render();});
  const modal=[...document.querySelectorAll('.ov')].pop();
  const gen=modal?.querySelector('#stkeynew');
  if(gen)gen.onclick=async()=>{
    if(clave?.hay&&!confirm('La clave anterior dejará de servir. ¿Generar una nueva?'))return;
    gen.disabled=true;
    try{
      const r=await fetch('/api/sync/clave',{method:'POST',credentials:'same-origin'});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||'No se pudo generar');
      olvidarCompetencia(); modal.remove(); openSettings(); toast('Clave generada: pégala en tu archivo .env');
    }catch(e){ gen.disabled=false; toast(e.message); }
  };
  const inst=modal?.querySelector('#stinstalar');
  if(inst)inst.onclick=instalarApp;
  const cop=modal?.querySelector('#stkeycopy');
  if(cop)cop.onclick=async()=>{const el=modal.querySelector('#stkey');toast(await copyText(el.value,el)?'Clave copiada':'Selecciona y copia el texto');};
}

/* ============ EXPORTAR / IMPORTAR ============ */
export async function exportData(){
  const data=JSON.parse(JSON.stringify(S)); data.thumbs={};
  const ids=new Set([...S.refs.map(r=>r.mediaId),...S.pieces.flatMap(p=>p.mediaIds)].filter(Boolean));
  for(const id of ids){const t=await thumbOf(id);if(t)data.thumbs[id]=t;}
  const blob=new Blob([JSON.stringify(data)],{type:'application/json'});const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='studio-de-ads-'+new Date().toISOString().slice(0,10)+'.json';a.click();
  toast('Datos exportados. Para llevarte también los videos, usa el respaldo completo de Ajustes');
}
$('#importpick').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const d=JSON.parse(await f.text());if(!d.pieces||!d.products)throw new Error('Archivo no válido');
    if(!confirm('Esto reemplaza los datos actuales. ¿Continuar?'))return;
    permitirBorrado();
    for(const [id,t] of Object.entries(d.thumbs||{})){const ex=await DB.get('media',id);if(!ex)await DB.put('media',{id,blob:null,type:'',kind:t.kind,name:'importado',thumb:t.thumb,duration:t.duration});thumbCache[id]=t;}
    delete d.thumbs;setS(d);save();render();toast('Datos importados');
  }catch(err){toast('No se pudo importar: '+err.message);}
});
