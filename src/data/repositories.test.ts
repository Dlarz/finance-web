import { beforeEach, describe, expect, it } from 'vitest';
import { fixedClock } from '../domain/dates';
import { addCategory, deleteCategory, reorderCategories, sortCategories } from './categoriesRepo';
import { buildDefaultCategories } from './defaultCategories';
import { newId, type FinanceDB } from './db';
import { createTestDb } from './testDb';
import { deleteTag, listTagsWithUsage, renameTag } from './tagsRepo';
import { addTransaction, deleteTransaction, getTransactionDetails, lastCreatedTransaction, restoreTransaction, sortTransactions, updateTransaction } from './transactionsRepo';

let db: FinanceDB;
const clock = fixedClock('2026-09-30', 1_700_000_000_000);
let groceries: string;
let other: string;

beforeEach(async () => {
  db = createTestDb();
  const cats = buildDefaultCategories('en', newId);
  await db.categories.bulkAdd(cats);
  groceries = cats.find((c) => c.name === 'Groceries')!.id;
  other = cats.find((c) => c.name === 'Other' && c.type === 'EXPENSE')!.id;
});

const img = () => ({ blob: new Blob(['full'], { type: 'image/jpeg' }), thumb: new Blob(['thumb'], { type: 'image/jpeg' }), width: 10, height: 20 });

describe('transactions', () => {
  it('adds with tags and pictures, then deletes and restores everything', async () => {
    const tx = await addTransaction(db, clock, { type: 'EXPENSE', amount: 1250, categoryId: groceries, date: '2026-09-29', comment: ' Milk ', tagNames: ['Coop', 'coop', 'Weekly'] }, [img(), img()]);
    const details = await getTransactionDetails(db, tx.id);
    expect(details!.transaction.comment).toBe('Milk');
    expect(details!.tags.map((t) => t.name)).toEqual(['Coop', 'Weekly']);
    expect(details!.attachments).toHaveLength(2);
    const snapshot = await deleteTransaction(db, tx.id);
    expect(await db.transactions.count()).toBe(0);
    expect(await db.attachments.count()).toBe(0);
    expect(await db.tags.count()).toBe(0); // unused tags are pruned
    await restoreTransaction(db, snapshot!);
    const restored = await getTransactionDetails(db, tx.id);
    expect(restored!.tags.map((t) => t.name)).toEqual(['Coop', 'Weekly']);
    expect(restored!.attachments).toHaveLength(2);
    expect(await restored!.attachments[0]!.blob.text()).toBe('full');
  });

  it('updates fields, tags and pictures', async () => {
    const tx = await addTransaction(db, clock, { type: 'EXPENSE', amount: 1250, categoryId: groceries, date: '2026-09-29', comment: '', tagNames: ['a'] }, [img()]);
    const before = await getTransactionDetails(db, tx.id);
    await updateTransaction(db, clock, tx.id, { type: 'INCOME', amount: 99, categoryId: groceries, date: '2026-09-28', comment: 'x', tagNames: ['b'] }, { newImages: [img()], removeAttachmentIds: [before!.attachments[0]!.id] });
    const after = await getTransactionDetails(db, tx.id);
    expect(after!.transaction).toMatchObject({ type: 'INCOME', amount: 99, date: '2026-09-28', comment: 'x' });
    expect(after!.tags.map((t) => t.name)).toEqual(['b']);
    expect(after!.attachments).toHaveLength(1);
    expect(after!.attachments[0]!.id).not.toBe(before!.attachments[0]!.id);
    expect((await db.tags.toArray()).map((t) => t.name)).toEqual(['b']);
  });

  it('sorts by date then createdAt, newest first, and knows the last created one', async () => {
    const a = await addTransaction(db, { ...clock, now: () => 1 }, { type: 'EXPENSE', amount: 1, categoryId: groceries, date: '2026-09-20', comment: '', tagNames: [] });
    const b = await addTransaction(db, { ...clock, now: () => 2 }, { type: 'EXPENSE', amount: 1, categoryId: groceries, date: '2026-09-25', comment: '', tagNames: [] });
    const c = await addTransaction(db, { ...clock, now: () => 3 }, { type: 'EXPENSE', amount: 1, categoryId: groceries, date: '2026-09-20', comment: '', tagNames: [] });
    expect(sortTransactions([a, b, c]).map((t) => t.id)).toEqual([b.id, c.id, a.id]);
    expect((await lastCreatedTransaction(db))!.id).toBe(c.id);
  });
});

describe('tags', () => {
  it('renames and merges tags ignoring case', async () => {
    const t1 = await addTransaction(db, clock, { type: 'EXPENSE', amount: 1, categoryId: groceries, date: '2026-09-20', comment: '', tagNames: ['Coop'] });
    await addTransaction(db, clock, { type: 'EXPENSE', amount: 1, categoryId: groceries, date: '2026-09-21', comment: '', tagNames: ['Migros'] });
    const tags = await listTagsWithUsage(db);
    const coop = tags.find((t) => t.name === 'Coop')!;
    const migros = tags.find((t) => t.name === 'Migros')!;
    await renameTag(db, coop.id, 'MIGROS');
    expect(await db.tags.count()).toBe(1);
    const details = await getTransactionDetails(db, t1.id);
    expect(details!.tags[0]!.id).toBe(migros.id);
    expect((await listTagsWithUsage(db))[0]!.count).toBe(2);
    await renameTag(db, migros.id, 'Shops');
    expect((await db.tags.get(migros.id))!.name).toBe('Shops');
    await deleteTag(db, migros.id);
    expect(await db.tags.count()).toBe(0);
    expect(await db.transactionTags.count()).toBe(0);
  });
});

describe('categories', () => {
  it('adds before Other, reorders, and moves transactions on delete', async () => {
    const cat = await addCategory(db, { name: ' Pets ', type: 'EXPENSE', iconKey: 'pets', colorHex: '#000000' });
    const expenses = sortCategories((await db.categories.where('type').equals('EXPENSE').toArray()));
    expect(expenses.at(-1)!.id).toBe(other);
    expect(expenses.at(-2)!.id).toBe(cat.id);
    expect(cat.name).toBe('Pets');
    await reorderCategories(db, 'EXPENSE', [cat.id, groceries]);
    const reordered = sortCategories(await db.categories.where('type').equals('EXPENSE').toArray());
    expect(reordered[0]!.id).toBe(cat.id);
    expect(reordered[1]!.id).toBe(groceries);
    const tx = await addTransaction(db, clock, { type: 'EXPENSE', amount: 1, categoryId: cat.id, date: '2026-09-20', comment: '', tagNames: [] });
    await expect(deleteCategory(db, cat.id, null)).rejects.toThrow('target-required');
    await deleteCategory(db, cat.id, groceries);
    expect((await db.transactions.get(tx.id))!.categoryId).toBe(groceries);
    await expect(deleteCategory(db, other, groceries)).rejects.toThrow('cannot-delete-other');
  });
});
