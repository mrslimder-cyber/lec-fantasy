import type { CSSProperties } from "react";
import { Avatar } from "@/components/ui";
import { eur, type Player } from "@/lib/game";

type S = { p?: Player; price: number } | undefined;
// Posiciones (% sobre la imagen /map.png; el lado azul es abajo-izquierda).
const POS: Record<string, [number, number]> = {
  top: [13, 42], jng: [30, 56], mid: [50, 50], adc: [63, 83], sup: [45, 83],
};

function Node({ role, s, style, selected, onClick }: {
  role: string; s: S; style?: CSSProperties; selected?: boolean; onClick?: () => void;
}) {
  return (
    <div className={"node" + (onClick ? " click" : "") + (selected ? " sel" : "")}
      data-role={role} style={style} onClick={onClick}>
      {s?.p ? <Avatar p={s.p} size={52} />
        : <div className="av ph" style={{ width: 52, height: 52 }}>{role.startsWith("res") ? "RES" : role.toUpperCase()}</div>}
      <b>{s?.p?.name ?? "—"}</b>
      {s?.p && <small>{eur(s.price)} · {s.p.pts} pts</small>}
    </div>
  );
}

export function PitchMap({ slots, selected, onSelect }: {
  slots: Record<string, S>; selected?: string; onSelect?: (slot: string) => void;
}) {
  const click = (r: string) => (onSelect ? () => onSelect(r) : undefined);
  return (
    <>
      <div className="lolmap">
        {Object.entries(POS).map(([r, [x, y]]) => (
          <Node key={r} role={r} s={slots[r]} selected={selected === r} onClick={click(r)}
            style={{ left: `${x}%`, top: `${y}%` }} />
        ))}
      </div>
      <h3>Reservas</h3>
      <div className="bench">
        {["res1", "res2"].map((r) => <Node key={r} role={r} s={slots[r]} selected={selected === r} onClick={click(r)} />)}
      </div>
    </>
  );
}
