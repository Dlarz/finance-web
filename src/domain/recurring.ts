import { addDays, addMonths, addYears, diffDays, parseISODate, type ISODate } from './dates';

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface Schedule {
  frequency: Frequency;
  /** every N days/weeks/months/years, ≥ 1 */
  interval: number;
  startDate: ISODate;
  endDate?: ISODate | null;
}

/**
 * The n-th occurrence (n = 0 is the start date). Always computed from the start date,
 * never from the previous occurrence, so Jan 31 → Feb 28 → Mar 31 and Feb 29 → Feb 28 in
 * non-leap years.
 */
export function nthOccurrence(schedule: Schedule, n: number): ISODate {
  const steps = n * Math.max(1, schedule.interval);
  switch (schedule.frequency) {
    case 'DAILY':
      return addDays(schedule.startDate, steps);
    case 'WEEKLY':
      return addDays(schedule.startDate, steps * 7);
    case 'MONTHLY':
      return addMonths(schedule.startDate, steps);
    case 'YEARLY':
      return addYears(schedule.startDate, steps);
  }
}

/** A lower bound for n such that nthOccurrence(n) could be ≥ date. */
function lowerBoundIndex(schedule: Schedule, date: ISODate): number {
  if (date <= schedule.startDate) return 0;
  const interval = Math.max(1, schedule.interval);
  const days = diffDays(schedule.startDate, date);
  switch (schedule.frequency) {
    case 'DAILY':
      return Math.max(0, Math.floor(days / interval) - 1);
    case 'WEEKLY':
      return Math.max(0, Math.floor(days / (7 * interval)) - 1);
    case 'MONTHLY': {
      const a = parseISODate(schedule.startDate);
      const b = parseISODate(date);
      const months = (b.y - a.y) * 12 + (b.m - a.m);
      return Math.max(0, Math.floor(months / interval) - 1);
    }
    case 'YEARLY': {
      const years = parseISODate(date).y - parseISODate(schedule.startDate).y;
      return Math.max(0, Math.floor(years / interval) - 1);
    }
  }
}

/** All occurrence dates within [from, to] (inclusive), respecting the schedule's end date. */
export function occurrencesBetween(schedule: Schedule, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const last = schedule.endDate && schedule.endDate < to ? schedule.endDate : to;
  if (last < schedule.startDate || from > last) return out;
  let n = lowerBoundIndex(schedule, from);
  for (let guard = 0; guard < 100_000; guard++) {
    const d = nthOccurrence(schedule, n);
    if (d > last) break;
    if (d >= from) out.push(d);
    n++;
  }
  return out;
}

/** The first occurrence on or after the given date, or null when the schedule has ended. */
export function nextOccurrenceOnOrAfter(schedule: Schedule, date: ISODate): ISODate | null {
  let n = lowerBoundIndex(schedule, date);
  for (let guard = 0; guard < 100_000; guard++) {
    const d = nthOccurrence(schedule, n);
    if (schedule.endDate && d > schedule.endDate) return null;
    if (d >= date) return d;
    n++;
  }
  return null;
}

/** True when the start date's day of month can be clamped in shorter months (29, 30, 31). */
export function monthlyDayNeedsClamp(schedule: Schedule): boolean {
  return schedule.frequency === 'MONTHLY' && parseISODate(schedule.startDate).d > 28;
}
