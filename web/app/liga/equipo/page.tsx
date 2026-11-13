"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DAYS, ROLES, dayOf, eur, hhmm, type Player } from "@/lib/game";
import { useLeague } from "@/lib/league";
import { PitchMap } from "@/components/PitchMap";
import { Avatar } from "@/components/ui";
import { PlayerHistory } from "@/components/PlayerHistory";

export default function Equipo() {
  const { id, lg, teams, ros, byId, me, rpc, value, points, status, fixtures, lineup } = useLeague();
  const want = Number(useSearchParams().get("team"));
  const shown = teams.find((t) => t.id === want) ?? me;
  const mine = !!shown && shown.id === me?.id;
  const [day, setDay] = useState(1);
  const [sel, setSel] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState<Player | null>(null);

  if (!lg.drawn) return <p className="sub">Todavía no se ha hecho el sorteo.</p>;

  const squad = ros
    .filter((r) => r.league_team_id === shown?.id)
    .map((r) => byId.get(r.player_id))
    .filter((p): p is Player => !!p)
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name));
  const line = shown ? lineup(shown.id, day) : {};
  const starters = new Set(Object.values(line));
  const slots = Object.fromEntries(Object.entries(line).map(([slot, pid]) => {
    const p = byId.get(pid);
    return [slot, { p, price: p?.price ?? 0 }];
  }));

  const dayFx = fixtures.filter((f) => dayOf(f.kickoff) === day);
  const playing = new Map<string, string>();
  const add = (t: string, s: string) => playing.set(t, (playing.get(t) ? playing.get(t) + " · " : "") + s);
  dayFx.forEach((f) => { add(f.a, `${hhmm(f.kickoff)} vs ${f.b}`); add(f.b, `${hhmm(f.kickoff)} vs ${f.a}`); });

  const pre = !!status.preseason;
  const canEdit = mine && (status.lineup_open || pre);
  const say = (err: string | null, ok: string) => setMsg(err ? { t: err, ok: false } : { t: ok, ok: true });

  const slotOf = (pid: number) => ros.find((r) => r.league_team_id === shown?.id && r.player_id === pid)?.slot;
  const start = async (pid: number) => {
    setMsg(null);
    if (pre) {  // pretemporada: se mueven los huecos de la plantilla
      const role = byId.get(pid)?.role;
      const cur = role ? line[role] : undefined;
      const from = slotOf(pid);
      const to = cur ? slotOf(cur) : role;
      setSel(null);
      if (!from || !to || cur === pid) return;
      const err = await rpc("move_player", { p_league: id, p_from: from, p_to: to });
      if (err) say(err, "");
      return;
    }
    const err = await rpc("set_starter", { p_league: id, p_matchday: status.matchday, p_day: day, p_player: pid });
    setSel(null);
    if (err) say(err, "");
  };
  // Elegido un jugador con «Cambiar», el mapa sirve de destino (hueco de su posición).
  const target = (slot: string) => {
    if (!sel) return;
    const sp = byId.get(sel);
    if (!sp) return;
    if (sp.role !== slot) { say(`Ese hueco es para un ${slot.toUpperCase()}`, ""); setSel(null); return; }
    if (starters.has(sel)) setSel(null); else start(sel);
  };
  const copyAll = async () => {
    setMsg(null);
    say(await rpc("copy_lineup", { p_league: id, p_matchday: status.matchday, p_day: day }),
      `Equipo del ${DAYS[day - 1].label.toLowerCase()} copiado a los otros días.`);
  };
  const clause = async (p: Player) => {
    const amt = Math.ceil(p.price * status.clause_multiplier);
    if (!confirm(`¿Pagar ${eur(amt)} de cláusula por ${p.name}? Pasará a tu plantilla al instante.`)) return;
    setMsg(null);
    say(await rpc("clause_player", { p_league: id, p_player: p.id }), `Clausulazo hecho: ${p.name} es tuyo por ${eur(amt)}.`);
  };

  const selP = sel ? byId.get(sel) : undefined;
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
            <button key={d.n} className={day === d.n ? "chip on" : "chip"} onClick={() => { setDay(d.n); setSel(null); }}>
              {d.label.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="fxbox">
          <b>{status.matchday != null ? `Jornada ${status.matchday} · ${DAYS[day - 1].label}` : "Sin calendario"}</b>
          {status.matchday == null && <small>Todavía no hay partidos cargados.</small>}
          {status.matchday != null && dayFx.length === 0 && <small>No hay partidos este día.</small>}
          {dayFx.map((f) => (
            <div key={f.id} className="fx">
              <span className="t">{hhmm(f.kickoff)}</span><span>{f.a} <i>vs</i> {f.b}</span><span className="bo">BO{f.bo}</span>
            </div>
          ))}
        </div>
      </div>

      {mine && (
        <p className={status.lineup_open || pre ? "ok" : "hint"} style={{ margin: "4px 0 10px" }}>
          {pre
            ? "Pretemporada: coloca a tus titulares como quieras. Cuando se cargue el calendario, los equipos se crearán cada sábado."
            : status.lineup_open
              ? "Fase de creación abierta: arma tu equipo de cada día (sábado, domingo y lunes) antes del primer partido."
              : "Los equipos se crean el sábado, antes del primer partido de la jornada. Hasta entonces puntúan los de la última vez que los guardaste."}
        </p>
      )}
      {mine && (
        <div className="bar">
          <span className="hint">
            {selP ? `Cambiando a ${selP.name}: pulsa «Intercambiar» en otro jugador de su posición o su hueco del mapa.`
              : canEdit ? "Pulsa «Cambiar» en un jugador y luego en su sustituto. Pulsa un jugador para ver sus partidos." : "Pulsa un jugador para ver sus partidos."}
          </span>
          {sel && <button className="btn out" onClick={() => setSel(null)}>Cancelar</button>}
          {canEdit && !pre && <button className="btn out" onClick={copyAll}>Copiar este equipo a los otros días</button>}
          <Link href={`/liga/mercado?id=${id}`} className="btn out" style={{ textDecoration: "none" }}>Ir al mercado</Link>
        </div>
      )}
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.t}</p>}

      <div className="teamgrid">
        <div><PitchMap slots={slots} selected={sel && starters.has(sel) ? selP?.role : undefined} onSelect={canEdit && sel ? target : undefined} /></div>
        <div className="squad">
          {squad.map((q) => {
            const isStarter = starters.has(q.id);
            const when = playing.get(q.team);
            const cl = Math.ceil(q.price * status.clause_multiplier);
            let btn: React.ReactNode = null;
            if (canEdit) {
              if (!sel) btn = <button className="btn" onClick={() => setSel(q.id)}>Cambiar</button>;
              else if (sel === q.id) btn = <button className="btn out" onClick={() => setSel(null)}>Cancelar</button>;
              else if (selP && selP.role === q.role && starters.has(selP.id) !== isStarter)
                btn = <button className="btn" onClick={() => start(isStarter ? selP.id : q.id)}>Intercambiar</button>;
            }
            if (!mine && shown)
              btn = <button className="btn" disabled={!status.open || (me?.cash ?? 0) < cl}
                title={!status.open ? status.reason : (me?.cash ?? 0) < cl ? "No tienes dinero suficiente" : ""}
                onClick={() => clause(q)}>Clausulazo · {eur(cl)}</button>;
            return (
              <div key={q.id} className={"card prect clickable" + (sel === q.id ? " sel" : "")} data-role={q.role} onClick={() => setOpen(q)}>
                <Avatar p={q} size={76} />
                <div className="info">
                  <b>{q.name}{q.rookie && <span className="rk">ROOKIE</span>}</b>
                  <small>{q.team}</small>
                  <span className="role">{q.role.toUpperCase()} · {isStarter ? "TITULAR" : "BANQUILLO"}</span>
                  {status.matchday != null && (
                    <span className={when ? "plays" : "plays no"}>{when ? `Juega ${when}` : "No juega este día"}</span>
                  )}
                </div>
                <div className="nums"><strong>{eur(q.price)}</strong><small>{q.pts} pts temporada</small></div>
                {btn && <div style={{ display: "contents" }} onClick={(e) => e.stopPropagation()}>{btn}</div>}
              </div>
            );
          })}
          {squad.length === 0 && <p className="sub">Este equipo no tiene jugadores.</p>}
        </div>
      </div>
      {open && <PlayerHistory p={open} onClose={() => setOpen(null)} />}
    </>
  );
}
