import { useSyncExternalStore } from 'react';
import type { ISODate } from '../domain/dates';
import type { TxType } from '../domain/money';

export interface TransactionsQuery {
  type?: TxType;
  categoryId?: string;
  start?: ISODate;
  end?: ISODate;
}

export type Route =
  | { name: 'home' }
  | { name: 'stats' }
  | { name: 'transactions'; query: TransactionsQuery }
  | { name: 'add' }
  | { name: 'edit'; id: string }
  | { name: 'transaction'; id: string }
  | { name: 'settings' }
  | { name: 'categories' }
  | { name: 'tags' }
  | { name: 'recurring' }
  | { name: 'rule'; id: string | null }
  | { name: 'install' };

export const TAB_ROUTES = new Set<Route['name']>(['home', 'stats', 'transactions']);

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const [pathRaw = '', queryRaw = ''] = raw.split('?');
  const parts = pathRaw.split('/').filter(Boolean);
  const params = new URLSearchParams(queryRaw);
  switch (parts[0]) {
    case undefined:
    case '':
      return { name: 'home' };
    case 'stats':
      return { name: 'stats' };
    case 'transactions': {
      const query: TransactionsQuery = {};
      const type = params.get('type');
      if (type === 'EXPENSE' || type === 'INCOME') query.type = type;
      const categoryId = params.get('category');
      if (categoryId) query.categoryId = categoryId;
      const start = params.get('start');
      const end = params.get('end');
      if (start) query.start = start;
      if (end) query.end = end;
      return { name: 'transactions', query };
    }
    case 'add':
      return { name: 'add' };
    case 'edit':
      return parts[1] ? { name: 'edit', id: parts[1] } : { name: 'home' };
    case 'tx':
      return parts[1] ? { name: 'transaction', id: parts[1] } : { name: 'home' };
    case 'settings':
      switch (parts[1]) {
        case undefined:
          return { name: 'settings' };
        case 'categories':
          return { name: 'categories' };
        case 'tags':
          return { name: 'tags' };
        case 'recurring':
          if (parts[2] === 'new') return { name: 'rule', id: null };
          if (parts[2]) return { name: 'rule', id: parts[2] };
          return { name: 'recurring' };
        default:
          return { name: 'settings' };
      }
    case 'install':
      return { name: 'install' };
    default:
      return { name: 'home' };
  }
}

export function toHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'stats':
      return '#/stats';
    case 'transactions': {
      const p = new URLSearchParams();
      if (route.query.type) p.set('type', route.query.type);
      if (route.query.categoryId) p.set('category', route.query.categoryId);
      if (route.query.start) p.set('start', route.query.start);
      if (route.query.end) p.set('end', route.query.end);
      const q = p.toString();
      return q ? `#/transactions?${q}` : '#/transactions';
    }
    case 'add':
      return '#/add';
    case 'edit':
      return `#/edit/${route.id}`;
    case 'transaction':
      return `#/tx/${route.id}`;
    case 'settings':
      return '#/settings';
    case 'categories':
      return '#/settings/categories';
    case 'tags':
      return '#/settings/tags';
    case 'recurring':
      return '#/settings/recurring';
    case 'rule':
      return `#/settings/recurring/${route.id ?? 'new'}`;
    case 'install':
      return '#/install';
  }
}

type Listener = () => void;
type BackGuard = () => boolean;

interface HistoryState {
  depth: number;
}

let current: Route = typeof window !== 'undefined' ? parseHash(window.location.hash) : { name: 'home' };
const listeners = new Set<Listener>();
let guard: BackGuard | null = null;
let ignoreNextPop = false;

function depth(): number {
  const s = typeof window !== 'undefined' ? (window.history.state as HistoryState | null) : null;
  return s && typeof s.depth === 'number' ? s.depth : 0;
}

function emit(): void {
  for (const l of listeners) l();
}

function setRoute(route: Route): void {
  current = route;
  emit();
}

if (typeof window !== 'undefined') {
  if (!window.history.state) window.history.replaceState({ depth: 0 } satisfies HistoryState, '');
  window.addEventListener('popstate', () => {
    if (ignoreNextPop) {
      ignoreNextPop = false;
      return;
    }
    const next = parseHash(window.location.hash);
    if (guard && !guard()) {
      // The user swiped back with unsaved changes: return to the guarded screen and let it ask.
      ignoreNextPop = true;
      window.history.forward();
      return;
    }
    setRoute(next);
  });
}

export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  if (typeof window === 'undefined') return;
  const hash = toHash(route);
  if (options.replace) {
    window.history.replaceState({ depth: depth() } satisfies HistoryState, '', hash);
  } else {
    window.history.pushState({ depth: depth() + 1 } satisfies HistoryState, '', hash);
  }
  setRoute(route);
}

/** Goes back in history, or to the home tab when the app was opened directly on this screen. */
export function goBack(fallback: Route = { name: 'home' }): void {
  if (typeof window === 'undefined') return;
  if (depth() > 0) {
    guard = null;
    window.history.back();
  } else {
    navigate(fallback, { replace: true });
  }
}

/** Registers a guard that can block browser back gestures (returns false to block). */
export function setBackGuard(fn: BackGuard | null): void {
  guard = fn;
}

export function getRoute(): Route {
  return current;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getRoute, getRoute);
}
