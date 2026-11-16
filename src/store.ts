// My records, kept as one versioned object in localStorage.
// Read once at start-up, validated, written whole through save().
import { useSyncExternalStore } from 'react';
import { AppDataSchema, emptyAppData, type AppData } from './logSchema';

export const STORAGE_KEY = 'mta.data';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Enumeration (localStorage has these); used to keep only the latest recovery copy. */
  readonly length?: number;
  key?(index: number): string | null;
}

export const BACKUP_COPY_PREFIX = `${STORAGE_KEY}.backup-`;

export function storageKeys(storage: StorageLike): string[] {
  const out: string[] = [];
  if (typeof storage.key !== 'function' || typeof storage.length !== 'number') return out;
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k !== null) out.push(k);
  }
  return out;
}

export interface StoreState {
  data: AppData;
  /** Stored data existed but couldn't be read; a copy was kept under this key. */
  corruptCopyKey: string | null;
  /** The last save failed (storage full or blocked). In-memory state is kept. */
  saveFailed: boolean;
}

export function parseStored(raw: string | null): AppData | null {
  if (raw === null) return emptyAppData();
  try {
    const result = AppDataSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function createStore(storage: StorageLike, now: () => number = Date.now) {
  let state: StoreState = load();
  const listeners = new Set<() => void>();

  function load(): StoreState {
    let raw: string | null = null;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch {
      raw = null;
    }
    const data = parseStored(raw);
    if (data) return { data, corruptCopyKey: null, saveFailed: false };
    // Never overwrite data we can't read: keep a copy for recovery and start empty.
    const corruptCopyKey = `${STORAGE_KEY}.corrupt-${now()}`;
    try {
      storage.setItem(corruptCopyKey, raw ?? '');
    } catch {
      /* the original is still under STORAGE_KEY until the next save */
    }
    return { data: emptyAppData(), corruptCopyKey, saveFailed: false };
  }

  function set(next: StoreState) {
    state = next;
    listeners.forEach((l) => l());
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Writes the whole object. Returns false (and keeps the in-memory state) if storage fails. */
    save(next: AppData): boolean {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(next));
        set({ ...state, data: next, saveFailed: false });
        return true;
      } catch {
        set({ ...state, data: next, saveFailed: true });
        return false;
      }
    },
    /**
     * Import: replace everything with `next`. The current stored data is copied to
     * mta.data.backup-<timestamp> first (only the latest copy is kept). Returns false and
     * changes nothing if either write fails.
     */
    replaceAll(next: AppData): boolean {
      let raw: string | null = null;
      try {
        raw = storage.getItem(STORAGE_KEY);
      } catch {
        raw = null;
      }
      const copyKey = `${BACKUP_COPY_PREFIX}${now()}`;
      const older = storageKeys(storage).filter((k) => k.startsWith(BACKUP_COPY_PREFIX) && k !== copyKey);
      try {
        storage.setItem(copyKey, raw ?? JSON.stringify(state.data));
      } catch {
        return false;
      }
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        try {
          storage.removeItem(copyKey);
        } catch {
          /* ignore */
        }
        return false;
      }
      for (const k of older) {
        try {
          storage.removeItem(k);
        } catch {
          /* an extra old copy is harmless */
        }
      }
      set({ data: next, corruptCopyKey: null, saveFailed: false });
      return true;
    },
    /** Another tab changed the data. Ignore values we can't read. */
    receiveExternal(raw: string | null) {
      const data = parseStored(raw);
      if (data) set({ ...state, data });
    },
    dismissSaveError() {
      if (state.saveFailed) set({ ...state, saveFailed: false });
    },
    dismissCorruptNotice() {
      if (state.corruptCopyKey) set({ ...state, corruptCopyKey: null });
    },
  };
}

export type Store = ReturnType<typeof createStore>;

/** In-memory stand-in when localStorage is missing or blocked. */
export function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
  };
}

export function browserStorage(): StorageLike {
  try {
    const ls = window.localStorage;
    ls.getItem(STORAGE_KEY); // throws if storage is blocked
    return ls;
  } catch {
    return memoryStorage();
  }
}

let singleton: Store | null = null;

export function getStore(): Store {
  if (!singleton) {
    singleton = createStore(browserStorage());
    // Keep two open tabs on the PC in step.
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) singleton!.receiveExternal(e.newValue);
    });
  }
  return singleton;
}

export function useStore(): StoreState {
  const store = getStore();
  return useSyncExternalStore(store.subscribe, store.getState);
}

export function useAppData(): AppData {
  return useStore().data;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
