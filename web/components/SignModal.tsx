"use client";
import { useState } from "react";
import { eur, type Player } from "@/lib/game";
import { Chips, PlayerCard } from "@/components/ui";

type Opt = { label: string; reason: string };

// fixedRole: solo esa posición (hueco del mapa). Sin él, muestra todas las posiciones (banquillo).
// option(p).reason != "" => no seleccionable (se ve con opacidad baja).
// onPick devuelve un error (se enseña aquí dentro) o null (todo bien: se cierra y se vuelve al equipo).
export function SignModal({ title, subtitle, players, fixedRole, option, onPick, onClose }: {
  title: string; subtitle?: string; players: Player[]; fixedRole?: string;
  option: (p: Player) => Opt;
  onPick: (p: Player) => Promise<string | null>;
  onClose: () => void;
}) {
  const [role, setRole] = useState("all");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const r = fixedRole ?? role;

  const list = players
    .filter((p) => (r === "all" || p.role === r) && p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) =>
      Number(!!option(a).reason) - Number(!!option(b).reason) || b.pts - a.pts || b.price - a.price || a.name.localeCompare(b.name));

  const go = async (p: Player) => {
    setBusy(true); setErr("");
    const e = await onPick(p);
    setBusy(false);
    if (e) setErr(e); else onClose();
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <div className="info">
            <b style={{ fontSize: 20 }}>{title}</b>
            {subtitle && <small>{subtitle}</small>}
          </div>
          <button className="btn out" onClick={onClose}>Cerrar</button>
        </div>
        <div className="bar">
          {!fixedRole && <Chips value={role} onChange={setRole} />}
          <input placeholder="Buscar jugador…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {err && <p className="err">{err}</p>}
        <div className="grid wide">
          {list.map((p) => {
            const o = option(p);
            return (
              <div key={p.id} className={o.reason ? "dim" : undefined}>
                <PlayerCard p={p} action={
                  <div className="who">
                    {o.reason && <small>{o.reason}</small>}
                    {!o.reason && <small>{eur(p.price)}</small>}
                    <button className="btn" disabled={!!o.reason || busy} title={o.reason} onClick={() => go(p)}>{o.label}</button>
                  </div>
                } />
              </div>
            );
          })}
          {list.length === 0 && <p className="sub">No hay jugadores con ese filtro.</p>}
        </div>
      </div>
    </div>
  );
}
