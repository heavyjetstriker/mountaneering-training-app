// Data for the progress charts (Week tab). Pure functions only.
import type { Plan } from './schema';
import type { SessionLog } from './logSchema';
import type { ISODate } from './dates';
import { getWeek, positionOn, TOTAL_WEEKS } from './plan';

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;

/** The plan week (1–12) a date falls in, or null before the start, in a paused week or after week 12. */
export function weekOfLog(plan: Plan, date: ISODate): number | null {
  const pos = positionOn(plan, date);
  return pos.status === 'active' ? pos.week : null;
}

function byWeek(plan: Plan, logs: SessionLog[]): SessionLog[][] {
  const weeks: SessionLog[][] = Array.from({ length: TOTAL_WEEKS }, () => []);
  for (const l of logs) {
    const w = weekOfLog(plan, l.date);
    if (w !== null) weeks[w - 1].push(l);
  }
  return weeks;
}

const counted = (l: SessionLog) => l.status === 'done' || l.status === 'partial';

/** Hours trained per week: logged minutes of done and partly done sessions, one decimal. */
export function hoursByWeek(plan: Plan, logs: SessionLog[]): number[] {
  return byWeek(plan, logs).map(
    (ls) => Math.round((ls.filter(counted).reduce((s, l) => s + (l.minutes ?? 0), 0) / 60) * 10) / 10,
  );
}

/** "12–14 kg" → [12, 14], "6 kg" → [6, 6]. */
export function kgRange(text: string): [number, number] | null {
  const m = new RegExp(String.raw`${NUM}(?:\s*[–-]\s*${NUM})?\s*kg`).exec(text);
  if (!m) return null;
  const lo = Number(m[1].replace(',', '.'));
  const hi = m[2] ? Number(m[2].replace(',', '.')) : lo;
  return [lo, hi];
}

export interface PackWeek {
  /** Heaviest pack logged on a long hike or long-day test that week. */
  logged: number | null;
  planned: [number, number] | null;
}

export function packByWeek(plan: Plan, logs: SessionLog[]): PackWeek[] {
  return byWeek(plan, logs).map((ls, i) => {
    const packs = ls
      .filter((l) => counted(l) && (l.type === 'longHike' || l.type === 'longDayTest') && l.packKg !== undefined)
      .map((l) => l.packKg!);
    return {
      logged: packs.length ? Math.max(...packs) : null,
      planned: kgRange(getWeek(plan, i + 1).longHike.packKg),
    };
  });
}

/** Heaviest kg of any set with reps for an exercise, per week; null when not logged. */
export function topSetByWeek(plan: Plan, logs: SessionLog[], exerciseId: string): (number | null)[] {
  return byWeek(plan, logs).map((ls) => {
    let top: number | null = null;
    for (const l of ls) {
      if (!counted(l)) continue;
      for (const s of l.sets ?? []) {
        if (s.exerciseId !== exerciseId || s.reps <= 0 || s.kg === null) continue;
        if (top === null || s.kg > top) top = s.kg;
      }
    }
    return top;
  });
}

/** A clean top for a chart axis: 1, 2, 2.5, 5 × 10ⁿ. */
export function niceMax(n: number): number {
  if (n <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= n) return m * p;
  return 10 * p;
}
