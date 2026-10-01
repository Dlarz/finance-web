import { addDays, maxDate, type Clock, type ISODate } from '../domain/dates';
import { nextOccurrenceOnOrAfter, type Frequency } from '../domain/recurring';
import { newId, type FinanceDB } from './db';
import { runRecurringEngine } from './recurringEngine';
import { ensureTags, pruneUnusedTags } from './tagsRepo';
import type { RecurringRule, TxType } from './types';

export interface RuleInput {
  type: TxType;
  amount: number;
  categoryId: string;
  comment: string;
  tagNames: string[];
  frequency: Frequency;
  interval: number;
  startDate: ISODate;
  endDate: ISODate | null;
}

/** Creates a rule and generates all due occurrences. Returns the number of transactions created now. */
export async function addRule(db: FinanceDB, clock: Clock, input: RuleInput, options: { firstOccurrenceTransactionId?: string } = {}): Promise<{ rule: RecurringRule; created: number }> {
  const rule = await db.transaction('rw', [db.recurringRules, db.tags, db.transactions], async () => {
    const now = clock.now();
    const tagIds = await ensureTags(db, input.tagNames);
    const rule: RecurringRule = {
      id: newId(),
      type: input.type,
      amount: input.amount,
      categoryId: input.categoryId,
      comment: input.comment.trim(),
      tagIds,
      frequency: input.frequency,
      interval: Math.max(1, Math.floor(input.interval)),
      startDate: input.startDate,
      endDate: input.endDate,
      isPaused: false,
      generateFrom: input.startDate,
      createdAt: now,
      updatedAt: now,
    };
    await db.recurringRules.add(rule);
    if (options.firstOccurrenceTransactionId) {
      await db.transactions.update(options.firstOccurrenceTransactionId, { recurringRuleId: rule.id, occurrenceDate: input.startDate });
    }
    return rule;
  });
  const { created } = await runRecurringEngine(db, clock, rule.id);
  return { rule, created };
}

/** Edits a rule. Changes only affect future occurrences: nothing before today is back-filled. */
export async function updateRule(db: FinanceDB, clock: Clock, id: string, input: RuleInput): Promise<{ created: number }> {
  await db.transaction('rw', [db.recurringRules, db.tags, db.transactionTags], async () => {
    const existing = await db.recurringRules.get(id);
    if (!existing) throw new Error('not-found');
    const tagIds = await ensureTags(db, input.tagNames);
    const today = clock.today();
    await db.recurringRules.update(id, {
      type: input.type,
      amount: input.amount,
      categoryId: input.categoryId,
      comment: input.comment.trim(),
      tagIds,
      frequency: input.frequency,
      interval: Math.max(1, Math.floor(input.interval)),
      startDate: input.startDate,
      endDate: input.endDate,
      generateFrom: maxDate(today, input.startDate),
      updatedAt: clock.now(),
    });
    await pruneUnusedTags(db);
  });
  return runRecurringEngine(db, clock, id);
}

export async function pauseRule(db: FinanceDB, clock: Clock, id: string): Promise<void> {
  await db.recurringRules.update(id, { isPaused: true, updatedAt: clock.now() });
}

/** Resumes a rule; it continues with the next occurrence from today on (no back-filling). */
export async function resumeRule(db: FinanceDB, clock: Clock, id: string): Promise<{ created: number }> {
  const today = clock.today();
  await db.recurringRules.update(id, { isPaused: false, generateFrom: today, updatedAt: clock.now() });
  return runRecurringEngine(db, clock, id);
}

export async function deleteRule(db: FinanceDB, id: string, deleteTransactions: boolean): Promise<void> {
  await db.transaction('rw', [db.recurringRules, db.transactions, db.transactionTags, db.attachments, db.tombstones, db.tags], async () => {
    const txs = await db.transactions.where('recurringRuleId').equals(id).toArray();
    if (deleteTransactions) {
      for (const tx of txs) {
        await db.transactionTags.where('transactionId').equals(tx.id).delete();
        await db.attachments.where('transactionId').equals(tx.id).delete();
      }
      await db.transactions.bulkDelete(txs.map((t) => t.id));
    } else {
      // keep them as normal transactions
      for (const tx of txs) await db.transactions.update(tx.id, { recurringRuleId: undefined, occurrenceDate: undefined });
    }
    await db.tombstones.where('ruleId').equals(id).delete();
    await db.recurringRules.delete(id);
    await pruneUnusedTags(db);
  });
}

/** The next occurrence after today (null when paused or ended). */
export function nextRuleDate(rule: RecurringRule, today: ISODate): ISODate | null {
  if (rule.isPaused) return null;
  return nextOccurrenceOnOrAfter(rule, maxDate(addDays(today, 1), rule.generateFrom));
}
