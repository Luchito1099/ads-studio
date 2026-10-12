import "./studio.css";
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
import { $, ensureRef, linkSource, PID, pidReal, S, save, seed, setS, thumbCache, toast, UI, uid } from "./nucleo.js";
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
  setTimeout(traerBandeja,500);
  // Lo que quedo sin guion (llego con la pestana cerrada o fallo a medias) se extrae solo.
  const recientes=Date.now()-7*86400000;
  setTimeout(()=>{S.refs.filter(r=>r.mediaId&&!r.extract.status&&(r.swipeId||(r.created||0)>recientes)).slice(0,5).forEach(autoExtraer);},3000);
  alPintar(pintarVista);
  pintarVista();
})();
