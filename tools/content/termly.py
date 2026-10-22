"""Convert a Termly-generated legal document (embedded in a Squarespace code block) into clean blocks.

Usage: python3 termly.py page.html  → prints JSON [{"t": "h2|h3|p|li|updated", "html": ..., "id": ...}, ...]
Termly marks its structure with data-custom-class (title, subtitle, heading_1, heading_2, body_text) on
deeply nested div/span soup. Wording, links and bold are kept exactly; all inline styling is dropped.
Anchor ids (used by the document's own table of contents) move onto the heading that follows them.
"""
import html as H
import json
import re
import sys
from html.parser import HTMLParser

KIND = {"title": "title", "subtitle": "updated", "heading_1": "h2", "heading_2": "h3", "body_text": "p"}
VOID = {"br", "img", "hr", "input", "meta", "link"}


class Termly(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0          # >0 once inside the data-custom-class="body" wrapper
        self.stack = []         # (tag, kind-or-None) for open elements inside the wrapper
        self.blocks, self.cur, self.pending_id = [], None, None
        self.skip = 0

    def start_block(self, kind):
        self.end_block()
        self.cur = {"t": kind, "html": []}
        if self.pending_id and kind in ("h2", "h3"):
            self.cur["id"], self.pending_id = self.pending_id, None

    def end_block(self):
        if self.cur:
            html = " ".join("".join(self.cur["html"]).split())
            for _ in range(3):
                html = re.sub(r"<(strong|em)>\s*</\1>", "", html)
                html = re.sub(r"<(strong|em)><\1>(.*?)</\1></\1>", r"<\1>\2</\1>", html)
            html = html.strip()
            if re.sub(r"<[^>]+>", "", html).strip():
                self.cur["html"] = html
                self.blocks.append(self.cur)
        self.cur = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if not self.depth:
            if a.get("data-custom-class") == "body":
                self.depth = 1
            return
        if tag in ("style", "script"):
            self.skip += 1
        if tag in VOID:
            if tag == "br" and self.cur:
                self.cur["html"].append(" ")
            return
        kind = KIND.get(a.get("data-custom-class", ""))
        if tag == "li":
            kind = "li"
        if a.get("id") and not kind:
            self.pending_id = a["id"]
        opened = None
        if tag == "a" and a.get("href") and not self.cur:
            # Table-of-contents links wrap their whole line
            self.start_block("p")
            opened = "p"
        if kind and (not self.cur or self.cur["t"] != kind or tag in ("div", "li")):
            # A new structural element starts a block, unless it's an inline span repeating the current kind.
            if tag in ("div", "li", "p", "h1", "h2", "h3") or not self.cur:
                self.start_block(kind)
                opened = kind
                if a.get("id") and kind in ("h2", "h3"):
                    self.cur["id"] = a["id"]
        if self.cur and tag == "a" and a.get("href"):
            self.cur["html"].append(f'<a href="{H.escape(a["href"])}">')
        if self.cur and tag in ("strong", "b"):
            self.cur["html"].append("<strong>")
        if self.cur and tag in ("em", "i"):
            self.cur["html"].append("<em>")
        self.stack.append((tag, opened))
        self.depth += 1

    def handle_endtag(self, tag):
        if not self.depth or tag in VOID:
            return
        if tag in ("style", "script"):
            self.skip = max(0, self.skip - 1)
        if not self.stack:
            self.depth = 0
            self.end_block()
            return
        # Pop to the matching open tag; stray closing tags (Termly's markup is not always balanced) are ignored.
        if tag not in (t for t, _ in self.stack):
            return
        while self.stack:
            t, opened = self.stack.pop()
            self.depth -= 1
            if self.cur and t == "a":
                self.cur["html"].append("</a>")
            if self.cur and t in ("strong", "b"):
                self.cur["html"].append("</strong>")
            if self.cur and t in ("em", "i"):
                self.cur["html"].append("</em>")
            if opened:
                self.end_block()
            if t == tag:
                break

    def handle_data(self, data):
        if self.depth and not self.skip and self.cur is not None:
            self.cur["html"].append(H.escape(data, quote=False))
        elif self.depth and not self.skip and data.strip():
            self.start_block("p")
            self.cur["html"].append(H.escape(data, quote=False))


def convert(path):
    p = Termly()
    p.feed(open(path, encoding="utf-8", errors="ignore").read())
    p.end_block()
    return p.blocks


if __name__ == "__main__":
    print(json.dumps(convert(sys.argv[1]), indent=1, ensure_ascii=False))
