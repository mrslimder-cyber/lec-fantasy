#!/usr/bin/env python
"""Cierra la jornada: puntos de las ligas, precios (±15 %) y apertura del mercado. Solo al acabar la jornada."""
import argparse

from common import client

ap = argparse.ArgumentParser()
ap.add_argument("--matchday", type=int, required=True)
n = ap.parse_args().matchday
sb = client()
games = sb.table("games").select("id,calculated_at").eq("matchday", n).execute().data
pending = [g["id"] for g in games if not g["calculated_at"]]
print(f"Jornada {n}: {len(games)} games, {len(pending)} sin calcular.")
if not games or pending:
    raise SystemExit("Ejecuta scrape.py y calcular.py antes de cerrar la jornada.")
pv = float(sb.table("settings").select("value").eq("key", "point_value").execute().data[0]["value"])
if pv <= 0:
    raise SystemExit("Falta fijar el valor del punto. En el SQL Editor: update settings set value = 50000 where key = 'point_value';")
print(f"Valor del punto: {pv:,.0f} €")
if input("¿Cerrar la jornada %d? Se reparten puntos, cambian precios y se abre el mercado [s/N]: " % n).strip().lower() != "s":
    raise SystemExit("Cancelado.")
sb.rpc("close_matchday", {"p_matchday": n}).execute()
print("Jornada cerrada: clasificación actualizada y mercado abierto hasta el viernes a las 23:59.\n")

players = {p["id"]: p for p in sb.table("players").select("id,name,price,base_price").execute().data}
prices = sb.table("player_prices").select("player_id,matchday,price").execute().data
rows = []
for r in prices:
    if r["matchday"] != n:
        continue
    prev = [x for x in prices if x["player_id"] == r["player_id"] and x["matchday"] < n]
    before = float(max(prev, key=lambda x: x["matchday"])["price"]) if prev else float(players[r["player_id"]]["base_price"])
    rows.append((players[r["player_id"]]["name"], before, float(r["price"])))
rows.sort(key=lambda x: x[2] / x[1])
fmt = lambda x: f"{x[0]:<14} {x[1]:>9,.0f} -> {x[2]:>9,.0f}  ({(x[2] / x[1] - 1) * 100:+.1f} %)"
print("Mayores bajadas:"); [print("  ", fmt(x)) for x in rows[:5]]
print("Mayores subidas:"); [print("  ", fmt(x)) for x in rows[::-1][:5]]
