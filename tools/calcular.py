#!/usr/bin/env python
"""Calcula los puntos SOLO de los games scrapeados que aún no se han calculado."""
from common import client

sb = client()
pend = (sb.table("games").select("id,matchday,played_at").not_.is_("scraped_at", "null")
        .is_("calculated_at", "null").order("played_at").execute().data)
if not pend:
    print("No hay games pendientes de calcular.")
    raise SystemExit
ids = [g["id"] for g in pend]
n = sb.rpc("calculate_pending_games").execute().data
print(f"Calculados {n} game(s): {ids}\n")
pts = sb.table("player_game_points").select("game_id,player_id,points").in_("game_id", ids).execute().data
names = {p["id"]: f"{p['name']} ({p['role']})" for p in sb.table("players").select("id,name,role").execute().data}
for gid in ids:
    rows = sorted((r for r in pts if r["game_id"] == gid), key=lambda r: -float(r["points"]))
    print(f"Game {gid}:")
    for r in rows[:3] + rows[-2:]:
        print(f"   {float(r['points']):6.1f}  {names.get(r['player_id'], r['player_id'])}")
print("\nRevisa que los puntos tengan sentido antes de cerrar la jornada.")
