// Nova Swipe · script de página: detecta videos, imágenes y datos del anuncio.
(() => {
  if (window.__novaSwipe) return;
  window.__novaSwipe = true;

  let ultimo = null;
  document.addEventListener("contextmenu", (e) => { ultimo = e.target; }, true);

  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return ""; } };
  const http = (u) => /^https?:/i.test(u || "");
  const meta = (n) => document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.content || "";
  const RE_ID = /(?:Identificador de la biblioteca|ID de la biblioteca|Library ID)\s*:?\s*([0-9]{6,})/i;
  const RE_DESDE = /(?:En circulaci[oó]n desde el|Circulando desde el|Empez[oó] a circular el|Started running on)\s+([^\n·]+)/i;
  const REDES = /^(Facebook|Instagram|TikTok|YouTube|Pinterest|Meta)$/i;

  function srcVideo(v) {
    const s = v.currentSrc || v.src || v.querySelector("source")?.src || "";
    return http(s) ? s : "";
  }

  function marcaDePagina() {
    const site = meta("og:site_name");
    if (site && !REDES.test(site)) return site;
    const t = document.title.replace(/\s*[|•·–-]\s*(Instagram|TikTok|Facebook|YouTube|Pinterest).*$/i, "");
    const arroba = t.match(/@([\w.]+)/);
    if (arroba) return arroba[1];
    const url = location.pathname.match(/^\/@?([\w.]+)/);
    if (url && /tiktok|instagram/.test(location.host)) return url[1];
    return "";
  }

  // Tarjeta de un anuncio en la Biblioteca de anuncios de Meta.
  function tarjetaMeta(el) {
    for (let n = el, i = 0; n && i < 16; n = n.parentElement, i++) {
      const t = n.innerText || "";
      if (RE_ID.test(t) && t.length < 8000) return n;
    }
    return null;
  }

  function datosTarjeta(card) {
    const t = card.innerText || "";
    const adId = (t.match(RE_ID) || [])[1] || "";
    const startedAt = ((t.match(RE_DESDE) || [])[1] || "").trim();
    const marcas = [...card.querySelectorAll("a")]
      .map((a) => (a.innerText || "").trim())
      .filter((x) => x && x.length < 60 && !/detalle|details|ver |see |biblioteca|library|más|more|anuncio|\bad\b/i.test(x));
    const bloques = [...card.querySelectorAll("div,span")]
      .map((d) => (d.innerText || "").trim())
      .filter((x) => x.length > 30 && x.length < 3000 && !RE_ID.test(x) && !RE_DESDE.test(x));
    bloques.sort((a, b) => b.length - a.length);
    const video = [...card.querySelectorAll("video")].map(srcVideo).find(Boolean) || "";
    const img = [...card.querySelectorAll("img")]
      .filter((i) => i.naturalWidth >= 200 && http(i.currentSrc || i.src))
      .sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight)[0];
    return {
      adId,
      startedAt,
      brand: marcas[0] || "",
      adText: bloques[0] || "",
      videoUrl: video,
      imageUrl: img ? img.currentSrc || img.src : "",
      link: adId ? `https://www.facebook.com/ads/library/?id=${adId}` : "",
    };
  }

  function contexto(el) {
    if (!el) return { brand: marcaDePagina() };
    const card = /facebook\.com\/ads\/library/.test(location.href) ? tarjetaMeta(el) : null;
    if (card) return datosTarjeta(card);
    // Fuera de la biblioteca: el video o la imagen más cercanos al clic.
    let video = "";
    let imagen = "";
    for (let n = el, i = 0; n && i < 6 && !video; n = n.parentElement, i++) {
      if (n.tagName === "VIDEO") video = srcVideo(n);
      else video = [...(n.querySelectorAll?.("video") || [])].map(srcVideo).find(Boolean) || "";
      if (!imagen && n.tagName === "IMG" && http(n.currentSrc || n.src)) imagen = n.currentSrc || n.src;
    }
    const enlace = el.closest?.("a[href]")?.href || "";
    return { brand: marcaDePagina(), videoUrl: video, imageUrl: imagen, link: enlace };
  }

  function detectar() {
    const out = { url: location.href, title: document.title, brand: marcaDePagina(), adId: "", adText: "", startedAt: "", media: [], blobVideos: 0 };
    const vistos = new Set();
    const add = (m) => {
      if (!m.url || vistos.has(m.url)) return;
      vistos.add(m.url);
      out.media.push(m);
    };
    document.querySelectorAll("video").forEach((v) => {
      const r = v.getBoundingClientRect();
      const s = srcVideo(v);
      if (s) add({ type: "video", url: s, poster: v.poster ? abs(v.poster) : "", visible: r.width > 80 && r.bottom > 0 && r.top < innerHeight, area: r.width * r.height });
      else if ((v.currentSrc || v.src || "").startsWith("blob:")) out.blobVideos++;
    });
    // Instagram, TikTok y Facebook sirven el video por partes: se busca en la red.
    performance.getEntriesByType("resource").forEach((e) => {
      if (!/\.mp4(\?|$)|mime_type=video_mp4|video\/mp4/i.test(e.name)) return;
      let limpio = e.name;
      try {
        const x = new URL(e.name);
        x.searchParams.delete("bytestart");
        x.searchParams.delete("byteend");
        limpio = x.href;
      } catch {}
      add({ type: "video", url: limpio, red: true, area: 0 });
    });
    document.querySelectorAll("img").forEach((i) => {
      const s = i.currentSrc || i.src;
      if (i.naturalWidth < 250 || i.naturalHeight < 250 || !http(s)) return;
      const r = i.getBoundingClientRect();
      add({ type: "image", url: s, w: i.naturalWidth, h: i.naturalHeight, visible: r.width > 60 && r.bottom > 0 && r.top < innerHeight, area: r.width * r.height });
    });
    const ogv = meta("og:video") || meta("og:video:url");
    if (ogv) add({ type: "video", url: abs(ogv), area: 1e9, visible: true });
    const ogi = meta("og:image");
    if (ogi) add({ type: "image", url: abs(ogi), area: 1 });

    if (/facebook\.com\/ads\/library/.test(location.href)) {
      out.adId = new URLSearchParams(location.search).get("id") || "";
      const cards = new Set([...document.querySelectorAll("video,img")].map(tarjetaMeta).filter(Boolean));
      if (cards.size === 1) Object.assign(out, Object.fromEntries(Object.entries(datosTarjeta([...cards][0])).filter(([, v]) => v)));
      out.anuncios = cards.size;
    }
    out.media.sort((a, b) => (b.visible ? 1 : 0) - (a.visible ? 1 : 0) || (b.area || 0) - (a.area || 0));
    out.media = out.media.slice(0, 30);
    return out;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
    if (msg?.type === "nova:contexto") responder(contexto(ultimo));
    else if (msg?.type === "nova:detectar") responder(detectar());
  });
})();
