"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { ROLES, dayOf, usePlayers, type Player } from "@/lib/game";

export type Team = { id: number; name: string; user_id: string; cash: number | null };
export type Row = { league_team_id: number; player_id: number; bought_price: number };
export type Move = {
  id: number; league_team_id: number; player_id: number; kind: string; amount: number;
  created_at: string; other_team_id: number | null;
};
export type Fixture = { id: number; matchday: number; kickoff: string; bo: number; a: string; b: string };
type LineupRow = { league_team_id: number; day: number; slot: string; player_id: number };
type LockRow = { league_team_id: number; day: number };
export type Status = { open: boolean; reason: string; matchday: number | null; lineup_open: boolean; preseason?: boolean; testing?: boolean };
type MdRow = { league_team_id: number; matchday: number; points: number };
export const STARTERS = ["top", "jng", "mid", "adc", "sup"];

type Ctx = {
  id: number;
  lg: any;
  teams: Team[];
  ros: Row[];
  moves: Move[];
  status: Status;
  fixtures: Fixture[];
  players: Player[];
  byId: Map<number, Player>;
  me?: Team;
  isOwner: boolean;
  value: (teamId: number) => number;
  points: (teamId: number) => number;
  /** Jugadores de la plantilla de un equipo, ordenados por posición. */
  squad: (teamId: number) => Player[];
  /** Equipo de un día: posición -> id de jugador (lo que haya guardado; vacío si aún no se ve). */
  lineup: (teamId: number, day: number) => Record<string, number>;
  /** ¿Equipo de ese día fijado a mano? (solo se ven los propios) */
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
  const [md, setMd] = useState<MdRow[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [status, setStatus] = useState<Status>(NO_STATUS);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [lineups, setLineups] = useState<LineupRow[]>([]);
  const [locks, setLocks] = useState<LockRow[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [l, t, r, m, mv, st, tm] = await Promise.all([
      supabase.from("leagues").select("id,name,code,owner").eq("id", id).single(),
      supabase.from("league_teams").select("id,name,user_id,cash").eq("league_id", id),
      supabase.from("league_rosters").select("league_team_id,player_id,bought_price").eq("league_id", id),
      supabase.from("league_matchday_points").select("league_team_id,matchday,points").eq("league_id", id),
      supabase.from("league_moves").select("id,league_team_id,player_id,kind,amount,created_at,other_team_id").eq("league_id", id)
        .order("id", { ascending: false }).limit(300),
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
    const err = t.error?.message ?? r.error?.message ?? m.error?.message ?? mv.error?.message
      ?? st.error?.message ?? err2;
    setError(err ?? "");
    setLg(l.data ?? null);
    setTeams((t.data ?? []).map((x: any) => ({ ...x, cash: x.cash == null ? null : Number(x.cash) })));
    setRos((r.data ?? []).map((x: any) => ({ ...x, bought_price: Number(x.bought_price) })));
    setMd((m.data ?? []).map((x: any) => ({ ...x, points: Number(x.points) })));
    setMoves((mv.data ?? []).map((x: any) => ({ ...x, amount: Number(x.amount) })));
    setStatus({ ...NO_STATUS, ...stt });
    setFixtures(fx);
    setLineups(lu);
    setLocks(lk);
  }, [id]);
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
  if (error) return <p className="err">Error al cargar: {error}. ¿Has ejecutado game.sql en Supabase?</p>;

  const rosterOf = (tid: number) => ros.filter((r) => r.league_team_id === tid);
  const squad = (tid: number) =>
    rosterOf(tid)
      .map((r) => byId.get(r.player_id))
      .filter((p): p is Player => !!p)
      .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name));
  const value = (tid: number) => rosterOf(tid).reduce((a, r) => a + (byId.get(r.player_id)?.price ?? r.bought_price), 0);
  // Puntos = jornadas ya cerradas (lo que puntuó cada equipo, día a día).
  const points = (tid: number) =>
    Math.round(md.filter((x) => x.league_team_id === tid).reduce((a, x) => a + x.points, 0) * 10) / 10;
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
      id, lg, teams, ros, moves, status, fixtures, players, byId, me: teams.find((t) => t.user_id === uid),
      isOwner: lg.owner === uid, value, points, squad, lineup, locked, started, rpc,
    }}>
      {children}
    </C.Provider>
  );
}
