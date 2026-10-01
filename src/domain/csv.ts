import type { TxType } from './money';
import type { ISODate } from './dates';

export interface CsvRow {
  date: ISODate;
  type: TxType;
  category: string;
  /** Rappen, positive */
  amount: number;
  currency: string;
  tags: string[];
  comment: string;
}

const BOM = '﻿';
const SEP = ';';

function escapeField(value: string): string {
  if (/[;"\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Amount as -12.50 / 1234.00: negative for expenses, no thousands separator. */
export function csvAmount(amount: number, type: TxType): string {
  const abs = Math.abs(amount);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  const text = `${whole}.${cents < 10 ? '0' : ''}${cents}`;
  return type === 'EXPENSE' ? `-${text}` : text;
}

/** Semicolon-separated CSV, UTF-8 with BOM, CRLF line endings (opens correctly in Excel with Swiss settings). */
export function buildCsv(rows: readonly CsvRow[]): string {
  const lines = [['date', 'type', 'category', 'amount', 'currency', 'tags', 'comment'].join(SEP)];
  for (const r of rows) {
    lines.push(
      [
        r.date,
        r.type,
        escapeField(r.category),
        csvAmount(r.amount, r.type),
        r.currency,
        escapeField(r.tags.join(', ')),
        escapeField(r.comment),
      ].join(SEP),
    );
  }
  return BOM + lines.join('\r\n') + '\r\n';
}
