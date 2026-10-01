// All dates are ISO strings "YYYY-MM-DD" without time. Arithmetic uses UTC so time zones never leak in.

export type ISODate = string;
export type WeekStart = 'monday' | 'sunday';

export interface Clock {
  /** Today's local date as ISO string */
  today(): ISODate;
  /** Current time in milliseconds since epoch */
  now(): number;
}

export const systemClock: Clock = {
  today: () => fromDate(new Date()),
  now: () => Date.now(),
};

export function fixedClock(today: ISODate, now = Date.UTC(2026, 0, 1)): Clock {
  return { today: () => today, now: () => now };
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toISODate(y: number, m: number, d: number): ISODate {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parseISODate(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function parseISODate(s: ISODate): { y: number; m: number; d: number } {
  return { y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)), d: Number(s.slice(8, 10)) };
}

/** Local calendar date of a JS Date. */
export function fromDate(date: Date): ISODate {
  return toISODate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** JS Date at local midnight (for Intl formatting). */
export function toDate(iso: ISODate): Date {
  const { y, m, d } = parseISODate(iso);
  return new Date(y, m - 1, d);
}

function toUTC(iso: ISODate): number {
  const { y, m, d } = parseISODate(iso);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  const dt = new Date(ms);
  return toISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

export function addDays(iso: ISODate, n: number): ISODate {
  return fromUTC(toUTC(iso) + n * 86_400_000);
}

/** Adds months; the day is clamped to the last day of the target month (Jan 31 + 1 → Feb 28). */
export function addMonths(iso: ISODate, n: number): ISODate {
  const { y, m, d } = parseISODate(iso);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toISODate(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export function addYears(iso: ISODate, n: number): ISODate {
  const { y, m, d } = parseISODate(iso);
  return toISODate(y + n, m, Math.min(d, daysInMonth(y + n, m)));
}

/** Whole days from a to b (positive when b is after a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

/** ISO weekday: 1 = Monday … 7 = Sunday */
export function isoWeekday(iso: ISODate): number {
  const day = new Date(toUTC(iso)).getUTCDay(); // 0 = Sunday
  return day === 0 ? 7 : day;
}

export function startOfWeek(iso: ISODate, weekStart: WeekStart): ISODate {
  const wd = isoWeekday(iso);
  const offset = weekStart === 'monday' ? wd - 1 : wd % 7;
  return addDays(iso, -offset);
}

export function endOfWeek(iso: ISODate, weekStart: WeekStart): ISODate {
  return addDays(startOfWeek(iso, weekStart), 6);
}

export function startOfMonth(iso: ISODate): ISODate {
  const { y, m } = parseISODate(iso);
  return toISODate(y, m, 1);
}

export function endOfMonth(iso: ISODate): ISODate {
  const { y, m } = parseISODate(iso);
  return toISODate(y, m, daysInMonth(y, m));
}

export function startOfYear(iso: ISODate): ISODate {
  return `${iso.slice(0, 4)}-01-01`;
}

export function endOfYear(iso: ISODate): ISODate {
  return `${iso.slice(0, 4)}-12-31`;
}

export function yearOf(iso: ISODate): number {
  return Number(iso.slice(0, 4));
}

export function monthOf(iso: ISODate): number {
  return Number(iso.slice(5, 7));
}

export function dayOf(iso: ISODate): number {
  return Number(iso.slice(8, 10));
}

/** Inclusive list of days between two dates. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
