import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

let needRefresh = false;
let offlineReady = false;
let updateFn: ((reload?: boolean) => Promise<void>) | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setupPwa(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    updateFn = registerSW({
      immediate: true,
      onNeedRefresh() {
        needRefresh = true;
        emit();
      },
      onOfflineReady() {
        offlineReady = true;
        emit();
        window.setTimeout(() => {
          offlineReady = false;
          emit();
        }, 4000);
      },
      onRegisteredSW(_url, registration) {
        // Check for a new version whenever the app comes back to the foreground.
        if (!registration) return;
        const check = () => {
          if (document.visibilityState === 'visible') registration.update().catch(() => {});
        };
        document.addEventListener('visibilitychange', check);
        window.setInterval(check, 60 * 60 * 1000);
      },
    });
  } catch {
    /* service workers unavailable (e.g. private mode) */
  }
}

export function applyUpdate(): void {
  if (updateFn) void updateFn(true);
  else window.location.reload();
}

function get() {
  return { needRefresh, offlineReady };
}

let snapshot = get();

export function usePwaState() {
  return useSyncExternalStore(
    (l) => {
      const wrapped = () => {
        snapshot = get();
        l();
      };
      listeners.add(wrapped);
      return () => listeners.delete(wrapped);
    },
    () => snapshot,
    () => snapshot,
  );
}
