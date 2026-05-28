#!/usr/bin/env python3
"""Apply the Orby 2026 page-chrome to every legacy static HTML page.

For each HTML file under site/ (skipping site/index.html and the two
backup files, which already host the prototype directly):
  1. Insert the Sora preconnect + Google Fonts link into <head>
     (Inter is already loaded by legacy style.css consumers)
  2. Insert <link rel="stylesheet" href="<prefix>assets/orby-2026/page-chrome.css">
     into <head> after the existing style.css link
  3. Insert <script src="<prefix>assets/orby-2026/page-chrome.js" defer></script>
     just before </body>
  4. Set <html lang="..." data-theme="dark"> if data-theme is missing

<prefix> = "" for root-level pages, "../" for /es/ pages.

Idempotent: re-running won't duplicate the additions.
Safe to run multiple times.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site"

# Pages that already host the prototype directly — skip them.
SKIP = {
    SITE / "index.html",
    SITE / "index.legacy.html",
    SITE / "index.shell-backup.html",
    SITE / "es" / "index.html",  # ES homepage now uses prototype shell directly
}

CSS_VERSION = "2026052507"

SORA_LINK = (
    '  <link rel="preconnect" href="https://fonts.googleapis.com" />\n'
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
    '  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet" />\n'
)

CSS_TAG_TEMPLATE = '  <link rel="stylesheet" href="{prefix}assets/orby-2026/page-chrome.css?v={ver}" />\n'
JS_TAG_TEMPLATE  = '<script src="{prefix}assets/orby-2026/page-chrome.js?v={ver}" defer></script>\n'

# Anchors used to detect prior runs.
CSS_TAG_MARKER = "assets/orby-2026/page-chrome.css"
JS_TAG_MARKER  = "assets/orby-2026/page-chrome.js"
SORA_MARKER    = "family=Sora"


def prefix_for(path: Path) -> str:
    """Return relative-asset prefix based on file location under site/."""
    parts = path.relative_to(SITE).parts
    # site/index.html → ""; site/es/index.html → "../"
    depth = len(parts) - 1  # subdirectories
    return "../" * depth


def process_file(path: Path) -> tuple[bool, list[str]]:
    """Edit path in place. Returns (changed, notes)."""
    notes: list[str] = []
    html = path.read_text(encoding="utf-8")
    original = html
    pref = prefix_for(path)

    # 1. Set data-theme="dark" on <html ...> if absent.
    if re.search(r"<html\b[^>]*\bdata-theme\b", html) is None:
        html, n = re.subn(r"(<html\b)([^>]*)>", r'\1\2 data-theme="dark">', html, count=1)
        if n:
            notes.append("set data-theme=dark")
        else:
            notes.append("WARN: no <html> tag found")

    # 2. Inject Sora preconnect+stylesheet inside <head>.
    if SORA_MARKER not in html:
        # Insert just after the first <link> or just before </head> if no link exists.
        m = re.search(r"<link[^>]+rel=\"stylesheet\"[^>]*>", html)
        if m:
            insert_at = m.end()
            html = html[:insert_at] + "\n" + SORA_LINK.rstrip() + html[insert_at:]
            notes.append("added Sora font link")
        else:
            html = re.sub(r"(</head>)", SORA_LINK + r"\1", html, count=1)
            notes.append("added Sora font link (pre-/head)")

    # 3. Inject page-chrome.css <link> if missing.
    if CSS_TAG_MARKER not in html:
        css_tag = CSS_TAG_TEMPLATE.format(prefix=pref, ver=CSS_VERSION)
        # Insert after the existing style.css link if found, else just before </head>
        m = re.search(r"<link[^>]+style\.css[^>]*>", html)
        if m:
            insert_at = m.end()
            html = html[:insert_at] + "\n" + css_tag.rstrip() + html[insert_at:]
            notes.append("added page-chrome.css link")
        else:
            html = re.sub(r"(</head>)", css_tag + r"\1", html, count=1)
            notes.append("added page-chrome.css link (pre-/head)")

    # 4. Inject page-chrome.js <script> just before </body>.
    if JS_TAG_MARKER not in html:
        js_tag = JS_TAG_TEMPLATE.format(prefix=pref, ver=CSS_VERSION)
        if "</body>" in html:
            html = html.replace("</body>", js_tag + "</body>", 1)
            notes.append("added page-chrome.js script")
        else:
            html += "\n" + js_tag
            notes.append("appended page-chrome.js (no </body>)")

    if html != original:
        path.write_text(html, encoding="utf-8")
        return True, notes
    return False, ["unchanged (already current)"]


def main() -> int:
    targets = []
    for f in sorted(SITE.glob("*.html")):
        if f in SKIP:
            continue
        targets.append(f)
    for f in sorted((SITE / "es").glob("*.html")):
        if f in SKIP:
            continue
        targets.append(f)

    print(f"Applying chrome to {len(targets)} files...")
    changed = 0
    for f in targets:
        was_changed, notes = process_file(f)
        rel = str(f.relative_to(SITE))
        prefix = "✓" if was_changed else "·"
        print(f"  {prefix} {rel:36}  {'; '.join(notes)}")
        if was_changed:
            changed += 1
    print(f"\nDone. {changed}/{len(targets)} files modified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
