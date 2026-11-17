import { describe, expect, it } from 'vitest';
import rawPlan from './data/plan.json';
import { parsePlan } from './schema';
import { addDays, localISO, weekdayOf, dayNumber, fromDayNumber } from './dates';
import {
  positionOn,
  sessionTypesFor,
  resolveSession,
  sessionsFor,
  dateOf,
  resolveSwap,
  buildEffectivePlan,
  kindOf,
  slotsFor,
  DEFAULT_CONTEXT,
  type Context,
  weekStartDate,
} from './plan';
import type { OverrideRecord, PlanOverride } from './logSchema';

const plan = parsePlan(rawPlan);
const C = DEFAULT_CONTEXT;
const ON: Context = { intervals: { on: true, gap: 8.6 } };
const exercise = (week: number, day: 'mon' | 'wed', type: 'strengthA' | 'strengthB', id: string) =>
  resolveSession(plan, week, day, type, C).exercises!.find((e) => e.id === id)!;

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
    expect(sessionTypesFor(plan, 1, 'mon', C)).toEqual(['strengthA', 'zone2Incline']);
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
    for (let w = 1; w <= 12; w++) expect(sessionTypesFor(plan, w, 'fri', C)).toEqual(['rest']);
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
    expect(sessionTypesFor(plan, 1, 'tue', C)).toEqual(['testDriftVertical']);
    expect(sessionTypesFor(plan, 2, 'tue', C)).toEqual(['testThreshold']);
    expect(sessionTypesFor(plan, 3, 'tue', C)).toEqual(['zone2Long']);
    expect(sessionTypesFor(plan, 12, 'tue', C)).toEqual(['testDriftVertical']);
    expect(sessionTypesFor(plan, 12, 'sat', C)).toEqual(['longDayTest']);
    expect(sessionTypesFor(plan, 11, 'sat', C)).toEqual(['longHike']);
  });
  it('week 8 retest only when intervals are still off', () => {
    expect(sessionTypesFor(plan, 8, 'tue', C)).toEqual(['testDriftRetest']);
    expect(sessionTypesFor(plan, 8, 'tue', ON)).toEqual(['zone2Long']);
    const tue = sessionsFor(plan, 8, 'tue', ON)[0];
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
    expect(resolveSession(plan, 4, 'mon', 'zone2Incline', C).cardio!.minutes).toEqual([20, 30]);
    expect(resolveSession(plan, 4, 'tue', 'zone2Long', C).cardio!.minutes).toEqual([40, 60]);
    // Week 8 is block 2: main lifts 4 × 4, then the cut.
    expect(exercise(8, 'mon', 'strengthA', 'back-squat')).toMatchObject({ sets: 3, reps: '4' });
  });
  it('lighter weeks do not cut the hike, Sunday or Thursday again', () => {
    expect(resolveSession(plan, 4, 'sat', 'longHike', C)).toMatchObject({ adjustment: 'none', target: '2 h with a 6 kg pack' });
    expect(resolveSession(plan, 4, 'sun', 'recovery', C).target).toBe('45 min easy walk');
    expect(resolveSession(plan, 4, 'thu', 'me', C).adjustment).toBe('none');
  });
  it('week 12 halves Monday to Wednesday gym work, rounded up', () => {
    expect(exercise(12, 'mon', 'strengthA', 'back-squat')).toMatchObject({ sets: 2, reps: '4' });
    expect(exercise(12, 'mon', 'strengthA', 'sl-rdl').sets).toBe(2);
    expect(resolveSession(plan, 12, 'wed', 'zone2Stairs', C).cardio!.minutes).toEqual([15, 25]);
    expect(resolveSession(plan, 12, 'sat', 'longDayTest', C).adjustment).toBe('none');
  });
  it('intervals only show in weeks 5–7 once unlocked', () => {
    expect(resolveSession(plan, 5, 'tue', 'zone2Long', C)).toMatchObject({ intervalsLocked: 4 });
    expect(resolveSession(plan, 5, 'tue', 'zone2Long', ON)).toMatchObject({ intervals: 4 });
    expect(resolveSession(plan, 7, 'tue', 'zone2Long', ON).intervals).toBe(6);
    expect(resolveSession(plan, 9, 'tue', 'zone2Long', ON).intervals).toBeUndefined();
  });
});

describe('one-off swaps', () => {
  it('uses the swap\'s own dose with the block rules and week cuts', () => {
    const swap = (week: number, id: string) => resolveSwap(plan, week, 'mon', 'strengthA', id, C)!;
    expect(swap(1, 'lat-pulldown')).toMatchObject({ name: 'Lat pulldown', sets: 4, reps: '5–6' });
    expect(swap(5, 'lat-pulldown')).toMatchObject({ sets: 4, reps: '4' }); // main lift, block 2
    expect(swap(5, 'inverted-rows')).toMatchObject({ sets: 4, reps: '8' }); // accessory
    expect(swap(4, 'lat-pulldown')).toMatchObject({ sets: 3, originalSets: 4 }); // lighter week
    expect(swap(12, 'lat-pulldown')).toMatchObject({ sets: 2, reps: '4' }); // block 3, halved
    expect(resolveSwap(plan, 1, 'mon', 'strengthA', 'nope', C)).toBeNull();
  });
});

// ---------- Rule 7: my changes ----------

let seq = 0;
const rec = (override: PlanOverride, createdAt = `2026-11-16T10:00:${String(++seq).padStart(2, '0')}Z`): OverrideRecord => ({
  id: `o${seq}`,
  createdAt,
  override,
});
const eff = (...records: OverrideRecord[]) => buildEffectivePlan(plan, records);
const ex = (p: typeof plan, week: number, day: 'mon' | 'wed', type: 'strengthA' | 'strengthB', slot: string) =>
  resolveSession(p, week, day, type, C).exercises!.find((e) => e.slotId === slot)!;

describe('effective plan (rule 7)', () => {
  it('with no changes it behaves exactly like plan.json', () => {
    const p = eff();
    for (const week of [1, 4, 5, 8, 12]) {
      for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const) {
        expect(sessionsFor(p, week, day, C)).toEqual(sessionsFor(plan, week, day, C));
      }
    }
    expect(dateOf(p, 6, 'mon')).toBe(dateOf(plan, 6, 'mon'));
  });

  it('edits an exercise from a week on, after the block rules, and still cuts lighter weeks', () => {
    const p = eff(rec({ kind: 'editExercise', scope: { fromWeek: 3 }, sessionType: 'strengthA', exerciseId: 'back-squat', changes: { sets: 3 } }));
    expect(ex(p, 2, 'mon', 'strengthA', 'back-squat')).toMatchObject({ sets: 4, reps: '5' });
    expect(ex(p, 3, 'mon', 'strengthA', 'back-squat')).toMatchObject({ sets: 3, reps: '5' });
    expect(ex(p, 4, 'mon', 'strengthA', 'back-squat')).toMatchObject({ sets: 2, originalSets: 3 }); // lighter week
    expect(ex(p, 5, 'mon', 'strengthA', 'back-squat')).toMatchObject({ sets: 3, reps: '4' }); // block 2 reps, my sets
  });

  it('lets a this-week-only change beat a permanent one, whatever order they were made in', () => {
    const p = eff(
      rec({ kind: 'editExercise', scope: { week: 3 }, sessionType: 'strengthA', exerciseId: 'back-squat', changes: { sets: 2 } }),
      rec({ kind: 'editExercise', scope: { fromWeek: 1 }, sessionType: 'strengthA', exerciseId: 'back-squat', changes: { sets: 5, targetKg: 90 } }),
    );
    expect(ex(p, 3, 'mon', 'strengthA', 'back-squat')).toMatchObject({ sets: 2, targetKg: 90 });
    expect(ex(p, 2, 'mon', 'strengthA', 'back-squat')).toMatchObject({ sets: 5, targetKg: 90 });
  });

  it('does not cut a set count I chose for that week only', () => {
    const p = eff(rec({ kind: 'editExercise', scope: { week: 4 }, sessionType: 'strengthA', exerciseId: 'back-squat', changes: { sets: 4 } }));
    expect(ex(p, 4, 'mon', 'strengthA', 'back-squat')).toMatchObject({ sets: 4, originalSets: 4 });
  });

  it('clears a target kg and a note', () => {
    const p = eff(
      rec({ kind: 'editExercise', scope: { fromWeek: 1 }, sessionType: 'strengthA', exerciseId: 'lateral-step-downs', changes: { targetKg: 10, note: '' } }),
      rec({ kind: 'editExercise', scope: { fromWeek: 2 }, sessionType: 'strengthA', exerciseId: 'lateral-step-downs', changes: { targetKg: null } }),
    );
    expect(ex(p, 1, 'mon', 'strengthA', 'lateral-step-downs')).toMatchObject({ targetKg: 10 });
    expect(ex(p, 1, 'mon', 'strengthA', 'lateral-step-downs').note).toBeUndefined();
    expect(ex(p, 2, 'mon', 'strengthA', 'lateral-step-downs').targetKg).toBeUndefined();
  });

  it('replaces an exercise in its slot, with its own block rules, and edits follow the new id', () => {
    const lat = plan.exerciseLibrary.find((e) => e.id === 'lat-pulldown')!;
    const p = eff(
      rec({ kind: 'replaceExercise', scope: { fromWeek: 2 }, sessionType: 'strengthA', exerciseId: 'weighted-pull-ups', with: lat }),
      rec({ kind: 'editExercise', scope: { fromWeek: 1 }, sessionType: 'strengthA', exerciseId: 'lat-pulldown', changes: { targetKg: 60 } }),
    );
    expect(ex(p, 1, 'mon', 'strengthA', 'weighted-pull-ups')).toMatchObject({ id: 'weighted-pull-ups' });
    expect(ex(p, 2, 'mon', 'strengthA', 'weighted-pull-ups')).toMatchObject({ id: 'lat-pulldown', sets: 4, reps: '5–6', targetKg: 60 });
    expect(ex(p, 5, 'mon', 'strengthA', 'weighted-pull-ups')).toMatchObject({ id: 'lat-pulldown', reps: '4' }); // main lift
    const custom = { id: 'custom-ring-rows', name: 'Ring rows', sets: 3, reps: '10' };
    const q = eff(
      rec({ kind: 'replaceExercise', scope: { fromWeek: 1 }, sessionType: 'strengthA', exerciseId: 'weighted-pull-ups', with: lat }),
      rec({ kind: 'replaceExercise', scope: { week: 6 }, sessionType: 'strengthA', exerciseId: 'weighted-pull-ups', with: custom }),
    );
    expect(ex(q, 6, 'mon', 'strengthA', 'weighted-pull-ups')).toMatchObject({ name: 'Ring rows', sets: 3, reps: '10' });
    expect(ex(q, 7, 'mon', 'strengthA', 'weighted-pull-ups')).toMatchObject({ name: 'Lat pulldown' });
  });

  it('moves all of a day\'s sessions, stacking after the target day\'s own', () => {
    const p = eff(rec({ kind: 'moveDay', week: 6, from: 'sat', to: 'sun' }));
    expect(sessionTypesFor(p, 6, 'sat', C)).toEqual(['rest']);
    expect(sessionTypesFor(p, 6, 'sun', C)).toEqual(['recovery', 'longHike']);
    expect(sessionTypesFor(p, 5, 'sat', C)).toEqual(['longHike']);
    const mon = eff(rec({ kind: 'moveDay', week: 3, from: 'mon', to: 'tue' }));
    expect(sessionTypesFor(mon, 3, 'tue', C)).toEqual(['zone2Long', 'strengthA', 'zone2Incline']);
  });

  it('replaces Friday\'s rest when a day is moved onto it, and keeps the original day\'s rules', () => {
    const p = eff(rec({ kind: 'moveDay', week: 12, from: 'mon', to: 'fri' }));
    expect(sessionTypesFor(p, 12, 'fri', C)).toEqual(['strengthA', 'zone2Incline']);
    expect(slotsFor(p, 12, C).fri[0].from).toBe('mon');
    // Week 12 Monday strength is halved; moving it to Friday doesn't change that.
    expect(ex(p, 12, 'fri' as 'mon', 'strengthA', 'back-squat')).toMatchObject({ sets: 2 });
    const sat = eff(rec({ kind: 'moveDay', week: 12, from: 'tue', to: 'sat' }));
    expect(sessionTypesFor(sat, 12, 'sat', C)).toEqual(['longDayTest', 'testDriftVertical']);
  });

  it('applies moves in order, and ignores moving a rest day', () => {
    const p = eff(
      rec({ kind: 'moveDay', week: 2, from: 'fri', to: 'mon' }),
      rec({ kind: 'moveDay', week: 2, from: 'thu', to: 'fri' }),
      rec({ kind: 'moveDay', week: 2, from: 'fri', to: 'sat' }),
    );
    expect(sessionTypesFor(p, 2, 'mon', C)).toEqual(['strengthA', 'zone2Incline']);
    expect(sessionTypesFor(p, 2, 'thu', C)).toEqual(['rest']);
    expect(sessionTypesFor(p, 2, 'fri', C)).toEqual(['rest']);
    expect(sessionTypesFor(p, 2, 'sat', C)).toEqual(['longHike', 'me']);
  });

  it('edits a week\'s targets', () => {
    const p = eff(rec({ kind: 'weekTargets', week: 6, changes: { longHike: { hours: '3.5 h', packKg: '12 kg' }, sunday: '1 h easy walk' } }));
    expect(resolveSession(p, 6, 'sat', 'longHike', C).target).toBe('3.5 h with a 12 kg pack');
    expect(resolveSession(p, 6, 'sun', 'recovery', C).target).toBe('1 h easy walk');
    expect(resolveSession(p, 7, 'sat', 'longHike', C).target).toBe('3.5 h with a 10 kg pack');
    expect(p.weeks[5].notes).toBe(plan.weeks[5].notes);
  });

  it('pauses whole weeks from the override list', () => {
    const p = eff(rec({ kind: 'pause', fromWeek: 6, weeks: 1 }));
    expect(weekStartDate(p, 5)).toBe('2026-12-14');
    expect(weekStartDate(p, 6)).toBe('2026-12-28');
    expect(positionOn(p, '2026-12-23')).toMatchObject({ status: 'paused', nextWeek: 6, resumesOn: '2026-12-28' });
    expect(positionOn(p, '2027-02-08')).toMatchObject({ status: 'active', week: 12, day: 'mon' });
  });

  it('done when: move Saturday\'s hike to Sunday, change squat sets and pause a week, then reset all three', () => {
    const changed = eff(
      rec({ kind: 'moveDay', week: 1, from: 'sat', to: 'sun' }),
      rec({ kind: 'editExercise', scope: { fromWeek: 1 }, sessionType: 'strengthA', exerciseId: 'back-squat', changes: { sets: 3 } }),
      rec({ kind: 'pause', fromWeek: 2, weeks: 1 }),
    );
    expect(sessionTypesFor(changed, 1, 'sun', C)).toEqual(['recovery', 'longHike']);
    expect(ex(changed, 1, 'mon', 'strengthA', 'back-squat').sets).toBe(3);
    expect(dateOf(changed, 2, 'mon')).toBe('2026-11-30');
    const reset = eff();
    expect(sessionTypesFor(reset, 1, 'sun', C)).toEqual(['recovery']);
    expect(ex(reset, 1, 'mon', 'strengthA', 'back-squat').sets).toBe(4);
    expect(dateOf(reset, 2, 'mon')).toBe('2026-11-23');
  });

  it('applies overrides in createdAt order, not storage order', () => {
    const later = rec({ kind: 'editExercise', scope: { fromWeek: 1 }, sessionType: 'strengthA', exerciseId: 'back-squat', changes: { sets: 5 } }, '2026-11-20T00:00:00Z');
    const earlier = rec({ kind: 'editExercise', scope: { fromWeek: 1 }, sessionType: 'strengthA', exerciseId: 'back-squat', changes: { sets: 2 } }, '2026-11-18T00:00:00Z');
    expect(ex(eff(later, earlier), 1, 'mon', 'strengthA', 'back-squat').sets).toBe(5);
  });
});

describe('start date (milestone 4)', () => {
  const start = (date: string, createdAt = '2026-11-20T00:00:00Z') => rec({ kind: 'startDate', date }, createdAt);

  it('moves every week and date to the new start', () => {
    const p = eff(start('2027-02-15'));
    expect(p.startDate).toBe('2027-02-15');
    expect(positionOn(p, '2026-11-16')).toMatchObject({ status: 'before', startDate: '2027-02-15' });
    expect(positionOn(p, '2027-02-15')).toMatchObject({ status: 'active', week: 1, day: 'mon' });
    expect(positionOn(p, '2027-03-22')).toMatchObject({ status: 'active', week: 6, day: 'mon' });
    expect(dateOf(p, 12, 'sun')).toBe('2027-05-09');
    expect(positionOn(p, '2027-05-10')).toMatchObject({ status: 'complete', endedOn: '2027-05-09' });
  });

  it('the latest one wins, and pauses still push it back', () => {
    const p = eff(start('2027-03-01', '2026-11-21T00:00:00Z'), start('2027-02-15', '2026-11-20T00:00:00Z'), rec({ kind: 'pause', fromWeek: 2, weeks: 1 }));
    expect(p.startDate).toBe('2027-03-01');
    expect(weekStartDate(p, 2)).toBe('2027-03-15');
  });

  it('reset (no override) goes back to plan.json', () => {
    expect(eff().startDate).toBe(plan.startDate);
    expect(eff().startDate).toBe('2026-11-16');
  });

  it('Friday is still rest', () => {
    const p = eff(start('2027-02-15'));
    for (let w = 1; w <= 12; w++) expect(weekdayOf(dateOf(p, w, 'fri'))).toBe('fri');
    expect(positionOn(p, '2027-02-19')).toMatchObject({ day: 'fri' });
    expect(sessionTypesFor(p, 1, 'fri', C)).toEqual(['rest']);
  });
});

describe('rules come from plan.json (milestone 8)', () => {
  it('the 12-week plan spells out its block rules, and without them nothing changes', () => {
    expect(plan.rules).toMatchObject({ lighterCut: true, testWeekHalve: true, mainLifts: { '2': { sets: 4, reps: '4' }, '3': { sets: 3, reps: '4' } } });
    const bare = { ...plan, rules: {} };
    const squat = (p: typeof plan, week: number) =>
      resolveSession(p, week, 'mon', 'strengthA', DEFAULT_CONTEXT).exercises!.find((e) => e.id === 'back-squat')!;
    expect(squat(plan, 5)).toMatchObject({ sets: 4, reps: '4' });
    expect(squat(bare, 5)).toMatchObject({ sets: 4, reps: '5' });
    expect(squat(plan, 8).sets).toBe(3); // lighter week cut
    expect(squat(bare, 8)).toMatchObject({ sets: 4, reps: '5' });
    expect(resolveSession(bare, 12, 'mon', 'zone2Incline', DEFAULT_CONTEXT).cardio!.minutes).toEqual([30, 45]);
  });

  it('every session has a kind, and behaviour follows the kind, not the name', () => {
    for (const t of Object.values(plan.templates)) expect(t.kind).toBeTruthy();
    expect(kindOf(plan, 'longDayTest')).toBe('hikeTest');
    expect(kindOf(plan, 'nope')).toBe('rest');
  });
});
