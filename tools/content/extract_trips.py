"""Turn the live shastaguides.com trip pages into structured data for the new trip-detail pages.

Usage: python3 extract_trips.py <dir with saved live pages> <out.json>
Each page becomes:
  { slug, title, subtitle, route, gallery: [{src, alt}], overview: [blocks], requirements: [...],
    dates_title, dates: [...], cost: [...], includes: [...], cost_notes: [...], gear_href,
    guides_title, guides: [...], itinerary_title, itinerary: [{day, items: [{time, text}]}], notes: [...] }
where overview blocks are {"p": text} or {"ul": [items]}.
Bullet lists come out of Squarespace as consecutive short paragraphs; they are re-grouped here.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from sqs_blocks import blocks  # noqa: E402

LODGING = re.compile(r"^For lodging in the town of Mount Shasta", re.I)
FILLER = re.compile(r"^(BOOK NOW|Contact Us|Gear List|Learn More|Click Here)$", re.I)


def section_key(title):
    t = title.lower()
    if "overview" in t:
        return "overview"
    if "requirement" in t or "experience" in t:
        return "requirements"
    if "date" in t:
        return "dates"
    if t.strip() in ("cost", "price", "pricing") or t.startswith("cost"):
        return "cost"
    if "difference" in t:
        return "guides"
    if "itinerary" in t:
        return "itinerary"
    return "other"


def group_lists(paras):
    """Short paragraphs that follow a line ending in ':' (or each other) become a list."""
    out, i = [], 0
    while i < len(paras):
        p = paras[i]
        if p.endswith(":") and i + 1 < len(paras):
            items = []
            j = i + 1
            while j < len(paras) and len(paras[j]) < 90 and not paras[j].endswith(":") and not re.search(r"[.!?]\s*$", paras[j][:-1] if paras[j].endswith('.') else paras[j]) or (j < len(paras) and len(paras[j]) < 60 and j > i):
                if len(paras[j]) >= 90:
                    break
                items.append(paras[j].rstrip("."))
                j += 1
            out.append({"p": p})
            if items:
                out.append({"ul": items})
            i = j
        else:
            out.append({"p": p})
            i += 1
    return out


def parse_itinerary(paras):
    days, cur = [], None
    for raw in paras:
        for line in [x.strip() for x in raw.split("\n") if x.strip()]:
            m = re.match(r"^(Day\s*\d+)\b\s*(.*)$", line, re.I)
            if m:
                cur = {"day": m.group(1).title(), "items": []}
                days.append(cur)
                line = m.group(2).strip(" /")
                if not line:
                    continue
            if cur is None:
                cur = {"day": "", "items": []}
                days.append(cur)
            if "|" in line:
                time, text = [x.strip() for x in line.split("|", 1)]
                cur["items"].append({"time": time, "text": text})
            elif line.startswith("*"):
                cur.setdefault("note", line.lstrip("* ").strip())
            else:
                cur["items"].append({"time": "", "text": line})
    return days


def extract(path, slug):
    bl = blocks(path)
    d = {"slug": slug, "title": "", "subtitle": "", "route": "", "gallery": [], "overview": [], "requirements": [],
         "dates_title": "", "dates": [], "cost": [], "includes": [], "cost_notes": [], "gear_href": "",
         "guides_title": "", "guides": [], "itinerary_title": "", "itinerary": [], "notes": []}
    sec, buf, seen_h1 = None, {}, False
    pre = []
    for b in bl:
        if b["t"] == "img":
            if seen_h1 or not d["gallery"]:
                d["gallery"].append({"src": b["src"], "alt": b["alt"]})
            continue
        if b["t"] == "a":
            if "gear" in b["text"].lower() and b["href"]:
                d["gear_href"] = b["href"]
            continue
        text = b["text"].strip()
        if b["t"] == "h1" and not seen_h1:
            d["title"], seen_h1 = text, True
            continue
        if not seen_h1:
            continue
        if b["t"] in ("h2", "h3", "h4"):
            sec = section_key(text)
            if sec == "dates":
                d["dates_title"] = text
            if sec == "guides":
                d["guides_title"] = text
            if sec == "itinerary":
                d["itinerary_title"] = text
            if sec == "other":
                buf.setdefault("other", []).append({"h": text})
            continue
        if b["t"] == "button" or FILLER.match(text):
            continue
        if LODGING.match(text):
            d["notes"].append(text)
            continue
        if sec is None:
            pre.append(text)
            continue
        buf.setdefault(sec, []).append(text)

    # Subtitle / route lines sit between the title and the first section.
    for line in pre:
        for part in [x.strip() for x in line.split("\n") if x.strip()]:
            if not d["subtitle"]:
                d["subtitle"] = part
            else:
                d["route"] = (d["route"] + " · " + part).strip(" ·")

    d["overview"] = group_lists(buf.get("overview", []))
    d["requirements"] = [x for x in buf.get("requirements", [])]
    d["dates"] = [x for x in buf.get("dates", [])]
    includes_mode = False
    for line in buf.get("cost", []):
        if re.match(r"^INCLUDE", line, re.I):
            includes_mode = True
            continue
        if line.startswith("*"):
            d["cost_notes"].append(line.lstrip("* ").strip())
        elif includes_mode:
            d["includes"].append(line.rstrip("."))
        else:
            d["cost"].append(line)
    d["guides"] = buf.get("guides", [])
    d["itinerary"] = parse_itinerary(buf.get("itinerary", []))
    d["other"] = buf.get("other", [])
    return d


if __name__ == "__main__":
    src_dir, out = sys.argv[1], sys.argv[2]
    order = [l.strip() for l in open(os.path.join(src_dir, "..", "trip-slugs.txt")) if l.strip()]
    data = [extract(os.path.join(src_dir, f"{s}.html"), s) for s in order]
    json.dump(data, open(out, "w"), indent=1, ensure_ascii=False)
    for t in data:
        print(f"{t['slug']:<40} {t['title'][:38]:<38} gal={len(t['gallery']):<2} ov={len(t['overview']):<2} req={len(t['requirements']):<2} "
              f"dates={len(t['dates']):<2} cost={len(t['cost'])} inc={len(t['includes']):<2} itin={len(t['itinerary'])} gear={'y' if t['gear_href'] else '-'} other={len(t['other'])}")
