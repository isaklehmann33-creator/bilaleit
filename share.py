#!/usr/bin/env python3
"""Deilisíður: public/b/<id>.html fyrir hvern bíl, með forskoðun (mynd, verð og verðmat) fyrir Messenger/Facebook.

Facebook og Messenger keyra ekki JavaScript og sjá ekki það sem kemur á eftir # í slóð, svo hver bíll fær litla
fasta síðu með og:-merkjum sem vísar svo áfram á /#bill=<id>. Verðmatið er reiknað í vafranum (app.js), svo hér
er síðan opnuð í Chrome án skjás með ?dump=share og matið lesið úr <pre id="shareDump">.
"""
import functools
import html
import http.server
import json
import os
import re
import shutil
import subprocess
import sys
import threading
from urllib.parse import urljoin
from pathlib import Path

ROOT = Path(__file__).parent
PUB = ROOT / "public"
OUT = PUB / "b"
SITE = "https://bilaleit.web.app"
CHROMES = [os.environ.get("CHROME", ""), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
           "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]


def chrome():
    for c in CHROMES:
        if c and (Path(c).exists() or shutil.which(c)):
            return c
    return None


def verdicts():
    """Opnar síðuna (borna fram héðan, svo nýjasti kóðinn gildir) og les matið: {id: [texti, flokkur, mat, óvisst]}"""
    exe = chrome()
    if not exe:
        print("Deilisíður: enginn Chrome fannst", file=sys.stderr)
        return None
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=str(PUB))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        dom = subprocess.run([exe, "--headless=new", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=90000", "--dump-dom",
                              f"http://127.0.0.1:{srv.server_port}/?dump=share"], capture_output=True, text=True, timeout=300).stdout
    finally:
        srv.shutdown()
    m = re.search(r'<pre id="shareDump">(.*?)</pre>', dom, re.S)
    return {r[0]: r[1:] for r in json.loads(html.unescape(m.group(1)))} if m else None


def kr(n):
    return f"{n:,}".replace(",", ".") + " kr."


def mkr(n):
    n = abs(n)
    return (f"{n / 1e6:.1f}".replace(".", ",") + " m.kr.") if n >= 1e6 else f"{round(n / 1e4) * 10} þús. kr."


CAP_EXC = {"KIA": "Kia", "RAM": "Ram", "UP": "up!", "NEW": "New", "VAN": "Van", "PHEV": "PHEV", "MHEV": "MHEV", "BEV": "BEV", "HSE": "HSE",
           "AMG": "AMG", "GTI": "GTI", "TDI": "TDI", "TSI": "TSI", "CDI": "CDI", "GTE": "GTE", "GTX": "GTX", "SUV": "SUV"}


def cap(s):
    """Sama og cap() í models.js: „BMW IX1 XDRIVE30“ -> „BMW IX1 XDRIVE30“, „TOYOTA LAND CRUISER“ -> „Toyota Land Cruiser“"""
    def one(w):
        u = w.upper()
        if u in CAP_EXC:
            return CAP_EXC[u]
        if re.search(r"\d", w) or (len(u) <= 3 and re.fullmatch(r"[A-Z.+]+", u)):
            return u
        return w[:1].upper() + w[1:].lower()
    return "".join(one(w) for w in re.split(r"(\s+|-)", s or ""))


def page(c, v, big=None):
    name = f"{cap(c['make'])} {cap(c.get('model', ''))}".strip()
    head = f"{name} {c.get('year') or ''}".strip()
    facts = [f"{c['km']:,} km".replace(",", ".") if c.get("km") is not None else "", c.get("fuel", ""), c.get("dealer", "")]
    desc = " · ".join(x for x in facts if x)
    title = f"{head} · {kr(c['price'])}"
    if v:
        txt, cls, est, unsure = v
        if not unsure and cls in ("good", "bad") and est:
            diff = est - c["price"]
            title = f"{txt} · {title}"
            desc = f"~{mkr(diff)} {'undir' if diff > 0 else 'yfir'} áætluðu markaðsverði ({kr(est)}). {desc}"
        elif not unsure and est:
            desc = f"{txt}: áætlað markaðsverð {kr(est)}. {desc}"
    e = html.escape
    img = big or (urljoin(c.get("url", SITE), c["img"]) if c.get("img") and "__thumb" not in c["img"] else None)
    target = "/#bill=" + c["id"]
    return f"""<!doctype html><html lang="is"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title><meta name="robots" content="noindex"><meta name="description" content="{e(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Bílaleit"><meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{SITE}/b/{e(c['id'])}.html">
{f'<meta property="og:image" content="{e(img)}">' if img else ""}<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url={e(target)}"><script>location.replace({json.dumps(target)})</script></head>
<body style="font-family:system-ui,sans-serif;background:#111;color:#eee;padding:24px"><a style="color:#6ee7b7" href="{e(target)}">{e(title)}: opna á Bílaleit</a></body></html>
"""


def main():
    cars = json.loads((PUB / "data" / "cars.json").read_text("utf-8"))["cars"]
    v = verdicts()
    if v is None:
        print("Deilisíður: náði ekki verðmati, bý til síður án þess", file=sys.stderr)
        v = {}
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    gallery = {}  # stærri mynd úr myndasafni auglýsingarinnar (forsíðumyndin er oft smámynd)
    for f in (PUB / "data" / "details").glob("*.json"):
        for k, d in json.loads(f.read_text("utf-8")).items():
            big = next((u for u in d.get("i") or [] if "thumb" not in u), None)
            if big:
                gallery[k] = big
    url = {c["id"]: c.get("url", SITE) for c in cars}
    gallery = {k: urljoin(url.get(k, SITE), u) for k, u in gallery.items()}
    for c in cars:
        (OUT / f"{c['id']}.html").write_text(page(c, v.get(c["id"]), gallery.get(c["id"])), "utf-8")
    print(f"Deilisíður: {len(cars)} síður, {len(v)} með verðmati")


if __name__ == "__main__":
    main()
