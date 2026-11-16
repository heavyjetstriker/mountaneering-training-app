"""Phone-size screenshots of key plan days. Used by the check-app skill.

Run with the preview server up:  npx vite preview --port 4173 --strictPort
"""
import json
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


def sets(ex_id, name, rows, unit="reps"):
    return [
        {"exerciseId": ex_id, "exerciseName": name, "setNumber": i + 1, "reps": r, "unit": unit, "kg": kg}
        for i, (r, kg) in enumerate(rows)
    ]


# Week 1 logged: Monday done (pull-ups swapped for lat pulldown), Tuesday skipped,
# Wednesday Strength B partly done, Thursday done. Saves land in a fresh copy on each page load.
FIXTURE = {
    "version": 1,
    "overrides": [], "tests": [], "trips": [], "gear": [],
    "logs": [
        {
            "id": "f1", "date": "2026-11-16", "week": 1, "type": "strengthA", "status": "done",
            "swaps": {"weighted-pull-ups": "lat-pulldown"},
            "sets": sets("back-squat", "Back squat", [(5, 80), (5, 80), (5, 82.5), (5, 82.5)])
            + sets("sl-rdl", "Single-leg Romanian deadlift (dumbbell)", [(8, 16), (8, 16), (8, 16)])
            + sets("lat-pulldown", "Lat pulldown", [(6, 55), (6, 55), (5, 60), (5, 60)])
            + sets("lateral-step-downs", "Slow lateral step-downs", [(10, None)] * 3)
            + sets("pallof-press", "Pallof press (cable)", [(10, 15)] * 3)
            + sets("calf-raise", "Standing calf raise", [(15, 40)] * 3)
            + sets("tibialis-raise", "Tibialis raise", [(20, None)] * 2),
            "savedAt": "2026-11-16T19:00:00Z",
        },
        {"id": "f2", "date": "2026-11-16", "week": 1, "type": "zone2Incline", "status": "done",
         "minutes": 45, "avgHr": 138, "effortZone": 2, "savedAt": "2026-11-16T19:40:00Z"},
        {"id": "f3", "date": "2026-11-17", "week": 1, "type": "testDriftVertical", "status": "skipped",
         "savedAt": "2026-11-17T19:00:00Z"},
        {"id": "f4", "date": "2026-11-18", "week": 1, "type": "strengthB", "status": "partial",
         "sets": sets("deadlift", "Deadlift (trap bar or conventional)", [(4, 100)] * 4),
         "savedAt": "2026-11-18T19:00:00Z"},
        {"id": "f5", "date": "2026-11-19", "week": 1, "type": "me", "status": "done",
         "packKg": 6.5, "minutes": 30, "effortZone": 2, "savedAt": "2026-11-19T19:00:00Z"},
    ],
}
SEED = "localStorage.setItem('mta.data', %s); localStorage.removeItem('mta.drafts');" % json.dumps(json.dumps(FIXTURE))
CORRUPT = "localStorage.setItem('mta.data', '{broken'); localStorage.removeItem('mta.drafts');"

os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    errors = []

    def new_page(init_script, height=844):
        ctx = browser.new_context(viewport={"width": 390, "height": height}, device_scale_factor=2)
        ctx.add_init_script(init_script)
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and "favicon" not in m.text else None)
        return pg

    def shot(pg, name, full=True):
        pg.wait_for_timeout(250)
        pg.screenshot(path=f"{OUT}/{name}.png", full_page=full)
        print(f"{OUT}/{name}.png")

    page = new_page(SEED)
    for name, query, tab in DAYS:
        page.goto(BASE + query)
        page.wait_for_timeout(400)
        if tab:
            page.get_by_role("button", name=tab, exact=True).click()
            page.wait_for_timeout(200)
        page.screenshot(path=f"{OUT}/{name}.png", full_page=True)
        print(f"{OUT}/{name}.png")

    # ---- milestone 2: logging ----
    page.goto(BASE + "?date=2026-11-16")
    shot(page, "log-today-logged")

    page.goto(BASE + "?date=2026-11-23")  # week 2 Monday: prefill from week 1
    page.get_by_role("button", name="Log session").first.click()
    shot(page, "log-strength-prefill")
    page.get_by_role("button", name="Swap").click()
    shot(page, "log-swap-list", full=False)
    page.get_by_role("button", name="Lat pulldown").click()
    shot(page, "log-strength-swapped")
    page.get_by_role("button", name="Cancel").click()
    shot(page, "log-discard-dialog", full=False)
    page.get_by_role("button", name="Keep editing").click()
    page.get_by_role("button", name="Save log").click()
    shot(page, "log-after-save")
    page.get_by_role("button", name="Week", exact=True).click()
    shot(page, "log-week-2-after-save")

    page.goto(BASE + "?date=2026-11-21")  # Saturday hike
    page.get_by_role("button", name="Log session").first.click()
    shot(page, "log-cardio-hike")
    page.goto(BASE + "?date=2026-12-15")  # week 5 Tuesday: intervals placeholder
    page.get_by_role("button", name="Log session").first.click()
    shot(page, "log-cardio-tuesday")
    page.goto(BASE + "?date=2026-11-17")  # test session, skipped
    shot(page, "log-test-skipped")

    page.goto(BASE + "?date=2026-11-22")
    page.get_by_role("button", name="Week", exact=True).click()
    shot(page, "log-week-icons")

    # Keyboard open: about 330 px of an 844 px phone is keyboard. Save must stay reachable.
    kb = new_page(SEED, height=514)
    kb.goto(BASE + "?date=2026-11-23")
    kb.get_by_role("button", name="Log session").first.click()
    kb.get_by_label("Back squat, set 2, kg").focus()
    shot(kb, "log-keyboard", full=False)

    bad = new_page(CORRUPT)
    bad.goto(BASE + "?date=2026-11-16")
    shot(bad, "log-corrupt-data")
    browser.close()
    print("console errors:", errors or "none")
