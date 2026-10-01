import { useSyncExternalStore } from 'react';
import type { TxType } from '../domain/money';
import type { Period, PeriodKind } from '../domain/periods';

/** Statistics state survives tab switches (kept in memory for the session). */
export interface StatsState {
  kind: PeriodKind;
  /** the selected period per kind, so switching tabs and back keeps the selection */
  periods: Partial<Record<PeriodKind, Period>>;
  chartType: TxType;
}

let state: StatsState = { kind: 'month', periods: {}, chartType: 'EXPENSE' };
const listeners = new Set<() => void>();

export function getStatsState(): StatsState {
  return state;
}

export function setStatsState(patch: Partial<StatsState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function setStatsPeriod(period: Period): void {
  setStatsState({ kind: period.kind, periods: { ...state.periods, [period.kind]: period } });
}

export function useStatsState(): StatsState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getStatsState,
    getStatsState,
  );
}
