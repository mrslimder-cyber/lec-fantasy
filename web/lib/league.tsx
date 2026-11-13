"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { usePlayers, type Player } from "@/lib/game";

export type Team = { id: number; name: string; user_id: string; cash: number | null };
export type Row = { league_team_id: number; slot: string; player_id: number; draft_price: number };
export type Bid = { id: number; league_team_id: number; player_id: number; amount: number };
export type Move = { id: number; league_team_id: number; player_id: number; kind: string; amount: number; created_at: string };
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
  players: Player[];
  byId: Map<number, Player>;
  me?: Team;
  isOwner: boolean;
  value: (teamId: number) => number;
  points: (teamId: number) => number;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<string | null>;
};
const C = createContext<Ctx | null>(null);
export function useLeague() {
  const c = useContext(C);
  if (!c) throw new Error("useLeague se usa fuera de una liga");
  return c;
}

export function LeagueProvider({ id, uid, children }: { id: number; uid: string; children: ReactNode }) {
  const { players, loading } = usePlayers();
  const [lg, setLg] = useState<any>(undefined);
  const [teams, setTeams] = useState<Team[]>([]);
  const [ros, setRos] = useState<Row[]>([]);
  const [md, setMd] = useState<MdRow[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [l, t, r, m, b, br] = await Promise.all([
      supabase.from("leagues").select("id,name,code,owner,drawn").eq("id", id).single(),
      supabase.from("league_teams").select("id,name,user_id,cash").eq("league_id", id),
      supabase.from("league_rosters").select("league_team_id,slot,player_id,draft_price").eq("league_id", id),
      supabase.from("league_matchday_points").select("league_team_id,matchday,points").eq("league_id", id),
      supabase.from("league_bids").select("id,league_team_id,player_id,amount").eq("league_id", id),
      supabase.from("league_moves").select("id,league_team_id,player_id,kind,amount,created_at").eq("league_id", id)
        .order("id", { ascending: false }).limit(300),
    ]);
    const err = t.error?.message ?? r.error?.message ?? m.error?.message ?? b.error?.message ?? br.error?.message ?? "";
    setError(err);
    setLg(l.data ?? null);
    setTeams((t.data ?? []).map((x: any) => ({ ...x, cash: x.cash == null ? null : Number(x.cash) })));
    setRos((r.data ?? []).map((x: any) => ({ ...x, draft_price: Number(x.draft_price) })));
    setMd((m.data ?? []).map((x: any) => ({ ...x, points: Number(x.points) })));
    setBids((b.data ?? []).map((x: any) => ({ ...x, amount: Number(x.amount) })));
    setMoves((br.data ?? []).map((x: any) => ({ ...x, amount: Number(x.amount) })));
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
  if (error) return <p className="err">Error al cargar: {error}. ¿Has ejecutado la última versión de supabase/leagues.sql, v2.sql y v3.sql?</p>;

  const roster = (tid: number) => ros.filter((r) => r.league_team_id === tid);
  const value = (tid: number) => roster(tid).reduce((a, r) => a + (byId.get(r.player_id)?.price ?? r.draft_price), 0);
  // Puntos = jornadas ya cerradas (solo los jugadores que estaban de titulares en ese momento).
  const points = (tid: number) =>
    Math.round(md.filter((x) => x.league_team_id === tid).reduce((a, x) => a + x.points, 0) * 10) / 10;

  return (
    <C.Provider value={{
      id, lg, teams, ros, bids, moves, players, byId, me: teams.find((t) => t.user_id === uid),
      isOwner: lg.owner === uid, value, points, rpc,
    }}>
      {children}
    </C.Provider>
  );
}
