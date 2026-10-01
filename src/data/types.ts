import type { ISODate, WeekStart } from '../domain/dates';
import type { TxType } from '../domain/money';
import type { Frequency } from '../domain/recurring';

export type { TxType, ISODate, Frequency };

export interface Transaction {
  id: string;
  type: TxType;
  /** Rappen, always positive */
  amount: number;
  categoryId: string;
  date: ISODate;
  comment: string;
  createdAt: number;
  updatedAt: number;
  recurringRuleId?: string;
  occurrenceDate?: ISODate;
}

export interface Category {
  id: string;
  name: string;
  type: TxType;
  iconKey: string;
  colorHex: string;
  sortOrder: number;
  /** "Other" categories can't be deleted */
  isDefaultOther?: boolean;
}

export interface Tag {
  id: string;
  name: string;
  /** lower-cased, trimmed name for the unique index */
  nameLower: string;
}

export interface TransactionTag {
  transactionId: string;
  tagId: string;
}

export interface Attachment {
  id: string;
  transactionId: string;
  /** JPEG, max 2000 px on the long side */
  blob: Blob;
  /** small JPEG for lists */
  thumb: Blob;
  width: number;
  height: number;
  createdAt: number;
}

export interface RecurringRule {
  id: string;
  type: TxType;
  amount: number;
  categoryId: string;
  comment: string;
  tagIds: string[];
  frequency: Frequency;
  interval: number;
  startDate: ISODate;
  endDate: ISODate | null;
  isPaused: boolean;
  /** Occurrences before this date are never created (set on resume / edit so nothing is back-filled). */
  generateFrom: ISODate;
  createdAt: number;
  updatedAt: number;
}

/** A deleted occurrence of a rule; it must never be created again. */
export interface Tombstone {
  ruleId: string;
  occurrenceDate: ISODate;
}

export type ThemeSetting = 'system' | 'light' | 'dark';
export type LanguageSetting = 'system' | 'de' | 'en';

export interface Settings {
  onboarded: boolean;
  /** Rappen, may be negative */
  startingBalance: number;
  currency: string;
  weekStart: WeekStart;
  theme: ThemeSetting;
  language: LanguageSetting;
  lastBackupAt: number | null;
  /** createdAt of the first transaction ever saved (for the backup reminder) */
  firstUseAt: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  startingBalance: 0,
  currency: 'CHF',
  weekStart: 'monday',
  theme: 'system',
  language: 'system',
  lastBackupAt: null,
  firstUseAt: null,
};

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface DraftRow {
  id: string;
  data: unknown;
  updatedAt: number;
}

export const CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP'] as const;
