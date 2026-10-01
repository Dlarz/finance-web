import { beforeEach, describe, expect, it } from 'vitest';
import { fixedClock } from '../domain/dates';
import { BackupError, createBackup, parseBackup, restoreBackup } from './backup';
import type { FinanceDB } from './db';
import { loadDemoData } from './demoData';
import { completeOnboarding, deleteAllData } from './maintenance';
import { readSettings } from './settingsRepo';
import { createTestDb } from './testDb';
import { addTransaction } from './transactionsRepo';

let db: FinanceDB;
const clock = fixedClock('2026-09-30', 1_700_000_000_000);

beforeEach(async () => {
  db = createTestDb();
  await completeOnboarding(db, 'de', { startingBalance: 320000, currency: 'CHF' });
});

async function snapshot(d: FinanceDB) {
  const [settings, categories, tags, transactions, transactionTags, rules, tombstones, attachments] = await Promise.all([
    readSettings(d),
    d.categories.orderBy('id').toArray(),
    d.tags.orderBy('id').toArray(),
    d.transactions.orderBy('id').toArray(),
    d.transactionTags.toArray(),
    d.recurringRules.orderBy('id').toArray(),
    d.tombstones.toArray(),
    d.attachments.orderBy('id').toArray(),
  ]);
  const images = await Promise.all(attachments.map(async (a) => ({ ...a, blob: await a.blob.text(), thumb: await a.thumb.text() })));
  const sortRefs = (l: { transactionId: string; tagId: string }[]) => [...l].sort((a, b) => (a.transactionId + a.tagId).localeCompare(b.transactionId + b.tagId));
  return { settings: { ...settings, onboarded: true }, categories, tags, transactions, transactionTags: sortRefs(transactionTags), rules, tombstones, images };
}

describe('backup', () => {
  it('round-trips all data through export and import', async () => {
    await loadDemoData(db, clock, 'de');
    const groceries = (await db.categories.toArray()).find((c) => c.iconKey === 'shopping_cart')!;
    await addTransaction(db, clock, { type: 'EXPENSE', amount: 4200, categoryId: groceries.id, date: '2026-09-30', comment: 'Mit Bild', tagNames: ['foto'] }, [
      { blob: new Blob(['full-image'], { type: 'image/jpeg' }), thumb: new Blob(['thumb-image'], { type: 'image/jpeg' }), width: 1, height: 2 },
    ]);
    const first = (await db.transactions.filter((t) => !!t.recurringRuleId).first())!;
    await db.tombstones.add({ ruleId: first.recurringRuleId!, occurrenceDate: '2099-01-01' });
    const before = await snapshot(db);
    expect(before.transactions.length).toBeGreaterThan(100);

    const zip = await createBackup(db, clock, '1.0.test');
    const parsed = await parseBackup(zip);
    expect(parsed.summary).toMatchObject({ transactions: before.transactions.length, categories: 18, attachments: 1, rules: 5 });

    const target = createTestDb();
    await completeOnboarding(target, 'en', { startingBalance: 1, currency: 'EUR' });
    await restoreBackup(target, parsed);
    const after = await snapshot(target);
    expect(after).toEqual(before);
    expect((await readSettings(target)).onboarded).toBe(true);
    expect((await readSettings(target)).currency).toBe('CHF');
  });

  it('rejects invalid files without touching the data', async () => {
    await loadDemoData(db, clock, 'de');
    const before = await snapshot(db);
    await expect(parseBackup(new Blob(['not a zip']))).rejects.toBeInstanceOf(BackupError);
    const zip = await createBackup(db, clock, '1.0.test');
    const parsed = await parseBackup(zip);
    // a write failure in the middle of the restore (duplicate primary key) must roll everything back
    parsed.json.transactions.push({ ...parsed.json.transactions[0]! });
    await expect(restoreBackup(db, parsed)).rejects.toThrow();
    expect(await snapshot(db)).toEqual(before);
  });

  it('validates the json structure', async () => {
    const zip = await createBackup(db, clock, '1.0.test');
    const parsed = await parseBackup(zip);
    const { validateBackupJson } = await import('./backup');
    expect(() => validateBackupJson({ ...parsed.json, format: 'x' }, {})).toThrow(/Not a Finance-App backup/);
    expect(() => validateBackupJson({ ...parsed.json, version: 99 }, {})).toThrow(/Unsupported/);
    expect(() => validateBackupJson({ ...parsed.json, transactions: [{ id: 1 }] }, {})).toThrow(/transactions\[0\]/);
    expect(validateBackupJson(parsed.json, {}).categories).toHaveLength(18);
  });
});

describe('demo data and delete all', () => {
  it('only loads into an empty app and can be wiped completely', async () => {
    await loadDemoData(db, clock, 'en');
    expect(await db.transactions.count()).toBeGreaterThan(100);
    expect(await db.recurringRules.count()).toBe(5);
    const rent = (await db.recurringRules.toArray()).find((r) => r.comment === 'Rent')!;
    expect(await db.transactions.where('recurringRuleId').equals(rent.id).count()).toBe(6);
    await expect(loadDemoData(db, clock, 'en')).rejects.toThrow('not-empty');
    await deleteAllData(db);
    for (const table of db.tables) expect(await table.count()).toBe(0);
    expect((await readSettings(db)).onboarded).toBe(false);
  });
});
