import { describe, expect, it } from 'vitest';
import { bucketSums, categoryBreakdown, donutSegments, formatPercent, OTHERS_ID, totals } from './statistics';
import { computeBalance } from './balance';
import { buildCsv, csvAmount } from './csv';

const tx = (type: 'EXPENSE' | 'INCOME', amount: number, categoryId: string, date = '2026-09-10') => ({ type, amount, categoryId, date });

describe('statistics', () => {
  it('sums income, expenses and net', () => {
    expect(totals([tx('INCOME', 500000, 'salary'), tx('EXPENSE', 120000, 'rent'), tx('EXPENSE', 5000, 'food')])).toEqual({
      income: 500000,
      expenses: 125000,
      net: 375000,
    });
  });

  it('breaks down by category with shares, sorted by amount', () => {
    const { total, rows } = categoryBreakdown([tx('EXPENSE', 3000, 'a'), tx('EXPENSE', 7000, 'b'), tx('INCOME', 100, 'c'), tx('EXPENSE', 1000, 'a')], 'EXPENSE');
    expect(total).toBe(11000);
    expect(rows).toEqual([
      { categoryId: 'b', amount: 7000, share: 7000 / 11000 },
      { categoryId: 'a', amount: 4000, share: 4000 / 11000 },
    ]);
  });

  it('combines categories under 2 % into Others', () => {
    const rows = [
      { categoryId: 'a', amount: 9600, share: 0.96 },
      { categoryId: 'b', amount: 150, share: 0.015 },
      { categoryId: 'c', amount: 150, share: 0.015 },
      { categoryId: 'd', amount: 100, share: 0.01 },
    ];
    const segments = donutSegments(rows);
    expect(segments).toHaveLength(2);
    expect(segments[1]).toEqual({ id: OTHERS_ID, amount: 400, share: 0.04, members: ['b', 'c', 'd'] });
  });

  it('keeps a single small category as itself', () => {
    const rows = [
      { categoryId: 'a', amount: 9900, share: 0.99 },
      { categoryId: 'b', amount: 100, share: 0.01 },
    ];
    expect(donutSegments(rows).map((s) => s.id)).toEqual(['a', 'b']);
    expect(donutSegments([])).toEqual([]);
  });

  it('sums per bucket', () => {
    const buckets = [
      { start: '2026-09-01', end: '2026-09-07' },
      { start: '2026-09-08', end: '2026-09-14' },
    ];
    const list = [tx('EXPENSE', 100, 'a', '2026-09-01'), tx('EXPENSE', 200, 'a', '2026-09-07'), tx('EXPENSE', 400, 'a', '2026-09-10'), tx('EXPENSE', 800, 'a', '2026-09-20'), tx('INCOME', 5, 'a', '2026-09-10')];
    expect(bucketSums(list, buckets, 'EXPENSE')).toEqual([300, 400]);
    expect(bucketSums(list, buckets, 'INCOME')).toEqual([0, 5]);
  });

  it('formats percentages', () => {
    expect(formatPercent(0.125)).toBe('13 %');
    expect(formatPercent(0.015)).toBe('1.5 %');
    expect(formatPercent(0)).toBe('0 %');
    expect(formatPercent(1)).toBe('100 %');
  });
});

describe('balance', () => {
  it('adds income and subtracts expenses from the starting balance', () => {
    expect(computeBalance(100000, [tx('INCOME', 500000, 'a'), tx('EXPENSE', 120000, 'b')])).toBe(480000);
    expect(computeBalance(-5000, [])).toBe(-5000);
  });
});

describe('csv', () => {
  it('formats amounts without thousands separators, negative for expenses', () => {
    expect(csvAmount(123450, 'EXPENSE')).toBe('-1234.50');
    expect(csvAmount(500, 'INCOME')).toBe('5.00');
  });

  it('builds a semicolon separated file with BOM and quoting', () => {
    const csv = buildCsv([
      { date: '2026-09-10', type: 'EXPENSE', category: 'Groceries', amount: 1250, currency: 'CHF', tags: ['coop', 'weekly'], comment: 'Milk; "eggs"' },
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('date;type;category;amount;currency;tags;comment');
    expect(lines[1]).toBe('2026-09-10;EXPENSE;Groceries;-12.50;CHF;coop, weekly;"Milk; ""eggs"""');
  });
});
