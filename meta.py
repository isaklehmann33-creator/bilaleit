#!/usr/bin/env python3
"""public/data/meta.json: hvenær hver gagnaskrá var uppfærð ({"cars": "2026-11-12T05:24+00:00", ...}).
Vafrinn ber saman þetta litla yfirlit af GitHub og af síðunni og sækir svo stóru skrárnar bara þaðan sem þær eru nýrri,
í stað þess að sækja hverja skrá tvisvar."""
import json
from pathlib import Path

DATA = Path(__file__).parent / "public" / "data"
NAMES = ["cars", "history", "vision", "registry", "dupes", "sold", "places"]

meta = {}
for n in NAMES:
    try:
        u = json.loads((DATA / f"{n}.json").read_text("utf-8")).get("updated")
    except (OSError, ValueError):
        continue
    if u:
        meta[n] = str(u)
(DATA / "meta.json").write_text(json.dumps(meta, separators=(",", ":")), "utf-8")
print("meta.json:", meta)
