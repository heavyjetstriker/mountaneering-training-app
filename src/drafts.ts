// Half-filled strength logs, kept on the device until saved or discarded.
// Separate from AppData on purpose: drafts are throwaway and never exported.
import { z } from 'zod';
import { browserStorage } from './store';
import type { SessionType } from './schema';

const DRAFTS_KEY = 'mta.drafts';

export const StrengthFormSchema = z.object({
  boxes: z.array(
    z.object({
      plannedId: z.string(),
      exerciseId: z.string(),
      rows: z.array(z.object({ reps: z.string(), kg: z.string() })),
    }),
  ),
  note: z.string(),
  status: z.enum(['done', 'partial']),
});
export type StrengthForm = z.infer<typeof StrengthFormSchema>;

const DraftsSchema = z.record(z.string(), StrengthFormSchema);
type Drafts = z.infer<typeof DraftsSchema>;

const keyOf = (date: string, type: SessionType) => `${date}|${type}`;

function readAll(): Drafts {
  try {
    const raw = browserStorage().getItem(DRAFTS_KEY);
    if (!raw) return {};
    const parsed = DraftsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

function writeAll(drafts: Drafts) {
  try {
    const storage = browserStorage();
    if (Object.keys(drafts).length === 0) storage.removeItem(DRAFTS_KEY);
    else storage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    /* a draft is a convenience; losing one is not worth an error */
  }
}

export function readDraft(date: string, type: SessionType): StrengthForm | null {
  return readAll()[keyOf(date, type)] ?? null;
}

export function writeDraft(date: string, type: SessionType, form: StrengthForm) {
  writeAll({ ...readAll(), [keyOf(date, type)]: form });
}

export function clearDraft(date: string, type: SessionType) {
  const all = readAll();
  if (!(keyOf(date, type) in all)) return;
  delete all[keyOf(date, type)];
  writeAll(all);
}
