"use client";
import { Suspense } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth";
import { BUDGET, IMPORTS_ROSTER, ROSTER_MAX, eur } from "@/lib/game";
import { LeagueProvider, useLeague } from "@/lib/league";

const TABS: [string, string][] = [
  ["/liga/equipo", "EQUIPO"],
  ["/liga/mercado", "MERCADO"],
  ["/liga", "CLASIFICACIÓN"],
  ["/liga/jugadores", "JUGADORES"],
];

function Header() {
  const { id, lg, teams, me, value, points, squad } = useLeague();
  const path = usePathname();
  const mine = me ? squad(me.id) : [];
  return (
    <>
      <Link href="/" className="back">← Mis ligas</Link>
      <h1 style={{ marginTop: 8 }}>{lg.name}</h1>
      <p className="sub">
        Código para invitar: <b>{lg.code}</b> · {teams.length} equipos · Presupuesto inicial {eur(BUDGET)}
      </p>
      {me && (
        <div className="stats">
          <div><small>Dinero disponible</small><b>{eur(me.cash ?? 0)}</b></div>
          <div><small>Plantilla · imports</small><b>{mine.length}/{ROSTER_MAX} · {mine.filter((p) => p.imp).length}/{IMPORTS_ROSTER}</b></div>
          <div><small>Valor de tu plantilla</small><b>{eur(value(me.id))}</b></div>
          <div><small>Tus puntos</small><b>{points(me.id)}</b></div>
        </div>
      )}
      <div className="tabsbar">
        <div className="tabs">
          {TABS.map(([href, label]) => (
            <Link key={href} href={`${href}?id=${id}`} className={path === href ? "tab on" : "tab"}>{label}</Link>
          ))}
        </div>
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
