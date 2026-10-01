import { describe, expect, it } from 'vitest';
import { amountToInput, applyKeypadKey, compactNumber, formatAmount, formatNumber, MAX_AMOUNT, parseAmountInput, signedAmount } from './money';

describe('formatNumber', () => {
  it('uses apostrophes and two decimals', () => {
    expect(formatNumber(123450)).toBe("1'234.50");
    expect(formatNumber(0)).toBe('0.00');
    expect(formatNumber(5)).toBe('0.05');
    expect(formatNumber(100)).toBe('1.00');
    expect(formatNumber(99999)).toBe('999.99');
    expect(formatNumber(100000)).toBe("1'000.00");
    expect(formatNumber(MAX_AMOUNT)).toBe("99'999'999.99");
    expect(formatNumber(-250)).toBe('2.50');
  });
});

describe('formatAmount', () => {
  it('adds the currency and the sign from the type', () => {
    expect(formatAmount(123450)).toBe("CHF 1'234.50");
    expect(formatAmount(123450, { currency: 'EUR' })).toBe("EUR 1'234.50");
    expect(formatAmount(1250, { sign: 'type', type: 'EXPENSE' })).toBe('−CHF 12.50');
    expect(formatAmount(1250, { sign: 'type', type: 'INCOME' })).toBe('+CHF 12.50');
    expect(formatAmount(-1250, { sign: 'value' })).toBe('−CHF 12.50');
    expect(formatAmount(1250, { sign: 'value' })).toBe('CHF 12.50');
    expect(formatAmount(1250, { bare: true })).toBe('12.50');
  });
});

describe('parseAmountInput', () => {
  it('parses keypad input', () => {
    expect(parseAmountInput('12')).toBe(1200);
    expect(parseAmountInput('12.5')).toBe(1250);
    expect(parseAmountInput('12.50')).toBe(1250);
    expect(parseAmountInput('0.05')).toBe(5);
    expect(parseAmountInput('.5')).toBe(50);
    expect(parseAmountInput("1'234,50")).toBe(123450);
    expect(parseAmountInput('99999999.99')).toBe(MAX_AMOUNT);
  });
  it('rejects invalid input', () => {
    expect(parseAmountInput('')).toBeNull();
    expect(parseAmountInput('.')).toBeNull();
    expect(parseAmountInput('12.345')).toBeNull();
    expect(parseAmountInput('abc')).toBeNull();
    expect(parseAmountInput('100000000')).toBeNull();
    expect(parseAmountInput('-5')).toBeNull();
  });
});

describe('applyKeypadKey', () => {
  it('builds the text key by key', () => {
    let t = '';
    for (const k of ['1', '2', '.', '5', '0', '0']) t = applyKeypadKey(t, k);
    expect(t).toBe('12.50');
    expect(applyKeypadKey('12.50', 'backspace')).toBe('12.5');
    expect(applyKeypadKey('', '.')).toBe('0.');
    expect(applyKeypadKey('0.', '.')).toBe('0.');
    expect(applyKeypadKey('0', '7')).toBe('7');
    expect(applyKeypadKey('99999999', '9')).toBe('99999999');
    expect(applyKeypadKey('', 'backspace')).toBe('');
    expect(applyKeypadKey('1', 'x')).toBe('1');
  });
  it('round-trips through amountToInput', () => {
    expect(amountToInput(parseAmountInput('12.5')!)).toBe('12.50');
    expect(amountToInput(1200)).toBe('12');
    expect(amountToInput(0)).toBe('');
    expect(amountToInput(105)).toBe('1.05');
  });
});

describe('compactNumber', () => {
  it('formats axis labels compactly', () => {
    expect(compactNumber(95_000)).toBe('950');
    expect(compactNumber(120_000)).toBe('1.2k');
    expect(compactNumber(100_000)).toBe('1k');
    expect(compactNumber(1_250_000)).toBe('13k');
    expect(compactNumber(150_000_000)).toBe('1.5M');
    expect(compactNumber(-120_000)).toBe('−1.2k');
  });
});

describe('signedAmount', () => {
  it('makes expenses negative', () => {
    expect(signedAmount(500, 'EXPENSE')).toBe(-500);
    expect(signedAmount(500, 'INCOME')).toBe(500);
  });
});
