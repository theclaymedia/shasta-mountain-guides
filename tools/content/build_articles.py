"""Turn the live shastaguides.com articles (Squarespace blog JSON) into tools/articles.json and prepare their photos.

Usage: python3 build_articles.py <all.json>
  all.json: the "items" of https://shastaguides.com/articles?format=json
Each article becomes { slug, title, date, author, categories, tags, excerpt, hero, blocks } where blocks are
  {"html": "<p>…</p>…"}   text, with only p/h2/h3/ul/ol/li/a/strong/em/br/blockquote kept
  {"gallery": [{src, alt}]}
  {"button": {label, href}}
  {"hr": true}
Wording is kept as published (the client's 45-years decision applied). Photos go to assets/articles/ (max 1600px).
"""
import datetime
import hashlib
import html as H
import json
import os
import re
import subprocess
import sys
import urllib.request
from html.parser import HTMLParser

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
IMG_DIR = os.path.join(ROOT, "assets", "articles")
os.makedirs(IMG_DIR, exist_ok=True)
KEEP = {"p": "p", "h1": "h2", "h2": "h2", "h3": "h3", "h4": "h3", "ul": "ul", "ol": "ol", "li": "li",
        "strong": "strong", "b": "strong", "em": "em", "i": "em", "blockquote": "blockquote"}


def fix(s):
    return re.sub(r"\b(over|more than|nearly)\s+40 years", r"\1 45 years", s)


def photo(url, alt):
    base = re.sub(r"[^a-z0-9]+", "-", os.path.splitext(os.path.basename(url))[0].lower()).strip("-")[:40]
    name = f"{hashlib.md5(url.encode()).hexdigest()[:6]}-{base}.jpg"
    dst = os.path.join(IMG_DIR, name)
    if not os.path.exists(dst):
        raw = dst + ".src"
        req = urllib.request.Request(url + "?format=2500w", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(raw, "wb") as f:
            f.write(r.read())
        subprocess.run(["magick", raw + "[0]", "-auto-orient", "-resize", "1600x1600>", "-strip", "-interlace", "JPEG", "-quality", "78", dst], check=True)
        os.remove(raw)
    return {"src": f"assets/articles/{name}", "alt": alt}


def clean_alt(alt, title):
    alt = re.sub(r"\.(jpe?g|png|heic)$", "", (alt or "").strip(), flags=re.I)
    if not alt or re.fullmatch(r"(IMG|DSC|image|_?storage|\d)[\w\-. ]*", alt, re.I):
        return f"{title}, Mt. Shasta"
    return re.sub(r"(?<=[a-z])(?=[A-Z])", " ", alt.replace("_", " "))


class Text(HTMLParser):
    """Inner HTML of a Squarespace text block → minimal clean HTML."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.skip, self.open_a = [], 0, []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("style", "script", "noscript"):
            self.skip += 1
        if self.skip:
            return
        if tag in KEEP:
            self.out.append(f"<{KEEP[tag]}>")
        elif tag == "a":
            href = a.get("href") or ""
            self.open_a.append(bool(href))
            if href:
                self.out.append(f'<a href="{H.escape(href)}">')
        elif tag == "br":
            self.out.append("<br>")

    def handle_endtag(self, tag):
        if tag in ("style", "script", "noscript"):
            self.skip = max(0, self.skip - 1)
            return
        if self.skip:
            return
        if tag in KEEP:
            self.out.append(f"</{KEEP[tag]}>")
        elif tag == "a" and self.open_a and self.open_a.pop():
            self.out.append("</a>")

    def handle_data(self, data):
        if not self.skip:
            self.out.append(H.escape(data, quote=False))


def text_html(fragment):
    p = Text()
    p.feed(fragment)
    h = "".join(p.out).replace("\xa0", " ")
    h = re.sub(r"\s+", " ", h)
    for _ in range(3):
        h = re.sub(r"<(strong|em)>\s*</\1>", "", h)
        h = re.sub(r"<p>\s*(<br>\s*)*</p>", "", h)
    h = re.sub(r"<p>\s*(<br>\s*)+", "<p>", h)
    h = re.sub(r"(\s*<br>)+\s*</p>", "</p>", h)
    h = re.sub(r"\s*(</?(p|h2|h3|ul|ol|li|blockquote)>)\s*", r"\1", h)
    return fix(h.strip())


def blocks_of(body, title):
    body = re.sub(r"<noscript>.*?</noscript>", "", body, flags=re.S)
    starts = [m for m in re.finditer(r'<div class="sqs-block [^"]*"[^>]*data-block-type="(\d+)"[^>]*>', body)]
    out = []
    for i, m in enumerate(starts):
        seg = body[m.start(): starts[i + 1].start() if i + 1 < len(starts) else len(body)]
        kind = re.search(r'data-sqsp-block="([a-z]+)"', m.group(0))
        kind = kind.group(1) if kind else m.group(1)
        if kind == "gallery":
            imgs, seen = [], set()
            for im in re.finditer(r"<img[^>]*>", seg):
                src = re.search(r'data-src="([^"]+)"', im.group(0)) or re.search(r'src="(https://images\.squarespace-cdn[^"]+)"', im.group(0))
                if not src or src.group(1) in seen:
                    continue
                seen.add(src.group(1))
                alt = re.search(r'alt="([^"]*)"', im.group(0))
                imgs.append(photo(src.group(1).split("?")[0], clean_alt(H.unescape(alt.group(1)) if alt else "", title)))
            if imgs:
                out.append({"gallery": imgs})
        elif kind == "text":
            inner = seg[seg.find("data-sqsp-text-block-content"):] if "data-sqsp-text-block-content" in seg else seg
            inner = inner[inner.find(">") + 1:]
            h = text_html(inner)
            if re.sub(r"<[^>]+>", "", h).strip():
                out.append({"html": h})
        elif kind == "button":
            a = re.search(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', seg, re.S)
            if a:
                out.append({"button": {"label": re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", a.group(2))).strip(), "href": H.unescape(a.group(1))}})
        elif kind == "line":
            out.append({"hr": True})
    return out


items = json.load(open(sys.argv[1]))
articles = []
for it in items:
    title = fix(it["title"].strip())
    author = it["author"].get("displayName", "") if isinstance(it.get("author"), dict) else ""
    excerpt = re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", it.get("excerpt") or ""))).strip()
    blocks = blocks_of(it["body"], title)
    hero = photo(it["assetUrl"].split("?")[0], title) if it.get("assetUrl") else next((b["gallery"][0] for b in blocks if "gallery" in b), None)
    articles.append({
        "slug": it["urlId"], "title": title, "date": datetime.datetime.fromtimestamp(it["publishOn"] / 1000).strftime("%Y-%m-%d"),
        "author": author, "categories": it.get("categories") or [], "tags": it.get("tags") or [], "excerpt": fix(excerpt),
        "hero": hero, "blocks": blocks, "source": f"https://shastaguides.com/articles/{it['urlId']}",
    })
articles.sort(key=lambda a: a["date"], reverse=True)
json.dump(articles, open(os.path.join(ROOT, "tools", "articles.json"), "w"), indent=1, ensure_ascii=False)
for a in articles:
    kinds = [list(b)[0] for b in a["blocks"]]
    words = sum(len(re.sub(r"<[^>]+>", " ", b.get("html", "")).split()) for b in a["blocks"])
    print(f"{a['slug'][:44]:<46}{a['date']} {a['author']:<14} words={words:<5} photos={sum(len(b.get('gallery', [])) for b in a['blocks'])} {kinds}")
