import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../app/container';
import { sortCategories } from '../data/categoriesRepo';
import type { Category } from '../data/types';

export function useCategories(): { list: Category[]; byId: Map<string, Category> } | undefined {
  const rows = useLiveQuery(() => db.categories.toArray(), []);
  return useMemo(() => {
    if (!rows) return undefined;
    const list = sortCategories(rows);
    return { list, byId: new Map(list.map((c) => [c.id, c])) };
  }, [rows]);
}

export function useTransactionCount(): number | undefined {
  return useLiveQuery(() => db.transactions.count(), []);
}

export function useTagNames(): Map<string, string[]> | undefined {
  const refs = useLiveQuery(() => db.transactionTags.toArray(), []);
  const tags = useLiveQuery(() => db.tags.toArray(), []);
  return useMemo(() => {
    if (!refs || !tags) return undefined;
    const name = new Map(tags.map((t) => [t.id, t.name]));
    const out = new Map<string, string[]>();
    for (const r of refs) {
      const n = name.get(r.tagId);
      if (!n) continue;
      const list = out.get(r.transactionId);
      if (list) list.push(n);
      else out.set(r.transactionId, [n]);
    }
    for (const list of out.values()) list.sort((a, b) => a.localeCompare(b));
    return out;
  }, [refs, tags]);
}

export function useAttachmentIds(): Set<string> | undefined {
  const rows = useLiveQuery(() => db.attachments.orderBy('transactionId').keys(), []);
  return useMemo(() => (rows ? new Set(rows as string[]) : undefined), [rows]);
}
