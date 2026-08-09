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

class StorageError extends Error {
  constructor(message, { status = 0, transient = false } = {}) {
    super(message);
    this.status = status;
    this.transient = transient; // vale la pena reintentar
  }
}

async function attempt(method, key, body) {
  let res;
  try {
    res = await fetch(`/api/kv?key=${encodeURIComponent(key)}`, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new StorageError("Sin conexión con el servidor", { transient: true });
  }

  if (res.status === 401) {
    listeners.forEach((fn) => fn());
    throw new StorageError("No autenticado", { status: 401 });
  }
  if (res.status === 404) return null;
  if (res.status >= 500) {
    throw new StorageError(`Error del servidor (${res.status})`, { status: res.status, transient: true });
  }
  if (!res.ok) throw new StorageError(`Error de almacenamiento (${res.status})`, { status: res.status });
  return res.status === 204 ? null : res.json();
}

async function request(method, key, body, retries = 0) {
  for (let i = 0; ; i++) {
    try {
      return await attempt(method, key, body);
    } catch (err) {
      if (!err.transient || i >= retries) throw err;
      await new Promise((r) => setTimeout(r, 300 * 2 ** i));
    }
  }
}

/**
 * Claves cuya lectura falló: no sabemos qué hay en el servidor.
 *
 * Importa porque el componente, si no logra leer, asume base vacía y escribe
 * los datos de ejemplo encima (nova-ads-studio.jsx:564). Con un solo parpadeo
 * de red eso borraría todo el pipeline. Mientras una clave esté acá,
 * rechazamos escribirla: preferimos perder una edición a perder la base.
 * El flag se limpia solo en cuanto una lectura vuelve a funcionar.
 */
const unreadable = new Set();

export const serverStorage = {
  async get(key) {
    try {
      const out = await request("GET", key, null, 3);
      unreadable.delete(key);
      return out;
    } catch (err) {
      unreadable.add(key);
      throw err;
    }
  },

  // El tercer parámetro del API original (`shared`) se ignora: acá todo el
  // almacenamiento es privado del servidor y protegido por la contraseña.
  async set(key, value) {
    if (unreadable.has(key)) {
      console.error(
        `[nova] Escritura de "${key}" bloqueada: la lectura inicial falló y ` +
          `escribir ahora sobrescribiría los datos del servidor. Recarga la página.`
      );
      throw new StorageError("Lectura previa fallida; no se sobrescribe");
    }
    return request("PUT", key, { value: String(value) }, 2);
  },

  delete: (key) => request("DELETE", key, null, 2),
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
