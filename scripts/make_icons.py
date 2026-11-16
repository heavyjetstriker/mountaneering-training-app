"""Generate the app icons (PNG) from public/favicon.svg. Run once and commit the PNGs.

    python3 scripts/make_icons.py

Uses Playwright's Chromium (already used for screenshots); set CHROME if it isn't
/usr/bin/google-chrome. Writes public/icons/.
"""
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SVG = (ROOT / "public" / "favicon.svg").read_text()
OUT = ROOT / "public" / "icons"
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")

# The favicon: a rounded square (the canvas colour) with a white peak.
canvas = re.search(r'<rect[^>]*fill="([^"]+)"', SVG).group(1)
peak = re.search(r"<path[^>]*/>", SVG).group(0)

# Full-bleed square, no rounded corners: Android and iOS apply their own mask.
full = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="{canvas}"/>{peak}</svg>'
# Maskable: the peak shrunk to sit inside the 80 % safe circle, centred.
maskable = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="{canvas}"/>'
    f'<g transform="translate(32 32) scale(0.72) translate(-32 -34)">{peak}</g></svg>'
)

ICONS = [
    ("icon-192.png", 192, SVG, True),
    ("icon-512.png", 512, SVG, True),
    ("icon-maskable-512.png", 512, maskable, False),
    ("apple-touch-icon-180.png", 180, full, False),
]

OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    for name, size, svg, transparent in ICONS:
        page = browser.new_page(viewport={"width": size, "height": size}, device_scale_factor=1)
        sized = svg.replace("<svg ", f'<svg width="{size}" height="{size}" ', 1)
        page.set_content(f"<html><body style='margin:0;background:transparent'>{sized}</body></html>")
        page.locator("svg").screenshot(path=str(OUT / name), omit_background=transparent)
        page.close()
        print(OUT / name)
    browser.close()
