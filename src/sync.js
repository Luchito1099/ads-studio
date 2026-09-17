/**
 * Cliente de la sincronización con Meta (ver server/sync.js).
 * El navegador solo pide y consulta el estado; el trabajo lo hace Claude.
 */

async function call(method, body) {
  const res = await fetch("/api/sync", {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const getSyncState = () => call("GET");

/** ads: [{ id, nombre }] */
export const requestSync = (ads) => call("POST", { ads });
