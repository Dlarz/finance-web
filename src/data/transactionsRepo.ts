import type { Clock, ISODate } from '../domain/dates';
import { newId, type FinanceDB } from './db';
import { ensureTags, pruneUnusedTags, setTransactionTags } from './tagsRepo';
import type { Attachment, Tag, Transaction, TxType } from './types';

export interface NewImage {
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

export interface TransactionInput {
  type: TxType;
  amount: number;
  categoryId: string;
  date: ISODate;
  comment: string;
  tagNames: string[];
}

export interface TransactionDetails {
  transaction: Transaction;
  tags: Tag[];
  attachments: Attachment[];
}

/** Everything needed to undo a deletion. */
export interface DeletedTransaction {
  transaction: Transaction;
  tagIds: string[];
  attachments: Attachment[];
  tags: Tag[];
}

function allTables(db: FinanceDB) {
  return [db.transactions, db.tags, db.transactionTags, db.attachments, db.tombstones, db.settings, db.recurringRules];
}

export async function addTransaction(
  db: FinanceDB,
  clock: Clock,
  input: TransactionInput,
  images: readonly NewImage[] = [],
  link?: { recurringRuleId: string; occurrenceDate: ISODate },
): Promise<Transaction> {
  return db.transaction('rw', allTables(db), async () => {
    const now = clock.now();
    const tx: Transaction = {
      id: newId(),
      type: input.type,
      amount: input.amount,
      categoryId: input.categoryId,
      date: input.date,
      comment: input.comment.trim(),
      createdAt: now,
      updatedAt: now,
      ...(link ? { recurringRuleId: link.recurringRuleId, occurrenceDate: link.occurrenceDate } : {}),
    };
    await db.transactions.add(tx);
    const tagIds = await ensureTags(db, input.tagNames);
    await setTransactionTags(db, tx.id, tagIds);
    for (const img of images) await addAttachment(db, clock, tx.id, img);
    const firstUse = await db.settings.get('firstUseAt');
    if (!firstUse || firstUse.value == null) await db.settings.put({ key: 'firstUseAt', value: now });
    return tx;
  });
}

export async function addAttachment(db: FinanceDB, clock: Clock, transactionId: string, img: NewImage): Promise<Attachment> {
  const att: Attachment = {
    id: newId(),
    transactionId,
    blob: img.blob,
    thumb: img.thumb,
    width: img.width,
    height: img.height,
    createdAt: clock.now(),
  };
  await db.attachments.add(att);
  return att;
}

export async function updateTransaction(
  db: FinanceDB,
  clock: Clock,
  id: string,
  input: TransactionInput,
  options: { newImages?: readonly NewImage[]; removeAttachmentIds?: readonly string[] } = {},
): Promise<void> {
  await db.transaction('rw', allTables(db), async () => {
    const existing = await db.transactions.get(id);
    if (!existing) throw new Error('not-found');
    await db.transactions.update(id, {
      type: input.type,
      amount: input.amount,
      categoryId: input.categoryId,
      date: input.date,
      comment: input.comment.trim(),
      updatedAt: clock.now(),
    });
    const tagIds = await ensureTags(db, input.tagNames);
    await setTransactionTags(db, id, tagIds);
    if (options.removeAttachmentIds?.length) await db.attachments.bulkDelete([...options.removeAttachmentIds]);
    for (const img of options.newImages ?? []) await addAttachment(db, clock, id, img);
    await pruneUnusedTags(db);
  });
}

export async function getTransactionDetails(db: FinanceDB, id: string): Promise<TransactionDetails | null> {
  const transaction = await db.transactions.get(id);
  if (!transaction) return null;
  const [refs, attachments] = await Promise.all([
    db.transactionTags.where('transactionId').equals(id).toArray(),
    db.attachments.where('transactionId').equals(id).toArray(),
  ]);
  const tags = (await db.tags.bulkGet(refs.map((r) => r.tagId))).filter((t): t is Tag => !!t).sort((a, b) => a.nameLower.localeCompare(b.nameLower));
  attachments.sort((a, b) => a.createdAt - b.createdAt);
  return { transaction, tags, attachments };
}

/** Deletes a transaction with its tags and pictures and returns a snapshot for undo. */
export async function deleteTransaction(db: FinanceDB, id: string): Promise<DeletedTransaction | null> {
  return db.transaction('rw', allTables(db), async () => {
    const transaction = await db.transactions.get(id);
    if (!transaction) return null;
    const refs = await db.transactionTags.where('transactionId').equals(id).toArray();
    const tagIds = refs.map((r) => r.tagId);
    const tags = (await db.tags.bulkGet(tagIds)).filter((t): t is Tag => !!t);
    const attachments = await db.attachments.where('transactionId').equals(id).toArray();
    await db.transactionTags.where('transactionId').equals(id).delete();
    await db.attachments.where('transactionId').equals(id).delete();
    await db.transactions.delete(id);
    if (transaction.recurringRuleId && transaction.occurrenceDate) {
      await db.tombstones.put({ ruleId: transaction.recurringRuleId, occurrenceDate: transaction.occurrenceDate });
    }
    await pruneUnusedTags(db);
    return { transaction, tagIds, attachments, tags };
  });
}

/** Restores a deleted transaction including tags and pictures. */
export async function restoreTransaction(db: FinanceDB, snapshot: DeletedTransaction): Promise<void> {
  await db.transaction('rw', allTables(db), async () => {
    await db.transactions.put(snapshot.transaction);
    const tagIds: string[] = [];
    for (const tag of snapshot.tags) {
      const existing = await db.tags.where('nameLower').equals(tag.nameLower).first();
      if (existing) tagIds.push(existing.id);
      else {
        await db.tags.put(tag);
        tagIds.push(tag.id);
      }
    }
    await setTransactionTags(db, snapshot.transaction.id, tagIds);
    if (snapshot.attachments.length) await db.attachments.bulkPut(snapshot.attachments);
    if (snapshot.transaction.recurringRuleId && snapshot.transaction.occurrenceDate) {
      await db.tombstones.delete([snapshot.transaction.recurringRuleId, snapshot.transaction.occurrenceDate]);
    }
  });
}

export async function transactionsInRange(db: FinanceDB, start: ISODate, end: ISODate): Promise<Transaction[]> {
  return db.transactions.where('date').between(start, end, true, true).toArray();
}

/** The transaction created most recently (by createdAt). */
export async function lastCreatedTransaction(db: FinanceDB): Promise<Transaction | undefined> {
  return db.transactions.orderBy('createdAt').last();
}

/** Sorts newest first: by date, then by createdAt. */
export function sortTransactions<T extends Pick<Transaction, 'date' | 'createdAt'>>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
}

/** Map transactionId → tag names, for lists. */
export async function tagNamesByTransaction(db: FinanceDB): Promise<Map<string, string[]>> {
  const [refs, tags] = await Promise.all([db.transactionTags.toArray(), db.tags.toArray()]);
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const out = new Map<string, string[]>();
  for (const r of refs) {
    const name = tagName.get(r.tagId);
    if (!name) continue;
    const list = out.get(r.transactionId);
    if (list) list.push(name);
    else out.set(r.transactionId, [name]);
  }
  for (const list of out.values()) list.sort((a, b) => a.localeCompare(b));
  return out;
}

/** Set of transaction ids that have at least one picture. */
export async function transactionIdsWithAttachments(db: FinanceDB): Promise<Set<string>> {
  const ids = new Set<string>();
  await db.attachments.each((a) => {
    ids.add(a.transactionId);
  });
  return ids;
}
