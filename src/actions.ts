// Small write helpers used by the screens. Each one goes through the store's save().
import type { AppData, PlanOverride } from './logSchema';
import type { Plan } from './schema';
import { addOverride, removeOverride, resetAllOverrides, setStartDate } from './overrides';
import { clearAllDrafts } from './drafts';
import { getStore, newId } from './store';

export function commitOverride(override: PlanOverride): boolean {
  const store = getStore();
  return store.save(addOverride(store.getState().data, override, newId(), new Date().toISOString()));
}

export function resetOverride(id: string): boolean {
  const store = getStore();
  return store.save(removeOverride(store.getState().data, id));
}

export function resetAll(): boolean {
  const store = getStore();
  return store.save(resetAllOverrides(store.getState().data));
}

export function changeStartDate(plan: Plan, date: string): boolean {
  const store = getStore();
  return store.save(setStartDate(store.getState().data, plan, date, newId(), new Date().toISOString()));
}

/** Import: keeps a recovery copy of the current data, replaces it, and drops old drafts. */
export function importData(next: AppData): boolean {
  const ok = getStore().replaceAll(next);
  if (ok) clearAllDrafts();
  return ok;
}
