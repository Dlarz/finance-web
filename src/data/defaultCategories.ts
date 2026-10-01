import type { Category, TxType } from './types';
import type { Language } from '../i18n/types';

/** ~20 clearly distinct colors that work in light and dark mode. */
export const CATEGORY_COLORS = [
  '#E5484D', // red (Health)
  '#3E63DD', // blue (Education)
  '#F5A524', // amber
  '#30A46C', // green
  '#8E4EC6', // purple
  '#0091FF', // sky
  '#E93D82', // pink
  '#F76B15', // orange
  '#12A594', // teal
  '#6E56CF', // violet
  '#AD7F58', // brown
  '#0CA678', // emerald
  '#D6409F', // magenta
  '#5B8DEF', // periwinkle
  '#C29A19', // gold
  '#1E9BB5', // cyan
  '#A3CF2B', // lime
  '#7C6F64', // taupe
  '#EB5E28', // vermilion
  '#6B7280', // slate grey (Other)
] as const;

interface DefaultCategoryDef {
  key: string;
  type: TxType;
  iconKey: string;
  colorHex: string;
  names: Record<Language, string>;
  isDefaultOther?: boolean;
}

export const DEFAULT_CATEGORY_DEFS: DefaultCategoryDef[] = [
  { key: 'groceries', type: 'EXPENSE', iconKey: 'shopping_cart', colorHex: '#30A46C', names: { en: 'Groceries', de: 'Lebensmittel' } },
  { key: 'restaurants', type: 'EXPENSE', iconKey: 'restaurant', colorHex: '#F76B15', names: { en: 'Restaurants & Takeaway', de: 'Restaurants & Takeaway' } },
  { key: 'transport', type: 'EXPENSE', iconKey: 'directions_bus', colorHex: '#0091FF', names: { en: 'Transport', de: 'Verkehr' } },
  { key: 'car', type: 'EXPENSE', iconKey: 'directions_car', colorHex: '#6E56CF', names: { en: 'Car', de: 'Auto' } },
  { key: 'housing', type: 'EXPENSE', iconKey: 'home', colorHex: '#AD7F58', names: { en: 'Housing & Rent', de: 'Wohnen & Miete' } },
  { key: 'bills', type: 'EXPENSE', iconKey: 'receipt_long', colorHex: '#12A594', names: { en: 'Bills & Utilities', de: 'Rechnungen & Nebenkosten' } },
  { key: 'health', type: 'EXPENSE', iconKey: 'favorite', colorHex: '#E5484D', names: { en: 'Health', de: 'Gesundheit' } },
  { key: 'education', type: 'EXPENSE', iconKey: 'school', colorHex: '#3E63DD', names: { en: 'Education', de: 'Bildung' } },
  { key: 'shopping', type: 'EXPENSE', iconKey: 'shopping_bag', colorHex: '#E93D82', names: { en: 'Shopping', de: 'Shopping' } },
  { key: 'entertainment', type: 'EXPENSE', iconKey: 'movie', colorHex: '#8E4EC6', names: { en: 'Entertainment', de: 'Unterhaltung' } },
  { key: 'travel', type: 'EXPENSE', iconKey: 'flight', colorHex: '#1E9BB5', names: { en: 'Travel', de: 'Reisen' } },
  { key: 'subscriptions', type: 'EXPENSE', iconKey: 'autorenew', colorHex: '#D6409F', names: { en: 'Subscriptions', de: 'Abos' } },
  { key: 'other_expense', type: 'EXPENSE', iconKey: 'category', colorHex: '#6B7280', names: { en: 'Other', de: 'Sonstiges' }, isDefaultOther: true },
  { key: 'salary', type: 'INCOME', iconKey: 'payments', colorHex: '#30A46C', names: { en: 'Salary', de: 'Lohn' } },
  { key: 'side_job', type: 'INCOME', iconKey: 'handyman', colorHex: '#0091FF', names: { en: 'Side job', de: 'Nebenjob' } },
  { key: 'gifts', type: 'INCOME', iconKey: 'card_giftcard', colorHex: '#E93D82', names: { en: 'Gifts', de: 'Geschenke' } },
  { key: 'investments', type: 'INCOME', iconKey: 'trending_up', colorHex: '#6E56CF', names: { en: 'Investments', de: 'Anlagen' } },
  { key: 'other_income', type: 'INCOME', iconKey: 'category', colorHex: '#6B7280', names: { en: 'Other', de: 'Sonstiges' }, isDefaultOther: true },
];

export function buildDefaultCategories(language: Language, makeId: () => string): Category[] {
  const counters: Record<TxType, number> = { EXPENSE: 0, INCOME: 0 };
  return DEFAULT_CATEGORY_DEFS.map((def) => ({
    id: makeId(),
    name: def.names[language],
    type: def.type,
    iconKey: def.iconKey,
    colorHex: def.colorHex,
    sortOrder: counters[def.type]++,
    isDefaultOther: def.isDefaultOther ?? false,
  }));
}
