// Shape of plan.json. Types are inferred from the schema so they can't drift apart.
import { z } from 'zod';
import { isValidISO, weekdayOf } from './dates';

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const DaySchema = z.enum(DAYS);
export type Day = z.infer<typeof DaySchema>;

/**
 * A session id: the 12-week plan's own ('strengthA', 'zone2Long', ...) or one made in the
 * plan editor (from its title). What a session does comes from its template's `kind`.
 */
export const SessionTypeSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9-]*$/, 'expected a session id');
export type SessionType = z.infer<typeof SessionTypeSchema>;

/** What a session does: which log screen, prefill, week target, rest timer, trips and charts. */
export const SESSION_KINDS = ['strength', 'cardio', 'endurance', 'hike', 'hikeTest', 'recovery', 'test', 'rest'] as const;
export const SessionKindSchema = z.enum(SESSION_KINDS);
export type SessionKind = z.infer<typeof SessionKindSchema>;

/** Results a test session asks for (the Tests tab's forms). */
export const TEST_KINDS = ['drift', 'threshold', 'vertical'] as const;

/** A cycle is 1 to 24 weeks long. */
export const MAX_WEEKS = 24;

const ISODate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const ExerciseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sets: z.number().int().positive(),
  reps: z.string().min(1),
  targetKg: z.number().positive().optional(),
  mainLift: z.boolean().optional(),
  note: z.string().optional(),
  swaps: z.array(z.string()).optional(),
});
export type Exercise = z.infer<typeof ExerciseSchema>;

export const SessionTemplateSchema = z.object({
  type: SessionTypeSchema,
  kind: SessionKindSchema,
  title: z.string().min(1),
  exercises: z.array(ExerciseSchema).optional(),
  cardio: z
    .object({
      minutes: z.tuple([z.number().positive(), z.number().positive()]),
      zone: z.string(),
      where: z.string(),
    })
    .optional(),
  instructions: z.string().optional(),
  /** Cardio: the week's intervals go in this session when they're on. */
  intervals: z.boolean().optional(),
  /** How to run the intervals when they're on. */
  intervalsHow: z.string().optional(),
  /** Test: which results it asks for. */
  tests: z.array(z.enum(TEST_KINDS)).optional(),
  /** Test: only happens while intervals are off; otherwise this session takes its place. */
  onlyIfIntervalsOff: SessionTypeSchema.optional(),
});
export type SessionTemplate = z.infer<typeof SessionTemplateSchema>;

export const PlanWeekSchema = z.object({
  week: z.number().int().min(1).max(MAX_WEEKS),
  block: z.number().int().min(1).max(MAX_WEEKS),
  kind: z.enum(['build', 'lighter', 'test']),
  longHike: z.object({ hours: z.string(), packKg: z.string() }),
  sunday: z.string(),
  intervals: z.number().int().positive().optional(),
  meVolume: z.string(),
  dayChanges: z.record(DaySchema, z.array(SessionTypeSchema)).optional(),
  notes: z.string(),
});
export type PlanWeek = z.infer<typeof PlanWeekSchema>;

const DayList = z.array(SessionTypeSchema);

/** Rules that change a week's sessions. plan.json spells out the 12-week plan's own. */
export const PlanRulesSchema = z.object({
  /** Main lifts' sets and reps per block, e.g. { "2": { sets: 4, reps: "4" } }. Other blocks: as written. */
  mainLifts: z.record(z.string(), z.object({ sets: z.number().int().min(1).max(12), reps: z.string().min(1) })).optional(),
  /** One line under strength sessions, per block. */
  blockHints: z.record(z.string(), z.string()).optional(),
  /** Lighter weeks: strength sets and cardio minutes cut by a third. */
  lighterCut: z.boolean().optional(),
  /** Test weeks: Monday to Thursday strength sets and cardio minutes halved. */
  testWeekHalve: z.boolean().optional(),
});
export type PlanRules = z.infer<typeof PlanRulesSchema>;

/** The shape of a plan. Cycles being edited are stored in this shape and may still have problems. */
export const PlanBaseSchema = z.object({
  name: z.string().optional(),
  startDate: ISODate,
  weekly: z.object({ mon: DayList, tue: DayList, wed: DayList, thu: DayList, fri: DayList, sat: DayList, sun: DayList }),
  templates: z.record(SessionTypeSchema, SessionTemplateSchema),
  exerciseLibrary: z.array(ExerciseSchema),
  weeks: z.array(PlanWeekSchema).min(1).max(MAX_WEEKS),
  reminders: z.object({ everySession: z.string(), everyDay: z.string() }),
  rules: PlanRulesSchema.optional(),
  /** Gear the training plan names, offered when the gear list is empty. */
  starterGear: z.array(z.string().min(1)).optional(),
});

/** Plain-words problems that stop a plan from being used. Empty = fine. */
export function planIssues(plan: z.infer<typeof PlanBaseSchema>): string[] {
  const out: string[] = [];
  for (const [id, tpl] of Object.entries(plan.templates)) {
    if (tpl.type !== id) out.push(`Session "${tpl.title}" has the id "${tpl.type}" but is stored as "${id}".`);
    if (tpl.kind === 'strength' && !tpl.exercises?.length) out.push(`${tpl.title} has no exercises.`);
    if (tpl.kind === 'cardio' && !tpl.cardio) out.push(`${tpl.title} has no minutes.`);
    if (tpl.cardio && tpl.cardio.minutes[0] > tpl.cardio.minutes[1])
      out.push(`${tpl.title}: the lowest minutes are above the highest.`);
    if (tpl.onlyIfIntervalsOff !== undefined) {
      const other = plan.templates[tpl.onlyIfIntervalsOff];
      if (!other) out.push(`${tpl.title} is replaced by a session that doesn't exist.`);
      else if (other.onlyIfIntervalsOff) out.push(`${tpl.title} is replaced by ${other.title}, which is replaced too.`);
    }
    const ids = new Set<string>();
    for (const ex of tpl.exercises ?? []) {
      if (ids.has(ex.id)) out.push(`${tpl.title} has "${ex.name}" twice.`);
      ids.add(ex.id);
    }
  }
  if (plan.templates.rest?.kind !== 'rest') out.push('The plan needs its rest day session ("rest").');
  const lib = new Set(plan.exerciseLibrary.map((e) => e.id));
  for (const tpl of Object.values(plan.templates)) {
    for (const ex of tpl.exercises ?? []) {
      for (const s of ex.swaps ?? []) {
        if (!lib.has(s)) out.push(`${ex.name}: swap "${s}" is not in the swap library.`);
      }
    }
  }
  const DAY_TITLE: Record<Day, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
  for (const d of DAYS) {
    for (const t of plan.weekly[d]) if (!plan.templates[t]) out.push(`${DAY_TITLE[d]} has a session that doesn't exist ("${t}").`);
  }
  if (plan.weekly.fri.join() !== 'rest') out.push('Friday must be a rest day.');
  plan.weeks.forEach((w, i) => {
    if (w.week !== i + 1) out.push(`Week ${i + 1} is numbered ${w.week}.`);
    for (const [d, list] of Object.entries(w.dayChanges ?? {}) as [Day, string[]][]) {
      if (d === 'fri') out.push(`Week ${w.week} changes Friday.`);
      for (const t of list) if (!plan.templates[t]) out.push(`Week ${w.week}, ${DAY_TITLE[d]}: a session that doesn't exist ("${t}").`);
    }
  });
  if (!isValidISO(plan.startDate)) out.push('The start date is not a real date.');
  else if (weekdayOf(plan.startDate) !== 'mon') out.push('The plan has to start on a Monday.');
  return out;
}

/** A plan that can be used: right shape and no problems. plan.json and an active cycle are checked with this. */
export const PlanSchema = PlanBaseSchema.superRefine((plan, ctx) => {
  for (const message of planIssues(plan)) ctx.addIssue({ code: 'custom', message });
});

export type Plan = z.infer<typeof PlanBaseSchema>;

export function parsePlan(data: unknown): Plan {
  const result = PlanSchema.safeParse(data);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `${i.path.join('.') || 'plan'}: ${i.message}`);
    throw new Error(`plan.json is invalid:\n${lines.join('\n')}`);
  }
  return result.data as Plan;
}
