# Mountain Training App

Personal PWA for a 12-week mountaineering training plan. One user, no backend, no accounts.
Live at https://heavyjetstriker.github.io/mountaneering-training-app/ (GitHub Pages, deployed by
.github/workflows/deploy.yml on every push to main).

The full spec is the Project doc **"Mountain Training App - Build Handoff"** (v2). Read it before
starting a milestone; this file only holds the rules that must never be broken.

## Ground rules

- **plan.json is the only source of training content** (src/data/plan.json). Never hard-code
  exercises, sets, reps, durations or week targets in components. If the plan changes, edit
  plan.json; src/schema.ts validates it at load.
- **Never change what the training is.** UI or code changes must not alter sets, reps, minutes,
  packs, test days or block rules unless the user explicitly asks. If a rule seems wrong, ask.
- **Dates are plain 'YYYY-MM-DD' strings in local time.** Use the helpers in src/dates.ts.
  Never `new Date('YYYY-MM-DD')` (parsed as UTC, off by one day) and never `toISOString()` for "today".
- **Friday is always rest.** Plan pauses are whole weeks only.
- **Plan logic stays pure and tested.** Rules live in src/plan.ts (later also buildEffectivePlan for
  overrides). Every new rule gets a Vitest test in src/plan.test.ts.
- **User changes are overrides layered on plan.json**, never edits to it. `buildEffectivePlan` (src/plan.ts)
  applies them in createdAt order; App passes the effective plan to every screen. A this-week-only
  change beats a permanent one; resetting a change deletes its override record. Logs store names and
  numbers as they were on the day, so plan edits never rewrite history.
- **My records live in one versioned object** in localStorage (`mta.data`, src/store.ts), validated by
  src/logSchema.ts and written whole through `save()`. Unreadable data is never overwritten: it is
  copied to `mta.data.corrupt-<timestamp>`. Log logic is pure and tested in src/logs.ts.
  Half-filled strength logs are kept separately in `mta.drafts` (never exported).
- **Backup is one JSON file** (src/backup.ts, pure and tested): `{ app, exportedAt, data }`. Import
  replaces everything (no merge), only after a confirm, and first copies the old data to
  `mta.data.backup-<timestamp>` (latest copy only). Bad, foreign or newer files change nothing.
  If AppData ever gets version 2, add a migration and keep reading version 1 backups.
- **Test results drive the intervals switch** (src/tests.ts, pure and tested): drift < 5% sets the
  aerobic threshold (starting HR); gap = (threshold HR − aerobic threshold) / threshold HR, on at 10% or
  less. A week is laid out with `contextForWeek` (results dated before that week's Tuesday), so later
  results never rewrite earlier weeks. Every caller of slotsFor / sessionsFor / resolveSession passes
  that context (use `useWeekContext`); `ctx` is required on purpose. A logged week 8 retest stays put.
- **Trips and gear** (src/trips.ts, src/gear.ts, pure and tested) live in `mta.data.trips` / `.gear`.
  Route links are http(s) only (schema-checked, also on import) and open with `rel="noopener noreferrer"`.
  The gear starter list is `starterGear` in plan.json, not hard-coded.
- **Rest timer and charts** (src/rest.ts, src/progress.ts, pure and tested). The plan gives no gym rest
  lengths, so none are invented: presets plus my last choice (`mta.meta`), and only the plan's own
  "2 min rest" is preselected (Thursday). Charts are hand-made SVG on a weeks 1–12 axis; weeks come from
  log dates through the effective plan. Chart colours are Primer data tokens (pine, purple), checked
  against the dark canvas with the dataviz palette validator.
- **Offline-first PWA** (vite-plugin-pwa, registerType 'prompt'): a new version only reloads when I
  tap Reload, never on the log screen. Device-only info (last export) lives in `mta.meta`.
- Keep it simple: React + plain CSS, no state library, no router, no new dependencies without a reason.
- App text is English, sentence case, plain words.

## UI: clean and GitHub-like, never "vibe-coded"

- Built on GitHub's own design tokens (`@primer/primitives`, dark theme) and icons
  (`@primer/octicons-react`), font Mona Sans. In CSS use only Primer variables
  (`--fgColor-*`, `--bgColor-*`, `--borderColor-*`, `--base-size-*`, `--borderRadius-*`).
  No raw hex colours, no one-off sizes.
- One container pattern: the bordered **box** with a muted header row and divided rows
  (src/styles.css). No cards inside cards, no shadows, no gradients, no glow, no blur.
- Colour means something or isn't used: accent blue = today and links, attention yellow =
  lighter/test week, green = progress, coral = active tab. Everything else is neutral grey.
- Use Primer patterns before inventing: Label, Flash, Button, invisible button, blankslate.
- No emojis as icons, no decorative status dots, no animated entrances, no big hero numbers.
- Phone-first, tap targets at least 44–48px (usable mid-set). On a PC it is the same column, centred.

## Before saying a milestone is done

Use the `check-app` skill (.claude/skills/check-app): tests, type-check and build, then
screenshots of the key days at phone size, and look at them.

## Commands

- `npm run dev` – local dev server
- `npm test` – Vitest
- `npm run build` – type-check and production build
- Preview any day: add `?date=2026-12-07` to the URL.
