const $ = (s) => document.querySelector(s);
const FUENTES = ["Biblioteca de Meta", "TikTok Creative Center", "Facebook", "Instagram", "TikTok", "YouTube", "Pinterest", "Tienda de la competencia", "Grabación propia", "Otro enlace"];
const enviarMsg = (m) => chrome.runtime.sendMessage(m);

function fuenteDe(u = "") {
  if (/facebook\.com\/ads\/library/i.test(u)) return "Biblioteca de Meta";
  if (/ads\.tiktok\.com|creativecenter/i.test(u)) return "TikTok Creative Center";
  if (/instagram\.com/i.test(u)) return "Instagram";
  if (/tiktok\.com/i.test(u)) return "TikTok";
  if (/facebook\.com|fb\.watch|fb\.com/i.test(u)) return "Facebook";
  if (/youtube\.com|youtu\.be/i.test(u)) return "YouTube";
  if (/pinterest\.|pin\.it/i.test(u)) return "Pinterest";
  return "Otro enlace";
}

function mensaje(el, tipo, texto) {
  el.hidden = !texto;
  el.className = `msg ${tipo}`;
  el.textContent = texto || "";
}

async function detectar(tab) {
  const pedir = () => chrome.tabs.sendMessage(tab.id, { type: "nova:detectar" });
  try {
    return await pedir();
  } catch {
    // Pestañas abiertas antes de instalar la extensión: se inyecta ahora.
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      return await pedir();
    } catch {
      return null;
    }
  }
}

async function iniciar() {
  const cfg = await enviarMsg({ type: "config" });
  if (!cfg?.url || !cfg?.token) {
    $("#sinconfig").hidden = false;
    return;
  }
  $("#form").hidden = false;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = "";
  try { host = new URL(tab.url).host; } catch {}
  $("#sitio").textContent = host || "Guardar en la Biblioteca";

  // Último resultado del menú contextual (si fue hace menos de 2 minutos).
  const { ultimo } = await chrome.storage.local.get("ultimo");
  if (ultimo && Date.now() - ultimo.en < 120000) mensaje($("#ultimo"), ultimo.ok ? "ok" : "err", ultimo.texto);

  $("#fuente").innerHTML = FUENTES.map((f) => `<option>${f}</option>`).join("");
  $("#fuente").value = fuenteDe(tab.url);

  const prods = await enviarMsg({ type: "productos" });
  if (!prods?.ok) {
    mensaje($("#estado"), "err", `No se pudo conectar con el Studio: ${prods?.error || "sin respuesta"}`);
    $("#enviar").disabled = true;
    return;
  }
  const sel = cfg.productId || prods.productId;
  $("#producto").innerHTML = prods.products.map((p) => `<option value="${p.id}" ${p.id === sel ? "selected" : ""}>${p.name}</option>`).join("") || '<option value="">Sin productos</option>';
  $("#coleccion").innerHTML += (prods.collections || []).map((c) => `<option ${c === cfg.collection ? "selected" : ""}>${c.replace(/</g, "&lt;")}</option>`).join("");

  const info = tab.url?.startsWith("http") ? await detectar(tab) : null;
  const elegidos = new Set();
  const grid = $("#media");
  if (!info) {
    grid.outerHTML = '<div class="empty">No se puede leer esta página. Prueba en una pestaña de un sitio web.</div>';
  } else {
    $("#marca").value = info.brand || "";
    const media = info.media || [];
    $("#cuenta").textContent = media.length ? `${media.length} encontrados` : "";
    if (!media.length) {
      grid.outerHTML = '<div class="empty">No se encontraron videos ni imágenes descargables. Puedes guardar solo el enlace.</div>';
      $("#soloEnlace").checked = true;
    } else {
      grid.innerHTML = media.map((m, i) => `
        <button class="item" data-i="${i}" title="${m.url.replace(/"/g, "&quot;")}">
          ${m.type === "image" ? `<img src="${m.url.replace(/"/g, "&quot;")}" alt="">` : m.poster ? `<img src="${m.poster.replace(/"/g, "&quot;")}" alt="">` : `<video src="${m.url.replace(/"/g, "&quot;")}" muted preload="metadata"></video>`}
          <span class="tag">${m.type === "video" ? (m.red ? "Video · red" : "Video") : `Imagen${m.w ? ` ${m.w}×${m.h}` : ""}`}</span>
          <span class="chk" hidden>✓</span>
        </button>`).join("");
      grid.querySelectorAll(".item").forEach((b) => {
        b.onclick = () => {
          const i = Number(b.dataset.i);
          if (elegidos.has(i)) elegidos.delete(i); else elegidos.add(i);
          b.classList.toggle("sel", elegidos.has(i));
          b.querySelector(".chk").hidden = !elegidos.has(i);
        };
      });
      // Preselecciona el primer video visible, o el primero de la lista.
      const primero = media.findIndex((m) => m.type === "video" && m.visible);
      grid.querySelector(`[data-i="${primero >= 0 ? primero : 0}"]`)?.click();
    }
    const avisos = [];
    if (info.blobVideos) avisos.push("Esta página reproduce videos por partes: si falta alguno, reprodúcelo unos segundos y vuelve a abrir la extensión.");
    if (info.anuncios > 1) avisos.push(`Hay ${info.anuncios} anuncios en pantalla: para guardar uno con su marca e ID, usa clic derecho sobre ese anuncio.`);
    if (avisos.length) { $("#aviso").hidden = false; $("#aviso").textContent = avisos.join(" "); }
  }

  $("#producto").onchange = () => chrome.storage.local.set({ productId: $("#producto").value });
  $("#coleccion").onchange = () => chrome.storage.local.set({ collection: $("#coleccion").value });

  $("#enviar").onclick = async () => {
    const media = info?.media || [];
    const lista = [...elegidos].map((i) => media[i]);
    if (!lista.length && !$("#soloEnlace").checked) {
      mensaje($("#estado"), "err", "Elige al menos un archivo o marca «Guardar también el enlace».");
      return;
    }
    const base = {
      pageUrl: tab.url,
      link: info?.adId ? `https://www.facebook.com/ads/library/?id=${info.adId}` : tab.url,
      source: $("#fuente").value,
      brand: $("#marca").value.trim(),
      notes: $("#notas").value.trim(),
      adId: info?.adId || "",
      adText: info?.adText || "",
      startedAt: info?.startedAt || "",
      productId: $("#producto").value,
      collection: $("#coleccion").value,
    };
    $("#enviar").disabled = true;
    let ok = 0;
    const errores = [];
    const tareas = lista.map((m) => ({ ...base, mediaUrl: m.url, tipo: m.type }));
    if ($("#soloEnlace").checked && lista.length) tareas.push({ ...base });
    if (!lista.length) tareas.push({ ...base });
    for (const [n, t] of tareas.entries()) {
      mensaje($("#estado"), "info", `Enviando ${n + 1} de ${tareas.length}…`);
      const r = await enviarMsg({ type: "enviar", payload: t });
      if (r?.ok) ok++; else errores.push(r?.error || "Error desconocido");
    }
    $("#enviar").disabled = false;
    if (errores.length) mensaje($("#estado"), "err", `${ok} enviado(s). Error: ${errores[0]}`);
    else mensaje($("#estado"), "ok", ok === 1 ? "Guardado en la Biblioteca." : `${ok} elementos guardados en la Biblioteca.`);
  };
}

$("#opciones").onclick = () => chrome.runtime.openOptionsPage();
$("#irOpciones").onclick = () => chrome.runtime.openOptionsPage();
iniciar();
