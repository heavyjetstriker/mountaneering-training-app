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
