// My plan changes: adding, resetting and describing override records. Pure functions only.
import type { Exercise, Plan } from './schema';
import type { AppData, OverrideRecord, OverrideScope, PlanOverride } from './logSchema';
import { DAY_NAMES, longDate } from './dates';
import { getWeek, isWeekOnly, sortOverrides, weekTargetNames } from './plan';

/** Whether a change belongs to the plan in use (a cycle, or the 12-week plan when none is active). */
function inUse(data: Pick<AppData, 'activeCycle'>, o: OverrideRecord): boolean {
  return (o.cycleId ?? null) === data.activeCycle;
}

/** The changes made in the plan in use; changes from other cycles never apply to it. */
export function activeOverrides(data: Pick<AppData, 'overrides' | 'activeCycle'>): OverrideRecord[] {
  return data.overrides.filter((o) => inUse(data, o));
}

/** A new change, made in the plan in use. */
export function addOverride(data: AppData, override: PlanOverride, id: string, createdAt: string): AppData {
  const record: OverrideRecord = { id, createdAt, override, ...(data.activeCycle ? { cycleId: data.activeCycle } : {}) };
  return { ...data, overrides: [...data.overrides, record] };
}

/** Resetting a change = deleting its override record. */
export function removeOverride(data: AppData, id: string): AppData {
  return { ...data, overrides: data.overrides.filter((o) => o.id !== id) };
}

/**
 * A new start date replaces any earlier start-date change, so the list shows one line.
 * Picking the plan's own date just removes the change.
 */
export function setStartDate(data: AppData, plan: Plan, date: string, id: string, createdAt: string): AppData {
  const rest = { ...data, overrides: data.overrides.filter((o) => !(inUse(data, o) && o.override.kind === 'startDate')) };
  return date === plan.startDate ? rest : addOverride(rest, { kind: 'startDate', date }, id, createdAt);
}

/** Reset all = every change in the plan in use; other cycles keep theirs. */
export function resetAllOverrides(data: AppData): AppData {
  return { ...data, overrides: data.overrides.filter((o) => !inUse(data, o)) };
}

/** The changes list of the plan in use, oldest first (the order they apply in). */
export function listOverrides(data: AppData): OverrideRecord[] {
  return sortOverrides(activeOverrides(data));
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
      const names = weekTargetNames(plan);
      if (c.sunday !== undefined) parts.push(`${names.recovery ?? 'Recovery'} "${c.sunday}"`);
      if (c.meVolume !== undefined) parts.push(`${names.endurance ?? 'Endurance'} changed`);
      if (c.notes !== undefined) parts.push('notes changed');
      return `Week ${o.week}: ${parts.join(', ') || 'no change'}`;
    }
    case 'pause':
      return `Plan paused ${weeks(o.weeks)} from week ${o.fromWeek}`;
    case 'startDate': {
      // "Before" is the start date in force just before this change: an earlier one, or the plan's own.
      let before = plan.startDate;
      for (const r of sortOverrides(all)) {
        if (r.id === record.id) break;
        if (r.override.kind === 'startDate') before = r.override.date;
      }
      return `Plan start: ${longDate(before)} → ${longDate(o.date)}`;
    }
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
