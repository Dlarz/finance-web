// Money is always an integer number of Rappen (cents). Never floats.

export const MAX_AMOUNT = 9_999_999_999; // 99'999'999.99

export type TxType = 'EXPENSE' | 'INCOME';

const MINUS = '−'; // typographic minus

/** Formats an absolute amount in Rappen as 1'234.50 (Swiss style, always 2 decimals). */
export function formatNumber(rappen: number): string {
  const abs = Math.abs(Math.trunc(rappen));
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  const wholeStr = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${wholeStr}.${cents < 10 ? '0' : ''}${cents}`;
}

export interface FormatOptions {
  currency?: string;
  /** 'none' = no sign, 'type' = sign from the transaction type, 'value' = sign from the value */
  sign?: 'none' | 'type' | 'value';
  type?: TxType;
  /** Omit the currency code */
  bare?: boolean;
}

/** Formats an amount as "CHF 1'234.50" with an optional sign ("+" / "−"). */
export function formatAmount(rappen: number, opts: FormatOptions = {}): string {
  const { currency = 'CHF', sign = 'none', type, bare = false } = opts;
  let prefix = '';
  if (sign === 'type') {
    prefix = type === 'INCOME' ? '+' : MINUS;
  } else if (sign === 'value') {
    prefix = rappen < 0 ? MINUS : '';
  }
  const number = formatNumber(rappen);
  return bare ? `${prefix}${number}` : `${prefix}${currency} ${number}`;
}

/** Signed value of a transaction: expenses negative, income positive. */
export function signedAmount(amount: number, type: TxType): number {
  return type === 'EXPENSE' ? -amount : amount;
}

/**
 * Parses a keypad string such as "1234.5" or "1'234,50" into Rappen.
 * Returns null when the text is not a valid amount (more than 2 decimals, above the maximum, ...).
 */
export function parseAmountInput(text: string): number | null {
  const cleaned = text.replace(/['\s]/g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '.') return null;
  if (!/^\d*(\.\d{0,2})?$/.test(cleaned)) return null;
  const [wholeRaw = '', fracRaw = ''] = cleaned.split('.');
  const whole = wholeRaw === '' ? 0 : Number.parseInt(wholeRaw, 10);
  const frac = fracRaw === '' ? 0 : Number.parseInt(fracRaw.padEnd(2, '0'), 10);
  if (!Number.isSafeInteger(whole)) return null;
  const rappen = whole * 100 + frac;
  if (rappen > MAX_AMOUNT) return null;
  return rappen;
}

/** Converts Rappen back into the keypad text representation (no thousands separators). */
export function amountToInput(rappen: number): string {
  if (rappen === 0) return '';
  const abs = Math.abs(rappen);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  if (cents === 0) return String(whole);
  return `${whole}.${cents < 10 ? '0' : ''}${cents}`;
}

/**
 * Applies one keypad key to the current input text and returns the new text.
 * Keys: '0'-'9', '.', 'backspace'. Enforces max 2 decimals and the maximum amount.
 */
export function applyKeypadKey(text: string, key: string): string {
  if (key === 'backspace') return text.slice(0, -1);
  if (key === '.') {
    if (text.includes('.')) return text;
    return text === '' ? '0.' : `${text}.`;
  }
  if (!/^\d$/.test(key)) return text;
  if (text === '0') return key; // no leading zeros
  const next = text + key;
  const dot = next.indexOf('.');
  if (dot >= 0 && next.length - dot - 1 > 2) return text;
  const parsed = parseAmountInput(next);
  if (parsed === null) return text;
  return next;
}

/** Compact number for chart axis labels, in whole currency units: 950, 1.2k, 12k, 1.5M */
export function compactNumber(rappen: number): string {
  const units = Math.abs(rappen) / 100;
  const sign = rappen < 0 ? MINUS : '';
  if (units < 1000) return `${sign}${Math.round(units)}`;
  if (units < 10_000) return `${sign}${trimZero((units / 1000).toFixed(1))}k`;
  if (units < 1_000_000) return `${sign}${Math.round(units / 1000)}k`;
  if (units < 10_000_000) return `${sign}${trimZero((units / 1_000_000).toFixed(1))}M`;
  return `${sign}${Math.round(units / 1_000_000)}M`;
}

function trimZero(s: string): string {
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}
