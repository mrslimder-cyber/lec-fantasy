"use client";
import { useState } from "react";
import { Player, ROLES, eur } from "@/lib/game";

export function Avatar({ p, size = 72 }: { p: Player; size?: number }) {
  const [bad, setBad] = useState(false);
  const s = { width: size, height: size };
  return p.photo && !bad
    ? <img className="av" style={s} src={p.photo} alt={p.name} onError={() => setBad(true)} />
    : <div className="av ph" style={s}>{p.name.slice(0, 2).toUpperCase()}</div>;
}

export function Chips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="chips">
      {["all", ...ROLES].map((r) => (
        <button key={r} className={value === r ? "chip on" : "chip"} onClick={() => onChange(r)}>
          {r === "all" ? "TODOS" : r.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function PlayerCard({ p, action }: { p: Player; action?: React.ReactNode }) {
  return (
    <div className="card" data-role={p.role}>
      <Avatar p={p} />
      <div className="info">
        <b>{p.name}{p.rookie && <span className="rk">ROOKIE</span>}</b>
        <small>{p.team}</small>
        <span className="role">{p.role.toUpperCase()}</span>
      </div>
      <div className="nums"><strong>{eur(p.price)}</strong><small>{p.pts} pts</small></div>
      {action}
    </div>
  );
}
