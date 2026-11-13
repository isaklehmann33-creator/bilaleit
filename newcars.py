#!/usr/bin/env python3
"""Verð nýrra bíla hjá umboðunum, til samanburðar við notaða („nýr kostar frá …“).

Heimildir: BL (opið vefþjónustuviðmót), Toyota og Askja („Verð frá“ á gerðasíðum), Hekla og Brimborg (nýir bílar á lager).
Úttak: public/data/newprices.json  {"updated": ..., "rows": [[tegund, heiti, verð, umboð], ...]}
Verð er lægsta auglýsta verð (með VSK, án rafbílastyrks). Verð án VSK (sendibílar) er umreiknað með 24% VSK.
"""
import html as H
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).parent / "public" / "data" / "newprices.json"
UA = "Mozilla/5.0 (Bilaleit/1.0; +https://bilaleit.web.app)"
MAKES = ["MERCEDES-BENZ", "LAND ROVER", "ALFA ROMEO", "MG", "BMW", "MINI", "KIA", "HONDA", "SMART", "VOLKSWAGEN", "VW", "SKODA", "AUDI",
         "MITSUBISHI", "PORSCHE", "CUPRA", "FORD", "VOLVO", "POLESTAR", "MAZDA", "CITROEN", "PEUGEOT", "OPEL", "JEEP", "RENAULT", "DACIA",
         "NISSAN", "HYUNDAI", "HONGQI", "TOYOTA", "LEXUS", "SUBARU", "SUZUKI", "ISUZU", "BYD", "TESLA", "JAGUAR", "XPENG", "MAXUS", "ZEEKR", "FIAT"]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "is"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def num(s):
    return int(re.sub(r"\D", "", s))


def text(s):
    return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def split_make(title):
    """„Mitsubishi Outlander PHEV“ -> ("MITSUBISHI", "OUTLANDER PHEV")"""
    t = re.sub(r"^(nýr|ný|nýtt)\s+", "", title.strip(), flags=re.I).upper()
    for mk in MAKES:
        if t.startswith(mk + " "):
            return ("VOLKSWAGEN" if mk == "VW" else mk), t[len(mk) + 1:].strip()
    return None, t


def bl():
    d = json.loads(get("https://www.bl.is/api/cars/?type=purchase&limit=1000"))
    return [[c["make"].upper(), (c["model"] + " " + (c.get("variant") or "")).strip().upper(), c.get("discounted_price") or c["price"], "BL"]
            for c in d["items"] if c.get("price")]


def toyota():
    h, out = get("https://www.toyota.is/"), []
    for card in h.split('class="dxp-mega-menu__card ')[1:]:
        name = re.search(r'tng-text-title[^>]*>([^<]+)<', card)
        price = re.search(r"Verð frá(?:<!-- -->)?\s*<strong>([\d.]+)\s*kr", card)
        if name and price:
            out.append(["TOYOTA", text(name.group(1)).upper(), num(price.group(1)), "Toyota"])
    return out


def askja():
    out = []
    for page, make in (("kia", "KIA"), ("mercedes-benz", "MERCEDES-BENZ"), ("honda", "HONDA")):
        time.sleep(1)
        h = get("https://www.askja.is/" + page)
        for m in re.finditer(r"Verð frá ([\d.]+) kr", h):
            segs = [x.strip() for x in re.split(r"<[^>]+>", h[max(0, m.start() - 1500):m.start()]) if x.strip()]
            # [..., heiti, slagorð, ""] -> heitið er næstsíðasti textinn á undan verðinu
            if len(segs) >= 2:
                mk, model = split_make(H.unescape(segs[-2]))
                out.append([mk or make, model, num(m.group(1)), "Askja"])
    return out


def hekla():
    out, seen = [], set()
    for p in range(1, 30):
        if p > 1:
            time.sleep(5)  # Crawl-delay: 5 í robots.txt
        h = get(f"https://www.hekla.is/is/bilar/nyir-bilar-syningasalur?page={p}")
        new = 0
        for block in h.split('<h2 class="title">')[1:]:
            link = re.search(r'href="([^"]+)"', block)
            name = re.search(r"<span>([^<]+)</span>", block)
            prices = re.findall(r'<span class="n">([\d.]+)</span>', block.split('<h2 class="title">')[0])
            if not (link and name and prices) or link.group(1) in seen:
                continue
            seen.add(link.group(1)); new += 1
            mk, model = split_make(H.unescape(name.group(1)))
            if mk:
                out.append([mk, model, num(prices[-1]), "Hekla"])  # síðasta verðið = núverandi (á eftir „Verð áður“)
        if not new:
            break
    return out


def brimborg():
    out, seen = [], set()
    for p in range(1, 30):
        if p > 1:
            time.sleep(5)  # Crawl-delay: 5 í robots.txt
        h = get(f"https://nyirbilar.brimborg.is/is/nyir-bilar?page={p}")
        new = 0
        for block in h.split('<div class="device ')[1:]:
            name = re.search(r'<div class="title"><a href="([^"]+)"><span>([^<]+)</span>', block)
            price = re.search(r'priceLabel">([^<]*)<span class="price">([\d.]+) kr', block)
            if not (name and price) or name.group(1) in seen:
                continue
            seen.add(name.group(1)); new += 1
            mk, model = split_make(H.unescape(name.group(2)))
            pr = num(price.group(2)) * (1.24 if "án VSK" in price.group(1) else 1)
            if mk:
                out.append([mk, model, round(pr / 1000) * 1000, "Brimborg"])
        if not new:
            break
    return out


def main():
    rows = []
    for fn in (bl, toyota, askja, hekla, brimborg):
        try:
            r = fn()
            print(f"Nýir bílar: {fn.__name__} {len(r)}")
            rows += r
        except Exception as e:  # ein heimild sem bregst stöðvar ekki hinar
            print(f"Nýir bílar: {fn.__name__} brást: {e}", file=sys.stderr)
    fix = {"MG MOTOR": "MG", "VW": "VOLKSWAGEN", "MERCEDES BENZ": "MERCEDES-BENZ"}
    rows = sorted({(fix.get(r[0], r[0]), re.sub(r"^(NÝR|NÝ|NÝTT|NEW)\s+", "", r[1]), r[2], r[3]) for r in rows
                   if r[0] and 1_500_000 <= r[2] <= 60_000_000})
    rows = [list(r) for r in rows]
    if len(rows) < 50 and OUT.exists():  # of fátt: líklega breytt síða, höldum gömlu gögnunum
        print("Nýir bílar: of fáar færslur, held fyrri skrá", file=sys.stderr)
        return
    OUT.write_text(json.dumps({"updated": datetime.now(timezone.utc).isoformat(timespec="minutes"), "rows": rows},
                              ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"Nýir bílar: {len(rows)} verð")


if __name__ == "__main__":
    main()
