// Service worker updates and storage persistence. Browser-only glue, no plan logic.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * A new version waits until I tap Reload. Checks again whenever the app comes back
 * from the background. Drafts survive a reload, so a half-filled log is never lost.
 */
export function useAppUpdate(): { ready: boolean; reload: () => void } {
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      registration.current = r;
    },
  });

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) registration.current?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

  // Screenshots only: lets scripts/screenshots.py show the update Flash without deploying twice.
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    (window as unknown as { mtaPreviewUpdate?: () => void }).mtaPreviewUpdate = () => setPreview(true);
  }, []);

  return {
    ready: needRefresh || preview,
    reload: () => {
      if (needRefresh) void updateServiceWorker(true);
      else window.location.reload();
    },
  };
}

export type StorageStatus = 'checking' | 'kept' | 'notGuaranteed' | 'unknown';

let status: StorageStatus = 'checking';
let started = false;
const listeners = new Set<() => void>();

function setStatus(next: StorageStatus) {
  status = next;
  listeners.forEach((l) => l());
}

/** On start: ask the browser to keep my data (Chrome usually grants it to an installed app). */
export function ensurePersisted() {
  if (started) return;
  started = true;
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage?.persisted) {
    setStatus('unknown');
    return;
  }
  storage
    .persisted()
    .then(async (kept) => {
      if (kept) return true;
      return storage.persist ? storage.persist() : false;
    })
    .then((kept) => setStatus(kept ? 'kept' : 'notGuaranteed'))
    .catch(() => setStatus('unknown'));
}

export function useStorageStatus(): StorageStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}
