# Mountain Training App

My personal app for a 12-week mountaineering training plan (16 Nov 2026 – 7 Feb 2027).
It opens on today's session, phone-first, and runs entirely in the browser.

**Open it:** https://heavyjetstriker.github.io/mountaneering-training-app/

Preview any day of the plan by adding `?date=YYYY-MM-DD`, e.g. `?date=2026-12-07`.

## Milestones

- [x] 1. Read-only plan: Today and Week screens, plan.json with a schema check, tested plan logic
- [ ] 2. Logging
- [ ] 3. Customization (plan changes with reset)
- [ ] 4. Phone-ready: offline, install on Android, export/import
- [ ] 5. Tests tab and intervals switch
- [ ] 6. Trips and gear
- [ ] 7. Polish

## Develop

```
npm install
npm run dev     # local server
npm test        # plan logic tests
npm run build   # type-check and build
```

The training content lives in `src/data/plan.json`. Rules for working on the code are in `CLAUDE.md`.
