"use client";
import { eur } from "@/lib/game";
import { useLeague } from "@/lib/league";
import { Avatar } from "@/components/ui";

const KIND: Record<string, { cls: string; tag: string }> = {
  compra: { cls: "buy", tag: "FICHAJE" },
  venta: { cls: "sell", tag: "VENTA" },
  clausulazo: { cls: "clause", tag: "CLAUSULAZO" },
};

export default function Movimientos() {
  const { moves, teams, byId } = useLeague();
  if (moves.length === 0) return <p className="sub" style={{ textAlign: "center" }}>Todavía no hay movimientos en esta liga.</p>;
  const name = (tid: number | null) => teams.find((t) => t.id === tid)?.name ?? "—";
  return (
    <div className="moves">
      {moves.map((m) => {
        const p = byId.get(m.player_id);
        const k = KIND[m.kind] ?? KIND.compra;
        return (
          <div key={m.id} className={"move " + k.cls}>
            <span className="mk">{k.tag}</span>
            {p && <Avatar p={p} size={46} />}
            <div className="info">
              <b>{name(m.league_team_id)}</b>
              <small>
                {m.kind === "venta" && <>vende a <b>{p?.name ?? "—"}</b> por {eur(m.amount)}</>}
                {m.kind === "compra" && <>ficha a <b>{p?.name ?? "—"}</b> por {eur(m.amount)}</>}
                {m.kind === "clausulazo" && <>le quita a <b>{p?.name ?? "—"}</b> a {name(m.other_team_id)} pagando {eur(m.amount)}</>}
              </small>
            </div>
            <small className="when">
              {new Date(m.created_at).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </small>
          </div>
        );
      })}
    </div>
  );
}
