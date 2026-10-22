"""Clean the extracted live trip pages into tools/trip-details.json and prepare their assets.

Usage: python3 build_trip_details.py <raw.json> <gallery-src-dir> <gallery-urls.txt>
- Links each trip page to its program card in tools/trips-data.js (name, program page, Flybook ID)
- Optimises gallery photos into assets/trips/ (max 1600px) and gear PDFs into assets/downloads/
- Applies the client's decisions (45 years; Expedition Style stays $1,595 with no 2027 price line)
- Folds duplicate live URLs into one page (the duplicate becomes a redirect)
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
raw_file, gallery_dir, urls_file = sys.argv[1:4]
raw = {t["slug"]: t for t in json.load(open(raw_file))}

# Program cards: name, program page, Flybook ID, card image (via node, so trips-data.js stays the one source)
programs = json.loads(subprocess.check_output(["node", "-e", """
const t=require('./tools/trips-data.js').filter(x=>x.slug); const out=[];
for (const p of t) for (const pr of (p.programs||[])) out.push({program:p.slug, programTitle:p.title, formOption:p.formOption, name:pr.name, fb:pr.fb, img:pr.img, alt:pr.alt, length:pr.length||'', route:pr.route||'', cost:pr.cost||'', slug:(pr.learn||'').split('/').pop()});
console.log(JSON.stringify(out));"""], cwd=ROOT))

# Duplicate live URLs → the page that is kept (the duplicate 301s to it)
CANONICAL = {"glacierseminar": "glacier1", "womensglacierseminar": "womensglacier"}
REDIRECTS = {"glacierseminar": "glacier1", "womensglacierseminar": "womensglacier", "advanced-ski": "skishasta", "oatsmgbackpacking": "backpack"}

# Gallery photos: original URL → optimised local file
url_list = [u.strip() for u in open(urls_file) if u.strip()]
local_for = {}
os.makedirs(os.path.join(ROOT, "assets", "trips"), exist_ok=True)
for u in url_list:
    h = hashlib.md5((u + "\n").encode()).hexdigest()[:10]  # matches `echo "$u" | md5` used when downloading
    base = os.path.basename(u).replace("+", "-").replace("%20", "-")
    src = os.path.join(gallery_dir, f"{h}-{base}")
    name = re.sub(r"[^a-z0-9.-]+", "-", f"{h[:6]}-{base}".lower())
    name = re.sub(r"\.(jpeg|png)$", ".jpg", name)
    if not name.endswith(".jpg"):
        name += ".jpg"
    dst = os.path.join(ROOT, "assets", "trips", name)
    if os.path.exists(src) and not os.path.exists(dst):
        subprocess.run(["magick", src, "-auto-orient", "-resize", "1600x1600>", "-strip", "-interlace", "JPEG", "-quality", "78", dst], check=True)
    if os.path.exists(dst):
        local_for[u] = f"assets/trips/{name}"

# Gear PDFs: live /s/ path → local download
GEAR = {
    "/s/Summit-Climb-Gear-List.pdf": "assets/downloads/smg-summit-climb-gear-list.pdf",
    "/s/Ski-Snowboard-Mountaineering-Gear-List.pdf": "assets/downloads/smg-ski-snowboard-mountaineering-gear-list.pdf",
    "/s/Backcountry-Ski-Tour-Avalanche-Course-Gear-List.pdf": "assets/downloads/smg-backcountry-ski-avalanche-gear-list.pdf",
    "/s/Mountaineering-Class-Day-Hike-Gear-List.pdf": "assets/downloads/smg-mountaineering-class-day-hike-gear-list.pdf",
    "/s/PCT-Backpacking-Gear-List.pdf": "assets/downloads/smg-pct-backpacking-gear-list.pdf",
    "/s/PCT-Backpacking-Gear-List-ezff.pdf": "assets/downloads/smg-pct-backpacking-gear-list.pdf",
    "/s/Advanced-Climbing-Seminars-Gear-List.pdf": "assets/downloads/smg-advanced-climbing-seminars-gear-list.pdf",
    "/s/Rock-Climbing-Gear-List.pdf": "assets/downloads/smg-rock-climbing-gear-list.pdf",
    "/s/Single-Push-Ski-Descent-Gear-List.pdf": "assets/downloads/smg-single-push-ski-descent-gear-list.pdf",
}
GEAR_LABEL = {
    "smg-summit-climb-gear-list.pdf": "Summit Climb Gear List", "smg-ski-snowboard-mountaineering-gear-list.pdf": "Ski & Snowboard Mountaineering Gear List",
    "smg-backcountry-ski-avalanche-gear-list.pdf": "Backcountry Ski Tour & Avalanche Course Gear List", "smg-mountaineering-class-day-hike-gear-list.pdf": "Mountaineering Class & Day Hike Gear List",
    "smg-pct-backpacking-gear-list.pdf": "PCT Backpacking Gear List", "smg-advanced-climbing-seminars-gear-list.pdf": "Advanced Climbing Seminars Gear List",
    "smg-rock-climbing-gear-list.pdf": "Rock Climbing Gear List", "smg-single-push-ski-descent-gear-list.pdf": "Single-Push Ski Descent Gear List",
}
for live, local in GEAR.items():
    path = os.path.join(ROOT, local)
    if not os.path.exists(path):
        req = urllib.request.Request("https://shastaguides.com" + live, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())

def fix(text):
    text = re.sub(r"\b(over|more than|nearly)\s+40 years", r"\1 45 years", text)
    return text.replace("Avalanche Glutch", "Avalanche Gulch")

out, seen = [], set()
for pr in programs:
    slug = CANONICAL.get(pr["slug"], pr["slug"])
    if not slug or slug not in raw or slug in seen:
        continue
    seen.add(slug)
    r = raw[slug]
    gallery = [{"src": local_for[g["src"]], "alt": g["alt"] or f"{pr['name']} on Mt. Shasta"} for g in r["gallery"] if g["src"] in local_for]
    hero = gallery[0] if gallery else {"src": pr["img"], "alt": pr["alt"]}
    shots = gallery[1:9] if len(gallery) > 1 else gallery[:8]
    cost = [fix(c) for c in r["cost"]]
    if slug == "expedition-style":  # client: keep $1,595, drop the 2027 price line
        cost = [c for c in cost if "2027" not in c]
    gear = GEAR.get(r["gear_href"], "")
    d = {
        "slug": slug, "name": pr["name"], "program": pr["program"], "programTitle": pr["programTitle"], "formOption": pr["formOption"],
        "fb": pr["fb"], "length": pr["length"], "route": pr["route"], "card_cost": pr["cost"],
        "eyebrow": fix(r["subtitle"]).replace(" - ", " · "), "route_line": fix(r["route"]),
        "hero": hero, "gallery": shots,
        "overview": [{k: (fix(v) if isinstance(v, str) else [fix(x) for x in v])} for b in r["overview"] for k, v in b.items()],
        "requirements": [fix(x) for x in r["requirements"]],
        "dates_title": r["dates_title"] or "Dates", "dates": [fix(x) for x in r["dates"]],
        "cost": cost, "includes": [fix(x) for x in r["includes"]], "cost_notes": [fix(x) for x in r["cost_notes"]],
        "gear": {"href": gear, "label": GEAR_LABEL.get(os.path.basename(gear), "Gear List")} if gear else None,
        "guides_title": r["guides_title"] or "The difference is in our guides", "guides": [fix(x) for x in r["guides"]],
        "itinerary_title": fix(r["itinerary_title"]), "itinerary": r["itinerary"],
        "notes": [fix(x) for x in r["notes"]],
        "source": f"https://shastaguides.com/{slug}",
    }
    for day in d["itinerary"]:
        for it in day["items"]:
            it["text"] = fix(it["text"])
    out.append(d)

data = {"redirects": REDIRECTS, "trips": out}
json.dump(data, open(os.path.join(ROOT, "tools", "trip-details.json"), "w"), indent=1, ensure_ascii=False)
print(f"{len(out)} trip pages, {sum(len(t['gallery']) for t in out)} gallery photos, redirects: {REDIRECTS}")
missing = [t["slug"] for t in out if not t["gear"]]
print("no gear list:", missing)
