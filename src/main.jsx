import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import Gate from "./Gate.jsx";
import skeleton from "./studio/skeleton.html?raw";
import { installStorage, checkSession, onUnauthorized } from "./storage.js";

// Debe instalarse antes de que arranque el Studio: persistencia.js usa
// window.storage para leer y guardar en el servidor.
installStorage();

const FONT = { fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" };

const container = document.getElementById("root");
const root = createRoot(container);

/**
 * El Studio no es React: toma el documento completo. Se desmonta el gate y
 * se carga el módulo, que arranca solo al importarse.
 */
let abierto = false;
async function abrirStudio() {
  if (abierto) return;
  abierto = true;
  // Fuera del render en curso: React no permite desmontar su raíz desde un efecto.
  await new Promise((r) => setTimeout(r));
  root.unmount();
  container.remove();
  document.body.insertAdjacentHTML("afterbegin", skeleton);
  await import("./studio/app.js");
}

function Root() {
  // null = todavía no sabemos si hay sesión válida
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    checkSession().then(setAuthed);
  }, []);

  useEffect(() => {
    if (authed) abrirStudio();
  }, [authed]);

  if (authed === false) return <Gate onUnlock={() => setAuthed(true)} />;
  return (
    <div style={FONT} className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">
      Cargando estudio…
    </div>
  );
}

// Si la sesión vence con el Studio abierto, las escrituras fallan con 401:
// se recarga para volver a pedir la contraseña.
onUnauthorized(() => {
  if (abierto) location.reload();
});

root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
