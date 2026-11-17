// Rules 4 and 5: drift, threshold and vertical test maths, and the intervals switch.
// Pure functions only, no React, no storage. Steps come from the training plan's "Benchmark tests".
import type { Plan } from './schema';
import type { AppData, SessionLog, TestResult, TestType } from './logSchema';
import { addDays, type ISODate } from './dates';
import { dateOf, type Context, type IntervalsStatus } from './plan';

type Drift = Extract<TestResult, { type: 'drift' }>;
type Threshold = Extract<TestResult, { type: 'threshold' }>;
type Vertical = Extract<TestResult, { type: 'vertical' }>;

/** Drift under this % means the starting HR is at or below the aerobic threshold. */
export const DRIFT_LIMIT = 5;
/** Intervals are on when the threshold gap is this % or less. */
export const GAP_LIMIT = 10;

/** Oldest first: by date, then by when it was saved. */
export function sortResults(tests: TestResult[]): TestResult[] {
  return [...tests].sort((a, b) => (a.date === b.date ? a.savedAt.localeCompare(b.savedAt) : a.date < b.date ? -1 : 1));
}

/** Results dated before `date`, oldest first. A result counts from the day after its date. */
export function resultsBefore(tests: TestResult[], date: ISODate): TestResult[] {
  return sortResults(tests.filter((t) => t.date < date));
}

function latest<T extends TestType>(tests: TestResult[], type: T): Extract<TestResult, { type: T }> | null {
  const of = tests.filter((t): t is Extract<TestResult, { type: T }> => t.type === type);
  return of.length ? of[of.length - 1] : null;
}

/** (second half − first half) / first half × 100. */
export function driftPct(r: Pick<Drift, 'hrFirstHalf' | 'hrSecondHalf'>): number {
  return ((r.hrSecondHalf - r.hrFirstHalf) / r.hrFirstHalf) * 100;
}

/** Rounded the way it's shown, so 4.99… that displays as 5.0 doesn't pass. */
export function driftPassed(r: Pick<Drift, 'hrFirstHalf' | 'hrSecondHalf'>): boolean {
  return round1(driftPct(r)) < DRIFT_LIMIT;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** "3.6%" */
export function pctText(n: number): string {
  return `${round1(n).toFixed(1)}%`;
}

export interface AerobicThreshold {
  hr: number;
  date: ISODate;
}

/** Starting HR of the latest passed drift test before `date` (top of Zone 2). */
export function aerobicThreshold(tests: TestResult[], date: ISODate): AerobicThreshold | null {
  const passed = resultsBefore(tests, date).filter((t): t is Drift => t.type === 'drift' && driftPassed(t));
  const r = passed[passed.length - 1];
  return r ? { hr: r.startHr, date: r.date } : null;
}

/** The first passed drift test ever, for "First: 141 bpm". */
export function firstAerobicThreshold(tests: TestResult[]): AerobicThreshold | null {
  const r = sortResults(tests).find((t): t is Drift => t.type === 'drift' && driftPassed(t));
  return r ? { hr: r.startHr, date: r.date } : null;
}

export function latestThreshold(tests: TestResult[], date: ISODate): Threshold | null {
  return latest(resultsBefore(tests, date), 'threshold');
}

/** (threshold HR − aerobic threshold) / threshold HR × 100. */
export function thresholdGap(aerobicHr: number, thresholdHr: number): number {
  return ((thresholdHr - aerobicHr) / thresholdHr) * 100;
}

/** Zone 2 = 90% of the aerobic threshold up to the aerobic threshold. */
export function zone2Range(aerobicHr: number): [number, number] {
  return [Math.round(aerobicHr * 0.9), aerobicHr];
}

/** Rule 4, from results dated before `date`. Uses the displayed (one-decimal) gap, so 10.0% is on. */
export function intervalsStatus(tests: TestResult[], date: ISODate): IntervalsStatus {
  const thr = latestThreshold(tests, date);
  if (!thr) return { on: false, reason: 'noThreshold' };
  const at = aerobicThreshold(tests, date);
  if (!at) return { on: false, reason: 'noDrift' };
  const gap = thresholdGap(at.hr, thr.thresholdHr);
  return round1(gap) <= GAP_LIMIT ? { on: true, gap } : { on: false, reason: 'gapTooBig', gap };
}

/**
 * The context for laying out a plan week. Intervals and the drift retest are Tuesday rules
 * (and moved sessions keep their original day's rules), so the week uses the results dated
 * before its Tuesday. Adding later results never changes an earlier week.
 */
export function contextForWeek(plan: Plan, data: Pick<AppData, 'tests' | 'logs'>, week: number): Context {
  const tuesday = dateOf(plan, week, 'tue');
  const monday = addDays(tuesday, -1);
  const sunday = addDays(tuesday, 5);
  const keepRetest = data.logs.some(
    (l: SessionLog) => !!plan.templates[l.type]?.onlyIfIntervalsOff && l.date >= monday && l.date <= sunday,
  );
  return { intervals: intervalsStatus(data.tests, tuesday), ...(keepRetest ? { keepRetest } : {}) };
}

/** Everything up to and including `today` (the Tests tab). */
export function statusAsOf(tests: TestResult[], today: ISODate): IntervalsStatus {
  return intervalsStatus(tests, addDays(today, 1));
}

export function latestOf<T extends TestType>(tests: TestResult[], type: T, today: ISODate) {
  return latest(resultsBefore(tests, addDays(today, 1)), type);
}

export interface VerticalChange {
  first: Vertical;
  metres: number;
  hr: number;
}

/** Latest vertical test against the first one (the plan's aim: more metres at the same or lower HR). */
export function verticalChange(tests: TestResult[], today: ISODate): VerticalChange | null {
  const v = resultsBefore(tests, addDays(today, 1)).filter((t): t is Vertical => t.type === 'vertical');
  if (v.length < 2) return null;
  const first = v[0];
  const last = v[v.length - 1];
  return { first, metres: last.verticalM - first.verticalM, hr: last.avgHr - first.avgHr };
}

/** True when it's what the plan aims for: more metres at the same or lower heart rate. */
export function verticalImproved(c: Pick<VerticalChange, 'metres' | 'hr'>): boolean {
  return c.metres > 0 && c.hr <= 0;
}

/** "+60 m at 3 bpm lower", "−20 m at the same HR", "+10 m at 4 bpm higher". */
export function verticalChangeText(c: Pick<VerticalChange, 'metres' | 'hr'>): string {
  const m = c.metres === 0 ? 'Same metres' : `${c.metres > 0 ? '+' : '−'}${Math.abs(c.metres)} m`;
  const hr = c.hr === 0 ? 'the same HR' : `${Math.abs(c.hr)} bpm ${c.hr < 0 ? 'lower' : 'higher'}`;
  return `${m} at ${hr}`;
}

/** Plain-words reason for the session card and the Tests tab. */
export function intervalsText(s: IntervalsStatus): string {
  if (s.on) return `Threshold gap ${pctText(s.gap)}, ${GAP_LIMIT}% or less.`;
  if (s.reason === 'gapTooBig') return `Threshold gap ${pctText(s.gap)}. Intervals start at ${GAP_LIMIT}% or less.`;
  if (s.reason === 'noThreshold') return 'Add a threshold test to unlock intervals.';
  return `Add a drift test under ${DRIFT_LIMIT}% to set your aerobic threshold.`;
}

export const TEST_TITLES: Record<TestType, string> = {
  drift: 'Drift test',
  threshold: 'Threshold test',
  vertical: 'Vertical test',
};

/** One line for the history list and Latest results. */
export function resultText(t: TestResult): string {
  switch (t.type) {
    case 'drift':
      return `Drift ${pctText(driftPct(t))}, starting HR ${t.startHr}`;
    case 'threshold':
      return `Threshold HR ${t.thresholdHr}`;
    case 'vertical':
      return `Vertical ${t.verticalM} m at ${t.avgHr} bpm${verticalConditions(t)}`;
  }
}

// The plan's vertical test: 60 min with a 10 kg pack. Only other conditions are worth showing.
export const VERTICAL_MINUTES = 60;
export const VERTICAL_PACK_KG = 10;

function verticalConditions(t: Vertical): string {
  const parts: string[] = [];
  if (t.minutes !== undefined && t.minutes !== VERTICAL_MINUTES) parts.push(`in ${t.minutes} min`);
  if (t.packKg !== undefined && t.packKg !== VERTICAL_PACK_KG) parts.push(`with ${t.packKg} kg`);
  return parts.length ? ` ${parts.join(' ')}` : '';
}

export function upsertTest(data: AppData, t: TestResult): AppData {
  return { ...data, tests: [...data.tests.filter((x) => x.id !== t.id), t] };
}

export function deleteTest(data: AppData, id: string): AppData {
  return { ...data, tests: data.tests.filter((t) => t.id !== id) };
}

/** Which result forms a test session opens. */
export function testsForSession(plan: Plan, type: string): TestType[] {
  return plan.templates[type]?.tests ?? [];
}
