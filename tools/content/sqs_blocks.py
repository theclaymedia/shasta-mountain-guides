"""Extract a Squarespace page's readable content as an ordered list of blocks.

Usage: python3 sqs_blocks.py page.html  → prints JSON [{"t": "h1|h2|h3|h4|p|li|img|a", ...}, ...]
Skips scripts, styles, the site header/footer and navigation; keeps headings, paragraphs,
list items, accordion titles, images (with alt) and links/buttons, in document order.
"""
import json
import re
import sys
from html.parser import HTMLParser

SKIP = {"script", "style", "noscript", "svg", "header", "footer", "nav", "template"}
BLOCK = {"h1", "h2", "h3", "h4", "h5", "p", "li", "summary", "button"}


class Blocks(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.skip, self.stack, self.buf, self.link = [], 0, [], [], None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in SKIP:
            self.skip += 1
            return
        if self.skip:
            return
        cls = a.get("class", "")
        if tag == "img":
            src = a.get("data-src") or a.get("src") or ""
            if "squarespace-cdn" in src and "logo" not in src.lower():
                self.out.append({"t": "img", "src": src.split("?")[0], "alt": (a.get("alt") or "").strip()})
            return
        if tag == "a":
            self.link = a.get("href")
        if "accordion-item__title" in cls:
            tag = "h4"
        if tag in BLOCK:
            self.flush()
            self.stack.append(tag)
        if tag == "br":
            self.buf.append("\n")

    def handle_endtag(self, tag):
        if tag in SKIP:
            self.skip = max(0, self.skip - 1)
            return
        if self.skip:
            return
        if tag == "a" and self.link and not self.stack:
            text = " ".join("".join(self.buf).split())
            if text:
                self.out.append({"t": "a", "text": text, "href": self.link})
            self.buf = []
        if tag == "a":
            self.link = None
        if tag in BLOCK and self.stack:
            self.flush()

    def flush(self):
        text = "".join(self.buf)
        text = "\n".join(" ".join(line.split()) for line in text.split("\n")).strip()
        if self.stack and text:
            self.out.append({"t": self.stack[-1] if self.stack[-1] != "summary" else "h4", "text": text})
        if self.stack:
            self.stack.pop()
        self.buf = []

    def handle_data(self, data):
        if not self.skip:
            self.buf.append(data)


def blocks(path):
    html = open(path, encoding="utf-8", errors="ignore").read()
    m = re.search(r'<main\b.*?</main>', html, re.S) or re.search(r'id="page".*', html, re.S)
    p = Blocks()
    p.feed(m.group(0) if m else html)
    p.flush()
    junk = re.compile(r"^(Skip to Content|Open Menu|Close Menu|Back|Folder:.*)$")
    seen, out = set(), []
    for b in p.out:
        key = (b["t"], b.get("text") or b.get("src"))
        if b["t"] != "img" and junk.match(b.get("text", "")):
            continue
        if b["t"] == "img" and key in seen:
            continue
        seen.add(key)
        out.append(b)
    return out


if __name__ == "__main__":
    print(json.dumps(blocks(sys.argv[1]), indent=1, ensure_ascii=False))
