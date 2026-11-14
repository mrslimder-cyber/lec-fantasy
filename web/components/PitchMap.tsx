import type { CSSProperties } from "react";
import { Avatar } from "@/components/ui";
import type { Player } from "@/lib/game";

// off = el jugador está alineado fuera de su posición (puntúa la mitad)
type S = { p?: Player; price: number; off?: boolean } | undefined;
// Posiciones (% sobre la imagen /map.png; el lado azul es abajo-izquierda).
const POS: Record<string, [number, number]> = {
  top: [13, 42], jng: [30, 56], mid: [50, 50], adc: [63, 83], sup: [45, 83],
};
const SIZE = 68;

function Node({ role, s, style, onClick }: {
  role: string; s: S; style?: CSSProperties; onClick?: () => void;
}) {
  return (
    <div className={"node" + (onClick ? " click target" : "")} data-role={role} style={style} onClick={onClick}>
      {s?.p ? <Avatar p={s.p} size={SIZE} />
        : <div className="av ph" style={{ width: SIZE, height: SIZE }}>{role.toUpperCase()}</div>}
      <b>{s?.p?.name ?? "—"}</b>
      {s?.off && <small className="half">½ PUNTOS</small>}
    </div>
  );
}

export function PitchMap({ slots, onSelect }: {
  slots: Record<string, S>; onSelect?: (slot: string) => void;
}) {
  return (
    <div className="lolmap">
      {Object.entries(POS).map(([r, [x, y]]) => (
        <Node key={r} role={r} s={slots[r]} onClick={onSelect ? () => onSelect(r) : undefined}
          style={{ left: `${x}%`, top: `${y}%` }} />
      ))}
    </div>
  );
}
