"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PHOTOS } from "@/lib/photos";

export const ROLES = ["top", "jng", "mid", "adc", "sup"] as const;
export type Role = (typeof ROLES)[number];
export const BUDGET = 800_000; // presupuesto inicial (mismo valor que settings.budget en Supabase)
export type Player = { id: number; name: string; role: Role; price: number; rookie: boolean; team: string; pts: number; photo: string };
export const eur = (n: number) => Math.round(n).toLocaleString("es-ES") + " €";

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const [pl, pt] = await Promise.all([
        supabase.from("players").select("id,name,role,price,rookie,teams(name)").eq("active", true),
        supabase.from("player_game_points").select("player_id,points"),
      ]);
      const sum: Record<number, number> = {};
      (pt.data ?? []).forEach((r: any) => { sum[r.player_id] = (sum[r.player_id] ?? 0) + Number(r.points); });
      setPlayers((pl.data ?? []).map((p: any) => ({
        id: p.id, name: p.name, role: p.role, price: Number(p.price), rookie: !!p.rookie,
        team: p.teams?.name ?? "", pts: sum[p.id] ?? 0, photo: PHOTOS[p.name] ?? "",
      })));
      setLoading(false);
    })();
  }, []);
  return { players, loading };
}
