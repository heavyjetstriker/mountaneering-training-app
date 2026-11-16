// Small write helpers used by the screens. Each one goes through the store's save().
import type { PlanOverride } from './logSchema';
import { addOverride, removeOverride, resetAllOverrides } from './overrides';
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
