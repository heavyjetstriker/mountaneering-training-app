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
