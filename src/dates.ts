// Plain calendar dates as 'YYYY-MM-DD' strings. Plan logic rule 0.
// Never call new Date('YYYY-MM-DD'): JavaScript reads that as UTC midnight,
// which can land on the previous day in local time.
import type { Day } from './schema';

export type ISODate = string;

const DAY_ORDER: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function parts(iso: ISODate): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: "${iso}"`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Whole days since 1970-01-01. Date.UTC is used only as a calendar counter here. */
export function dayNumber(iso: ISODate): number {
  const [y, m, d] = parts(iso);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function fromDayNumber(n: number): ISODate {
  const dt = new Date(n * 86_400_000);
  return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()]
    .map((v, i) => String(v).padStart(i === 0 ? 4 : 2, '0'))
    .join('-');
}

export function addDays(iso: ISODate, days: number): ISODate {
  return fromDayNumber(dayNumber(iso) + days);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return dayNumber(to) - dayNumber(from);
}

/** The calendar date on this device right now (local time). */
export function localISO(now: Date = new Date()): ISODate {
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((v, i) => String(v).padStart(i === 0 ? 4 : 2, '0'))
    .join('-');
}

export function weekdayOf(iso: ISODate): Day {
  // 1970-01-01 was a Thursday (index 3 in DAY_ORDER).
  const idx = (((dayNumber(iso) + 3) % 7) + 7) % 7;
  return DAY_ORDER[idx];
}

export function isValidISO(iso: string): boolean {
  try {
    return fromDayNumber(dayNumber(iso)) === iso;
  } catch {
    return false;
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAY_NAMES: Record<Day, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

/** '16 Nov' */
export function shortDate(iso: ISODate): string {
  const [, m, d] = parts(iso);
  return `${d} ${MONTHS[m - 1]}`;
}

/** 'Monday 16 November' style, short month. */
export function longDate(iso: ISODate): string {
  return `${DAY_NAMES[weekdayOf(iso)]} ${shortDate(iso)}`;
}

export { DAY_ORDER };
