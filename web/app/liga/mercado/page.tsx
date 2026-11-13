"use client";
import { useState } from "react";
import { eur, type Player } from "@/lib/game";
import { SLOTS, useLeague } from "@/lib/league";
import { Chips, PlayerCard } from "@/components/ui";
import { PlayerHistory } from "@/components/PlayerHistory";

export default function Mercado() {
  const { id, lg, ros, players, byId, me, rpc, bids, market, status } = useLeague();
  const [role, setRole] = useState("all");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [amt, setAmt] = useState<Record<number, string>>({});
  const [open, setOpen] = useState<Player | null>(null);

  if (!lg.drawn) return <p className="sub">El mercado se abre cuando el creador haga el sorteo.</p>;

  const cash = me?.cash ?? 0;
  const owned = new Set(ros.map((r) => r.player_id));
  const inMarket = new Set(market);
  const mine = ros
    .filter((r) => r.league_team_id === me?.id)
    .sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
  const myBids = new Map(bids.filter((b) => b.league_team_id === me?.id).map((b) => [b.player_id, b.amount]));
  const committed = [...myBids.values()].reduce((a, b) => a + b, 0);
  const available = cash - committed;
  const free = players
    .filter((p) => inMarket.has(p.id) && !owned.has(p.id) && (role === "all" || p.role === role) && p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.pts - a.pts || b.price - a.price || a.name.localeCompare(b.name));

  const say = (err: string | null, ok: string) => setMsg(err ? { t: err, ok: false } : { t: ok, ok: true });

  const bid = async (p: Player) => {
    setMsg(null);
    const n = Number(amt[p.id] ?? Math.ceil(p.price));
    const room = cash - (committed - (myBids.get(p.id) ?? 0));
    if (!n || n < p.price) return say(`La puja mínima por ${p.name} es ${eur(Math.ceil(p.price))}.`, "");
    if (n > room) return say(`Solo tienes ${eur(room)} libres para esta puja (el resto está en otras pujas).`, "");
  };
  const cancel = async (p: Player) => {
    setMsg(null);
    say(await rpc("cancel_bid", { p_league: id, p_player: p.id }), `Puja por ${p.name} retirada.`);
  };
  const sell = async (slot: string, p: Player) => {
    if (!confirm(`¿Seguro que quieres vender a ${p.name} por ${eur(p.price)}? Volverá al mercado.`)) return;
    setMsg(null);
    say(await rpc("sell_player", { p_league: id, p_slot: slot }), `Has vendido a ${p.name} por ${eur(p.price)}.`);
  };

  const closedTip = status.open ? "" : status.reason;
  return (
    <>
      <div className={"banner " + (status.open ? "open" : "closed")}>
        <b>{status.open ? "MERCADO ABIERTO" : "MERCADO CERRADO"}</b>
        <span>
          {status.open
            ? status.preseason
              ? `Mercado de pretemporada: dos mercados por semana (martes–viernes y sábado–lunes). Las pujas se resuelven ${status.resolves}.`
              : `Abierto de martes a viernes. Las pujas se resuelven solas ${status.resolves ?? "el viernes a las 23:59"}.`
            : status.reason}
        </span>
      </div>
      <p className="sub">
        Dinero: <b>{eur(cash)}</b> · en pujas: <b>{eur(committed)}</b> · libre para pujar: <b>{eur(available)}</b>.
        Vender es inmediato al precio actual; fichar se hace pujando (mínimo el precio actual).
      </p>
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.t}</p>}

      <h3>Mis jugadores</h3>
      <div className="grid wide">
        {mine.map((r) => {
          const p = byId.get(r.player_id);
          if (!p) return null;
          return <PlayerCard key={r.slot} p={p} onOpen={() => setOpen(p)}
            action={<button className="btn out" disabled={!status.open} title={closedTip} onClick={() => sell(r.slot, p)}>Vender</button>} />;
        })}
        {mine.length === 0 && <p className="sub">No tienes jugadores.</p>}
      </div>

      {myBids.size > 0 && (
        <>
          <h3>Mis pujas</h3>
          <div className="grid wide">
            {[...myBids.entries()].map(([pid, a]) => {
              const p = byId.get(pid);
              if (!p) return null;
              return <PlayerCard key={pid} p={p} onOpen={() => setOpen(p)}
                action={<><small>Tu puja: <b>{eur(a)}</b></small>
                  <button className="btn out" disabled={!status.open} title={closedTip} onClick={() => cancel(p)}>Retirar</button></>} />;
            })}
          </div>
        </>
      )}

      <h3>En el mercado</h3>
      <p className="hint" style={{ marginTop: -6 }}>
        Solo hay una selección de jugadores libres (como norma, 2 de cada posición). Para quitarle un jugador a otro equipo, haz un clausulazo desde su equipo en la Clasificación.
      </p>
      <div className="bar">
        <Chips value={role} onChange={setRole} />
        <input placeholder="Buscar jugador…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid wide">
        {free.map((p) => {
          const mineBid = myBids.get(p.id);
          const room = cash - (committed - (mineBid ?? 0));
          const off = !status.open || p.price > room;
          return (
            <PlayerCard key={p.id} p={p} onOpen={() => setOpen(p)}
              action={
                <div className="bidbox">
                  <input type="number" min={Math.ceil(p.price)} max={room} step={1000}
                    value={amt[p.id] ?? String(Math.ceil(p.price))}
                    onChange={(e) => setAmt({ ...amt, [p.id]: e.target.value })} />
                  <button className="btn" disabled={off} onClick={() => bid(p)}
                    title={!status.open ? status.reason : p.price > room ? "No tienes dinero libre suficiente" : ""}>{mineBid ? "Actualizar" : "Pujar"}</button>
                  {mineBid && <small>Tu puja: {eur(mineBid)}</small>}
                </div>
              } />
          );
        })}
        {free.length === 0 && <p className="sub">No hay jugadores en el mercado con ese filtro.</p>}
      </div>
      {open && <PlayerHistory p={open} onClose={() => setOpen(null)} />}
    </>
  );
}
