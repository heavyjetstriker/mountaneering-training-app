---
name: check-app
description: Verify the mountain training app before calling a change or milestone done - runs tests, type-check, build and phone-size screenshots of key plan days.
---

# Check the app

Run these from the repo root, in order. Stop and fix anything that fails.

1. `npm test` – all Vitest tests must pass.
2. `npm run build` – type-check and production build must succeed.
3. Screenshots at phone size (390 × 844):
   - Start the preview server in the background: `npx vite preview --port 4173 --strictPort`
   - Run `python3 scripts/screenshots.py` (needs Python Playwright and a Chrome/Chromium binary;
     set `CHROME` to its path if it is not /usr/bin/google-chrome).
   - Screenshots land in /tmp/app-shots. Open each with the Read tool and look for: clipped or
     overlapping text, wrong week/day, wrong sets after the block rules, missing banners,
     tap targets that look too small, console errors printed by the script.
4. If a screen changed, check the matching days with `?date=YYYY-MM-DD` (the script's DAYS list
   covers week 1 Monday, a rest Friday, the lighter week, block 2 intervals and week 12). Add a day
   to the list when a new feature needs one.
5. Logging (milestone 2): the script seeds localStorage with a week-1 fixture before each load, then
   shoots the `log-*` files: Today with logs, strength prefill and "Last time", the swap list, the
   discard dialog, the success Flash after saving, cardio/hike/Tuesday log screens, Week view status
   icons, a 390 × 514 shot with the keyboard open (Save log must be visible), and the danger Flash
   for unreadable stored data.

Report what you checked and anything that still looks off.
6. Plan changes (milestone 3): the `m3-*` shots run one flow in a single tab (seeded once): edit
   back squat, replace pull-ups, move Saturday (with the Friday confirm), edit week 2, the changes
   list in More, pause a week, Today while paused, then Reset all. Check the changes list reads in
   plain words and that everything is back to the original plan after the reset.
7. Phone-ready (milestone 4): the `m4-*` shots run one flow (seeded once): Today with the backup
   reminder, the update Flash (via `window.mtaPreviewUpdate()`), More with the Settings and Backup
   boxes, an export (download checked), the import error Flash, the import confirm dialog with its
   warning lines, Replace (exactly one `mta.data.backup-*` copy), the start-date dialog on a
   non-Monday, the changes list after a new start date, Plan complete with its link, then a reset.
   The script also checks `manifest.webmanifest` (name, start_url, scope, display, every icon is
   served) and does the **offline reload**: waits for the service worker, sets the context offline,
   reloads, checks Today renders and a log saves, and writes `offline-today.png`. Note that `?date=`
   previews make "Last export" look older than it is.
8. Icons: `python3 scripts/make_icons.py` regenerates public/icons/ from public/favicon.svg. Only
   needed if the favicon changes.
9. Tests and intervals (milestone 5): the `m5-*` shots run on an empty seed: the week 1 test card
   with its steps, the drift + vertical form with the live result, a failing drift, validation,
   the week 2 threshold (gap 8.6%, on), week 5 Tuesday with intervals (asserted equal on Today and
   in the Week view), week 8 without the retest, the week 12 vertical compared with week 1, delete
   from history, and the import dialog's Test results row. A second seed with a 13.6% gap shows
   week 5 intervals off and the week 8 drift retest.
10. Trips and gear (milestone 6): the `m6-*` shots run on an empty seed: Trips empty, the trip form
    (pack prefilled from the week), Planned with the Route link (href, target and rel asserted), form
    errors including a `javascript:` link, the route on the 21 Nov hike card, "Plan a route" on 28 Nov,
    Date passed → Mark done → Done totals, delete confirm, Gear empty → starter list → ticked and
    edited, and the import dialog's Trips and Gear items rows.
11. Rest timer and charts (milestone 7): the `m7-*` shots: strength log with the timer idle, running and
    over (`window.mtaRestPreview(3)` makes it a 3 s timer), Minutes saved and shown in the week 2 hours
    figure, Thursday with 2:00 preselected from the plan, the Week tab Progress charts with five weeks of
    generated logs, tapping week 3 on a chart, and the empty state.
12. Plan editor (milestone 8): the `m8-*` shots run on an empty seed: Plan complete → Build a new cycle, the
    New cycle dialog (default start = the Monday after the plan in use ends), a blank cycle, a strength session
    with two exercises, a session with no exercises listed under "Fix before using" (Use this cycle disabled),
    deleting it, the week pattern, six weeks, week 2's own Tuesday, a lighter week 4 with the cut switched on in
    Rules, Use this cycle, Today on 15 Feb showing "Week 1 of 6" and Strength C, a log saved, week 4 cut to
    3 sets, the hike target, the Week tab, then back to the 12-week plan (Plan complete again).
