#!/usr/bin/env python3
"""Sækir notaða bíla af bílasölusíðum og skrifar public/data/cars.json.

Aðeins síður sem leyfa það í robots.txt (bilasolur.is bannar það og er því sleppt).
Engin aukasöfn - bara Python staðalsafn, svo þetta keyrir beint í GitHub Actions.
"""
import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

UA = "Bilaleit/1.0 (+https://bilaleit.web.app)"
OUT = Path(__file__).parent / "public" / "data" / "cars.json"
MAX_PAGES = 40

MULTI_MAKES = ["LAND ROVER", "MERCEDES BENZ", "MERCEDES-BENZ", "ALFA ROMEO", "ASTON MARTIN",
               "ROLLS ROYCE", "MG MOTOR", "LYNK & CO", "DS AUTOMOBILES"]
MAKE_ALIAS = {"VW": "VOLKSWAGEN", "MERCEDES BENZ": "MERCEDES-BENZ", "MB": "MERCEDES-BENZ",
              "MG MOTOR": "MG", "DS AUTOMOBILES": "DS"}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "is"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def text(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<!--.*?-->|<[^>]+>", " ", s or ""))).strip()


def num(s):
    d = re.sub(r"[^\d]", "", s or "")
    return int(d) if d else None


def split_title(title):
    t = re.sub(r"\s+", " ", title.upper()).strip()
    make = next((m for m in MULTI_MAKES if t.startswith(m + " ")), t.split(" ")[0] if t else "")
    rest = t[len(make):].strip()
    return MAKE_ALIAS.get(make, make), rest


def year_of(s):
    m = re.search(r"(19|20)\d\d", s or "")
    return int(m.group(0)) if m else None


def car(**kw):
    kw["make"], kw["model"] = split_title(kw.pop("title_for_split"))
    kw["price"] = kw.get("price") or None
    # "107 km" á 15 ára bíl þýðir nær örugglega 107 þúsund km
    if kw.get("km") is not None and kw["km"] < 1000 and kw.get("year") and kw["year"] <= datetime.now().year - 3:
        kw["km"] *= 1000
    return kw


def paged(base, sep, parse, delay):
    """Fer í gegnum síður þar til engir nýir bílar koma."""
    seen, out = set(), []
    for page in range(1, MAX_PAGES + 1):
        url = base if page == 1 else f"{base}{sep}page={page}"
        try:
            cars = parse(get(url))
        except Exception as e:  # ein síða má klikka án þess að allt stöðvist
            print(f"  villa á {url}: {e}", file=sys.stderr)
            break
        new = [c for c in cars if c["id"] not in seen]
        if not new:
            break
        seen.update(c["id"] for c in new)
        out += new
        time.sleep(delay)
    return out


# --- Hekla -----------------------------------------------------------------
def parse_hekla(h):
    out = []
    for block in h.split('<div class="deviceContainer">')[1:]:
        m = re.search(r'href="(/is/bilar/notadir-bilar/view/(\d+))" title="([^"]*)"', block)
        if not m:
            continue
        prices = [num(p) for p in re.findall(r'<span class="(?:price-value|price promotion)">([^<]*)</span>', block)]
        old = re.search(r'promotionSales price">([^<]*)<', block)
        icons = [text(i) for i in re.findall(r'<div class="item">(.*?)</div>', block.split('dataIcons', 1)[-1])]
        img = re.search(r'<img src="([^"]+)"', block)
        out.append(car(
            id="hekla-" + m.group(2), dealer="Hekla", url="https://www.hekla.is" + m.group(1),
            title=text(m.group(3)), title_for_split=text(m.group(3)),
            price=next((p for p in prices if p), None),
            oldPrice=(num(old.group(1)) or None) if old else None,
            year=year_of(icons[0] if icons else ""), km=num(icons[1]) if len(icons) > 1 else None,
            fuel=icons[2] if len(icons) > 2 else "", trans="", img=img.group(1) if img else "",
        ))
    return out


# --- Brimborg --------------------------------------------------------------
def parse_brimborg(h):
    out = []
    for block in h.split('<div class="deviceWrap">')[1:]:
        m = re.search(r'href="(/is/notadir-bilar/bill/([A-Z0-9]+))" title="([^"]*)"', block)
        if not m:
            continue
        st = {text(k): text(v) for k, v in re.findall(
            r'<div class="label">(.*?)</div>\s*<div class="value">(.*?)</div>', block, re.S)}
        line = [text(x) for x in re.findall(r"<li>(.*?)</li>", block.split('class="data line"', 1)[-1].split("</ul>")[0])]
        img = re.search(r'<img src="([^"]+)"', block)
        # stærsta talan er söluverðið; minni tala er mánaðargjald í langtímaleigu
        prices = [num(p) for p in re.findall(r'class="price[^"]*">([^<]*)<', block.split('class="data line"', 1)[0])]
        out.append(car(
            id="brimborg-" + m.group(2), dealer="Brimborg", url="https://notadir.brimborg.is" + m.group(1),
            title=text(m.group(3)), title_for_split=text(m.group(3)),
            price=max([p for p in prices if p] or [0]) or None, oldPrice=None,
            year=year_of(st.get("Árgerð (nýskráð):", "")), km=num(st.get("Ekinn (km):", "")),
            trans=next((x for x in line if "skipt" in x.lower()), ""),
            fuel=next((x for x in line if re.search(r"bens|dís|dis|raf|vetni|metan|hybrid", x, re.I)
                       and "skipt" not in x.lower()), ""),
            color=st.get("Litur:", ""),
            drive=next((x for x in line if "drif" in x.lower()), ""),
            img=("https://notadir.brimborg.is" + img.group(1)) if img and img.group(1).startswith("/") else (img.group(1) if img else ""),
        ))
    return out


# --- Askja (notadir.is) ----------------------------------------------------
def parse_askja(h):
    out = []
    for block in h.split("cardList__item")[1:]:
        m = re.search(r'href="(/soluskra/(\d+)[^"]*)"><h3[^>]*>(.*?)</h3><p>(.*?)</p>', block)
        if not m:
            continue
        details = [text(x) for x in re.findall(r'detailsItem">(.*?)</div>', block)]
        km = next((d for d in details if d.endswith(" km")), "")
        price = re.search(r'priceValue">([^<]*)<', block)
        old = re.search(r"Verð áður\s*</span>([^<]*)<", block)
        tag = re.findall(r'>((?:19|20)\d\d)</div>', block)
        img = re.search(r'src="/_next/image\?url=([^&"]+)', block)
        title = f"{text(m.group(3))} {text(m.group(4))}"
        out.append(car(
            id="askja-" + m.group(2), dealer="Askja", url="https://www.notadir.is" + html.unescape(m.group(1)),
            title=title, title_for_split=title,
            price=num(price.group(1)) if price else None, oldPrice=num(old.group(1)) if old else None,
            year=int(tag[0]) if tag else None, km=num(km),
            fuel=next((d for d in details if re.search(r"bens|dís|raf|vetni|metan", d, re.I)), ""),
            trans=next((d for d in details if "skipt" in d.lower()), ""),
            img=urllib.parse.unquote(img.group(1)) if img else "",
        ))
    return out


# --- bilasolur.is (með leyfi bilasolur.is) ----------------------------------
# Leitin er ASP.NET-form: póstum flokkunum einu sinni, fáum SearchResults.aspx?id=<guid> og flettum svo.
BS = "https://bilasolur.is/"
BS_CATS = [0, 1, 2, 3, 8, 14, 28]  # fólksbíll, skutbíll, jeppi, pallbíll, sportbíll, fjölnotabíll, sportjeppi
DEALERS = Path(__file__).parent / "dealers.json"  # bid -> nafn bílasölu, geymt milli keyrslna
ADDRS = Path(__file__).parent / "dealer_addresses.json"  # bid -> {name, addr}


def bs_opener():
    import http.cookiejar
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    op.addheaders = [("User-Agent", UA), ("Accept-Language", "is")]
    return op


def parse_bilasolur(h):
    out = []
    for block in h.split('<div class="sr-item">')[1:]:
        m = re.search(r'href="CarDetails\.aspx\?bid=(\d+)&amp;cid=(\d+)&amp;sid=(\d+)', block)
        mk = re.search(r'<span class="car-make">(.*?)</span>(.*?)</div>', block, re.S)
        if not m or not mk:
            continue
        tech = [text(t) for t in re.findall(r"<div>(.*?)</div>", block.split('class="tech-details"', 1)[-1].split('class="car-section"')[0])]
        first = tech[0] if tech else ""
        km = re.search(r"([\d.]+)\s*km", first)
        rest = " · ".join(tech[1:])
        prices = [num(p) for p in re.findall(r"<span[^>]*>([\d.]+)</span>", block.split('class="car-price"', 1)[-1])]
        img = re.search(r'<img class="swiper-slide" src="([^"]+)"', block)
        title = f"{text(mk.group(1))} {text(mk.group(2))}"
        bid, cid, sid = m.groups()
        out.append(car(
            id=f"bs-{bid}-{cid}", bid=bid, dealer="", url=f"{BS}CarDetails.aspx?bid={bid}&cid={cid}&sid={sid}",
            title=title, title_for_split=title,
            price=min([p for p in prices if p] or [0]) or None,
            oldPrice=(max(prices) if len([p for p in prices if p]) > 1 else None),
            year=year_of(first), km=num(km.group(1)) if km else None,
            fuel=tech[1] if len(tech) > 1 else "",
            trans=next((x for x in rest.split(" · ") if "skipt" in x.lower()), ""),
            drive=next((x for x in rest.split(" · ") if "drif" in x.lower()), ""),
            img=img.group(1).replace(":443", "") if img else "",
        ))
    return out


def fetch_bilasolur():
    op = bs_opener()
    h = op.open(BS + "SearchCars.aspx", timeout=30).read().decode("utf-8", "replace")
    form = {}
    for tag in re.findall(r'<input[^>]*type="hidden"[^>]*>', h):
        n, v = re.search(r'name="([^"]+)"', tag), re.search(r'value="([^"]*)"', tag)
        if n:
            form[html.unescape(n.group(1))] = html.unescape(v.group(1)) if v else ""
    for name, opts in re.findall(r'<select[^>]*name="([^"]+)"[^>]*>(.*?)</select>', h, re.S):
        sel = re.search(r'<option[^>]*selected[^>]*value="([^"]*)"', opts) or re.search(r'<option[^>]*value="([^"]*)"', opts)
        form[html.unescape(name)] = html.unescape(sel.group(1)) if sel else ""
    pre = "ctl00$contentSearchEngine$searchCars$"
    for c in BS_CATS:
        form[f"{pre}search_cat_{c}"] = "on"
    form[pre + "btnSearch"] = "Leita"
    r = op.open(BS + "SearchCars.aspx", urllib.parse.urlencode(form).encode(), timeout=30)
    sid = re.search(r"id=([0-9a-f-]{36})", r.geturl())
    if not sid:
        raise RuntimeError("fékk ekki leitarniðurstöður frá bilasolur.is")
    page_html, seen, out = r.read().decode("utf-8", "replace"), set(), []
    for page in range(2, 400):
        new = [c for c in parse_bilasolur(page_html) if c["id"] not in seen]
        seen.update(c["id"] for c in new)
        out += new
        if not new or "pagingCell" not in page_html.split('paginator-previous', 1)[-1]:
            break
        time.sleep(2)
        page_html = op.open(f"{BS}SearchResults.aspx?page={page}&id={sid.group(1)}", timeout=30).read().decode("utf-8", "replace")

    # nöfn bílasala: ein auglýsing á hverja nýja bílasölu, svo geymt í dealers.json
    names = json.loads(DEALERS.read_text("utf-8")) if DEALERS.exists() else {}
    names = {k: (v.get("name", "") if isinstance(v, dict) else v) for k, v in names.items()}
    addrs = json.loads(ADDRS.read_text("utf-8")) if ADDRS.exists() else {}
    for c in out:
        if c["bid"] not in names:
            try:
                d = op.open(c["url"], timeout=30).read().decode("utf-8", "replace")
                m = re.search(r'class="seller-name-and-address[^"]*"[^>]*>(.*?)<div class="seller-address', d, re.S)
                names[c["bid"]] = text(m.group(1)) if m else ""
            except Exception as e:
                print(f"  náði ekki nafni sölu {c['bid']}: {e}", file=sys.stderr)
            time.sleep(2)
        c["dealer"] = names.get(c["bid"]) or f"Bílasala #{c['bid']}"
        if c["bid"] not in addrs:  # heimilisfang bílasölunnar (fyrir kortið), sótt einu sinni
            try:
                d = op.open(f"{BS}BilasalaDetails.aspx?id={c['bid']}", timeout=30).read().decode("utf-8", "replace")
                m = re.search(r'labelBilasalaNafn"[^>]*>.*?</span>\s*</div>\s*<div>\s*(.*?)\s*</div>\s*<div>\s*(.*?)\s*</div>', d, re.S)
                addrs[c["bid"]] = {"name": c["dealer"], "addr": f"{text(m.group(1))}, {text(m.group(2))}" if m else ""}
            except Exception as e:
                print(f"  náði ekki heimilisfangi {c['bid']}: {e}", file=sys.stderr)
            time.sleep(2)
    ADDRS.write_text(json.dumps(addrs, ensure_ascii=False, indent=0, sort_keys=True), "utf-8")
    DEALERS.write_text(json.dumps(names, ensure_ascii=False, indent=0, sort_keys=True), "utf-8")
    return out


# --- bland.is (einkasala) ----------------------------------------------------
BLAND = "https://bland.is"
BLAND_CACHE = Path(__file__).parent / "bland_cache.json"  # auglýsing -> [tegund, gerð], svo hver sé bara sótt einu sinni
KNOWN_MAKES = ("ALFA ROMEO|ASTON MARTIN|LAND ROVER|MERCEDES-BENZ|MERCEDES BENZ|ROLLS ROYCE|ABARTH|AUDI|BMW|BYD|CADILLAC|CHEVROLET|"
               "CHRYSLER|CITROEN|CITROËN|CUPRA|DACIA|DAEWOO|DAIHATSU|DODGE|DS|FIAT|FORD|GMC|HONDA|HUMMER|HYUNDAI|ISUZU|IVECO|JAGUAR|"
               "JEEP|KIA|LADA|LEXUS|LYNK|MAN|MAXUS|MAZDA|MERCEDES|MG|MINI|MITSUBISHI|NISSAN|OPEL|PEUGEOT|POLESTAR|PORSCHE|RAM|RENAULT|"
               "SAAB|SEAT|SKODA|SMART|SSANGYONG|SUBARU|SUZUKI|TESLA|TOYOTA|VOLKSWAGEN|VOLVO|VW|XPENG|ZEEKR").split("|")
TITLE_ALIAS = {"BENZ": "MERCEDES-BENZ", "BENS": "MERCEDES-BENZ", "MERCEDES": "MERCEDES-BENZ", "MERCEDES BENZ": "MERCEDES-BENZ",
               "SKODI": "SKODA", "CITROËN": "CITROEN", "LANDROVER": "LAND ROVER", "RANGE": "LAND ROVER", "LANDCRUISER": "TOYOTA",
               "YARIS": "TOYOTA", "RAV4": "TOYOTA", "COROLLA": "TOYOTA", "HILUX": "TOYOTA", "PATROL": "NISSAN", "GOLF": "VOLKSWAGEN",
               "POLO": "VOLKSWAGEN", "PASSAT": "VOLKSWAGEN", "OUTLANDER": "MITSUBISHI", "PAJERO": "MITSUBISHI", "SPORTAGE": "KIA",
               "CHEROKEE": "JEEP", "WRANGLER": "JEEP", "OCTAVIA": "SKODA", "FORESTER": "SUBARU", "IMPREZA": "SUBARU"}
FLUFF = re.compile(r"\b(til|sölu|solu|selst|tilboð|tilbod|skipti|ódýr|odyr|ekinn|árg|arg|góður|godur|flottur|nýskoðaður)\b.*", re.I)


NOT_CARS = {"SCANIA", "CAN-AM", "CAMP-LET", "KOENIGSEGG", "MAN", "IVECO", "DAF", "VOLVO TRUCKS", "POLARIS", "HOBBY", "ADRIA", "KNAUS"}  # vörubílar, tæki og rangflokkað
MAKE_SYNONYMS = {"BENZ", "BENS", "MERCEDES", "MERCEDES BENZ", "SKODI", "CITROËN", "LANDROVER"}


def make_from_title(t):
    """Reynir að finna tegund og gerð út frá frjálsum titli, t.d. 'Audi A4 2006' -> ('AUDI', 'A4')."""
    u = re.sub(r"\s+", " ", re.sub(r"[!,()*]+|\s-\s|\.(?!\d)", " ", t.upper())).strip()
    for mk in sorted(KNOWN_MAKES + list(TITLE_ALIAS), key=len, reverse=True):
        m = re.match(r"(.*?)\b" + re.escape(mk) + r"\b(.*)", u)
        if not m:
            continue
        make = TITLE_ALIAS.get(mk, MAKE_ALIAS.get(mk, mk))
        rest = m.group(2) if mk in KNOWN_MAKES or mk in MAKE_SYNONYMS else mk + m.group(2)
        rest = re.sub(r"\b(19|20)\d\d\b|\bEK\b.*", " ", FLUFF.sub("", rest)).split()
        if rest and (rest[0] == make or rest[0] in MAKE_SYNONYMS):
            rest = rest[1:]
        return make, " ".join(rest[:3])
    return None, None


def parse_bland(h):
    out = []
    for e in h.split("classifiedentry")[1:]:
        m = re.search(r'<h3>\s*<a href="(/til-solu/[^"]+/(\d+)/)"[^>]*title="([^"]*)"', e)
        if not m:
            continue
        flat = [text(x) for x in re.split(r"<[^>]+>", e)]
        flat = [x for x in flat if x]
        attrs = {flat[i]: flat[i + 1] for i in range(len(flat) - 1) if flat[i] in ("Ár", "Skipting", "Akstur", "Eldsneyti")}
        price = next((x for x in flat if re.fullmatch(r"[\d.]+ kr\.?", x)), None)
        cover = re.search(r'data-cover="([^"]+)"', e)
        town = re.search(r'classifiedAddress">\s*<a[^>]*>\s*([^<]+?)\s*</a>', e)
        out.append({"id": "bland-" + m.group(2), "dealer": "Bland.is (einstaklingur)", "url": BLAND + m.group(1),
                    "title": text(m.group(3)), "price": num(price), "oldPrice": None,
                    "year": year_of(attrs.get("Ár", "")), "km": num(attrs.get("Akstur", "")),
                    "fuel": attrs.get("Eldsneyti", ""), "trans": attrs.get("Skipting", ""),
                    "img": ("https:" + cover.group(1)) if cover else "",
                    "loc": re.sub(r"\s+", " ", town.group(1)).strip() if town else ""})
    return out


def fetch_bland():
    ads = paged(f"{BLAND}/solutorg/farartaeki/nyir-notadir-bilar-til-solu/?categoryId=17&sub=1", "&", parse_bland, 2)
    cache = json.loads(BLAND_CACHE.read_text("utf-8")) if BLAND_CACHE.exists() else {}
    out = []
    for a in ads:
        make, model = make_from_title(a["title"])
        if not make:
            if a["id"] not in cache:  # tegund ekki í titlinum: lesa „Framleiðandi“/„Undirtegund“ úr auglýsingunni
                try:
                    d = text(get(a["url"]).replace("<", " <"))
                    mk = re.search(r"Framleiðandi (.+?) (?:Undirtegund|Tegund) ", d)
                    md = re.search(r"Undirtegund (.+?) (?:Tegund|Ár) ", d)
                    cache[a["id"]] = [mk.group(1) if mk else "", md.group(1) if md else ""]
                except Exception as e:
                    print(f"  náði ekki {a['url']}: {e}", file=sys.stderr)
                    cache[a["id"]] = ["", ""]
                time.sleep(1)
            mk, md = cache[a["id"]]
            if not mk:
                continue
            mk = re.sub(r"\(.*?\)", "", mk).strip().upper().replace("MERCEDESBENZ", "MERCEDES-BENZ")
            if mk in NOT_CARS or not md:  # tóm gerð = sjálfgefið gildi, oftast "kaupi bíla" auglýsing
                continue
            make, model = MAKE_ALIAS.get(mk, mk), md.upper()
        a["make"], a["model"] = make, model or ""
        out.append(a)
    live = {a["id"] for a in ads}
    BLAND_CACHE.write_text(json.dumps({k: v for k, v in cache.items() if k in live}, ensure_ascii=False), "utf-8")
    return out


SOURCES = [
    ("Hekla", lambda: paged("https://www.hekla.is/is/bilar/notadir-bilar", "?", parse_hekla, 5)),
    ("Brimborg", lambda: paged("https://notadir.brimborg.is/is/notadir-bilar", "?", parse_brimborg, 5)),
    ("Askja", lambda: paged("https://www.notadir.is/soluskra", "?", parse_askja, 2)),
    ("bilasolur.is", fetch_bilasolur),
    ("bland.is", fetch_bland),
]


def fingerprint(c):
    return (c["make"], c.get("year"), c.get("km"), c.get("price"))


def main():
    old = {}
    if OUT.exists():  # halda gömlum gögnum frá heimild sem klikkar í kvöld
        for c in json.loads(OUT.read_text("utf-8")).get("cars", []):
            old.setdefault(c.get("src") or c["dealer"], []).append(c)
    cars, report = [], {}
    for name, fetch in SOURCES:
        try:
            got = fetch()
        except Exception as e:
            print(f"  villa í {name}: {e}", file=sys.stderr)
            got = []
        if not got and old.get(name):
            got = old[name]
            print(f"  nota gömul gögn ({len(got)})")
        for c in got:
            c["src"] = name
        if name in ("bilasolur.is", "bland.is"):  # sami bíll er oft líka á síðu umboðsins; höldum honum bara einu sinni
            have = {fingerprint(c) for c in cars}
            got = [c for c in got if fingerprint(c) not in have]
        print(f"{name}: {len(got)} bílar")
        report[name] = len(got)
        cars += got
    cars = [c for c in cars if c.get("price") and c["price"] > 100000]
    try:
        update_details(cars)
    except Exception as e:
        print(f"  villa í lýsingum: {e}", file=sys.stderr)
    seen = set()  # sami bíll auglýstur af tveimur bílasölum
    cars = [c for c in cars if not (fingerprint(c) + (c["model"],) in seen or seen.add(fingerprint(c) + (c["model"],)))]
    try:  # hvenær hver auglýsing sást fyrst (fyrir vægi auglýsinga sem standa lengi)
        ads = json.loads(HISTORY.read_text("utf-8"))["ads"] if HISTORY.exists() else {}
        for c in cars:
            if c["id"] in ads:
                c["fs"] = ads[c["id"]]["f"]
    except Exception as e:
        print(f"  fyrst séð: {e}", file=sys.stderr)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "updated": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "sources": report, "cars": cars,
    }, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"Alls {len(cars)} bílar -> {OUT}")
    update_history(cars)
    build_catalog(cars)
    build_places(cars)
    build_registry(cars)


# --- lýsingar seljanda, hestöfl og búnaður (af síðu hverrar auglýsingar) -------------
# ~13.000 síður: sóttar smám saman (nýjar fyrst) innan tímamarka, geymdar í public/data/details/NN.json
DETAILS_DIR = Path(__file__).parent / "public" / "data" / "details"
DETAILS_SHARDS = 64
DETAILS_BUDGET_MIN = float(os.environ.get("DETAILS_BUDGET_MIN", "35"))


def shard_of(car_id):
    h = 5381  # djb2, sama og í app.js
    for ch in car_id:
        h = (h * 33 + ord(ch)) & 0xFFFFFFFF
    return h % DETAILS_SHARDS


def flat(h):
    h = re.sub(r"<script.*?</script>|<style.*?</style>|<svg.*?</svg>|<!--.*?-->", " ", h, flags=re.S)
    parts = [text(x) for x in re.split(r"<[^>]+>", h)]
    return [x for x in parts if x]


def after(parts, label, n=1):
    for i, x in enumerate(parts):
        if x == label and i + n < len(parts):
            return parts[i + n]
    return ""


def parse_details(c, h):
    parts, d = flat(h), {}
    src = c.get("src")
    if src == "bilasolur.is":
        m = re.search(r'cd-section-title">\s*Nánari upplýsingar\s*</[^>]+>(.*?)(?:<div class="col-6|<a href=\'https://p1|<img class="cd-car-photo"|cd-section-title)', h, re.S)
        if m:
            d["d"] = text(m.group(1).replace("<br", "\n<br"))
        hp = re.search(r"(\d{2,4})\s*hestöfl", " ".join(parts))
    elif src == "Brimborg":
        d["d"] = after(parts, "Nánari lýsing á bíl")
        hp = re.search(r"Heildarafl \(hö\) (\d{2,4})", " ".join(parts))
    elif src == "Hekla":
        hp = re.search(r"Hestöfl (\d{2,4})", " ".join(parts))
        eq = re.search(r'<h2>Búnaður</h2>.*?<ul class="menu">(.*?)</ul>', h, re.S)
        if eq:
            d["e"] = [text(x) for x in re.findall(r"<li>(.*?)</li>", eq.group(1))][:60]
    elif src == "Askja":
        hp = re.search(r"Hestöfl (\d{2,4}) hö", " ".join(parts))
        eq = re.search(r'>Búnaður<.*?<ul[^>]*>(.*?)</ul>', h, re.S)
        if eq:
            d["e"] = [text(x) for x in re.findall(r"<li[^>]*>(.*?)</li>", eq.group(1), re.S)][:60]
    elif src == "bland.is":
        m = re.search(r'itemprop="description"[^>]*>(.*?)</p>', h, re.S)
        if m:
            d["d"] = text(m.group(1).replace("<br", "\n<br"))
        hp = None
    else:
        hp = None
    if hp:
        d["hp"] = int(hp.group(1))
    if d.get("d"):
        d["d"] = d["d"][:2500]
    rng = re.search(r"[Dd]rægni(?: allt að)?(?: \(km\))? (\d{2,3})(?: km)?", " ".join(parts))
    if rng and 10 <= int(rng.group(1)) <= 900:
        d["r"] = int(rng.group(1))
    d["i"] = photos(c, h)
    return d


def photos(c, h):
    """Myndir þessa bíls (ekki „aðrir bílar“ neðst á síðunni), stærri útgáfur, mest 15."""
    out, cid = [], c["id"].split("-", 1)[-1]
    for u in re.findall(r'(?:src|href|srcSet|data-cover)="([^"]+)"', h):
        u = html.unescape(u).split(" ")[0]
        if "_next/image" in u:
            m = re.search(r"url=([^&]+)", u)
            u = urllib.parse.unquote(m.group(1)) if m else ""
        u = u.replace(":443", "")
        src = c.get("src")
        if src in ("bilasolur.is", "Hekla"):
            ok = re.search(r"/CarImage/\d+/" + re.escape(cid.split("-")[-1]) + r"/\d+/", u)
            u = re.sub(r"/\d+(\?.*)?$", "/784", u) if ok else ""
        elif src == "Askja":
            u = u.replace("w=400", "w=800") if ("c=" + cid + "&") in u else ""
        elif src == "Brimborg":
            u = ("https://notadir.brimborg.is" + u) if u.startswith("/static/notadir/images/" + cid + "_") and "_full" in u else ""
        elif src == "bland.is":
            u = ("https:" + u) if "/album/img/" in u and "/m/" in u else ""
        else:
            u = ""
        if u and u not in out:
            out.append(u)
    if c.get("src") == "Askja":  # myndanúmerin eru í gögnum síðunnar (Next.js), ekki í <img>
        pids = sorted({int(x) for x in re.findall(r"c(?:=|%3D|\\u003d)" + re.escape(cid) + r"(?:&amp;|&|%26|\\u0026)p(?:=|%3D|\\u003d)(\d+)", h)})
        out = [f"https://bilasolur.is/CarImage.aspx?s=81&c={cid}&p={p}&w=800" for p in pids]
    if c.get("src") == "bland.is":  # skyldar auglýsingar neðst á síðunni eru með sínar eigin myndir
        cut = h.find("Aðrar skyldar auglýsingar")
        if cut > 0:
            out = [u for u in out if h.find(u.replace("https:", "")) < cut]
    return out[:15]


# --- viðvaranir, plúsar og búnaður úr lýsingu og búnaðarlista -------------------
NEG = r"(?:ekki|ekkert|engin|ekkert|aldrei|enginn|laus við|án)\W+(?:\w+\W+){0,2}"
FLAGS = {   # kóði: (neikvætt?, mynstur)
    "tjon": (True, r"tjón|árekstr|klesst|tjónabíl"),
    "ryd": (True, r"\bryð"),
    "laga": (True, r"þarfnast|þarf að laga|þarf smá|bilaður|bilun|vélarvandamál|gírkassavandamál|ekki gangfær|óökufær|í varahluti|til niðurrifs|uppgerðar"),
    "skodun": (True, r"endurskoðun|fær ekki skoðun|óskoðaður|athugasemd(?:ir)? (?:í|við) skoðun"),
    "serut": (True, r"rall[ýy]\w*|keppnisbíl|kvartmílu|driftbíl|sandspyrnu|torfærubíl|til niðurrifs|í varahluti|varahlutabíl|ógangfær|óökufær|verkefnabíll|verkefni fyrir"),
    "timareim": (False, r"(?:ný|nýleg|skipt um|nýbúið að skipta um) (?:tímareim|keðju)|tímareim (?:ný|nýleg|skipt)"),
    "skodadur": (False, r"nýskoðaður|ný skoðun|skoðaður (?:20\d\d|til)|nýlega skoðaður"),
    "smurbok": (False, r"smurbók|þjónustubók|þjónustusaga|full þjónustusaga|alltaf þjónustaður"),
    "eigandi": (False, r"einn eigandi|1 eigandi|eins eiganda"),
    "reyklaus": (False, r"reyklaus"),
    "abyrgd": (False, r"verksmiðjuábyrgð|í ábyrgð|ábyrgð til"),
    "dekk": (False, r"vetrardekk fylgja|nagladekk fylgja|aukadekk|tveir dekkjagangar|2 dekkjagangar|ný dekk|heilsársdekk"),
}
FEATURES = {
    "krokur": r"dráttarkr[óo]k|dráttarbeisli|dráttarbúnað",
    "sjo": r"\b7 sæta|\b7 manna|sjö sæta|\b7 farþeg",
    "carplay": r"carplay|android auto",
    "hitistyri": r"hiti í stýri",
    "hitisaeti": r"hiti í (?:fram)?sætum|hiti í sæti",
    "ledur": r"leður",
    "topplug": r"topplúg|glerþak|panorama",
    "myndavel": r"bakkmyndavél|360° myndavél|360 myndavél",
    "acc": r"skynvæddur hraðastillir|aðlögunarhraðastill|adaptive cruise",
    "varmadaela": r"varmadæl",
    "lykill": r"lykillaus",
    "sjonlina": r"sjónlínuskjá|head.?up",
}


def tags(d):
    t = (" ".join(d.get("e", [])) + " " + d.get("d", "")).lower()
    fl, ft = [], []
    for code, (neg, pat) in FLAGS.items():
        for m in re.finditer(pat, t):
            before = t[max(0, m.start() - 30):m.start()]
            if neg and re.search(NEG + r"$", before):  # „ekkert ryð“, „aldrei lent í tjóni“
                continue
            fl.append(code)
            break
    for code, pat in FEATURES.items():
        if re.search(pat, t):
            ft.append(code)
    return fl, ft


def update_details(cars):
    DETAILS_DIR.mkdir(parents=True, exist_ok=True)
    shards = {}
    for i in range(DETAILS_SHARDS):
        f = DETAILS_DIR / f"{i:02d}.json"
        shards[i] = json.loads(f.read_text("utf-8")) if f.exists() else {}
    have = {k for s in shards.values() for k in s}
    live = {c["id"] for c in cars}
    todo = [c for c in cars if c["id"] not in have and c.get("url")]
    todo.sort(key=lambda c: c.get("src") == "bilasolur.is")  # umboðin og bland fyrst, þau eru færri
    deadline, done, op = time.time() + DETAILS_BUDGET_MIN * 60, 0, bs_opener()
    for c in todo:
        if time.time() > deadline:
            break
        try:
            html_ = op.open(c["url"], timeout=30).read().decode("utf-8", "replace")
            shards[shard_of(c["id"])][c["id"]] = parse_details(c, html_)
            done += 1
        except Exception as e:
            shards[shard_of(c["id"])][c["id"]] = {}
            print(f"  lýsing {c['url']}: {e}", file=sys.stderr)
        time.sleep(1)
    for i, s in shards.items():  # henda lýsingum auglýsinga sem eru horfnar
        s = {k: v for k, v in s.items() if k in live}
        (DETAILS_DIR / f"{i:02d}.json").write_text(json.dumps(s, ensure_ascii=False, separators=(",", ":")), "utf-8")
        shards[i] = s
    det = {k: v for s in shards.values() for k, v in s.items()}
    hp = 0
    for c in cars:
        d = det.get(c["id"])
        if not d:
            continue
        if d.get("hp"):
            c["hp"] = d["hp"]; hp += 1
        if d.get("r"):
            c["rng"] = d["r"]
        fl, ft = tags(d)
        if fl:
            c["fl"] = fl
        if ft:
            c["ft"] = ft
    left = len(todo) - done
    print(f"Lýsingar: sótti {done}, {left} eftir, {hp} með hestöfl")


# --- staðsetningar fyrir kortið ---------------------------------------------
PLACES = Path(__file__).parent / "public" / "data" / "places.json"
GEO_CACHE = Path(__file__).parent / "geo_cache.json"  # heimilisfang -> [lat, lon] (OpenStreetMap Nominatim, 1 fyrirspurn/sek)


def _nominatim(q):
    r = json.loads(get("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=is&q=" + urllib.parse.quote(q)))
    time.sleep(1.1)
    return r[0] if r else None


DATIVE = (("hálsi", "háls"), ("bakka", "bakki"), ("hrauni", "hraun"), ("vegi", "vegur"), ("götu", "gata"), ("túni", "tún"),
          ("firði", "fjörður"), ("holti", "holt"), ("höfða", "höfði"), ("ási", "ás"), ("smára", "smári"), ("nesi", "nes"),
          ("hellu", "hella"), ("garði", "garður"), ("teigi", "teigur"), ("völlum", "vellir"), ("vogi", "vogur"),
          ("görðum", "garðar"), ("fljóti", "fljót"), ("stíg", "stígur"), ("hvarfi", "hvarf"), ("skeifunni", "skeifan"),
          ("lind", "lind"), ("braut", "braut"), ("bakka", "bakki"), ("mýri", "mýri"), ("hlíð", "hlíð"), ("ströndu", "strönd"))


def street_variants(addr):
    """Heimilisföng eru oft í þágufalli („Krókhálsi 7“) en OpenStreetMap þekkir nefnifallið („Krókháls 7“)."""
    addr = re.sub(r"\([^)]*\)", "", addr)                       # „(Dragháls megin)“
    addr = re.sub(r"(\d+)\s*-\s*\d+", r"\1", addr)                # „6-8“ -> „6“
    m = re.match(r"\s*(.+?)\s+(\d+[a-zA-Z]?|[A-Z])?\s*,\s*(.*)", addr)
    if not m:
        return [addr]
    street, no, town = m.groups()
    no = no or ""
    low = street.lower()
    cands = [street] + [street[: len(street) - len(a)] + b for a, b in DATIVE if low.endswith(a) and a != b]
    out, bare = [], re.sub(r"^\d+\s*", "", town)
    for st in cands:
        out += [f"{st} {no}, {bare}".replace("  ", " "), f"{st} {no}, {town}".replace("  ", " ")]
    for st in cands:                                                # síðasta úrræði: gatan án húsnúmers
        out.append(f"{st}, {bare}")
    return out


def geocode(q, cache, street=False):
    key = ("v2:" if street else "") + q
    if key in cache:
        return cache[key]
    ll = None
    try:
        for cand in (street_variants(q) if street else [q]):
            r = _nominatim(cand)
            # götuheimilisfang: taka bara nákvæma niðurstöðu (hús, gata, verslun), ekki miðju bæjarins
            if r and (not street or r.get("addresstype") not in ("city", "town", "village", "postcode", "suburb", "municipality", "county")):
                ll = [round(float(r["lat"]), 5), round(float(r["lon"]), 5)]
                break
    except Exception as e:
        print(f"  staðsetning {q}: {e}", file=sys.stderr)
        return None
    cache[key] = ll
    return ll


def build_places(cars):
    cache = json.loads(GEO_CACHE.read_text("utf-8")) if GEO_CACHE.exists() else {}
    addrs = json.loads(ADDRS.read_text("utf-8")) if ADDRS.exists() else {}
    by_name = {a["name"]: a["addr"] for a in addrs.values() if a.get("addr")}
    dealers, towns = {}, {}
    for name in sorted({c["dealer"] for c in cars if c.get("src") != "bland.is"}):
        # Hekla/Askja/Brimborg eru líka á bilasolur.is, svo heimilisfangið finnst eftir nafni
        addr = by_name.get(name) or by_name.get(name.split(",")[0]) or by_name.get(name + ", notaðir bílar")
        if not addr:  # t.d. „Hekla“ á eigin síðu = „Hekla, notaðir bílar“ á bilasolur.is
            addr = next((a for n, a in by_name.items() if n.split(",")[0].split(" ")[0] == name), None)
        if addr:
            ll = geocode(addr, cache, street=True) or geocode(addr.split(",")[-1].strip(), cache)
            if ll:
                dealers[name] = ll + [addr]
    for loc in sorted({c.get("loc") for c in cars if c.get("src") == "bland.is" and c.get("loc")}):
        ll = geocode(loc, cache) or geocode(re.sub(r"^\d+\s*", "", loc), cache)
        if ll:
            towns[loc] = ll
    GEO_CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0, sort_keys=True), "utf-8")
    PLACES.write_text(json.dumps({"updated": datetime.now(timezone.utc).isoformat(timespec="minutes"), "dealers": dealers, "towns": towns}, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"Kort: {len(dealers)} bílasölur, {len(towns)} staðir")


# --- ökutækjaskrá Samgöngustofu (Power BI, með leyfi) ------------------------------
# Fyrir hverja tegund/gerð: fjöldi í umferð, meðalaldur og hlutfall fluttra inn notaðra.
# Fyrir bíla með bílnúmeri í auglýsingunni (Brimborg): fyrsta skráning, innflutningur, hestöfl, litur.
REGISTRY = Path(__file__).parent / "public" / "data" / "registry.json"
USED_IMPORT = ("Notað", "Notað gvk.", "Notað skv. mæli")


def norm_make(s):
    return re.sub(r"[^A-Z0-9]", "", (s or "").split(",")[0].upper().replace("MERCEDES BENZ", "MERCEDESBENZ"))


def build_registry(cars):
    import pbi
    reg = json.loads(REGISTRY.read_text("utf-8")) if REGISTRY.exists() else {"makes": {}, "plates": {}}
    try:
        tegundir = pbi.query(["Tegund"], ["Talning fastanúmera"], pbi.IN_TRAFFIC, top=600)
        by_norm = {}
        for r in tegundir:
            if r["Tegund"]:
                by_norm.setdefault(norm_make(r["Tegund"]), []).append(r["Tegund"])
        counts = {}
        for c in cars:
            counts[c["make"]] = counts.get(c["make"], 0) + 1
        makes = {}
        for mk in sorted(m for m, n in counts.items() if n >= 3):
            names = by_norm.get(norm_make(mk))
            if not names:
                continue
            where = pbi.IN_TRAFFIC + [pbi.isin("Tegund", names)]
            q1 = pbi.query(["Undirtegund"], ["Talning fastanúmera", "Meðalaldur"], where, top=3000)
            q2 = pbi.query(["Undirtegund", "Innflutningsástand"], ["Talning fastanúmera"], where, top=6000)
            used = {}
            for r in q2:
                if r["Innflutningsástand"] in USED_IMPORT:
                    used[r["Undirtegund"]] = used.get(r["Undirtegund"], 0) + (r["Talning fastanúmera"] or 0)
            models = {}
            for r in q1:
                if not r["Undirtegund"] or not r["Talning fastanúmera"]:
                    continue
                try:
                    age = round(float(r["Meðalaldur"]), 1)
                except (TypeError, ValueError):
                    age = None
                models[r["Undirtegund"]] = [r["Talning fastanúmera"], age, used.get(r["Undirtegund"], 0)]
            makes[mk] = models
        reg["makes"] = makes
    except Exception as e:  # skráin er aukaupplýsingar; gömul gögn haldast ef Power BI bregst
        print(f"  ökutækjaskrá (tegundir): {e}", file=sys.stderr)
    # bílnúmer úr auglýsingum (Brimborg notar bílnúmerið sem auðkenni)
    plates = sorted({c["id"].split("-", 1)[1] for c in cars if c.get("src") == "Brimborg" and re.fullmatch(r"[A-Z]{2}[A-Z0-9]\d{2}", c["id"].split("-", 1)[1])})
    found = {}
    try:
        for i in range(0, len(plates), 80):
            for r in pbi.query(["Fastanúmer", "Tegund", "Undirtegund", "Fyrsti skráningardagur", "Nýskráningardagur", "Innflutningsástand", "Hestöfl", "Litur"],
                               [], [pbi.isin("Fastanúmer", plates[i:i + 80])], top=200):
                found[r["Fastanúmer"]] = {"first": r["Fyrsti skráningardagur"], "is": r["Nýskráningardagur"], "imp": r["Innflutningsástand"],
                                          "hp": r["Hestöfl"], "col": r["Litur"]}
        reg["plates"] = found
    except Exception as e:
        print(f"  ökutækjaskrá (bílnúmer): {e}", file=sys.stderr)
    reg["updated"] = datetime.now(timezone.utc).isoformat(timespec="minutes")
    REGISTRY.write_text(json.dumps(reg, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"Ökutækjaskrá: {len(reg['makes'])} tegundir, {len(reg.get('plates', {}))} bílnúmer")


# --- saga auglýsinga --------------------------------------------------------
# Hver auglýsing sem við höfum séð: fyrst/síðast séð, verðsaga og hvenær hún hvarf (seld eða tekin út).
HISTORY = Path(__file__).parent / "public" / "data" / "history.json"
KEEP_GONE_DAYS = 730
SOLD = Path(__file__).parent / "public" / "data" / "sold.json"


def update_history(cars):
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    h = json.loads(HISTORY.read_text("utf-8")) if HISTORY.exists() else {"ads": {}}
    ads, live = h["ads"], set()
    for c in cars:
        live.add(c["id"])
        a = ads.get(c["id"])
        if not a:
            a = ads[c["id"]] = {"m": c["make"], "o": c["model"], "y": c.get("year"), "k": c.get("km"), "d": c.get("dealer", ""),
                                "u": c.get("url", ""), "f": today, "p": []}
        a.update({"l": today, "k": c.get("km"), "g": None, "fu": c.get("fuel", ""), "t": c.get("title", ""), "s": c.get("src", ""),
                  "tr": c.get("trans", ""), "dr": c.get("drive", "")})
        if not a["p"] or a["p"][-1][1] != c["price"]:
            a["p"].append([today, c["price"]])
    cutoff = (datetime.now(timezone.utc).timestamp() - KEEP_GONE_DAYS * 86400)
    for k in list(ads):
        a = ads[k]
        if k not in live and not a.get("g"):
            a["g"] = today  # hvarf af skrá í dag
        if a.get("g") and datetime.strptime(a["g"], "%Y%m%d").replace(tzinfo=timezone.utc).timestamp() < cutoff:
            del ads[k]
    h["updated"] = today
    # seldir / teknir af skrá síðustu 12 mánuði: notaðir í verðlíkaninu (síðasta verð ≈ söluverð)
    year_ago = (datetime.now(timezone.utc).timestamp() - 365 * 86400)
    sold = []
    for k, a in ads.items():
        if not a.get("g") or not a.get("p") or not a.get("fu"):
            continue
        if datetime.strptime(a["g"], "%Y%m%d").replace(tzinfo=timezone.utc).timestamp() < year_ago:
            continue
        sold.append([k, a["m"], a["o"], a.get("y"), a.get("k"), a["p"][-1][1], a["g"], a["f"], a["fu"], a.get("t", ""), a.get("s", ""), a.get("tr", ""), a.get("dr", "")])
    SOLD.write_text(json.dumps({"updated": today, "cols": ["id", "make", "model", "year", "km", "price", "gone", "first", "fuel", "title", "src", "trans", "drive"],
                                "rows": sold}, ensure_ascii=False, separators=(",", ":")), "utf-8")
    HISTORY.write_text(json.dumps(h, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"Saga: {len(ads)} auglýsingar, {sum(1 for a in ads.values() if a.get('g'))} horfnar")


# --- gerðaskrá: allar gerðir hverrar tegundar, líka þær sem eru ekki á sölu núna ----------
CATALOG = Path(__file__).parent / "public" / "data" / "catalog.json"
# Evrópskar/asískar gerðir sem NHTSA (bandaríski listinn) þekkir ekki
EXTRA_MODELS = {
    "SKODA": "Citigo Fabia Rapid Scala Octavia Superb Kamiq Karoq Kodiaq Yeti Roomster Enyaq Elroq Epiq",
    "DACIA": "Sandero Logan Duster Jogger Spring Bigster Lodgy Dokker",
    "SEAT": "Ibiza Leon Arona Ateca Tarraco Alhambra Mii Toledo Altea",
    "CUPRA": "Born Formentor Leon Ateca Tavascan Terramar",
    "PEUGEOT": "108 208 2008 308 3008 408 508 5008 Partner Rifter Expert Traveller Boxer e-208 e-2008",
    "CITROEN": "C1 C3 C3-Aircross C4 C4-Picasso C5 C5-Aircross C5-X Berlingo Jumpy Jumper SpaceTourer DS3 DS4 DS5",
    "RENAULT": "Clio Captur Megane Scenic Kadjar Austral Arkana Koleos Zoe Twingo Talisman Kangoo Trafic Master Espace Rafale",
    "OPEL": "Corsa Astra Insignia Mokka Crossland Grandland Zafira Meriva Adam Combo Vivaro Movano Ampera",
    "TOYOTA": "Aygo Yaris Yaris-Cross Auris Corolla Avensis C-HR RAV4 Land-Cruiser Hilux Proace Prius Highlander bZ4X GR86 Supra Verso Urban-Cruiser Hiace Camry",
    "KIA": "Picanto Rio Ceed XCeed ProCeed Stonic Niro Sportage Sorento Soul Optima Stinger EV3 EV4 EV5 EV6 EV9 Carens",
    "HYUNDAI": "i10 i20 i30 i40 Bayon Kona Tucson Santa-Fe Ioniq Ioniq-5 Ioniq-6 Ioniq-9 ix35 Inster Nexo",
    "VOLVO": "C30 C40 C70 S40 S60 S80 S90 V40 V50 V60 V70 V90 XC40 XC60 XC70 XC90 EX30 EX40 EX90 EC40",
    "MG": "MG3 MG4 MG5 ZS HS Marvel-R Cyberster",
    "POLESTAR": "1 2 3 4",
    "SUZUKI": "Alto Swift Ignis Baleno Vitara S-Cross Jimny SX4 Grand-Vitara Swace Across",
    "MITSUBISHI": "Space-Star Colt ASX Eclipse-Cross Outlander Pajero L200 Lancer",
    "NISSAN": "Micra Note Juke Qashqai X-Trail Leaf Ariya Navara Patrol Pathfinder Townstar NV200",
    "SMART": "Fortwo Forfour #1 #3",
    "FIAT": "500 500e 500X Panda Tipo Doblo Ducato Punto",
    "BYD": "Dolphin Atto-3 Seal Seal-U Han Tang Sealion-7",
    "LAND ROVER": "Defender Discovery Discovery-Sport Range-Rover Range-Rover-Sport Range-Rover-Evoque Range-Rover-Velar Freelander",
}


def build_catalog(cars):
    cat = json.loads(CATALOG.read_text("utf-8")) if CATALOG.exists() else {"nhtsa": {}, "fetched": ""}
    month = datetime.now(timezone.utc).strftime("%Y%m")
    if cat.get("fetched") != month:  # NHTSA-listinn sóttur einu sinni í mánuði
        makes = sorted({c["make"] for c in cars if sum(1 for x in cars if x["make"] == c["make"]) >= 3})
        for mk in makes:
            try:
                r = json.loads(get("https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/" + urllib.parse.quote(mk.lower()) + "?format=json"))
                names = sorted({x["Model_Name"] for x in r.get("Results", [])
                                if re.search(r"[A-Za-z]", x["Model_Name"]) and not re.fullmatch(r"[A-Z]{1,3}\d{3,4}[A-Z]?", x["Model_Name"])})
                if names:
                    cat["nhtsa"][mk] = names
            except Exception as e:
                print(f"  NHTSA {mk}: {e}", file=sys.stderr)
            time.sleep(0.3)
        cat["fetched"] = month
    cat["extra"] = {k: [m.replace("-", " ") for m in v.split()] for k, v in EXTRA_MODELS.items()}
    CATALOG.write_text(json.dumps(cat, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"Gerðaskrá: {len(cat['nhtsa'])} tegundir frá NHTSA")


if __name__ == "__main__":
    main()
