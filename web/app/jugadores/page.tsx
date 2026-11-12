"use client";
import { useState } from "react";
import { usePlayers } from "@/lib/game";
import { Chips, PlayerCard } from "@/components/ui";

export default function Jugadores() {
  const { players, loading } = usePlayers();
  const [role, setRole] = useState("all");
  const [q, setQ] = useState("");
  const list = players
    .filter((p) => (role === "all" || p.role === role) && p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
  return (
    <>
      <h1>Jugadores</h1>
      <p className="sub">Pool de la LEC con precio y puntos</p>
      <div className="bar">
        <Chips value={role} onChange={setRole} />
        <input placeholder="Buscar jugador…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading ? <p className="sub">Cargando…</p> : (
        <div className="grid">{list.map((p) => <PlayerCard key={p.id} p={p} />)}</div>
      )}
    </>
  );
}
