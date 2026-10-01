import { describe, expect, it } from 'vitest';
import { nextOccurrenceOnOrAfter, nthOccurrence, occurrencesBetween } from './recurring';

describe('recurring schedule', () => {
  it('clamps the 31st to the last day of shorter months, from the start date', () => {
    const s = { frequency: 'MONTHLY' as const, interval: 1, startDate: '2026-01-31' };
    expect(nthOccurrence(s, 0)).toBe('2026-01-31');
    expect(nthOccurrence(s, 1)).toBe('2026-02-28');
    expect(nthOccurrence(s, 2)).toBe('2026-03-31');
    expect(nthOccurrence(s, 3)).toBe('2026-04-30');
  });

  it('handles Feb 29 yearly', () => {
    const s = { frequency: 'YEARLY' as const, interval: 1, startDate: '2024-02-29' };
    expect(nthOccurrence(s, 1)).toBe('2025-02-28');
    expect(nthOccurrence(s, 4)).toBe('2028-02-29');
  });

  it('supports every N', () => {
    expect(nthOccurrence({ frequency: 'DAILY', interval: 3, startDate: '2026-01-01' }, 2)).toBe('2026-01-07');
    expect(nthOccurrence({ frequency: 'WEEKLY', interval: 2, startDate: '2026-01-01' }, 1)).toBe('2026-01-15');
    expect(nthOccurrence({ frequency: 'MONTHLY', interval: 6, startDate: '2026-01-15' }, 1)).toBe('2026-07-15');
  });

  it('lists occurrences in a range', () => {
    const s = { frequency: 'MONTHLY' as const, interval: 1, startDate: '2026-01-31' };
    expect(occurrencesBetween(s, '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(occurrencesBetween(s, '2026-03-01', '2026-04-30')).toEqual(['2026-03-31', '2026-04-30']);
    expect(occurrencesBetween(s, '2025-01-01', '2025-12-31')).toEqual([]);
    const daily = { frequency: 'DAILY' as const, interval: 1, startDate: '2026-01-01' };
    expect(occurrencesBetween(daily, '2026-03-01', '2026-03-03')).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
    const weekly = { frequency: 'WEEKLY' as const, interval: 2, startDate: '2026-01-05' };
    expect(occurrencesBetween(weekly, '2026-02-01', '2026-02-28')).toEqual(['2026-02-02', '2026-02-16']);
  });

  it('respects the end date', () => {
    const s = { frequency: 'MONTHLY' as const, interval: 1, startDate: '2026-01-01', endDate: '2026-03-01' };
    expect(occurrencesBetween(s, '2026-01-01', '2026-12-31')).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(nextOccurrenceOnOrAfter(s, '2026-03-02')).toBeNull();
  });

  it('finds the next occurrence', () => {
    const s = { frequency: 'MONTHLY' as const, interval: 1, startDate: '2026-01-31' };
    expect(nextOccurrenceOnOrAfter(s, '2026-02-10')).toBe('2026-02-28');
    expect(nextOccurrenceOnOrAfter(s, '2026-02-28')).toBe('2026-02-28');
    expect(nextOccurrenceOnOrAfter(s, '2025-01-01')).toBe('2026-01-31');
    const yearly = { frequency: 'YEARLY' as const, interval: 1, startDate: '2020-06-15' };
    expect(nextOccurrenceOnOrAfter(yearly, '2026-06-16')).toBe('2027-06-15');
  });
});
