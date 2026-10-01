import type { FinanceDB } from './db';
import { DEFAULT_SETTINGS, type Settings } from './types';

export function mergeSettings(rows: readonly { key: string; value: unknown }[]): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in DEFAULT_SETTINGS) (out as unknown as Record<string, unknown>)[row.key] = row.value;
  }
  return out;
}

export async function readSettings(db: FinanceDB): Promise<Settings> {
  return mergeSettings(await db.settings.toArray());
}

export async function writeSetting<K extends keyof Settings>(db: FinanceDB, key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value });
}

export async function writeSettings(db: FinanceDB, patch: Partial<Settings>): Promise<void> {
  await db.settings.bulkPut(Object.entries(patch).map(([key, value]) => ({ key, value })));
}
