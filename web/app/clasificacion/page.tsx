"use client";
import { useState } from "react";
import { usePlayers } from "@/lib/game";
import { Chips, PlayerCard } from "@/components/ui";

export default function Clasificacion() {
  const { players, loading } = usePlayers();
  const [role, setRole] = useState("all");
  const list = players
    .filter((p) => role === "all" || p.role === role)
    .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
  return (
    <>
      <h1>Clasificación</h1>
      <p className="sub">Jugadores por puntos totales</p>
      <Chips value={role} onChange={setRole} />
      {loading ? <p className="sub">Cargando…</p> : (
        <ol className="rank">
          {list.map((p, i) => <li key={p.id}><span className="pos">{i + 1}</span><PlayerCard p={p} /></li>)}
        </ol>
      )}
    </>
  );
}
