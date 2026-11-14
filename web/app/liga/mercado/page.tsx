"use client";
import { useState } from "react";
import Link from "next/link";
import type { Player } from "@/lib/game";
import { useLeague } from "@/lib/league";
import { Chips, PlayerCard } from "@/components/ui";
import { PlayerHistory } from "@/components/PlayerHistory";

export default function Mercado() {
  const { id, players, me, status, squad } = useLeague();
  const [role, setRole] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Player | null>(null);

  const mineIds = new Set((me ? squad(me.id) : []).map((p) => p.id));
  const list = players
    .filter((p) => (role === "all" || p.role === role) && p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.pts - a.pts || b.price - a.price || a.name.localeCompare(b.name));

  return (
    <>
      <div className={"banner " + (status.open ? "open" : "closed")}>
        <b>{status.open ? "MERCADO ABIERTO" : "MERCADO CERRADO"}</b>
        <span>
          {status.open
            ? "Cierra el viernes a las 23:59 y reabre el miércoles, ya con la jornada cerrada."
            : status.reason}
        </span>
      </div>
      <p className="sub">
        Aquí solo se consultan los jugadores. Para fichar o vender, ve a{" "}
        <Link href={`/liga/equipo?id=${id}`}>Equipo</Link>: los titulares se ficharán desde el mapa y los suplentes desde los huecos libres.
      </p>
      <div className="bar">
        <Chips value={role} onChange={setRole} />
        <input placeholder="Buscar jugador…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid wide">
        {list.map((p) => (
          <PlayerCard key={p.id} p={p} onOpen={() => setOpen(p)}
            action={mineIds.has(p.id) ? <small>En tu plantilla</small> : undefined} />
        ))}
        {list.length === 0 && <p className="sub">No hay jugadores con ese filtro.</p>}
      </div>
      {open && <PlayerHistory p={open} onClose={() => setOpen(null)} />}
    </>
  );
}
