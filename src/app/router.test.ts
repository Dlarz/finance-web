import { describe, expect, it } from 'vitest';
import { parseHash, toHash, type Route } from './router';

describe('router', () => {
  it('round-trips routes through the hash', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'stats' },
      { name: 'transactions', query: {} },
      { name: 'transactions', query: { type: 'EXPENSE', categoryId: 'abc', start: '2026-09-01', end: '2026-09-30' } },
      { name: 'add' },
      { name: 'edit', id: 'x1' },
      { name: 'transaction', id: 'x1' },
      { name: 'settings' },
      { name: 'categories' },
      { name: 'tags' },
      { name: 'recurring' },
      { name: 'rule', id: null },
      { name: 'rule', id: 'r1' },
      { name: 'install' },
    ];
    for (const r of routes) expect(parseHash(toHash(r))).toEqual(r);
  });

  it('falls back to home for unknown hashes', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#/nope')).toEqual({ name: 'home' });
    expect(parseHash('#/edit')).toEqual({ name: 'home' });
    expect(parseHash('#/settings/unknown')).toEqual({ name: 'settings' });
  });
});
