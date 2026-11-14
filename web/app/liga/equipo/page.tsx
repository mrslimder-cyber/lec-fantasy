"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DAYS, IMPORTS_LINEUP, IMPORTS_ROSTER, ROSTER_MAX, dayOf, eur, hhmm, type Player } from "@/lib/game";
import { STARTERS, useLeague } from "@/lib/league";
import { PitchMap } from "@/components/PitchMap";
import { Avatar } from "@/components/ui";
import { PlayerHistory } from "@/components/PlayerHistory";
import { SignModal } from "@/components/SignModal";

const BENCH = ROSTER_MAX - STARTERS.length; // 3 suplentes

export default function Equipo() {
  const { id, teams, byId, me, rpc, value, points, status, fixtures, players: pool, squad, lineup, locked, started } = useLeague();
  const want = Number(useSearchParams().get("team"));
  const shown = teams.find((t) => t.id === want) ?? me;
  const mine = !!shown && shown.id === me?.id;
  const [day, setDay] = useState(1);
  const [sel, setSel] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState<Player | null>(null);
  const [sign, setSign] = useState<{ slot: string | null } | null>(null); // slot = hueco del mapa; null = banquillo

  const players = shown ? squad(shown.id) : [];
  const line = shown ? lineup(shown.id, day) : {};
  const inLine = new Set(Object.values(line));
  const hasMd = status.matchday != null;
  const isStarted = started(day);
  const isLocked = !!shown && locked(shown.id, day);
  const canEdit = mine && hasMd && !isStarted && !isLocked;   // colocar jugadores en el mapa
  const canSign = mine && !isStarted && !isLocked;            // abrir el mercado desde un hueco del mapa
  const hidden = !mine && !isStarted;   // el equipo de un rival se ve cuando empieza ese día
  const filled = Object.keys(line).length;
  const lineImps = [...inLine].filter((pid) => byId.get(pid)?.imp).length;

  const cash = me?.cash ?? 0;
  const mineIds = new Set(players.map((p) => p.id));
  const rosterImps = players.filter((p) => p.imp).length;
  const starters = players.filter((p) => inLine.has(p.id));
  const bench = players.filter((p) => !inLine.has(p.id));
  const freeBench = mine ? Math.max(0, Math.min(BENCH - bench.length, ROSTER_MAX - players.length)) : 0;

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

  // Con un suplente elegido («Cambiar»), pulsar un hueco del mapa lo coloca ahí (el que estaba pasa al banquillo).
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
  const onSlot = (slot: string) => {
    if (sel) return place(slot);
    const cur = line[slot] ? byId.get(line[slot]) : undefined;
    if (cur) return setOpen(cur);
    setMsg(null);
    setSign({ slot });
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
  const sell = async (q: Player) => {
    if (!confirm(`¿Vender a ${q.name} por ${eur(q.price)}? Si está alineado, saldrá de los equipos que aún no se hayan jugado.`)) return;
    setMsg(null); setSel(null);
    say(await rpc("sell_player", { p_league: id, p_player: q.id }), `Has vendido a ${q.name} por ${eur(q.price)}.`);
  };

  // --- Fichajes (ventana de mercado) ---
  const baseReason = (p: Player) =>
    !status.open ? status.reason
      : players.length >= ROSTER_MAX ? "Plantilla completa: vende a alguien antes"
      : p.imp && rosterImps >= IMPORTS_ROSTER ? `Ya tienes ${IMPORTS_ROSTER} imports`
      : p.price > cash ? "No tienes dinero suficiente" : "";

  // Hueco del mapa: solo esa posición. Si ya lo tienes en el banquillo, se puede poner sin pagar.
  const slotOption = (p: Player) => {
    if (inLine.has(p.id)) return { label: "Alineado", reason: "Ya está en el equipo" };
    if (p.imp && lineImps >= IMPORTS_LINEUP) return { label: "Fichar", reason: `Ya alineas ${IMPORTS_LINEUP} imports` };
    if (mineIds.has(p.id)) return { label: "Poner aquí", reason: "" };
    return { label: "Fichar", reason: baseReason(p) };
  };
  const pickSlot = (slot: string) => async (p: Player): Promise<string | null> => {
    const owned = mineIds.has(p.id);
    if (!owned) {
      const e = await rpc("buy_player", { p_league: id, p_player: p.id });
      if (e) return e;
    }
    if (!hasMd) {
      setMsg({ t: `Has fichado a ${p.name} por ${eur(p.price)}. Podrás alinearlo cuando haya calendario.`, ok: true });
      return null;
    }
    const next = current();
    STARTERS.forEach((s) => { if (next[s] === p.id) next[s] = null; });
    next[slot] = p.id;
    const e2 = await save(next);
    if (e2) setMsg({ t: `${owned ? "" : `Has fichado a ${p.name}, pero `}no se ha podido alinear: ${e2}`, ok: false });
    else setMsg({ t: owned ? `${p.name} alineado de ${slot.toUpperCase()}.` : `Has fichado a ${p.name} por ${eur(p.price)} y está alineado de ${slot.toUpperCase()}.`, ok: true });
    return null;
  };

  // Hueco libre de banquillo: todas las posiciones.
  const benchOption = (p: Player) =>
    mineIds.has(p.id) ? { label: "Fichar", reason: "Ya está en tu plantilla" } : { label: "Fichar", reason: baseReason(p) };
  const pickBench = async (p: Player): Promise<string | null> => {
    const e = await rpc("buy_player", { p_league: id, p_player: p.id });
    if (e) return e;
    setMsg({ t: `Has fichado a ${p.name} por ${eur(p.price)}: está en el banquillo.`, ok: true });
    return null;
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

  const renderCard = (q: Player, aligned: boolean) => {
    const slot = Object.entries(line).find(([, pid]) => pid === q.id)?.[0];
    const when = playing.get(q.team);
    const acts = mine ? (
      <div className="acts">
        {canEdit && !aligned && (sel === q.id
          ? <button className="btn out" onClick={() => setSel(null)}>Cancelar</button>
          : <button className="btn" onClick={() => setSel(q.id)}>Cambiar</button>)}
        <button className="btn out" disabled={!status.open} title={status.open ? "" : status.reason} onClick={() => sell(q)}>Vender</button>
      </div>
    ) : null;
    return (
      <div key={q.id} className={"card prect clickable" + (sel === q.id ? " sel" : "")} data-role={q.role} onClick={() => setOpen(q)}>
        <Avatar p={q} size={76} />
        <div className="info">
          <b>{q.name}{q.rookie && <span className="rk">ROOKIE</span>}{q.imp && <span className="imp">IMPORT</span>}</b>
          <small>{q.team}</small>
          <span className="role">
            {q.role.toUpperCase()}
            {!hidden && aligned && slot && slot !== q.role ? ` · DE ${slot.toUpperCase()} (½)` : ""}
          </span>
          {hasMd && <span className={when ? "plays" : "plays no"}>{when ? `Juega ${when}` : "No juega este día"}</span>}
        </div>
        <div className="nums"><strong>{eur(q.price)}</strong><small>{q.pts} pts temporada</small></div>
        {acts && <div style={{ display: "contents" }} onClick={(e) => e.stopPropagation()}>{acts}</div>}
      </div>
    );
  };

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
              : canSign ? `Pulsa un hueco vacío del mapa para fichar un titular, o «Cambiar» en un suplente para subirlo al mapa. Imports alineados: ${lineImps}/${IMPORTS_LINEUP}.`
              : "Pulsa un jugador para ver sus partidos."}
          </span>
          {sel && <button className="btn out" onClick={() => setSel(null)}>Cancelar</button>}
          {canEdit && <button className="btn" disabled={filled < 5} title={filled < 5 ? "Necesitas los 5 huecos" : ""} onClick={() => lock(true)}>Fijar equipo</button>}
          {mine && hasMd && isLocked && !isStarted && <button className="btn out" onClick={() => lock(false)}>Desfijar equipo</button>}
          {canEdit && filled > 0 && <button className="btn out" onClick={copyAll}>Copiar a los otros días</button>}
          <Link href={`/liga/mercado?id=${id}`} className="btn out" style={{ textDecoration: "none" }}>Ver mercado</Link>
        </div>
      )}
      {msg && <p className={msg.ok ? "ok" : "err"}>{msg.t}</p>}

      <div className="teamgrid">
        <div><PitchMap slots={slots} onSelect={canSign ? onSlot : undefined} /></div>
        <div className="squad">
          {hidden ? players.map((q) => renderCard(q, false)) : (
            <>
              <h4 className="grp">TITULARES · {starters.length}/{STARTERS.length}</h4>
              {starters.map((q) => renderCard(q, true))}
              {starters.length === 0 && <p className="hint">{mine ? "Aún no hay titulares: ficha en los huecos vacíos del mapa." : "Sin titulares."}</p>}
              <h4 className="grp">BANQUILLO</h4>
              {bench.map((q) => renderCard(q, false))}
              {Array.from({ length: freeBench }, (_, i) => (
                <div key={"free" + i} className="freeslot">
                  <div className="info">
                    <b>Hueco libre</b>
                    <small>Suplente de cualquier posición</small>
                  </div>
                  <button className="btn" disabled={!status.open} title={status.open ? "" : status.reason}
                    onClick={() => { setMsg(null); setSign({ slot: null }); }}>Fichar</button>
                </div>
              ))}
            </>
          )}
          {players.length === 0 && !mine && <p className="sub">Este equipo no tiene jugadores.</p>}
        </div>
      </div>

      {open && <PlayerHistory p={open} onClose={() => setOpen(null)} />}
      {sign && mine && (
        <SignModal
          title={sign.slot ? `Fichar titular · ${sign.slot.toUpperCase()}` : "Fichar suplente"}
          subtitle={`Dinero ${eur(cash)} · plantilla ${players.length}/${ROSTER_MAX} · imports ${rosterImps}/${IMPORTS_ROSTER}${sign.slot ? ` · alineados ${lineImps}/${IMPORTS_LINEUP}` : ""}`}
          players={pool}
          fixedRole={sign.slot ?? undefined}
          option={sign.slot ? slotOption : benchOption}
          onPick={sign.slot ? pickSlot(sign.slot) : pickBench}
          onClose={() => setSign(null)}
        />
      )}
    </>
  );
}
