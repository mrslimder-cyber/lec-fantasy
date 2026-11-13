"use client";
import { eur } from "@/lib/game";
import { useLeague } from "@/lib/league";
import { Avatar } from "@/components/ui";

export default function Movimientos() {
  const { moves, teams, byId } = useLeague();
  if (moves.length === 0) return <p className="sub" style={{ textAlign: "center" }}>Todavía no hay movimientos en esta liga.</p>;
  return (
    <div className="moves">
      {moves.map((m) => {
        const p = byId.get(m.player_id);
        const buy = m.kind === "compra";
        const team = teams.find((t) => t.id === m.league_team_id)?.name ?? "—";
        return (
          <div key={m.id} className={"move " + (buy ? "buy" : "sell")}>
            <span className="mk">{buy ? "FICHAJE" : "VENTA"}</span>
            {p && <Avatar p={p} size={46} />}
            <div className="info">
              <b>{team}</b>
              <small>{buy ? "ficha a" : "vende a"} <b>{p?.name ?? "—"}</b> por {eur(m.amount)}</small>
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
