"use client";
import { useState } from "react";
import { useLeague } from "@/lib/league";
import { Chips, PlayerCard } from "@/components/ui";
import { PlayerHistory } from "@/components/PlayerHistory";
import type { Player } from "@/lib/game";

const SORTS: [string, string][] = [["pts", "PUNTOS"], ["avg", "MEDIA"], ["price", "PRECIO"]];

export default function Jugadores() {
  const { players, ros, teams, market, me } = useLeague();
  const [role, setRole] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("pts");
  const [open, setOpen] = useState<Player | null>(null);

  const owner = new Map(ros.map((r) => [r.player_id, r.league_team_id]));
  const inMarket = new Set(market);
  const list = players
    .filter((p) => (role === "all" || p.role === role) && p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const k = sort === "avg" ? b.avg - a.avg : sort === "price" ? b.price - a.price : b.pts - a.pts;
      return k || b.pts - a.pts || a.name.localeCompare(b.name);
    });

  return (
    <>
      <p className="sub">Todos los jugadores de la LEC, estén fichados o no. Pulsa uno para ver sus partidos y su evolución de valor.</p>
      <div className="bar">
        <Chips value={role} onChange={setRole} />
        <div className="chips">
          {SORTS.map(([k, label]) => (
            <button key={k} className={sort === k ? "chip on" : "chip"} onClick={() => setSort(k)}>{label}</button>
          ))}
        </div>
        <input placeholder="Buscar jugador…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid wide">
        {list.map((p) => {
          const t = owner.get(p.id);
          const who = t == null ? (inMarket.has(p.id) ? "En el mercado" : "Libre")
            : t === me?.id ? "Tuyo" : `De ${teams.find((x) => x.id === t)?.name ?? "—"}`;
          return (
            <PlayerCard key={p.id} p={p} onOpen={() => setOpen(p)}
              action={<div className="who"><small>Media {p.avg} · {p.series} series</small><small className={t === me?.id ? "mine" : ""}>{who}</small></div>} />
          );
        })}
        {list.length === 0 && <p className="sub">No hay jugadores con ese filtro.</p>}
      </div>
      {open && <PlayerHistory p={open} onClose={() => setOpen(null)} />}
    </>
  );
}
