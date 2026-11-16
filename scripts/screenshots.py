"""Phone-size screenshots of key plan days. Used by the check-app skill.

Run with the preview server up:  npx vite preview --port 4173 --strictPort
"""
import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get("APP_URL", "http://localhost:4173/mountaneering-training-app/")
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
OUT = os.environ.get("OUT", "/tmp/app-shots")

# (file name, query string, tab to click)
DAYS = [
    ("w1-mon-today", "?date=2026-11-16", None),
    ("w1-tue-tests", "?date=2026-11-17", None),
    ("w1-fri-rest", "?date=2026-11-20", None),
    ("w4-mon-lighter", "?date=2026-12-07", None),
    ("w5-tue-intervals", "?date=2026-12-15", None),
    ("w12-mon-halved", "?date=2027-02-01", None),
    ("after-plan", "?date=2027-02-10", None),
    ("week-view", "?date=2026-11-16", "Week"),
]

os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "favicon" not in m.text else None)
    for name, query, tab in DAYS:
        page.goto(BASE + query)
        page.wait_for_timeout(400)
        if tab:
            page.get_by_role("button", name=tab, exact=True).click()
            page.wait_for_timeout(200)
        page.screenshot(path=f"{OUT}/{name}.png", full_page=True)
        print(f"{OUT}/{name}.png")
    browser.close()
    print("console errors:", errors or "none")
