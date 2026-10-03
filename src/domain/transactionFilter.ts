import type { ISODate } from './dates';
import { formatNumber, type TxType } from './money';

export interface FilterableTx {
  id: string;
  type: TxType;
  amount: number;
  categoryId: string;
  date: ISODate;
  comment: string;
}

export interface FilterCriteria {
  search: string;
  type: TxType | null;
  categoryIds: readonly string[];
  tagNames: readonly string[];
  start: ISODate | null;
  end: ISODate | null;
  hasPictures: boolean;
}

export interface FilterContext {
  categoryName: (id: string) => string;
  tagsOf: (txId: string) => readonly string[];
  hasPictures: (txId: string) => boolean;
}

/** Applies search (comment, tags, category, amount) and filters to a list of transactions. Mirrors the Transactions screen. */
export function filterTransactions<T extends FilterableTx>(list: readonly T[], criteria: FilterCriteria, ctx: FilterContext): T[] {
  const q = criteria.search.trim().toLowerCase();
  const qDigits = q.replace(/[^\d.,]/g, '').replace(',', '.');
  const catIds = new Set(criteria.categoryIds);
  const tagSet = new Set(criteria.tagNames.map((x) => x.toLowerCase()));
  return list.filter((tx) => {
    if (criteria.type && tx.type !== criteria.type) return false;
    if (catIds.size && !catIds.has(tx.categoryId)) return false;
    if (criteria.start && tx.date < criteria.start) return false;
    if (criteria.end && tx.date > criteria.end) return false;
    if (criteria.hasPictures && !ctx.hasPictures(tx.id)) return false;
    const tags = ctx.tagsOf(tx.id);
    if (tagSet.size && !tags.some((x) => tagSet.has(x.toLowerCase()))) return false;
    if (q) {
      const cat = ctx.categoryName(tx.categoryId).toLowerCase();
      const inText = tx.comment.toLowerCase().includes(q) || cat.includes(q) || tags.some((x) => x.toLowerCase().includes(q));
      const inAmount = qDigits !== '' && (formatNumber(tx.amount).replace(/'/g, '').includes(qDigits) || formatNumber(tx.amount).includes(q));
      if (!inText && !inAmount) return false;
    }
    return true;
  });
}
