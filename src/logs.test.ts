import { describe, expect, it } from 'vitest';
import rawPlan from './data/plan.json';
import { parsePlan, type Exercise } from './schema';
import { emptyAppData, type LoggedSet, type SessionLog } from './logSchema';
import { DEFAULT_CONTEXT, getWeek, kindOf, resolveSession } from './plan';
import {
  cardioPrefill,
  dayStatus,
  deleteLog,
  formatSets,
  lastSetsFor,
  lastTimeText,
  logFor,
  logKind,
  logSummary,
  lowerKg,
  parseReps,
  prefillSets,
  upperMinutes,
  upsertLog,
  zoneFrom,
} from './logs';

const plan = parsePlan(rawPlan);
const C = DEFAULT_CONTEXT;

const squat: Exercise = { id: 'back-squat', name: 'Back squat', sets: 4, reps: '5', mainLift: true };

function sets(exerciseId: string, rows: [number, number | null][], name = exerciseId): LoggedSet[] {
  return rows.map(([reps, kg], i) => ({ exerciseId, exerciseName: name, setNumber: i + 1, reps, unit: 'reps', kg }));
}

let n = 0;
function log(partial: Partial<SessionLog> & Pick<SessionLog, 'date' | 'type'>): SessionLog {
  n++;
  return { id: `log-${n}`, week: 1, status: 'done', savedAt: `2026-11-16T10:00:${String(n).padStart(2, '0')}Z`, ...partial };
}

describe('parseReps', () => {
  it.each([
    ['5', 5, 'reps'],
    ['8 per leg', 8, 'reps'],
    ['5–6', 5, 'reps'],
    ['30 s per side', 30, 's'],
    ['40 m', 40, 'm'],
    ['10 per side', 10, 'reps'],
  ])('%s → %d %s', (reps, value, unit) => {
    expect(parseReps(reps)).toEqual({ value, unit });
  });
});

describe('lastSetsFor', () => {
  const logs = [
    log({ date: '2026-11-09', type: 'strengthA', sets: sets('back-squat', [[5, 75]]) }),
    log({ date: '2026-11-16', type: 'strengthA', sets: sets('back-squat', [[5, 80], [5, 80]]) }),
    log({ date: '2026-11-23', type: 'strengthA', status: 'skipped' }),
    log({ date: '2026-11-30', type: 'strengthA', sets: sets('back-squat', [[5, 90]]) }),
    log({ date: '2026-11-18', type: 'strengthA', status: 'skipped', sets: sets('back-squat', [[1, 200]]) }),
  ];

  it('picks the latest earlier date', () => {
    expect(lastSetsFor(logs, 'back-squat', '2026-11-23')).toEqual({
      date: '2026-11-16',
      sets: sets('back-squat', [[5, 80], [5, 80]]),
    });
  });
  it('ignores skipped logs and later dates', () => {
    expect(lastSetsFor(logs, 'back-squat', '2026-11-30')?.date).toBe('2026-11-16');
    expect(lastSetsFor(logs, 'back-squat', '2026-11-09')).toBeNull();
  });
  it('follows swap ids: the swap has its own history', () => {
    const swapped = [
      log({ date: '2026-11-16', type: 'strengthA', sets: sets('weighted-pull-ups', [[5, 10]]) }),
      log({
        date: '2026-11-23',
        type: 'strengthA',
        swaps: { 'weighted-pull-ups': 'lat-pulldown' },
        sets: sets('lat-pulldown', [[6, 55]]),
      }),
    ];
    expect(lastSetsFor(swapped, 'lat-pulldown', '2026-11-30')?.sets[0].kg).toBe(55);
    expect(lastSetsFor(swapped, 'weighted-pull-ups', '2026-11-30')?.date).toBe('2026-11-16');
  });
});

describe('prefillSets', () => {
  it('uses the planned reps and leaves kg empty with no history', () => {
    expect(prefillSets(squat, 4, [], '2026-11-16')).toEqual(Array(4).fill({ reps: 5, kg: null }));
  });
  it('uses the target kg when there is no history', () => {
    expect(prefillSets({ ...squat, targetKg: 70 }, 2, [], '2026-11-16')).toEqual(Array(2).fill({ reps: 5, kg: 70 }));
  });
  it('copies last time set by set', () => {
    const logs = [log({ date: '2026-11-16', type: 'strengthA', sets: sets('back-squat', [[5, 80], [5, 80], [5, 82.5], [4, 82.5]]) })];
    expect(prefillSets(squat, 4, logs, '2026-11-23')).toEqual([
      { reps: 5, kg: 80 },
      { reps: 5, kg: 80 },
      { reps: 5, kg: 82.5 },
      { reps: 4, kg: 82.5 },
    ]);
  });
  it('fills extra rows beyond last time with the last set', () => {
    const logs = [log({ date: '2026-11-16', type: 'strengthA', sets: sets('back-squat', [[5, 80], [4, 85]]) })];
    expect(prefillSets(squat, 4, logs, '2026-11-23')).toEqual([
      { reps: 5, kg: 80 },
      { reps: 4, kg: 85 },
      { reps: 4, kg: 85 },
      { reps: 4, kg: 85 },
    ]);
  });
  it('gives fewer rows than last time in a lighter week', () => {
    const logs = [log({ date: '2026-11-30', type: 'strengthA', sets: sets('back-squat', [[5, 80], [5, 80], [5, 80], [5, 80]]) })];
    expect(prefillSets(squat, 3, logs, '2026-12-07')).toHaveLength(3);
  });
  it('keeps a bodyweight set empty rather than inventing a load', () => {
    const logs = [log({ date: '2026-11-16', type: 'strengthA', sets: sets('back-squat', [[5, null]]) })];
    expect(prefillSets(squat, 1, logs, '2026-11-23')).toEqual([{ reps: 5, kg: null }]);
  });
});

describe('dayStatus', () => {
  const mon = ['strengthA', 'zone2Incline'] as const;
  const at = (a?: SessionLog['status'], b?: SessionLog['status']) => {
    const logs: SessionLog[] = [];
    if (a) logs.push(log({ date: '2026-11-16', type: 'strengthA', status: a }));
    if (b) logs.push(log({ date: '2026-11-16', type: 'zone2Incline', status: b }));
    return dayStatus(logs, '2026-11-16', [...mon]);
  };
  it('Monday with two sessions', () => {
    expect(at('done', 'done')).toBe('done');
    expect(at('skipped', 'skipped')).toBe('skipped');
    expect(at('done', undefined)).toBe('partial');
    expect(at('done', 'skipped')).toBe('partial');
    expect(at('partial', 'done')).toBe('partial');
    expect(at(undefined, 'partial')).toBe('partial');
    expect(at('skipped', undefined)).toBe('none');
    expect(at()).toBe('none');
  });
  it('rest days have no status', () => {
    expect(dayStatus([], '2026-11-20', ['rest'])).toBeNull();
  });
});

describe('upsertLog / deleteLog', () => {
  it('replaces the log for the same date and type, and never mutates', () => {
    const data = emptyAppData();
    const a = upsertLog(data, log({ date: '2026-11-16', type: 'strengthA', status: 'partial' }));
    const b = upsertLog(a, log({ date: '2026-11-16', type: 'zone2Incline' }));
    const c = upsertLog(b, log({ date: '2026-11-16', type: 'strengthA', status: 'done' }));
    expect(data.logs).toHaveLength(0);
    expect(c.logs).toHaveLength(2);
    expect(logFor(c.logs, '2026-11-16', 'strengthA')?.status).toBe('done');
    const d = deleteLog(c, logFor(c.logs, '2026-11-16', 'zone2Incline')!.id);
    expect(d.logs).toHaveLength(1);
    expect(c.logs).toHaveLength(2);
  });
});

describe('text', () => {
  it('formats sets, grouping identical ones', () => {
    expect(formatSets(sets('x', [[5, 80], [5, 80], [5, 80], [5, 80]]))).toBe('4 × 5 at 80 kg');
    expect(formatSets(sets('x', [[5, 80], [5, 80], [4, 82.5]]))).toBe('2 × 5 at 80 kg, 1 × 4 at 82.5 kg');
    expect(formatSets([{ exerciseId: 'p', exerciseName: 'P', setNumber: 1, reps: 30, unit: 's', kg: null }])).toBe('1 × 30 s');
  });
  it('writes the last-time line', () => {
    expect(lastTimeText({ date: '2026-11-09', sets: sets('x', [[5, 80], [5, 80]]) })).toBe('Last time: 2 × 5 at 80 kg, 9 Nov');
    expect(lastTimeText(null)).toBe('No previous log.');
  });
  it('summarises logs', () => {
    expect(logSummary(log({ date: '2026-11-16', type: 'strengthA', sets: [...sets('a', [[5, 1], [5, 1]]), ...sets('b', [[8, 2]])] }))).toBe(
      '2 exercises, 3 sets',
    );
    expect(logSummary(log({ date: '2026-11-16', type: 'longHike', minutes: 120, avgHr: 142, packKg: 8 }))).toBe(
      '120 min, avg HR 142, 8 kg',
    );
    expect(logSummary(log({ date: '2026-11-16', type: 'longHike', status: 'skipped' }))).toBe('');
  });
});

describe('cardio prefill', () => {
  it('reads durations, packs and zones from plan text', () => {
    expect(upperMinutes('1–1.5 h easy')).toBe(90);
    expect(upperMinutes('2.5 h')).toBe(150);
    expect(upperMinutes('45 min easy walk')).toBe(45);
    expect(upperMinutes('4 × 60 steps with a ~6.5 kg pack, 2 min rest, Zone 2')).toBeNull();
    expect(lowerKg('10–13 kg')).toBe(10);
    expect(lowerKg('Box step-ups (40–45 cm box): 4 × 60 steps with a ~6.5 kg pack')).toBe(6.5);
    expect(zoneFrom('Zone 2–3')).toBe(2);
    expect(zoneFrom('Zone 3')).toBe(3);
  });

  const prefill = (week: number, day: 'mon' | 'tue' | 'thu' | 'sat' | 'sun', type: Parameters<typeof resolveSession>[3]) =>
    cardioPrefill(resolveSession(plan, week, day, type, C), getWeek(plan, week));

  it('Zone 2: upper end after the lighter-week cut', () => {
    expect(prefill(1, 'mon', 'zone2Incline')).toMatchObject({ minutes: 45, effortZone: 2, packKg: null });
    expect(prefill(4, 'mon', 'zone2Incline').minutes).toBe(30);
  });
  it('Tuesday intervals weeks get the note placeholder', () => {
    expect(prefill(5, 'tue', 'zone2Long').notePlaceholder).toBe('Intervals done?');
    expect(prefill(3, 'tue', 'zone2Long').notePlaceholder).toBe('');
  });
  it('Thursday: pack from the plan, minutes only for the water carry', () => {
    expect(prefill(1, 'thu', 'me')).toMatchObject({ minutes: null, packKg: 6.5, effortZone: 2 });
    expect(prefill(5, 'thu', 'me')).toMatchObject({ packKg: 10, effortZone: 2 });
    expect(prefill(9, 'thu', 'me')).toMatchObject({ minutes: 75, packKg: 13, effortZone: 3 });
  });
  it('hike and recovery', () => {
    expect(prefill(2, 'sat', 'longHike')).toMatchObject({ minutes: 150, packKg: 6 });
    expect(prefill(5, 'sun', 'recovery')).toMatchObject({ minutes: 90, packKg: null });
    expect(prefill(12, 'sat', 'longDayTest').minutes).toBe(300);
  });
  it('knows which screen a session gets', () => {
    expect(logKind(kindOf(plan, 'strengthB'))).toBe('strength');
    expect(logKind(kindOf(plan, 'testThreshold'))).toBe('test');
    expect(logKind(kindOf(plan, 'longDayTest'))).toBe('test');
    expect(logKind(kindOf(plan, 'recovery'))).toBe('cardio');
    expect(logKind(kindOf(plan, 'rest'))).toBe('none');
  });
});
