// Small write helpers used by the screens. Each one goes through the store's save().
import type { AppData, PlanOverride } from './logSchema';
import type { Plan } from './schema';
import { addOverride, removeOverride, resetAllOverrides, setStartDate } from './overrides';
import { clearAllDrafts } from './drafts';
import { activateCycle, addCycle, deleteCycle, updateCycle } from './cycles';
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

// ---------- training cycles (milestone 8) ----------

/** A new cycle with this plan; returns its id (null if it couldn't be saved). */
export function createCycle(plan: Plan): string | null {
  const store = getStore();
  const now = new Date().toISOString();
  const id = newId();
  const cycle = { id, name: plan.name?.trim() || 'New cycle', createdAt: now, savedAt: now, plan };
  return store.save(addCycle(store.getState().data, cycle)) ? id : null;
}

/** One editing step on a cycle's plan, saved straight away. */
export function editCycle(id: string, change: (plan: Plan) => Plan): boolean {
  const store = getStore();
  return store.save(updateCycle(store.getState().data, id, change, new Date().toISOString()));
}

export function removeCycle(id: string): boolean {
  const store = getStore();
  return store.save(deleteCycle(store.getState().data, id));
}

/** Use a cycle, or null for the 12-week plan. */
export function switchCycle(id: string | null): boolean {
  const store = getStore();
  const data = store.getState().data;
  const next = activateCycle(data, id);
  return next !== data && store.save(next);
}
