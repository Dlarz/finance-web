import { useSyncExternalStore } from 'react';
import type { ISODate } from '../domain/dates';
import type { TxType } from '../domain/money';

export interface TxFilters {
  type: TxType | null;
  categoryIds: string[];
  tagNames: string[];
  start: ISODate | null;
  end: ISODate | null;
  hasPictures: boolean;
}

export interface TxListState {
  search: string;
  filters: TxFilters;
  /** the route query this state was initialised from */
  queryKey: string;
}

export const EMPTY_FILTERS: TxFilters = { type: null, categoryIds: [], tagNames: [], start: null, end: null, hasPictures: false };

let state: TxListState = { search: '', filters: EMPTY_FILTERS, queryKey: '' };
const listeners = new Set<() => void>();

export function getTxListState(): TxListState {
  return state;
}

export function setTxListState(patch: Partial<TxListState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function countActiveFilters(f: TxFilters): number {
  return (f.type ? 1 : 0) + f.categoryIds.length + f.tagNames.length + (f.start || f.end ? 1 : 0) + (f.hasPictures ? 1 : 0);
}

export function useTxListState(): TxListState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getTxListState,
    getTxListState,
  );
}
