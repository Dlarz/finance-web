import { beforeEach, describe, expect, it } from 'vitest';
import { fixedClock } from '../domain/dates';
import { buildDefaultCategories } from './defaultCategories';
import { newId, type FinanceDB } from './db';
import { runRecurringEngine } from './recurringEngine';
import { addRule, deleteRule, nextRuleDate, pauseRule, resumeRule, updateRule, type RuleInput } from './rulesRepo';
import { createTestDb } from './testDb';
import { addTransaction, deleteTransaction, restoreTransaction } from './transactionsRepo';

let db: FinanceDB;
let categoryId: string;

beforeEach(async () => {
  db = createTestDb();
  const cats = buildDefaultCategories('en', newId);
  await db.categories.bulkAdd(cats);
  categoryId = cats.find((c) => c.name === 'Housing & Rent')!.id;
});

const rentRule = (over: Partial<RuleInput> = {}): RuleInput => ({
  type: 'EXPENSE',
  amount: 165000,
  categoryId,
  comment: 'Rent',
  tagNames: ['rent'],
  frequency: 'MONTHLY',
  interval: 1,
  startDate: '2026-01-31',
  endDate: null,
  ...over,
});

describe('recurring engine', () => {
  it('creates missed occurrences up to today with month-end clamping', async () => {
    const clock = fixedClock('2026-04-15');
    const { created } = await addRule(db, clock, rentRule());
    expect(created).toBe(3);
    const dates = (await db.transactions.toArray()).map((t) => t.date).sort();
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    const refs = await db.transactionTags.toArray();
    expect(refs).toHaveLength(3);
  });

  it('never creates duplicates when run twice or concurrently', async () => {
    const clock = fixedClock('2026-04-15');
    await addRule(db, clock, rentRule());
    const [a, b] = await Promise.all([runRecurringEngine(db, clock), runRecurringEngine(db, clock)]);
    expect(a.created + b.created).toBe(0);
    expect(await db.transactions.count()).toBe(3);
    // even a direct duplicate insert is rejected by the unique index
    const first = (await db.transactions.toArray())[0]!;
    await expect(db.transactions.add({ ...first, id: newId() })).rejects.toMatchObject({ name: 'ConstraintError' });
  });

  it('keeps a deleted occurrence deleted', async () => {
    const clock = fixedClock('2026-04-15');
    await addRule(db, clock, rentRule());
    const feb = (await db.transactions.toArray()).find((t) => t.date === '2026-02-28')!;
    const snapshot = await deleteTransaction(db, feb.id);
    expect(snapshot).not.toBeNull();
    await runRecurringEngine(db, clock);
    expect((await db.transactions.toArray()).map((t) => t.date).sort()).toEqual(['2026-01-31', '2026-03-31']);
    // undo brings it back and the engine still does not duplicate it
    await restoreTransaction(db, snapshot!);
    await runRecurringEngine(db, clock);
    expect(await db.transactions.count()).toBe(3);
    expect(await db.tombstones.count()).toBe(0);
  });

  it('respects the end date', async () => {
    const clock = fixedClock('2026-12-31');
    const { created } = await addRule(db, clock, rentRule({ startDate: '2026-01-01', endDate: '2026-03-01' }));
    expect(created).toBe(3);
    const rule = (await db.recurringRules.toArray())[0]!;
    expect(nextRuleDate(rule, '2026-12-31')).toBeNull();
  });

  it('creates nothing while paused and does not back-fill after resuming', async () => {
    const clock1 = fixedClock('2026-02-15');
    const { rule } = await addRule(db, clock1, rentRule({ startDate: '2026-01-01' }));
    expect(await db.transactions.count()).toBe(2);
    await pauseRule(db, clock1, rule.id);
    const clock2 = fixedClock('2026-05-15');
    expect((await runRecurringEngine(db, clock2)).created).toBe(0);
    const paused = await db.recurringRules.get(rule.id);
    expect(nextRuleDate(paused!, '2026-05-15')).toBeNull();
    await resumeRule(db, clock2, rule.id);
    expect(await db.transactions.count()).toBe(2); // March, April, May 1 are not back-filled
    const resumed = await db.recurringRules.get(rule.id);
    expect(nextRuleDate(resumed!, '2026-05-15')).toBe('2026-06-01');
    const clock3 = fixedClock('2026-06-01');
    expect((await runRecurringEngine(db, clock3)).created).toBe(1);
  });

  it('starts a future rule on its start date', async () => {
    const clock = fixedClock('2026-09-30');
    const { created, rule } = await addRule(db, clock, rentRule({ startDate: '2026-10-15' }));
    expect(created).toBe(0);
    expect(nextRuleDate(rule, '2026-09-30')).toBe('2026-10-15');
    expect((await runRecurringEngine(db, fixedClock('2026-10-15'))).created).toBe(1);
  });

  it('links a saved transaction as the first occurrence', async () => {
    const clock = fixedClock('2026-03-10');
    const tx = await addTransaction(db, clock, { type: 'EXPENSE', amount: 165000, categoryId, date: '2026-01-10', comment: 'Rent', tagNames: [] });
    const { created } = await addRule(db, clock, rentRule({ startDate: '2026-01-10' }), { firstOccurrenceTransactionId: tx.id });
    expect(created).toBe(2);
    const dates = (await db.transactions.toArray()).map((t) => t.occurrenceDate).sort();
    expect(dates).toEqual(['2026-01-10', '2026-02-10', '2026-03-10']);
  });

  it('edits only affect future occurrences', async () => {
    const clock = fixedClock('2026-03-10');
    const { rule } = await addRule(db, clock, rentRule({ startDate: '2026-01-01' }));
    await updateRule(db, clock, rule.id, rentRule({ startDate: '2026-01-01', amount: 170000 }));
    const amounts = (await db.transactions.toArray()).map((t) => t.amount);
    expect(amounts).toEqual([165000, 165000, 165000]);
    expect((await runRecurringEngine(db, fixedClock('2026-04-01'))).created).toBe(1);
    expect((await db.transactions.where('date').equals('2026-04-01').first())!.amount).toBe(170000);
  });

  it('deletes a rule with or without its transactions', async () => {
    const clock = fixedClock('2026-03-10');
    const a = await addRule(db, clock, rentRule({ startDate: '2026-01-01' }));
    const b = await addRule(db, clock, rentRule({ startDate: '2026-01-05', comment: 'Other' }));
    await deleteRule(db, a.rule.id, false);
    expect(await db.transactions.count()).toBe(6);
    expect((await db.transactions.toArray()).filter((t) => t.recurringRuleId).length).toBe(3);
    await deleteRule(db, b.rule.id, true);
    expect(await db.transactions.count()).toBe(3);
    expect(await db.recurringRules.count()).toBe(0);
  });
});
