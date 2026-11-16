// Plan logic rules 1–3 from the build handoff. Pure functions only, no React.
import type { Day, Exercise, Plan, PlanWeek, SessionType } from './schema';
import { addDays, daysBetween, weekdayOf, DAY_ORDER, type ISODate } from './dates';

export const TOTAL_WEEKS = 12;

/** A whole-week pause (milestone 3 stores these as overrides). */
export interface Pause {
  fromWeek: number;
  weeks: number;
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
export function positionOn(plan: Plan, date: ISODate, pauses: Pause[] = []): PlanPosition {
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
export function weekStartDate(plan: Plan, week: number, pauses: Pause[] = []): ISODate {
  const shift = pauses.filter((p) => p.fromWeek <= week).reduce((s, p) => s + p.weeks, 0);
  return addDays(plan.startDate, (week - 1 + shift) * 7);
}

export function dateOf(plan: Plan, week: number, day: Day, pauses: Pause[] = []): ISODate {
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

/** Rule 2: the session types on a plan day, with that week's dayChanges applied. */
export function sessionTypesFor(plan: Plan, week: number, day: Day, ctx: Context = DEFAULT_CONTEXT): SessionType[] {
  const w = getWeek(plan, week);
  const types = w.dayChanges?.[day] ?? plan.weekly[day];
  // Week 8: the drift retest only happens if intervals are still off.
  return types.map((t) => (t === 'testDriftRetest' && ctx.intervalsAllowed ? 'zone2Long' : t));
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

export interface ResolvedSession {
  type: SessionType;
  title: string;
  adjustment: Adjustment;
  exercises?: (Exercise & { originalSets: number })[];
  cardio?: { minutes: [number, number]; zone: string; where: string };
  /** Tuesday intervals: number of 4-min reps at Zone 4. */
  intervals?: number;
  /** Shown when intervals are planned this week but not unlocked yet. */
  intervalsLocked?: number;
  /** Plain-text target for sessions without exercises (hike, recovery, me, tests). */
  target?: string;
  instructions?: string;
}

/** A session as it should be shown for a given week and day. */
export function resolveSession(
  plan: Plan,
  week: number,
  day: Day,
  type: SessionType,
  ctx: Context = DEFAULT_CONTEXT,
): ResolvedSession {
  const w = getWeek(plan, week);
  const tpl = plan.templates[type];
  const adjustment = adjustmentFor(w, type, day);
  const out: ResolvedSession = { type, title: tpl.title, adjustment, instructions: tpl.instructions };

  if (tpl.exercises) {
    out.exercises = tpl.exercises.map((ex) => {
      const blocked = applyBlock(ex, w.block);
      return { ...blocked, originalSets: blocked.sets, sets: adjustSets(blocked.sets, adjustment) };
    });
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
): (Exercise & { originalSets: number }) | null {
  const ex = plan.exerciseLibrary.find((e) => e.id === swapId);
  if (!ex) return null;
  const w = getWeek(plan, week);
  const blocked = applyBlock(ex, w.block);
  return { ...blocked, originalSets: blocked.sets, sets: adjustSets(blocked.sets, adjustmentFor(w, type, day)) };
}

export function sessionsFor(plan: Plan, week: number, day: Day, ctx: Context = DEFAULT_CONTEXT): ResolvedSession[] {
  return sessionTypesFor(plan, week, day, ctx).map((t) => resolveSession(plan, week, day, t, ctx));
}

export function blockLabel(w: PlanWeek): string {
  const kind = w.kind === 'lighter' ? 'lighter week' : w.kind === 'test' ? 'test week' : 'build week';
  return `Block ${w.block}, ${kind}`;
}
