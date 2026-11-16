// Export and import: one JSON file that moves my data between phone and PC.
// Pure functions only; the screens do the file and storage work.
import { z } from 'zod';
import { APP_DATA_VERSION, AppDataSchema, type AppData } from './logSchema';
import { addDays, daysBetween, localISO, nearestMondayOffset, shortDate, type ISODate } from './dates';

export const BACKUP_APP = 'mountain-training-app';

export interface BackupFile {
  app: typeof BACKUP_APP;
  exportedAt: string; // ISO timestamp
  data: AppData; // the whole mta.data object, as stored
}

/** Device-only info (key mta.meta). Never exported. */
export interface Meta {
  lastExportAt?: string; // ISO timestamp
}

export function makeBackup(data: AppData, now: Date): BackupFile {
  return { app: BACKUP_APP, exportedAt: now.toISOString(), data };
}

/** mountain-training-2026-11-16.json, using the date on this device. */
export function backupFileName(now: Date): string {
  return `mountain-training-${localISO(now)}.json`;
}

export type ParseResult =
  | { ok: true; file: BackupFile }
  | { ok: false; reason: 'notJson' | 'notOurs' | 'newerVersion' | 'invalid' };

const BackupFileSchema = z.object({
  app: z.literal(BACKUP_APP),
  exportedAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'expected a timestamp'),
  data: AppDataSchema,
});

export function parseBackup(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'notJson' };
  }
  if (typeof json !== 'object' || json === null || (json as { app?: unknown }).app !== BACKUP_APP) {
    return { ok: false, reason: 'notOurs' };
  }
  const version = (json as { data?: { version?: unknown } }).data?.version;
  if (typeof version === 'number' && version > APP_DATA_VERSION) return { ok: false, reason: 'newerVersion' };
  const parsed = BackupFileSchema.safeParse(json);
  return parsed.success ? { ok: true, file: parsed.data as BackupFile } : { ok: false, reason: 'invalid' };
}

export const PARSE_MESSAGES: Record<Exclude<ParseResult, { ok: true }>['reason'], string> = {
  notJson: "That file isn't a backup from this app.",
  notOurs: "That file isn't a backup from this app.",
  newerVersion: 'That backup is from a newer version of the app. Reload the app and try again.',
  invalid: 'That backup is damaged, so nothing was imported.',
};

export interface Summary {
  logs: number;
  changes: number;
  tests: number;
  trips: number;
  gear: number;
  /** Date of the newest log, or null when there are none. */
  newestLog: ISODate | null;
}

export function summarize(data: AppData): Summary {
  let newestLog: ISODate | null = null;
  for (const l of data.logs) if (newestLog === null || l.date > newestLog) newestLog = l.date;
  return { logs: data.logs.length, changes: data.overrides.length, tests: data.tests.length, trips: data.trips.length, gear: data.gear.length, newestLog };
}

/** Lines that warn me before an older copy overwrites newer data on this device. */
export function importWarnings(device: AppData, incoming: AppData): string[] {
  const d = summarize(device);
  const f = summarize(incoming);
  const out: string[] = [];
  if (d.newestLog && (!f.newestLog || d.newestLog > f.newestLog)) {
    out.push(
      f.newestLog
        ? `This device has newer logs (${shortDate(d.newestLog)}) than the file (${shortDate(f.newestLog)}).`
        : `This device has logs up to ${shortDate(d.newestLog)}; the file has none.`,
    );
  }
  if (d.logs > f.logs) {
    out.push(`This device has more logs (${d.logs}) than the file (${f.logs}).`);
  }
  return out;
}

/** The Monday closest to a date (Tue–Thu go back, Fri–Sun go forward). */
export function nearestMonday(date: ISODate): ISODate {
  return addDays(date, nearestMondayOffset(date));
}

const REMIND_AFTER_DAYS = 7;
const REMIND_NEVER_EXPORTED_AT = 3;

/** Whole days since the last export, or null if I never exported on this device. */
export function daysSinceExport(meta: Meta, today: ISODate): number | null {
  if (!meta.lastExportAt) return null;
  const t = new Date(meta.lastExportAt);
  if (Number.isNaN(t.getTime())) return null;
  return Math.max(0, daysBetween(localISO(t), today));
}

/**
 * The quiet reminder on Today: logs saved since the last export, and that export was
 * 7 or more days ago. Never exported: once there are at least 3 logs.
 */
export function shouldRemindBackup(data: AppData, meta: Meta, today: ISODate): boolean {
  const days = daysSinceExport(meta, today);
  if (days === null) return data.logs.length >= REMIND_NEVER_EXPORTED_AT;
  if (days < REMIND_AFTER_DAYS) return false;
  const since = meta.lastExportAt!;
  return data.logs.some((l) => l.savedAt > since);
}

/** "today", "yesterday", "3 days ago", "never". */
export function exportAgeText(meta: Meta, today: ISODate): string {
  const days = daysSinceExport(meta, today);
  if (days === null) return 'never';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
