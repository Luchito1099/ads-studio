/**
 * Persistencia del Studio en el servidor.
 *
 * El prototipo guardaba en IndexedDB con `DB.get/put/del('kv'|'media')`. Esta
 * versión mantiene esa interfaz para no tocar la app, pero guarda en la base
 * del servidor:
 *   - estado:     kv `studio:state:v2` (sin los datos de Meta)
 *   - datos Meta: kv `studio:metadata:v2` (solo se reescribe si cambian)
 *   - archivos:   bytes en /api/media/{id} (S3 o tabla `blob`),
 *                 metadatos en kv `studio:media:{id}`
 */

const STATE_KEY = "studio:state:v2";
const META_KEY = "studio:metadata:v2";
const MEDIA_KEY = (id) => `studio:media:${id}`;

async function leerJSON(key) {
  const r = await window.storage.get(key);
  return r && r.value ? JSON.parse(r.value) : null;
}

/* ---------------- archivos ---------------- */
const blobs = new Map();

async function subir(id, blob) {
  const res = await fetch(`/api/media/${encodeURIComponent(id)}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob,
  });
  if (!res.ok) throw new Error(res.status === 413 ? "El archivo es demasiado grande" : `No se pudo subir el archivo (${res.status})`);
}

async function bajar(id) {
  if (blobs.has(id)) return blobs.get(id);
  const res = await fetch(`/api/media/${encodeURIComponent(id)}`, { credentials: "same-origin" });
  if (!res.ok) return null;
  const b = await res.blob();
  blobs.set(id, b);
  return b;
}

/* ---------------- estado ---------------- */
let ultimoMeta = null;
let pendiente = null;
let enCurso = null;

async function escribirEstado(S) {
  const { metaData, ...resto } = S;
  await window.storage.set(STATE_KEY, JSON.stringify(resto));
  const meta = JSON.stringify(metaData || {});
  if (meta !== ultimoMeta) {
    await window.storage.set(META_KEY, meta);
    ultimoMeta = meta;
  }
}

// Las escrituras se encadenan: nunca viajan dos a la vez ni llegan desordenadas.
function guardarEstado(S) {
  pendiente = S;
  if (!enCurso) {
    enCurso = (async () => {
      try {
        while (pendiente) {
          const s = pendiente;
          pendiente = null;
          await escribirEstado(s);
        }
      } finally {
        enCurso = null;
      }
    })();
  }
  return enCurso;
}

export const DB = {
  async open() {},

  async get(store, key) {
    if (store === "kv") {
      const s = await leerJSON(STATE_KEY);
      if (!s) return null;
      s.metaData = (await leerJSON(META_KEY)) || {};
      ultimoMeta = JSON.stringify(s.metaData);
      return s;
    }
    const m = await DB.meta(key);
    if (!m) return null;
    return { ...m, blob: m.hasBlob ? await bajar(key) : null };
  },

  /** Solo metadatos (miniatura, tipo, duración), sin descargar el archivo. */
  meta: (id) => leerJSON(MEDIA_KEY(id)),

  async put(store, val) {
    if (store === "kv") return guardarEstado(val);
    const { blob, ...meta } = val;
    if (blob) {
      await subir(val.id, blob);
      blobs.set(val.id, blob);
    }
    await window.storage.set(MEDIA_KEY(val.id), JSON.stringify({ ...meta, hasBlob: !!blob || meta.hasBlob === true }));
  },

  async del(store, key) {
    if (store !== "media") return;
    await fetch(`/api/media/${encodeURIComponent(key)}`, { method: "DELETE", credentials: "same-origin" });
    await window.storage.delete(MEDIA_KEY(key));
    blobs.delete(key);
  },
};

/* ---------------- migración desde la versión anterior ---------------- */
const token = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const rid = (p) => p + "_" + Math.random().toString(36).slice(2, 9);

const CONCEPTOS_LEGADO = {
  PROBSOL: "Problema → Solución", TRANSF: "Transformación personal", HISTORIA: "Storytelling",
  EDUCA: "Educativo / ¿Sabías que…?", COMPARA: "Us vs Them / Comparativo", PRUEBA: "Demostración",
  LISTA: "Listicle / razones", MIEDO: "Miedo / consecuencia", AUTORIDAD: "Autoridad / experto",
  OBJECION: "Rompe-objeción", OFERTA: "Oferta / urgencia", POV: "POV", RETO: "Reto / desafío",
  SORPRESA: "Gancho de sorpresa / dato", FAQ: "Pregunta frecuente",
};
const ANGULOS_LEGADO = {
  DOLOR: "Alivio del dolor", PREVENCION: "Prevención de lesión", ACTIVO: "Seguir activo",
  ESTETICA: "Verse / sentirse bien", COMODIDAD: "Comodidad diaria", PRECIO: "Precio / ahorro",
  REGALO: "Regalo / para alguien", PADRES: "Padre-hijo", PROFESIONAL: "Uso profesional / institucional",
};
const FORMATO_LEGADO = { ESTATICA: "imagen", CARRU: "carrusel", SLIDE: "video_texto", MOTION: "video_texto" };
const ESTADO_LEGADO = { guion: "guion", vo: "produccion", edicion: "produccion", lanzado: "lanzado", testing: "testing", ganador: "testing", muerto: "testing" };
const fechaMs = (f) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(f || "");
  return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : Date.now();
};

async function miniatura(blob) {
  const img = await createImageBitmap(blob);
  const k = Math.min(1, 420 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return { thumb: c.toDataURL("image/jpeg", 0.78), w: img.width, h: img.height };
}

async function migrarImagen(imgKey, rehost) {
  try {
    const r = await window.storage.get(imgKey);
    if (!r?.value) return null;
    const res = await fetch(r.value, { credentials: "same-origin" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const id = rid("m");
    const { thumb, w, h } = await miniatura(blob);
    await DB.put("media", { id, blob, type: blob.type, kind: "image", name: "banco", thumb, w, h, size: blob.size });
    rehost[id] = { thumb, kind: "image" };
    return id;
  } catch {
    return null;
  }
}

/**
 * Convierte los guiones (`nova-ads:all:v1`) y el banco (`nova-refs:list:v1`)
 * al modelo del Studio. Devuelve null si no hay nada que migrar.
 * Las claves antiguas no se borran.
 */
export async function migrarLegado(seed, thumbCache) {
  const ads = (await leerJSON("nova-ads:all:v1")) || [];
  const refs = (await leerJSON("nova-refs:list:v1")) || [];
  if (!ads.length && !refs.length) return null;

  const S = seed();
  S.pieces = [];
  S.refs = [];
  S.seq = {};
  const legadoSeed = new Set(S.hooks.map((h) => h.id));

  // Productos
  const productoDe = (nombre) => {
    const code = token(nombre) || "NOVA";
    let p = S.products.find((x) => x.code === code);
    if (!p) {
      p = { id: rid("p"), name: nombre || code, code };
      S.products.push(p);
      S.lanes[p.id] = {
        TOFU: { objetivo: "Ventas → landing", auds: [] },
        MOFU: { objetivo: "Mensajes → WhatsApp", auds: [] },
        BOFU: { objetivo: "Mensajes → WhatsApp", auds: [] },
      };
    }
    if (S.seq[p.id] == null) S.seq[p.id] = 0;
    return p;
  };

  // Conceptos (compartidos)
  const conceptoDe = (code) => {
    if (!code) return "";
    const nombre = CONCEPTOS_LEGADO[code] || code;
    let c = S.concepts.find((x) => x.name === nombre);
    if (!c) S.concepts.push((c = { id: rid("c"), name: nombre }));
    return c.id;
  };

  // Ángulos (por producto)
  const anguloDe = (p, code) => {
    if (!code) return "";
    const nombre = ANGULOS_LEGADO[token(code)] || code;
    let a = S.angles.find((x) => x.productId === p.id && x.name.toLowerCase() === nombre.toLowerCase());
    if (!a) S.angles.push((a = { id: rid("a"), productId: p.id, name: nombre, deseo: "", desc: "", stage: "" }));
    return a.id;
  };

  const hookDe = (p, texto, extra) => {
    const t = (texto || "").trim();
    if (!t) return "";
    let h = S.hooks.find((x) => x.productId === p.id && x.text.trim().toLowerCase() === t.toLowerCase());
    if (!h) S.hooks.push((h = { id: rid("h"), productId: p.id, text: t, type: "Hablado", conceptId: "", angleId: "", stage: "", origin: "Propio", ...extra }));
    return h.id;
  };

  for (const a of ads) {
    const p = productoDe(a.producto);
    const conceptId = conceptoDe(a.ccr);
    const angleId = anguloDe(p, a.angulo);
    const num = Number(a.num) || S.seq[p.id] + 1;
    S.seq[p.id] = Math.max(S.seq[p.id], num);
    const format = FORMATO_LEGADO[a.formato] || "video";
    const voz = format === "video";
    const bloque = (tipo, tiempo, texto) => ({ id: rid("b"), tipo, tiempo, voz: voz ? texto : "", texto: voz ? "" : texto, visual: "" });
    const blocks = [];
    if (a.hook) blocks.push(bloque("Hook", "0–3 s", a.hook));
    if (a.body) blocks.push(bloque("Demostración", "3–12 s", a.body));
    if (a.cta) blocks.push(bloque("CTA", "12–15 s", a.cta));
    S.pieces.push({
      id: a.id || rid("pc"),
      productId: p.id,
      code: "SCR_" + String(num).padStart(3, "0"),
      title: a.concepto || "Sin título",
      format,
      formatoProduccion: a.formato || "",
      conceptId,
      angleId,
      hookId: hookDe(p, a.hook, { conceptId, angleId, type: voz ? "Hablado" : "Texto en pantalla" }),
      status: ESTADO_LEGADO[a.estado] || "guion",
      historico: a.estado === "ganador" ? "Ganador" : a.estado === "muerto" ? "Perdedor" : undefined,
      stage: "",
      spend: a.spend || null,
      conf: a.pedidos || null,
      delivered: null,
      mediaIds: [],
      adIds: [],
      copy: { principal: "", titulo: "", cta: "Comprar" },
      script: { blocks },
      board: null,
      created: fechaMs(a.fecha),
      adName: `AD_${token(a.producto) || "NA"}_${a.formato || "NA"}_${a.ccr || "NA"}_${token(a.angulo) || "NA"}_${String(num).padStart(3, "0")}_${a.variant || "A"}`,
      variante: a.variant || "A",
      notas: [a.notas, a.clips ? `Clips: ${a.clips}` : ""].filter(Boolean).join("\n"),
      metaSync: a.meta || undefined,
    });
  }

  const rehost = {};
  for (const r of refs) {
    const p = productoDe(r.producto);
    if (r.tipo === "hook") {
      hookDe(p, r.titulo, { origin: "Referencia", angleId: anguloDe(p, r.angulo) });
      continue;
    }
    const mediaId = r.imgKey ? await migrarImagen(r.imgKey, rehost) : null;
    const link = r.url || r.imgUrl || "";
    S.refs.push({
      id: r.id || rid("r"),
      productId: p.id,
      mediaId,
      kind: mediaId ? "image" : "link",
      brand: "",
      source: r.fuente || (link ? "Enlace" : "Subido"),
      conceptId: "",
      angleId: anguloDe(p, r.angulo),
      stage: "",
      notes: [r.titulo, r.notas, r.rescatar?.length ? `Rescatar: ${r.rescatar.join(", ")}` : "", r.tags?.length ? `Tags: ${r.tags.join(", ")}` : ""].filter(Boolean).join("\n"),
      link,
      created: fechaMs(r.fecha),
      rating: r.rating || 0,
      collection: "Banco anterior",
      format: mediaId ? "imagen" : "",
      estadoBanco: r.estado,
    });
  }
  Object.assign(thumbCache, rehost);

  // Hooks de ejemplo que no se usan en ningún producto migrado se quitan.
  const usados = new Set(S.pieces.map((p) => p.hookId));
  S.hooks = S.hooks.filter((h) => !legadoSeed.has(h.id) || usados.has(h.id) || S.pieces.some((p) => p.productId === h.productId));
  S.productId = S.pieces[0]?.productId || S.products[0].id;
  S.migradoDesde = { version: 1, en: new Date().toISOString(), guiones: ads.length, banco: refs.length };
  return S;
}

/** Datos de fatiga que llegaron por Claude o por la versión anterior y aún no se importaron. */
export async function fatigaPendiente(S) {
  try {
    const d = await leerJSON("nova-fatiga:datos:v1");
    const marca = d?.meta?.actualizado;
    if (!d?.diario?.length || !marca || marca === S.settings.fatigaSync) return null;
    return { datos: d, marca, label: `Meta · ${d.meta.cuenta || "cuenta"} · ${marca.slice(0, 10)}` };
  } catch {
    return null;
  }
}
