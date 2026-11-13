"""Funciones puras (sin red ni base de datos) para leer las páginas de gol.gg."""
import re
import statistics
import unicodedata

from bs4 import BeautifulSoup

DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")

REQUIRED = [
    "Player", "Role", "Kills", "Deaths", "Assists", "CS", "CSM", "Golds", "GPM", "VSPM", "DPM", "KP%",
    "Double kills", "Triple kills", "Quadra kills", "Penta kills", "CSD@15", "Objectives Stolen",
    "Total Heals On Teammates", "Total Damage Shielded On Teammates", "Shutdown bounty lost",
]


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]", "", s)


def num(s):
    s = (s or "").replace("%", "").replace(",", "").strip()
    if s in ("", "-"):
        return 0.0
    return float(s)


def parse_fullstats(html):
    """Tabla 'all stats': una fila por estadística, 10 columnas (5 de cada lado). -> {etiqueta: [10 valores]}"""
    soup = BeautifulSoup(html, "html.parser")
    for table in soup.find_all("table"):
        rows = {}
        for tr in table.find_all("tr"):
            cells = [c.get_text(" ", strip=True) for c in tr.find_all(["th", "td"])]
            if len(cells) >= 11:
                rows[cells[0]] = cells[1:11]
        if "Kills" in rows and "Player" in rows:
            return rows
    return None


def parse_game_page(html):
    """-> (lado ganador 0/1 o None, {dragons|grubs|heralds|barons: [azul, rojo]} solo lo que se pueda leer con seguridad)."""
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)
    res = re.findall(r"-\s*(WIN|LOSS)\b", text)
    winner = None
    if len(res) >= 2 and res[0] != res[1]:
        winner = 0 if res[0] == "WIN" else 1
    kw = {"dragons": ("dragon",), "barons": ("nashor", "baron"), "heralds": ("herald",),
          "grubs": ("grub", "horde")}
    limit = {"dragons": 8, "barons": 4, "heralds": 2, "grubs": 6}
    found = {k: [] for k in kw}
    for img in soup.find_all("img"):
        s = " ".join([img.get("alt", ""), img.get("title", ""), img.get("src", "")]).lower()
        if "elder" in s:
            continue
        for k, words in kw.items():
            if any(w in s for w in words):
                nxt = img.find_next(string=re.compile(r"\d"))
                m = re.search(r"\d+", nxt) if nxt else None
                if m:
                    found[k].append(int(m.group()))
                break
    obj = {k: v for k, v in found.items() if len(v) == 2 and all(0 <= x <= limit[k] for x in v)}
    return winner, obj


def parse_matchlist(html, day):
    """Series terminadas de un día (YYYY-MM-DD). -> [{id, maps, date, text}]"""
    soup = BeautifulSoup(html, "html.parser")
    out, seen = [], set()
    for tr in soup.find_all("tr"):
        a = tr.find("a", href=re.compile(r"/game/stats/\d+/"))
        if not a:
            continue
        text = " ".join(tr.get_text(" ", strip=True).split())
        d = DATE_RE.search(text)
        if not d or d.group(0) != day:
            continue
        gid = int(re.search(r"/game/stats/(\d+)/", a["href"]).group(1))
        if gid in seen:
            continue
        sc = re.search(r"\b(\d)\s*-\s*(\d)\b", DATE_RE.sub("", text))
        if not sc or int(sc.group(1)) + int(sc.group(2)) == 0:
            continue  # sin marcador = no terminada
        seen.add(gid)
        out.append({"id": gid, "maps": int(sc.group(1)) + int(sc.group(2)), "date": d.group(0), "text": text})
    return out


def parse_series_links(html):
    """IDs de los games de una serie, a partir de las pestañas 'Game 1', 'Game 2'... de la página del game."""
    soup = BeautifulSoup(html, "html.parser")
    ids = set()
    for a in soup.find_all("a", href=re.compile(r"/game/stats/\d+/")):
        if re.fullmatch(r"game\s*\d+", a.get_text(" ", strip=True).lower()):
            ids.add(int(re.search(r"/game/stats/(\d+)/", a["href"]).group(1)))
    return sorted(ids)


def build_game(rows, players, aliases):
    """rows: salida de parse_fullstats. players: norm(nombre) -> {id,name,role,team_id}.
    -> {'players': [10 dict], 'team_ids': [azul, rojo], 'names': [10], 'minutes': float}. ValueError si algo no cuadra."""
    missing = [k for k in REQUIRED if k not in rows]
    if missing:
        raise ValueError(f"Faltan filas en la tabla de stats: {missing}")
    names = rows["Player"]
    unknown, plist = [], []
    for n in names:
        key = norm(n)
        key = aliases.get(key, key)
        p = players.get(key)
        if p is None:
            unknown.append(n)
        plist.append(p)
    if unknown:
        raise ValueError(f"Jugadores que no están en tu tabla players (añádelos o ponlos en aliases.py): {unknown}")

    col = lambda label: rows[label]
    cs = [num(x) for x in col("CS")]
    golds, gpm = [num(x) for x in col("Golds")], [num(x) for x in col("GPM")]
    minutes = statistics.median([g / m for g, m in zip(golds, gpm) if m > 0])
    roles = [r.strip().upper() for r in col("Role")]

    def opp(i):  # rival de la misma línea (mismo rol en el otro lado)
        j = (i + 5) % 10
        if roles[j] == roles[i]:
            return j
        same = [k for k in range(10) if roles[k] == roles[i] and (k < 5) != (i < 5)]
        return same[0] if same else j

    out = []
    for i, p in enumerate(plist):
        out.append({
            "player_id": p["id"], "side": 0 if i < 5 else 1, "team_id": p["team_id"],
            "kills": int(num(col("Kills")[i])), "deaths": int(num(col("Deaths")[i])),
            "assists": int(num(col("Assists")[i])), "csm": num(col("CSM")[i]),
            "cs_diff": int(cs[i] - cs[opp(i)]), "csd15": int(num(col("CSD@15")[i])),
            "dpm": num(col("DPM")[i]), "kp": num(col("KP%")[i]),
            "doubles": int(num(col("Double kills")[i])), "triples": int(num(col("Triple kills")[i])),
            "quadras": int(num(col("Quadra kills")[i])), "pentas": int(num(col("Penta kills")[i])),
            "obj_stolen": int(num(col("Objectives Stolen")[i])),
            "shutdown_lost": int(num(col("Shutdown bounty lost")[i])), "vspm": num(col("VSPM")[i]),
            "heal_pm": round(num(col("Total Heals On Teammates")[i]) / minutes, 2),
            "shield_pm": round(num(col("Total Damage Shielded On Teammates")[i]) / minutes, 2),
        })
    team_ids = []
    for side in (0, 1):
        ids = [p["team_id"] for p in plist[side * 5:side * 5 + 5] if p["team_id"] is not None]
        if not ids:
            raise ValueError("Los jugadores de un lado no tienen equipo en tu tabla players")
        team_ids.append(statistics.mode(ids))
    for i, p in enumerate(plist):
        if p["role"] != {"TOP": "top", "JUNGLE": "jng", "MID": "mid", "ADC": "adc", "SUPPORT": "sup"}.get(roles[i], p["role"]):
            print(f"  aviso: {p['name']} aparece como {roles[i]} pero en tu tabla es {p['role']}")
    return {"players": out, "team_ids": team_ids, "names": list(names), "minutes": minutes}
