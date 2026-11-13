"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { eur, type Player } from "@/lib/game";
import { SLOTS, STARTERS, useLeague } from "@/lib/league";
import { PitchMap } from "@/components/PitchMap";
import { Avatar } from "@/components/ui";
import { PlayerHistory } from "@/components/PlayerHistory";

export default function Equipo() {
  const { id, lg, teams, ros, byId, me, rpc, value, points } = useLeague();
  const want = Number(useSearchParams().get("team"));
  const shown = teams.find((t) => t.id === want) ?? me;
  const mine = !!shown && shown.id === me?.id;
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<Player | null>(null);

  if (!lg.drawn) return <p className="sub">Todavía no se ha hecho el sorteo.</p>;

  const slots: Record<string, { p?: Player; price: number }> = Object.fromEntries(
    ros.filter((r) => r.league_team_id === shown?.id).map((r) => {
      const p = byId.get(r.player_id);
      return [r.slot, { p, price: p?.price ?? r.draft_price }];
    }));

  const move = async (to: string) => {
    if (!sel) return;
    setMsg("");
    const err = await rpc("move_player", { p_league: id, p_from: sel, p_to: to });
    setSel(null);
    if (err) setMsg(err);
  };
  // El mapa solo sirve de destino: se elige el jugador con "Cambiar" y luego el hueco.
  const target = (slot: string) => { if (sel === slot) setSel(null); else move(slot); };

  const sp = sel ? slots[sel]?.p : undefined;
  return (
    <>
      <p className="sub">
        Equipo: <b>{shown?.name ?? "—"}</b>
        {!mine && me && <> · <Link href={`/liga/equipo?id=${id}`}>Volver a mi equipo</Link></>}
      </p>
      {shown && (
        <div className="stats">
          <div><small>Valor</small><b>{eur(value(shown.id))}</b></div>
          {mine && <div><small>Dinero disponible</small><b>{eur(shown.cash ?? 0)}</b></div>}
          <div><small>Puntos</small><b>{points(shown.id)}</b></div>
        </div>
      )}
      {mine && (
        <div className="bar">
          <span className="hint">
            {sel ? `Cambiando a ${sp?.name}: elige el hueco o el jugador con el que intercambiarlo.`
              : "Pulsa «Cambiar» en un jugador y luego en el hueco o jugador de destino. Pulsa un jugador para ver sus partidos."}
          </span>
          {sel && <button className="btn out" onClick={() => setSel(null)}>Cancelar</button>}
          <Link href={`/liga/mercado?id=${id}`} className="btn out" style={{ textDecoration: "none" }}>Ir al mercado</Link>
        </div>
      )}
      {msg && <p className="err">{msg}</p>}

      <div className="teamgrid">
        <div><PitchMap slots={slots} selected={sel ?? undefined} onSelect={mine && sel ? target : undefined} /></div>
        <div className="squad">
          {SLOTS.filter((s) => slots[s]?.p).map((s) => {
            const p = slots[s].p!;
            return (
              <div key={s} className={"card prect clickable" + (sel === s ? " sel" : "")} data-role={p.role} onClick={() => setOpen(p)}>
                <Avatar p={p} size={76} />
                <div className="info">
                  <b>{p.name}{p.rookie && <span className="rk">ROOKIE</span>}</b>
                  <small>{p.team}</small>
                  <span className="role">{p.role.toUpperCase()} · {STARTERS.includes(s) ? "TITULAR" : "BANQUILLO"}</span>
                </div>
                <div className="nums"><strong>{eur(slots[s].price)}</strong><small>{p.pts} pts temporada</small></div>
                {mine && (
                  <div style={{ display: "contents" }} onClick={(e) => e.stopPropagation()}>
                    {!sel && <button className="btn" onClick={() => setSel(s)}>Cambiar</button>}
                    {sel === s && <button className="btn out" onClick={() => setSel(null)}>Cancelar</button>}
                    {sel && sel !== s && <button className="btn" onClick={() => move(s)}>Intercambiar aquí</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {open && <PlayerHistory p={open} onClose={() => setOpen(null)} />}
    </>
  );
}
