import { unzipSync, zipSync, strToU8, strFromU8, type Zippable } from 'fflate';
import { isISODate, type Clock } from '../domain/dates';
import type { FinanceDB } from './db';
import { DEFAULT_SETTINGS, type Attachment, type Category, type RecurringRule, type Settings, type Tag, type Tombstone, type Transaction, type TransactionTag } from './types';

export const BACKUP_FORMAT = 'finance-app-backup';
export const BACKUP_VERSION = 1;

interface AttachmentMeta {
  id: string;
  transactionId: string;
  fileName: string;
  thumbFileName: string;
  width: number;
  height: number;
  createdAt: number;
}

export interface BackupJson {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  appVersion: string;
  settings: Partial<Settings>;
  categories: Category[];
  tags: Tag[];
  transactions: Transaction[];
  transactionTags: TransactionTag[];
  recurringRules: RecurringRule[];
  tombstones: Tombstone[];
  attachments: AttachmentMeta[];
}

export interface BackupSummary {
  transactions: number;
  categories: number;
  tags: number;
  rules: number;
  attachments: number;
  exportedAt: string;
  appVersion: string;
}

export interface ParsedBackup {
  summary: BackupSummary;
  json: BackupJson;
  files: Record<string, Uint8Array>;
}

export function backupFileName(today: string): string {
  return `financeapp-backup-${today}.zip`;
}

async function blobToU8(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** Exports all data and settings plus all pictures as one zip file. */
export async function createBackup(db: FinanceDB, clock: Clock, appVersion: string): Promise<Blob> {
  const [settingsRows, categories, tags, transactions, transactionTags, recurringRules, tombstones, attachments] = await db.transaction(
    'r',
    db.tables,
    () =>
      Promise.all([
        db.settings.toArray(),
        db.categories.toArray(),
        db.tags.toArray(),
        db.transactions.toArray(),
        db.transactionTags.toArray(),
        db.recurringRules.toArray(),
        db.tombstones.toArray(),
        db.attachments.toArray(),
      ]),
  );
  const settings: Partial<Settings> = {};
  for (const row of settingsRows) {
    if (row.key in DEFAULT_SETTINGS && row.key !== 'onboarded') (settings as unknown as Record<string, unknown>)[row.key] = row.value;
  }
  const files: Record<string, Uint8Array> = {};
  const attachmentMeta: AttachmentMeta[] = [];
  for (const a of attachments) {
    const fileName = `images/${a.id}.jpg`;
    const thumbFileName = `thumbs/${a.id}.jpg`;
    files[fileName] = await blobToU8(a.blob);
    files[thumbFileName] = await blobToU8(a.thumb);
    attachmentMeta.push({ id: a.id, transactionId: a.transactionId, fileName, thumbFileName, width: a.width, height: a.height, createdAt: a.createdAt });
  }
  const json: BackupJson = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date(clock.now()).toISOString(),
    appVersion,
    settings,
    categories,
    tags,
    transactions,
    transactionTags,
    recurringRules,
    tombstones,
    attachments: attachmentMeta,
  };
  const zipInput: Zippable = { 'backup.json': strToU8(JSON.stringify(json, null, 1)) };
  for (const [name, data] of Object.entries(files)) zipInput[name] = [data, { level: 0 }]; // JPEGs don't compress
  const zipped = zipSync(zipInput, { level: 6 });
  return new Blob([zipped as BlobPart], { type: 'application/zip' });
}

export class BackupError extends Error {
  constructor(public readonly code: 'not-zip' | 'no-json' | 'invalid', message: string) {
    super(message);
  }
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isType = (v: unknown): v is 'EXPENSE' | 'INCOME' => v === 'EXPENSE' || v === 'INCOME';

function fail(msg: string): never {
  throw new BackupError('invalid', msg);
}

/** Reads and fully validates a backup file. Nothing is written. */
export async function parseBackup(file: Blob): Promise<ParsedBackup> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(await blobToU8(file));
  } catch {
    throw new BackupError('not-zip', 'The file is not a zip archive');
  }
  const jsonBytes = files['backup.json'];
  if (!jsonBytes) throw new BackupError('no-json', 'backup.json is missing');
  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(jsonBytes));
  } catch {
    fail('backup.json is not valid JSON');
  }
  const json = validateBackupJson(raw, files);
  return {
    json,
    files,
    summary: {
      transactions: json.transactions.length,
      categories: json.categories.length,
      tags: json.tags.length,
      rules: json.recurringRules.length,
      attachments: json.attachments.length,
      exportedAt: json.exportedAt,
      appVersion: json.appVersion,
    },
  };
}

export function validateBackupJson(raw: unknown, files: Record<string, Uint8Array>): BackupJson {
  if (typeof raw !== 'object' || raw === null) fail('backup.json is not an object');
  const o = raw as Record<string, unknown>;
  if (o.format !== BACKUP_FORMAT) fail('Not a Finance-App backup');
  if (!isInt(o.version) || o.version < 1 || o.version > BACKUP_VERSION) fail(`Unsupported backup version ${String(o.version)}`);
  const arr = (key: string): unknown[] => {
    const v = o[key];
    if (!Array.isArray(v)) fail(`${key} must be a list`);
    return v;
  };
  const categories = arr('categories').map((c, i) => {
    const x = c as Record<string, unknown>;
    if (!isStr(x.id) || !isStr(x.name) || !isType(x.type) || !isStr(x.iconKey) || !isStr(x.colorHex) || !isNum(x.sortOrder)) fail(`categories[${i}] is invalid`);
    const cat: Category = { id: x.id, name: x.name, type: x.type, iconKey: x.iconKey, colorHex: x.colorHex, sortOrder: x.sortOrder, isDefaultOther: x.isDefaultOther === true };
    return cat;
  });
  const categoryIds = new Set(categories.map((c) => c.id));
  if (categoryIds.size !== categories.length) fail('duplicate category id');
  const tags = arr('tags').map((t, i) => {
    const x = t as Record<string, unknown>;
    if (!isStr(x.id) || !isStr(x.name)) fail(`tags[${i}] is invalid`);
    const tag: Tag = { id: x.id, name: x.name.trim(), nameLower: x.name.trim().toLowerCase() };
    return tag;
  });
  const tagIds = new Set(tags.map((t) => t.id));
  if (tagIds.size !== tags.length) fail('duplicate tag id');
  if (new Set(tags.map((t) => t.nameLower)).size !== tags.length) fail('duplicate tag name');
  const recurringRules = arr('recurringRules').map((r, i) => {
    const x = r as Record<string, unknown>;
    if (
      !isStr(x.id) ||
      !isType(x.type) ||
      !isInt(x.amount) ||
      x.amount < 0 ||
      !isStr(x.categoryId) ||
      !categoryIds.has(x.categoryId) ||
      !Array.isArray(x.tagIds) ||
      !x.tagIds.every((id) => isStr(id) && tagIds.has(id)) ||
      !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(x.frequency as string) ||
      !isInt(x.interval) ||
      x.interval < 1 ||
      !isISODate(x.startDate) ||
      !(x.endDate === null || x.endDate === undefined || isISODate(x.endDate)) ||
      !isBool(x.isPaused) ||
      !isNum(x.createdAt) ||
      !isNum(x.updatedAt)
    )
      fail(`recurringRules[${i}] is invalid`);
    const rule: RecurringRule = {
      id: x.id,
      type: x.type,
      amount: x.amount,
      categoryId: x.categoryId,
      comment: isStr(x.comment) ? x.comment : '',
      tagIds: x.tagIds as string[],
      frequency: x.frequency as RecurringRule['frequency'],
      interval: x.interval,
      startDate: x.startDate as string,
      endDate: isStr(x.endDate) ? x.endDate : null,
      isPaused: x.isPaused,
      generateFrom: isISODate(x.generateFrom) ? x.generateFrom : (x.startDate as string),
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
    };
    return rule;
  });
  const ruleIds = new Set(recurringRules.map((r) => r.id));
  if (ruleIds.size !== recurringRules.length) fail('duplicate rule id');
  const transactions = arr('transactions').map((t, i) => {
    const x = t as Record<string, unknown>;
    if (!isStr(x.id) || !isType(x.type) || !isInt(x.amount) || x.amount < 0 || !isStr(x.categoryId) || !categoryIds.has(x.categoryId) || !isISODate(x.date) || !isNum(x.createdAt) || !isNum(x.updatedAt))
      fail(`transactions[${i}] is invalid`);
    const tx: Transaction = { id: x.id, type: x.type, amount: x.amount, categoryId: x.categoryId, date: x.date as string, comment: isStr(x.comment) ? x.comment : '', createdAt: x.createdAt, updatedAt: x.updatedAt };
    if (isStr(x.recurringRuleId) && ruleIds.has(x.recurringRuleId) && isISODate(x.occurrenceDate)) {
      tx.recurringRuleId = x.recurringRuleId;
      tx.occurrenceDate = x.occurrenceDate as string;
    }
    return tx;
  });
  const txIds = new Set(transactions.map((t) => t.id));
  if (txIds.size !== transactions.length) fail('duplicate transaction id');
  const occurrenceKeys = new Set<string>();
  for (const t of transactions) {
    if (t.recurringRuleId) {
      const key = `${t.recurringRuleId}|${t.occurrenceDate}`;
      if (occurrenceKeys.has(key)) fail('duplicate recurring occurrence');
      occurrenceKeys.add(key);
    }
  }
  const transactionTags: TransactionTag[] = [];
  const seenRefs = new Set<string>();
  for (const [i, r] of arr('transactionTags').entries()) {
    const x = r as Record<string, unknown>;
    if (!isStr(x.transactionId) || !isStr(x.tagId)) fail(`transactionTags[${i}] is invalid`);
    if (!txIds.has(x.transactionId) || !tagIds.has(x.tagId)) continue; // dangling reference: drop it
    const key = `${x.transactionId}|${x.tagId}`;
    if (seenRefs.has(key)) continue;
    seenRefs.add(key);
    transactionTags.push({ transactionId: x.transactionId, tagId: x.tagId });
  }
  const tombstones: Tombstone[] = [];
  for (const [i, r] of arr('tombstones').entries()) {
    const x = r as Record<string, unknown>;
    if (!isStr(x.ruleId) || !isISODate(x.occurrenceDate)) fail(`tombstones[${i}] is invalid`);
    if (ruleIds.has(x.ruleId)) tombstones.push({ ruleId: x.ruleId, occurrenceDate: x.occurrenceDate as string });
  }
  const attachments = arr('attachments').map((a, i) => {
    const x = a as Record<string, unknown>;
    if (!isStr(x.id) || !isStr(x.transactionId) || !isStr(x.fileName) || !isNum(x.width) || !isNum(x.height) || !isNum(x.createdAt)) fail(`attachments[${i}] is invalid`);
    if (!txIds.has(x.transactionId)) fail(`attachments[${i}] refers to a missing transaction`);
    if (!files[x.fileName]) fail(`picture ${x.fileName} is missing from the archive`);
    const meta: AttachmentMeta = {
      id: x.id,
      transactionId: x.transactionId,
      fileName: x.fileName,
      thumbFileName: isStr(x.thumbFileName) && files[x.thumbFileName] ? x.thumbFileName : x.fileName,
      width: x.width,
      height: x.height,
      createdAt: x.createdAt,
    };
    return meta;
  });
  if (new Set(attachments.map((a) => a.id)).size !== attachments.length) fail('duplicate attachment id');
  const settingsRaw = typeof o.settings === 'object' && o.settings !== null ? (o.settings as Record<string, unknown>) : {};
  const settings: Partial<Settings> = {};
  if (isInt(settingsRaw.startingBalance)) settings.startingBalance = settingsRaw.startingBalance;
  if (isStr(settingsRaw.currency) && settingsRaw.currency.length <= 5) settings.currency = settingsRaw.currency;
  if (settingsRaw.weekStart === 'monday' || settingsRaw.weekStart === 'sunday') settings.weekStart = settingsRaw.weekStart;
  if (settingsRaw.theme === 'system' || settingsRaw.theme === 'light' || settingsRaw.theme === 'dark') settings.theme = settingsRaw.theme;
  if (settingsRaw.language === 'system' || settingsRaw.language === 'de' || settingsRaw.language === 'en') settings.language = settingsRaw.language;
  if (isNum(settingsRaw.lastBackupAt)) settings.lastBackupAt = settingsRaw.lastBackupAt;
  if (isNum(settingsRaw.firstUseAt)) settings.firstUseAt = settingsRaw.firstUseAt;
  return {
    format: BACKUP_FORMAT,
    version: o.version,
    exportedAt: isStr(o.exportedAt) ? o.exportedAt : '',
    appVersion: isStr(o.appVersion) ? o.appVersion : '',
    settings,
    categories,
    tags,
    transactions,
    transactionTags,
    recurringRules,
    tombstones,
    attachments,
  };
}

/** Replaces all current data with the backup, atomically. If anything fails, nothing is changed. */
export async function restoreBackup(db: FinanceDB, parsed: ParsedBackup): Promise<void> {
  const { json, files } = parsed;
  const attachments: Attachment[] = json.attachments.map((a) => {
    const full = files[a.fileName]!;
    const thumb = files[a.thumbFileName] ?? full;
    return {
      id: a.id,
      transactionId: a.transactionId,
      blob: new Blob([full as BlobPart], { type: 'image/jpeg' }),
      thumb: new Blob([thumb as BlobPart], { type: 'image/jpeg' }),
      width: a.width,
      height: a.height,
      createdAt: a.createdAt,
    };
  });
  await db.transaction('rw', db.tables, async () => {
    const keepSettings = await db.settings.toArray();
    await Promise.all([
      db.settings.clear(),
      db.categories.clear(),
      db.tags.clear(),
      db.transactions.clear(),
      db.transactionTags.clear(),
      db.recurringRules.clear(),
      db.tombstones.clear(),
      db.attachments.clear(),
      db.drafts.clear(),
    ]);
    const merged: Partial<Settings> = { ...DEFAULT_SETTINGS };
    // keep this device's theme/language preferences unless the backup has them
    for (const row of keepSettings) if (row.key === 'theme' || row.key === 'language') (merged as unknown as Record<string, unknown>)[row.key] = row.value;
    Object.assign(merged, json.settings, { onboarded: true });
    await db.settings.bulkAdd(Object.entries(merged).map(([key, value]) => ({ key, value })));
    await db.categories.bulkAdd(json.categories);
    await db.tags.bulkAdd(json.tags);
    await db.transactions.bulkAdd(json.transactions);
    await db.transactionTags.bulkAdd(json.transactionTags);
    await db.recurringRules.bulkAdd(json.recurringRules);
    await db.tombstones.bulkAdd(json.tombstones);
    await db.attachments.bulkAdd(attachments);
  });
}
