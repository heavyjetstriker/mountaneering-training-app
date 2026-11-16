import { describe, expect, it } from 'vitest';
import rawPlan from './data/plan.json';
import { parsePlan } from './schema';
import { emptyAppData, AppDataSchema, type OverrideRecord, type PlanOverride } from './logSchema';
import { addOverride, customExerciseId, describeOverride, listOverrides, removeOverride, resetAllOverrides } from './overrides';

const plan = parsePlan(rawPlan);
const rec = (override: PlanOverride): OverrideRecord => ({ id: 'x', createdAt: '2026-11-16T10:00:00Z', override });
const say = (o: PlanOverride) => describeOverride(plan, rec(o));

describe('plan changes in plain words', () => {
  it('describes each kind', () => {
    expect(say({ kind: 'editExercise', scope: { fromWeek: 3 }, sessionType: 'strengthA', exerciseId: 'back-squat', changes: { sets: 3 } })).toBe(
      'Back squat: 4 × 5 → 3 × 5, from week 3',
    );
    expect(say({ kind: 'editExercise', scope: { week: 2 }, sessionType: 'strengthA', exerciseId: 'back-squat', changes: { targetKg: 85 } })).toBe(
      'Back squat: target 85 kg, week 2 only',
    );
    expect(say({ kind: 'moveDay', week: 6, from: 'sat', to: 'sun' })).toBe('Week 6: Saturday moved to Sunday');
    expect(say({ kind: 'pause', fromWeek: 6, weeks: 1 })).toBe('Plan paused 1 week from week 6');
    expect(say({ kind: 'pause', fromWeek: 7, weeks: 2 })).toBe('Plan paused 2 weeks from week 7');
    expect(
      say({ kind: 'weekTargets', week: 6, changes: { longHike: { hours: '3.5 h', packKg: '10 kg' }, notes: 'x' } }),
    ).toBe('Week 6: hike 3 h → 3.5 h, notes changed');
    expect(
      say({
        kind: 'replaceExercise',
        scope: { fromWeek: 2 },
        sessionType: 'strengthA',
        exerciseId: 'weighted-pull-ups',
        with: { id: 'lat-pulldown', name: 'Lat pulldown', sets: 4, reps: '5–6' },
      }),
    ).toBe('Strength A: Weighted pull-ups → Lat pulldown (4 × 5–6), from week 2');
  });

  it('adds, lists in createdAt order, resets one and resets all; the data stays valid', () => {
    let data = addOverride(emptyAppData(), { kind: 'pause', fromWeek: 6, weeks: 1 }, 'b', '2026-11-18T00:00:00Z');
    data = addOverride(data, { kind: 'moveDay', week: 1, from: 'sat', to: 'sun' }, 'a', '2026-11-17T00:00:00Z');
    expect(AppDataSchema.safeParse(data).success).toBe(true);
    expect(listOverrides(data).map((o) => o.id)).toEqual(['a', 'b']);
    expect(removeOverride(data, 'a').overrides.map((o) => o.id)).toEqual(['b']);
    expect(resetAllOverrides(data).overrides).toEqual([]);
    expect(data.overrides).toHaveLength(2);
  });

  it('makes stable ids for exercises I type in', () => {
    expect(customExerciseId('Ring rows')).toBe('custom-ring-rows');
    expect(customExerciseId('  Remo  à máquina! ')).toBe('custom-remo-a-maquina');
  });
});
