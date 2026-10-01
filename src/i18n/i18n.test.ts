import { describe, expect, it } from 'vitest';
import { createI18n, DateFormatter, detectLanguage, translate } from './index';
import { en } from './en';
import { de } from './de';

describe('i18n', () => {
  it('detects the language', () => {
    expect(detectLanguage(['de-CH', 'en'])).toBe('de');
    expect(detectLanguage(['fr-CH', 'en-GB'])).toBe('en');
    expect(detectLanguage(['fr'])).toBe('en');
  });

  it('has the same keys in both languages', () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
    for (const [k, v] of Object.entries(de)) expect(v, k).not.toBe('');
  });

  it('replaces parameters', () => {
    expect(translate('en', 'savedWithOccurrences', { n: 3 })).toBe('Saved · 3 past transactions created');
    expect(translate('de', 'usedIn', { n: 12 })).toBe('12 Buchungen');
  });

  it('formats dates in English', () => {
    const f = new DateFormatter('en');
    expect(f.dayLong('2026-09-30')).toBe('Wed, Sep 30, 2026');
    expect(f.dayShort('2026-09-28')).toBe('Mon, Sep 28');
    expect(f.monthYear('2026-09-01')).toBe('September 2026');
    expect(f.range('2026-09-28', '2026-10-04')).toBe('Sep 28 – Oct 4');
    expect(f.range('2026-12-28', '2027-01-03')).toBe('Dec 28, 2026 – Jan 3, 2027');
    expect(f.range('2026-09-05', '2026-09-30', { alwaysYear: true })).toBe('Sep 5 – Sep 30, 2026');
    expect(f.ordinal(1)).toBe('1st');
    expect(f.ordinal(2)).toBe('2nd');
    expect(f.ordinal(3)).toBe('3rd');
    expect(f.ordinal(11)).toBe('11th');
    expect(f.ordinal(22)).toBe('22nd');
    expect(f.ordinal(31)).toBe('31st');
    expect(f.weekdayLong(1)).toBe('Monday');
    expect(f.weekdayNarrow(7)).toBe('Sun');
  });

  it('formats dates in German', () => {
    const f = new DateFormatter('de');
    expect(f.dayLong('2026-09-30')).toBe('Mi., 30. Sept. 2026');
    expect(f.monthYear('2026-09-01')).toBe('September 2026');
    expect(f.ordinal(1)).toBe('1.');
    expect(f.weekdayLong(1)).toBe('Montag');
    expect(f.range('2026-09-28', '2026-10-04')).toBe('28. Sept. – 4. Okt.');
  });

  it('labels relative days', () => {
    const i = createI18n('en');
    expect(i.relativeDay('2026-09-30', '2026-09-30')).toBe('Today');
    expect(i.relativeDay('2026-09-29', '2026-09-30')).toBe('Yesterday');
    expect(i.relativeDay('2026-09-28', '2026-09-30')).toBe('Mon, Sep 28');
    expect(i.relativeDay('2025-09-28', '2026-09-30')).toBe('Sun, Sep 28, 2025');
  });
});
