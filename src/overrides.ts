// My plan changes: adding, resetting and describing override records. Pure functions only.
import type { Exercise, Plan } from './schema';
import type { AppData, OverrideRecord, OverrideScope, PlanOverride } from './logSchema';
import { DAY_NAMES } from './dates';
import { getWeek, isWeekOnly, sortOverrides } from './plan';

export function addOverride(data: AppData, override: PlanOverride, id: string, createdAt: string): AppData {
  return { ...data, overrides: [...data.overrides, { id, createdAt, override }] };
}

/** Resetting a change = deleting its override record. */
export function removeOverride(data: AppData, id: string): AppData {
  return { ...data, overrides: data.overrides.filter((o) => o.id !== id) };
}

export function resetAllOverrides(data: AppData): AppData {
  return { ...data, overrides: [] };
}

/** The changes list, oldest first (the order they apply in). */
export function listOverrides(data: AppData): OverrideRecord[] {
  return sortOverrides(data.overrides);
}

// ---------- plain words ----------

export function scopeText(scope: OverrideScope): string {
  return isWeekOnly(scope) ? `week ${scope.week} only` : `from week ${scope.fromWeek}`;
}

/** An exercise by id, wherever it is defined: the plan, the swap library, or a replacement I made. */
function findExercise(plan: Plan, overrides: OverrideRecord[], id: string): Exercise | undefined {
  for (const tpl of Object.values(plan.templates)) {
    const ex = tpl.exercises?.find((e) => e.id === id);
    if (ex) return ex;
  }
  const lib = plan.exerciseLibrary.find((e) => e.id === id);
  if (lib) return lib;
  for (const { override: o } of overrides) {
    if (o.kind === 'replaceExercise' && o.with.id === id) return o.with;
  }
  return undefined;
}

function weeks(n: number): string {
  return `${n} ${n === 1 ? 'week' : 'weeks'}`;
}

function kg(n: number): string {
  return `${Math.round(n * 100) / 100} kg`;
}

/**
 * One line per change, e.g. "Back squat: 4 × 5 → 3 × 5, from week 3",
 * "Week 6: Saturday moved to Sunday", "Plan paused 1 week from week 6".
 * `plan` is the base plan.json, so "before" values are the plan's own.
 */
export function describeOverride(plan: Plan, record: OverrideRecord, all: OverrideRecord[] = [record]): string {
  const o = record.override;
  switch (o.kind) {
    case 'editExercise': {
      const ex = findExercise(plan, all, o.exerciseId);
      const name = ex?.name ?? o.exerciseId;
      const { sets, reps, targetKg, note } = o.changes;
      const parts: string[] = [];
      if (sets !== undefined || reps !== undefined) {
        const before = ex ? `${ex.sets} × ${ex.reps}` : '';
        const after = `${sets ?? ex?.sets ?? '?'} × ${reps ?? ex?.reps ?? '?'}`;
        parts.push(before ? `${before} → ${after}` : after);
      }
      if (targetKg === null) parts.push('no target kg');
      else if (targetKg !== undefined) parts.push(`target ${kg(targetKg)}`);
      if (note !== undefined) parts.push(note.trim() ? `note "${note.trim()}"` : 'note removed');
      return `${name}: ${parts.join(', ') || 'no change'}, ${scopeText(o.scope)}`;
    }
    case 'replaceExercise': {
      const before = findExercise(plan, all, o.exerciseId)?.name ?? o.exerciseId;
      return `${plan.templates[o.sessionType].title}: ${before} → ${o.with.name} (${o.with.sets} × ${o.with.reps}), ${scopeText(o.scope)}`;
    }
    case 'moveDay':
      return `Week ${o.week}: ${DAY_NAMES[o.from]} moved to ${DAY_NAMES[o.to]}`;
    case 'weekTargets': {
      const w = getWeek(plan, o.week);
      const parts: string[] = [];
      const c = o.changes;
      if (c.longHike) {
        if (c.longHike.hours !== w.longHike.hours) parts.push(`hike ${w.longHike.hours} → ${c.longHike.hours}`);
        if (c.longHike.packKg !== w.longHike.packKg) parts.push(`pack ${w.longHike.packKg} → ${c.longHike.packKg}`);
      }
      if (c.sunday !== undefined) parts.push(`Sunday "${c.sunday}"`);
      if (c.meVolume !== undefined) parts.push('Thursday changed');
      if (c.notes !== undefined) parts.push('notes changed');
      return `Week ${o.week}: ${parts.join(', ') || 'no change'}`;
    }
    case 'pause':
      return `Plan paused ${weeks(o.weeks)} from week ${o.fromWeek}`;
  }
}

/** A stable id for an exercise I typed in myself, so its history follows the name. */
export function customExerciseId(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `custom-${slug || 'exercise'}`;
}
