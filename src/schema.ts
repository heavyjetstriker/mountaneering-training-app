// Shape of plan.json. Types are inferred from the schema so they can't drift apart.
import { z } from 'zod';

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const DaySchema = z.enum(DAYS);
export type Day = z.infer<typeof DaySchema>;

export const SESSION_TYPES = [
  'strengthA', 'strengthB',
  'zone2Incline', 'zone2Long', 'zone2Stairs',
  'me', 'longHike', 'recovery', 'rest',
  'testDriftVertical', 'testThreshold', 'testDriftRetest', 'longDayTest',
] as const;
export const SessionTypeSchema = z.enum(SESSION_TYPES);
export type SessionType = z.infer<typeof SessionTypeSchema>;

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
  /** Tuesday Zone 2: how to run the intervals when they're on. */
  intervalsHow: z.string().optional(),
});
export type SessionTemplate = z.infer<typeof SessionTemplateSchema>;

export const PlanWeekSchema = z.object({
  week: z.number().int().min(1).max(12),
  block: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  kind: z.enum(['build', 'lighter', 'test']),
  longHike: z.object({ hours: z.string(), packKg: z.string() }),
  sunday: z.string(),
  intervals: z.number().int().positive().optional(),
  meVolume: z.string(),
  dayChanges: z.record(DaySchema, z.array(SessionTypeSchema)).optional(),
  notes: z.string(),
});
export type PlanWeek = z.infer<typeof PlanWeekSchema>;

export const PlanSchema = z
  .object({
    startDate: ISODate,
    weekly: z.object({
      mon: z.array(SessionTypeSchema), tue: z.array(SessionTypeSchema),
      wed: z.array(SessionTypeSchema), thu: z.array(SessionTypeSchema),
      fri: z.array(SessionTypeSchema), sat: z.array(SessionTypeSchema),
      sun: z.array(SessionTypeSchema),
    }),
    templates: z.record(SessionTypeSchema, SessionTemplateSchema),
    exerciseLibrary: z.array(ExerciseSchema),
    weeks: z.array(PlanWeekSchema).length(12),
    reminders: z.object({ everySession: z.string(), everyDay: z.string() }),
    /** Gear the training plan names, offered when the gear list is empty. */
    starterGear: z.array(z.string().min(1)).optional(),
  })
  .superRefine((plan, ctx) => {
    // Every session type must have a template.
    for (const t of SESSION_TYPES) {
      if (!plan.templates[t]) ctx.addIssue({ code: 'custom', message: `missing template "${t}"` });
      else if (plan.templates[t]!.type !== t)
        ctx.addIssue({ code: 'custom', message: `template "${t}" has type "${plan.templates[t]!.type}"` });
    }
    // Weeks numbered 1..12 in order.
    plan.weeks.forEach((w, i) => {
      if (w.week !== i + 1) ctx.addIssue({ code: 'custom', message: `weeks[${i}] is week ${w.week}, expected ${i + 1}` });
    });
    // Swaps must point at exercises in the library.
    const lib = new Set(plan.exerciseLibrary.map((e) => e.id));
    for (const tpl of Object.values(plan.templates)) {
      for (const ex of tpl?.exercises ?? []) {
        for (const s of ex.swaps ?? []) {
          if (!lib.has(s)) ctx.addIssue({ code: 'custom', message: `swap "${s}" of "${ex.id}" is not in exerciseLibrary` });
        }
      }
    }
    // Friday is always rest.
    if (plan.weekly.fri.join() !== 'rest') ctx.addIssue({ code: 'custom', message: 'Friday must be rest' });
    for (const w of plan.weeks) {
      if (w.dayChanges?.fri) ctx.addIssue({ code: 'custom', message: `week ${w.week} changes Friday` });
    }
  });

export type Plan = Omit<z.infer<typeof PlanSchema>, 'templates'> & {
  templates: Record<SessionType, SessionTemplate>;
};

export function parsePlan(data: unknown): Plan {
  const result = PlanSchema.safeParse(data);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `${i.path.join('.') || 'plan'}: ${i.message}`);
    throw new Error(`plan.json is invalid:\n${lines.join('\n')}`);
  }
  return result.data as Plan;
}
