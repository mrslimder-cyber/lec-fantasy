"use client";
import Link from "next/link";
import { usePlayers, useTeam, ROLES, BUDGET, eur } from "@/lib/game";
import { PlayerCard } from "@/components/ui";

export default function Equipo() {
  const { players } = usePlayers();
  const { ids, drop } = useTeam();
  const mine = ROLES.map((r) => ({ r, p: players.find((p) => p.id === ids[r]) }));
  const spent = mine.reduce((a, x) => a + (x.p?.price ?? 0), 0);
  const pts = mine.reduce((a, x) => a + (x.p?.pts ?? 0), 0);
  return (
    <>
      <h1>Mi equipo</h1>
      <div className="stats">
        <div><small>Valor</small><b>{eur(spent)}</b></div>
        <div><small>Presupuesto restante</small><b>{eur(BUDGET - spent)}</b></div>
        <div><small>Puntos</small><b>{pts}</b></div>
      </div>
      <div className="grid">
        {mine.map(({ r, p }) => p
          ? <PlayerCard key={r} p={p} action={<button className="btn out" onClick={() => drop(r)}>Quitar</button>} />
          : <Link key={r} href="/" className="card empty">+ Elige tu {r.toUpperCase()}</Link>)}
      </div>
    </>
  );
}
