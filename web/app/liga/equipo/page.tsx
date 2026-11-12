"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { eur, type Player } from "@/lib/game";
import { useLeague } from "@/lib/league";
import { PitchMap } from "@/components/PitchMap";

export default function Equipo() {
  const { id, lg, teams, ros, byId, me, rpc, value, points } = useLeague();
  const want = Number(useSearchParams().get("team"));
  const shown = teams.find((t) => t.id === want) ?? me;
  const mine = !!shown && shown.id === me?.id;
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  if (!lg.drawn) return <p className="sub">Todavía no se ha hecho el sorteo.</p>;

  const slots: Record<string, { p?: Player; price: number }> = Object.fromEntries(
    ros.filter((r) => r.league_team_id === shown?.id).map((r) => {
      const p = byId.get(r.player_id);
      return [r.slot, { p, price: p?.price ?? r.draft_price }];
    }));

  const pick = async (slot: string) => {
    if (!mine) return;
    setMsg("");
    if (!sel) { if (slots[slot]?.p) setSel(slot); return; }
    if (sel === slot) { setSel(null); return; }
    const err = await rpc("move_player", { p_league: id, p_from: sel, p_to: slot });
    setSel(null);
    if (err) setMsg(err);
  };
  const sell = async () => {
    const p = sel ? slots[sel]?.p : undefined;
    if (!sel || !p || !confirm(`¿Vender a ${p.name} por ${eur(p.price)}?`)) return;
    const err = await rpc("sell_player", { p_league: id, p_slot: sel });
    setSel(null);
    if (err) setMsg(err);
  };

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
            {sel ? `Seleccionado: ${sp?.name}. Toca otro hueco para cambiarlo de sitio.` : "Toca un jugador y luego otro hueco (titular o reserva) para intercambiarlos."}
          </span>
          {sel && sp && <button className="btn" onClick={sell}>Vender por {eur(sp.price)}</button>}
          {sel && <button className="btn out" onClick={() => setSel(null)}>Cancelar</button>}
          <Link href={`/liga/mercado?id=${id}`} className="btn out" style={{ textDecoration: "none" }}>Ir al mercado</Link>
        </div>
      )}
      {msg && <p className="err">{msg}</p>}
      <PitchMap slots={slots} selected={sel ?? undefined} onSelect={mine ? pick : undefined} />
    </>
  );
}
