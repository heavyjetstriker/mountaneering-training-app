// Gear checklist: need / have. Pure functions only.
import type { AppData, GearItem } from './logSchema';

const added = (a: GearItem, b: GearItem) => a.savedAt.localeCompare(b.savedAt);

/** Need first, then have; each in the order added. */
export function groupGear(items: GearItem[]): { need: GearItem[]; have: GearItem[] } {
  const sorted = [...items].sort(added);
  return { need: sorted.filter((g) => g.status === 'need'), have: sorted.filter((g) => g.status === 'have') };
}

export function toggleGear(data: AppData, id: string): AppData {
  return {
    ...data,
    gear: data.gear.map((g) => (g.id === id ? { ...g, status: g.status === 'need' ? 'have' : 'need' } : g)),
  };
}

const key = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * The plan's starter list, added as "need", skipping names already in my list.
 * `now` is a base timestamp; each item gets its own so they keep their order.
 */
export function addStarter(data: AppData, names: string[], now: Date, newId: () => string): AppData {
  const have = new Set(data.gear.map((g) => key(g.name)));
  const fresh: GearItem[] = [];
  for (const name of names) {
    if (have.has(key(name))) continue;
    have.add(key(name));
    fresh.push({ id: newId(), name: name.trim(), status: 'need', savedAt: new Date(now.getTime() + fresh.length).toISOString() });
  }
  return { ...data, gear: [...data.gear, ...fresh] };
}

/** Keeps an item's place in the list when edited (savedAt is its position). */
export function upsertGear(data: AppData, item: GearItem): AppData {
  const i = data.gear.findIndex((g) => g.id === item.id);
  if (i < 0) return { ...data, gear: [...data.gear, item] };
  const gear = [...data.gear];
  gear[i] = item;
  return { ...data, gear };
}

export function deleteGear(data: AppData, id: string): AppData {
  return { ...data, gear: data.gear.filter((g) => g.id !== id) };
}
