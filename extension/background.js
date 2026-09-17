// Nova Swipe · service worker: menú contextual, descargas y envío al Studio.

async function config() {
  const c = await chrome.storage.local.get(["url", "token", "productId", "collection"]);
  if (c.url && c.token) return c;
  // La descarga "lista para usar" trae config.json con la dirección y la clave.
  try {
    const r = await fetch(chrome.runtime.getURL("config.json"));
    if (r.ok) {
      const j = await r.json();
      if (j.url && j.token) {
        const base = { url: j.url.replace(/\/+$/, ""), token: j.token };
        await chrome.storage.local.set(base);
        return { ...c, ...base };
      }
    }
  } catch {}
  return c;
}

async function api(c, ruta, opts = {}) {
  const r = await fetch(c.url + ruta, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${c.token}` } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `El Studio respondió ${r.status}`);
  return d;
}

function fuenteDe(u = "") {
  if (/facebook\.com\/ads\/library/i.test(u)) return "Biblioteca de Meta";
  if (/ads\.tiktok\.com|creativecenter/i.test(u)) return "TikTok Creative Center";
  if (/instagram\.com/i.test(u)) return "Instagram";
  if (/tiktok\.com/i.test(u)) return "TikTok";
  if (/facebook\.com|fb\.watch|fb\.com/i.test(u)) return "Facebook";
  if (/youtube\.com|youtu\.be/i.test(u)) return "YouTube";
  if (/pinterest\.|pin\.it/i.test(u)) return "Pinterest";
  return u ? "Otro enlace" : "Sin fuente";
}

/* ---------- cabeceras para descargar de TikTok e Instagram ----------
 * Sus servidores de video rechazan descargas sin el "Referer" de su sitio.
 * Estas reglas lo agregan solo a las descargas que hace la extensión
 * (tabId -1), nunca a la navegación normal.
 */
const REGLAS = [
  { id: 1, dominios: ["tiktok.com", "tiktokcdn.com", "tiktokcdn-us.com", "tiktokv.com", "tiktokv.us", "ibyteimg.com", "byteoversea.com", "muscdn.com"], referer: "https://www.tiktok.com/" },
  { id: 2, dominios: ["cdninstagram.com", "instagram.com"], referer: "https://www.instagram.com/" },
  { id: 3, dominios: ["fbcdn.net"], referer: "https://www.facebook.com/" },
];
async function instalarReglas() {
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: REGLAS.map((r) => r.id),
      addRules: REGLAS.map((r) => ({
        id: r.id,
        priority: 1,
        action: { type: "modifyHeaders", requestHeaders: [{ header: "referer", operation: "set", value: r.referer }] },
        condition: { requestDomains: r.dominios, tabIds: [chrome.tabs.TAB_ID_NONE], resourceTypes: ["xmlhttprequest", "other", "media"] },
      })),
    });
  } catch (err) {
    console.warn("[Nova Swipe] reglas", err);
  }
}
instalarReglas();

/* ---------- TikTok: el video real está en los datos de la página ---------- */
function buscar(obj, clave, prof = 0) {
  if (!obj || typeof obj !== "object" || prof > 12) return null;
  if (obj[clave]) return obj[clave];
  for (const v of Object.values(obj)) {
    const r = buscar(v, clave, prof + 1);
    if (r) return r;
  }
  return null;
}

async function resolverTikTok({ id, usuario }) {
  const pagina = `https://www.tiktok.com/@${usuario || "_"}/video/${id}`;
  const r = await fetch(pagina, { credentials: "include" });
  if (!r.ok) throw new Error(`TikTok respondió ${r.status}`);
  return extraerTikTok(await r.text(), id);
}

function extraerTikTok(html, id) {
  let item = null;
  for (const idScript of ["__UNIVERSAL_DATA_FOR_REHYDRATION__", "SIGI_STATE", "__NEXT_DATA__"]) {
    const m = html.match(new RegExp(`<script[^>]*id="${idScript}"[^>]*>([\\s\\S]*?)</script>`));
    if (!m) continue;
    try {
      const datos = JSON.parse(m[1]);
      item = buscar(datos, "itemStruct") || (datos.ItemModule && datos.ItemModule[id]) || null;
    } catch {}
    if (item) break;
  }
  if (!item?.video) throw new Error("TikTok no entregó los datos del video (puede pedir iniciar sesión o ser privado)");
  const v = item.video;
  const candidatos = [
    v.playAddr,
    v.downloadAddr,
    ...(v.bitrateInfo || []).flatMap((b) => b?.PlayAddr?.UrlList || []),
  ].filter((u) => typeof u === "string" && /^https?:/.test(u));
  if (!candidatos.length) throw new Error("TikTok no entregó la dirección del video");
  return {
    urls: candidatos,
    brand: item.author?.uniqueId ? `@${item.author.uniqueId}` : "",
    nombre: item.author?.nickname || "",
    adText: item.desc || "",
    id: item.id || id,
  };
}

/* ---------- descarga ---------- */
const MAX_MB = 300;
const nuevoId = () => "sw" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function descargar(urls, tipo) {
  let ultimoError = null;
  for (const u of urls) {
    try {
      let r = await fetch(u, { credentials: "include" }).catch(() => null);
      if (!r || !r.ok) r = await fetch(u);
      if (!r.ok) throw new Error(`descarga ${r.status}`);
      const blob = await r.blob();
      if (!blob.size) throw new Error("archivo vacío");
      if (blob.size > MAX_MB * 1024 * 1024) throw new Error(`pesa más de ${MAX_MB} MB`);
      if (/text\/html|json/.test(blob.type)) throw new Error("el sitio devolvió una página en vez del archivo");
      const mime = /^(video|image)\//.test(blob.type) ? blob.type : tipo === "video" ? "video/mp4" : "image/jpeg";
      return { blob, mime };
    } catch (err) {
      ultimoError = err;
    }
  }
  throw new Error(`No se pudo descargar el archivo (${ultimoError?.message || "sin respuesta"})`);
}

/**
 * p: { mediaUrl?, tipo?, tiktok?, link?, pageUrl, brand, notes, adId, adText,
 *      startedAt, productId?, collection?, source? }
 */
async function enviar(p) {
  const c = await config();
  if (!c.url || !c.token) throw new Error("Falta configurar la extensión: abre sus opciones.");
  p = { ...p };
  let urls = p.mediaUrl ? [p.mediaUrl] : [];
  let tipo = p.tipo;

  if (p.tiktok?.id && (!urls.length || tipo === "video")) {
    const t = await resolverTikTok(p.tiktok);
    urls = [...t.urls, ...urls];
    tipo = "video";
    p.brand = p.brand || t.brand;
    p.adId = p.adId || t.id;
    p.adText = p.adText || t.adText;
    if (t.nombre && !p.notes) p.notes = `Cuenta: ${t.nombre}`;
  }

  let mediaId = null;
  let mime = "";
  let fileName = "";
  if (urls.length) {
    const d = await descargar(urls, tipo);
    mime = d.mime;
    mediaId = nuevoId();
    const ext = (mime.split("/")[1] || "bin").split(";")[0].replace("jpeg", "jpg");
    const base = [p.brand, p.adId].filter(Boolean).join("_") || "anuncio";
    fileName = `${base.replace(/[^\w-]+/g, "_").slice(0, 60)}.${ext}`;
    await api(c, `/api/swipe/media/${mediaId}`, { method: "PUT", headers: { "Content-Type": mime }, body: d.blob });
  }

  const link = p.link || (p.adId && /facebook\.com\/ads\/library/.test(p.pageUrl || "") ? `https://www.facebook.com/ads/library/?id=${p.adId}` : p.pageUrl) || "";
  const { tiktok, mediaUrl, poster, plataforma, ...resto } = p;
  const r = await api(c, "/api/swipe/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...resto,
      mediaId,
      mime,
      fileName,
      link,
      source: p.source || fuenteDe(link || p.pageUrl),
      productId: p.productId ?? c.productId ?? "",
      collection: p.collection ?? c.collection ?? "",
      notes: p.notes || (mediaId ? "" : "Guardado sin archivo: adjunta el video desde la Biblioteca para extraer su guion."),
    }),
  });
  await chrome.storage.local.set({ ultimo: { ok: true, en: Date.now(), texto: `${mediaId ? "Guardado" : "Enlace guardado"}${p.brand ? ` · ${p.brand}` : ""}${p.adId ? ` · ID ${p.adId}` : ""}` } });
  return { ...r, sinArchivo: !mediaId, brand: p.brand, adId: p.adId };
}

/* ---------- indicador en el ícono ---------- */
async function marcar(tabId, texto, color) {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
    await chrome.action.setBadgeText({ tabId, text: texto });
  } catch {}
}
const limpiarLuego = (tabId) => setTimeout(() => chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {}), 4000);

/* ---------- menú contextual ---------- */
function crearMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "nova-guardar",
      title: "Guardar en Nova Studio",
      contexts: ["page", "image", "video", "link", "selection"],
    });
  });
}
chrome.runtime.onInstalled.addListener(async () => {
  crearMenu();
  instalarReglas();
  const c = await config();
  if (!c.url || !c.token) chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(() => {
  crearMenu();
  instalarReglas();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "nova-guardar" || !tab) return;
  await marcar(tab.id, "…", "#0d9488");
  try {
    let ctx = {};
    try {
      ctx = (await chrome.tabs.sendMessage(tab.id, { type: "nova:contexto" }, { frameId: info.frameId ?? 0 })) || {};
    } catch {}
    if (info.srcUrl && /^https?:/i.test(info.srcUrl)) {
      ctx.mediaUrl = info.srcUrl;
      ctx.tipo = info.mediaType === "video" ? "video" : "image";
    }
    await enviar({
      ...ctx,
      link: ctx.link || info.linkUrl || "",
      pageUrl: info.pageUrl || tab.url,
      adText: ctx.adText || info.selectionText || "",
    });
    await marcar(tab.id, "✓", "#059669");
  } catch (err) {
    await marcar(tab.id, "!", "#dc2626");
    await chrome.storage.local.set({ ultimo: { ok: false, en: Date.now(), texto: err.message } });
  }
  limpiarLuego(tab.id);
});

/* ---------- mensajes desde la página, la ventana y las opciones ---------- */
chrome.runtime.onMessage.addListener((msg, sender, responder) => {
  (async () => {
    try {
      if (msg?.type === "enviar") {
        const tabId = sender.tab?.id;
        if (tabId) await marcar(tabId, "…", "#0d9488");
        try {
          const r = await enviar(msg.payload);
          if (tabId) { await marcar(tabId, "✓", "#059669"); limpiarLuego(tabId); }
          responder({ ok: true, ...r });
        } catch (err) {
          if (tabId) { await marcar(tabId, "!", "#dc2626"); limpiarLuego(tabId); }
          await chrome.storage.local.set({ ultimo: { ok: false, en: Date.now(), texto: err.message } });
          throw err;
        }
      } else if (msg?.type === "config") responder({ ok: true, ...(await config()) });
      else if (msg?.type === "productos") {
        const c = await config();
        responder({ ok: true, ...(await api(c, "/api/swipe/products")) });
      } else if (msg?.type === "probar") {
        responder({ ok: true, ...(await api({ url: msg.url.replace(/\/+$/, ""), token: msg.token }, "/api/swipe/ping")) });
      }
    } catch (err) {
      responder({ ok: false, error: err.message });
    }
  })();
  return true;
});
