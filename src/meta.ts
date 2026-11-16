// Device-only info (mta.meta): when I last exported, the rest timer length. Not part of AppData, never exported.
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
    const p = (parsed ?? {}) as Meta;
    cache = {};
    if (typeof p.lastExportAt === 'string') cache.lastExportAt = p.lastExportAt;
    if (typeof p.restSeconds === 'number' && p.restSeconds > 0 && p.restSeconds <= 600) cache.restSeconds = p.restSeconds;
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Meta) {
  cache = next;
  try {
    browserStorage().setItem(META_KEY, JSON.stringify(cache));
  } catch {
    /* device-only and non-essential: the reminder may show again, the timer length resets */
  }
  listeners.forEach((l) => l());
}

export function recordExport(at: Date = new Date()) {
  write({ ...read(), lastExportAt: at.toISOString() });
}

export function setRestSeconds(seconds: number) {
  write({ ...read(), restSeconds: seconds });
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
