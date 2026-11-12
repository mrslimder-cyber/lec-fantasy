"use client";
import { useState } from "react";
import { usePlayers, useTeam, BUDGET, eur } from "@/lib/game";
import { Chips, PlayerCard } from "@/components/ui";

export default function Mercado() {
  const { players, loading } = usePlayers();
  const { ids, pick, drop } = useTeam();
  const [role, setRole] = useState("all");
  const [q, setQ] = useState("");
  const byId = new Map(players.map((p) => [p.id, p]));
  const spent = Object.values(ids).reduce((a, id) => a + (byId.get(id as number)?.price ?? 0), 0);
  const list = players
    .filter((p) => (role === "all" || p.role === role) && p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
  return (
    <>
      <h1>Mercado</h1>
      <p className="sub">Presupuesto restante: <b>{eur(BUDGET - spent)}</b></p>
      <div className="bar">
        <Chips value={role} onChange={setRole} />
        <input placeholder="Buscar jugador…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading ? <p className="sub">Cargando…</p> : (
        <div className="grid">
          {list.map((p) => {
            const mine = ids[p.role] === p.id;
            const cur = byId.get(ids[p.role] as number)?.price ?? 0;
            const can = spent - cur + p.price <= BUDGET;
            return (
              <PlayerCard key={p.id} p={p} action={mine
                ? <button className="btn out" onClick={() => drop(p.role)}>Quitar</button>
                : <button className="btn" disabled={!can} onClick={() => pick(p)}>Fichar</button>} />
            );
          })}
        </div>
      )}
    </>
  );
}
