import { newId, type FinanceDB } from './db';
import type { Tag } from './types';

export function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Returns the ids of the given tag names, creating missing tags. Must run inside a 'rw' transaction on tags. */
export async function ensureTags(db: FinanceDB, names: readonly string[]): Promise<string[]> {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = normalizeTagName(raw);
    if (!name) continue;
    const lower = name.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    const existing = await db.tags.where('nameLower').equals(lower).first();
    if (existing) {
      ids.push(existing.id);
    } else {
      const tag: Tag = { id: newId(), name, nameLower: lower };
      await db.tags.add(tag);
      ids.push(tag.id);
    }
  }
  return ids;
}

export async function setTransactionTags(db: FinanceDB, transactionId: string, tagIds: readonly string[]): Promise<void> {
  await db.transactionTags.where('transactionId').equals(transactionId).delete();
  if (tagIds.length) await db.transactionTags.bulkAdd(tagIds.map((tagId) => ({ transactionId, tagId })));
}

export interface TagUsage extends Tag {
  count: number;
}

export async function listTagsWithUsage(db: FinanceDB): Promise<TagUsage[]> {
  const [tags, refs, rules] = await Promise.all([db.tags.toArray(), db.transactionTags.toArray(), db.recurringRules.toArray()]);
  const counts = new Map<string, number>();
  for (const r of refs) counts.set(r.tagId, (counts.get(r.tagId) ?? 0) + 1);
  for (const rule of rules) for (const id of rule.tagIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return tags
    .map((t) => ({ ...t, count: counts.get(t.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.nameLower.localeCompare(b.nameLower));
}

/** Renames a tag. Renaming to an existing name (ignoring case) merges the two tags. */
export async function renameTag(db: FinanceDB, tagId: string, newName: string): Promise<void> {
  const name = normalizeTagName(newName);
  if (!name) throw new Error('empty-name');
  const lower = name.toLowerCase();
  await db.transaction('rw', [db.tags, db.transactionTags, db.recurringRules], async () => {
    const tag = await db.tags.get(tagId);
    if (!tag) return;
    const other = await db.tags.where('nameLower').equals(lower).first();
    if (other && other.id !== tagId) {
      // merge: move all references to the other tag
      const refs = await db.transactionTags.where('tagId').equals(tagId).toArray();
      for (const ref of refs) {
        await db.transactionTags.delete([ref.transactionId, ref.tagId]);
        await db.transactionTags.put({ transactionId: ref.transactionId, tagId: other.id });
      }
      const rules = await db.recurringRules.toArray();
      for (const rule of rules) {
        if (rule.tagIds.includes(tagId)) {
          const tagIds = [...new Set(rule.tagIds.map((id) => (id === tagId ? other.id : id)))];
          await db.recurringRules.update(rule.id, { tagIds });
        }
      }
      await db.tags.delete(tagId);
    } else {
      await db.tags.update(tagId, { name, nameLower: lower });
    }
  });
}

export async function deleteTag(db: FinanceDB, tagId: string): Promise<void> {
  await db.transaction('rw', [db.tags, db.transactionTags, db.recurringRules], async () => {
    await db.transactionTags.where('tagId').equals(tagId).delete();
    const rules = await db.recurringRules.toArray();
    for (const rule of rules) {
      if (rule.tagIds.includes(tagId)) await db.recurringRules.update(rule.id, { tagIds: rule.tagIds.filter((id) => id !== tagId) });
    }
    await db.tags.delete(tagId);
  });
}

/** Removes tags that are no longer used by any transaction or rule. */
export async function pruneUnusedTags(db: FinanceDB): Promise<void> {
  await db.transaction('rw', [db.tags, db.transactionTags, db.recurringRules], async () => {
    const used = new Set<string>();
    await db.transactionTags.each((r) => {
      used.add(r.tagId);
    });
    await db.recurringRules.each((rule) => {
      for (const id of rule.tagIds) used.add(id);
    });
    const all = await db.tags.toArray();
    const unused = all.filter((t) => !used.has(t.id)).map((t) => t.id);
    if (unused.length) await db.tags.bulkDelete(unused);
  });
}
