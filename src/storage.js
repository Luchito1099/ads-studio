/**
 * Implementación de `window.storage` respaldada por el servidor.
 *
 * nova-ads-studio.jsx habla exclusivamente con esta API (get / set / delete),
 * así que reemplazando la implementación los datos pasan a vivir en SQLite
 * en el servidor sin tocar ni una línea del componente.
 *
 * Contrato que espera el componente:
 *   await storage.get(key)          -> { key, value } | null
 *   await storage.set(key, value)   -> void
 *   await storage.delete(key)       -> void
 */

// Se dispara cuando el servidor responde 401: la sesión venció y hay que
// volver a pedir la contraseña. main.jsx se suscribe a esto.
const listeners = new Set();
export const onUnauthorized = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

async function request(method, key, body) {
  const res = await fetch(`/api/kv?key=${encodeURIComponent(key)}`, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    listeners.forEach((fn) => fn());
    throw new Error("No autenticado");
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Error de almacenamiento (${res.status})`);
  return res.status === 204 ? null : res.json();
}

export const serverStorage = {
  get: (key) => request("GET", key),
  // El tercer parámetro del API original (`shared`) se ignora: acá todo el
  // almacenamiento es privado del servidor y protegido por la contraseña.
  set: (key, value) => request("PUT", key, { value: String(value) }),
  delete: (key) => request("DELETE", key),
};

export function installStorage() {
  window.storage = serverStorage;
}

/* ---------------- sesión ---------------- */

export async function checkSession() {
  try {
    const res = await fetch("/api/session", { credentials: "same-origin" });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.authenticated;
  } catch {
    return false;
  }
}

export async function login(password) {
  const res = await fetch("/api/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  return { ok: false, error: data.error || "No se pudo iniciar sesión" };
}

export async function logout() {
  try {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
  } catch {
    /* da igual: igual limpiamos el estado local */
  }
}
