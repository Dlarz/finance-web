import { createContext, useContext } from 'react';
import { addDays, isoWeekday, parseISODate, toDate, yearOf, type ISODate } from '../domain/dates';
import type { LanguageSetting } from '../data/types';
import { de } from './de';
import { en, type StringKey, type Strings } from './en';
import type { Language } from './types';

export type { Language, StringKey };

const TABLES: Record<Language, Strings> = { de, en };

export function detectLanguage(navigatorLanguages: readonly string[]): Language {
  for (const l of navigatorLanguages) {
    if (l.toLowerCase().startsWith('de')) return 'de';
    if (l.toLowerCase().startsWith('en')) return 'en';
  }
  return 'en';
}

export function resolveLanguage(setting: LanguageSetting, navigatorLanguages: readonly string[]): Language {
  return setting === 'system' ? detectLanguage(navigatorLanguages) : setting;
}

export type Params = Record<string, string | number>;

export function translate(lang: Language, key: StringKey, params?: Params): string {
  let text = TABLES[lang][key] ?? en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) text = text.split(`{${k}}`).join(String(v));
  return text;
}

const LOCALE: Record<Language, string> = { de: 'de-CH', en: 'en-US' };

export class DateFormatter {
  private readonly locale: string;
  private cache = new Map<string, Intl.DateTimeFormat>();

  constructor(public readonly lang: Language) {
    this.locale = LOCALE[lang];
  }

  private fmt(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const key = JSON.stringify(options);
    let f = this.cache.get(key);
    if (!f) {
      f = new Intl.DateTimeFormat(this.locale, options);
      this.cache.set(key, f);
    }
    return f;
  }

  /** "Wed, Sep 30, 2026" / "Mi., 30. Sep. 2026" */
  dayLong(iso: ISODate): string {
    return this.fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(toDate(iso));
  }

  /** "Mon, Sep 28" / "Mo., 28. Sep." (+ year when requested) */
  dayShort(iso: ISODate, withYear = false): string {
    return this.fmt({ weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(toDate(iso));
  }

  /** "Wednesday, September 30, 2026" */
  dayFull(iso: ISODate): string {
    return this.fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(toDate(iso));
  }

  /** "Sep 25" / "25. Sep." */
  monthDay(iso: ISODate, withYear = false): string {
    return this.fmt({ day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(toDate(iso));
  }

  /** "Sep 30, 2026" / "30. Sep. 2026" */
  date(iso: ISODate): string {
    return this.fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(toDate(iso));
  }

  /** "September 2026" */
  monthYear(iso: ISODate): string {
    return this.fmt({ month: 'long', year: 'numeric' }).format(toDate(iso));
  }

  /** "Sep" / "Sep." */
  monthShort(iso: ISODate): string {
    return this.fmt({ month: 'short' }).format(toDate(iso));
  }

  /** "September" */
  monthLong(month: number): string {
    return this.fmt({ month: 'long' }).format(new Date(2026, month - 1, 1));
  }

  /** "Mo" / "Mon" – narrow weekday for chart axes, 1 = Monday */
  weekdayNarrow(isoWeekdayNumber: number): string {
    // 2026-09-28 is a Monday
    return this.fmt({ weekday: 'short' }).format(toDate(addDays('2026-09-28', isoWeekdayNumber - 1))).replace('.', '');
  }

  /** "Monday" / "Montag", 1 = Monday */
  weekdayLong(isoWeekdayNumber: number): string {
    return this.fmt({ weekday: 'long' }).format(toDate(addDays('2026-09-28', isoWeekdayNumber - 1)));
  }

  /** A range like "Sep 28 – Oct 4" or "Dec 28, 2026 – Jan 3, 2027" */
  range(start: ISODate, end: ISODate, opts: { alwaysYear?: boolean } = {}): string {
    const sameYear = yearOf(start) === yearOf(end);
    if (sameYear && !opts.alwaysYear) return `${this.monthDay(start)} – ${this.monthDay(end)}`;
    if (sameYear) return `${this.monthDay(start)} – ${this.monthDay(end, true)}`;
    return `${this.monthDay(start, true)} – ${this.monthDay(end, true)}`;
  }

  /** "Sep 30, 2026, 14:05" */
  dateTime(ms: number): string {
    return this.fmt({ day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
  }

  /** "1st" / "1." */
  ordinal(day: number): string {
    if (this.lang === 'de') return `${day}.`;
    const mod10 = day % 10;
    const mod100 = day % 100;
    if (mod10 === 1 && mod100 !== 11) return `${day}st`;
    if (mod10 === 2 && mod100 !== 12) return `${day}nd`;
    if (mod10 === 3 && mod100 !== 13) return `${day}rd`;
    return `${day}th`;
  }

  /** "Sep 30" for a yearly schedule (no year) */
  yearlyDate(iso: ISODate): string {
    return this.monthDay(iso);
  }

  weekdayOf(iso: ISODate): string {
    return this.weekdayLong(isoWeekday(iso));
  }

  dayOfMonth(iso: ISODate): number {
    return parseISODate(iso).d;
  }
}

export interface I18n {
  lang: Language;
  t: (key: StringKey, params?: Params) => string;
  f: DateFormatter;
  /** Today / Yesterday / "Mon, Sep 28" (with the year when it isn't the current year) */
  relativeDay: (iso: ISODate, today: ISODate) => string;
}

export function createI18n(lang: Language): I18n {
  const f = new DateFormatter(lang);
  const t = (key: StringKey, params?: Params) => translate(lang, key, params);
  return {
    lang,
    t,
    f,
    relativeDay: (iso, today) => {
      if (iso === today) return t('today');
      if (iso === addDays(today, -1)) return t('yesterday');
      return f.dayShort(iso, yearOf(iso) !== yearOf(today));
    },
  };
}

export const I18nContext = createContext<I18n>(createI18n('en'));

export function useI18n(): I18n {
  return useContext(I18nContext);
}
