import { maxDate, type Clock, type ISODate } from '../domain/dates';
import { occurrencesBetween } from '../domain/recurring';
import { newId, type FinanceDB } from './db';
import type { RecurringRule, Transaction } from './types';

/**
 * Creates all due occurrences of all active rules up to today, in one database transaction.
 * Safe to run any number of times and concurrently: existing occurrences are skipped, the unique
 * (recurringRuleId, occurrenceDate) index rejects duplicates, and tombstones keep deleted
 * occurrences deleted.
 */
export async function runRecurringEngine(db: FinanceDB, clock: Clock, onlyRuleId?: string): Promise<{ created: number; perRule: Map<string, number> }> {
  const today = clock.today();
  const perRule = new Map<string, number>();
  let created = 0;
  await db.transaction('rw', [db.recurringRules, db.transactions, db.transactionTags, db.tombstones], async () => {
    const rules = onlyRuleId ? [await db.recurringRules.get(onlyRuleId)].filter((r): r is RecurringRule => !!r) : await db.recurringRules.toArray();
    for (const rule of rules) {
      if (rule.isPaused) continue;
      const from = maxDate(rule.startDate, rule.generateFrom);
      if (from > today) continue;
      const due = occurrencesBetween(rule, from, today);
      if (due.length === 0) continue;
      const [existing, tombstones] = await Promise.all([
        db.transactions.where('[recurringRuleId+occurrenceDate]').between([rule.id, from], [rule.id, today], true, true).toArray(),
        db.tombstones.where('ruleId').equals(rule.id).toArray(),
      ]);
      const skip = new Set<ISODate>([...existing.map((t) => t.occurrenceDate!), ...tombstones.map((t) => t.occurrenceDate)]);
      const now = clock.now();
      let n = 0;
      for (const date of due) {
        if (skip.has(date)) continue;
        const tx: Transaction = {
          id: newId(),
          type: rule.type,
          amount: rule.amount,
          categoryId: rule.categoryId,
          date,
          comment: rule.comment,
          createdAt: now + n, // keep the order stable within one run
          updatedAt: now + n,
          recurringRuleId: rule.id,
          occurrenceDate: date,
        };
        try {
          await db.transactions.add(tx);
        } catch (e) {
          if (e instanceof Error && e.name === 'ConstraintError') continue;
          throw e;
        }
        if (rule.tagIds.length) await db.transactionTags.bulkPut(rule.tagIds.map((tagId) => ({ transactionId: tx.id, tagId })));
        n++;
      }
      if (n > 0) {
        created += n;
        perRule.set(rule.id, n);
      }
    }
  });
  return { created, perRule };
}
