// Shape of my records in browser storage (milestone 2: session logs).
// Types are inferred from the schema so they can't drift apart.
import { z } from 'zod';
import { DaySchema, ExerciseSchema, SessionTypeSchema } from './schema';

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
]);
export type PlanOverride = z.infer<typeof PlanOverrideSchema>;

export const OverrideRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(), // ISO timestamp; overrides apply in this order
  override: PlanOverrideSchema,
});
export type OverrideRecord = z.infer<typeof OverrideRecordSchema>;

export const AppDataSchema = z.object({
  version: z.literal(1),
  logs: z.array(SessionLogSchema),
  // Added now as empty arrays so later milestones don't need a migration.
  overrides: z.array(OverrideRecordSchema),
  tests: z.array(z.unknown()), // milestone 5
  trips: z.array(z.unknown()), // milestone 6
  gear: z.array(z.unknown()), // milestone 6
});
export type AppData = z.infer<typeof AppDataSchema>;

export function emptyAppData(): AppData {
  return { version: 1, logs: [], overrides: [], tests: [], trips: [], gear: [] };
}
