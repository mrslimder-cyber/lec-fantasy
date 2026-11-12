"use client";
import { useState } from "react";
import { eur, type Player } from "@/lib/game";
import { SLOTS, useLeague } from "@/lib/league";
import { Chips, PlayerCard } from "@/components/ui";

export default function Mercado() {
  const { id, lg, ros, players, byId, me, rpc } = useLeague();
  const [role, setRole] = useState("all");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  if (!lg.drawn) return <p className="sub">El mercado se abre cuando el creador haga el sorteo.</p>;

  const cash = me?.cash ?? 0;
  const owned = new Set(ros.map((r) => r.player_id));
  const mine = ros
    .filter((r) => r.league_team_id === me?.id)
    .sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
  const free = players
    .filter((p) => !owned.has(p.id) && (role === "all" || p.role === role) && p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.pts - a.pts || b.price - a.price || a.name.localeCompare(b.name));

  const buy = async (p: Player) => {
    setMsg(null);
    const err = await rpc("buy_player", { p_league: id, p_player: p.id });
    setMsg(err ? { t: err, ok: false } : { t: `Has fichado a ${p.name} por ${eur(p.price)}.`, ok: true });
  };
  const sell = async (slot: string, p: Player) => {
    if (!confirm(`¿Vender a ${p.name} por ${eur(p.price)}?`)) return;
    setMsg(null);
    const err = await rpc("sell_player", { p_league: id, p_slot: slot });
    setMsg(err ? { t: err, ok: false } : { t: `Has vendido a ${p.name} por ${eur(p.price)}.`, ok: true });
  };

  return (
    <>
      <p className="sub">Dinero disponible: <b>{eur(cash)}</b>. Compras y ventas al precio actual del jugador.</p>
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.t}</p>}

      <h3>Mis jugadores</h3>
      <div className="grid">
        {mine.map((r) => {
          const p = byId.get(r.player_id);
          if (!p) return null;
          return <PlayerCard key={r.slot} p={p}
            action={<button className="btn out" onClick={() => sell(r.slot, p)}>Vender</button>} />;
        })}
        {mine.length === 0 && <p className="sub">No tienes jugadores.</p>}
      </div>

      <h3>Agentes libres</h3>
      <div className="bar">
        <Chips value={role} onChange={setRole} />
        <input placeholder="Buscar jugador…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid">
        {free.map((p) => (
          <PlayerCard key={p.id} p={p}
            action={<button className="btn" disabled={p.price > cash} title={p.price > cash ? "No tienes dinero suficiente" : ""}
              onClick={() => buy(p)}>Fichar</button>} />
        ))}
        {free.length === 0 && <p className="sub">No hay jugadores libres con ese filtro.</p>}
      </div>
    </>
  );
}
