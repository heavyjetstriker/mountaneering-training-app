// Device-only info (mta.meta): when I last exported. Not part of AppData, never exported.
import { useSyncExternalStore } from 'react';
import { browserStorage } from './store';
import type { Meta } from './backup';

const META_KEY = 'mta.meta';
const listeners = new Set<() => void>();
let cache: Meta | null = null;

function read(): Meta {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(browserStorage().getItem(META_KEY) ?? '{}');
    const last = (parsed as Meta | null)?.lastExportAt;
    cache = typeof last === 'string' ? { lastExportAt: last } : {};
  } catch {
    cache = {};
  }
  return cache;
}

export function recordExport(at: Date = new Date()) {
  cache = { ...read(), lastExportAt: at.toISOString() };
  try {
    browserStorage().setItem(META_KEY, JSON.stringify(cache));
  } catch {
    /* the reminder may show again; nothing is lost */
  }
  listeners.forEach((l) => l());
}

export function useMeta(): Meta {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
  );
}
