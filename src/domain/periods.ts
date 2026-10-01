import {
  addDays,
  addMonths,
  addYears,
  diffDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfMonth,
  startOfWeek,
  startOfYear,
  type ISODate,
  type WeekStart,
} from './dates';

export type PeriodKind = 'day' | 'week' | 'month' | 'year' | 'custom';

/** An inclusive date range. */
export interface Period {
  kind: PeriodKind;
  start: ISODate;
  end: ISODate;
}

export function periodFor(kind: PeriodKind, anchor: ISODate, weekStart: WeekStart): Period {
  switch (kind) {
    case 'day':
      return { kind, start: anchor, end: anchor };
    case 'week':
      return { kind, start: startOfWeek(anchor, weekStart), end: endOfWeek(anchor, weekStart) };
    case 'month':
      return { kind, start: startOfMonth(anchor), end: endOfMonth(anchor) };
    case 'year':
      return { kind, start: startOfYear(anchor), end: endOfYear(anchor) };
    case 'custom':
      return { kind, start: anchor, end: anchor };
  }
}

export function customPeriod(start: ISODate, end: ISODate): Period {
  return start <= end ? { kind: 'custom', start, end } : { kind: 'custom', start: end, end: start };
}

/** Moves a period forward (delta > 0) or back. Custom periods shift by their own length. */
export function shiftPeriod(period: Period, delta: number, weekStart: WeekStart): Period {
  switch (period.kind) {
    case 'day':
      return periodFor('day', addDays(period.start, delta), weekStart);
    case 'week':
      return periodFor('week', addDays(period.start, 7 * delta), weekStart);
    case 'month':
      return periodFor('month', addMonths(period.start, delta), weekStart);
    case 'year':
      return periodFor('year', addYears(period.start, delta), weekStart);
    case 'custom': {
      const length = diffDays(period.start, period.end) + 1;
      return { kind: 'custom', start: addDays(period.start, length * delta), end: addDays(period.end, length * delta) };
    }
  }
}

export function containsDate(period: Period, date: ISODate): boolean {
  return date >= period.start && date <= period.end;
}

export function isCurrentPeriod(period: Period, today: ISODate): boolean {
  return containsDate(period, today);
}

export function periodLengthDays(period: Period): number {
  return diffDays(period.start, period.end) + 1;
}

export type BucketKind = 'day' | 'week' | 'month';

export interface Bucket {
  start: ISODate;
  end: ISODate;
}

/**
 * Buckets for the bar chart: week = 7 days, month = each day, year = 12 months,
 * custom = days (≤ 31 days), weeks (≤ ~6 months), otherwise months. Day periods have no chart.
 */
export function chartBuckets(period: Period, weekStart: WeekStart): { kind: BucketKind; buckets: Bucket[] } | null {
  switch (period.kind) {
    case 'day':
      return null;
    case 'week':
    case 'month':
      return { kind: 'day', buckets: dayBuckets(period) };
    case 'year':
      return { kind: 'month', buckets: monthBuckets(period) };
    case 'custom': {
      const days = periodLengthDays(period);
      if (days <= 31) return { kind: 'day', buckets: dayBuckets(period) };
      if (days <= 186) return { kind: 'week', buckets: weekBuckets(period, weekStart) };
      return { kind: 'month', buckets: monthBuckets(period) };
    }
  }
}

function dayBuckets(period: Period): Bucket[] {
  const out: Bucket[] = [];
  for (let d = period.start; d <= period.end; d = addDays(d, 1)) out.push({ start: d, end: d });
  return out;
}

function weekBuckets(period: Period, weekStart: WeekStart): Bucket[] {
  const out: Bucket[] = [];
  let start = period.start;
  while (start <= period.end) {
    const weekEnd = endOfWeek(start, weekStart);
    const end = weekEnd < period.end ? weekEnd : period.end;
    out.push({ start, end });
    start = addDays(end, 1);
  }
  return out;
}

function monthBuckets(period: Period): Bucket[] {
  const out: Bucket[] = [];
  let start = period.start;
  while (start <= period.end) {
    const monthEnd = endOfMonth(start);
    const end = monthEnd < period.end ? monthEnd : period.end;
    out.push({ start, end });
    start = addDays(end, 1);
  }
  return out;
}
