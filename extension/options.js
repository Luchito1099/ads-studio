const $ = (s) => document.querySelector(s);

function mensaje(tipo, texto) {
  const el = $("#estado");
  el.hidden = !texto;
  el.className = `msg ${tipo}`;
  el.textContent = texto;
}

(async () => {
  const cfg = await chrome.runtime.sendMessage({ type: "config" });
  $("#url").value = cfg?.url || "";
  $("#token").value = cfg?.token || "";
  if (cfg?.url && cfg?.token) mensaje("info", "Conexión configurada.");
})();

$("#guardar").onclick = async () => {
  const url = $("#url").value.trim().replace(/\/+$/, "");
  const token = $("#token").value.trim();
  if (!/^https?:\/\//.test(url) || !token) {
    mensaje("err", "Completa la dirección (con https://) y la clave.");
    return;
  }
  // Si la dirección no está cubierta por los permisos, Chrome la pide ahora.
  try {
    await chrome.permissions.request({ origins: [new URL(url).origin + "/*"] });
  } catch {}
  $("#guardar").disabled = true;
  mensaje("info", "Probando conexión…");
  const r = await chrome.runtime.sendMessage({ type: "probar", url, token });
  $("#guardar").disabled = false;
  if (!r?.ok) {
    mensaje("err", `No se pudo conectar: ${r?.error || "sin respuesta"}`);
    return;
  }
  await chrome.storage.local.set({ url, token });
  mensaje("ok", `Conectado con ${r.app || "NOVA Studio"}. Ya puedes guardar anuncios.`);
};
