import { describe, expect, it } from 'vitest';
import rawPlan from './data/plan.json';
import { parsePlan } from './schema';
import { AppDataSchema, emptyAppData, type SessionLog, type TestResult } from './logSchema';
import { buildEffectivePlan, resolveSession, sessionTypesFor } from './plan';
import {
  aerobicThreshold,
  contextForWeek,
  driftPassed,
  driftPct,
  intervalsStatus,
  intervalsText,
  latestThreshold,
  pctText,
  statusAsOf,
  thresholdGap,
  verticalChange,
  verticalChangeText,
  verticalImproved,
  zone2Range,
} from './tests';

const plan = parsePlan(rawPlan);
let seq = 0;
const at = (date: string) => `${date}T19:00:${String(++seq).padStart(2, '0')}.000Z`;
const drift = (date: string, startHr: number, a: number, b: number, savedAt = at(date)): TestResult => ({
  id: `d${seq}`,
  date,
  savedAt,
  type: 'drift',
  startHr,
  hrFirstHalf: a,
  hrSecondHalf: b,
});
const thr = (date: string, thresholdHr: number): TestResult => ({
  id: `t${++seq}`,
  date,
  savedAt: at(date),
  type: 'threshold',
  thresholdHr,
});
const vert = (date: string, verticalM: number, avgHr: number): TestResult => ({
  id: `v${++seq}`,
  date,
  savedAt: at(date),
  type: 'vertical',
  verticalM,
  avgHr,
  minutes: 60,
  packKg: 10,
});

// The handoff's example: drift 17 Nov (week 1 Tue), threshold 24 Nov (week 2 Tue).
const example = [drift('2026-11-17', 148, 140, 145), thr('2026-11-24', 162)];

describe('drift test maths (rule 5)', () => {
  it('works out drift % and passes under 5%', () => {
    expect(pctText(driftPct({ hrFirstHalf: 140, hrSecondHalf: 145 }))).toBe('3.6%');
    expect(driftPassed({ hrFirstHalf: 140, hrSecondHalf: 145 })).toBe(true);
    expect(driftPct({ hrFirstHalf: 140, hrSecondHalf: 147 })).toBeCloseTo(5);
    expect(driftPassed({ hrFirstHalf: 140, hrSecondHalf: 147 })).toBe(false);
    expect(driftPct({ hrFirstHalf: 140, hrSecondHalf: 140 })).toBe(0);
    expect(driftPassed({ hrFirstHalf: 140, hrSecondHalf: 135 })).toBe(true);
  });
  it('Zone 2 is 90% of the aerobic threshold up to it', () => {
    expect(zone2Range(148)).toEqual([133, 148]);
  });
});

describe('aerobic threshold', () => {
  it('ignores a failed drift and uses the latest passed one', () => {
    const tests = [drift('2026-11-17', 148, 140, 145), drift('2027-01-12', 152, 140, 150)];
    expect(aerobicThreshold(tests, '2027-02-01')).toEqual({ hr: 148, date: '2026-11-17' });
    const later = [...tests, drift('2027-02-02', 150, 140, 143)];
    expect(aerobicThreshold(later, '2027-02-10')).toEqual({ hr: 150, date: '2027-02-02' });
  });
  it('orders two results on the same date by when they were saved', () => {
    const tests = [
      drift('2026-11-17', 150, 140, 141, '2026-11-17T20:00:00.000Z'),
      drift('2026-11-17', 146, 140, 141, '2026-11-17T09:00:00.000Z'),
    ];
    expect(aerobicThreshold(tests, '2026-11-18')!.hr).toBe(150);
  });
  it('a result counts from the day after its date', () => {
    expect(aerobicThreshold(example, '2026-11-17')).toBeNull();
    expect(aerobicThreshold(example, '2026-11-18')!.hr).toBe(148);
    expect(latestThreshold(example, '2026-11-24')).toBeNull();
    expect(latestThreshold(example, '2026-11-25')!.thresholdHr).toBe(162);
  });
});

describe('threshold gap and the intervals switch (rule 4)', () => {
  it('the handoff example: 8.6%, on from the next day', () => {
    expect(pctText(thresholdGap(148, 162))).toBe('8.6%');
    expect(intervalsStatus(example, '2026-11-24')).toEqual({ on: false, reason: 'noThreshold' });
    expect(intervalsStatus(example, '2026-11-25')).toMatchObject({ on: true });
    expect(intervalsText(intervalsStatus(example, '2026-11-25'))).toBe('Threshold gap 8.6%, 10% or less.');
  });
  it('exactly 10% is on, 10.1% is off', () => {
    expect(intervalsStatus([drift('2026-11-17', 144, 140, 142), thr('2026-11-24', 160)], '2026-12-01')).toMatchObject({
      on: true,
    }); // (160 − 144) / 160 = 10.0%
    const off = intervalsStatus([drift('2026-11-17', 143, 140, 142), thr('2026-11-24', 159)], '2026-12-01');
    expect(off).toMatchObject({ on: false, reason: 'gapTooBig' }); // 10.1%
    expect(intervalsText(off)).toBe('Threshold gap 10.1%. Intervals start at 10% or less.');
  });
  it('needs a threshold test and a passed drift test', () => {
    expect(intervalsStatus([], '2026-12-01')).toEqual({ on: false, reason: 'noThreshold' });
    expect(intervalsStatus([drift('2026-11-17', 148, 140, 145)], '2026-12-01')).toEqual({
      on: false,
      reason: 'noThreshold',
    });
    expect(intervalsStatus([thr('2026-11-24', 162)], '2026-12-01')).toEqual({ on: false, reason: 'noDrift' });
    expect(intervalsStatus([drift('2026-11-17', 148, 140, 150), thr('2026-11-24', 162)], '2026-12-01')).toEqual({
      on: false,
      reason: 'noDrift',
    });
    expect(intervalsText({ on: false, reason: 'noThreshold' })).toBe('Add a threshold test to unlock intervals.');
  });
  it('the Tests tab counts results up to and including today', () => {
    expect(statusAsOf(example, '2026-11-24')).toMatchObject({ on: true });
  });
});

describe('vertical test change', () => {
  it('needs two results and compares the latest with the first', () => {
    expect(verticalChange([vert('2026-11-17', 350, 145)], '2027-02-02')).toBeNull();
    const c = verticalChange([vert('2026-11-17', 350, 145), vert('2027-02-02', 410, 142)], '2027-02-02')!;
    expect(c).toMatchObject({ metres: 60, hr: -3 });
    expect(verticalChangeText(c)).toBe('+60 m at 3 bpm lower');
    expect(verticalImproved(c)).toBe(true);
    expect(verticalChangeText({ metres: -20, hr: 0 })).toBe('−20 m at the same HR');
    expect(verticalImproved({ metres: 10, hr: 4 })).toBe(false);
  });
});

describe('the week context', () => {
  const data = (tests: TestResult[], logs: SessionLog[] = []) => ({ ...emptyAppData(), tests, logs });
  const tue = (tests: TestResult[], week: number, logs: SessionLog[] = []) =>
    resolveSession(plan, week, 'tue', sessionTypesFor(plan, week, 'tue', contextForWeek(plan, data(tests, logs), week))[0], contextForWeek(plan, data(tests, logs), week));

  it('week 5 Tuesday shows intervals with an 8.6% gap, and why not without', () => {
    expect(tue(example, 5)).toMatchObject({ type: 'zone2Long', intervals: 4 });
    expect(tue(example, 5).intervalsHow).toMatch(/3 min easy between reps/);
    expect(tue(example, 6).intervals).toBe(5);
    expect(tue(example, 7).intervals).toBe(6);
    expect(tue([], 5)).toMatchObject({ intervalsLocked: 4, intervalsOff: { reason: 'noThreshold' } });
    const big = [drift('2026-11-17', 140, 140, 142), thr('2026-11-24', 162)];
    expect(tue(big, 5)).toMatchObject({ intervalsLocked: 4, intervalsOff: { reason: 'gapTooBig' } });
  });

  it('weeks 4 and 8 never show intervals, Friday stays rest', () => {
    expect(tue(example, 4).intervals).toBeUndefined();
    expect(tue(example, 4).intervalsLocked).toBeUndefined();
    expect(tue(example, 8)).toMatchObject({ type: 'zone2Long' });
    expect(tue(example, 8).intervals).toBeUndefined();
    for (let w = 1; w <= 12; w++)
      expect(sessionTypesFor(plan, w, 'fri', contextForWeek(plan, data(example), w))).toEqual(['rest']);
  });

  it('week 8 Tuesday is the drift retest only while intervals are off', () => {
    expect(tue([], 8).type).toBe('testDriftRetest');
    expect(tue([drift('2026-11-17', 140, 140, 142), thr('2026-11-24', 162)], 8).type).toBe('testDriftRetest');
    expect(tue(example, 8).type).toBe('zone2Long');
  });

  it('a later result never changes an earlier week', () => {
    // Intervals were off in week 5 (no threshold yet); a threshold in week 6 doesn't rewrite week 5.
    const late = [drift('2026-11-17', 148, 140, 145), thr('2026-12-22', 162)];
    expect(tue(late, 5).intervalsLocked).toBe(4);
    expect(tue(late, 7).intervals).toBe(6);
    // The week 8 retest itself, dated that Tuesday, doesn't swap the session it was entered from.
    const retest = [drift('2026-11-17', 140, 140, 142), thr('2026-11-24', 162), drift('2027-01-05', 150, 140, 142)];
    expect(tue(retest, 8).type).toBe('testDriftRetest');
  });

  it('a logged retest stays on week 8 Tuesday after results change', () => {
    const log: SessionLog = { id: 'r', date: '2027-01-05', week: 8, type: 'testDriftRetest', status: 'done', savedAt: at('2027-01-05') };
    expect(tue(example, 8, [log]).type).toBe('testDriftRetest');
  });

  it('follows pauses and a new start date', () => {
    const paused = buildEffectivePlan(plan, [
      { id: 'p', createdAt: '2026-11-20T00:00:00Z', override: { kind: 'pause', fromWeek: 3, weeks: 2 } },
    ]);
    // Week 5 Tuesday moves to 29 Dec; a threshold on 22 Dec now counts for it.
    const tests = [drift('2026-11-17', 148, 140, 145), thr('2026-12-22', 162)];
    expect(contextForWeek(paused, data(tests), 5).intervals.on).toBe(true);
    expect(contextForWeek(plan, data(tests), 5).intervals.on).toBe(false);
  });
});

describe('schema', () => {
  it('old data with no tests loads, each result type round-trips, bad values are rejected', () => {
    expect(AppDataSchema.safeParse(emptyAppData()).success).toBe(true);
    const d = { ...emptyAppData(), tests: [...example, vert('2026-11-17', 350, 145)] };
    expect(AppDataSchema.parse(JSON.parse(JSON.stringify(d)))).toEqual(d);
    const badHr = { ...emptyAppData(), tests: [thr('2026-11-24', 40)] };
    expect(AppDataSchema.safeParse(badHr).success).toBe(false);
    const badDate = { ...emptyAppData(), tests: [thr('2026-02-30', 160)] };
    expect(AppDataSchema.safeParse(badDate).success).toBe(false);
    const decimalHr = { ...emptyAppData(), tests: [thr('2026-11-24', 160.5)] };
    expect(AppDataSchema.safeParse(decimalHr).success).toBe(false);
  });
});

describe('result lines', () => {
  it('shows vertical conditions only when they differ from the plan (60 min, 10 kg)', async () => {
    const { resultText } = await import('./tests');
    expect(resultText(vert('2026-11-17', 350, 145))).toBe('Vertical 350 m at 145 bpm');
    expect(resultText({ ...vert('2026-11-17', 350, 145), minutes: 45, packKg: 8 } as TestResult)).toBe(
      'Vertical 350 m at 145 bpm in 45 min with 8 kg',
    );
    expect(resultText(example[0])).toBe('Drift 3.6%, starting HR 148');
  });
});
