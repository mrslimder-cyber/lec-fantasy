"use client";
import { Suspense, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth";
import { BUDGET, eur } from "@/lib/game";
import { LeagueProvider, useLeague } from "@/lib/league";

const TABS: [string, string][] = [
  ["/liga", "CLASIFICACIÓN"],
  ["/liga/equipo", "MI EQUIPO"],
  ["/liga/mercado", "MERCADO"],
];

function Header() {
  const { id, lg, teams, me, isOwner, value, points, rpc } = useLeague();
  const path = usePathname();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const draw = async () => {
    if (!confirm("¿Sortear los jugadores entre los equipos? No se puede deshacer.")) return;
    setBusy(true); setMsg("");
    const err = await rpc("draw_league", { p_league: id });
    setBusy(false);
    if (err) setMsg(err);
  };
  return (
    <>
      <h1>{lg.name}</h1>
      <p className="sub">
        Código para invitar: <b>{lg.code}</b> · {teams.length} equipos · Presupuesto inicial {eur(BUDGET)}
      </p>
      {isOwner && !lg.drawn && (
        <div className="bar">
          <button className="btn" disabled={busy} onClick={draw}>{busy ? "Sorteando…" : "Sortear jugadores"}</button>
        </div>
      )}
      {!lg.drawn && !isOwner && <p className="sub">Esperando a que el creador haga el sorteo.</p>}
      {msg && <p className="err">{msg}</p>}
      {lg.drawn && me && (
        <div className="stats">
          <div><small>Dinero disponible</small><b>{eur(me.cash ?? 0)}</b></div>
          <div><small>Valor de tu plantilla</small><b>{eur(value(me.id))}</b></div>
          <div><small>Tus puntos</small><b>{points(me.id)}</b></div>
        </div>
      )}
      <div className="chips" style={{ margin: "16px 0" }}>
        {TABS.map(([href, label]) => (
          <Link key={href} href={`${href}?id=${id}`} className={path === href ? "chip on" : "chip"}>{label}</Link>
        ))}
      </div>
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const id = Number(useSearchParams().get("id"));
  const { session, ready } = useSession();
  if (!ready) return <p className="sub">Cargando…</p>;
  if (!session) return <p className="sub">Inicia sesión desde <Link href="/">el inicio</Link>.</p>;
  if (!id) return <p className="sub">Falta la liga. Entra desde <Link href="/">Mis ligas</Link>.</p>;
  return (
    <LeagueProvider id={id} uid={session.user.id}>
      <Header />
      {children}
    </LeagueProvider>
  );
}

export default function LigaLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="sub">Cargando…</p>}><Shell>{children}</Shell></Suspense>;
}
