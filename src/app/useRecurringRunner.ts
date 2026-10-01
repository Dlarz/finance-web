import { useEffect } from 'react';
import { cleanupOrphans } from '../data/maintenance';
import { runRecurringEngine } from '../data/recurringEngine';
import { clock, db } from './container';

/** Runs the recurring engine on start and whenever the app comes back to the foreground. */
export function useRecurringRunner(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      try {
        await runRecurringEngine(db, clock);
      } catch (e) {
        console.error('recurring engine failed', e);
      } finally {
        running = false;
      }
    };
    void run();
    cleanupOrphans(db).catch(() => {});
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [enabled]);
}
