#!/usr/bin/env python3
"""Sami bíll auglýstur á fleiri en einum stað (t.d. hjá bílasölu og á bland.is), fundinn út frá fyrstu mynd.

Hver mynd fær myndafingrafar (dHash, 64 bitar). Tvær auglýsingar teljast sami bíll þegar fingraförin eru nær eins
OG tegund, árgerð (±1) og akstur (±3%) passa. Akstursskilyrðið útilokar nýja bíla með sömu kynningarmynd frá umboði.

Úttak: public/data/dupes.json  {"updated": ..., "groups": [[id, id, ...], ...]}
Skyndiminni: phash_cache.json {id: [mynd-slóð, fingrafar]} svo hver mynd sé bara sótt einu sinni.
"""
import io
import json
import os
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent
CARS = ROOT / "public" / "data" / "cars.json"
OUT = ROOT / "public" / "data" / "dupes.json"
CACHE = ROOT / "phash_cache.json"
BUDGET_MIN = float(os.environ.get("DUPES_BUDGET_MIN", "20"))
UA = "Bilaleit/1.0 (+https://bilaleit.web.app)"
MAX_DIST = 6          # af 64 bitum
COMMON = 4            # fingrafar á fleiri bílum en þetta = líklega „mynd væntanleg“ eða merki bílasölu


def dhash(data):
    from PIL import Image
    im = Image.open(io.BytesIO(data)).convert("L").resize((9, 8), Image.LANCZOS)
    px = list(im.getdata())
    bits = 0
    for r in range(8):
        for c in range(8):
            bits = bits << 1 | (px[r * 9 + c] > px[r * 9 + c + 1])
    return f"{bits:016x}"


def fetch_hash(c):
    try:
        req = urllib.request.Request(c["img"], headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as r:
            return c, dhash(r.read())
    except Exception:
        return c, None


def model_key(c):
    w = re.sub(r"[^A-Z0-9 ]", "", (c.get("model") or "").upper().replace(c["make"].upper(), " ")).split()
    return w[0] if w else ""


def same_car(a, b):
    ma, mb = model_key(a), model_key(b)  # „3“ og „330E“ passa, „SUPERB“ og „OCTAVIA“ ekki
    if ma and mb and not (ma.startswith(mb) or mb.startswith(ma)):
        return False
    if a["make"] != b["make"] or not a.get("year") or not b.get("year") or abs(a["year"] - b["year"]) > 1:
        return False
    ka, kb = a.get("km"), b.get("km")
    if ka is None or kb is None or min(ka, kb) < 1000:  # nýir bílar deila kynningarmyndum
        return False
    return abs(ka - kb) <= max(3000, 0.03 * max(ka, kb))


def main():
    cars = json.loads(CARS.read_text("utf-8"))["cars"]
    cache = json.loads(CACHE.read_text("utf-8")) if CACHE.exists() else {}
    todo = [c for c in cars if c.get("img") and cache.get(c["id"], [None])[0] != c["img"]]
    print(f"Tvítekningar: {len(todo)} nýjar myndir")
    deadline, done = time.time() + BUDGET_MIN * 60, 0
    with ThreadPoolExecutor(12) as pool:
        for i in range(0, len(todo), 120):
            if time.time() > deadline:
                break
            for c, h in pool.map(fetch_hash, todo[i:i + 120]):
                cache[c["id"]] = [c["img"], h]
                done += 1
    live = {c["id"]: c for c in cars}
    cache = {k: v for k, v in cache.items() if k in live}
    CACHE.write_text(json.dumps(cache, separators=(",", ":")), "utf-8")

    hashed = [(live[k], int(v[1], 16)) for k, v in cache.items() if v[1]]
    freq = {}
    for _, h in hashed:
        freq[h] = freq.get(h, 0) + 1
    hashed = [(c, h) for c, h in hashed if freq[h] <= COMMON and h not in (0, 2 ** 64 - 1)]
    by_make = {}
    for c, h in hashed:
        by_make.setdefault(c["make"], []).append((c, h))
    parent = {}

    def find(x):
        while parent.get(x, x) != x:
            x = parent[x]
        return x
    pairs = 0
    for items in by_make.values():
        for i in range(len(items)):
            a, ha = items[i]
            for b, hb in items[i + 1:]:
                if bin(ha ^ hb).count("1") <= MAX_DIST and same_car(a, b):
                    parent[find(a["id"])] = find(b["id"])
                    pairs += 1
    groups = {}
    for k in parent:
        groups.setdefault(find(k), set()).add(k)
    groups = [sorted(g | {r}) for r, g in groups.items()]
    groups = [g for g in groups if 2 <= len(g) <= 4]  # stærri hópar eru nær alltaf sameiginleg mynd, ekki sami bíll
    OUT.write_text(json.dumps({"updated": datetime.now(timezone.utc).isoformat(timespec="minutes"), "groups": groups},
                              ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"Tvítekningar: greindi {done}, {sum(1 for v in cache.values() if v[1])} með fingrafar, {len(groups)} hópar")


if __name__ == "__main__":
    main()
