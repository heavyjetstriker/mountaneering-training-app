// Plan logic rules 1–3 and 7 from the build handoff. Pure functions only, no React.
import type { Day, Exercise, Plan, PlanWeek, SessionType } from './schema';
import type { OverrideRecord, OverrideScope, PlanOverride } from './logSchema';
import { addDays, daysBetween, weekdayOf, DAY_ORDER, type ISODate } from './dates';

export const TOTAL_WEEKS = 12;

/** A whole-week pause (stored as a 'pause' override). */
export interface Pause {
  fromWeek: number;
  weeks: number;
}

// ---------- Rule 7: my changes, layered on plan.json ----------

type EditOverride = Extract<PlanOverride, { kind: 'editExercise' }>;
type ReplaceOverride = Extract<PlanOverride, { kind: 'replaceExercise' }>;

export interface PlanChanges {
  pauses: Pause[];
  /** Per plan week, in the order they were made. */
  moves: Record<number, { from: Day; to: Day }[]>;
  edits: EditOverride[];
  replaces: ReplaceOverride[];
}

/** plan.json with all my override records applied. Every screen reads from this. */
export interface EffectivePlan extends Plan {
  changes: PlanChanges;
}

const NO_CHANGES: PlanChanges = { pauses: [], moves: {}, edits: [], replaces: [] };

function changesOf(plan: Plan): PlanChanges {
  return (plan as Partial<EffectivePlan>).changes ?? NO_CHANGES;
}

/** Overrides apply in createdAt order (ties keep their stored order). */
export function sortOverrides(records: OverrideRecord[]): OverrideRecord[] {
  return records
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.createdAt < b.r.createdAt ? -1 : a.r.createdAt > b.r.createdAt ? 1 : a.i - b.i))
    .map(({ r }) => r);
}

function withoutUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function buildEffectivePlan(plan: Plan, overrides: OverrideRecord[]): EffectivePlan {
  const changes: PlanChanges = { pauses: [], moves: {}, edits: [], replaces: [] };
  const weeks = plan.weeks.map((w) => ({ ...w }));
  for (const { override: o } of sortOverrides(overrides)) {
    switch (o.kind) {
      case 'editExercise':
        changes.edits.push(o);
        break;
      case 'replaceExercise':
        changes.replaces.push(o);
        break;
      case 'moveDay':
        (changes.moves[o.week] ??= []).push({ from: o.from, to: o.to });
        break;
      case 'weekTargets': {
        const i = weeks.findIndex((w) => w.week === o.week);
        if (i >= 0) weeks[i] = { ...weeks[i], ...withoutUndefined(o.changes) };
        break;
      }
      case 'pause':
        changes.pauses.push({ fromWeek: o.fromWeek, weeks: o.weeks });
        break;
    }
  }
  return { ...plan, weeks, changes };
}

export function isWeekOnly(scope: OverrideScope): scope is { week: number } {
  return 'week' in scope;
}

function appliesTo(scope: OverrideScope, week: number): boolean {
  return isWeekOnly(scope) ? scope.week === week : week >= scope.fromWeek;
}

/** Permanent ones first, then this-week-only ones: a week-scoped change beats a permanent one. */
function inScopeOrder<T extends { scope: OverrideScope }>(list: T[], week: number): T[] {
  const live = list.filter((x) => appliesTo(x.scope, week));
  return [...live.filter((x) => !isWeekOnly(x.scope)), ...live.filter((x) => isWeekOnly(x.scope))];
}

export type PlanPosition =
  | { status: 'before'; startDate: ISODate }
  | { status: 'active'; week: number; day: Day; weekStart: ISODate }
  | { status: 'paused'; day: Day; resumesOn: ISODate; nextWeek: number }
  | { status: 'complete'; endedOn: ISODate };

/**
 * Rule 1: which plan week and day a date falls on.
 * Pauses are whole weeks, so the weekday pattern never changes and Friday stays rest.
 */
export function positionOn(plan: Plan, date: ISODate, pauses: Pause[] = changesOf(plan).pauses): PlanPosition {
  const daysSince = daysBetween(plan.startDate, date);
  if (daysSince < 0) return { status: 'before', startDate: plan.startDate };

  const calendarWeek = Math.floor(daysSince / 7) + 1;
  const day = weekdayOf(date);
  let shift = 0;
  for (const p of [...pauses].sort((a, b) => a.fromWeek - b.fromWeek)) {
    const pauseStart = p.fromWeek + shift; // calendar week the pause begins
    if (calendarWeek < pauseStart) break;
    if (calendarWeek < pauseStart + p.weeks) {
      return {
        status: 'paused',
        day,
        resumesOn: addDays(plan.startDate, (pauseStart + p.weeks - 1) * 7),
        nextWeek: p.fromWeek,
      };
    }
    shift += p.weeks;
  }

  const week = calendarWeek - shift;
  if (week > TOTAL_WEEKS) {
    return { status: 'complete', endedOn: addDays(plan.startDate, (TOTAL_WEEKS + shift) * 7 - 1) };
  }
  return { status: 'active', week, day, weekStart: weekStartDate(plan, week, pauses) };
}

/** Monday of a plan week, taking pauses into account. */
export function weekStartDate(plan: Plan, week: number, pauses: Pause[] = changesOf(plan).pauses): ISODate {
  const shift = pauses.filter((p) => p.fromWeek <= week).reduce((s, p) => s + p.weeks, 0);
  return addDays(plan.startDate, (week - 1 + shift) * 7);
}

export function dateOf(plan: Plan, week: number, day: Day, pauses: Pause[] = changesOf(plan).pauses): ISODate {
  return addDays(weekStartDate(plan, week, pauses), DAY_ORDER.indexOf(day));
}

export function getWeek(plan: Plan, week: number): PlanWeek {
  const w = plan.weeks.find((x) => x.week === week);
  if (!w) throw new Error(`No week ${week} in the plan`);
  return w;
}

export interface Context {
  /** From the Tests tab (milestone 5). Off until a threshold result exists. */
  intervalsAllowed: boolean;
}

export const DEFAULT_CONTEXT: Context = { intervalsAllowed: false };

/** A session on a day, and the day the plan put it on (moves keep the original day's rules). */
export interface Slot {
  type: SessionType;
  from: Day;
}

/**
 * Rule 2: the sessions on each day of a plan week, with that week's dayChanges and my
 * moved days applied. A moved day's sessions stack after the target day's own; a day
 * left empty becomes a rest day.
 */
export function slotsFor(plan: Plan, week: number, ctx: Context = DEFAULT_CONTEXT): Record<Day, Slot[]> {
  const w = getWeek(plan, week);
  const days = {} as Record<Day, Slot[]>;
  for (const d of DAY_ORDER) {
    // Week 8: the drift retest only happens if intervals are still off.
    days[d] = (w.dayChanges?.[d] ?? plan.weekly[d]).map((t) => ({
      type: t === 'testDriftRetest' && ctx.intervalsAllowed ? 'zone2Long' : t,
      from: d,
    }));
  }
  for (const m of changesOf(plan).moves[week] ?? []) {
    if (m.from === m.to) continue;
    const moving = days[m.from].filter((s) => s.type !== 'rest');
    if (moving.length === 0) continue;
    days[m.from] = [];
    days[m.to] = [...days[m.to].filter((s) => s.type !== 'rest'), ...moving];
  }
  for (const d of DAY_ORDER) if (days[d].length === 0) days[d] = [{ type: 'rest', from: d }];
  return days;
}

export function sessionTypesFor(plan: Plan, week: number, day: Day, ctx: Context = DEFAULT_CONTEXT): SessionType[] {
  return slotsFor(plan, week, ctx)[day].map((s) => s.type);
}

/** The day the plan originally put this session on. */
export function originDay(plan: Plan, week: number, day: Day, type: SessionType, ctx: Context = DEFAULT_CONTEXT): Day {
  return slotsFor(plan, week, ctx)[day].find((s) => s.type === type)?.from ?? day;
}

// ---------- Rule 3: block rules ----------

const ZONE2: SessionType[] = ['zone2Incline', 'zone2Long', 'zone2Stairs'];
const STRENGTH: SessionType[] = ['strengthA', 'strengthB'];
const MON_TO_THU: Day[] = ['mon', 'tue', 'wed', 'thu'];

export type Adjustment = 'none' | 'lighter' | 'halved';

function adjustmentFor(w: PlanWeek, type: SessionType, day: Day): Adjustment {
  const gym = STRENGTH.includes(type) || ZONE2.includes(type);
  if (!gym) return 'none';
  if (w.kind === 'lighter') return 'lighter';
  if (w.kind === 'test' && MON_TO_THU.includes(day)) return 'halved';
  return 'none';
}

function adjustSets(sets: number, adj: Adjustment): number {
  if (adj === 'lighter') return Math.max(1, Math.round((sets * 2) / 3));
  if (adj === 'halved') return Math.max(1, Math.ceil(sets / 2));
  return sets;
}

function roundTo5(n: number): number {
  return Math.max(5, Math.round(n / 5) * 5);
}

function adjustMinutes([lo, hi]: [number, number], adj: Adjustment): [number, number] {
  if (adj === 'lighter') return [roundTo5((lo * 2) / 3), roundTo5((hi * 2) / 3)];
  if (adj === 'halved') return [roundTo5(lo / 2), roundTo5(hi / 2)];
  return [lo, hi];
}

/** Block 2: main lifts 4 × 4. Block 3: main lifts 3 × 4, hold the weight. */
function applyBlock(ex: Exercise, block: 1 | 2 | 3): Exercise {
  if (!ex.mainLift || block === 1) return ex;
  if (block === 2) return { ...ex, sets: 4, reps: '4' };
  return { ...ex, sets: 3, reps: '4' };
}

export type ResolvedExercise = Exercise & {
  /** Sets before the lighter / test-week cut. */
  originalSets: number;
  /** The plan.json exercise this one fills (differs from id when replaced). */
  slotId: string;
};

/** Block rules, then my edits (permanent first, then this-week-only), then the week's cut. */
function finishExercise(
  plan: Plan,
  w: PlanWeek,
  type: SessionType,
  adjustment: Adjustment,
  ex: Exercise,
  slotId: string,
): ResolvedExercise {
  let out: Exercise = applyBlock(ex, w.block);
  let setsForThisWeek = false;
  for (const e of inScopeOrder(changesOf(plan).edits, w.week)) {
    if (e.sessionType !== type || e.exerciseId !== ex.id) continue;
    const { sets, reps, targetKg, note } = e.changes;
    out = { ...out };
    if (sets !== undefined) {
      out.sets = sets;
      setsForThisWeek = isWeekOnly(e.scope); // a week-only set count is what I'll do: no further cut
    }
    if (reps !== undefined) out.reps = reps;
    if (targetKg === null) delete out.targetKg;
    else if (targetKg !== undefined) out.targetKg = targetKg;
    if (note !== undefined) {
      if (note.trim()) out.note = note;
      else delete out.note;
    }
  }
  return {
    ...out,
    slotId,
    originalSets: out.sets,
    sets: setsForThisWeek ? out.sets : adjustSets(out.sets, adjustment),
  };
}

/** Which exercise fills a plan slot this week: the latest replacement (week-only beats permanent). */
function exerciseInSlot(plan: Plan, week: number, type: SessionType, base: Exercise): Exercise {
  const reps = inScopeOrder(changesOf(plan).replaces, week).filter(
    (r) => r.sessionType === type && r.exerciseId === base.id,
  );
  return reps.length ? reps[reps.length - 1].with : base;
}

export interface ResolvedSession {
  type: SessionType;
  title: string;
  adjustment: Adjustment;
  exercises?: ResolvedExercise[];
  cardio?: { minutes: [number, number]; zone: string; where: string };
  /** Tuesday intervals: number of 4-min reps at Zone 4. */
  intervals?: number;
  /** Shown when intervals are planned this week but not unlocked yet. */
  intervalsLocked?: number;
  /** Plain-text target for sessions without exercises (hike, recovery, me, tests). */
  target?: string;
  instructions?: string;
}

/** A session as it should be shown for a given week and day (the day it's shown on). */
export function resolveSession(
  plan: Plan,
  week: number,
  day: Day,
  type: SessionType,
  ctx: Context = DEFAULT_CONTEXT,
): ResolvedSession {
  const w = getWeek(plan, week);
  const tpl = plan.templates[type];
  const adjustment = adjustmentFor(w, type, originDay(plan, week, day, type, ctx));
  const out: ResolvedSession = { type, title: tpl.title, adjustment, instructions: tpl.instructions };

  if (tpl.exercises) {
    out.exercises = tpl.exercises.map((base) =>
      finishExercise(plan, w, type, adjustment, exerciseInSlot(plan, week, type, base), base.id),
    );
  }
  if (tpl.cardio) {
    out.cardio = { ...tpl.cardio, minutes: adjustMinutes(tpl.cardio.minutes, adjustment) };
  }
  if (type === 'zone2Long' && w.intervals && w.kind !== 'lighter') {
    if (ctx.intervalsAllowed) out.intervals = w.intervals;
    else out.intervalsLocked = w.intervals;
  }
  if (type === 'me') out.target = w.meVolume;
  if (type === 'longHike') out.target = `${w.longHike.hours} with a ${w.longHike.packKg} pack`;
  if (type === 'recovery') out.target = w.sunday;
  return out;
}

/**
 * A one-off swap (e.g. weighted pull-ups → lat pulldown) as it should be done that day:
 * the swap's own sets and reps, with the block rules (its mainLift flag) and the
 * lighter / test-week cuts of the session it replaces.
 */
export function resolveSwap(
  plan: Plan,
  week: number,
  day: Day,
  type: SessionType,
  swapId: string,
): ResolvedExercise | null {
  const ex = plan.exerciseLibrary.find((e) => e.id === swapId);
  if (!ex) return null;
  const w = getWeek(plan, week);
  return finishExercise(plan, w, type, adjustmentFor(w, type, originDay(plan, week, day, type)), ex, swapId);
}

export function sessionsFor(plan: Plan, week: number, day: Day, ctx: Context = DEFAULT_CONTEXT): ResolvedSession[] {
  return sessionTypesFor(plan, week, day, ctx).map((t) => resolveSession(plan, week, day, t, ctx));
}

export function blockLabel(w: PlanWeek): string {
  const kind = w.kind === 'lighter' ? 'lighter week' : w.kind === 'test' ? 'test week' : 'build week';
  return `Block ${w.block}, ${kind}`;
}
