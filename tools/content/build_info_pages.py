"""Turn the live shastaguides.com info pages into tools/info-pages.json and prepare their photos.

Usage: python3 build_info_pages.py <dir with saved live pages>
Pages: about, aboutshasta, routesandseasons, tripdetails, gear, training, faq, policies,
       privacypolicy, terms-of-service, contact (saved as <slug>.html).
- Wording is kept as published (links and bold included), with the client's decisions applied
  (45 years) and a few obvious typos fixed (listed in TYPOS).
- The About team follows the agreed roster on the homepage (index.html), with each guide's full bio
  from the live About page.
- Photos are downloaded and optimised into assets/info/ (heroes 2000px, gallery 1600px).
"""
import hashlib
import html as H
import json
import os
import re
import subprocess
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from sqs_blocks import blocks  # noqa: E402
from termly import convert as termly  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = sys.argv[1]
IMG_DIR = os.path.join(ROOT, "assets", "info")
os.makedirs(IMG_DIR, exist_ok=True)

TYPOS = {
    "Instructo,r": "Instructor,", "UC Berkley": "UC Berkeley", "under blue skis": "under blue skies",
    "Mount shasta": "Mount Shasta", "to compliment her": "to complement her",
}


def fix(s):
    s = re.sub(r"\b(over|more than|nearly)\s+40 years", r"\1 45 years", s)
    for a, b in TYPOS.items():
        s = s.replace(a, b)
    return s


def photo(url, width, alt=""):
    """Download a Squarespace image once and save an optimised JPG; returns {src, alt}."""
    base = re.sub(r"[^a-z0-9]+", "-", os.path.splitext(os.path.basename(url))[0].lower()).strip("-")[:48]
    name = f"{hashlib.md5(url.encode()).hexdigest()[:6]}-{base}.jpg"
    dst = os.path.join(IMG_DIR, name)
    if not os.path.exists(dst):
        raw = dst + ".src"
        req = urllib.request.Request(url + "?format=2500w", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(raw, "wb") as f:
            f.write(r.read())
        subprocess.run(["magick", raw, "-auto-orient", "-resize", f"{width}x{width}>", "-strip", "-interlace", "JPEG", "-quality", "78", dst], check=True)
        os.remove(raw)
    return {"src": f"assets/info/{name}", "alt": alt}


def load(slug):
    return blocks(os.path.join(SRC, f"{slug}.html"))


def html_of(b):
    return fix(b.get("html") or H.escape(b["text"], quote=False))


def sections(bl, head="h4"):
    """Group blocks under each heading: [{h, id, blocks: [html, ...]}]; text before the first heading is the intro."""
    intro, out = [], []
    for b in bl:
        if b["t"] == head:
            out.append({"h": fix(b["text"]), "id": re.sub(r"[^a-z0-9]+", "-", b["text"].lower()).strip("-"), "blocks": []})
        elif b["t"] in ("p", "li"):
            (out[-1]["blocks"] if out else intro).append(html_of(b))
    return intro, out


def first_img(bl):
    return next(b for b in bl if b["t"] == "img")


pages = {}

# ---- About: intro + team (homepage roster, live bios) ----
bl = load("about")
hero = first_img(bl)
intro = [html_of(b) for b in bl[: [i for i, b in enumerate(bl) if b["t"] == "p" and b["text"] == "Our Team"][0]] if b["t"] == "p"]
live = {}
cur = None
for b in bl:
    if b["t"] == "h2":
        cur = live.setdefault(b["text"].strip(), [])
    elif b["t"] == "p" and cur is not None:
        cur.append(b)
    elif b["t"] == "img":
        cur = None
index = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
grid = index[index.index('class="guide-grid"'): index.index("</section>", index.index('class="guide-grid"'))]
team = []
for art in re.findall(r"<article class=\"guide[^\"]*\">(.*?)</article>", grid, re.S):
    name = H.unescape(re.search(r"<h3>(.*?)</h3>", art).group(1))
    role_line = H.unescape(re.search(r'class="role">(.*?)</span>', art).group(1))
    short = re.sub(r"<[^>]+>", "", re.search(r"<p>(.*?)</p>", art, re.S).group(1)).strip()
    img = re.search(r'<img src="([^"]+)"', art)
    ps = live.get(name, [])
    role, certs, bio = role_line.split(" · ")[0].replace("·", "").strip(), "", []
    rest = list(ps)
    if rest and (len(rest[0]["text"].split("\n")[0]) < 50 and rest[0]["text"].split("\n")[0].upper() == rest[0]["text"].split("\n")[0] or len(rest[0]["text"]) < 40):
        lines = rest.pop(0)["text"].split("\n")
        role = lines[0].strip().title().replace(" - ", " · ")
        certs = " ".join(lines[1:]).strip()
    if not certs and rest and (rest[0]["text"].count(",") + rest[0]["text"].count(";") >= 2) and len(rest[0]["text"]) < 330 and not re.match(r"^(Originally|Born|Born and|A |After|Growing|Wanting)", rest[0]["text"]):
        certs = rest.pop(0)["text"]
    bio = [html_of(b) for b in rest] or [H.escape(short.replace(" Lives in Mt. Shasta", ""))]
    team.append({
        "name": name, "role": fix(role), "certs": fix(certs) or (role_line.split(" · ", 1)[1] if " · " in role_line else ""),
        "photo": img.group(1) if img else None, "bio": bio, "local": "Lives in Mt. Shasta" in short,
    })
pages["about"] = {
    "title": "About Us", "h1": "About Us", "eyebrow": "The original guide service on Mt. Shasta",
    "lede": "Founded in the late 1970s, run by longtime guides Chris and Jenn Carr since 2003, and on the mountain every day of the season.",
    "hero": photo(hero["src"], 2000, "Shasta Mountain Guides climbers on Mt. Shasta"), "intro": intro, "team": team,
    "closing": "Climbing Mount Shasta without a guide is not recommended.",
}

# ---- About Mt. Shasta: copy + photo gallery ----
bl = load("aboutshasta")
imgs = [b for b in bl if b["t"] == "img"]
pages["aboutshasta"] = {
    "title": "About Mt. Shasta", "h1": "About Mt. Shasta", "eyebrow": "Mt. Shasta, California · 14,179 ft",
    "lede": "The second highest volcano in the United States and one of the great mountaineering objectives of North America.",
    "hero": photo(imgs[0]["src"], 2000, "Avalanche Gulch on Mt. Shasta"),
    "intro": [html_of(b) for b in bl if b["t"] == "p" and b["text"] != "14,179 ft"],
    "gallery": [photo(b["src"], 1600, fix(b["alt"]) or "Mt. Shasta") for b in imgs[1:]],
}

# ---- Routes & Seasons ----
bl = load("routesandseasons")
imgs = [b for b in bl if b["t"] == "img"]
pages["routesandseasons"] = {
    "title": "Routes & Seasons", "h1": "Routes and Seasons", "eyebrow": "Getting to the summit",
    "lede": "Where we climb, and when. The route follows the snow: the south side in spring, the north and east sides through summer.",
    "hero": photo(imgs[0]["src"], 2000, "Climbers on the Bolam Glacier, Mt. Shasta"),
    "map": photo(imgs[1]["src"], 2000, "Map of the climbing routes on Mt. Shasta"),
    "seasons": [html_of(b) for b in bl if b["t"] == "p"],
}

# ---- Long-form pages: sections under h4 headings ----
for slug, title, h1, eyebrow, lede in [
    ("tripdetails", "Trip Details", "Preparing to Climb Mount Shasta", "Trip details",
     "Meeting times, travel, lodging, food, tipping and weather: everything to know before your trip."),
    ("gear", "Gear", "What Gear Do You Need to Mountaineer?", "Gear",
     "What to bring, what to rent, and what we supply. Gear lists for each trip are on its trip page and below."),
    ("policies", "Policies", "Policies", "Booking", "Cancellations, changes, transfers and weather."),
]:
    bl = load(slug)
    intro, secs = sections(bl)
    pages[slug] = {"title": title, "h1": h1, "eyebrow": eyebrow, "lede": lede, "intro": intro, "sections": secs}
    img = [b for b in bl if b["t"] == "img"]
    if img and slug != "policies":
        pages[slug]["hero"] = photo(img[0]["src"], 2000, "Mt. Shasta")

# ---- Training ----
bl = load("training")
paras = [b for b in bl if b["t"] == "p"]
quote = next(b for b in paras if b["text"].startswith("“"))
qtext, qby = quote["text"].rsplit("\n", 1)
pages["training"] = {
    "title": "Training", "h1": "How to Train to Climb Mount Shasta", "eyebrow": "Training",
    "lede": "A summit climb or ski of Mount Shasta is a serious physical challenge. Here is how to prepare for it.",
    "hero": photo(first_img(bl)["src"], 2000, "Climbers training on Mt. Shasta"),
    "intro": [html_of(b) for b in paras if b is not quote and b["text"] != "Why Train Before Your Climb?"],
    "quote": {"text": fix(qtext.strip("“” ")), "by": qby.strip("- ").replace("/ ", ", ")},
    "links": [
        {"label": "Training for Mt. Shasta (PDF)", "href": "assets/downloads/smg-training-for-mount-shasta.pdf", "note": "Our 24-page fitness guide"},
        {"label": "Casaval Training Plan (PDF)", "href": "assets/downloads/smg-casaval-training-plan.pdf", "note": "From Dane Brinkley at CasavalPT"},
        {"label": "Outdoor Adventure Training", "href": "https://outdooradventuretraining.com/mountaineering/", "note": "Mountaineering training programs"},
    ],
}

# ---- FAQ ----
bl = load("faq")
intro, qa = sections(bl)
pages["faq"] = {
    "title": "FAQ", "h1": "Frequently Asked Questions", "eyebrow": "FAQ",
    "lede": fix(intro[0]) if intro else "", "hero": photo(first_img(bl)["src"], 2000, "Climbers on Mt. Shasta"),
    "qa": [{"q": s["h"], "id": s["id"], "a": s["blocks"]} for s in qa],
}

# ---- Legal pages (verbatim) ----
bl = load("privacypolicy")
pages["privacypolicy"] = {
    "title": "Privacy Policy", "h1": "Privacy Policy", "eyebrow": "Legal", "lede": "",
    "updated": next(b["text"] for b in bl if b["text"].startswith("Last Modified")),
    "blocks": [{"t": "p", "html": html_of(b)} for b in bl if b["t"] == "p" and not b["text"].startswith("Last Modified")],
}
tb = termly(os.path.join(SRC, "terms-of-service.html"))
pages["terms-of-service"] = {
    "title": "Terms of Use", "h1": "Terms of Use", "eyebrow": "Legal", "lede": "",
    "updated": re.sub(r"<[^>]+>", "", next(b["html"] for b in tb if b["t"] == "updated")),
    "blocks": [b for b in tb if b["t"] not in ("title", "updated")],
}

# ---- Contact ----
pages["contact"] = {
    "title": "Contact", "h1": "Contact Us", "eyebrow": "Mt. Shasta, California",
    "lede": "Questions about a trip, dates or gear? Send us a note and a guide will reply within one business day.",
    "hero": photo(first_img(load("tripdetails"))["src"], 2000, "Mt. Shasta"),
    "address": ["305 Chestnut Street", "Mt. Shasta, California 96067"], "phone": "530.926.3117", "email": "info@shastaguides.com",
}

for slug, p in pages.items():
    p["slug"] = slug
    p["source"] = f"https://shastaguides.com/{slug}"
json.dump(pages, open(os.path.join(ROOT, "tools", "info-pages.json"), "w"), indent=1, ensure_ascii=False)
print({k: len(json.dumps(v)) for k, v in pages.items()})
print("team:", [(t["name"], t["role"], bool(t["certs"]), len(t["bio"])) for t in pages["about"]["team"]])
