"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth";
import { usePlayers, BUDGET, eur } from "@/lib/game";
import { PitchMap } from "@/components/PitchMap";

type Team = { id: number; name: string; user_id: string };
type Row = { league_team_id: number; slot: string; player_id: number; draft_price: number };
const STARTERS = ["top", "jng", "mid", "adc", "sup"];

function Liga() {
  const id = Number(useSearchParams().get("id"));
  const { session, ready } = useSession();
  const { players } = usePlayers();
  const [lg, setLg] = useState<any>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [ros, setRos] = useState<Row[]>([]);
  const [tab, setTab] = useState("clas");
  const [view, setView] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [l, t, r] = await Promise.all([
      supabase.from("leagues").select("id,name,code,owner,drawn").eq("id", id).single(),
      supabase.from("league_teams").select("id,name,user_id").eq("league_id", id),
      supabase.from("league_rosters").select("league_team_id,slot,player_id,draft_price").eq("league_id", id),
    ]);
    setLg(l.data); setTeams(t.data ?? []); setRos(r.data ?? []);
  }, [id]);
  useEffect(() => { if (session) load(); }, [session, load]);

  if (!ready) return <p className="sub">Cargando…</p>;
  if (!session) return <p className="sub">Inicia sesión desde <Link href="/">el inicio</Link>.</p>;
  if (!lg) return <p className="sub">Cargando liga…</p>;

  const byId = new Map(players.map((p) => [p.id, p]));
  const rows = teams.map((t) => {
    const mine = ros.filter((r) => r.league_team_id === t.id);
    const pts = mine.filter((r) => STARTERS.includes(r.slot)).reduce((a, r) => a + (byId.get(r.player_id)?.pts ?? 0), 0);
    const value = mine.reduce((a, r) => a + Number(r.draft_price), 0);
    return { t, pts, value };
  }).sort((a, b) => b.pts - a.pts || a.t.name.localeCompare(b.t.name));

  const myTeam = teams.find((t) => t.user_id === session.user.id);
  const shown = teams.find((t) => t.id === (view ?? myTeam?.id));
  const slots = Object.fromEntries(
    ros.filter((r) => r.league_team_id === shown?.id)
      .map((r) => [r.slot, { p: byId.get(r.player_id), price: Number(r.draft_price) }]));
  const isOwner = lg.owner === session.user.id;

  const draw = async () => {
    if (!confirm("¿Sortear los jugadores entre los equipos? No se puede deshacer.")) return;
    setBusy(true); setMsg("");
    const { error } = await supabase.rpc("draw_league", { p_league: id });
    setBusy(false);
    if (error) setMsg(error.message); else load();
  };

  return (
    <>
      <h1>{lg.name}</h1>
      <p className="sub">Código para invitar: <b>{lg.code}</b> · {teams.length} equipos · Presupuesto {eur(BUDGET)}</p>
      {isOwner && !lg.drawn && (
        <div className="bar">
          <button className="btn" disabled={busy} onClick={draw}>{busy ? "Sorteando…" : "Sortear jugadores"}</button>
        </div>
      )}
      {!lg.drawn && !isOwner && <p className="sub">Esperando a que el creador haga el sorteo.</p>}
      {msg && <p className="err">{msg}</p>}
      <div className="chips" style={{ margin: "16px 0" }}>
        <button className={tab === "clas" ? "chip on" : "chip"} onClick={() => setTab("clas")}>CLASIFICACIÓN</button>
        <button className={tab === "equipo" ? "chip on" : "chip"} onClick={() => setTab("equipo")}>EQUIPO</button>
      </div>

      {tab === "clas" ? (
        <table className="tbl">
          <thead><tr><th>#</th><th>Equipo</th><th>Valor</th><th>Puntos</th></tr></thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={x.t.id} className="click" onClick={() => { setView(x.t.id); setTab("equipo"); }}>
                <td>{i + 1}</td>
                <td><b>{x.t.name}</b>{x.t.user_id === session.user.id && " (tú)"}</td>
                <td>{eur(x.value)}</td><td><b>{x.pts}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <p className="sub">Equipo: <b>{shown?.name ?? "—"}</b></p>
          <PitchMap slots={slots} />
        </>
      )}
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<p className="sub">Cargando…</p>}><Liga /></Suspense>;
}
