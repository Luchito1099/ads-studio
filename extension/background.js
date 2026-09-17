// Nova Swipe · service worker: menú contextual y envío al Studio.

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

const nuevoId = () => "sw" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const MAX_MB = 300;

/**
 * p: { mediaUrl?, tipo?, link?, pageUrl, brand, notes, adId, adText,
 *      startedAt, productId?, collection?, source? }
 */
async function enviar(p) {
  const c = await config();
  if (!c.url || !c.token) throw new Error("Falta configurar la extensión: abre sus opciones.");
  let mediaId = null;
  let mime = "";
  let fileName = "";
  if (p.mediaUrl) {
    const r = await fetch(p.mediaUrl, { credentials: "include" }).catch(() => fetch(p.mediaUrl));
    if (!r.ok) throw new Error(`No se pudo descargar el archivo (${r.status})`);
    const blob = await r.blob();
    if (blob.size > MAX_MB * 1024 * 1024) throw new Error(`El archivo pesa más de ${MAX_MB} MB`);
    mime = /^(video|image)\//.test(blob.type) ? blob.type : p.tipo === "video" ? "video/mp4" : "image/jpeg";
    mediaId = nuevoId();
    const ext = (mime.split("/")[1] || "bin").split(";")[0].replace("jpeg", "jpg");
    fileName = `${(p.brand || "anuncio").replace(/[^\w-]+/g, "_").slice(0, 40)}.${ext}`;
    await api(c, `/api/swipe/media/${mediaId}`, { method: "PUT", headers: { "Content-Type": mime }, body: blob });
  }
  const link = p.link || (p.adId ? `https://www.facebook.com/ads/library/?id=${p.adId}` : p.pageUrl) || "";
  return api(c, "/api/swipe/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...p,
      mediaId,
      mime,
      fileName,
      link,
      source: p.source || fuenteDe(link || p.pageUrl),
      productId: p.productId ?? c.productId ?? "",
      collection: p.collection ?? c.collection ?? "",
    }),
  });
}

/* ---------- indicador en el ícono ---------- */
async function marcar(tabId, texto, color) {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
    await chrome.action.setBadgeText({ tabId, text: texto });
  } catch {}
}
function limpiarLuego(tabId) {
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {}), 4000);
}

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
  const c = await config();
  if (!c.url || !c.token) chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(crearMenu);

async function contextoDe(tab, frameId) {
  try {
    return (await chrome.tabs.sendMessage(tab.id, { type: "nova:contexto" }, { frameId: frameId ?? 0 })) || {};
  } catch {
    return {};
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "nova-guardar" || !tab) return;
  await marcar(tab.id, "…", "#0d9488");
  try {
    const ctx = await contextoDe(tab, info.frameId);
    let mediaUrl = "";
    let tipo = "";
    if (info.srcUrl && /^https?:/i.test(info.srcUrl)) {
      mediaUrl = info.srcUrl;
      tipo = info.mediaType === "video" ? "video" : "image";
    } else if (ctx.videoUrl) {
      mediaUrl = ctx.videoUrl;
      tipo = "video";
    } else if (!info.linkUrl && ctx.imageUrl) {
      mediaUrl = ctx.imageUrl;
      tipo = "image";
    }
    await enviar({
      mediaUrl,
      tipo,
      link: ctx.link || info.linkUrl || "",
      pageUrl: info.pageUrl || tab.url,
      brand: ctx.brand || "",
      adId: ctx.adId || "",
      adText: ctx.adText || info.selectionText || "",
      startedAt: ctx.startedAt || "",
      notes: mediaUrl ? "" : "Guardado sin archivo: adjunta el video desde la Biblioteca para extraer su guion.",
    });
    await marcar(tab.id, "✓", "#059669");
    await chrome.storage.local.set({ ultimo: { ok: true, en: Date.now(), texto: mediaUrl ? "Anuncio guardado" : "Enlace guardado" } });
  } catch (err) {
    await marcar(tab.id, "!", "#dc2626");
    await chrome.storage.local.set({ ultimo: { ok: false, en: Date.now(), texto: err.message } });
  }
  limpiarLuego(tab.id);
});

/* ---------- mensajes desde la ventana y las opciones ---------- */
chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  (async () => {
    try {
      if (msg?.type === "enviar") responder({ ok: true, ...(await enviar(msg.payload)) });
      else if (msg?.type === "config") responder({ ok: true, ...(await config()) });
      else if (msg?.type === "productos") {
        const c = await config();
        responder({ ok: true, ...(await api(c, "/api/swipe/products")) });
      } else if (msg?.type === "probar") {
        const c = { url: msg.url.replace(/\/+$/, ""), token: msg.token };
        responder({ ok: true, ...(await api(c, "/api/swipe/ping")) });
      }
    } catch (err) {
      responder({ ok: false, error: err.message });
    }
  })();
  return true;
});
