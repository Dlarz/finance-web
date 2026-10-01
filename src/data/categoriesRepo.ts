import { newId, type FinanceDB } from './db';
import type { Category, TxType } from './types';

export interface CategoryInput {
  name: string;
  type: TxType;
  iconKey: string;
  colorHex: string;
}

export async function addCategory(db: FinanceDB, input: CategoryInput): Promise<Category> {
  return db.transaction('rw', db.categories, async () => {
    const siblings = await db.categories.where('type').equals(input.type).toArray();
    // Insert before the default "Other" so it stays last
    const other = siblings.find((c) => c.isDefaultOther);
    const maxOrder = siblings.reduce((m, c) => Math.max(m, c.sortOrder), -1);
    const category: Category = {
      id: newId(),
      name: input.name.trim(),
      type: input.type,
      iconKey: input.iconKey,
      colorHex: input.colorHex,
      sortOrder: other ? other.sortOrder : maxOrder + 1,
      isDefaultOther: false,
    };
    if (other) await db.categories.update(other.id, { sortOrder: other.sortOrder + 1 });
    await db.categories.add(category);
    return category;
  });
}

export async function updateCategory(db: FinanceDB, id: string, patch: Partial<Pick<Category, 'name' | 'iconKey' | 'colorHex'>>): Promise<void> {
  const clean = { ...patch };
  if (clean.name !== undefined) clean.name = clean.name.trim();
  await db.categories.update(id, clean);
}

export async function reorderCategories(db: FinanceDB, type: TxType, orderedIds: readonly string[]): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const existing = await db.categories.where('type').equals(type).toArray();
    const byId = new Map(existing.map((c) => [c.id, c]));
    let order = 0;
    for (const id of orderedIds) {
      if (byId.has(id)) await db.categories.update(id, { sortOrder: order++ });
    }
    for (const c of existing) {
      if (!orderedIds.includes(c.id)) await db.categories.update(c.id, { sortOrder: order++ });
    }
  });
}

/** How many transactions and rules use a category. */
export async function categoryUsage(db: FinanceDB, id: string): Promise<{ transactions: number; rules: number }> {
  const [transactions, rules] = await Promise.all([
    db.transactions.where('categoryId').equals(id).count(),
    db.recurringRules.filter((r) => r.categoryId === id).count(),
  ]);
  return { transactions, rules };
}

/** Deletes a category and moves its transactions and rules to another category of the same type. */
export async function deleteCategory(db: FinanceDB, id: string, moveToId: string | null): Promise<void> {
  await db.transaction('rw', [db.categories, db.transactions, db.recurringRules], async () => {
    const category = await db.categories.get(id);
    if (!category) return;
    if (category.isDefaultOther) throw new Error('cannot-delete-other');
    const usage = await categoryUsage(db, id);
    if (usage.transactions + usage.rules > 0) {
      if (!moveToId) throw new Error('target-required');
      const target = await db.categories.get(moveToId);
      if (!target || target.type !== category.type) throw new Error('invalid-target');
      await db.transactions.where('categoryId').equals(id).modify({ categoryId: moveToId });
      await db.recurringRules.filter((r) => r.categoryId === id).modify({ categoryId: moveToId });
    }
    await db.categories.delete(id);
  });
}

export function sortCategories(list: readonly Category[]): Category[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}
