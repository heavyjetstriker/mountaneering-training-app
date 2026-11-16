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
# Seed once per tab, so changes made in a flow survive the next page.goto.
SEED_ONCE = "if (!sessionStorage.getItem('seeded')) { %s sessionStorage.setItem('seeded', '1'); }" % SEED
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

    # ---- milestone 3: plan changes ----
    m3 = new_page(SEED_ONCE)
    m3.goto(BASE + "?date=2026-11-23")
    m3.get_by_role("button", name="Back squat").first.click()
    shot(m3, "m3-edit-exercise", full=False)
    m3.get_by_role("dialog").get_by_label("Sets").fill("3")
    m3.get_by_role("dialog").get_by_label("Target").fill("85")
    m3.get_by_role("dialog").get_by_role("button", name="Save", exact=True).click()
    shot(m3, "m3-after-edit")
    m3.get_by_role("button", name="Weighted pull-ups").first.click()
    m3.get_by_role("button", name="Replace with another exercise").click()
    shot(m3, "m3-replace", full=False)
    m3.get_by_role("dialog").get_by_role("button", name="Lat pulldown").click()

    m3.goto(BASE + "?date=2026-11-28")  # week 2 Saturday
    m3.get_by_role("button", name="Move Saturday to another day").click()
    shot(m3, "m3-move-day", full=False)
    m3.get_by_role("dialog").get_by_role("button", name="Friday").click()
    shot(m3, "m3-move-friday-confirm", full=False)
    m3.get_by_role("button", name="Pick another day").click()
    m3.get_by_role("dialog").get_by_role("button", name="Sunday").click()
    shot(m3, "m3-after-move")

    m3.goto(BASE + "?date=2026-11-23")
    m3.get_by_role("button", name="Week", exact=True).click()
    m3.get_by_role("button", name="Edit week").click()
    shot(m3, "m3-edit-week", full=False)
    m3.get_by_role("dialog").get_by_label("Hike length").fill("3 h")
    m3.get_by_role("dialog").get_by_role("button", name="Save", exact=True).click()
    shot(m3, "m3-week-after")

    m3.get_by_role("button", name="More", exact=True).click()
    shot(m3, "m3-more")
    m3.get_by_role("button", name="Pause 1 week").click()
    shot(m3, "m3-more-paused")
    m3.get_by_role("button", name="Today", exact=True).click()
    shot(m3, "m3-today-paused")
    m3.get_by_role("button", name="More", exact=True).click()
    m3.get_by_role("button", name="Reset all").click()
    shot(m3, "m3-reset-all-dialog", full=False)
    m3.get_by_role("dialog").get_by_role("button", name="Reset", exact=True).click()
    shot(m3, "m3-after-reset")

    # ---- milestone 4: phone-ready ----
    def backup_file(logs, exported="2026-11-16T18:00:00.000Z"):
        data = dict(FIXTURE, logs=logs)
        return json.dumps({"app": "mountain-training-app", "exportedAt": exported, "data": data}).encode()

    def pick(pg, name, buffer):
        pg.set_input_files("input[type=file]", files=[{"name": name, "mimeType": "application/json", "buffer": buffer}])
        pg.wait_for_timeout(200)

    m4 = new_page(SEED_ONCE)
    m4.goto(BASE + "?date=2026-11-23")
    shot(m4, "m4-today-reminder")  # 5 logs, never exported
    m4.evaluate("window.mtaPreviewUpdate()")
    shot(m4, "m4-update-flash", full=False)
    m4.get_by_role("button", name="Export a backup").click()
    m4.wait_for_timeout(300)
    shot(m4, "m4-more-backup", full=False)  # scrolled to the Backup box
    m4.evaluate("window.scrollTo(0, 0)")
    shot(m4, "m4-more")

    with m4.expect_download() as dl:
        m4.get_by_role("button", name="Export data").click()
    d = dl.value
    exported = json.loads(open(d.path()).read())
    assert d.suggested_filename.startswith("mountain-training-") and d.suggested_filename.endswith(".json"), d.suggested_filename
    assert exported["app"] == "mountain-training-app" and len(exported["data"]["logs"]) == 5, "export content"
    assert "drafts" not in json.dumps(exported), "drafts must not be exported"
    shot(m4, "m4-after-export", full=False)

    pick(m4, "notes.json", b"{not json")
    shot(m4, "m4-import-error", full=False)
    pick(m4, "v2.json", json.dumps({"app": "mountain-training-app", "exportedAt": "2026-11-16T18:00:00.000Z",
                                    "data": dict(FIXTURE, version=2)}).encode())
    assert m4.get_by_text("from a newer version").is_visible(), "newer-version message"
    pick(m4, "old.json", backup_file(FIXTURE["logs"][:2]))
    shot(m4, "m4-import-confirm", full=False)
    assert m4.get_by_text("This device has newer logs (19 Nov) than the file (16 Nov).").is_visible(), "import warning"
    m4.get_by_role("dialog").get_by_role("button", name="Replace").click()
    shot(m4, "m4-after-import", full=False)
    keys = m4.evaluate("Object.keys(localStorage)")
    assert len([k for k in keys if k.startswith("mta.data.backup-")]) == 1, keys
    assert m4.evaluate("JSON.parse(localStorage.getItem('mta.data')).logs.length") == 2
    pick(m4, "full.json", backup_file(FIXTURE["logs"]))  # put the 5 logs back
    m4.get_by_role("dialog").get_by_role("button", name="Replace").click()

    m4.get_by_role("button", name="Change").click()
    m4.get_by_role("dialog").get_by_label("Week 1 starts").fill("2027-02-17")  # a Wednesday
    shot(m4, "m4-start-date-not-monday", full=False)
    m4.get_by_role("button", name="Use 15 Feb").click()
    shot(m4, "m4-start-date-dialog", full=False)
    m4.get_by_role("dialog").get_by_role("button", name="Save").click()
    m4.evaluate("window.scrollTo(0, 0)")
    shot(m4, "m4-more-start-changed")
    m4.get_by_role("button", name="Today", exact=True).click()
    shot(m4, "m4-today-before-start")
    m4.goto(BASE + "?date=2027-05-12")
    shot(m4, "m4-plan-complete-new-start")  # complete after the moved plan
    m4.get_by_role("button", name="Set a new start date").click()
    m4.get_by_role("button", name="Change").click()
    m4.get_by_role("button", name="Use the plan's date (Monday 16 Nov)").click()
    m4.goto(BASE + "?date=2026-11-16")
    assert m4.get_by_text("Monday, 16 Nov").first.is_visible(), "start date reset"

    # Manifest: name, start_url, scope, display, and every icon is served.
    man = m4.request.get(BASE + "manifest.webmanifest")
    assert man.ok, "manifest missing"
    mj = man.json()
    assert mj["name"] == "Mountain Training" and mj["short_name"] == "Training", mj
    assert mj["start_url"] == "/mountaneering-training-app/" == mj["scope"] and mj["display"] == "standalone", mj
    for icon in mj["icons"]:
        r = m4.request.get(BASE + icon["src"])
        assert r.ok and r.headers["content-type"] == "image/png", icon
    assert m4.request.get(BASE + "icons/apple-touch-icon-180.png").ok
    print("manifest: ok")

    # Offline: service worker active, airplane mode, reload, Today renders, a log saves.
    off_ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    off_ctx.add_init_script("if (!sessionStorage.getItem('seeded')) { localStorage.clear(); sessionStorage.setItem('seeded', '1'); }")
    off = off_ctx.new_page()
    off_errors = []
    off.on("pageerror", lambda e: off_errors.append(str(e)))
    off.on("console", lambda m: off_errors.append(m.text) if m.type == "error" else None)
    off.goto(BASE + "?date=2026-11-19")
    off.evaluate("navigator.serviceWorker.ready.then(() => true)")
    off.wait_for_timeout(1500)  # let precaching finish
    off_ctx.set_offline(True)
    off.reload()
    off.wait_for_timeout(800)
    assert off.get_by_text("Thursday, 19 Nov").first.is_visible(), "Today did not render offline"
    assert off.evaluate("!!navigator.serviceWorker.controller"), "page not served by the service worker"
    off.get_by_role("button", name="Log session").first.click()
    off.get_by_role("button", name="Save log").click()
    off.wait_for_timeout(300)
    assert off.evaluate("JSON.parse(localStorage.getItem('mta.data')).logs.length") == 1, "offline log not saved"
    off.screenshot(path=f"{OUT}/offline-today.png", full_page=True)
    print(f"{OUT}/offline-today.png")
    print("offline console errors:", off_errors or "none")
    off_ctx.close()

    bad = new_page(CORRUPT)
    bad.goto(BASE + "?date=2026-11-16")
    shot(bad, "log-corrupt-data")
    browser.close()
    print("console errors:", errors or "none")
