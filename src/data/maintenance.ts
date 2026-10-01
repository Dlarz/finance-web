import type { Clock } from '../domain/dates';
import type { Language } from '../i18n/types';
import { buildDefaultCategories } from './defaultCategories';
import { newId, type FinanceDB } from './db';
import { writeSettings } from './settingsRepo';
import type { Settings } from './types';

/** First launch: creates the default categories and saves the starting balance + currency. */
export async function completeOnboarding(db: FinanceDB, language: Language, patch: Pick<Settings, 'startingBalance' | 'currency'>): Promise<void> {
  await db.transaction('rw', [db.categories, db.settings], async () => {
    if ((await db.categories.count()) === 0) await db.categories.bulkAdd(buildDefaultCategories(language, newId));
    await writeSettings(db, { ...patch, onboarded: true });
  });
}

/** Deletes everything: the app starts like a fresh install afterwards. */
export async function deleteAllData(db: FinanceDB): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
}

/** Removes pictures whose transaction no longer exists. */
export async function cleanupOrphans(db: FinanceDB): Promise<number> {
  return db.transaction('rw', [db.attachments, db.transactions, db.transactionTags], async () => {
    const txIds = new Set<string>();
    await db.transactions.each((t) => {
      txIds.add(t.id);
    });
    const orphanAttachments = (await db.attachments.toArray()).filter((a) => !txIds.has(a.transactionId)).map((a) => a.id);
    if (orphanAttachments.length) await db.attachments.bulkDelete(orphanAttachments);
    const orphanRefs = (await db.transactionTags.toArray()).filter((r) => !txIds.has(r.transactionId));
    for (const r of orphanRefs) await db.transactionTags.delete([r.transactionId, r.tagId]);
    return orphanAttachments.length;
  });
}

export function markBackupDone(db: FinanceDB, clock: Clock): Promise<void> {
  return writeSettings(db, { lastBackupAt: clock.now() });
}
