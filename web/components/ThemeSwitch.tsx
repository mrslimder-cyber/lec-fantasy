"use client";
import { useEffect, useState } from "react";

// Para añadir un estilo nuevo: súmalo aquí, crea su bloque html[data-theme="id"] en themes.css
// y añade su id en el script de layout.tsx.
export const THEMES = [
  { id: "koi", label: "Koi" },
  { id: "clay", label: "Montecarlo" },
  { id: "riviera", label: "Portofino" },
  { id: "park", label: "Otoño" },
] as const;
type ThemeId = (typeof THEMES)[number]["id"];

export function ThemeSwitch() {
  const [t, setT] = useState<ThemeId>("koi");
  useEffect(() => {
    const c = document.documentElement.dataset.theme;
    const found = THEMES.find((x) => x.id === c);
    if (found) setT(found.id);
  }, []);
  const pick = (id: ThemeId) => {
    setT(id);
    document.documentElement.dataset.theme = id;
    try { localStorage.setItem("lec-theme", id); } catch { /* sin almacenamiento: se queda solo en esta sesión */ }
  };
  return (
    <div className="themesw" role="group" aria-label="Estilo de la página">
      {THEMES.map((x) => (
        <button key={x.id} type="button" className={"sw-" + x.id} aria-pressed={t === x.id}
          title={`Estilo ${x.label}`} onClick={() => pick(x.id)}>
          <span className="dots"><i /><i /></span>
          <span className="lbl">{x.label}</span>
        </button>
      ))}
    </div>
  );
}
