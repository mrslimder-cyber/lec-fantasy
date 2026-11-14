"use client";
import { useState } from "react";
import { IMPORTS_ROSTER, ROSTER_MAX, eur, type Player } from "@/lib/game";
import { useLeague } from "@/lib/league";
import { Chips, PlayerCard } from "@/components/ui";
import { PlayerHistory } from "@/components/PlayerHistory";

export default function Mercado() {
  const { id, players, me, rpc, status, squad } = useLeague();
  const [role, setRole] = useState("all");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState<Player | null>(null);

  const cash = me?.cash ?? 0;
  const mine = me ? squad(me.id) : [];
  const mineIds = new Set(mine.map((p) => p.id));
  const imps = mine.filter((p) => p.imp).length;
  const list = players
    .filter((p) => (role === "all" || p.role === role) && p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.pts - a.pts || b.price - a.price || a.name.localeCompare(b.name));

  const say = (err: string | null, ok: string) => setMsg(err ? { t: err, ok: false } : { t: ok, ok: true });
  const why = (p: Player) =>
    !status.open ? status.reason
      : mine.length >= ROSTER_MAX ? "Plantilla completa: vende a alguien antes"
      : p.imp && imps >= IMPORTS_ROSTER ? `Ya tienes ${IMPORTS_ROSTER} imports`
      : p.price > cash ? "No tienes dinero suficiente" : "";

  const buy = async (p: Player) => {
    setMsg(null);
    say(await rpc("buy_player", { p_league: id, p_player: p.id }), `Has fichado a ${p.name} por ${eur(p.price)}.`);
  };
  const sell = async (p: Player) => {
    if (!confirm(`¿Vender a ${p.name} por ${eur(p.price)}? Saldrá también de los equipos que aún no se hayan jugado.`)) return;
    setMsg(null);
    say(await rpc("sell_player", { p_league: id, p_player: p.id }), `Has vendido a ${p.name} por ${eur(p.price)}.`);
  };

  return (
    <>
      <div className={"banner " + (status.open ? "open" : "closed")}>
        <b>{status.open ? "MERCADO ABIERTO" : "MERCADO CERRADO"}</b>
        <span>
          {status.open
            ? "Fichar y vender es inmediato, al precio actual. Cierra el viernes a las 23:59 y reabre el miércoles, ya con la jornada cerrada."
            : status.reason}
        </span>
      </div>
      <p className="sub">
        Dinero: <b>{eur(cash)}</b> · plantilla: <b>{mine.length}/{ROSTER_MAX}</b> · imports: <b>{imps}/{IMPORTS_ROSTER}</b>.
        Hay copias infinitas de cada jugador: que fiches a uno no se lo quita a nadie.
      </p>
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.t}</p>}

      <h3>Mi plantilla</h3>
      <div className="grid wide">
        {mine.map((p) => (
          <PlayerCard key={p.id} p={p} onOpen={() => setOpen(p)}
            action={<button className="btn out" disabled={!status.open} title={status.open ? "" : status.reason} onClick={() => sell(p)}>Vender</button>} />
        ))}
        {mine.length === 0 && <p className="sub">Todavía no tienes jugadores. Ficha hasta {ROSTER_MAX}: las 5 posiciones y 3 reservas.</p>}
      </div>

      <h3>Jugadores</h3>
      <div className="bar">
        <Chips value={role} onChange={setRole} />
        <input placeholder="Buscar jugador…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid wide">
        {list.map((p) => {
          const own = mineIds.has(p.id);
          const reason = why(p);
          return (
            <PlayerCard key={p.id} p={p} onOpen={() => setOpen(p)}
              action={own
                ? <small>En tu plantilla</small>
                : <button className="btn" disabled={!!reason} title={reason} onClick={() => buy(p)}>Fichar</button>} />
          );
        })}
        {list.length === 0 && <p className="sub">No hay jugadores con ese filtro.</p>}
      </div>
      {open && <PlayerHistory p={open} onClose={() => setOpen(null)} />}
    </>
  );
}
