import React, { useState } from "react";
import { Film, Lock, Loader2 } from "lucide-react";
import { login } from "./storage.js";

const FONT = { fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" };

/**
 * Pantalla de contraseña. Es lo único que se ve antes de entrar al estudio;
 * la UI de la app queda exactamente igual que antes.
 */
export default function Gate({ onUnlock }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError("");
    const res = await login(password);
    if (res.ok) {
      onUnlock();
    } else {
      setError(res.error);
      setPassword("");
      setBusy(false);
    }
  };

  return (
    <div style={FONT} className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-800">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white">
            <Film size={17} />
          </div>
          <div>
            <div className="text-[15px] font-extrabold leading-none tracking-tight">NOVA · Studio de Ads</div>
            <div className="text-[11px] text-slate-400">Banco · Pipeline · Ganadores</div>
          </div>
        </div>

        <label className="mt-7 mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Contraseña
        </label>
        <div className="relative">
          <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px] text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="mt-2 text-[12px] font-semibold text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={busy || !password}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-[13px] font-bold text-white transition hover:bg-teal-700 disabled:opacity-40"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {busy ? "Verificando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
