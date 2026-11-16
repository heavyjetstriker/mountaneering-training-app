// Log logic for milestone 2. Pure functions only, no React, no storage.
import type { Exercise, PlanWeek, SessionType } from './schema';
import type { AppData, EffortZone, LoggedSet, SessionLog, SetUnit } from './logSchema';
import type { ResolvedSession } from './plan';
import { shortDate } from './dates';

// ---------- what kind of log screen a session gets ----------

export type LogKind = 'strength' | 'cardio' | 'test' | 'none';

const STRENGTH: SessionType[] = ['strengthA', 'strengthB'];
const TESTS: SessionType[] = ['testDriftVertical', 'testThreshold', 'testDriftRetest', 'longDayTest'];

export function logKind(type: SessionType): LogKind {
  if (type === 'rest') return 'none';
  if (STRENGTH.includes(type)) return 'strength';
  if (TESTS.includes(type)) return 'test';
  return 'cardio';
}

// ---------- planned reps ----------

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const RANGE = String.raw`${NUM}(?:\s*[–-]\s*${NUM})?`;

function num(s: string): number {
  return Number(s.replace(',', '.'));
}

/**
 * '5' → 5 reps, '5–6' → 5 reps, '30 s per side' → 30 s, '40 m' → 40 m.
 * 'per leg' / 'per side' stay as text in the UI.
 */
export function parseReps(reps: string): { value: number; unit: SetUnit } {
  const m = new RegExp(String.raw`^\s*${RANGE}\s*(s|m)?\b`).exec(reps);
  if (!m) return { value: 0, unit: 'reps' };
  const unit: SetUnit = m[3] === 's' ? 's' : m[3] === 'm' ? 'm' : 'reps';
  return { value: num(m[1]), unit };
}

export const UNIT_LABEL: Record<SetUnit, string> = { reps: 'Reps', s: 'Seconds', m: 'Metres' };

// ---------- finding logs ----------

export function logFor(logs: SessionLog[], date: string, type: SessionType): SessionLog | undefined {
  return logs.find((l) => l.date === date && l.type === type);
}

/** The most recent log before `beforeDate` with sets for this exercise id. Skipped logs are ignored. */
export function lastSetsFor(
  logs: SessionLog[],
  exerciseId: string,
  beforeDate: string,
): { date: string; sets: LoggedSet[] } | null {
  let best: { log: SessionLog; sets: LoggedSet[] } | null = null;
  for (const log of logs) {
    if (log.status === 'skipped' || log.date >= beforeDate || !log.sets) continue;
    const sets = log.sets.filter((s) => s.exerciseId === exerciseId);
    if (sets.length === 0) continue;
    if (!best || log.date > best.log.date || (log.date === best.log.date && log.savedAt > best.log.savedAt)) {
      best = { log, sets };
    }
  }
  if (!best) return null;
  return { date: best.log.date, sets: [...best.sets].sort((a, b) => a.setNumber - b.setNumber) };
}

export interface PrefillRow {
  reps: number;
  kg: number | null;
}

/**
 * One row per planned set. Reps from last time's same set (extra rows copy the last set),
 * else the planned value. Kg from last time's same set, else last time's last set,
 * else the target kg, else empty.
 */
export function prefillSets(exercise: Exercise, plannedSets: number, logs: SessionLog[], date: string): PrefillRow[] {
  const planned = parseReps(exercise.reps).value;
  const last = lastSetsFor(logs, exercise.id, date)?.sets ?? [];
  const lastSet = last[last.length - 1];
  return Array.from({ length: plannedSets }, (_, i) => {
    const same = last[i];
    if (same) return { reps: same.reps, kg: same.kg };
    if (lastSet) return { reps: lastSet.reps, kg: lastSet.kg };
    return { reps: planned, kg: exercise.targetKg ?? null };
  });
}

// ---------- status ----------

export type DayStatus = 'done' | 'partial' | 'skipped' | 'none';

/** Status of a plan day from its sessions' logs. Rest days have no status (null). */
export function dayStatus(logs: SessionLog[], date: string, types: SessionType[]): DayStatus | null {
  const loggable = types.filter((t) => t !== 'rest');
  if (loggable.length === 0) return null;
  const statuses = loggable.map((t) => logFor(logs, date, t)?.status);
  if (statuses.every((s) => s === 'done')) return 'done';
  if (statuses.every((s) => s === 'skipped')) return 'skipped';
  if (statuses.some((s) => s === 'done' || s === 'partial')) return 'partial';
  return 'none';
}

// ---------- changing data (never mutate) ----------

/** One log per (date, type): saving again replaces it. */
export function upsertLog(data: AppData, log: SessionLog): AppData {
  const rest = data.logs.filter((l) => !(l.date === log.date && l.type === log.type) && l.id !== log.id);
  return { ...data, logs: [...rest, log] };
}

export function deleteLog(data: AppData, id: string): AppData {
  return { ...data, logs: data.logs.filter((l) => l.id !== id) };
}

// ---------- text ----------

function fmtNum(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function fmtReps(reps: number, unit: SetUnit): string {
  return unit === 'reps' ? fmtNum(reps) : `${fmtNum(reps)} ${unit}`;
}

/** '4 × 5 at 80 kg', or grouped when sets differ: '2 × 5 at 80 kg, 2 × 4 at 82.5 kg'. */
export function formatSets(sets: LoggedSet[]): string {
  const groups: { count: number; set: LoggedSet }[] = [];
  for (const s of sets) {
    const g = groups[groups.length - 1];
    if (g && g.set.reps === s.reps && g.set.kg === s.kg && g.set.unit === s.unit) g.count++;
    else groups.push({ count: 1, set: s });
  }
  return groups
    .map(({ count, set }) => {
      const kg = set.kg === null ? '' : ` at ${fmtNum(set.kg)} kg`;
      return `${count} × ${fmtReps(set.reps, set.unit)}${kg}`;
    })
    .join(', ');
}

/** 'Last time: 4 × 5 at 80 kg, 9 Nov' or 'No previous log.' */
export function lastTimeText(last: { date: string; sets: LoggedSet[] } | null): string {
  if (!last) return 'No previous log.';
  return `Last time: ${formatSets(last.sets)}, ${shortDate(last.date)}`;
}

/** One-line summary for the session footer. */
export function logSummary(log: SessionLog): string {
  if (log.status === 'skipped') return '';
  if (log.sets) {
    const exercises = new Set(log.sets.map((s) => s.exerciseId)).size;
    return `${exercises} ${exercises === 1 ? 'exercise' : 'exercises'}, ${log.sets.length} ${
      log.sets.length === 1 ? 'set' : 'sets'
    }`;
  }
  const parts: string[] = [];
  if (log.minutes !== undefined) parts.push(`${fmtNum(log.minutes)} min`);
  if (log.avgHr !== undefined) parts.push(`avg HR ${fmtNum(log.avgHr)}`);
  if (log.packKg !== undefined) parts.push(`${fmtNum(log.packKg)} kg`);
  if (log.effortZone !== undefined) parts.push(`Zone ${log.effortZone}`);
  return parts.join(', ');
}

export const STATUS_TEXT: Record<SessionLog['status'], string> = {
  done: 'Done',
  partial: 'Partly done',
  skipped: 'Skipped',
};

// ---------- cardio / hike / recovery prefill ----------

/** Upper end of a duration in a plan string: '1–1.5 h easy' → 90, '45–75 min' → 75, '2.5 h' → 150. */
export function upperMinutes(text: string): number | null {
  // '2 min rest' between sets is not the session's length.
  const m = new RegExp(String.raw`${RANGE}\s*(h|min)\b(?!\s*rest)`).exec(text);
  if (!m) return null;
  const upper = num(m[2] ?? m[1]);
  return Math.round(m[3] === 'h' ? upper * 60 : upper);
}

/** Lower end of a pack weight: '10–13 kg' → 10, '~6.5 kg' → 6.5. */
export function lowerKg(text: string): number | null {
  const m = new RegExp(String.raw`${RANGE}\s*kg\b`).exec(text);
  return m ? num(m[1]) : null;
}

/** 'Zone 2' → 2, 'Zone 2–3' → 2, 'Zone 3' → 3. */
export function zoneFrom(text: string): EffortZone | null {
  const m = /Zone\s*([1-5])/.exec(text);
  return m ? (Number(m[1]) as EffortZone) : null;
}

export interface CardioPrefill {
  minutes: number | null;
  packKg: number | null;
  effortZone: EffortZone | null;
  notePlaceholder: string;
}

export function cardioPrefill(session: ResolvedSession, week: PlanWeek): CardioPrefill {
  const out: CardioPrefill = { minutes: null, packKg: null, effortZone: null, notePlaceholder: '' };
  switch (session.type) {
    case 'zone2Incline':
    case 'zone2Long':
    case 'zone2Stairs':
      out.minutes = session.cardio ? session.cardio.minutes[1] : null;
      out.effortZone = session.cardio ? zoneFrom(session.cardio.zone) : null;
      if (session.type === 'zone2Long' && week.intervals && week.kind !== 'lighter') {
        out.notePlaceholder = 'Intervals done?';
      }
      break;
    case 'me':
      out.minutes = upperMinutes(week.meVolume);
      out.packKg = lowerKg(week.meVolume);
      out.effortZone = zoneFrom(week.meVolume);
      break;
    case 'longHike':
      out.minutes = upperMinutes(week.longHike.hours);
      out.packKg = lowerKg(week.longHike.packKg);
      break;
    case 'recovery':
      out.minutes = upperMinutes(week.sunday);
      break;
    case 'longDayTest':
      out.minutes = upperMinutes(session.instructions ?? '');
      break;
    default:
      break;
  }
  return out;
}
