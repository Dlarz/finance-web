import type { ISODate } from '../domain/dates';
import { monthlyDayNeedsClamp, type Schedule } from '../domain/recurring';
import type { I18n } from '../i18n';

/** "Monthly on the 31st (last day in shorter months)" / "Every 2 weeks on Monday" */
export function describeSchedule(schedule: Schedule, i18n: I18n, options: { withEnd?: boolean } = {}): string {
  const { t, f } = i18n;
  const n = Math.max(1, schedule.interval);
  let text: string;
  switch (schedule.frequency) {
    case 'DAILY':
      text = n === 1 ? t('scheduleDaily') : t('scheduleEveryNDays', { n });
      break;
    case 'WEEKLY': {
      const weekday = f.weekdayOf(schedule.startDate);
      text = n === 1 ? t('scheduleWeekly', { weekday }) : t('scheduleEveryNWeeks', { n, weekday });
      break;
    }
    case 'MONTHLY': {
      const day = f.ordinal(f.dayOfMonth(schedule.startDate));
      text = n === 1 ? t('scheduleMonthly', { day }) : t('scheduleEveryNMonths', { n, day });
      if (monthlyDayNeedsClamp(schedule)) text += ` ${t('lastDayHint')}`;
      break;
    }
    case 'YEARLY': {
      const date = f.yearlyDate(schedule.startDate);
      text = n === 1 ? t('scheduleYearly', { date }) : t('scheduleEveryNYears', { n, date });
      break;
    }
  }
  if (options.withEnd && schedule.endDate) text += ` · ${t('scheduleUntil', { date: f.date(schedule.endDate) })}`;
  return text;
}

export function formatNext(next: ISODate | null, i18n: I18n): string {
  return next ? i18n.f.date(next) : '—';
}
