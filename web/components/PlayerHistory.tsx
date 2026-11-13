"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/ui";
import { eur, type Player } from "@/lib/game";

const LABELS: Record<string, string> = {
  kills: "Kills", deaths: "Muertes", assists: "Asistencias", csm: "CS/min", cs_diff: "Dif. CS",
  csd15: "CSD@15", dpm: "Daño/min", kp: "Participación", multikills: "Multikills",
  obj_stolen: "Obj. robados", shutdown: "Shutdown", vspm: "Visión", heal_shield: "Curas/escudos",
  first_tower: "Primera torre", objectives: "Objetivos",
};
const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("es-ES");

type Game = { id: number; points: number; breakdown: Record<string, number>; played_at: string; won: boolean | null };
type Series = { key: string; matchday: number; sid: number; opp: string; maps: number; points: number; games: Game[] };

export function PlayerHistory({ p, onClose }: { p: Player; onClose: () => void }) {
  const [series, setSeries] = useState<Series[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: pgp } = await supabase.from("player_game_points").select("game_id,points,breakdown").eq("player_id", p.id);
      const rows = pgp ?? [];
      if (rows.length === 0) return setSeries([]);
      const ids = rows.map((r: any) => r.game_id);
      const [g, pgs, tgs, tm, sp] = await Promise.all([
        supabase.from("games").select("id,matchday,played_at,series_id,winner_team_id").in("id", ids),
        supabase.from("player_game_stats").select("game_id,team_id").eq("player_id", p.id),
        supabase.from("team_game_stats").select("game_id,team_id").in("game_id", ids),
        supabase.from("teams").select("id,name"),
        supabase.from("player_series_points").select("matchday,series_id,maps,points").eq("player_id", p.id),
      ]);
      const games = new Map<number, any>((g.data ?? []).map((x: any) => [Number(x.id), x]));
      const myTeam = new Map<number, number>((pgs.data ?? []).map((x: any) => [Number(x.game_id), x.team_id]));
      const names = new Map<number, string>((tm.data ?? []).map((x: any) => [x.id, x.name]));
      const official = new Map<string, any>((sp.data ?? []).map((x: any) => [`${x.matchday}-${x.series_id}`, x]));

      const map = new Map<string, Series>();
      for (const r of rows as any[]) {
        const gm = games.get(Number(r.game_id));
        if (!gm) continue;
        const sid = Number(gm.series_id ?? gm.id);
        const key = `${gm.matchday}-${sid}`;
        const mine = myTeam.get(Number(r.game_id));
        const opp = (tgs.data ?? []).find((t: any) => Number(t.game_id) === Number(r.game_id) && t.team_id !== mine)?.team_id;
        if (!map.has(key)) {
          const o = official.get(key);
          map.set(key, { key, matchday: gm.matchday, sid, opp: opp ? names.get(opp) ?? "" : "", maps: o?.maps ?? 1, points: Number(o?.points ?? 0), games: [] });
        }
        map.get(key)!.games.push({
          id: Number(r.game_id), points: Number(r.points), breakdown: r.breakdown ?? {},
          played_at: gm.played_at, won: gm.winner_team_id == null || mine == null ? null : gm.winner_team_id === mine,
        });
      }
      const list = [...map.values()];
      list.forEach((s) => s.games.sort((a, b) => a.played_at.localeCompare(b.played_at)));
      list.sort((a, b) => b.matchday - a.matchday || b.sid - a.sid);
      setSeries(list);
    })();
  }, [p.id]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <Avatar p={p} size={64} />
          <div className="info">
            <b style={{ fontSize: 20 }}>{p.name}</b>
            <small>{p.team} · {p.role.toUpperCase()} · {eur(p.price)}</small>
            <small>{p.pts} pts en la temporada</small>
          </div>
          <button className="btn out" onClick={onClose}>Cerrar</button>
        </div>
        {series === null && <p className="sub">Cargando partidos…</p>}
        {series?.length === 0 && <p className="sub">Todavía no ha jugado ningún partido.</p>}
        {series?.map((s) => (
          <div key={s.key} className="series">
            <div className="shead">
              <b>Jornada {s.matchday}{s.opp && ` · vs ${s.opp}`}</b>
              <span>{s.games.length > 1 || s.maps > 1 ? `${s.maps} mapas · media` : "1 mapa"} <strong>{r1(s.points)} pts</strong></span>
            </div>
            {s.games.map((g, i) => (
              <div key={g.id} className="game">
                <div className="ghead">
                  <span>Game {i + 1}{g.won === null ? "" : g.won ? " · Victoria" : " · Derrota"}</span>
                  <b>{r1(g.points)} pts</b>
                </div>
                <div className="statgrid">
                  {Object.entries(g.breakdown).map(([k, v]) => (
                    <div key={k} className={Number(v) === 0 ? "stat zero" : "stat"}>
                      <small>{LABELS[k] ?? k}</small><b>{Number(v) > 0 ? "+" : ""}{r1(Number(v))}</b>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
