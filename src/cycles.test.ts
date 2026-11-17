import { describe, expect, it } from 'vitest';
import rawPlan from './data/plan.json';
import { parsePlan, type Plan } from './schema';
import { AppDataSchema, emptyAppData, type AppData, type Cycle } from './logSchema';
import {
  activateCycle,
  activePlan,
  addCycle,
  addExercise,
  addSession,
  addSwap,
  blankPlan,
  copyPlan,
  dayText,
  defaultCycleStart,
  deleteCycle,
  deleteExercise,
  deleteSession,
  deleteSwap,
  moveExercise,
  newExerciseId,
  newSessionId,
  planEnd,
  planProblems,
  sessionSummary,
  setPatternDay,
  setWeekCount,
  setWeekDay,
  updateCycle,
  updateExercise,
  updateRules,
  updateSession,
  updateWeek,
} from './cycles';
import { addOverride, listOverrides, resetAllOverrides } from './overrides';
import {
  buildEffectivePlan,
  DEFAULT_CONTEXT,
  positionOn,
  resolveSession,
  sessionTypesFor,
  totalWeeks,
  type Context,
} from './plan';

const builtIn = parsePlan(rawPlan);
const NOW = '2026-11-17T09:00:00.000Z';
const ON: Context = { intervals: { on: true, gap: 8 } };

function cycle(plan: Plan, id = 'c1'): Cycle {
  return { id, name: plan.name ?? 'Cycle', createdAt: NOW, savedAt: NOW, plan };
}

/** A small 4-week cycle built from scratch: Strength C on Monday and Thursday, a hike on Saturday. */
function scratch(): Plan {
  let p = blankPlan('2027-02-08', 'Spring cycle');
  let r = addSession(p, 'Strength C', 'strength');
  p = r.plan;
  const strength = r.id;
  p = addExercise(p, strength, { name: 'Back squat', sets: 5, reps: '5', mainLift: true });
  p = addExercise(p, strength, { name: 'Step-ups', sets: 3, reps: '10 per leg' });
  r = addSession(p, 'Hill hike', 'hike');
  p = r.plan;
  p = setPatternDay(p, 'mon', [strength]);
  p = setPatternDay(p, 'thu', [strength]);
  p = setPatternDay(p, 'sat', [r.id]);
  p = updateWeek(p, 1, { longHike: { hours: '3 h', packKg: '8 kg' } });
  return p;
}

describe('making cycles', () => {
  it('a blank plan can be used: 4 weeks, every day rest, no rules', () => {
    const p = blankPlan('2027-02-08', 'Blank');
    expect(planProblems(p)).toEqual([]);
    expect(totalWeeks(p)).toBe(4);
    expect(sessionTypesFor(p, 1, 'mon', DEFAULT_CONTEXT)).toEqual(['rest']);
  });

  it('a copy of the 12-week plan keeps its ids and rules and has no problems', () => {
    const p = copyPlan(builtIn, '2027-02-08', 'Round 2');
    expect(planProblems(p)).toEqual([]);
    expect(p.name).toBe('Round 2');
    expect(p.startDate).toBe('2027-02-08');
    expect(Object.keys(p.templates)).toEqual(Object.keys(builtIn.templates));
    expect(p.rules).toEqual(builtIn.rules);
    // A deep copy: editing it leaves the built-in plan alone.
    p.templates.strengthA.exercises![0].sets = 9;
    expect(builtIn.templates.strengthA.exercises![0].sets).toBe(4);
  });

  it('a new cycle starts the Monday after the plan in use ends', () => {
    expect(planEnd(builtIn)).toBe('2027-02-07');
    expect(defaultCycleStart(builtIn, '2026-11-17')).toBe('2027-02-08');
    // With a 1-week pause the plan ends a week later.
    const paused = buildEffectivePlan(builtIn, [
      { id: 'p', createdAt: NOW, override: { kind: 'pause', fromWeek: 3, weeks: 1 } },
    ]);
    expect(defaultCycleStart(paused, '2026-11-17')).toBe('2027-02-15');
    // Already past the end: next Monday.
    expect(defaultCycleStart(builtIn, '2027-03-03')).toBe('2027-03-08');
  });

  it('ids come from names, unique, and match the 12-week plan where the name does', () => {
    expect(newExerciseId('Back squat', [])).toBe('back-squat');
    expect(newExerciseId('Back squat', ['back-squat'])).toBe('back-squat-2');
    expect(newExerciseId('Páso', [])).toBe('paso');
    expect(newSessionId(builtIn, 'Strength C')).toBe('strength-c');
    expect(newSessionId(builtIn, '3 hills')).toBe('s-3-hills');
    expect(newSessionId(builtIn, '!!!')).toBe('session');
  });
});

describe('editing a cycle', () => {
  it('builds a usable plan from scratch', () => {
    const p = scratch();
    expect(planProblems(p)).toEqual([]);
    expect(dayText(p, p.weekly.mon)).toBe('Strength C');
    expect(dayText(p, p.weekly.fri)).toBe('Rest');
    const s = resolveSession(p, 1, 'mon', 'strength-c', DEFAULT_CONTEXT);
    expect(s.kind).toBe('strength');
    expect(s.exercises!.map((e) => [e.id, e.sets, e.reps])).toEqual([
      ['back-squat', 5, '5'],
      ['step-ups', 3, '10 per leg'],
    ]);
    expect(resolveSession(p, 1, 'sat', 'hill-hike', DEFAULT_CONTEXT).target).toBe('3 h with a 8 kg pack');
  });

  it('lists problems in plain words and refuses to use a cycle that has them', () => {
    let p = addSession(blankPlan('2027-02-08', 'X'), 'Strength C', 'strength').plan;
    expect(planProblems(p)).toEqual(['Strength C has no exercises.']);
    p = { ...p, startDate: '2027-02-09' };
    expect(planProblems(p)).toContain('The plan has to start on a Monday.');
    const data = addCycle(emptyAppData(), cycle(p));
    expect(activateCycle(data, 'c1').activeCycle).toBeNull();
    expect(activateCycle(addCycle(emptyAppData(), cycle(scratch())), 'c1').activeCycle).toBe('c1');
  });

  it('deleting a session takes it off every day and every week', () => {
    let p = scratch();
    p = setWeekDay(p, 2, 'tue', ['strength-c']);
    p = deleteSession(p, 'strength-c');
    expect(p.templates['strength-c']).toBeUndefined();
    expect(p.weekly.mon).toEqual(['rest']);
    expect(p.weeks[1].dayChanges).toEqual({ tue: ['rest'] });
    expect(planProblems(p)).toEqual([]);
    expect(deleteSession(p, 'rest')).toBe(p);
  });

  it('a replacement for "only while intervals are off" is cleared when that session goes', () => {
    let p = scratch();
    const z = addSession(p, 'Zone 2', 'cardio');
    p = addSession(z.plan, 'Retest', 'test').plan;
    p = updateSession(p, 'retest', { tests: ['drift'], onlyIfIntervalsOff: 'zone-2' });
    p = setPatternDay(p, 'tue', ['retest']);
    expect(sessionTypesFor(p, 1, 'tue', ON)).toEqual(['zone-2']);
    expect(sessionTypesFor(p, 1, 'tue', DEFAULT_CONTEXT)).toEqual(['retest']);
    p = deleteSession(p, 'zone-2');
    expect(p.templates.retest.onlyIfIntervalsOff).toBeUndefined();
  });

  it('Friday stays rest and an empty day is rest', () => {
    const p = scratch();
    expect(setPatternDay(p, 'fri', ['strength-c'])).toBe(p);
    expect(setPatternDay(p, 'mon', []).weekly.mon).toEqual(['rest']);
    expect(setWeekDay(p, 1, 'fri', ['strength-c'])).toBe(p);
  });

  it('week day changes override the pattern and can go back to it', () => {
    let p = setWeekDay(scratch(), 3, 'mon', ['hill-hike']);
    expect(sessionTypesFor(p, 3, 'mon', DEFAULT_CONTEXT)).toEqual(['hill-hike']);
    expect(sessionTypesFor(p, 2, 'mon', DEFAULT_CONTEXT)).toEqual(['strength-c']);
    p = setWeekDay(p, 3, 'mon', null);
    expect(p.weeks[2].dayChanges).toBeUndefined();
  });

  it('exercises: edit keeps the id, move and delete', () => {
    let p = scratch();
    p = updateExercise(p, 'strength-c', 'back-squat', { name: 'Front squat', sets: 4, reps: '6', note: '  ' });
    expect(p.templates['strength-c'].exercises![0]).toEqual({ id: 'back-squat', name: 'Front squat', sets: 4, reps: '6' });
    p = moveExercise(p, 'strength-c', 'step-ups', -1);
    expect(p.templates['strength-c'].exercises!.map((e) => e.id)).toEqual(['step-ups', 'back-squat']);
    expect(moveExercise(p, 'strength-c', 'step-ups', -1).templates['strength-c'].exercises![0].id).toBe('step-ups');
    p = deleteExercise(p, 'strength-c', 'step-ups');
    expect(p.templates['strength-c'].exercises!.map((e) => e.id)).toEqual(['back-squat']);
  });

  it('swap library: an exercise can offer a swap; deleting the swap takes it off', () => {
    let p = addSwap(scratch(), { name: 'Goblet squat', sets: 3, reps: '10' });
    p = updateExercise(p, 'strength-c', 'back-squat', { name: 'Back squat', sets: 5, reps: '5', swaps: ['goblet-squat'] });
    expect(planProblems(p)).toEqual([]);
    p = deleteSwap(p, 'goblet-squat');
    expect(p.exerciseLibrary).toEqual([]);
    expect(p.templates['strength-c'].exercises![0].swaps).toBeUndefined();
  });

  it('weeks: added weeks copy the last one without its day changes or notes', () => {
    let p = updateWeek(scratch(), 4, { block: 2, kind: 'lighter', notes: 'Easy', sunday: '1 h walk' });
    p = setWeekDay(p, 4, 'tue', ['strength-c']);
    p = setWeekCount(p, 6);
    expect(p.weeks.map((w) => w.week)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(p.weeks[5]).toMatchObject({ week: 6, block: 2, kind: 'lighter', notes: '', sunday: '1 h walk' });
    expect(p.weeks[5].dayChanges).toBeUndefined();
    expect(setWeekCount(p, 2).weeks).toHaveLength(2);
    expect(setWeekCount(p, 0).weeks).toHaveLength(1);
    expect(setWeekCount(p, 99).weeks).toHaveLength(24);
  });

  it('summaries in plain words', () => {
    const p = scratch();
    expect(sessionSummary(p.templates['strength-c'])).toBe('2 exercises');
    expect(sessionSummary(builtIn.templates.zone2Long)).toBe('60–90 min, Zone 2, intervals');
    expect(sessionSummary(builtIn.templates.testDriftVertical)).toBe('Drift and vertical');
    expect(sessionSummary(builtIn.templates.longHike)).toBe('Target from each week');
  });
});

describe('rules as data (milestone 8)', () => {
  it('without rules, block numbers and lighter weeks change nothing', () => {
    let p = updateWeek(scratch(), 2, { block: 2, kind: 'lighter' });
    const s = resolveSession(p, 2, 'mon', 'strength-c', DEFAULT_CONTEXT);
    expect(s.adjustment).toBe('none');
    expect(s.exercises![0]).toMatchObject({ sets: 5, reps: '5' });
    // Switch the rules on: main lifts 4 × 4 in block 2, and a third off in lighter weeks.
    p = updateRules(p, { mainLifts: { '2': { sets: 4, reps: '4' } }, lighterCut: true });
    const t = resolveSession(p, 2, 'mon', 'strength-c', DEFAULT_CONTEXT);
    expect(t.adjustment).toBe('lighter');
    expect(t.exercises![0]).toMatchObject({ originalSets: 4, sets: 3, reps: '4' });
    expect(t.exercises![1]).toMatchObject({ originalSets: 3, sets: 2 });
  });

  it('test-week halving only happens with the rule, Monday to Thursday', () => {
    let p = updateWeek(scratch(), 4, { kind: 'test' });
    expect(resolveSession(p, 4, 'mon', 'strength-c', DEFAULT_CONTEXT).adjustment).toBe('none');
    p = updateRules(p, { testWeekHalve: true });
    expect(resolveSession(p, 4, 'mon', 'strength-c', DEFAULT_CONTEXT).exercises![0].sets).toBe(3);
    expect(resolveSession(p, 4, 'thu', 'strength-c', DEFAULT_CONTEXT).adjustment).toBe('halved');
  });

  it('empty rules are dropped', () => {
    const p = updateRules(scratch(), { mainLifts: {}, lighterCut: false });
    expect(p.rules).toEqual({});
  });

  it('a cycle of any length: complete after its last week', () => {
    const p = setWeekCount(scratch(), 6);
    expect(positionOn(p, '2027-03-21')).toMatchObject({ status: 'active', week: 6, day: 'sun' });
    expect(positionOn(p, '2027-03-22')).toEqual({ status: 'complete', endedOn: '2027-03-21' });
  });

  it('only sessions with the intervals flag get the week intervals', () => {
    let p = addSession(scratch(), 'Zone 2', 'cardio').plan;
    p = updateWeek(p, 1, { intervals: 5 });
    expect(resolveSession(p, 1, 'tue', 'zone-2', ON).intervals).toBeUndefined();
    p = updateSession(p, 'zone-2', { intervals: true });
    expect(resolveSession(p, 1, 'tue', 'zone-2', ON).intervals).toBe(5);
  });
});

describe('the cycle in use', () => {
  const withCycle = (): AppData => addCycle(emptyAppData(), cycle(scratch()));

  it('none: the 12-week plan', () => {
    const a = activePlan(builtIn, emptyAppData());
    expect(a).toMatchObject({ plan: builtIn, cycle: null, broken: false });
  });

  it('an active cycle is the plan; a broken one falls back to the 12-week plan', () => {
    const data = activateCycle(withCycle(), 'c1');
    const a = activePlan(builtIn, data);
    expect(a.cycle?.id).toBe('c1');
    expect(a.plan.name).toBe('Spring cycle');
    const broken = updateCycle(data, 'c1', (p) => ({ ...p, startDate: '2027-02-10' }), NOW);
    const b = activePlan(builtIn, broken);
    expect(b.broken).toBe(true);
    expect(b.plan).toBe(builtIn);
  });

  it('plan changes belong to the cycle they were made in', () => {
    let data = addOverride(emptyAppData(), { kind: 'pause', fromWeek: 2, weeks: 1 }, 'a', NOW);
    data = activateCycle(addCycle(data, cycle(scratch())), 'c1');
    data = addOverride(data, { kind: 'moveDay', week: 1, from: 'mon', to: 'tue' }, 'b', NOW);
    expect(data.overrides.find((o) => o.id === 'b')?.cycleId).toBe('c1');
    expect(listOverrides(data).map((o) => o.id)).toEqual(['b']);
    expect(activePlan(builtIn, data).overrides.map((o) => o.id)).toEqual(['b']);
    // Reset all only resets this cycle's changes.
    expect(resetAllOverrides(data).overrides.map((o) => o.id)).toEqual(['a']);
    // Back on the 12-week plan, its own change is there again.
    const back = activateCycle(data, null);
    expect(listOverrides(back).map((o) => o.id)).toEqual(['a']);
  });

  it('deleting a cycle deletes its changes and goes back to the 12-week plan', () => {
    let data = activateCycle(withCycle(), 'c1');
    data = addOverride(data, { kind: 'pause', fromWeek: 2, weeks: 1 }, 'b', NOW);
    data = deleteCycle(data, 'c1');
    expect(data).toMatchObject({ cycles: [], overrides: [], activeCycle: null });
  });

  it('updateCycle keeps the name in step with the plan and stamps savedAt', () => {
    const data = updateCycle(withCycle(), 'c1', (p) => ({ ...p, name: 'Summer' }), '2026-12-01T00:00:00.000Z');
    expect(data.cycles[0]).toMatchObject({ name: 'Summer', savedAt: '2026-12-01T00:00:00.000Z' });
  });

  it('data saved before milestone 8 still loads, with no cycles', () => {
    const old = { version: 1, logs: [], overrides: [], tests: [], trips: [], gear: [] };
    expect(AppDataSchema.parse(old)).toMatchObject({ cycles: [], activeCycle: null });
  });

  it('a stored cycle survives a round trip through the schema', () => {
    const data = activateCycle(withCycle(), 'c1');
    expect(AppDataSchema.parse(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });
});
