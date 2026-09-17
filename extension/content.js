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

  // Ficha comercial del anuncio: el botón, a dónde lleva, y el título y la
  // descripción que van pegados al botón. Si no se reconoce, se deja vacío.
  const RE_CTA = /^(comprar ahora|comprar|enviar mensaje|enviar mensaje de whatsapp|enviar wasap|más información|mas informacion|obtener oferta|registrarte|reservar|reservar ahora|solicitar ahora|ver más|ver mas|ordenar ahora|pedir ahora|contactarnos|llamar ahora|descargar|suscribirte|shop now|learn more|send message|order now|sign up|get offer|book now|contact us|download|subscribe|whatsapp)$/i;
  function copiaMeta(card) {
    const out = { titulo: "", descripcion: "", boton: "", destino: "" };
    if (!card) return out;
    const salida = [...card.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") || "")
      .map((h) => { const m = h.match(/[?&]u=([^&]+)/); return m ? decodeURIComponent(m[1]) : h; })
      .find((h) => /^https?:/i.test(h) && !/facebook\.com|fbcdn\.net/i.test(h));
    if (salida) {
      try {
        const host = new URL(salida).hostname.replace(/^www\./, "");
        out.destino = /wa\.me|whatsapp/i.test(salida) ? "WhatsApp" : /m\.me|messenger/i.test(salida) ? "Messenger" : host;
      } catch {}
    }
    const btn = [...card.querySelectorAll('div[role="button"],a[role="button"],span')]
      .find((e) => { const t = limpio(e.innerText); return t && t.length < 45 && RE_CTA.test(t); });
    if (!btn) return out;
    out.boton = limpio(btn.innerText);
    const caja = btn.closest("div")?.parentElement?.parentElement || btn.parentElement;
    const lineas = (caja.innerText || "").split(String.fromCharCode(10)).map(limpio)
      .filter((t) => t && t !== out.boton && t.length < 120 && !RE_ID.test(t) && !RE_DESDE.test(t) && !RE_PATROCINADO.test(t))
      .filter((t) => !/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(t));
    if (lineas.length) {
      out.titulo = lineas.length > 1 ? lineas[lineas.length - 2] : lineas[0];
      if (lineas.length > 1) out.descripcion = lineas[lineas.length - 1];
    }
    return out;
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
      ...copiaMeta(card),
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
      poster: esVideo ? (media.poster ? abs(media.poster) : fotograma(media)) : mediaUrl,
      pageUrl: location.href,
      plataforma: plataforma(),
    };
  }

  // Miniatura del video para el panel (solo si el sitio lo permite).
  function fotograma(v) {
    try {
      const c = document.createElement("canvas");
      c.width = 60;
      c.height = 80;
      c.getContext("2d").drawImage(v, 0, 0, 60, 80);
      return c.toDataURL("image/jpeg", 0.6);
    } catch {
      return "";
    }
  }

  /* ---------- qué hay bajo el puntero ---------- */
  function mediaEn(x, y) {
    for (const e of document.elementsFromPoint(x, y)) {
      if (e.closest?.("#nova-swipe-host")) continue;
      if (e.tagName === "VIDEO") {
        const r = e.getBoundingClientRect();
        if (r.width >= 110 && r.height >= 110) return e;
      }
      if (e.tagName === "IMG") {
        const r = e.getBoundingClientRect();
        if (r.width >= 110 && r.height >= 110 && http(e.currentSrc || e.src)) return e;
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

  /* ---------- botón Guardar sobre el contenido ----------
   * Cada clic lanza su guardado en segundo plano: el botón queda libre de
   * inmediato para el siguiente video o imagen. El progreso se ve en un
   * panel abajo a la derecha, y cada elemento recuerda si ya se guardó.
   */
  let activo = true;
  chrome.storage?.local.get("botonFlotante").then((c) => { activo = c.botonFlotante !== false; }).catch(() => {});
  chrome.storage?.onChanged.addListener((ch) => { if (ch.botonFlotante) activo = ch.botonFlotante.newValue !== false; });

  const ICONO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>';

  const host = document.createElement("div");
  host.id = "nova-swipe-host";
  host.style.cssText = "position:fixed;z-index:2147483647;top:0;left:0;width:0;height:0;overflow:visible";
  const raiz = host.attachShadow({ mode: "closed" });
  raiz.innerHTML = `<style>
    *{box-sizing:border-box}
    #btn{all:unset;box-sizing:border-box;position:fixed;display:none;align-items:center;gap:6px;height:34px;padding:0 12px 0 10px;border-radius:10px;
      background:#0d9488;color:#fff;font:600 13px/1 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;
      box-shadow:0 4px 14px rgba(15,23,42,.35);white-space:nowrap}
    #btn:hover{background:#0f766e}
    #btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
    #btn.guardando{background:#334155;cursor:progress}
    #btn.ok{background:#059669}
    #btn.err{background:#dc2626}
    svg{width:16px;height:16px;flex-shrink:0}
    #cola{position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;gap:6px;width:300px;pointer-events:none}
    .it{display:flex;gap:8px;align-items:center;background:#0f172a;color:#fff;border-radius:10px;padding:8px 10px;
      font:500 12px/1.35 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 6px 18px rgba(15,23,42,.35);pointer-events:auto}
    .it img{width:30px;height:40px;object-fit:cover;border-radius:5px;background:#334155;flex-shrink:0}
    .it b{display:block;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .it span{display:block;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .it .txt{min-width:0;flex-grow:1}
    .it.ok b{color:#6ee7b7}.it.err b{color:#fca5a5}
    .spin{width:14px;height:14px;border:2px solid #475569;border-top-color:#5eead4;border-radius:50%;animation:g .8s linear infinite;flex-shrink:0}
    @keyframes g{to{transform:rotate(360deg)}}
    @media (prefers-reduced-motion:reduce){.spin{animation:none}}
  </style>
  <button id="btn" type="button" aria-label="Guardar en Nova Studio"></button>
  <div id="cola" role="status" aria-live="polite"></div>`;
  const boton = raiz.getElementById("btn");
  const cola = raiz.getElementById("cola");
  (document.body || document.documentElement).appendChild(host);

  const estados = new WeakMap(); // elemento -> "guardando" | "ok" | "err"
  let actual = null;
  let ocultarT = null;

  function pintarBoton() {
    const e = actual ? estados.get(actual) : null;
    boton.className = e || "";
    boton.innerHTML = e === "guardando" ? `${ICONO}<span>Guardando…</span>`
      : e === "ok" ? `${CHECK}<span>Guardado</span>`
      : e === "err" ? `${ICONO}<span>Reintentar</span>`
      : `${ICONO}<span>Guardar</span>`;
  }

  function ubicar() {
    if (!actual || !actual.isConnected) return ocultar();
    const r = actual.getBoundingClientRect();
    if (r.bottom < 40 || r.top > innerHeight - 40) return ocultar();
    boton.style.display = "flex";
    const ancho = boton.getBoundingClientRect().width || 110;
    const top = Math.min(Math.max(8, r.top + 10), r.bottom - 44);
    const left = Math.min(innerWidth - ancho - 8, Math.max(8, r.right - ancho - 10));
    boton.style.top = `${top}px`;
    boton.style.left = `${left}px`;
    host.dataset.boton = `${Math.round(left)},${Math.round(top)},${Math.round(ancho)}`;
  }
  function ocultar() {
    boton.style.display = "none";
    host.dataset.boton = "";
    actual = null;
  }

  let rafPendiente = false;
  document.addEventListener("mousemove", (e) => {
    if (!activo || rafPendiente) return;
    rafPendiente = true;
    requestAnimationFrame(() => {
      rafPendiente = false;
      if (e.composedPath?.().includes(host)) { clearTimeout(ocultarT); return; }
      const m = mediaEn(e.clientX, e.clientY);
      if (m) {
        clearTimeout(ocultarT);
        if (m !== actual) { actual = m; pintarBoton(); }
        ubicar();
      } else if (actual) {
        clearTimeout(ocultarT);
        ocultarT = setTimeout(ocultar, 350);
      }
    });
  }, { passive: true });
  addEventListener("scroll", () => actual && ubicar(), { passive: true, capture: true });
  addEventListener("resize", () => actual && ubicar(), { passive: true });

  function tarjetaCola(p) {
    const it = document.createElement("div");
    it.className = "it";
    const miniatura = http(p.poster) || (p.poster || "").startsWith("data:image") ? p.poster : p.tipo === "image" ? p.mediaUrl : "";
    it.innerHTML = `${miniatura ? `<img alt="">` : ""}<div class="txt"><b></b><span></span></div><div class="spin" aria-hidden="true"></div>`;
    if (miniatura) it.querySelector("img").src = miniatura;
    const b = it.querySelector("b");
    const s = it.querySelector("span");
    const detalle = [p.brand, p.adId ? `ID ${p.adId}` : ""].filter(Boolean).join(" · ");
    b.textContent = "Guardando…";
    s.textContent = detalle || (p.tipo === "video" ? "Video" : "Imagen");
    cola.prepend(it);
    while (cola.children.length > 6) cola.lastElementChild.remove();
    return {
      listo(r) {
        it.classList.add("ok");
        it.querySelector(".spin")?.remove();
        b.textContent = r.sinArchivo ? "Enlace guardado" : "Guardado en la Biblioteca";
        s.textContent = [r.brand || p.brand, (r.adId || p.adId) ? `ID ${r.adId || p.adId}` : ""].filter(Boolean).join(" · ") || s.textContent;
        setTimeout(() => it.remove(), 5000);
      },
      fallo(msg) {
        it.classList.add("err");
        it.querySelector(".spin")?.remove();
        b.textContent = "No se pudo guardar";
        s.textContent = msg;
        s.title = msg;
        setTimeout(() => it.remove(), 12000);
      },
    };
  }

  async function guardar(el) {
    const p = paquete(el);
    estados.set(el, "guardando");
    if (el === actual) pintarBoton();
    const t = tarjetaCola(p);
    try {
      const r = await chrome.runtime.sendMessage({ type: "enviar", payload: p });
      if (!r?.ok) throw new Error(r?.error || "No se pudo guardar");
      estados.set(el, "ok");
      t.listo(r);
    } catch (err) {
      estados.set(el, "err");
      t.fallo(err.message);
    }
    if (el === actual) { pintarBoton(); ubicar(); }
  }

  boton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = actual;
    if (!el) return;
    const est = estados.get(el);
    if (est === "guardando" || est === "ok") return; // ya enviado: no se duplica
    guardar(el);
    pintarBoton();
    ubicar();
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
