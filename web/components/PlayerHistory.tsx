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
type SP = { matchday: number; points: number };
type Val = { prices: { matchday: number; price: number }[]; base: number; prior: number; pv: number; m: number };

function Spark({ pts }: { pts: { label: string; v: number }[] }) {
  if (pts.length < 2) return <p className="sub">Todavía no ha cambiado de precio.</p>;
  const W = 560, H = 150, pad = 28;
  const lo = Math.min(...pts.map((p) => p.v)) * 0.97, hi = Math.max(...pts.map((p) => p.v)) * 1.03;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (pts.length - 1);
  const y = (v: number) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - 2 * pad);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <polyline fill="none" stroke="var(--acc)" strokeWidth="3" points={pts.map((p, i) => `${x(i)},${y(p.v)}`).join(" ")} />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.v)} r="4" fill="var(--gold)" />
          <text x={x(i)} y={y(p.v) - 9} textAnchor="middle" fontSize="11" fill="var(--tx)">{Math.round(p.v / 1000)}k</text>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--mut)">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

export function PlayerHistory({ p, onClose }: { p: Player; onClose: () => void }) {
  const [tab, setTab] = useState<"games" | "value">("games");
  const [series, setSeries] = useState<Series[] | null>(null);
  const [spRows, setSpRows] = useState<SP[]>([]);
  const [val, setVal] = useState<Val | null>(null);

  useEffect(() => {
    (async () => {
      const [pr, pl, st] = await Promise.all([
        supabase.from("player_prices").select("matchday,price").eq("player_id", p.id).order("matchday"),
        supabase.from("players").select("prior_avg,base_price").eq("id", p.id).single(),
        supabase.from("settings").select("key,value"),
      ]);
      const s: Record<string, number> = Object.fromEntries((st.data ?? []).map((x: any) => [x.key, Number(x.value)]));
      setVal({
        prices: (pr.data ?? []).map((x: any) => ({ matchday: x.matchday, price: Number(x.price) })),
        base: Number((pl.data as any)?.base_price ?? p.price), prior: Number((pl.data as any)?.prior_avg ?? 0),
        pv: s.point_value ?? 0, m: s.prior_weight ?? 3,
      });
    })();
  }, [p.id, p.price]);

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
      setSpRows((sp.data ?? []).map((x: any) => ({ matchday: x.matchday, points: Number(x.points) })));
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

  // --- Valor: qué necesita en su próxima serie para mantener / subir 15 % / bajar 15 % ---
  const valueView = () => {
    if (!val) return <p className="sub">Cargando…</p>;
    const L = val.prices.length ? Math.max(...val.prices.map((x) => x.matchday)) : 0;
    const used = spRows.filter((x) => x.matchday <= L);
    const S = used.reduce((a, x) => a + x.points, 0), n = used.length;
    const P = p.price;
    const sparkPts = [{ label: "Inicio", v: val.base }, ...val.prices.map((x) => ({ label: `J${x.matchday}`, v: x.price }))];
    const last = val.prices.length >= 1 ? val.prices[val.prices.length - 1].price : val.base;
    const prev = val.prices.length >= 2 ? val.prices[val.prices.length - 2].price : val.base;
    const chg = prev ? ((last - prev) / prev) * 100 : 0;
    const row = (label: string, f: number) => {
      const avg = (f * P) / val.pv;
      const x = avg * (n + 1) - S;
      return (
        <div className="stat" key={label} style={{ justifyContent: "space-between" }}>
          <small>{label}</small>
          <b>{x <= 0 ? "cualquier puntuación" : `${r1(x)} pts`} <small>(media {r1(avg)})</small></b>
        </div>
      );
    };
    return (
      <>
        <div className="stats" style={{ margin: "8px 0" }}>
          <div><small>Valor actual</small><b>{eur(P)}</b></div>
          <div><small>Última jornada</small><b>{val.prices.length ? `${chg >= 0 ? "+" : ""}${r1(chg)} %` : "—"}</b></div>
          <div><small>Media por serie</small><b>{n ? r1(S / n) : "—"}</b></div>
        </div>
        <Spark pts={sparkPts} />
        <h3>Para su próxima serie</h3>
        {val.pv > 0 ? (
          <div className="statgrid" style={{ gridTemplateColumns: "1fr" }}>
            {row("Para mantener su precio necesita", 1)}
            {row("Para subir un 15 % necesita", 1.15)}
            {row("Si hace menos de esto, baja un 15 %", 0.85)}
          </div>
        ) : <p className="sub">El valor del punto todavía no está fijado.</p>}
        <p className="hint">
          El precio teórico es su media de puntos por serie por el valor del punto. El precio real se acerca a él poco a poco: como máximo un 15 % por jornada, y solo si juega.
          Es una orientación: se calcula como si la serie fuese la única de la jornada.
        </p>
      </>
    );
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <Avatar p={p} size={64} />
          <div className="info">
            <b style={{ fontSize: 20 }}>{p.name}</b>
            <small>{p.team} · {p.role.toUpperCase()} · {eur(p.price)}</small>
            <small>{p.pts} pts en la temporada · media {p.avg} por serie</small>
          </div>
          <button className="btn out" onClick={onClose}>Cerrar</button>
        </div>
        <div className="chips" style={{ margin: "6px 0 10px" }}>
          <button className={tab === "games" ? "chip on" : "chip"} onClick={() => setTab("games")}>PARTIDOS</button>
          <button className={tab === "value" ? "chip on" : "chip"} onClick={() => setTab("value")}>VALOR</button>
        </div>
        {tab === "value" ? valueView() : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
