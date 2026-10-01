import type { TxType } from './money';
import type { Bucket } from './periods';
import type { ISODate } from './dates';

export interface TxLike {
  type: TxType;
  amount: number;
  categoryId: string;
  date: ISODate;
}

export interface Totals {
  income: number;
  expenses: number;
  net: number;
}

export function totals(transactions: readonly TxLike[]): Totals {
  let income = 0;
  let expenses = 0;
  for (const t of transactions) {
    if (t.type === 'INCOME') income += t.amount;
    else expenses += t.amount;
  }
  return { income, expenses, net: income - expenses };
}

export interface CategoryShare {
  categoryId: string;
  amount: number;
  /** 0..1 share of the total */
  share: number;
}

/** Sum per category for one type, sorted by amount (largest first). */
export function categoryBreakdown(transactions: readonly TxLike[], type: TxType): { total: number; rows: CategoryShare[] } {
  const sums = new Map<string, number>();
  let total = 0;
  for (const t of transactions) {
    if (t.type !== type) continue;
    sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) + t.amount);
    total += t.amount;
  }
  const rows = [...sums.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount, share: total > 0 ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount || a.categoryId.localeCompare(b.categoryId));
  return { total, rows };
}

export const OTHERS_ID = '__others__';
export const OTHERS_THRESHOLD = 0.02;

export interface DonutSegment {
  /** category id, or OTHERS_ID for the combined small categories */
  id: string;
  amount: number;
  share: number;
  /** category ids combined into this segment (only for OTHERS_ID) */
  members: string[];
}

/** Segments for the ring: categories under the threshold are combined into one "Others" segment. */
export function donutSegments(rows: readonly CategoryShare[], threshold = OTHERS_THRESHOLD): DonutSegment[] {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (total <= 0) return [];
  const big: DonutSegment[] = [];
  const small: CategoryShare[] = [];
  for (const r of rows) {
    if (r.share < threshold) small.push(r);
    else big.push({ id: r.categoryId, amount: r.amount, share: r.share, members: [r.categoryId] });
  }
  if (small.length === 1) {
    const r = small[0]!;
    big.push({ id: r.categoryId, amount: r.amount, share: r.share, members: [r.categoryId] });
  } else if (small.length > 1) {
    const amount = small.reduce((s, r) => s + r.amount, 0);
    big.push({ id: OTHERS_ID, amount, share: amount / total, members: small.map((r) => r.categoryId) });
  }
  return big;
}

/** Sum of one type per bucket, in bucket order. */
export function bucketSums(transactions: readonly TxLike[], buckets: readonly Bucket[], type: TxType): number[] {
  const sums = new Array<number>(buckets.length).fill(0);
  if (buckets.length === 0) return sums;
  for (const t of transactions) {
    if (t.type !== type) continue;
    const idx = findBucket(buckets, t.date);
    if (idx >= 0) sums[idx] = (sums[idx] ?? 0) + t.amount;
  }
  return sums;
}

function findBucket(buckets: readonly Bucket[], date: ISODate): number {
  let lo = 0;
  let hi = buckets.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = buckets[mid]!;
    if (date < b.start) hi = mid - 1;
    else if (date > b.end) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/** Percentage 0..100 with one decimal, formatted for display (e.g. "12.5 %"). */
export function formatPercent(share: number): string {
  const pct = share * 100;
  const rounded = pct >= 10 || pct === 0 ? Math.round(pct).toString() : pct.toFixed(1).replace(/\.0$/, '');
  return `${rounded} %`;
}
