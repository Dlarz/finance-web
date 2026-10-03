import { describe, expect, it } from 'vitest';
import { filterTransactions, type FilterCriteria } from './transactionFilter';

const list = [
  { id: 'a', type: 'EXPENSE' as const, amount: 1250, categoryId: 'groceries', date: '2026-09-10', comment: 'Milk' },
  { id: 'b', type: 'EXPENSE' as const, amount: 4500, categoryId: 'restaurants', date: '2026-09-11', comment: 'Dinner' },
  { id: 'c', type: 'INCOME' as const, amount: 20000, categoryId: 'gifts', date: '2026-09-12', comment: 'Birthday' },
];
const tags: Record<string, string[]> = { a: ['Mama', 'coop'], b: ['friends'], c: ['Mama'] };
const ctx = { categoryName: (id: string) => id, tagsOf: (id: string) => tags[id] ?? [], hasPictures: () => false };
const none: FilterCriteria = { search: '', type: null, categoryIds: [], tagNames: [], start: null, end: null, hasPictures: false };

describe('transaction search and filters with tags', () => {
  it('finds transactions by tag name through the search, ignoring case', () => {
    expect(filterTransactions(list, { ...none, search: 'mama' }, ctx).map((t) => t.id)).toEqual(['a', 'c']);
    expect(filterTransactions(list, { ...none, search: 'COOP' }, ctx).map((t) => t.id)).toEqual(['a']);
  });

  it('filters by selected tags, ignoring case', () => {
    expect(filterTransactions(list, { ...none, tagNames: ['mama'] }, ctx).map((t) => t.id)).toEqual(['a', 'c']);
    expect(filterTransactions(list, { ...none, tagNames: ['friends', 'coop'] }, ctx).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('combines tag filters with the other criteria', () => {
    expect(filterTransactions(list, { ...none, tagNames: ['Mama'], type: 'INCOME' }, ctx).map((t) => t.id)).toEqual(['c']);
    expect(filterTransactions(list, { ...none, search: '12.50', tagNames: ['mama'] }, ctx).map((t) => t.id)).toEqual(['a']);
  });
});
