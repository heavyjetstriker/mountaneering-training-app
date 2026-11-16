import { describe, expect, it } from 'vitest';
import rawPlan from './data/plan.json';
import { parsePlan } from './schema';
import { AppDataSchema, emptyAppData, type AppData, type GearItem, type Trip } from './logSchema';
import { buildEffectivePlan } from './plan';
import { makeBackup, parseBackup } from './backup';
import {
  defaultStatus,
  groupTrips,
  hikeOn,
  linkHost,
  normalizeLink,
  packPrefill,
  tripLine,
  tripsOn,
  tripTotals,
} from './trips';
import { addStarter, groupGear, toggleGear } from './gear';

const plan = parsePlan(rawPlan);
const empty = emptyAppData();
let seq = 0;
const trip = (date: string, status: Trip['status'], extra: Partial<Trip> = {}): Trip => ({
  id: `t${++seq}`,
  savedAt: `2026-11-16T10:00:${String(seq).padStart(2, '0')}.000Z`,
  date,
  route: `Route ${seq}`,
  area: 'Sintra',
  transport: 'train+bus',
  status,
  ...extra,
});

describe('trips', () => {
  it('planned soonest first, done newest first; a passed planned trip stays planned', () => {
    const a = trip('2026-11-28', 'planned');
    const b = trip('2026-11-21', 'planned');
    const old = trip('2026-11-14', 'planned');
    const d1 = trip('2026-11-07', 'done');
    const d2 = trip('2026-11-10', 'done');
    expect(groupTrips([a, d1, b, old, d2])).toEqual({ planned: [old, b, a], done: [d2, d1] });
  });

  it('totals count, km and climb, with missing numbers as 0', () => {
    const done = [trip('2026-11-07', 'done', { distanceKm: 14, climbM: 650 }), trip('2026-11-14', 'done', { distanceKm: 12.5 })];
    expect(tripTotals(done)).toEqual({ count: 2, km: 26.5, climbM: 650 });
    expect(tripTotals([])).toEqual({ count: 0, km: 0, climbM: 0 });
  });

  it('finds trips on a date', () => {
    const a = trip('2026-11-21', 'planned');
    expect(tripsOn([a, trip('2026-11-22', 'planned')], '2026-11-21')).toEqual([a]);
  });

  it('normalizes route links and rejects anything that is not http(s)', () => {
    expect(normalizeLink('')).toEqual({ ok: true, url: null });
    expect(normalizeLink('  komoot.com/tour/123 ')).toEqual({ ok: true, url: 'https://komoot.com/tour/123' });
    expect(normalizeLink('http://x.org')).toEqual({ ok: true, url: 'http://x.org/' });
    expect(normalizeLink('https://www.wikiloc.com/trails/1')).toEqual({ ok: true, url: 'https://www.wikiloc.com/trails/1' });
    expect(normalizeLink('javascript:alert(1)')).toEqual({ ok: false });
    expect(normalizeLink('not a link')).toEqual({ ok: false });
    expect(normalizeLink('hello')).toEqual({ ok: false });
    expect(linkHost('https://www.komoot.com/tour/123')).toBe('komoot.com');
    expect(linkHost('https://wikiloc.com/x')).toBe('wikiloc.com');
  });

  it('a new trip is planned from today on, done before', () => {
    expect(defaultStatus('2026-11-21', '2026-11-21')).toBe('planned');
    expect(defaultStatus('2026-11-22', '2026-11-21')).toBe('planned');
    expect(defaultStatus('2026-11-20', '2026-11-21')).toBe('done');
  });

  it("prefills the week's planned pack on hike days", () => {
    expect(packPrefill(plan, empty, '2026-11-21')).toBe(6); // week 1 Saturday, 6 kg
    expect(packPrefill(plan, empty, '2027-01-23')).toBe(12); // week 10 Saturday, 12 kg
    expect(packPrefill(plan, empty, '2027-02-06')).toBe(12); // week 12 long-day test, 12–14 kg
    expect(hikeOn(plan, empty, '2027-02-06')).toBe('longDayTest');
    expect(packPrefill(plan, empty, '2026-11-16')).toBeNull(); // a Monday
    expect(packPrefill(plan, empty, '2026-11-01')).toBeNull(); // before the plan
    const moved = buildEffectivePlan(plan, [
      { id: 'm', createdAt: '2026-11-17T00:00:00Z', override: { kind: 'moveDay', week: 1, from: 'sat', to: 'sun' } },
    ]);
    expect(packPrefill(moved, empty, '2026-11-21')).toBeNull();
    expect(packPrefill(moved, empty, '2026-11-22')).toBe(6);
  });

  it('describes a trip in one line', () => {
    expect(tripLine(trip('2026-11-21', 'planned', { distanceKm: 14, climbM: 650 }))).toBe(
      'Sintra · 14 km · 650 m · train and bus',
    );
    expect(tripLine(trip('2026-11-21', 'done', { area: 'Arrábida', transport: 'car', climbM: 1200, packKg: 8 }))).toBe(
      'Arrábida · 1,200 m · 8 kg pack · car',
    );
  });
});

describe('gear', () => {
  const item = (name: string, status: GearItem['status'], n: number): GearItem => ({
    id: `g${n}`,
    name,
    status,
    savedAt: `2026-11-16T10:00:0${n}.000Z`,
  });
  const list: AppData = { ...empty, gear: [item('Poles', 'have', 1), item('Boots', 'need', 2), item('Pack', 'need', 3)] };

  it('need first, then have, each in the order added', () => {
    const g = groupGear(list.gear);
    expect(g.need.map((x) => x.name)).toEqual(['Boots', 'Pack']);
    expect(g.have.map((x) => x.name)).toEqual(['Poles']);
  });

  it('toggles need and have', () => {
    const t = toggleGear(list, 'g2');
    expect(t.gear.find((g) => g.id === 'g2')!.status).toBe('have');
    expect(toggleGear(t, 'g2').gear.find((g) => g.id === 'g2')!.status).toBe('need');
  });

  it('adds the starter list, skipping names already there', () => {
    let n = 0;
    const mine: AppData = { ...empty, gear: [item(' hiking  BOOTS ', 'have', 1)] };
    const out = addStarter(mine, plan.starterGear!, new Date('2026-11-16T12:00:00Z'), () => `s${++n}`);
    expect(out.gear.map((g) => g.name)).toEqual([
      ' hiking  BOOTS ',
      'Trekking pack',
      'Trekking poles',
      'Heart-rate chest strap',
      'Water bottles for the loaded carry',
    ]);
    expect(out.gear.slice(1).every((g) => g.status === 'need')).toBe(true);
    expect(groupGear(out.gear).need.map((g) => g.name)[0]).toBe('Trekking pack');
    expect(addStarter(out, plan.starterGear!, new Date(), () => 'x').gear).toHaveLength(5);
  });
});

describe('schema', () => {
  it('old data loads; trips and gear round-trip; bad values are rejected', () => {
    expect(AppDataSchema.safeParse(empty).success).toBe(true);
    const d: AppData = {
      ...empty,
      trips: [trip('2026-11-21', 'planned', { distanceKm: 14, climbM: 650, packKg: 6, link: 'https://komoot.com/tour/1', note: 'Train 8:10' })],
      gear: [{ id: 'g', name: 'Boots', status: 'have', savedAt: '2026-11-16T10:00:00.000Z' }],
    };
    expect(AppDataSchema.parse(JSON.parse(JSON.stringify(d)))).toEqual(d);
    const bad = (t: Partial<Trip>) => AppDataSchema.safeParse({ ...empty, trips: [trip('2026-11-21', 'planned', t)] }).success;
    expect(bad({ link: 'javascript:alert(1)' })).toBe(false);
    expect(bad({ area: 'Alps' as Trip['area'] })).toBe(false);
    expect(bad({ route: 'x'.repeat(121) })).toBe(false);
    expect(bad({ distanceKm: 14.25 })).toBe(false);
    expect(bad({ climbM: 650.5 })).toBe(false);
  });

  it('a backup with a javascript: link is refused as damaged', () => {
    const file = makeBackup({ ...empty, trips: [trip('2026-11-21', 'planned')] }, new Date('2026-11-21T08:00:00Z'));
    expect(parseBackup(JSON.stringify(file)).ok).toBe(true);
    const evil = JSON.parse(JSON.stringify(file));
    evil.data.trips[0].link = 'javascript:alert(1)';
    expect(parseBackup(JSON.stringify(evil))).toEqual({ ok: false, reason: 'invalid' });
  });

  it('plan.json has the starter gear', () => {
    expect(plan.starterGear).toHaveLength(5);
  });
});
