import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import App from "../nova-ads-studio.jsx";
import Gate from "./Gate.jsx";
import { installStorage, checkSession, onUnauthorized } from "./storage.js";

// Debe instalarse antes de que App monte: el componente llama a
// window.storage.get() en su primer useEffect.
installStorage();

const FONT = { fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" };

function Root() {
  // null = todavía no sabemos si hay sesión válida
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    checkSession().then(setAuthed);
    // Si el servidor devuelve 401 en medio de la sesión (cookie vencida),
    // volvemos al gate en vez de dejar la app fallando en silencio.
    return onUnauthorized(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return (
      <div style={FONT} className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">
        Cargando estudio…
      </div>
    );
  }
  if (!authed) return <Gate onUnlock={() => setAuthed(true)} />;

  // `key` fuerza un remontaje limpio tras cada login, para que App vuelva a
  // leer del servidor en lugar de reusar el estado de una sesión anterior.
  return <App key="studio" />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
