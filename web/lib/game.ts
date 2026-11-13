"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PHOTOS } from "@/lib/photos";

export const ROLES = ["top", "jng", "mid", "adc", "sup"] as const;
export type Role = (typeof ROLES)[number];
export const BUDGET = 3_500_000; // presupuesto inicial (mismo valor que settings.budget en Supabase)
export type Player = {
  id: number; name: string; role: Role; price: number; rookie: boolean; team: string;
  pts: number;      // puntos totales de la temporada (suma de series)
  series: number;   // series jugadas
  avg: number;      // media de puntos por serie
  photo: string;
};
export const eur = (n: number) => Math.round(n).toLocaleString("es-ES") + " €";

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const [pl, pt] = await Promise.all([
        supabase.from("players").select("id,name,role,price,rookie,teams(name)").eq("active", true),
        // puntos por serie (ya divididos entre los mapas jugados), agregados por jugador
        supabase.from("player_season_points").select("player_id,series,points"),
      ]);
      const tot = new Map<number, { s: number; p: number }>(
        (pt.data ?? []).map((r: any) => [r.player_id, { s: Number(r.series), p: Number(r.points) }]));
      setPlayers((pl.data ?? []).map((p: any) => {
        const t = tot.get(p.id) ?? { s: 0, p: 0 };
        return {
          id: p.id, name: p.name, role: p.role, price: Number(p.price), rookie: !!p.rookie,
          team: p.teams?.name ?? "", pts: Math.round(t.p * 10) / 10, series: t.s,
          avg: t.s ? Math.round((t.p / t.s) * 10) / 10 : 0, photo: PHOTOS[p.name] ?? "",
        };
      }));
      setLoading(false);
    })();
  }, []);
  return { players, loading };
}

// Días de partido del fin de semana (el equipo se crea para cada uno).
export const DAYS = [{ n: 1, label: "Sábado" }, { n: 2, label: "Domingo" }, { n: 3, label: "Lunes" }];
export const dayOf = (iso: string) => {
  const w = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", weekday: "short" }).format(new Date(iso));
  return w === "Sun" ? 2 : w === "Mon" ? 3 : 1;
};
export const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
