#!/usr/bin/env python
"""Liga flash: scrapea UNA serie (la final) a partir de la URL de cualquiera de sus games en gol.gg.
Uso:  python scrape_flash.py https://gol.gg/game/stats/12345/page-game/ [--dry-run] [--force] [--fresh]
Los games se guardan con matchday 900 (fuera del calendario normal). Después: python calcular.py
--fresh borra la caché de páginas (úsalo si ya lanzaste el script con la serie a medias)."""
import argparse
import re
import shutil
import sys
from datetime import datetime

import scrape
from aliases import PLAYER_ALIASES
from parsing import norm, parse_series_links
from scrape import GAME_URL, MADRID, fetch, load_players, process_game

FLASH_MATCHDAY = 900  # debe coincidir con flash_config.matchday en Supabase

# La puntuación v2 ya no usa primera torre ni objetivos de equipo: no se preguntan (se guardan a 0).
# Sí se pregunta el ganador del game si no se detecta solo, porque decide el +10 % de la serie.
_ask = scrape.ask
def _quick_ask(msg, default=None, cast=int):
    if "ganó" in msg:
        return _ask(msg, default, cast)
    return default if default is not None else 0
scrape.ask = _quick_ask

ap = argparse.ArgumentParser()
ap.add_argument("url", help="URL (o id) de cualquier game de la serie")
ap.add_argument("--dry-run", action="store_true", help="solo mostrar, sin escribir en la base de datos")
ap.add_argument("--force", action="store_true", help="volver a subir games ya scrapeados")
ap.add_argument("--fresh", action="store_true", help="borrar la caché de páginas antes de empezar")
args = ap.parse_args()

m = re.search(r"/game/stats/(\d+)", args.url) or re.fullmatch(r"\s*(\d+)\s*", args.url)
if not m:
    sys.exit("No encuentro el id del game en esa URL (debe tener /game/stats/<número>/).")
first = int(m.group(1))
if args.fresh:
    shutil.rmtree(scrape.HERE / "cache", ignore_errors=True)

ids = parse_series_links(fetch(GAME_URL.format(id=first))) or [first]
if first not in ids:
    ids = sorted(ids + [first])
print(f"Serie con {len(ids)} game(s): {ids}")

aliases = {norm(k): norm(v) for k, v in PLAYER_ALIASES.items()}
if args.dry_run:
    sb, players = None, None
else:
    from common import client
    sb = client()
    players = load_players(sb)
    done = {r["id"] for r in sb.table("games").select("id,scraped_at").in_("id", ids).execute().data if r["scraped_at"]}
    if not args.force:
        ids_todo = [i for i in ids if i not in done]
        if not ids_todo:
            sys.exit("Todos los games de la serie ya estaban subidos (usa --force para repetirlos).")
    else:
        ids_todo = ids
if args.dry_run:
    ids_todo = ids

date = datetime.now(MADRID).date().isoformat()
errors = 0
for gid in ids_todo:
    print(f"\nGame {gid}")
    try:
        process_game(sb, gid, FLASH_MATCHDAY, min(ids), date, players, aliases, args)
    except (ValueError, RuntimeError) as e:
        errors += 1
        print(f"  ERROR: {e}")
print("\nTerminado" + (f" con {errors} error(es): arréglalos y vuelve a ejecutar (lo ya subido se salta)." if errors else "."))
sys.exit(1 if errors else 0)
