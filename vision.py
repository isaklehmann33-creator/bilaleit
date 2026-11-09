#!/usr/bin/env python3
"""Ástandsmat út frá mynd: opið CLIP-líkan (openai/clip-vit-base-patch32) flokkar fyrstu mynd hvers bíls.

Ókeypis og keyrir á GitHub í næturkeyrslunni. Gróft mat: grípur augljós tilvik (tjónabíll, rallýbíll, bíll í hlutum
á verkstæði, ryðhrúga) en ekki smáar rispur. Merkt bara þegar líkanið er mjög öruggt.

Úttak: public/data/vision.json  {"updated": ..., "flags": {id: [flokkur, líkur]}}  (bara merktir bílar, lítil skrá)
Skyndiminni: vision_cache.json {id: [mynd-slóð, flokkur, líkur]} svo hver mynd sé bara greind einu sinni.
"""
import io
import json
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent
CARS = ROOT / "public" / "data" / "cars.json"
OUT = ROOT / "public" / "data" / "vision.json"
CACHE = ROOT / "vision_cache.json"
BUDGET_MIN = float(os.environ.get("VISION_BUDGET_MIN", "40"))
UA = "Bilaleit/1.0 (+https://bilaleit.web.app)"

# Lýsingar á ensku (CLIP skilur ensku best). Hver flokkur hefur nokkrar orðanir; líkur flokks = summa.
PROMPTS = {
    "ok": ["a photo of a clean used car for sale", "a shiny car parked at a car dealership", "a car in good condition photographed outdoors",
           "a car photographed in a showroom", "a studio photo of a new car on a plain white background", "a manufacturer press photo of a new car",
           "a car photographed indoors in a clean bright hall", "a car at a car auction inspection hall", "a clean car parked in a garage"],
    "tjon": ["a damaged car with dents and crash damage", "a wrecked car after a traffic accident", "a car with a smashed front bumper"],
    "keppni": ["a rally car with racing stickers and numbers", "a race car prepared for motorsport", "a drift car with mismatched body panels"],
    "verkefni": ["a car being repaired in a garage with parts missing", "a car without bumper or with body panels removed", "a car on jack stands in a workshop",
                 "a project car with primer and mismatched paint"],
    "ryd": ["a very rusty old car", "a car with heavy rust holes"],
    "annad": ["a photo of a car interior and dashboard", "a photo of an engine bay", "a photo of a document or text", "a blurry photo", "a photo of a truck or heavy machinery"],
}
# merkja bara þegar flokkurinn er líklegri en þetta og mun líklegri en „ok“
THRESH = {"tjon": 0.6, "keppni": 0.6, "verkefni": 0.85, "ryd": 0.65}


def fetch(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read()
    except Exception:
        return None


def main(limit=None, ids=None):
    import torch
    from PIL import Image
    from transformers import CLIPModel, CLIPProcessor

    cars = json.loads(CARS.read_text("utf-8"))["cars"]
    cache = json.loads(CACHE.read_text("utf-8")) if CACHE.exists() else {}
    todo = [c for c in cars if c.get("img") and "__thumb" not in c["img"] and (cache.get(c["id"], [None])[0] != c["img"])]
    if ids:
        todo = [c for c in cars if c["id"] in ids]
    if limit:
        todo = todo[:limit]
    print(f"Myndgreining: {len(todo)} nýjar myndir")
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").eval()
    proc = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    labels, texts = [], []
    for k, ps in PROMPTS.items():
        for p in ps:
            labels.append(k)
            texts.append(p)
    with torch.no_grad():
        t = proc(text=texts, return_tensors="pt", padding=True)
        tf = model.get_text_features(**t)
        tf = tf / tf.norm(dim=-1, keepdim=True)
    deadline, done = time.time() + BUDGET_MIN * 60, 0
    pool = ThreadPoolExecutor(6)
    for i in range(0, len(todo), 32):
        if time.time() > deadline:
            break
        batch = todo[i:i + 32]
        raw = list(pool.map(lambda c: fetch(c["img"]), batch))
        imgs, keep = [], []
        for c, b in zip(batch, raw):
            try:
                imgs.append(Image.open(io.BytesIO(b)).convert("RGB"))
                keep.append(c)
            except Exception:
                cache[c["id"]] = [c["img"], "villa", 0]
        if not imgs:
            continue
        with torch.no_grad():
            px = proc(images=imgs, return_tensors="pt")
            f = model.get_image_features(**px)
            f = f / f.norm(dim=-1, keepdim=True)
            probs = (100 * f @ tf.T).softmax(dim=-1)
        for c, pr in zip(keep, probs):
            g = {}
            for lab, p in zip(labels, pr.tolist()):
                g[lab] = g.get(lab, 0) + p
            best = max((k for k in THRESH), key=lambda k: g[k])
            flagged = g[best] >= THRESH[best] and g[best] > 4 * g["ok"]
            cache[c["id"]] = [c["img"], best if flagged else "ok", round(g[best], 3)]
            done += 1
    live = {c["id"] for c in cars}
    cache = {k: v for k, v in cache.items() if k in live}
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, separators=(",", ":")), "utf-8")
    flags = {k: [v[1], v[2]] for k, v in cache.items() if v[1] in THRESH}
    OUT.write_text(json.dumps({"updated": datetime.now(timezone.utc).isoformat(timespec="minutes"), "flags": flags}, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"Myndgreining: greindi {done}, {len(flags)} merktir alls")
    return cache


if __name__ == "__main__":
    main(limit=int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else None)
