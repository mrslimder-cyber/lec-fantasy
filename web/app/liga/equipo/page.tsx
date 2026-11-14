"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DAYS, IMPORTS_LINEUP, dayOf, eur, hhmm, type Player } from "@/lib/game";
import { STARTERS, useLeague } from "@/lib/league";
import { PitchMap } from "@/components/PitchMap";
import { Avatar } from "@/components/ui";
import { PlayerHistory } from "@/components/PlayerHistory";

export default function Equipo() {
  const { id, teams, byId, me, rpc, value, points, status, fixtures, squad, lineup, locked, started } = useLeague();
  const want = Number(useSearchParams().get("team"));
  const shown = teams.find((t) => t.id === want) ?? me;
  const mine = !!shown && shown.id === me?.id;
  const [day, setDay] = useState(1);
  const [sel, setSel] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState<Player | null>(null);

  const players = shown ? squad(shown.id) : [];
  const line = shown ? lineup(shown.id, day) : {};
  const inLine = new Set(Object.values(line));
  const hasMd = status.matchday != null;
  const isStarted = started(day);
  const isLocked = !!shown && locked(shown.id, day);
  const canEdit = mine && hasMd && !isStarted && !isLocked;
  const hidden = !mine && !isStarted;   // el equipo de un rival se ve cuando empieza ese día
  const filled = Object.keys(line).length;
  const lineImps = [...inLine].filter((pid) => byId.get(pid)?.imp).length;

  const slots = Object.fromEntries(STARTERS.map((s) => {
    const p = line[s] ? byId.get(line[s]) : undefined;
    return [s, p ? { p, price: p.price, off: p.role !== s } : undefined];
  }));

  const dayFx = fixtures.filter((f) => dayOf(f.kickoff) === day);
  const playing = new Map<string, string>();
  const add = (t: string, s: string) => playing.set(t, (playing.get(t) ? playing.get(t) + " · " : "") + s);
  dayFx.forEach((f) => { add(f.a, `${hhmm(f.kickoff)} vs ${f.b}`); add(f.b, `${hhmm(f.kickoff)} vs ${f.a}`); });

  const say = (err: string | null, ok: string) => setMsg(err ? { t: err, ok: false } : ok ? { t: ok, ok: true } : null);
  const save = (next: Record<string, number | null>) =>
    rpc("save_lineup", { p_league: id, p_matchday: status.matchday, p_day: day, p_slots: next });
  const current = () => Object.fromEntries(STARTERS.map((s) => [s, line[s] ?? null])) as Record<string, number | null>;

  // Con un jugador elegido («Alinear»), pulsar un hueco del mapa lo coloca ahí (si no es su posición, puntúa la mitad).
  const place = async (slot: string) => {
    if (!sel) return;
    const next = current();
    STARTERS.forEach((s) => { if (next[s] === sel) next[s] = null; });
    next[slot] = sel;
    const imps = Object.values(next).filter((x) => x != null && byId.get(x)?.imp).length;
    setSel(null);
    if (imps > IMPORTS_LINEUP) return say(`Solo puedes alinear ${IMPORTS_LINEUP} imports.`, "");
    setMsg(null);
    say(await save(next), "");
  };
  const remove = async (pid: number) => {
    const next = current();
    STARTERS.forEach((s) => { if (next[s] === pid) next[s] = null; });
    setMsg(null);
    say(await save(next), "");
  };
  const lock = async (v: boolean) => {
    setMsg(null); setSel(null);
    say(await rpc("lock_lineup", { p_league: id, p_matchday: status.matchday, p_day: day, p_lock: v }),
      v ? `Equipo del ${DAYS[day - 1].label.toLowerCase()} fijado.` : "Equipo desfijado: ya puedes cambiarlo.");
  };
  const copyAll = async () => {
    setMsg(null);
    say(await rpc("copy_lineup", { p_league: id, p_matchday: status.matchday, p_day: day }),
      "Equipo copiado a los otros días que no estén fijados.");
  };

  const selP = sel ? byId.get(sel) : undefined;
  let state: { cls: string; t: string } | null = null;
  if (mine) {
    if (!hasMd) state = { cls: "hint", t: "Todavía no hay partidos cargados: cuando haya calendario podrás formar el equipo de cada día." };
    else if (isStarted) state = { cls: "hint", t: "Equipo cerrado: ya ha empezado el primer partido de este día. Es el que puntúa." };
    else if (isLocked) state = { cls: "ok", t: "Equipo fijado ✓. Puntuará tal cual. Desfíjalo si quieres cambiar algo." };
    else state = {
      cls: filled < 5 ? "err" : "hint",
      t: filled < 5
        ? `Te faltan ${5 - filled} huecos. Se fijará solo al empezar el primer partido del día y solo puntuará lo que tengas puesto.`
        : "Equipo sin fijar: se fijará solo al empezar el primer partido del día. Fíjalo si ya lo tienes claro.",
    };
  }

  return (
    <>
      <p className="sub">
        Equipo: <b>{shown?.name ?? "—"}</b>
        {!mine && me && <> · <Link href={`/liga/equipo?id=${id}`}>Volver a mi equipo</Link></>}
      </p>
      {shown && !mine && (
        <div className="stats">
          <div><small>Valor</small><b>{eur(value(shown.id))}</b></div>
          <div><small>Puntos</small><b>{points(shown.id)}</b></div>
        </div>
      )}

      <div className="daybox">
        <div className="chips">
          {DAYS.map((d) => (
            <button key={d.n} className={day === d.n ? "chip on" : "chip"} onClick={() => { setDay(d.n); setSel(null); setMsg(null); }}>
              {d.label.toUpperCase()}{shown && locked(shown.id, d.n) ? " ✓" : ""}
            </button>
          ))}
        </div>
        <div className="fxbox">
          <b>{hasMd ? `Jornada ${status.matchday} · ${DAYS[day - 1].label}` : "Sin calendario"}</b>
          {!hasMd && <small>Todavía no hay partidos cargados.</small>}
          {hasMd && dayFx.length === 0 && <small>No hay partidos este día.</small>}
          {dayFx.map((f) => (
            <div key={f.id} className="fx">
              <span className="t">{hhmm(f.kickoff)}</span><span>{f.a} <i>vs</i> {f.b}</span><span className="bo">BO{f.bo}</span>
            </div>
          ))}
        </div>
      </div>

      {state && <p className={state.cls} style={{ margin: "4px 0 10px" }}>{state.t}</p>}
      {!mine && hidden && hasMd && <p className="hint">El equipo de este día se verá cuando empiece su primer partido.</p>}
      {mine && (
        <div className="bar">
          <span className="hint">
            {selP ? `Pulsa un hueco del mapa para colocar a ${selP.name}${selP.imp ? " (import)" : ""}. Fuera de su posición puntúa la mitad.`
              : canEdit ? `Pulsa «Alinear» en un jugador y luego en el hueco del mapa. Imports alineados: ${lineImps}/${IMPORTS_LINEUP}.`
              : "Pulsa un jugador para ver sus partidos."}
          </span>
          {sel && <button className="btn out" onClick={() => setSel(null)}>Cancelar</button>}
          {canEdit && <button className="btn" disabled={filled < 5} title={filled < 5 ? "Necesitas los 5 huecos" : ""} onClick={() => lock(true)}>Fijar equipo</button>}
          {mine && hasMd && isLocked && !isStarted && <button className="btn out" onClick={() => lock(false)}>Desfijar equipo</button>}
          {canEdit && filled > 0 && <button className="btn out" onClick={copyAll}>Copiar a los otros días</button>}
          <Link href={`/liga/mercado?id=${id}`} className="btn out" style={{ textDecoration: "none" }}>Ir al mercado</Link>
        </div>
      )}
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.t}</p>}

      <div className="teamgrid">
        <div><PitchMap slots={slots} onSelect={canEdit && sel ? place : undefined} /></div>
        <div className="squad">
          {players.map((q) => {
            const aligned = inLine.has(q.id);
            const slot = Object.entries(line).find(([, pid]) => pid === q.id)?.[0];
            const when = playing.get(q.team);
            let btn: React.ReactNode = null;
            if (canEdit) {
              if (aligned) btn = <button className="btn out" onClick={() => remove(q.id)}>Quitar</button>;
              else if (sel === q.id) btn = <button className="btn out" onClick={() => setSel(null)}>Cancelar</button>;
              else btn = <button className="btn" onClick={() => setSel(q.id)}>Alinear</button>;
            }
            return (
              <div key={q.id} className={"card prect clickable" + (sel === q.id ? " sel" : "")} data-role={q.role} onClick={() => setOpen(q)}>
                <Avatar p={q} size={76} />
                <div className="info">
                  <b>{q.name}{q.rookie && <span className="rk">ROOKIE</span>}{q.imp && <span className="imp">IMPORT</span>}</b>
                  <small>{q.team}</small>
                  <span className="role">
                    {q.role.toUpperCase()}
                    {!hidden && (aligned ? ` · ALINEADO${slot && slot !== q.role ? ` DE ${slot.toUpperCase()} (½)` : ""}` : " · BANQUILLO")}
                  </span>
                  {hasMd && <span className={when ? "plays" : "plays no"}>{when ? `Juega ${when}` : "No juega este día"}</span>}
                </div>
                <div className="nums"><strong>{eur(q.price)}</strong><small>{q.pts} pts temporada</small></div>
                {btn && <div style={{ display: "contents" }} onClick={(e) => e.stopPropagation()}>{btn}</div>}
              </div>
            );
          })}
          {players.length === 0 && (
            <p className="sub">Este equipo no tiene jugadores.{mine && <> Ficha a tus 8 en el <Link href={`/liga/mercado?id=${id}`}>mercado</Link>.</>}</p>
          )}
        </div>
      </div>
      {open && <PlayerHistory p={open} onClose={() => setOpen(null)} />}
    </>
  );
}
