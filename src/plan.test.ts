import { describe, expect, it } from 'vitest';
import rawPlan from './data/plan.json';
import { parsePlan } from './schema';
import { addDays, localISO, weekdayOf, dayNumber, fromDayNumber } from './dates';
import { positionOn, sessionTypesFor, resolveSession, sessionsFor, dateOf, resolveSwap } from './plan';

const plan = parsePlan(rawPlan);
const exercise = (week: number, day: 'mon' | 'wed', type: 'strengthA' | 'strengthB', id: string) =>
  resolveSession(plan, week, day, type).exercises!.find((e) => e.id === id)!;

describe('dates (rule 0)', () => {
  it('knows weekdays', () => {
    expect(weekdayOf('2026-11-16')).toBe('mon');
    expect(weekdayOf('2026-11-20')).toBe('fri');
    expect(weekdayOf('2027-02-07')).toBe('sun');
  });
  it('round-trips day numbers and adds days across months and years', () => {
    expect(fromDayNumber(dayNumber('2026-12-31'))).toBe('2026-12-31');
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
  });
  it('takes today from local date parts, not UTC', () => {
    expect(localISO(new Date(2026, 10, 16, 23, 59))).toBe('2026-11-16');
    expect(localISO(new Date(2026, 10, 17, 0, 1))).toBe('2026-11-17');
  });
});

describe('plan.json', () => {
  it('passes the schema', () => {
    expect(plan.weeks).toHaveLength(12);
  });
  it('rejects a plan that trains on Friday', () => {
    const bad = structuredClone(rawPlan) as typeof rawPlan;
    bad.weekly.fri = ['me'];
    expect(() => parsePlan(bad)).toThrow(/Friday/);
  });
});

describe('which week and day (rule 1)', () => {
  it('starts on Monday 16 Nov 2026 with Strength A and Zone 2 incline', () => {
    expect(positionOn(plan, '2026-11-16')).toMatchObject({ status: 'active', week: 1, day: 'mon' });
    expect(sessionTypesFor(plan, 1, 'mon')).toEqual(['strengthA', 'zone2Incline']);
  });
  it('shows "before" and "complete" outside the 12 weeks', () => {
    expect(positionOn(plan, '2026-11-15').status).toBe('before');
    expect(positionOn(plan, '2027-02-07')).toMatchObject({ status: 'active', week: 12, day: 'sun' });
    expect(positionOn(plan, '2027-02-08')).toMatchObject({ status: 'complete', endedOn: '2027-02-07' });
  });
  it('counts weeks across the year change', () => {
    expect(positionOn(plan, '2026-12-28')).toMatchObject({ week: 7, day: 'mon' });
    expect(positionOn(plan, '2027-01-03')).toMatchObject({ week: 7, day: 'sun' });
  });
  it('Friday is always rest', () => {
    for (let w = 1; w <= 12; w++) expect(sessionTypesFor(plan, w, 'fri')).toEqual(['rest']);
  });
  it('pauses push the plan back by whole weeks', () => {
    const pauses = [{ fromWeek: 6, weeks: 1 }];
    expect(positionOn(plan, '2026-12-21', pauses)).toMatchObject({
      status: 'paused', resumesOn: '2026-12-28', nextWeek: 6,
    });
    expect(positionOn(plan, '2026-12-28', pauses)).toMatchObject({ status: 'active', week: 6, day: 'mon' });
    expect(positionOn(plan, '2026-12-14', pauses)).toMatchObject({ status: 'active', week: 5 });
    expect(positionOn(plan, '2027-02-14', pauses)).toMatchObject({ status: 'active', week: 12, day: 'sun' });
    expect(positionOn(plan, '2027-02-15', pauses)).toMatchObject({ status: 'complete', endedOn: '2027-02-14' });
    expect(dateOf(plan, 6, 'sat', pauses)).toBe('2027-01-02');
    // Friday is still Friday after a pause.
    expect(weekdayOf(dateOf(plan, 7, 'fri', pauses))).toBe('fri');
  });
  it('handles two pauses', () => {
    const pauses = [{ fromWeek: 3, weeks: 1 }, { fromWeek: 6, weeks: 2 }];
    // Week 3 is paused for a week (30 Nov), so it runs in the calendar week of 7 Dec.
    expect(positionOn(plan, '2026-11-30', pauses)).toMatchObject({ status: 'paused', nextWeek: 3 });
    expect(positionOn(plan, '2026-12-07', pauses)).toMatchObject({ status: 'active', week: 3 });
    // Week 6 would be calendar week 7 (28 Dec); paused for 2 weeks, resumes 11 Jan.
    expect(positionOn(plan, '2027-01-04', pauses)).toMatchObject({ status: 'paused', resumesOn: '2027-01-11' });
    expect(positionOn(plan, '2027-01-11', pauses)).toMatchObject({ status: 'active', week: 6 });
  });
});

describe('day changes (rule 2)', () => {
  it('puts the tests on the right days', () => {
    expect(sessionTypesFor(plan, 1, 'tue')).toEqual(['testDriftVertical']);
    expect(sessionTypesFor(plan, 2, 'tue')).toEqual(['testThreshold']);
    expect(sessionTypesFor(plan, 3, 'tue')).toEqual(['zone2Long']);
    expect(sessionTypesFor(plan, 12, 'tue')).toEqual(['testDriftVertical']);
    expect(sessionTypesFor(plan, 12, 'sat')).toEqual(['longDayTest']);
    expect(sessionTypesFor(plan, 11, 'sat')).toEqual(['longHike']);
  });
  it('week 8 retest only when intervals are still off', () => {
    expect(sessionTypesFor(plan, 8, 'tue', { intervalsAllowed: false })).toEqual(['testDriftRetest']);
    expect(sessionTypesFor(plan, 8, 'tue', { intervalsAllowed: true })).toEqual(['zone2Long']);
    const tue = sessionsFor(plan, 8, 'tue', { intervalsAllowed: true })[0];
    expect(tue.intervals).toBeUndefined();
  });
});

describe('block rules (rule 3)', () => {
  it('block 1 is as written', () => {
    expect(exercise(1, 'mon', 'strengthA', 'back-squat')).toMatchObject({ sets: 4, reps: '5' });
    expect(exercise(1, 'mon', 'strengthA', 'pallof-press')).toMatchObject({ sets: 3, reps: '10 per side' });
  });
  it('block 2 main lifts are 4 × 4, accessories unchanged', () => {
    expect(exercise(5, 'mon', 'strengthA', 'back-squat')).toMatchObject({ sets: 4, reps: '4' });
    expect(exercise(5, 'mon', 'strengthA', 'weighted-pull-ups')).toMatchObject({ sets: 4, reps: '4' });
    expect(exercise(5, 'mon', 'strengthA', 'sl-rdl')).toMatchObject({ sets: 3, reps: '8 per leg' });
  });
  it('block 3 main lifts are 3 × 4', () => {
    expect(exercise(9, 'wed', 'strengthB', 'deadlift')).toMatchObject({ sets: 3, reps: '4' });
    expect(exercise(9, 'wed', 'strengthB', 'overhead-press')).toMatchObject({ sets: 3, reps: '6' });
  });
  it('lighter weeks cut gym sets and minutes by a third', () => {
    const squat = exercise(4, 'mon', 'strengthA', 'back-squat');
    expect(squat).toMatchObject({ sets: 3, originalSets: 4 });
    expect(exercise(4, 'mon', 'strengthA', 'pallof-press').sets).toBe(2);
    expect(exercise(4, 'mon', 'strengthA', 'tibialis-raise').sets).toBe(1);
    expect(resolveSession(plan, 4, 'mon', 'zone2Incline').cardio!.minutes).toEqual([20, 30]);
    expect(resolveSession(plan, 4, 'tue', 'zone2Long').cardio!.minutes).toEqual([40, 60]);
    // Week 8 is block 2: main lifts 4 × 4, then the cut.
    expect(exercise(8, 'mon', 'strengthA', 'back-squat')).toMatchObject({ sets: 3, reps: '4' });
  });
  it('lighter weeks do not cut the hike, Sunday or Thursday again', () => {
    expect(resolveSession(plan, 4, 'sat', 'longHike')).toMatchObject({ adjustment: 'none', target: '2 h with a 6 kg pack' });
    expect(resolveSession(plan, 4, 'sun', 'recovery').target).toBe('45 min easy walk');
    expect(resolveSession(plan, 4, 'thu', 'me').adjustment).toBe('none');
  });
  it('week 12 halves Monday to Wednesday gym work, rounded up', () => {
    expect(exercise(12, 'mon', 'strengthA', 'back-squat')).toMatchObject({ sets: 2, reps: '4' });
    expect(exercise(12, 'mon', 'strengthA', 'sl-rdl').sets).toBe(2);
    expect(resolveSession(plan, 12, 'wed', 'zone2Stairs').cardio!.minutes).toEqual([15, 25]);
    expect(resolveSession(plan, 12, 'sat', 'longDayTest').adjustment).toBe('none');
  });
  it('intervals only show in weeks 5–7 once unlocked', () => {
    expect(resolveSession(plan, 5, 'tue', 'zone2Long')).toMatchObject({ intervalsLocked: 4 });
    expect(resolveSession(plan, 5, 'tue', 'zone2Long', { intervalsAllowed: true })).toMatchObject({ intervals: 4 });
    expect(resolveSession(plan, 7, 'tue', 'zone2Long', { intervalsAllowed: true }).intervals).toBe(6);
    expect(resolveSession(plan, 9, 'tue', 'zone2Long', { intervalsAllowed: true }).intervals).toBeUndefined();
  });
});

describe('one-off swaps', () => {
  it('uses the swap\'s own dose with the block rules and week cuts', () => {
    const swap = (week: number, id: string) => resolveSwap(plan, week, 'mon', 'strengthA', id)!;
    expect(swap(1, 'lat-pulldown')).toMatchObject({ name: 'Lat pulldown', sets: 4, reps: '5–6' });
    expect(swap(5, 'lat-pulldown')).toMatchObject({ sets: 4, reps: '4' }); // main lift, block 2
    expect(swap(5, 'inverted-rows')).toMatchObject({ sets: 4, reps: '8' }); // accessory
    expect(swap(4, 'lat-pulldown')).toMatchObject({ sets: 3, originalSets: 4 }); // lighter week
    expect(swap(12, 'lat-pulldown')).toMatchObject({ sets: 2, reps: '4' }); // block 3, halved
    expect(resolveSwap(plan, 1, 'mon', 'strengthA', 'nope')).toBeNull();
  });
});
