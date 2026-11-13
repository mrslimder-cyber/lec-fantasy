#!/usr/bin/env python
"""Scrapea de gol.gg los partidos terminados de un día y los sube a Supabase.
Uso:  python scrape.py --day 2027-01-16 [--matchday 1] [--dry-run] [--force]
      python scrape.py --inspect GAME_ID      (guarda el HTML en debug/ para depurar)"""
import argparse
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

from aliases import PLAYER_ALIASES
from parsing import (build_game, norm, parse_fullstats, parse_game_page, parse_matchlist,
                     parse_series_links)

BASE = "https://gol.gg"
TOURNAMENT_URL = BASE + "/tournament/tournament-matchlist/LEC%202026%20Summer%20Season/"  # cámbiala por la de la temporada
GAME_URL = BASE + "/game/stats/{id}/page-game/"
FULL_URL = BASE + "/game/stats/{id}/page-fullstats/"
MADRID = ZoneInfo("Europe/Madrid")
HEAD = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}
HERE = Path(__file__).parent
DELAY = 3  # segundos entre peticiones reales (pocas páginas al día; no lo bajes)


def fetch(url, cache=True):
    (HERE / "cache").mkdir(exist_ok=True)
    f = HERE / "cache" / (re.sub(r"[^A-Za-z0-9]+", "_", url)[-120:] + ".html")
    if cache and f.exists():
        return f.read_text(encoding="utf-8")
    r = requests.get(url, headers=HEAD, timeout=30)
    if r.status_code != 200:
        sys.exit(f"{url} -> HTTP {r.status_code}. Si es 403, espera un rato o prueba desde otra red; no insistas.")
    time.sleep(DELAY)
    f.write_text(r.text, encoding="utf-8")
    return r.text


def ask(msg, default=None, cast=int):
    while True:
        raw = input(msg + (f" [{default}]" if default is not None else "") + ": ").strip()
        if not raw and default is not None:
            return default
        try:
            return cast(raw)
        except ValueError:
            print("  valor no válido")


def load_players(sb):
    rows = sb.table("players").select("id,name,role,team_id").execute().data
    return {norm(r["name"]): r for r in rows}


def series_game_ids(s):
    html = fetch(GAME_URL.format(id=s["id"]))
    ids = parse_series_links(html) or [s["id"]]
    if len(ids) != s["maps"]:
        print(f"  aviso: la lista dice {s['maps']} mapas y encontré {len(ids)} games: {ids}")
        raw = input("  IDs de los games separados por comas (Enter para usar los encontrados): ").strip()
        if raw:
            ids = sorted(int(x) for x in raw.split(","))
    return ids


def process_game(sb, gid, matchday, series_id, date, players, aliases, args):
    rows = parse_fullstats(fetch(FULL_URL.format(id=gid)))
    if rows is None:
        raise RuntimeError("no encuentro la tabla de stats (prueba: python scrape.py --inspect %d)" % gid)
    g = build_game(rows, players, aliases)
    winner, obj = parse_game_page(fetch(GAME_URL.format(id=gid)))
    sides = [", ".join(g["names"][:5]), ", ".join(g["names"][5:])]
    if winner is None:
        winner = ask(f"  ¿Quién ganó el game {gid}? 1=azul ({sides[0]}) 2=roja ({sides[1]})", cast=int) - 1
    first = ask(f"  ¿Primera torre del game {gid}? 1=azul ({sides[0]}) 2=roja ({sides[1]})", cast=int) - 1
    team = [{"dragons": 0, "grubs": 0, "heralds": 0, "barons": 0, "elders": 0} for _ in (0, 1)]
    for key in ("dragons", "grubs", "heralds", "barons"):
        vals = obj.get(key) or [ask(f"  {key} lado azul"), ask(f"  {key} lado rojo")]
        team[0][key], team[1][key] = vals
    if max(team[0]["dragons"], team[1]["dragons"]) >= 5:
        team[0]["elders"] = ask("  ancestrales (elder) lado azul", 0)
        team[1]["elders"] = ask("  ancestrales (elder) lado rojo", 0)

    print(f"  game {gid}: {g['minutes']:.1f} min · gana {'azul' if winner == 0 else 'roja'} · primera torre {'azul' if first == 0 else 'roja'}")
    print("   azul:", team[0]); print("   roja:", team[1])
    for i, p in enumerate(g["players"]):
        print(f"   {g['names'][i]:<14} {p['kills']}/{p['deaths']}/{p['assists']}  csd {p['cs_diff']:+d}  kp {p['kp']}  vspm {p['vspm']}")
    if args.dry_run:
        return
    played_at = datetime.fromisoformat(date).replace(hour=12, tzinfo=MADRID).isoformat()
    sb.table("games").upsert({"id": gid, "matchday": matchday, "played_at": played_at,
                              "winner_team_id": g["team_ids"][winner], "series_id": series_id,
                              "scraped_at": None, "calculated_at": None}).execute()
    sb.table("team_game_stats").upsert(
        [{"game_id": gid, "team_id": g["team_ids"][s], "first_tower": first == s, **team[s]} for s in (0, 1)],
        on_conflict="game_id,team_id").execute()
    sb.table("player_game_stats").upsert(
        [{"game_id": gid, **{k: v for k, v in p.items() if k != "side"}} for p in g["players"]],
        on_conflict="game_id,player_id").execute()
    sb.table("games").update({"scraped_at": datetime.now(timezone.utc).isoformat()}).eq("id", gid).execute()
    print(f"  game {gid} subido")


def inspect(gid, tournament):
    (HERE / "debug").mkdir(exist_ok=True)
    for name, url in (("matchlist", tournament), ("game", GAME_URL.format(id=gid)), ("fullstats", FULL_URL.format(id=gid))):
        (HERE / "debug" / f"{name}.html").write_text(fetch(url, cache=False), encoding="utf-8")
    print("HTML guardado en tools/debug/ (matchlist.html, game.html, fullstats.html)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--day", help="YYYY-MM-DD (por defecto hoy, hora de Madrid)")
    ap.add_argument("--matchday", type=int, help="nº de jornada (por defecto la actual de la base de datos)")
    ap.add_argument("--tournament", default=TOURNAMENT_URL)
    ap.add_argument("--force", action="store_true", help="volver a subir games ya scrapeados")
    ap.add_argument("--dry-run", action="store_true", help="solo mostrar, sin escribir en la base de datos")
    ap.add_argument("--inspect", type=int, metavar="GAME_ID")
    args = ap.parse_args()
    if args.inspect:
        return inspect(args.inspect, args.tournament)

    from common import client
    sb = client()
    day = args.day or datetime.now(MADRID).date().isoformat()
    matchday = args.matchday or sb.rpc("current_matchday").execute().data
    if not matchday:
        sys.exit("No sé la jornada: pasa --matchday N o carga el calendario (tabla fixtures).")
    players = load_players(sb)
    aliases = {norm(k): norm(v) for k, v in PLAYER_ALIASES.items()}
    series = parse_matchlist(fetch(args.tournament, cache=False), day)
    if not series:
        sys.exit(f"No hay series terminadas el {day} en la lista. Revisa --day o la URL del torneo.")
    print(f"Jornada {matchday} · {day}: {len(series)} serie(s)")
    errors = 0
    for s in series:
        print(f"\nSerie {s['text']}")
        try:
            ids = series_game_ids(s)
            done = {r["id"] for r in sb.table("games").select("id,scraped_at").in_("id", ids).execute().data if r["scraped_at"]}
            todo = ids if args.force else [i for i in ids if i not in done]
            if not todo:
                print("  ya scrapeada, la salto"); continue
            for gid in todo:
                process_game(sb, gid, matchday, min(ids), s["date"], players, aliases, args)
        except (ValueError, RuntimeError) as e:
            errors += 1
            print(f"  ERROR: {e}")
    print("\nTerminado" + (f" con {errors} error(es): arréglalos y vuelve a ejecutar (lo ya subido se salta)." if errors else "."))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
