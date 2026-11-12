"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PHOTOS } from "@/lib/photos";

export const ROLES = ["top", "jng", "mid", "adc", "sup"] as const;
export type Role = (typeof ROLES)[number];
export const BUDGET = 50_000_000; // presupuesto del equipo: ajústalo a tu escala de precios
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

type Ids = Partial<Record<Role, number>>;
export function useTeam() {
  const [ids, setIds] = useState<Ids>({});
  useEffect(() => { try { setIds(JSON.parse(localStorage.getItem("lec-team") ?? "{}")); } catch {} }, []);
  const save = (n: Ids) => { setIds(n); try { localStorage.setItem("lec-team", JSON.stringify(n)); } catch {} };
  return {
    ids,
    pick: (p: Player) => save({ ...ids, [p.role]: p.id }),
    drop: (r: Role) => { const n = { ...ids }; delete n[r]; save(n); },
  };
}
