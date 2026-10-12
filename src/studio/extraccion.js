import { S, UI, byId, ensureRef, esc, normTxt, save, thumbCache, toast, uid } from "./nucleo.js";
import { DB } from "./persistencia.js";
import { renderRefModal } from "./ref-detalle.js";
import { render } from "./vista.js";

/** Saca el guion de un anuncio: fotogramas, voz (Whisper) y texto en pantalla (OCR). */

export const JOBS={}; const LIBS={whisper:null,ocr:null};
export const tstr=s=>{s=Math.max(0,Math.round(s||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
function loadScript(src){return new Promise((res,rej)=>{if(document.querySelector(`script[src="${src}"]`))return res();const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('No se pudo cargar '+src.split('/npm/')[1]));document.head.appendChild(s);});}
function setJob(id,step,pct,msg){ JOBS[id]={step,pct,msg}; document.querySelectorAll(`[data-prog="${id}"]`).forEach(el=>{el.hidden=false;el.querySelector('span').textContent=msg;el.querySelector('i').style.width=Math.round(pct)+'%';}); }
function endJob(id){ delete JOBS[id]; }
export function progHTML(id){ const j=JOBS[id]; return `<div class="prog" data-prog="${id}" ${j?'':'hidden'}><div class="bar"><i style="width:${j?j.pct:0}%"></i></div><span>${esc(j?j.msg:'')}</span></div>`; }

async function loadWhisper(model,onProgress){
  if(LIBS.whisper&&LIBS.whisper.model===model)return LIBS.whisper.pipe;
  const T=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1');
  const opts={progress_callback:p=>{if(p.status==='progress'&&p.total)onProgress(p.loaded/p.total);}};
  let pipe;
  try{ if(navigator.gpu){ pipe=await T.pipeline('automatic-speech-recognition',`onnx-community/whisper-${model}`,{...opts,device:'webgpu'}); } }catch(e){ pipe=null; }
  if(!pipe) pipe=await T.pipeline('automatic-speech-recognition',`onnx-community/whisper-${model}`,opts);
  LIBS.whisper={model,pipe}; return pipe;
}
async function loadOCR(){
  if(LIBS.ocr)return LIBS.ocr;
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
  const w=await Tesseract.createWorker('spa+eng');
  await w.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});
  LIBS.ocr=w; return w;
}
function seekTo(v,t){return new Promise(res=>{const on=()=>{v.removeEventListener('seeked',on);res();};v.addEventListener('seeked',on);v.currentTime=Math.min(t,Math.max(0,(v.duration||t)-0.05));});}
async function captureFrames(blob,onStep){
  const url=URL.createObjectURL(blob); const v=document.createElement('video'); v.muted=true; v.playsInline=true; v.preload='auto'; v.src=url;
  await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(new Error('El navegador no pudo abrir este video'));});
  // Algunos webm no traen la duración hasta leerse completos: se fuerza su cálculo.
  if(!isFinite(v.duration)){ await new Promise(res=>{const on=()=>{if(isFinite(v.duration)){v.removeEventListener('durationchange',on);res();}};v.addEventListener('durationchange',on);v.currentTime=1e7;setTimeout(res,4000);}); }
  const dur=isFinite(v.duration)?v.duration:0; const step=Math.min(3,Math.max(1,dur/30)); const out=[];
  const small=document.createElement('canvas'), big=document.createElement('canvas');
  for(let t=Math.min(.3,dur/2); t<dur && out.length<40; t+=step){
    await seekTo(v,t);
    const w=v.videoWidth,h=v.videoHeight; if(!w)continue;
    small.width=180; small.height=Math.round(h*180/w); small.getContext('2d').drawImage(v,0,0,small.width,small.height);
    big.width=Math.min(900,w); big.height=Math.round(h*big.width/w); big.getContext('2d').drawImage(v,0,0,big.width,big.height);
    const bc=document.createElement('canvas'); bc.width=big.width; bc.height=big.height; bc.getContext('2d').drawImage(big,0,0);
    out.push({t,thumb:small.toDataURL('image/jpeg',.7),canvas:bc});
    onStep(out.length/Math.max(1,Math.ceil(dur/step)));
  }
  URL.revokeObjectURL(url); return {frames:out,duration:dur};
}
async function audioMono16k(blob){
  const buf=await blob.arrayBuffer(); const Ctx=window.AudioContext||window.webkitAudioContext;
  const ctx=new Ctx({sampleRate:16000}); try{ const a=await ctx.decodeAudioData(buf);
    if(a.numberOfChannels===1)return a.getChannelData(0);
    const L=a.getChannelData(0),R=a.getChannelData(1),m=new Float32Array(L.length); for(let i=0;i<L.length;i++)m[i]=(L[i]+R[i])/2; return m;
  }finally{ctx.close();}
}
function similar(a,b){const A=new Set(normTxt(a).split(' ')),B=new Set(normTxt(b).split(' '));if(!A.size||!B.size)return 0;let i=0;A.forEach(w=>{if(B.has(w))i++;});return i/Math.max(A.size,B.size);}
/* ---- texto en pantalla (OCR) ----
 * Tesseract lee mal el fotograma tal cual: texto chico sobre fondos con mucho
 * detalle. Se agranda el fotograma, se aíslan las letras claras (blancas o
 * amarillas, lo típico en TikTok y Reels) y las oscuras, y solo se aceptan
 * líneas con buena confianza y que parecen palabras. Si no hay texto, no se
 * inventa: el tramo queda vacío.
 */
function prepararOCR(src){
  const escala=Math.min(2.2,1280/src.width);
  const W=Math.round(src.width*escala),H=Math.round(src.height*escala);
  const base=document.createElement('canvas');base.width=W;base.height=H;
  const cx=base.getContext('2d',{willReadFrequently:true});cx.imageSmoothingQuality='high';cx.drawImage(src,0,0,W,H);
  const d=cx.getImageData(0,0,W,H).data;
  const claro=new ImageData(W,H),oscuro=new ImageData(W,H);
  for(let i=0;i<d.length;i+=4){
    const r=d[i],g=d[i+1],b=d[i+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b),lum=0.299*r+0.587*g+0.114*b;
    const letraClara=(lum>200&&mx-mn<45)||(r>200&&g>170&&b<110);
    const letraOscura=lum<55&&mx-mn<40;
    claro.data[i]=claro.data[i+1]=claro.data[i+2]=letraClara?0:255;claro.data[i+3]=255;
    oscuro.data[i]=oscuro.data[i+1]=oscuro.data[i+2]=letraOscura?0:255;oscuro.data[i+3]=255;
  }
  return [claro,oscuro].map(img=>{const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').putImageData(img,0,0);return c;});
}
const OCR_PALABRA=/^[¿¡"“'(]*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9$][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9%$.,'’\/-]*[?!.,:;"”')]*$/;
const OCR_VOCAL=/[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]/;
const soloLetras=t=>t.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g,'');
function palabraOCR(t){
  t=t.trim(); if(!OCR_PALABRA.test(t))return false;
  const nucleo=t.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9%$]/g,''); if(!nucleo)return false;
  if(/^(S\/|\$)?\d+([.,]\d+)?%?$/.test(t.replace(/[¿¡"“”'()?!.,:;]+$/,'')))return true; // precios, porcentajes, cantidades
  const letras=soloLetras(nucleo);
  if(letras.length<=1)return /^[aeoyuAEOYUóÓ]$/.test(letras)&&nucleo.length===1;
  if(!OCR_VOCAL.test(letras)||/(.)\1\1/i.test(letras))return false;
  if(/[a-záéíóúñ][A-ZÁÉÍÓÚÑ]/.test(letras))return false; // mezcla rara de mayúsculas
  if(letras.length>=5&&!/[aeiouáéíóú][^aeiouáéíóú]|[^aeiouáéíóú][aeiouáéíóú]/i.test(letras))return false;
  return true;
}
/* Devuelve { texto, dudoso }: lo que se leyó con confianza y, aparte, lo que se
 * leyó mal. Lo dudoso no se mezcla con el guion, pero se guarda para poder
 * mostrar "texto en pantalla ilegible · ver lo leído" en vez de dejarlo en blanco. */
async function leerTextoPantalla(worker,fuente){
  const hallado=[],turbio=[];
  for(const lienzo of prepararOCR(fuente)){
    const {data}=await worker.recognize(lienzo);
    const lineas=data.lines||(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[]));
    for(const l of lineas){
      const todas=(l.words||[]).filter(w=>w.text.trim());
      if(!todas.length)continue;
      const crudo=todas.map(w=>w.text.trim()).join(' ');
      const buenas=todas.filter(w=>w.confidence>=65&&palabraOCR(w.text));
      // Se toleran palabras dudosas sueltas (fotogramas de transición) si queda una frase clara.
      const claro=l.confidence>=70
        &&buenas.length/todas.length>=0.6
        &&!(buenas.length<2&&soloLetras(buenas[0]?.text||'').length<5)
        &&buenas.some(w=>soloLetras(w.text).length>=3)
        &&buenas.filter(w=>soloLetras(w.text).length<=2).length<=buenas.length/2
        &&buenas.reduce((s,w)=>s+soloLetras(w.text).length,0)>=4;
      if(claro)hallado.push({texto:buenas.map(w=>w.text.trim()).join(' '),y:l.bbox?.y0??0});
      else if(soloLetras(crudo).length>=4)turbio.push({texto:crudo,y:l.bbox?.y0??0});
    }
  }
  const juntar=arr=>{const u=[];arr.sort((a,b)=>a.y-b.y).forEach(h=>{if(!u.some(x=>similar(x.texto,h.texto)>.6))u.push(h);});return u.map(x=>x.texto).join(' / ');};
  return {texto:juntar(hallado),dudoso:juntar(turbio).slice(0,280)};
}
function cleanOCR(text){ return String(text||'').split('\n').map(l=>l.trim()).filter(l=>{const w=l.split(/\s+/).filter(x=>/[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/.test(x));return w.length>=1&&l.length>=3&&w.join('').length/l.replace(/\s/g,'').length>.6;}).join(' ').trim(); }
function buildBlocks(ref){
  const ex=ref.extract, dur=ex.duration||0; const tr=ex.transcript||[], oc=ex.ocr||[];
  const frameAt=t=>{let best=0;(ex.frames||[]).forEach((f,i)=>{if(Math.abs(f.t-t)<Math.abs(ex.frames[best].t-t))best=i;});return ex.frames.length?best:-1;};
  const ocrIn=(a,b)=>[...new Set(oc.filter(o=>o.t>=a&&o.t<b&&o.text).map(o=>o.text))].join(' / ');
  const ilegIn=(a,b)=>[...new Set(oc.filter(o=>o.t>=a&&o.t<b&&!o.text&&o.dudoso).map(o=>o.dudoso))].join(' / ');
  const segs=[];
  if(tr.length){ let cur=null; tr.forEach(c=>{ if(!cur)cur={start:c.start,end:c.end,voz:c.text}; else {cur.end=c.end;cur.voz+=' '+c.text;}
      if(cur.end-cur.start>=3){segs.push(cur);cur=null;} }); if(cur)segs.push(cur); }
  else if(oc.length){ oc.forEach((o,i)=>{const end=i+1<oc.length?oc[i+1].t:dur;segs.push({start:o.t,end,voz:''});}); }
  else{ for(let t=0;t<Math.max(dur,1);t+=3)segs.push({start:t,end:Math.min(dur,t+3),voz:''}); }
  return segs.map((s,i)=>({id:uid('b'),tipo:i===0?'Hook':(i===segs.length-1&&segs.length>2?'CTA':''),tiempo:`${tstr(s.start)}–${tstr(s.end)}`,start:s.start,end:s.end,voz:s.voz.trim(),texto:ocrIn(s.start,Math.max(s.end,s.start+.01)),ilegible:ilegIn(s.start,Math.max(s.end,s.start+.01)),visual:'',frame:frameAt(s.start)}));
}
export async function runExtract(ref,{voz=true,texto=true}={}){
  ensureRef(ref); if(JOBS[ref.id])return; if(!ref.mediaId){toast('Adjunta primero el archivo de este anuncio');return;}
  const m=await DB.get('media',ref.mediaId); if(!m||!m.blob){toast('El archivo original no está en este navegador');return;}
  const ex=ref.extract; ex.status='procesando';
  try{
    if(m.kind==='image'){
      setJob(ref.id,'ocr',10,'Leyendo texto de la imagen…');
      const img=await createImageBitmap(m.blob); const c=document.createElement('canvas'); c.width=Math.min(1200,img.width); c.height=Math.round(img.height*c.width/img.width); c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      const w=await loadOCR(); setJob(ref.id,'ocr',50,'Leyendo texto de la imagen…');
      const {texto:txt,dudoso}=await leerTextoPantalla(w,c);
      ex.frames=[{t:0,thumb:thumbCache[ref.mediaId]?.thumb||''}]; ex.ocr=(txt||dudoso)?[{t:0,text:txt,dudoso}]:[]; ex.transcript=[]; ex.duration=0;
      ex.blocks=[{id:uid('b'),tipo:'Hook',tiempo:'',start:0,voz:'',texto:txt,ilegible:txt?'':dudoso,visual:'',frame:0}];
    }else{
      setJob(ref.id,'frames',2,'Sacando fotogramas…');
      const {frames,duration}=await captureFrames(m.blob,p=>setJob(ref.id,'frames',2+p*23,`Sacando fotogramas… ${Math.round(p*100)}%`));
      ex.duration=duration; ex.frames=frames.map(f=>({t:f.t,thumb:f.thumb}));
      ex.transcript=[];
      if(voz){
        setJob(ref.id,'audio',27,'Leyendo el audio…');
        let audio=null; try{audio=await audioMono16k(m.blob);}catch(e){toast('No se pudo leer el audio: se extrae solo el texto en pantalla');}
        if(audio){
          const pipe=await loadWhisper(S.settings.whisper||'base',p=>setJob(ref.id,'model',28+p*12,`Descargando modelo de voz (solo la primera vez)… ${Math.round(p*100)}%`));
          setJob(ref.id,'asr',42,'Transcribiendo la voz… puede tardar un poco');
          const out=await pipe(audio,{language:'spanish',task:'transcribe',return_timestamps:true,chunk_length_s:30,stride_length_s:5});
          ex.transcript=(out.chunks||[{timestamp:[0,duration],text:out.text||''}]).map(c=>({start:c.timestamp[0]||0,end:c.timestamp[1]??duration,text:String(c.text||'').trim()})).filter(c=>c.text);
        }
      }
      ex.ocr=[];
      // Si el lector de texto no carga o falla a medias, igual se guarda la voz.
      if(texto){
       try{
        const w=await loadOCR(); let prev='', ultimoOCR=-9;
        for(let i=0;i<frames.length;i++){
          setJob(ref.id,'ocr',62+36*(i/frames.length),`Leyendo texto en pantalla… ${i+1}/${frames.length}`);
          if(duration>60&&i>0&&frames[i].t-ultimoOCR<1.5)continue; ultimoOCR=frames[i].t;
          const {texto:txt,dudoso}=await leerTextoPantalla(w,frames[i].canvas);
          if(!txt){
            const antes=ex.ocr[ex.ocr.length-1];
            if(dudoso&&!(antes&&!antes.text&&similar(dudoso,antes.dudoso)>=.5))ex.ocr.push({t:frames[i].t,text:'',dudoso});
            prev='';continue;
          }
          const ult=[...ex.ocr].reverse().find(o=>o.text);
          // Mismo texto que el fotograma anterior: se queda la lectura más completa.
          if(prev&&ult&&similar(txt,ult.text)>=.5){ if(txt.length>ult.text.length)ult.text=txt; }
          else ex.ocr.push({t:frames[i].t,text:txt});
          prev=txt;
        }
       }catch(err){ console.warn('OCR',err); toast('No se pudo leer el texto en pantalla: se guarda el resto del guion'); }
      }
      setJob(ref.id,'build',99,'Armando el guion…');
      ex.blocks=buildBlocks(ref);
    }
    ex.status='listo'; ex.at=Date.now(); if(!ref.format)ref.format=m.kind==='image'?'imagen':(ex.transcript.length?'video':'video_texto');
    save(); toast('Guion extraído');
  }catch(err){ console.error(err); ex.status='error'; ex.error=err.message; save(); toast('No se pudo extraer: '+err.message); }
  finally{ endJob(ref.id); if(UI.view==='referencias')render(); if(UI.refOpen===ref.id){ if(ex.status==='listo')UI.refTab='guion'; renderRefModal(); } }
}

/* ---- extracción automática ----
 * Lo que llega con archivo (Nova Swipe, arrastrado o adjuntado) se extrae solo:
 * de a uno, para no saturar el navegador. Se apaga desde Ajustes. */
const COLA_AUTO=[]; let colaCorriendo=false;
export function autoExtraer(r){
  if(!r||!r.mediaId||r.kind==='link')return;
  if(S.settings&&S.settings.autoExtraer===false)return;
  ensureRef(r); const ex=r.extract;
  if(ex.status==='listo'||ex.status==='procesando'||JOBS[r.id])return;
  if((ex.intentos||0)>=2||COLA_AUTO.includes(r.id))return;
  COLA_AUTO.push(r.id); correrColaAuto();
}
async function correrColaAuto(){
  if(colaCorriendo)return; colaCorriendo=true;
  try{
    while(COLA_AUTO.length){
      const r=byId(S.refs,COLA_AUTO.shift()); if(!r)continue;
      ensureRef(r); if(r.extract.status==='listo'||JOBS[r.id])continue;
      r.extract.intentos=(r.extract.intentos||0)+1;
      await runExtract(r,{voz:r.kind!=='image',texto:true});
    }
  }finally{ colaCorriendo=false; }
}
