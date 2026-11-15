"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth";
import { Avatar } from "@/components/ui";
import { PitchMap } from "@/components/PitchMap";
import { PHOTOS } from "@/lib/photos";
import { ROLES, type Player, type Role } from "@/lib/game";

type GameInfo = { id: number; winner: string };
type PP = { points: number; breakdown: Record<string, number>; k: number; d: number; a: number };
const KEYS = ["kills", "deaths", "assists", "csm", "dpm", "vspm", "csd15", "kp", "multikills", "obj_stolen", "heal_shield", "Control (CC)"];
const LBL: Record<string, string> = {
  kills: "Kills", deaths: "Muertes", assists: "Asistencias", csm: "CS/min", dpm: "Daño/min", vspm: "Visión",
  csd15: "CSD@15", kp: "Participación", multikills: "Multikills", obj_stolen: "Robos de obj.",
  heal_shield: "Curas/escudos", "Control (CC)": "Control (CC)", bonus: "Victoria de serie (+10 %)",
};
type Row = { user_id: string; name: string; points: number; picks: number[] };
const pad = (n: number) => String(n).padStart(2, "0");
const r1 = (n: number) => Math.round(n * 10) / 10;
const countdown = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

export default function Flash() {
  const { session, ready } = useSession();
  const uid = session?.user.id;
  const [players, setPlayers] = useState<Player[]>([]);
  const [title, setTitle] = useState("");
  const [closes, setClosesAt] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState<number[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const init = useRef(false);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [gpts, setGpts] = useState<Map<string, PP>>(new Map());
  const [view, setView] = useState<number | "total">("total");

  const load = useCallback(async () => {
    const [pl, cf, pt, st, cnt] = await Promise.all([
      supabase.from("players").select("id,name,role,teams(name)").eq("flash", true),
      supabase.from("flash_config").select("name,closes_at,matchday").eq("id", 1).single(),
      supabase.from("flash_player_points").select("player_id,points,maps"),
      supabase.rpc("flash_standings"),
      supabase.from("flash_entries").select("*", { count: "exact", head: true }),
    ]);
    const e = pl.error?.message ?? cf.error?.message ?? pt.error?.message ?? st.error?.message ?? "";
    if (e) { setErr(e); setLoaded(true); return; }
    setErr("");
    const fp = new Map<number, { p: number; m: number }>(
      (pt.data ?? []).map((x: any) => [x.player_id, { p: Number(x.points), m: Number(x.maps) }]));
    setPlayers((pl.data ?? []).map((p: any) => {
      const t = fp.get(p.id);
      return {
        id: p.id, name: p.name, role: p.role as Role, price: 0, rookie: false, imp: false,
        team: p.teams?.name ?? "", pts: t ? r1(t.p) : 0, series: t ? 1 : 0, avg: t ? r1(t.p) : 0,
        photo: PHOTOS[p.name] ?? "",
      };
    }));
    setTitle((cf.data as any).name);
    setClosesAt(new Date((cf.data as any).closes_at).getTime());
    const rs: Row[] = ((st.data ?? []) as any[]).map((x) => ({
      user_id: x.user_id, name: x.name, points: r1(Number(x.points)), picks: x.picks ?? [],
    }));
    setRows(rs);
    setTotal(cnt.count ?? rs.length);
    // Puntos de cada game de la final (y de dónde vienen)
    const gm = await supabase.from("games").select("id,winner_team_id").eq("matchday", (cf.data as any).matchday)
      .order("played_at").order("id");
    const gids = (gm.data ?? []).map((x: any) => Number(x.id));
    if (gids.length === 0) { setGames([]); setGpts(new Map()); }
    else {
      const [gp, gs, tm] = await Promise.all([
        supabase.from("player_game_points").select("game_id,player_id,points,breakdown").in("game_id", gids),
        supabase.from("player_game_stats").select("game_id,player_id,kills,deaths,assists").in("game_id", gids),
        supabase.from("teams").select("id,name"),
      ]);
      const tn = new Map<number, string>((tm.data ?? []).map((x: any) => [x.id, x.name]));
      setGames((gm.data ?? []).map((x: any) => ({ id: Number(x.id), winner: tn.get(x.winner_team_id) ?? "" })));
      const m = new Map<string, PP>();
      (gp.data ?? []).forEach((x: any) => m.set(`${x.game_id}-${x.player_id}`,
        { points: Number(x.points), breakdown: x.breakdown ?? {}, k: 0, d: 0, a: 0 }));
      (gs.data ?? []).forEach((x: any) => {
        const e = m.get(`${x.game_id}-${x.player_id}`);
        if (e) { e.k = x.kills; e.d = x.deaths; e.a = x.assists; }
      });
      setGpts(m);
    }
    const mine = rs.find((x) => x.user_id === uid);
    if (mine && !init.current) { init.current = true; setSel(mine.picks); setName(mine.name); }
    setLoaded(true);
  }, [uid]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (ready) load(); }, [ready, load]);
  const closed = closes > 0 && now >= closes;
  useEffect(() => {
    if (!closed) return;
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [closed, load]);

  if (!ready || !loaded) return <p className="sub">Cargando…</p>;
  if (err) return <p className="err">Error al cargar: {err}. ¿Has ejecutado flash.sql en Supabase?</p>;

  const byId = new Map(players.map((p) => [p.id, p]));
  const slots = Object.fromEntries(ROLES.map((r) => {
    const p = players.find((x) => sel.includes(x.id) && x.role === r);
    return [r, p ? { p, price: 0 } : undefined];
  }));
  const TEAMS = ["Gen.G", "BLG"];
  const detail = (p: Player) => {
    const list = view === "total" ? games : games.filter((g) => g.id === view);
    const sum: Record<string, number> = {};
    let tot = 0, k = 0, d = 0, a = 0, n = 0;
    list.forEach((g) => {
      const x = gpts.get(`${g.id}-${p.id}`);
      if (!x) return;
      n++; tot += x.points; k += x.k; d += x.d; a += x.a;
      Object.entries(x.breakdown).forEach(([key, v]) => { sum[key] = (sum[key] ?? 0) + Number(v); });
    });
    const parts: [string, number][] = KEYS.filter((key) => key in sum).map((key) => [key, sum[key]]);
    let total = tot;
    if (view === "total" && n > 0) {
      total = p.pts;
      if (p.pts - tot > 0.06) parts.push(["bonus", p.pts - tot]);
    }
    return { n, total, parts, kda: `${k}/${d}/${a}` };
  };
  const mineRow = rows.find((x) => x.user_id === uid);
  const closeTxt = new Date(closes).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });

  const toggle = (id: number) => {
    setMsg(null);
    if (closed) return;
    if (!uid) return setMsg({ t: "Inicia sesión o regístrate desde el inicio para participar.", ok: false });
    if (sel.includes(id)) return setSel(sel.filter((x) => x !== id));
    // Un jugador por posición: elegir a otro de la misma posición sustituye al anterior.
    const role = byId.get(id)?.role;
    setSel([...sel.filter((x) => byId.get(x)?.role !== role), id]);
  };
  const save = async () => {
    setMsg(null);
    if (!uid) return setMsg({ t: "Inicia sesión o regístrate desde el inicio para participar.", ok: false });
    if (!name.trim()) return setMsg({ t: "Ponle nombre a tu equipo.", ok: false });
    if (sel.length !== 5) return setMsg({ t: "Elige un jugador en cada posición (5 en total).", ok: false });
    setBusy(true);
    const { error } = await supabase.rpc("flash_save", { p_name: name, p_ids: sel });
    setBusy(false);
    if (error) return setMsg({ t: error.message, ok: false });
    setMsg({ t: "Equipo guardado ✓. Puedes cambiarlo hasta que cierren los equipos.", ok: true });
    await load();
  };

  const card = (p: Player) => {
    const on = sel.includes(p.id);
    return (
      <div key={p.id} className={"card clickable fpick" + (on ? " sel" : "")} data-role={p.role} onClick={() => toggle(p.id)}>
        <Avatar p={p} size={44} />
        <div className="info">
          <b>{p.name}</b>
          <small>{p.team}</small>
          <span className="role">{p.role.toUpperCase()}</span>
        </div>
        <div className="nums">
          {closed ? <strong>{p.pts} pts</strong> : <small>{on ? "✓" : ""}</small>}
        </div>
      </div>
    );
  };

  return (
    <>
      <Link href="/" className="back">← Inicio</Link>
      <h1 style={{ marginTop: 8 }}>⚡ Liga flash</h1>
      <p className="sub">
        {title}. Una sola liga para todos: elige un jugador en cada posición (5 en total, sin precio ni suplentes).
        Tu equipo suma los puntos de todos los mapas de la final.
      </p>

      <div className={"banner " + (closed ? "closed" : "open")}>
        <b>{closed ? "EQUIPOS CERRADOS" : "EQUIPOS ABIERTOS"}</b>
        <span>
          {closed
            ? `Los equipos se cerraron a las ${closeTxt} (hora de Madrid).`
            : `Cierran a las ${closeTxt} (hora de Madrid) · quedan ${countdown(closes - now)}`}
          {" "}· {total} equipo{total === 1 ? "" : "s"} inscrito{total === 1 ? "" : "s"}
        </span>
      </div>

      {!uid && <p className="hint">Para participar, <Link href="/">inicia sesión o regístrate en el inicio</Link> y vuelve aquí.</p>}

      {!closed && uid && (
        <div className="bar">
          <input placeholder="Nombre de tu equipo" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
          <span className="hint">Elegidos: {sel.length}/5{mineRow ? " · ya tienes un equipo guardado" : ""}</span>
          <button className="btn" disabled={busy || sel.length !== 5 || !name.trim()} onClick={save}>
            {mineRow ? "Actualizar equipo" : "Guardar equipo"}
          </button>
        </div>
      )}
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.t}</p>}

      <div className="flashgrid">
        <div>
        {ROLES.map((r) => (
          <div key={r}>
            <h4 className="grp">{r.toUpperCase()}</h4>
            <div className="grid">
              {players.filter((p) => p.role === r).sort((a, b) => a.team.localeCompare(b.team)).map(card)}
            </div>
          </div>
        ))}
        </div>
        <div className="flashmap"><PitchMap slots={slots} /></div>
      </div>

      <h3>Puntos por game</h3>
      {games.length === 0 ? <p className="sub">Todavía no hay games cargados.</p> : (
        <>
          <div className="chips" style={{ margin: "6px 0 12px" }}>
            {games.map((g, i) => (
              <button key={g.id} className={view === g.id ? "chip on" : "chip"} onClick={() => setView(g.id)}>GAME {i + 1}</button>
            ))}
            <button className={view === "total" ? "chip on" : "chip"} onClick={() => setView("total")}>TOTAL</button>
          </div>
          <div className="flashpts">
            {TEAMS.map((t) => {
              const ps = players.filter((p) => p.team === t).sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
              const ds = ps.map((p) => ({ p, ...detail(p) }));
              const sum = ds.reduce((acc, x) => acc + x.total, 0);
              const won = view !== "total" && games.find((g) => g.id === view)?.winner === t;
              return (
                <div key={t}>
                  <h4 className="grp">{t.toUpperCase()}{won ? " · VICTORIA" : ""} · {r1(sum)} pts</h4>
                  {ds.map(({ p, n, total, parts, kda }) => (
                    <div key={p.id} className="series">
                      <div className="shead">
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar p={p} size={36} /><b>{p.name}</b>
                          <small>{p.role.toUpperCase()}{n > 0 ? ` · ${kda}` : ""}</small>
                        </span>
                        <strong>{r1(total)} pts</strong>
                      </div>
                      <div className="statgrid" style={{ marginTop: 6 }}>
                        {parts.map(([key, v]) => (
                          <div key={key} className={v === 0 ? "stat zero" : "stat"}>
                            <small>{LBL[key] ?? key}</small><b>{v > 0 ? "+" : ""}{r1(v)}</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      <h3>Clasificación</h3>
      {!closed && (
        <p className="hint">
          La clasificación y los equipos de los demás se ven al cierre de equipos
          {mineRow ? "." : ", y solo cuenta quien haya guardado equipo."}
        </p>
      )}
      {closed && rows.length === 0 && <p className="sub">Nadie guardó equipo a tiempo.</p>}
      {rows.length > 0 && (
        <table className="tbl">
          <thead><tr><th>#</th><th>Equipo</th><th>Jugadores</th><th>Puntos</th></tr></thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={x.user_id}>
                <td>{closed ? i + 1 : "—"}</td>
                <td><b>{x.name}</b>{x.user_id === uid && " (tú)"}</td>
                <td>{x.picks.map((id) => byId.get(id)?.name ?? "?").join(" · ")}</td>
                <td><b>{closed ? x.points : "—"}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
