#!/usr/bin/env python3
"""Sækir notaða bíla af bílasölusíðum og skrifar public/data/cars.json.

Aðeins síður sem leyfa það í robots.txt (bilasolur.is bannar það og er því sleppt).
Engin aukasöfn - bara Python staðalsafn, svo þetta keyrir beint í GitHub Actions.
"""
import html
import json
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
        out.append({"id": "bland-" + m.group(2), "dealer": "Bland.is (einstaklingur)", "url": BLAND + m.group(1),
                    "title": text(m.group(3)), "price": num(price), "oldPrice": None,
                    "year": year_of(attrs.get("Ár", "")), "km": num(attrs.get("Akstur", "")),
                    "fuel": attrs.get("Eldsneyti", ""), "trans": attrs.get("Skipting", ""),
                    "img": ("https:" + cover.group(1)) if cover else ""})
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
    seen = set()  # sami bíll auglýstur af tveimur bílasölum
    cars = [c for c in cars if not (fingerprint(c) + (c["model"],) in seen or seen.add(fingerprint(c) + (c["model"],)))]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "updated": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "sources": report, "cars": cars,
    }, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"Alls {len(cars)} bílar -> {OUT}")


if __name__ == "__main__":
    main()
