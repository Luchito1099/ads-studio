import "./studio.css";
import { openSettings } from "./ajustes.js";
import { vAnalisis } from "./analisis.js";
import { traerBandeja, vRefs } from "./biblioteca.js";
import { vAngles, vConcepts, vHooks } from "./catalogo.js";
import { vCompetencia } from "./competencia.js";
import { importDatos } from "./datos.js";
import { vEmbudo } from "./embudo.js";
import { autoExtraer } from "./extraccion.js";
import { vFatiga } from "./fatiga.js";
import { ensureScript } from "./guion.js";
import { vIdeas } from "./ideas.js";
import { hydrateThumbs } from "./medios.js";
import { renderSide } from "./menu.js";
import { $, ensureRef, ic, linkSource, PID, pidReal, S, save, seed, setS, thumbCache, toast, UI, uid } from "./nucleo.js";
import { DB, fatigaPendiente, migrarLegado } from "./persistencia.js";
import { vPipeline } from "./pipeline.js";
import { vPronto } from "./pronto.js";
import { vTracker } from "./tracker.js";
import { alPintar } from "./vista.js";

/**
 * Arranque del Studio.
 *
 * Cada pantalla vive en su propio módulo; aquí solo se decide cuál se pinta.
 */

/* Las pantallas viejas (Análisis 80/20, Fatiga, Tracker, Formatos, Ángulos,
 * Ideas) siguen funcionando aunque ya no estén en el menú: las pantallas nuevas
 * que todavía no existen llevan a ellas. */
const PANTALLAS={ideas:vIdeas,referencias:vRefs,angulos:vAngles,conceptos:vConcepts,hooks:vHooks,pipeline:vPipeline,
  embudo:vEmbudo,tracker:vTracker,analisis:vAnalisis,fatiga:vFatiga,competencia:vCompetencia};
function pintarVista(){ $('#body').style.overflow=''; renderSide(); const v=UI.view;
  (PANTALLAS[v]||vPronto)();
  hydrateThumbs(); }

/* Si la base nació con este arranque y no hay Postgres, el próximo despliegue
 * se la lleva por delante. Mejor decirlo arriba de todo que dejar que el
 * usuario lo descubra con la Biblioteca vacía. */
async function revisarBase(){
  try{
    const r=await fetch('/api/estado',{credentials:'same-origin'});
    if(!r.ok)return;
    const e=await r.json();
    if(e.postgres||!e.nueva)return;
    const av=$('#avisobase'); if(!av)return;
    av.hidden=false;
    av.innerHTML=`${ic('ext','sm')}<span><b>Esta base se creó hoy, al arrancar el servidor.</b> No tiene disco propio: el próximo despliegue la borra entera. Monta un volumen en <code>/data</code> o conecta Postgres.</span>
      <button class="btn ghost sm" id="avbaj">Bajar respaldo</button>
      <button class="btn ghost sm" id="avset">Cómo arreglarlo</button>
      <button class="iconbtn" id="avx" aria-label="Ocultar">${ic('x','sm')}</button>`;
    $('#avbaj').onclick=()=>{ location.href='/api/respaldo'; };
    $('#avset').onclick=()=>openSettings();
    $('#avx').onclick=()=>{ av.hidden=true; };
  }catch{}
}

(async()=>{
  let lecturaFallida=false;
  try{await DB.open();setS(await DB.get('kv','state'));}catch(e){console.warn(e);lecturaFallida=true;}
  if(lecturaFallida){setS(seed());toast('No se pudo leer la base: recarga la página. Los cambios no se guardarán.');}
  else if(!S){ try{setS(await migrarLegado(seed,thumbCache));}catch(e){console.warn('Migración',e);setS(null);}
    if(S)toast(`Datos anteriores migrados: ${S.migradoDesde.guiones} guiones y ${S.migradoDesde.banco} del banco`);
    else setS(seed());
    save(); }
  S.pieces.forEach(p=>{ensureScript(p);});
  S.refs.forEach(ensureRef); if(!S.settings.whisper)S.settings.whisper='base'; if(!S.metaData)S.metaData={}; if(!S.ideas)S.ideas=[]; if(S.settings.adAccount==null)S.settings.adAccount='338354625956825'; S.pieces.forEach(p=>{if(!p.adIds)p.adIds=[];});
  const pend=lecturaFallida?null:await fatigaPendiente(S);
  if(pend){ try{importDatos(pend.datos,pend.label);S.settings.fatigaSync=pend.marca;save();toast('Datos de Meta actualizados');}catch(e){console.warn(e);} }
  // Compartir desde TikTok, Instagram o el navegador del celular: llega como
  // /compartir?url=… gracias al manifiesto de la app instalada.
  if(location.pathname==='/compartir'){
    const q=new URLSearchParams(location.search);
    const texto=[q.get('url'),q.get('text'),q.get('title')].filter(Boolean).join(' ');
    const enlace=(texto.match(/https?:[^\s]+/)||[''])[0];
    history.replaceState(null,'','/');
    if(enlace){
      S.refs.unshift(ensureRef({id:uid('r'),productId:pidReal(),mediaId:null,kind:'link',brand:'',source:linkSource(enlace),
        conceptId:'',angleId:'',stage:'',notes:q.get('title')||'',link:enlace,created:Date.now()}));
      save(); UI.view='referencias'; setTimeout(()=>toast('Enlace guardado desde el celular'),600);
    }
  }
  revisarBase();
  setTimeout(traerBandeja,500);
  // Lo que quedo sin guion (llego con la pestana cerrada o fallo a medias) se extrae solo.
  const recientes=Date.now()-7*86400000;
  setTimeout(()=>{S.refs.filter(r=>r.mediaId&&!r.extract.status&&(r.swipeId||(r.created||0)>recientes)).slice(0,5).forEach(autoExtraer);},3000);
  alPintar(pintarVista);
  pintarVista();
})();
