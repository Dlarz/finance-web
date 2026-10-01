import Dexie, { type EntityTable, type Table } from 'dexie';
import type { Attachment, Category, DraftRow, RecurringRule, SettingRow, Tag, Tombstone, Transaction, TransactionTag } from './types';

export const DB_NAME = 'finance-app';

export class FinanceDB extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  tags!: EntityTable<Tag, 'id'>;
  transactionTags!: Table<TransactionTag, [string, string], TransactionTag>;
  attachments!: EntityTable<Attachment, 'id'>;
  recurringRules!: EntityTable<RecurringRule, 'id'>;
  tombstones!: Table<Tombstone, [string, string], Tombstone>;
  settings!: EntityTable<SettingRow, 'key'>;
  drafts!: EntityTable<DraftRow, 'id'>;

  constructor(name: string = DB_NAME) {
    super(name);
    // Never change an existing version's schema; add a new version with an upgrade function instead,
    // so an update never loses data.
    this.version(1).stores({
      transactions: 'id, date, type, categoryId, createdAt, recurringRuleId, &[recurringRuleId+occurrenceDate]',
      categories: 'id, type, sortOrder',
      tags: 'id, &nameLower',
      transactionTags: '[transactionId+tagId], transactionId, tagId',
      attachments: 'id, transactionId',
      recurringRules: 'id, isPaused',
      tombstones: '[ruleId+occurrenceDate], ruleId',
      settings: 'key',
      drafts: 'id',
    });
  }
}

let instance: FinanceDB | null = null;

export function getDb(): FinanceDB {
  if (!instance) instance = new FinanceDB();
  return instance;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback for very old engines
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
