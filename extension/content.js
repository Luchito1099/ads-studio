// Nova Swipe · script de página.
// - Botón "Guardar" sobre cada video o imagen al pasar el mouse.
// - Detecta ID y marca del anuncio o publicación según la plataforma.
// - Responde a la ventana de la extensión y al menú contextual.
(() => {
  if (window.__novaSwipe) return;
  window.__novaSwipe = true;

  const http = (u) => /^https?:/i.test(u || "");
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return ""; } };
  const meta = (n) => document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.content || "";
  const limpio = (t) => (t || "").replace(/\s+/g, " ").trim();
  const REDES = /^(Facebook|Instagram|TikTok|YouTube|Pinterest|Meta)$/i;

  function plataforma() {
    const h = location.hostname;
    if (/facebook\.com$/.test(h) && location.pathname.startsWith("/ads/library")) return "meta";
    if (/tiktok\.com$/.test(h)) return "tiktok";
    if (/instagram\.com$/.test(h)) return "instagram";
    if (/facebook\.com$|fb\.watch$/.test(h)) return "facebook";
    if (/youtube\.com$|youtu\.be$/.test(h)) return "youtube";
    return "web";
  }

  const srcVideo = (v) => { const s = v.currentSrc || v.src || v.querySelector("source")?.src || ""; return http(s) ? s : ""; };
  const esBlob = (v) => (v.currentSrc || v.src || "").startsWith("blob:");

  // Último video descargado por la página (Instagram y Facebook lo sirven por partes).
  function videoDeRed() {
    const e = performance.getEntriesByType("resource")
      .filter((x) => /\.mp4(\?|$)|mime_type=video_mp4|video\/mp4/i.test(x.name))
      .sort((a, b) => b.startTime - a.startTime)[0];
    if (!e) return "";
    try {
      const u = new URL(e.name);
      u.searchParams.delete("bytestart");
      u.searchParams.delete("byteend");
      return u.href;
    } catch { return e.name; }
  }

  function marcaGenerica() {
    const site = meta("og:site_name");
    if (site && !REDES.test(site)) return site;
    const t = document.title.replace(/\s*[|•·–-]\s*(Instagram|TikTok|Facebook|YouTube|Pinterest).*$/i, "");
    const arroba = t.match(/@([\w.]+)/);
    return arroba ? arroba[1] : "";
  }

  /* ---------- Biblioteca de anuncios de Meta ---------- */
  const RE_ID = /(?:Identificador de la biblioteca|ID de la biblioteca|Library ID)\s*:?\s*([0-9]{6,})/i;
  const RE_DESDE = /(?:En circulaci[oó]n desde el|Circulando desde el|Empez[oó] a circular el|Started running on)\s+([^\n·]+)/i;
  const RE_PATROCINADO = /^(Patrocinado|Sponsored|Publicidad)$/i;

  function tarjetaMeta(el) {
    for (let n = el, i = 0; n && i < 18; n = n.parentElement, i++) {
      const t = n.innerText || "";
      if (RE_ID.test(t) && t.length < 9000) return n;
    }
    return null;
  }

  function marcaMeta(card) {
    // El anunciante va justo encima de "Patrocinado".
    const pat = [...card.querySelectorAll("span,div,a")].find((e) => RE_PATROCINADO.test(limpio(e.innerText)));
    for (let n = pat?.parentElement, i = 0; n && i < 5; n = n.parentElement, i++) {
      const lineas = (n.innerText || "").split("\n").map(limpio).filter((x) => x && !RE_PATROCINADO.test(x));
      if (lineas.length) return lineas[0].slice(0, 80);
    }
    const alt = [...card.querySelectorAll("img[alt]")].map((i) => limpio(i.alt)).find((a) => a && a.length < 60 && !/imagen|image|video/i.test(a));
    if (alt) return alt;
    const enlace = [...card.querySelectorAll("a")].map((a) => limpio(a.innerText))
      .find((x) => x && x.length < 60 && !/detalle|details|ver |see |biblioteca|library|resumen|summary/i.test(x));
    return enlace || "";
  }

  function infoMeta(el) {
    const card = el ? tarjetaMeta(el) : null;
    const pagina = new URLSearchParams(location.search).get("id") || "";
    if (!card) return { adId: pagina, brand: "", link: pagina ? `https://www.facebook.com/ads/library/?id=${pagina}` : location.href };
    const t = card.innerText || "";
    const adId = (t.match(RE_ID) || [])[1] || pagina;
    const bloques = [...card.querySelectorAll("div,span")]
      .map((d) => limpio(d.innerText))
      .filter((x) => x.length > 30 && x.length < 3000 && !RE_ID.test(x) && !RE_DESDE.test(x) && !RE_PATROCINADO.test(x));
    bloques.sort((a, b) => b.length - a.length);
    return {
      adId,
      brand: marcaMeta(card),
      adText: bloques[0] || "",
      startedAt: limpio((t.match(RE_DESDE) || [])[1]),
      link: adId ? `https://www.facebook.com/ads/library/?id=${adId}` : location.href,
      contenedor: card,
    };
  }

  /* ---------- TikTok ---------- */
  function infoTikTok(el) {
    let id = "";
    let usuario = "";
    for (let n = el, i = 0; n && i < 25 && !id; n = n.parentElement, i++) {
      const m = (n.id || "").match(/(\d{15,})/);
      if (m) id = m[1];
      const a = n.querySelector?.('a[href*="/video/"]');
      const ma = a?.getAttribute("href")?.match(/@([\w.-]+)\/video\/(\d+)/);
      if (ma) { usuario = ma[1]; id = ma[2]; }
      if (!usuario) {
        const perfil = n.querySelector?.('a[href^="/@"]');
        const mp = perfil?.getAttribute("href")?.match(/^\/@([\w.-]+)/);
        if (mp && i > 2) usuario = mp[1];
      }
    }
    const url = location.pathname.match(/@([\w.-]+)\/(?:video|photo)\/(\d+)/);
    if (!id && url) { usuario = url[1]; id = url[2]; }
    if (!usuario && url) usuario = url[1];
    return {
      adId: id,
      brand: usuario ? `@${usuario}` : "",
      link: id ? `https://www.tiktok.com/@${usuario || "_"}/video/${id}` : location.href,
      tiktok: id ? { id, usuario } : null,
    };
  }

  /* ---------- Instagram ---------- */
  function infoInstagram(el) {
    const cont = el?.closest?.("article") || el?.closest?.('[role="dialog"]') || document;
    const hrefs = [...cont.querySelectorAll('a[href*="/p/"],a[href*="/reel/"],a[href*="/reels/"]')].map((a) => a.getAttribute("href"));
    const codigo = (location.pathname.match(/\/(?:p|reel|reels)\/([\w-]+)/) || [])[1]
      || hrefs.map((h) => (h.match(/\/(?:p|reel|reels)\/([\w-]+)/) || [])[1]).find(Boolean) || "";
    let usuario = "";
    const perfil = [...cont.querySelectorAll('header a[href^="/"], a[role="link"][href^="/"]')]
      .map((a) => a.getAttribute("href")).find((h) => /^\/[\w.]+\/?$/.test(h) && !/^\/(explore|reels|p|stories|direct|accounts)\/?$/.test(h));
    if (perfil) usuario = perfil.replace(/\//g, "");
    if (!usuario) usuario = (meta("og:title").match(/@([\w.]+)/) || document.title.match(/@([\w.]+)/) || [])[1] || "";
    return {
      adId: codigo,
      brand: usuario ? `@${usuario}` : marcaGenerica(),
      link: codigo ? `https://www.instagram.com/${/reel/.test(location.pathname) || hrefs.some((h) => /reel/.test(h)) ? "reel" : "p"}/${codigo}/` : location.href,
      adText: limpio(cont.querySelector?.("h1")?.innerText).slice(0, 2000),
    };
  }

  /* ---------- Facebook ---------- */
  function infoFacebook(el) {
    const cont = el?.closest?.('[role="article"]') || el?.closest?.('[data-pagelet]') || document;
    const texto = [location.href, ...[...cont.querySelectorAll("a[href]")].map((a) => a.href)].join(" ");
    const id = (texto.match(/\/(?:videos|reel|posts|permalink)\/(?:[\w.]+\/)?(\d{8,})/) || texto.match(/[?&](?:story_fbid|v|fbid)=(\d{8,})/) || [])[1] || "";
    const marca = limpio(cont.querySelector?.("h2 a, h3 a, h4 a, strong a, h2 span, h3 span")?.innerText);
    return {
      adId: id,
      brand: marca && !REDES.test(marca) ? marca.slice(0, 80) : marcaGenerica(),
      link: id ? `https://www.facebook.com/${/reel/.test(texto) ? "reel" : "watch/?v="}${/reel/.test(texto) ? "/" + id : id}` : location.href,
    };
  }

  /* ---------- YouTube ---------- */
  function infoYouTube() {
    const id = new URLSearchParams(location.search).get("v") || (location.pathname.match(/\/shorts\/([\w-]+)/) || [])[1] || "";
    const canal = limpio(document.querySelector("ytd-channel-name a, #owner #channel-name a, ytd-reel-player-header-renderer a")?.innerText);
    return { adId: id, brand: canal, link: id ? `https://www.youtube.com/watch?v=${id}` : location.href };
  }

  function infoDe(el) {
    switch (plataforma()) {
      case "meta": return infoMeta(el);
      case "tiktok": return infoTikTok(el);
      case "instagram": return infoInstagram(el);
      case "facebook": return infoFacebook(el);
      case "youtube": return infoYouTube(el);
      default: return { adId: "", brand: marcaGenerica(), link: el?.closest?.("a[href]")?.href || location.href };
    }
  }

  /** Archivo y datos de un video o imagen concretos. */
  function paquete(media) {
    const info = infoDe(media);
    const { contenedor, ...datos } = info;
    const esVideo = media.tagName === "VIDEO";
    let mediaUrl = "";
    let tipo = esVideo ? "video" : "image";
    if (esVideo) {
      mediaUrl = srcVideo(media);
      // Videos por partes: TikTok se resuelve en la extensión; el resto, por la red.
      if (!mediaUrl && esBlob(media) && !datos.tiktok && ["instagram", "facebook", "meta"].includes(plataforma())) mediaUrl = videoDeRed();
    } else {
      mediaUrl = media.currentSrc || media.src || "";
      if (!http(mediaUrl)) mediaUrl = "";
    }
    if (!mediaUrl && contenedor && !esVideo) {
      const v = [...contenedor.querySelectorAll("video")].map(srcVideo).find(Boolean);
      if (v) { mediaUrl = v; tipo = "video"; }
    }
    return {
      ...datos,
      mediaUrl,
      tipo,
      poster: esVideo ? abs(media.poster || "") : mediaUrl,
      pageUrl: location.href,
      plataforma: plataforma(),
    };
  }

  /* ---------- qué hay bajo el puntero ---------- */
  function mediaEn(x, y) {
    for (const e of document.elementsFromPoint(x, y)) {
      if (e.closest?.("#nova-swipe-host")) continue;
      if (e.tagName === "VIDEO") {
        const r = e.getBoundingClientRect();
        if (r.width >= 140 && r.height >= 140) return e;
      }
      if (e.tagName === "IMG") {
        const r = e.getBoundingClientRect();
        if (r.width >= 160 && r.height >= 160 && http(e.currentSrc || e.src)) return e;
      }
    }
    return null;
  }

  function principal() {
    const visibles = (sel) => [...document.querySelectorAll(sel)].map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.width >= 140 && r.height >= 140 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth);
    const area = ({ r }) => (Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) * (Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const videos = visibles("video").sort((a, b) => (b.e.paused ? 0 : 1) - (a.e.paused ? 0 : 1) || area(b) - area(a));
    if (videos[0]) return videos[0].e;
    const imgs = visibles("img").filter(({ e }) => http(e.currentSrc || e.src) && e.naturalWidth >= 250).sort((a, b) => area(b) - area(a));
    return imgs[0]?.e || null;
  }

  function otros() {
    const vistos = new Set();
    const out = [];
    const add = (m) => { if (m.url && !vistos.has(m.url)) { vistos.add(m.url); out.push(m); } };
    document.querySelectorAll("video").forEach((v) => { const s = srcVideo(v); if (s) add({ type: "video", url: s, poster: abs(v.poster || "") }); });
    document.querySelectorAll("img").forEach((i) => {
      const s = i.currentSrc || i.src;
      if (i.naturalWidth >= 250 && i.naturalHeight >= 250 && http(s)) add({ type: "image", url: s, w: i.naturalWidth, h: i.naturalHeight });
    });
    const ogv = meta("og:video") || meta("og:video:url");
    if (ogv) add({ type: "video", url: abs(ogv) });
    return out.slice(0, 30);
  }

  /* ---------- botón Guardar sobre el contenido ---------- */
  let activo = true;
  chrome.storage?.local.get("botonFlotante").then((c) => { activo = c.botonFlotante !== false; }).catch(() => {});
  chrome.storage?.onChanged.addListener((ch) => { if (ch.botonFlotante) activo = ch.botonFlotante.newValue !== false; });

  const host = document.createElement("div");
  host.id = "nova-swipe-host";
  host.style.cssText = "position:fixed;z-index:2147483647;top:0;left:0;display:none";
  const raiz = host.attachShadow({ mode: "closed" });
  raiz.innerHTML = `<style>
    button{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:6px;height:34px;padding:0 12px 0 10px;border-radius:10px;
      background:#0d9488;color:#fff;font:600 13px/1 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;
      box-shadow:0 4px 14px rgba(15,23,42,.35);white-space:nowrap}
    button:hover{background:#0f766e}
    button:focus-visible{outline:2px solid #fff;outline-offset:2px}
    button.ok{background:#059669}button.err{background:#dc2626}button.wait{background:#334155;cursor:progress}
    svg{width:16px;height:16px;flex-shrink:0}
  </style><button type="button" aria-label="Guardar en Nova Studio"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg><span>Guardar</span></button>`;
  const boton = raiz.querySelector("button");
  const etiqueta = raiz.querySelector("span");
  (document.body || document.documentElement).appendChild(host);

  let actual = null;
  let ocupado = false;
  let ocultarT = null;

  function ubicar() {
    if (!actual || !actual.isConnected) return ocultar();
    const r = actual.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return ocultar();
    host.style.display = "block";
    const ancho = host.getBoundingClientRect().width || 110;
    host.style.top = `${Math.max(8, r.top + 10)}px`;
    host.style.left = `${Math.min(innerWidth - ancho - 8, Math.max(8, r.right - ancho - 10))}px`;
  }
  function ocultar() {
    if (ocupado) return;
    host.style.display = "none";
    actual = null;
  }
  function estado(clase, texto) {
    boton.className = clase;
    etiqueta.textContent = texto;
  }

  let rafPendiente = false;
  document.addEventListener("mousemove", (e) => {
    if (!activo || rafPendiente || ocupado) return;
    rafPendiente = true;
    requestAnimationFrame(() => {
      rafPendiente = false;
      if (e.composedPath?.().includes(host)) { clearTimeout(ocultarT); return; }
      const m = mediaEn(e.clientX, e.clientY);
      if (m) {
        clearTimeout(ocultarT);
        if (m !== actual) { actual = m; estado("", "Guardar"); }
        ubicar();
      } else if (actual) {
        clearTimeout(ocultarT);
        ocultarT = setTimeout(ocultar, 350);
      }
    });
  }, { passive: true });
  addEventListener("scroll", () => actual && ubicar(), { passive: true, capture: true });
  addEventListener("resize", () => actual && ubicar(), { passive: true });

  boton.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!actual || ocupado) return;
    ocupado = true;
    estado("wait", "Guardando…");
    try {
      const r = await chrome.runtime.sendMessage({ type: "enviar", payload: paquete(actual) });
      if (!r?.ok) throw new Error(r?.error || "No se pudo guardar");
      estado("ok", r.sinArchivo ? "Guardado (solo enlace)" : "Guardado");
    } catch (err) {
      estado("err", "Error");
      boton.title = err.message;
      console.warn("[Nova Swipe]", err.message);
    }
    ubicar();
    setTimeout(() => { ocupado = false; boton.title = ""; }, 1800);
  }, true);
  ["mousedown", "mouseup", "pointerdown", "pointerup"].forEach((t) => boton.addEventListener(t, (e) => e.stopPropagation(), true));

  /* ---------- mensajes ---------- */
  let ultimoClic = null;
  document.addEventListener("contextmenu", (e) => { ultimoClic = mediaEn(e.clientX, e.clientY) || e.target; }, true);

  chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
    if (msg?.type === "nova:contexto") {
      const el = ultimoClic;
      responder(el && (el.tagName === "VIDEO" || el.tagName === "IMG") ? paquete(el) : { ...infoDe(el), contenedor: undefined, pageUrl: location.href });
    } else if (msg?.type === "nova:principal") {
      const m = principal();
      responder({
        principal: m ? paquete(m) : null,
        info: (({ contenedor, ...d }) => d)(infoDe(m)),
        otros: otros(),
        plataforma: plataforma(),
        url: location.href,
        titulo: document.title,
      });
    }
  });
})();
