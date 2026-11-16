import { describe, expect, it } from 'vitest';
import { BACKUP_COPY_PREFIX, createStore, memoryStorage, storageKeys, STORAGE_KEY, type StorageLike } from './store';
import { emptyAppData, type SessionLog } from './logSchema';
import { upsertLog } from './logs';

const aLog: SessionLog = {
  id: 'a',
  date: '2026-11-16',
  week: 1,
  type: 'strengthA',
  status: 'done',
  sets: [{ exerciseId: 'back-squat', exerciseName: 'Back squat', setNumber: 1, reps: 5, unit: 'reps', kg: 80 }],
  savedAt: '2026-11-16T10:00:00Z',
};

describe('store', () => {
  it('starts empty when nothing is stored', () => {
    const store = createStore(memoryStorage());
    expect(store.getState()).toEqual({ data: emptyAppData(), corruptCopyKey: null, saveFailed: false });
  });

  it('round-trips through storage', () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    expect(store.save(upsertLog(store.getState().data, aLog))).toBe(true);
    const reloaded = createStore(storage);
    expect(reloaded.getState().data.logs).toEqual([aLog]);
  });

  it('keeps a copy of unreadable data, starts empty and does not overwrite it', () => {
    for (const bad of ['{not json', JSON.stringify({ version: 2, logs: [] }), JSON.stringify({ ...emptyAppData(), logs: [{ id: 1 }] })]) {
      const storage = memoryStorage();
      storage.setItem(STORAGE_KEY, bad);
      const store = createStore(storage, () => 1234);
      expect(store.getState().data).toEqual(emptyAppData());
      expect(store.getState().corruptCopyKey).toBe(`${STORAGE_KEY}.corrupt-1234`);
      expect(storage.getItem(`${STORAGE_KEY}.corrupt-1234`)).toBe(bad);
      expect(storage.getItem(STORAGE_KEY)).toBe(bad);
    }
  });

  it('reports a failed save and keeps the in-memory state', () => {
    const storage: StorageLike = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const store = createStore(storage);
    let calls = 0;
    store.subscribe(() => calls++);
    expect(store.save(upsertLog(store.getState().data, aLog))).toBe(false);
    expect(store.getState().saveFailed).toBe(true);
    expect(store.getState().data.logs).toEqual([aLog]);
    expect(calls).toBe(1);
  });

  it('takes changes from another tab and ignores unreadable ones', () => {
    const store = createStore(memoryStorage());
    store.receiveExternal(JSON.stringify(upsertLog(emptyAppData(), aLog)));
    expect(store.getState().data.logs).toHaveLength(1);
    store.receiveExternal('garbage');
    expect(store.getState().data.logs).toHaveLength(1);
  });

  it('an import keeps a recovery copy of the old data, and only the latest one', () => {
    const storage = memoryStorage();
    let t = 1000;
    const store = createStore(storage, () => t);
    store.save(upsertLog(store.getState().data, aLog));
    const before = storage.getItem(STORAGE_KEY);

    const incoming = { ...emptyAppData(), logs: [{ ...aLog, id: 'b', date: '2026-11-17' }] };
    expect(store.replaceAll(incoming)).toBe(true);
    expect(store.getState().data).toEqual(incoming);
    expect(storage.getItem(`${BACKUP_COPY_PREFIX}1000`)).toBe(before);
    expect(createStore(storage).getState().data).toEqual(incoming);

    t = 2000;
    expect(store.replaceAll(emptyAppData())).toBe(true);
    expect(storageKeys(storage).filter((k) => k.startsWith(BACKUP_COPY_PREFIX))).toEqual([`${BACKUP_COPY_PREFIX}2000`]);
    expect(JSON.parse(storage.getItem(`${BACKUP_COPY_PREFIX}2000`)!)).toEqual(incoming);
  });

  it('an import that cannot be stored changes nothing', () => {
    const base = memoryStorage();
    const store = createStore(base);
    store.save(upsertLog(store.getState().data, aLog));
    const full: StorageLike = {
      ...base,
      getItem: base.getItem,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const blocked = createStore(full);
    expect(blocked.replaceAll(emptyAppData())).toBe(false);
    expect(blocked.getState().data.logs).toEqual([aLog]);
    expect(base.getItem(STORAGE_KEY)).toContain('"id":"a"');
  });
});
