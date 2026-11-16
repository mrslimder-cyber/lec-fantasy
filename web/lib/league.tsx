"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { ROLES, dayOf, usePlayers, type Player } from "@/lib/game";

// Cada equipo es secreto: de los demás solo se conoce el nombre, el valor y los puntos (los da league_standings).
export type Team = { id: number; name: string; user_id: string; cash: number | null };
export type Row = { league_team_id: number; player_id: number; bought_price: number };
export type Fixture = { id: number; matchday: number; kickoff: string; bo: number; a: string; b: string };
type LineupRow = { league_team_id: number; day: number; slot: string; player_id: number };
type LockRow = { league_team_id: number; day: number };
export type Status = { open: boolean; reason: string; matchday: number | null; lineup_open: boolean; preseason?: boolean; testing?: boolean };
type Std = { value: number; points: number };
export const STARTERS = ["top", "jng", "mid", "adc", "sup"];

type Ctx = {
  id: number;
  lg: any;
  teams: Team[];
  ros: Row[];
  status: Status;
  fixtures: Fixture[];
  players: Player[];
  byId: Map<number, Player>;
  me?: Team;
  isOwner: boolean;
  value: (teamId: number) => number;
  points: (teamId: number) => number;
  /** Jugadores de la plantilla de un equipo, ordenados por posición (solo la tuya: las demás son secretas). */
  squad: (teamId: number) => Player[];
  /** Equipo de un día: posición -> id de jugador (solo el tuyo). */
  lineup: (teamId: number, day: number) => Record<string, number>;
  /** ¿Equipo de ese día fijado a mano? */
  locked: (teamId: number, day: number) => boolean;
  /** ¿Ha empezado ya el primer partido de ese día? Entonces su equipo está cerrado. */
  started: (day: number) => boolean;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<string | null>;
};
const C = createContext<Ctx | null>(null);
export function useLeague() {
  const c = useContext(C);
  if (!c) throw new Error("useLeague se usa fuera de una liga");
  return c;
}

const NO_STATUS: Status = { open: false, reason: "", matchday: null, lineup_open: false };

export function LeagueProvider({ id, uid, children }: { id: number; uid: string; children: ReactNode }) {
  const { players, loading } = usePlayers();
  const [lg, setLg] = useState<any>(undefined);
  const [teams, setTeams] = useState<Team[]>([]);
  const [ros, setRos] = useState<Row[]>([]);
  const [std, setStd] = useState<Map<number, Std>>(new Map());
  const [status, setStatus] = useState<Status>(NO_STATUS);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [lineups, setLineups] = useState<LineupRow[]>([]);
  const [locks, setLocks] = useState<LockRow[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [l, t, r, sd, cs, st, tm] = await Promise.all([
      supabase.from("leagues").select("id,name,code,owner").eq("id", id).single(),
      supabase.from("league_teams").select("id,name,user_id").eq("league_id", id),
      supabase.from("league_rosters").select("league_team_id,player_id,bought_price").eq("league_id", id),
      supabase.rpc("league_standings", { p_league: id }),
      supabase.rpc("my_cash", { p_league: id }),
      supabase.rpc("market_status"),
      supabase.from("teams").select("id,name"),
    ]);
    const stt: Status = (st.data as Status) ?? NO_STATUS;
    let fx: Fixture[] = [];
    let lu: LineupRow[] = [];
    let lk: LockRow[] = [];
    let err2 = "";
    if (stt.matchday != null) {
      const [f, u, k] = await Promise.all([
        supabase.from("fixtures").select("id,matchday,kickoff,bo,team_a,team_b").eq("matchday", stt.matchday).order("kickoff"),
        supabase.from("league_lineups").select("league_team_id,day,slot,player_id").eq("league_id", id).eq("matchday", stt.matchday),
        supabase.from("league_lineup_locks").select("league_team_id,day").eq("league_id", id).eq("matchday", stt.matchday),
      ]);
      const names = new Map<number, string>((tm.data ?? []).map((x: any) => [x.id, x.name]));
      fx = (f.data ?? []).map((x: any) => ({
        id: x.id, matchday: x.matchday, kickoff: x.kickoff, bo: x.bo, a: names.get(x.team_a) ?? "?", b: names.get(x.team_b) ?? "?",
      }));
      lu = (u.data ?? []) as LineupRow[];
      lk = (k.data ?? []) as LockRow[];
      err2 = f.error?.message ?? u.error?.message ?? k.error?.message ?? "";
    }
    const err = t.error?.message ?? r.error?.message ?? sd.error?.message ?? cs.error?.message
      ?? st.error?.message ?? err2;
    setError(err ?? "");
    setLg(l.data ?? null);
    const cash = cs.data == null ? null : Number(cs.data);
    setTeams((t.data ?? []).map((x: any) => ({ ...x, cash: x.user_id === uid ? cash : null })));
    setRos((r.data ?? []).map((x: any) => ({ ...x, bought_price: Number(x.bought_price) })));
    setStd(new Map(((sd.data ?? []) as any[]).map((x) => [x.league_team_id, { value: Number(x.value), points: Number(x.points) }])));
    setStatus({ ...NO_STATUS, ...stt });
    setFixtures(fx);
    setLineups(lu);
    setLocks(lk);
  }, [id, uid]);
  useEffect(() => { load(); }, [load]);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const rpc = useCallback(async (fn: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(fn, args);
    if (error) return error.message;
    await load();
    return null;
  }, [load]);

  if (lg === undefined || loading) return <p className="sub">Cargando liga…</p>;
  if (lg === null) return <p className="sub">No se encuentra esta liga (o no eres miembro de ella).</p>;
  if (error) return <p className="err">Error al cargar: {error}. ¿Has ejecutado game.sql y secreto.sql en Supabase?</p>;

  const me = teams.find((t) => t.user_id === uid);
  const rosterOf = (tid: number) => ros.filter((r) => r.league_team_id === tid);
  const squad = (tid: number) =>
    rosterOf(tid)
      .map((r) => byId.get(r.player_id))
      .filter((p): p is Player => !!p)
      .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name));
  // Tu valor se calcula con tu plantilla al momento; el de los demás llega ya sumado desde la base de datos.
  const value = (tid: number) =>
    me && tid === me.id
      ? rosterOf(tid).reduce((a, r) => a + (byId.get(r.player_id)?.price ?? r.bought_price), 0)
      : std.get(tid)?.value ?? 0;
  // Puntos = jornadas ya cerradas.
  const points = (tid: number) => Math.round((std.get(tid)?.points ?? 0) * 10) / 10;
  const lineup = (tid: number, day: number) =>
    Object.fromEntries(lineups.filter((x) => x.league_team_id === tid && x.day === day).map((x) => [x.slot, x.player_id]));
  const locked = (tid: number, day: number) => locks.some((x) => x.league_team_id === tid && x.day === day);
  const started = (day: number) => {
    if (status.testing) return false;
    const t = fixtures.filter((f) => dayOf(f.kickoff) === day).map((f) => new Date(f.kickoff).getTime());
    return t.length > 0 && Math.min(...t) <= Date.now();
  };

  return (
    <C.Provider value={{
      id, lg, teams, ros, status, fixtures, players, byId, me,
      isOwner: lg.owner === uid, value, points, squad, lineup, locked, started, rpc,
    }}>
      {children}
    </C.Provider>
  );
}
