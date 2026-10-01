import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  addYears,
  daysInMonth,
  diffDays,
  endOfMonth,
  endOfWeek,
  isISODate,
  isLeapYear,
  isoWeekday,
  startOfWeek,
  startOfYear,
  endOfYear,
  fromDate,
  toDate,
} from './dates';

describe('dates', () => {
  it('validates ISO dates', () => {
    expect(isISODate('2026-02-28')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2024-02-29')).toBe(true);
    expect(isISODate('2023-02-29')).toBe(false);
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('26-01-01')).toBe(false);
    expect(isISODate(42)).toBe(false);
  });

  it('knows leap years', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(diffDays('2026-01-01', '2026-12-31')).toBe(364);
  });

  it('clamps when adding months and years', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonths('2026-03-15', -3)).toBe('2025-12-15');
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28');
    expect(addYears('2024-02-29', 4)).toBe('2028-02-29');
  });

  it('computes weekdays and week bounds for Monday and Sunday starts', () => {
    expect(isoWeekday('2026-09-28')).toBe(1); // Monday
    expect(isoWeekday('2026-10-04')).toBe(7); // Sunday
    expect(startOfWeek('2026-09-30', 'monday')).toBe('2026-09-28');
    expect(endOfWeek('2026-09-30', 'monday')).toBe('2026-10-04');
    expect(startOfWeek('2026-09-30', 'sunday')).toBe('2026-09-27');
    expect(endOfWeek('2026-09-30', 'sunday')).toBe('2026-10-03');
    expect(startOfWeek('2026-09-27', 'sunday')).toBe('2026-09-27');
    expect(startOfWeek('2026-09-27', 'monday')).toBe('2026-09-21');
    // week across a year boundary
    expect(startOfWeek('2027-01-01', 'monday')).toBe('2026-12-28');
    expect(endOfWeek('2026-12-30', 'monday')).toBe('2027-01-03');
  });

  it('computes month and year bounds', () => {
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29');
    expect(startOfYear('2026-06-15')).toBe('2026-01-01');
    expect(endOfYear('2026-06-15')).toBe('2026-12-31');
  });

  it('converts to and from JS dates in local time', () => {
    const d = toDate('2026-09-30');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(30);
    expect(fromDate(d)).toBe('2026-09-30');
  });
});
