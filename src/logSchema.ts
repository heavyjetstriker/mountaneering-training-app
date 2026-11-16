// Shape of my records in browser storage (milestone 2: session logs).
// Types are inferred from the schema so they can't drift apart.
import { z } from 'zod';
import { SessionTypeSchema } from './schema';

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

export const AppDataSchema = z.object({
  version: z.literal(1),
  logs: z.array(SessionLogSchema),
  // Added now as empty arrays so later milestones don't need a migration.
  overrides: z.array(z.unknown()), // milestone 3
  tests: z.array(z.unknown()), // milestone 5
  trips: z.array(z.unknown()), // milestone 6
  gear: z.array(z.unknown()), // milestone 6
});
export type AppData = z.infer<typeof AppDataSchema>;

export function emptyAppData(): AppData {
  return { version: 1, logs: [], overrides: [], tests: [], trips: [], gear: [] };
}
