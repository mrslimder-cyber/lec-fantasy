"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PHOTOS } from "@/lib/photos";

export const ROLES = ["top", "jng", "mid", "adc", "sup"] as const;
export type Role = (typeof ROLES)[number];
export const BUDGET = 3_500_000; // presupuesto inicial (mismo valor que settings.budget en Supabase)
export type Player = { id: number; name: string; role: Role; price: number; rookie: boolean; team: string; pts: number; photo: string };
export const eur = (n: number) => Math.round(n).toLocaleString("es-ES") + " €";

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const [pl, pt] = await Promise.all([
        supabase.from("players").select("id,name,role,price,rookie,teams(name)").eq("active", true),
        // puntos por serie (ya divididos entre los mapas jugados)
        supabase.from("player_series_points").select("player_id,points"),
      ]);
      const sum: Record<number, number> = {};
      (pt.data ?? []).forEach((r: any) => { sum[r.player_id] = (sum[r.player_id] ?? 0) + Number(r.points); });
      setPlayers((pl.data ?? []).map((p: any) => ({
        id: p.id, name: p.name, role: p.role, price: Number(p.price), rookie: !!p.rookie,
        team: p.teams?.name ?? "", pts: Math.round((sum[p.id] ?? 0) * 10) / 10, photo: PHOTOS[p.name] ?? "",
      })));
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
