import { describe, expect, it } from 'vitest';
import { chartBuckets, customPeriod, isCurrentPeriod, periodFor, shiftPeriod } from './periods';

describe('periods', () => {
  it('builds day, week, month and year periods', () => {
    expect(periodFor('day', '2026-09-30', 'monday')).toEqual({ kind: 'day', start: '2026-09-30', end: '2026-09-30' });
    expect(periodFor('week', '2026-09-30', 'monday')).toEqual({ kind: 'week', start: '2026-09-28', end: '2026-10-04' });
    expect(periodFor('week', '2026-09-30', 'sunday')).toEqual({ kind: 'week', start: '2026-09-27', end: '2026-10-03' });
    expect(periodFor('month', '2026-02-10', 'monday')).toEqual({ kind: 'month', start: '2026-02-01', end: '2026-02-28' });
    expect(periodFor('month', '2024-02-10', 'monday')).toEqual({ kind: 'month', start: '2024-02-01', end: '2024-02-29' });
    expect(periodFor('year', '2026-05-05', 'monday')).toEqual({ kind: 'year', start: '2026-01-01', end: '2026-12-31' });
  });

  it('shifts periods', () => {
    const week = periodFor('week', '2026-12-30', 'monday');
    expect(week).toEqual({ kind: 'week', start: '2026-12-28', end: '2027-01-03' });
    expect(shiftPeriod(week, 1, 'monday')).toEqual({ kind: 'week', start: '2027-01-04', end: '2027-01-10' });
    expect(shiftPeriod(periodFor('month', '2026-01-31', 'monday'), 1, 'monday')).toEqual({ kind: 'month', start: '2026-02-01', end: '2026-02-28' });
    expect(shiftPeriod(periodFor('year', '2026-01-31', 'monday'), -1, 'monday')).toEqual({ kind: 'year', start: '2025-01-01', end: '2025-12-31' });
    expect(shiftPeriod(periodFor('day', '2026-03-01', 'monday'), -1, 'monday').start).toBe('2026-02-28');
  });

  it('shifts custom periods by their own length', () => {
    const p = customPeriod('2026-09-05', '2026-09-30');
    expect(shiftPeriod(p, 1, 'monday')).toEqual({ kind: 'custom', start: '2026-10-01', end: '2026-10-26' });
    expect(shiftPeriod(p, -1, 'monday')).toEqual({ kind: 'custom', start: '2026-08-10', end: '2026-09-04' });
    expect(customPeriod('2026-09-30', '2026-09-05')).toEqual({ kind: 'custom', start: '2026-09-05', end: '2026-09-30' });
  });

  it('knows whether a period contains today', () => {
    expect(isCurrentPeriod(periodFor('week', '2026-09-30', 'monday'), '2026-10-04')).toBe(true);
    expect(isCurrentPeriod(periodFor('week', '2026-09-30', 'monday'), '2026-10-05')).toBe(false);
  });

  it('builds chart buckets', () => {
    expect(chartBuckets(periodFor('day', '2026-09-30', 'monday'), 'monday')).toBeNull();
    expect(chartBuckets(periodFor('week', '2026-09-30', 'monday'), 'monday')?.buckets).toHaveLength(7);
    expect(chartBuckets(periodFor('month', '2026-02-01', 'monday'), 'monday')?.buckets).toHaveLength(28);
    const year = chartBuckets(periodFor('year', '2026-02-01', 'monday'), 'monday');
    expect(year?.kind).toBe('month');
    expect(year?.buckets).toHaveLength(12);
    expect(year?.buckets[1]).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(chartBuckets(customPeriod('2026-09-05', '2026-09-30'), 'monday')?.kind).toBe('day');
    const weeks = chartBuckets(customPeriod('2026-07-01', '2026-09-30'), 'monday');
    expect(weeks?.kind).toBe('week');
    expect(weeks?.buckets[0]).toEqual({ start: '2026-07-01', end: '2026-07-05' });
    expect(weeks?.buckets[1]).toEqual({ start: '2026-07-06', end: '2026-07-12' });
    expect(weeks?.buckets.at(-1)?.end).toBe('2026-09-30');
    const months = chartBuckets(customPeriod('2026-01-15', '2026-09-30'), 'monday');
    expect(months?.kind).toBe('month');
    expect(months?.buckets[0]).toEqual({ start: '2026-01-15', end: '2026-01-31' });
    expect(months?.buckets).toHaveLength(9);
  });
});
