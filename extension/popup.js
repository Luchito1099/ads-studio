const $ = (s) => document.querySelector(s);
const FUENTES = ["Biblioteca de Meta", "TikTok Creative Center", "Facebook", "Instagram", "TikTok", "YouTube", "Pinterest", "Tienda de la competencia", "Grabación propia", "Otro enlace"];
const enviarMsg = (m) => chrome.runtime.sendMessage(m);
const escAttr = (s) => String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

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

async function leerPagina(tab) {
  const pedir = () => chrome.tabs.sendMessage(tab.id, { type: "nova:principal" });
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

function extras() {
  return {
    productId: $("#producto").value,
    source: $("#fuente").value,
    collection: $("#coleccion").value,
    notes: $("#notas").value.trim(),
    brand: $("#marca").value.trim(),
    adId: $("#adid").value.trim(),
  };
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
  $("#producto").innerHTML = prods.products.map((p) => `<option value="${escAttr(p.id)}" ${p.id === sel ? "selected" : ""}>${escAttr(p.name)}</option>`).join("") || '<option value="">Sin productos</option>';
  $("#coleccion").innerHTML += (prods.collections || []).map((c) => `<option ${c === cfg.collection ? "selected" : ""}>${escAttr(c)}</option>`).join("");
  $("#producto").onchange = () => chrome.storage.local.set({ productId: $("#producto").value });
  $("#coleccion").onchange = () => chrome.storage.local.set({ collection: $("#coleccion").value });

  const pagina = tab.url?.startsWith("http") ? await leerPagina(tab) : null;
  const p = pagina?.principal;
  const info = p || pagina?.info || {};
  $("#marca").value = info.brand || "";
  $("#adid").value = info.adId || "";

  // Vista previa del contenido principal
  const prev = $("#prev");
  if (p?.tipo === "video" && (p.poster || p.mediaUrl)) {
    prev.innerHTML = p.poster ? `<img src="${escAttr(p.poster)}" alt="">` : `<video src="${escAttr(p.mediaUrl)}" muted preload="metadata"></video>`;
  } else if (p?.tipo === "image" && p.mediaUrl) {
    prev.innerHTML = `<img src="${escAttr(p.mediaUrl)}" alt="">`;
  } else {
    prev.innerHTML = `<span>${p ? "Video" : "Enlace"}</span>`;
  }
  const descargable = p && (p.mediaUrl || p.tiktok);
  $("#tipo").textContent = !pagina ? "No se puede leer esta página"
    : !p ? "Sin video ni imagen visible: se guardará el enlace"
    : descargable ? (p.tipo === "video" ? "Video en pantalla" : "Imagen en pantalla")
    : "Video en partes: se guardará el enlace";
  $("#enviarTxt").textContent = descargable ? "Guardar en la Biblioteca" : "Guardar enlace en la Biblioteca";

  $("#enviar").onclick = async () => {
    $("#enviar").disabled = true;
    mensaje($("#estado"), "info", descargable ? "Descargando y enviando…" : "Enviando…");
    const payload = p ? { ...p, ...extras() } : { pageUrl: tab.url, link: info.link || tab.url, ...extras() };
    const r = await enviarMsg({ type: "enviar", payload });
    $("#enviar").disabled = false;
    if (!r?.ok) return mensaje($("#estado"), "err", r?.error || "No se pudo guardar");
    mensaje($("#estado"), "ok", `${r.sinArchivo ? "Enlace guardado" : "Guardado"} en la Biblioteca${r.brand ? ` · ${r.brand}` : ""}${r.adId ? ` · ID ${r.adId}` : ""}`);
  };

  // Otros archivos (opcional)
  const otros = (pagina?.otros || []).filter((m) => m.url !== p?.mediaUrl);
  if (otros.length) {
    $("#otrosBox").hidden = false;
    $("#cuenta").textContent = `(${otros.length})`;
    const elegidos = new Set();
    $("#media").innerHTML = otros.map((m, i) => `
      <button class="item" data-i="${i}" title="${escAttr(m.url)}">
        ${m.type === "image" ? `<img src="${escAttr(m.url)}" alt="">` : m.poster ? `<img src="${escAttr(m.poster)}" alt="">` : `<video src="${escAttr(m.url)}" muted preload="metadata"></video>`}
        <span class="tag">${m.type === "video" ? "Video" : `Imagen${m.w ? ` ${m.w}×${m.h}` : ""}`}</span>
        <span class="chk" hidden>✓</span>
      </button>`).join("");
    $("#media").querySelectorAll(".item").forEach((b) => {
      b.onclick = () => {
        const i = Number(b.dataset.i);
        if (elegidos.has(i)) elegidos.delete(i); else elegidos.add(i);
        b.classList.toggle("sel", elegidos.has(i));
        b.querySelector(".chk").hidden = !elegidos.has(i);
        $("#enviarOtros").disabled = !elegidos.size;
        $("#enviarOtros").textContent = elegidos.size ? `Guardar ${elegidos.size} seleccionado${elegidos.size > 1 ? "s" : ""}` : "Guardar seleccionados";
      };
    });
    $("#enviarOtros").onclick = async () => {
      $("#enviarOtros").disabled = true;
      let ok = 0;
      let error = "";
      const lista = [...elegidos].map((i) => otros[i]);
      for (const [n, m] of lista.entries()) {
        mensaje($("#estado"), "info", `Enviando ${n + 1} de ${lista.length}…`);
        const r = await enviarMsg({ type: "enviar", payload: { ...info, pageUrl: tab.url, mediaUrl: m.url, tipo: m.type, tiktok: null, ...extras() } });
        if (r?.ok) ok++; else error = r?.error || "error";
      }
      $("#enviarOtros").disabled = false;
      mensaje($("#estado"), error ? "err" : "ok", error ? `${ok} guardado(s). Error: ${error}` : `${ok} archivo(s) guardado(s) en la Biblioteca.`);
    };
  }
}

$("#opciones").onclick = () => chrome.runtime.openOptionsPage();
$("#irOpciones").onclick = () => chrome.runtime.openOptionsPage();
iniciar();
