// Trips: planned and done hikes with a route link. Pure functions only.
import type { Plan, SessionType } from './schema';
import type { AppData, Trip } from './logSchema';
import { WebLink } from './logSchema';
import type { ISODate } from './dates';
import { getWeek, positionOn, sessionTypesFor } from './plan';
import { contextForWeek } from './tests';
import { lowerKg } from './logs';

const byDateThenSaved = (a: Trip, b: Trip) =>
  a.date === b.date ? a.savedAt.localeCompare(b.savedAt) : a.date < b.date ? -1 : 1;

/** Planned soonest first (a passed date stays planned until marked done); done newest first. */
export function groupTrips(trips: Trip[]): { planned: Trip[]; done: Trip[] } {
  const sorted = [...trips].sort(byDateThenSaved);
  return {
    planned: sorted.filter((t) => t.status === 'planned'),
    done: sorted.filter((t) => t.status === 'done').reverse(),
  };
}

export function tripTotals(done: Trip[]): { count: number; km: number; climbM: number } {
  return {
    count: done.length,
    km: Math.round(done.reduce((s, t) => s + (t.distanceKm ?? 0), 0) * 10) / 10,
    climbM: done.reduce((s, t) => s + (t.climbM ?? 0), 0),
  };
}

export function tripsOn(trips: Trip[], date: ISODate): Trip[] {
  return [...trips].filter((t) => t.date === date).sort(byDateThenSaved);
}

/** A link as typed → the stored URL. Empty → null. No scheme → https. Only http(s) is accepted. */
export function normalizeLink(text: string): { ok: true; url: string | null } | { ok: false } {
  const t = text.trim();
  if (t === '') return { ok: true, url: null };
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(t);
  const candidate = hasScheme ? t : `https://${t}`;
  if (!WebLink.safeParse(candidate).success) return { ok: false };
  // A bare word ("hello") becomes https://hello: not a site anyone means.
  if (!new URL(candidate).hostname.includes('.')) return { ok: false };
  return { ok: true, url: new URL(candidate).href };
}

/** "komoot.com", "wikiloc.com" */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function defaultStatus(date: ISODate, today: ISODate): Trip['status'] {
  return date >= today ? 'planned' : 'done';
}

const HIKE_DAYS: SessionType[] = ['longHike', 'longDayTest'];

/** The day's planned hike, if it has one (moved days and my week edits count). */
export function hikeOn(plan: Plan, data: Pick<AppData, 'tests' | 'logs'>, date: ISODate): SessionType | null {
  const pos = positionOn(plan, date);
  if (pos.status !== 'active') return null;
  const types = sessionTypesFor(plan, pos.week, pos.day, contextForWeek(plan, data, pos.week));
  return types.find((t) => HIKE_DAYS.includes(t)) ?? null;
}

/** The week's planned pack (lower kg) on a long hike or long-day test day; else null. */
export function packPrefill(plan: Plan, data: Pick<AppData, 'tests' | 'logs'>, date: ISODate): number | null {
  const pos = positionOn(plan, date);
  if (pos.status !== 'active' || !hikeOn(plan, data, date)) return null;
  return lowerKg(getWeek(plan, pos.week).longHike.packKg);
}

export const TRANSPORT_TEXT: Record<Trip['transport'], string> = { 'train+bus': 'train and bus', car: 'car' };

/** "Sintra · 14 km · 650 m · train and bus" */
export function tripLine(t: Trip): string {
  return [
    t.area,
    t.distanceKm !== undefined ? `${t.distanceKm} km` : '',
    t.climbM !== undefined ? `${t.climbM.toLocaleString('en-GB')} m` : '',
    t.packKg !== undefined ? `${t.packKg} kg pack` : '',
    TRANSPORT_TEXT[t.transport],
  ]
    .filter(Boolean)
    .join(' · ');
}

export function upsertTrip(data: AppData, t: Trip): AppData {
  return { ...data, trips: [...data.trips.filter((x) => x.id !== t.id), t] };
}

export function deleteTrip(data: AppData, id: string): AppData {
  return { ...data, trips: data.trips.filter((t) => t.id !== id) };
}
