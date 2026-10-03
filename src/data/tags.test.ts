import { beforeEach, describe, expect, it } from 'vitest';
import { createBackup, parseBackup, restoreBackup } from './backup';
import { buildDefaultCategories } from './defaultCategories';
import { newId, type FinanceDB } from './db';
import { fixedClock } from '../domain/dates';
import { completeOnboarding } from './maintenance';
import { addRule } from './rulesRepo';
import { ensureTags, listTagsWithUsage, normalizeTagName } from './tagsRepo';
import { createTestDb } from './testDb';
import { addTransaction, getTransactionDetails, tagNamesByTransaction, updateTransaction } from './transactionsRepo';

let db: FinanceDB;
let groceries: string;
let housing: string;
const clock = fixedClock('2026-10-03', 1_700_000_000_000);

beforeEach(async () => {
  db = createTestDb();
  await completeOnboarding(db, 'de', { startingBalance: 0, currency: 'CHF' });
  const cats = await db.categories.toArray();
  groceries = cats.find((c) => c.iconKey === 'shopping_cart')!.id;
  housing = cats.find((c) => c.iconKey === 'home')!.id;
  void buildDefaultCategories;
  void newId;
});

describe('tags', () => {
  it('normalises names', () => {
    expect(normalizeTagName('  Mama  ')).toBe('Mama');
    expect(normalizeTagName('a   b')).toBe('a b');
    expect(normalizeTagName('   ')).toBe('');
  });

  it('treats "mama" and "Mama" as the same tag, keeping the first spelling', async () => {
    const t1 = await addTransaction(db, clock, { type: 'EXPENSE', amount: 100, categoryId: groceries, date: '2026-10-01', comment: '', tagNames: ['Mama'] });
    const t2 = await addTransaction(db, clock, { type: 'EXPENSE', amount: 200, categoryId: groceries, date: '2026-10-02', comment: '', tagNames: ['mama', 'MAMA', 'Mama'] });
    expect(await db.tags.count()).toBe(1);
    expect((await db.tags.toArray())[0]!.name).toBe('Mama');
    expect((await getTransactionDetails(db, t1.id))!.tags.map((t) => t.name)).toEqual(['Mama']);
    expect((await getTransactionDetails(db, t2.id))!.tags.map((t) => t.name)).toEqual(['Mama']);
    expect(await db.transactionTags.count()).toBe(2);
    const usage = await listTagsWithUsage(db);
    expect(usage).toHaveLength(1);
    expect(usage[0]!.count).toBe(2);
  });

  it('keeps tags across an edit and shows them in details and lists', async () => {
    const tx = await addTransaction(db, clock, { type: 'EXPENSE', amount: 100, categoryId: groceries, date: '2026-10-01', comment: '', tagNames: ['coop', 'Weekly'] });
    expect((await tagNamesByTransaction(db)).get(tx.id)).toEqual(['coop', 'Weekly']);
    await updateTransaction(db, clock, tx.id, { type: 'EXPENSE', amount: 150, categoryId: groceries, date: '2026-10-01', comment: 'edited', tagNames: ['coop', 'Weekly', 'Mama'] });
    expect((await getTransactionDetails(db, tx.id))!.tags.map((t) => t.name)).toEqual(['coop', 'Mama', 'Weekly']);
    expect((await tagNamesByTransaction(db)).get(tx.id)).toEqual(['coop', 'Mama', 'Weekly']);
  });

  it('lists tags most used first', async () => {
    await addTransaction(db, clock, { type: 'EXPENSE', amount: 1, categoryId: groceries, date: '2026-10-01', comment: '', tagNames: ['rare', 'Mama'] });
    await addTransaction(db, clock, { type: 'EXPENSE', amount: 1, categoryId: groceries, date: '2026-10-01', comment: '', tagNames: ['Mama', 'coop'] });
    await addTransaction(db, clock, { type: 'EXPENSE', amount: 1, categoryId: groceries, date: '2026-10-01', comment: '', tagNames: ['Mama'] });
    expect((await listTagsWithUsage(db)).map((t) => `${t.name}:${t.count}`)).toEqual(['Mama:3', 'coop:1', 'rare:1']);
  });

  it('saves tags on a recurring rule and passes them to the generated transactions', async () => {
    const { rule, created } = await addRule(db, clock, {
      type: 'EXPENSE',
      amount: 165000,
      categoryId: housing,
      comment: 'Miete',
      tagNames: ['Miete', 'wohnen'],
      frequency: 'MONTHLY',
      interval: 1,
      startDate: '2026-08-01',
      endDate: null,
    });
    expect(created).toBe(3);
    expect(rule.tagIds).toHaveLength(2);
    const generated = await db.transactions.where('recurringRuleId').equals(rule.id).toArray();
    for (const tx of generated) expect((await getTransactionDetails(db, tx.id))!.tags.map((t) => t.name)).toEqual(['Miete', 'wohnen']);
    // the tag management shows them, counting the rule as a use too
    const usage = await listTagsWithUsage(db);
    expect(usage.map((t) => `${t.name}:${t.count}`)).toEqual(['Miete:4', 'wohnen:4']);
  });

  it('shows a tag that is only used by a rule in the tag management', async () => {
    await addRule(db, clock, { type: 'INCOME', amount: 1, categoryId: groceries, comment: '', tagNames: ['zukunft'], frequency: 'MONTHLY', interval: 1, startDate: '2027-01-01', endDate: null });
    expect(await db.transactions.count()).toBe(0);
    expect((await listTagsWithUsage(db)).map((t) => t.name)).toEqual(['zukunft']);
  });

  it('includes tags in the backup and restores them', async () => {
    const tx = await addTransaction(db, clock, { type: 'EXPENSE', amount: 100, categoryId: groceries, date: '2026-10-01', comment: '', tagNames: ['Mama', 'coop'] });
    await addRule(db, clock, { type: 'EXPENSE', amount: 1, categoryId: groceries, comment: '', tagNames: ['Miete'], frequency: 'YEARLY', interval: 1, startDate: '2027-01-01', endDate: null });
    const zip = await createBackup(db, clock, 'test');
    const target = createTestDb();
    await restoreBackup(target, await parseBackup(zip));
    expect((await getTransactionDetails(target, tx.id))!.tags.map((t) => t.name)).toEqual(['coop', 'Mama']);
    expect((await listTagsWithUsage(target)).map((t) => t.name).sort()).toEqual(['Mama', 'Miete', 'coop']);
    expect((await target.recurringRules.toArray())[0]!.tagIds).toHaveLength(1);
  });

  it('ensureTags returns one id per distinct name', async () => {
    const ids = await db.transaction('rw', db.tags, () => ensureTags(db, ['A', 'a', ' A ', 'b']));
    expect(ids).toHaveLength(2);
  });
});
