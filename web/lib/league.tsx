"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { usePlayers, type Player } from "@/lib/game";

export type Team = { id: number; name: string; user_id: string; cash: number | null };
export type Row = { league_team_id: number; slot: string; player_id: number; draft_price: number };
export type Bid = { id: number; league_team_id: number; player_id: number; amount: number };
export type Move = {
  id: number; league_team_id: number; player_id: number; kind: string; amount: number;
  created_at: string; other_team_id: number | null;
};
export type Fixture = { id: number; matchday: number; kickoff: string; bo: number; a: string; b: string };
type LineupRow = { league_team_id: number; day: number; slot: string; player_id: number };
export type Status = { open: boolean; reason: string; matchday: number | null; lineup_open: boolean; clause_multiplier: number };
type MdRow = { league_team_id: number; matchday: number; points: number };
export const STARTERS = ["top", "jng", "mid", "adc", "sup"];
export const SLOTS = [...STARTERS, "res1", "res2"];

type Ctx = {
  id: number;
  lg: any;
  teams: Team[];
  ros: Row[];
  bids: Bid[];
  moves: Move[];
  market: number[];
  status: Status;
  fixtures: Fixture[];
  players: Player[];
  byId: Map<number, Player>;
  me?: Team;
  isOwner: boolean;
  value: (teamId: number) => number;
  points: (teamId: number) => number;
  /** Equipo de un día: hueco -> id de jugador (si no se creó, los 5 titulares de la plantilla). */
  lineup: (teamId: number, day: number) => Record<string, number>;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<string | null>;
};
const C = createContext<Ctx | null>(null);
export function useLeague() {
  const c = useContext(C);
  if (!c) throw new Error("useLeague se usa fuera de una liga");
  return c;
}

const NO_STATUS: Status = { open: false, reason: "", matchday: null, lineup_open: false, clause_multiplier: 1.5 };

export function LeagueProvider({ id, uid, children }: { id: number; uid: string; children: ReactNode }) {
  const { players, loading } = usePlayers();
  const [lg, setLg] = useState<any>(undefined);
  const [teams, setTeams] = useState<Team[]>([]);
  const [ros, setRos] = useState<Row[]>([]);
  const [md, setMd] = useState<MdRow[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [market, setMarket] = useState<number[]>([]);
  const [status, setStatus] = useState<Status>(NO_STATUS);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [lineups, setLineups] = useState<LineupRow[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [l, t, r, m, b, mv, mk, st, tm] = await Promise.all([
      supabase.from("leagues").select("id,name,code,owner,drawn").eq("id", id).single(),
      supabase.from("league_teams").select("id,name,user_id,cash").eq("league_id", id),
      supabase.from("league_rosters").select("league_team_id,slot,player_id,draft_price").eq("league_id", id),
      supabase.from("league_matchday_points").select("league_team_id,matchday,points").eq("league_id", id),
      supabase.from("league_bids").select("id,league_team_id,player_id,amount").eq("league_id", id),
      supabase.from("league_moves").select("id,league_team_id,player_id,kind,amount,created_at,other_team_id").eq("league_id", id)
        .order("id", { ascending: false }).limit(300),
      supabase.from("league_market").select("player_id").eq("league_id", id),
      supabase.rpc("market_status"),
      supabase.from("teams").select("id,name"),
    ]);
    const stt: Status = (st.data as Status) ?? NO_STATUS;
    let fx: Fixture[] = [];
    let lu: LineupRow[] = [];
    let err2 = "";
    if (stt.matchday != null) {
      const [f, u] = await Promise.all([
        supabase.from("fixtures").select("id,matchday,kickoff,bo,team_a,team_b").eq("matchday", stt.matchday).order("kickoff"),
        supabase.from("league_lineups").select("league_team_id,day,slot,player_id").eq("league_id", id).eq("matchday", stt.matchday),
      ]);
      const names = new Map<number, string>((tm.data ?? []).map((x: any) => [x.id, x.name]));
      fx = (f.data ?? []).map((x: any) => ({
        id: x.id, matchday: x.matchday, kickoff: x.kickoff, bo: x.bo, a: names.get(x.team_a) ?? "?", b: names.get(x.team_b) ?? "?",
      }));
      lu = (u.data ?? []) as LineupRow[];
      err2 = f.error?.message ?? u.error?.message ?? "";
    }
    const err = t.error?.message ?? r.error?.message ?? m.error?.message ?? b.error?.message ?? mv.error?.message
      ?? mk.error?.message ?? st.error?.message ?? err2;
    setError(err ?? "");
    setLg(l.data ?? null);
    setTeams((t.data ?? []).map((x: any) => ({ ...x, cash: x.cash == null ? null : Number(x.cash) })));
    setRos((r.data ?? []).map((x: any) => ({ ...x, draft_price: Number(x.draft_price) })));
    setMd((m.data ?? []).map((x: any) => ({ ...x, points: Number(x.points) })));
    setBids((b.data ?? []).map((x: any) => ({ ...x, amount: Number(x.amount) })));
    setMoves((mv.data ?? []).map((x: any) => ({ ...x, amount: Number(x.amount) })));
    setMarket((mk.data ?? []).map((x: any) => x.player_id));
    setStatus({ ...NO_STATUS, ...stt, clause_multiplier: Number(stt.clause_multiplier ?? 1.5) });
    setFixtures(fx);
    setLineups(lu);
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
  if (error) return <p className="err">Error al cargar: {error}. ¿Has ejecutado leagues.sql, v2.sql, v3.sql y v4.sql por ese orden?</p>;

  const roster = (tid: number) => ros.filter((r) => r.league_team_id === tid);
  const value = (tid: number) => roster(tid).reduce((a, r) => a + (byId.get(r.player_id)?.price ?? r.draft_price), 0);
  // Puntos = jornadas ya cerradas (lo que puntuó cada equipo, día a día).
  const points = (tid: number) =>
    Math.round(md.filter((x) => x.league_team_id === tid).reduce((a, x) => a + x.points, 0) * 10) / 10;
  const lineup = (tid: number, day: number) => {
    const owned = new Set(roster(tid).map((r) => r.player_id));
    const rows = lineups.filter((x) => x.league_team_id === tid && x.day === day);
    if (rows.length) return Object.fromEntries(rows.filter((x) => owned.has(x.player_id)).map((x) => [x.slot, x.player_id]));
    return Object.fromEntries(roster(tid).filter((r) => STARTERS.includes(r.slot)).map((r) => [r.slot, r.player_id]));
  };

  return (
    <C.Provider value={{
      id, lg, teams, ros, bids, moves, market, status, fixtures, players, byId, me: teams.find((t) => t.user_id === uid),
      isOwner: lg.owner === uid, value, points, lineup, rpc,
    }}>
      {children}
    </C.Provider>
  );
}
