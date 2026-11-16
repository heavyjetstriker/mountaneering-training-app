// Shape of my records in browser storage (milestone 2: session logs).
// Types are inferred from the schema so they can't drift apart.
import { z } from 'zod';
import { DaySchema, ExerciseSchema, SessionTypeSchema } from './schema';
import { isValidISO, weekdayOf } from './dates';

const ISODate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const SetUnitSchema = z.enum(['reps', 's', 'm']);
export type SetUnit = z.infer<typeof SetUnitSchema>;

export const LoggedSetSchema = z.object({
  exerciseId: z.string().min(1),
  exerciseName: z.string().min(1),
  setNumber: z.number().int().positive(),
  reps: z.number().nonnegative(),
  unit: SetUnitSchema,
  kg: z.number().nonnegative().nullable(),
});
export type LoggedSet = z.infer<typeof LoggedSetSchema>;

export const LogStatusSchema = z.enum(['done', 'partial', 'skipped']);
export type LogStatus = z.infer<typeof LogStatusSchema>;

export const EffortZoneSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
export type EffortZone = z.infer<typeof EffortZoneSchema>;

export const SessionLogSchema = z.object({
  id: z.string().min(1),
  date: ISODate,
  week: z.number().int().min(1),
  type: SessionTypeSchema,
  status: LogStatusSchema,
  sets: z.array(LoggedSetSchema).optional(),
  swaps: z.record(z.string(), z.string()).optional(),
  minutes: z.number().nonnegative().optional(),
  avgHr: z.number().nonnegative().optional(),
  packKg: z.number().nonnegative().optional(),
  effortZone: EffortZoneSchema.optional(),
  note: z.string().optional(),
  savedAt: z.string(),
});
export type SessionLog = z.infer<typeof SessionLogSchema>;

// ---------- my plan changes (milestone 3), layered on plan.json ----------

/** 'This week only' or 'from week N on'. */
export const OverrideScopeSchema = z.union([
  z.object({ week: z.number().int().min(1) }),
  z.object({ fromWeek: z.number().int().min(1) }),
]);
export type OverrideScope = z.infer<typeof OverrideScopeSchema>;

export const PlanOverrideSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('editExercise'),
    scope: OverrideScopeSchema,
    sessionType: SessionTypeSchema,
    exerciseId: z.string().min(1), // the exercise as shown (after any replacement)
    changes: z.object({
      sets: z.number().int().positive().optional(),
      reps: z.string().min(1).optional(),
      targetKg: z.number().nonnegative().nullable().optional(), // null clears the target
      note: z.string().optional(),
    }),
  }),
  z.object({
    kind: z.literal('replaceExercise'),
    scope: OverrideScopeSchema,
    sessionType: SessionTypeSchema,
    exerciseId: z.string().min(1), // the plan's exercise slot (id in plan.json)
    with: ExerciseSchema,
  }),
  z.object({ kind: z.literal('moveDay'), week: z.number().int().min(1), from: DaySchema, to: DaySchema }),
  z.object({
    kind: z.literal('weekTargets'),
    week: z.number().int().min(1),
    changes: z.object({
      longHike: z.object({ hours: z.string(), packKg: z.string() }).optional(),
      sunday: z.string().optional(),
      meVolume: z.string().optional(),
      notes: z.string().optional(),
    }),
  }),
  z.object({ kind: z.literal('pause'), fromWeek: z.number().int().min(1), weeks: z.number().int().min(1) }),
  // Milestone 4: a new start date. Must be a Monday; the latest one wins.
  z.object({
    kind: z.literal('startDate'),
    date: ISODate.refine((d) => isValidISO(d) && weekdayOf(d) === 'mon', 'the plan starts on a Monday'),
  }),
]);
export type PlanOverride = z.infer<typeof PlanOverrideSchema>;

export const OverrideRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(), // ISO timestamp; overrides apply in this order
  override: PlanOverrideSchema,
});
export type OverrideRecord = z.infer<typeof OverrideRecordSchema>;

// ---------- test results (milestone 5) ----------

const Hr = z.number().int().min(60).max(230);
const testBase = {
  id: z.string().min(1),
  date: ISODate.refine(isValidISO, 'not a real date'),
  savedAt: z.string(), // ISO timestamp; orders two results on the same date
  note: z.string().optional(),
};

export const TestResultSchema = z.discriminatedUnion('type', [
  z.object({ ...testBase, type: z.literal('drift'), startHr: Hr, hrFirstHalf: Hr, hrSecondHalf: Hr }),
  z.object({ ...testBase, type: z.literal('threshold'), thresholdHr: Hr }),
  z.object({
    ...testBase,
    type: z.literal('vertical'),
    verticalM: z.number().int().min(1).max(5000),
    avgHr: Hr,
    minutes: z.number().int().min(1).max(600).optional(),
    packKg: z.number().min(0).max(40).optional(),
  }),
]);
export type TestResult = z.infer<typeof TestResultSchema>;
export type TestType = TestResult['type'];

// ---------- trips and gear (milestone 6) ----------

/** Only http and https links, so a stored link can never run script when opened. */
export const WebLink = z
  .string()
  .max(2000)
  .refine((s) => {
    try {
      const u = new URL(s);
      return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname;
    } catch {
      return false;
    }
  }, 'expected an http or https link');

const oneDecimal = (n: number) => Math.round(n * 10) / 10 === n;

export const AREAS = ['Sintra', 'Arrábida', 'Monsanto', 'Jamor', 'Other'] as const;
export const TRANSPORTS = ['train+bus', 'car'] as const;

export const TripSchema = z.object({
  id: z.string().min(1),
  savedAt: z.string(),
  date: ISODate.refine(isValidISO, 'not a real date'),
  route: z.string().trim().min(1).max(120),
  area: z.enum(AREAS),
  transport: z.enum(TRANSPORTS),
  distanceKm: z.number().min(0.1).max(100).refine(oneDecimal).optional(),
  climbM: z.number().int().min(0).max(5000).optional(),
  packKg: z.number().min(0).max(40).refine(oneDecimal).optional(),
  link: WebLink.optional(),
  status: z.enum(['planned', 'done']),
  note: z.string().optional(),
});
export type Trip = z.infer<typeof TripSchema>;
export type Area = Trip['area'];
export type Transport = Trip['transport'];

export const GearItemSchema = z.object({
  id: z.string().min(1),
  savedAt: z.string(),
  name: z.string().trim().min(1).max(60),
  status: z.enum(['need', 'have']),
  note: z.string().optional(),
});
export type GearItem = z.infer<typeof GearItemSchema>;

/** The newest AppData version this build understands. */
export const APP_DATA_VERSION = 1;

export const AppDataSchema = z.object({
  version: z.literal(APP_DATA_VERSION),
  logs: z.array(SessionLogSchema),
  // Added now as empty arrays so later milestones don't need a migration.
  overrides: z.array(OverrideRecordSchema),
  tests: z.array(TestResultSchema),
  trips: z.array(TripSchema),
  gear: z.array(GearItemSchema),
});
export type AppData = z.infer<typeof AppDataSchema>;

export function emptyAppData(): AppData {
  return { version: 1, logs: [], overrides: [], tests: [], trips: [], gear: [] };
}
