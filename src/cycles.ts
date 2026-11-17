// Training cycles (milestone 8): plans I build in the app, and the editing steps behind the
// plan editor. Pure functions only: every step takes a plan (or AppData) and returns a new one.
import { DAYS, MAX_WEEKS, PlanBaseSchema, PlanSchema, planIssues } from './schema';
import type { Day, Exercise, Plan, PlanRules, PlanWeek, SessionKind, SessionTemplate, SessionType } from './schema';
import type { AppData, Cycle, OverrideRecord } from './logSchema';
import { addDays, daysBetween, weekdayOf, type ISODate } from './dates';
import { totalWeeks, weekStartDate } from './plan';
import { activeOverrides } from './overrides';

export const BUILT_IN_NAME = '12-week plan';

// ---------- which plan is in use ----------

export interface ActivePlan {
  /** The plan every screen uses (before my plan changes are applied). */
  plan: Plan;
  /** The cycle in use; null = the 12-week plan. */
  cycle: Cycle | null;
  /** The active cycle is missing or has problems, so the 12-week plan is shown instead. */
  broken: boolean;
  /** My plan changes that belong to the plan shown. */
  overrides: OverrideRecord[];
}

export function activePlan(builtIn: Plan, data: AppData): ActivePlan {
  const fallback = { ...data, activeCycle: null };
  if (!data.activeCycle) return { plan: builtIn, cycle: null, broken: false, overrides: activeOverrides(data) };
  const cycle = data.cycles.find((c) => c.id === data.activeCycle) ?? null;
  const parsed = cycle ? PlanSchema.safeParse(cycle.plan) : null;
  if (!cycle || !parsed?.success) {
    return { plan: builtIn, cycle, broken: true, overrides: activeOverrides(fallback) };
  }
  return { plan: parsed.data, cycle, broken: false, overrides: activeOverrides(data) };
}

/** Plain-words problems that stop a cycle from being used. Empty = it can be used. */
export function planProblems(plan: unknown): string[] {
  const shape = PlanBaseSchema.safeParse(plan);
  if (!shape.success) return shape.error.issues.map((i) => `${i.path.join(' › ') || 'Plan'}: ${i.message}`);
  return planIssues(shape.data);
}

// ---------- dates ----------

/** The last day of a plan (Sunday of its last week), with pauses. Pass the effective plan. */
export function planEnd(plan: Plan): ISODate {
  return addDays(weekStartDate(plan, totalWeeks(plan)), 6);
}

/** Monday on or after a date. */
export function mondayOnOrAfter(date: ISODate): ISODate {
  const i = DAYS.indexOf(weekdayOf(date));
  return i === 0 ? date : addDays(date, 7 - i);
}

/** A new cycle starts the Monday after the plan in use ends, or next Monday if that has passed. */
export function defaultCycleStart(current: Plan, today: ISODate): ISODate {
  const after = addDays(planEnd(current), 1);
  return daysBetween(today, after) >= 0 ? mondayOnOrAfter(after) : mondayOnOrAfter(addDays(today, 1));
}

// ---------- making cycles ----------

const emptyWeek = (week: number): PlanWeek => ({
  week,
  block: 1,
  kind: 'build',
  longHike: { hours: '', packKg: '' },
  sunday: '',
  meVolume: '',
  notes: '',
});

/** A plan with nothing in it yet: 4 build weeks, every day rest, no rules. */
export function blankPlan(startDate: ISODate, name: string): Plan {
  return {
    name,
    startDate,
    weekly: { mon: ['rest'], tue: ['rest'], wed: ['rest'], thu: ['rest'], fri: ['rest'], sat: ['rest'], sun: ['rest'] },
    templates: { rest: { type: 'rest', kind: 'rest', title: 'Rest day', instructions: 'No training. Mobility only.' } },
    exerciseLibrary: [],
    weeks: [1, 2, 3, 4].map(emptyWeek),
    reminders: { everySession: '', everyDay: '' },
    rules: {},
  };
}

/** A copy of a plan as written (my plan changes are not part of it), with a new start and name. */
export function copyPlan(plan: Plan, startDate: ISODate, name: string): Plan {
  const copy = structuredClone(plan);
  return { ...copy, name, startDate, rules: copy.rules ?? {} };
}

export function addCycle(data: AppData, cycle: Cycle): AppData {
  return { ...data, cycles: [...data.cycles, cycle] };
}

export function updateCycle(data: AppData, id: string, change: (plan: Plan) => Plan, now: string): AppData {
  return {
    ...data,
    cycles: data.cycles.map((c) => {
      if (c.id !== id) return c;
      const plan = change(c.plan);
      return { ...c, plan, name: plan.name?.trim() || c.name, savedAt: now };
    }),
  };
}

/** Deleting a cycle also deletes the plan changes made in it. The 12-week plan takes over if it was in use. */
export function deleteCycle(data: AppData, id: string): AppData {
  return {
    ...data,
    cycles: data.cycles.filter((c) => c.id !== id),
    overrides: data.overrides.filter((o) => o.cycleId !== id),
    activeCycle: data.activeCycle === id ? null : data.activeCycle,
  };
}

/** Use a cycle (or null for the 12-week plan). Only a cycle without problems can be used. */
export function activateCycle(data: AppData, id: string | null): AppData {
  if (id !== null) {
    const cycle = data.cycles.find((c) => c.id === id);
    if (!cycle || planProblems(cycle.plan).length) return data;
  }
  return { ...data, activeCycle: id };
}

// ---------- ids from names ----------

export function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function unique(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** "Strength C" → "strength-c". Ids never change on rename, so logs keep following the session. */
export function newSessionId(plan: Plan, title: string): SessionType {
  const s = slug(title) || 'session';
  return unique(/^[a-z]/.test(s) ? s : `s-${s}`, new Set(Object.keys(plan.templates)));
}

/** "Back squat" → "back-squat": the 12-week plan's id, so last time's weights carry over. */
export function newExerciseId(name: string, taken: Iterable<string>): string {
  return unique(slug(name) || 'exercise', new Set(taken));
}

// ---------- sessions ----------

export const KIND_TEXT: Record<SessionKind, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  endurance: 'Muscular endurance',
  hike: 'Hike',
  hikeTest: 'Hike test',
  recovery: 'Recovery',
  test: 'Test',
  rest: 'Rest',
};

/** What each kind does, for the editor. */
export const KIND_HELP: Record<SessionKind, string> = {
  strength: 'Exercises with sets and reps. Logged set by set, with last time prefilled.',
  cardio: 'Minutes, effort and where. Can carry the week’s intervals.',
  endurance: 'Its target is each week’s endurance text. The log has the rest timer.',
  hike: 'Its target is each week’s hike length and pack. Shows planned trips.',
  hikeTest: 'A long hike logged as a test (status, minutes, note). Shows planned trips.',
  recovery: 'Its target is each week’s recovery text. Shows planned trips.',
  test: 'Instructions, and which results to enter in the Tests tab.',
  rest: 'No training.',
};

function freshTemplate(type: SessionType, title: string, kind: SessionKind): SessionTemplate {
  const t: SessionTemplate = { type, kind, title };
  if (kind === 'strength') t.exercises = [];
  if (kind === 'cardio') t.cardio = { minutes: [30, 45], zone: 'Zone 2', where: '' };
  if (kind === 'test') t.tests = [];
  return t;
}

export function addSession(plan: Plan, title: string, kind: SessionKind): { plan: Plan; id: SessionType } {
  const id = newSessionId(plan, title);
  return { plan: { ...plan, templates: { ...plan.templates, [id]: freshTemplate(id, title.trim(), kind) } }, id };
}

/** Change a session. Its id and kind-independent links stay; empty optional texts are dropped. */
export function updateSession(plan: Plan, id: SessionType, patch: Partial<Omit<SessionTemplate, 'type'>>): Plan {
  const old = plan.templates[id];
  if (!old) return plan;
  const next: SessionTemplate = { ...old, ...patch, type: id };
  for (const k of ['instructions', 'intervalsHow'] as const) if (next[k] !== undefined && !next[k]!.trim()) delete next[k];
  if (next.onlyIfIntervalsOff === undefined || next.onlyIfIntervalsOff === '') delete next.onlyIfIntervalsOff;
  if (next.intervals === false) delete next.intervals;
  // A kind change brings the fields the new kind needs.
  if (next.kind === 'strength' && !next.exercises) next.exercises = [];
  if (next.kind === 'cardio' && !next.cardio) next.cardio = { minutes: [30, 45], zone: 'Zone 2', where: '' };
  if (next.kind === 'test' && !next.tests) next.tests = [];
  return { ...plan, templates: { ...plan.templates, [id]: next } };
}

const without = (list: SessionType[], id: SessionType) => list.filter((t) => t !== id);

/** Delete a session and take it off every day it was on. The rest day can't be deleted. */
export function deleteSession(plan: Plan, id: SessionType): Plan {
  if (id === 'rest' || !plan.templates[id]) return plan;
  const templates = { ...plan.templates };
  delete templates[id];
  for (const [k, t] of Object.entries(templates)) {
    if (t.onlyIfIntervalsOff === id) {
      const copy = { ...t };
      delete copy.onlyIfIntervalsOff;
      templates[k] = copy;
    }
  }
  const weekly = Object.fromEntries(DAYS.map((d) => [d, emptyToRest(without(plan.weekly[d], id))])) as Plan['weekly'];
  const weeks = plan.weeks.map((w) => {
    if (!w.dayChanges) return w;
    const dayChanges = Object.fromEntries(
      Object.entries(w.dayChanges).map(([d, list]) => [d, emptyToRest(without(list, id))]),
    ) as PlanWeek['dayChanges'];
    return { ...w, dayChanges };
  });
  return { ...plan, templates, weekly, weeks };
}

function emptyToRest(list: SessionType[]): SessionType[] {
  const real = list.filter((t) => t !== 'rest');
  return real.length ? real : ['rest'];
}

/** Which sessions fall on a day of the weekly pattern. Friday stays rest; an empty day is rest. */
export function setPatternDay(plan: Plan, day: Day, list: SessionType[]): Plan {
  if (day === 'fri') return plan;
  return { ...plan, weekly: { ...plan.weekly, [day]: emptyToRest(list) } };
}

/** A week's own sessions for a day instead of the pattern; null goes back to the pattern. */
export function setWeekDay(plan: Plan, week: number, day: Day, list: SessionType[] | null): Plan {
  if (day === 'fri') return plan;
  return {
    ...plan,
    weeks: plan.weeks.map((w) => {
      if (w.week !== week) return w;
      const dayChanges = { ...(w.dayChanges ?? {}) };
      if (list === null) delete dayChanges[day];
      else dayChanges[day] = emptyToRest(list);
      const next: PlanWeek = { ...w, dayChanges };
      if (Object.keys(dayChanges).length === 0) delete next.dayChanges;
      return next;
    }),
  };
}

// ---------- exercises ----------

export type ExerciseFields = Omit<Exercise, 'id'>;

function clean(ex: Exercise): Exercise {
  const out: Exercise = { ...ex, name: ex.name.trim(), reps: ex.reps.trim() };
  if (!out.note?.trim()) delete out.note;
  else out.note = out.note.trim();
  if (!out.mainLift) delete out.mainLift;
  if (!out.swaps?.length) delete out.swaps;
  if (out.targetKg === undefined) delete out.targetKg;
  return out;
}

function withExercises(plan: Plan, id: SessionType, change: (list: Exercise[]) => Exercise[]): Plan {
  const t = plan.templates[id];
  if (!t) return plan;
  return { ...plan, templates: { ...plan.templates, [id]: { ...t, exercises: change(t.exercises ?? []) } } };
}

export function addExercise(plan: Plan, sessionId: SessionType, fields: ExerciseFields): Plan {
  return withExercises(plan, sessionId, (list) => [
    ...list,
    clean({ ...fields, id: newExerciseId(fields.name, list.map((e) => e.id)) }),
  ]);
}

export function updateExercise(plan: Plan, sessionId: SessionType, exerciseId: string, fields: ExerciseFields): Plan {
  return withExercises(plan, sessionId, (list) => list.map((e) => (e.id === exerciseId ? clean({ ...fields, id: e.id }) : e)));
}

export function deleteExercise(plan: Plan, sessionId: SessionType, exerciseId: string): Plan {
  return withExercises(plan, sessionId, (list) => list.filter((e) => e.id !== exerciseId));
}

/** Move an exercise one place up (-1) or down (+1). */
export function moveExercise(plan: Plan, sessionId: SessionType, exerciseId: string, by: -1 | 1): Plan {
  return withExercises(plan, sessionId, (list) => {
    const i = list.findIndex((e) => e.id === exerciseId);
    const j = i + by;
    if (i < 0 || j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
}

// ---------- swap library ----------

export function addSwap(plan: Plan, fields: ExerciseFields): Plan {
  const id = newExerciseId(fields.name, plan.exerciseLibrary.map((e) => e.id));
  return { ...plan, exerciseLibrary: [...plan.exerciseLibrary, clean({ ...fields, id, swaps: undefined })] };
}

export function updateSwap(plan: Plan, id: string, fields: ExerciseFields): Plan {
  return {
    ...plan,
    exerciseLibrary: plan.exerciseLibrary.map((e) => (e.id === id ? clean({ ...fields, id, swaps: undefined }) : e)),
  };
}

/** Delete a swap and take it off every exercise that offered it. */
export function deleteSwap(plan: Plan, id: string): Plan {
  const templates = Object.fromEntries(
    Object.entries(plan.templates).map(([k, t]) => [
      k,
      t.exercises ? { ...t, exercises: t.exercises.map((e) => clean({ ...e, swaps: e.swaps?.filter((s) => s !== id) })) } : t,
    ]),
  );
  return { ...plan, templates, exerciseLibrary: plan.exerciseLibrary.filter((e) => e.id !== id) };
}

// ---------- weeks ----------

/**
 * Change the number of weeks (1–24). New weeks copy the last week's block, kind and targets,
 * without its day changes or notes; removing takes weeks off the end.
 */
export function setWeekCount(plan: Plan, n: number): Plan {
  const count = Math.max(1, Math.min(MAX_WEEKS, Math.round(n)));
  if (count <= plan.weeks.length) return { ...plan, weeks: plan.weeks.slice(0, count) };
  const last = plan.weeks[plan.weeks.length - 1];
  const extra: PlanWeek[] = [];
  for (let w = plan.weeks.length + 1; w <= count; w++) {
    const copy: PlanWeek = { ...structuredClone(last), week: w, notes: '' };
    delete copy.dayChanges;
    extra.push(copy);
  }
  return { ...plan, weeks: [...plan.weeks, ...extra] };
}

export function updateWeek(plan: Plan, week: number, patch: Partial<Omit<PlanWeek, 'week'>>): Plan {
  return {
    ...plan,
    weeks: plan.weeks.map((w) => {
      if (w.week !== week) return w;
      const next = { ...w, ...patch, week };
      if (!next.intervals) delete next.intervals;
      return next;
    }),
  };
}

// ---------- rules ----------

export function updateRules(plan: Plan, patch: Partial<PlanRules>): Plan {
  const rules: PlanRules = { ...(plan.rules ?? {}), ...patch };
  for (const k of ['mainLifts', 'blockHints'] as const) {
    if (rules[k] && Object.keys(rules[k]!).length === 0) delete rules[k];
  }
  if (!rules.lighterCut) delete rules.lighterCut;
  if (!rules.testWeekHalve) delete rules.testWeekHalve;
  return { ...plan, rules };
}

/** Block numbers used by the weeks, in order. */
export function blocksOf(plan: Plan): number[] {
  return [...new Set(plan.weeks.map((w) => w.block))].sort((a, b) => a - b);
}

// ---------- plain words ----------

/** "7 exercises", "30–45 min, Zone 2", "Drift and vertical", "Week target". */
export function sessionSummary(t: SessionTemplate): string {
  switch (t.kind) {
    case 'strength': {
      const n = t.exercises?.length ?? 0;
      return n === 0 ? 'No exercises yet' : `${n} ${n === 1 ? 'exercise' : 'exercises'}`;
    }
    case 'cardio': {
      if (!t.cardio) return 'No minutes yet';
      const [lo, hi] = t.cardio.minutes;
      return `${lo === hi ? lo : `${lo}–${hi}`} min${t.cardio.zone ? `, ${t.cardio.zone}` : ''}${t.intervals ? ', intervals' : ''}`;
    }
    case 'test': {
      const names = (t.tests ?? []).map((x) => ({ drift: 'drift', threshold: 'threshold', vertical: 'vertical' })[x]);
      if (names.length === 0) return 'No results to enter';
      const text = names.join(' and ');
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
    case 'rest':
      return 'No training';
    default:
      return 'Target from each week';
  }
}

/** "Strength A, then Zone 2 on the incline treadmill", or "Rest". */
export function dayText(plan: Plan, list: SessionType[]): string {
  const real = list.filter((t) => plan.templates[t]?.kind !== 'rest');
  if (real.length === 0) return 'Rest';
  return real.map((t) => plan.templates[t]?.title ?? `Missing session (${t})`).join(', then ');
}

/** Sessions that can go on a day (everything but rest days). */
export function dayChoices(plan: Plan): SessionTemplate[] {
  return Object.values(plan.templates).filter((t) => t.kind !== 'rest');
}
