import type { CSSProperties } from "react";
import { Avatar } from "@/components/ui";
import { eur, type Player } from "@/lib/game";

type S = { p?: Player; price: number } | undefined;
const POS: Record<string, [number, number]> = {
  top: [12, 30], jng: [32, 62], mid: [50, 50], adc: [64, 88], sup: [88, 64],
};

function Node({ role, s, style }: { role: string; s: S; style?: CSSProperties }) {
  return (
    <div className="node" data-role={role} style={style}>
      {s?.p ? <Avatar p={s.p} size={56} />
        : <div className="av ph" style={{ width: 56, height: 56 }}>{role.startsWith("res") ? "RES" : role.toUpperCase()}</div>}
      <b>{s?.p?.name ?? "—"}</b>
      {s?.p && <small>{eur(s.price)}</small>}
    </div>
  );
}

export function PitchMap({ slots }: { slots: Record<string, S> }) {
  return (
    <>
      <div className="lolmap">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect width="100" height="100" fill="#12301f" />
          <path d="M8 8 L92 92" stroke="#2b6cb0" strokeWidth="7" opacity=".6" />
          <g fill="none" stroke="#7a6743" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round">
            <path d="M10 90 L10 10 L90 10" />
            <path d="M10 90 L90 90 L90 10" />
            <path d="M10 90 L90 10" />
          </g>
          <circle cx="10" cy="90" r="8" fill="#2a5db0" opacity=".85" />
          <circle cx="90" cy="10" r="8" fill="#b02a3a" opacity=".85" />
        </svg>
        {Object.entries(POS).map(([r, [x, y]]) => (
          <Node key={r} role={r} s={slots[r]} style={{ left: `${x}%`, top: `${y}%` }} />
        ))}
      </div>
      <h3>Reservas</h3>
      <div className="bench">
        {["res1", "res2"].map((r) => <Node key={r} role={r} s={slots[r]} />)}
      </div>
    </>
  );
}
