import { describe, expect, it } from 'vitest';
import rawPlan from './data/plan.json';
import { parsePlan } from './schema';
import type { LoggedSet, SessionLog } from './logSchema';
import { buildEffectivePlan, getWeek } from './plan';
import { clock, remaining, restFromPlan } from './rest';
import { hoursByWeek, kgRange, niceMax, packByWeek, topSetByWeek, weekOfLog } from './progress';

const plan = parsePlan(rawPlan);
let n = 0;
const log = (date: string, type: SessionLog['type'], extra: Partial<SessionLog> = {}): SessionLog => ({
  id: `l${++n}`,
  date,
  week: 1,
  type,
  status: 'done',
  savedAt: `${date}T19:00:00.000Z`,
  ...extra,
});
const set = (exerciseId: string, reps: number, kg: number | null, setNumber = 1): LoggedSet => ({
  exerciseId,
  exerciseName: exerciseId,
  setNumber,
  reps,
  unit: 'reps',
  kg,
});

describe('rest timer', () => {
  it("reads the plan's own rest length", () => {
    expect(restFromPlan(getWeek(plan, 1).meVolume)).toBe(120);
    expect(restFromPlan(getWeek(plan, 5).meVolume)).toBe(120);
    expect(restFromPlan(getWeek(plan, 9).meVolume)).toBeNull();
    expect(restFromPlan('3 × 10, 90 s rest')).toBe(90);
    expect(restFromPlan('Zone 2')).toBeNull();
  });
  it('counts down in whole seconds and formats a clock', () => {
    expect(remaining(10_000, 0)).toBe(10);
    expect(remaining(10_000, 9_001)).toBe(1);
    expect(remaining(10_000, 10_000)).toBe(0);
    expect(remaining(10_000, 12_000)).toBe(0);
    expect(clock(90)).toBe('1:30');
    expect(clock(5)).toBe('0:05');
    expect(clock(180)).toBe('3:00');
    expect(clock(-3)).toBe('0:00');
  });
});

describe('weekOfLog', () => {
  it('maps a date to its plan week, or null outside the 12 weeks', () => {
    expect(weekOfLog(plan, '2026-11-16')).toBe(1);
    expect(weekOfLog(plan, '2026-11-29')).toBe(2);
    expect(weekOfLog(plan, '2026-11-15')).toBeNull();
    expect(weekOfLog(plan, '2027-02-08')).toBeNull();
  });
  it('follows pauses and a new start date', () => {
    const paused = buildEffectivePlan(plan, [
      { id: 'p', createdAt: '2026-11-20T00:00:00Z', override: { kind: 'pause', fromWeek: 2, weeks: 1 } },
    ]);
    expect(weekOfLog(paused, '2026-11-23')).toBeNull(); // the paused week
    expect(weekOfLog(paused, '2026-11-30')).toBe(2);
    const moved = buildEffectivePlan(plan, [
      { id: 's', createdAt: '2026-11-20T00:00:00Z', override: { kind: 'startDate', date: '2026-11-23' } },
    ]);
    expect(weekOfLog(moved, '2026-11-16')).toBeNull();
    expect(weekOfLog(moved, '2026-11-30')).toBe(2);
  });
});

describe('hoursByWeek', () => {
  it('sums minutes of done and partial logs; skipped and minute-less logs add nothing', () => {
    const logs = [
      log('2026-11-16', 'strengthA', { minutes: 50 }),
      log('2026-11-16', 'zone2Incline', { minutes: 45 }),
      log('2026-11-17', 'testDriftVertical', { status: 'skipped', minutes: 90 }),
      log('2026-11-18', 'strengthB', { status: 'partial', minutes: 25 }),
      log('2026-11-19', 'me'),
      log('2026-11-28', 'longHike', { minutes: 150 }),
    ];
    const h = hoursByWeek(plan, logs);
    expect(h).toHaveLength(12);
    expect(h[0]).toBe(2); // 120 min
    expect(h[1]).toBe(2.5);
    expect(h[2]).toBe(0);
  });
});

describe('packByWeek', () => {
  it('planned ranges from the week table', () => {
    expect(kgRange('12–14 kg')).toEqual([12, 14]);
    expect(kgRange('6 kg')).toEqual([6, 6]);
    expect(kgRange('2 h')).toBeNull();
    const p = packByWeek(plan, []);
    expect(p[0].planned).toEqual([6, 6]);
    expect(p[8].planned).toEqual([12, 12]);
    expect(p[11].planned).toEqual([12, 14]);
    expect(p.every((w) => w.logged === null)).toBe(true);
  });
  it('logged = heaviest long-hike pack that week, wherever the hike was moved', () => {
    const logs = [
      log('2026-11-21', 'longHike', { packKg: 6 }),
      log('2026-11-19', 'me', { packKg: 6.5 }), // Thursday pack isn't the hike pack
      log('2026-11-29', 'longHike', { packKg: 7 }), // week 2 hike done on Sunday
      log('2026-11-28', 'longHike', { packKg: 5, status: 'skipped' }),
      log('2027-02-06', 'longDayTest', { packKg: 13 }),
    ];
    const p = packByWeek(plan, logs);
    expect(p[0].logged).toBe(6);
    expect(p[1].logged).toBe(7);
    expect(p[11].logged).toBe(13);
  });
});

describe('topSetByWeek', () => {
  it('heaviest kg with reps per week, for one exercise', () => {
    const logs = [
      log('2026-11-16', 'strengthA', {
        sets: [set('back-squat', 5, 80), set('back-squat', 5, 82.5, 2), set('back-squat', 0, 100, 3), set('sl-rdl', 8, 16)],
      }),
      log('2026-11-23', 'strengthA', { sets: [set('back-squat', 5, null)] }),
      log('2026-11-30', 'strengthA', { sets: [set('back-squat', 5, 85)] }),
    ];
    const squat = topSetByWeek(plan, logs, 'back-squat');
    expect(squat.slice(0, 4)).toEqual([82.5, null, 85, null]);
    expect(topSetByWeek(plan, logs, 'deadlift').every((x) => x === null)).toBe(true);
  });
});

describe('niceMax', () => {
  it('rounds an axis top up to 1, 2, 2.5 or 5 × 10ⁿ', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(4.3)).toBe(5);
    expect(niceMax(7.2)).toBe(10);
    expect(niceMax(14)).toBe(20);
    expect(niceMax(118)).toBe(200);
    expect(niceMax(2.1)).toBe(2.5);
  });
});
