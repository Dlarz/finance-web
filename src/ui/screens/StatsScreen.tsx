import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../app/AppState';
import { db } from '../../app/container';
import { navigate } from '../../app/router';
import { setStatsPeriod, setStatsState, useStatsState } from '../../app/statsStore';
import { transactionsInRange } from '../../data/transactionsRepo';
import type { TxType } from '../../data/types';
import { dayOf, isoWeekday, yearOf, type ISODate } from '../../domain/dates';
import { formatAmount } from '../../domain/money';
import { chartBuckets, customPeriod, isCurrentPeriod, periodFor, shiftPeriod, type Period, type PeriodKind } from '../../domain/periods';
import { bucketSums, categoryBreakdown, donutSegments, formatPercent, OTHERS_ID, totals } from '../../domain/statistics';
import { useI18n } from '../../i18n';
import { Amount } from '../components/Amount';
import { BarChart, type BarDatum } from '../components/BarChart';
import { DateInput } from '../components/DateInput';
import { DonutChart, type DonutDatum } from '../components/DonutChart';
import { CategoryIcon, Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';
import { Sheet } from '../components/Sheet';
import { useCategories } from '../hooks';

const OTHERS_COLOR = '#9AA0AE';

export function StatsScreen() {
  const { t, f } = useI18n();
  const { settings, today } = useApp();
  const stats = useStatsState();
  const categories = useCategories();
  const weekStart = settings.weekStart;
  const [selected, setSelected] = useState<string | null>(null);
  const [picker, setPicker] = useState<'year' | 'range' | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const period: Period = useMemo(() => {
    const stored = stats.periods[stats.kind];
    if (stored) return stored;
    return stats.kind === 'custom' ? customPeriod(periodFor('month', today, weekStart).start, today) : periodFor(stats.kind, today, weekStart);
  }, [stats.kind, stats.periods, today, weekStart]);

  const transactions = useLiveQuery(() => transactionsInRange(db, period.start, period.end), [period.start, period.end]);

  useEffect(() => {
    setSelected(null);
  }, [period.start, period.end, stats.chartType]);

  const setKind = (kind: PeriodKind) => setStatsState({ kind });
  const go = (delta: number) => {
    setStatsPeriod(shiftPeriod(period, delta, weekStart));
    setAnimKey((k) => k + 1);
  };
  const goToday = () => setStatsPeriod(stats.kind === 'custom' ? customPeriod(periodFor('month', today, weekStart).start, today) : periodFor(stats.kind, today, weekStart));
  const isCurrent = isCurrentPeriod(period, today);

  const label = (() => {
    switch (period.kind) {
      case 'day':
        return f.dayLong(period.start);
      case 'week':
        return f.range(period.start, period.end);
      case 'month':
        return f.monthYear(period.start);
      case 'year':
        return String(yearOf(period.start));
      case 'custom':
        return f.range(period.start, period.end, { alwaysYear: true });
    }
  })();

  const sums = useMemo(() => (transactions ? totals(transactions) : null), [transactions]);
  const breakdown = useMemo(() => (transactions ? categoryBreakdown(transactions, stats.chartType) : null), [transactions, stats.chartType]);
  const donut: DonutDatum[] = useMemo(() => {
    if (!breakdown || !categories) return [];
    return donutSegments(breakdown.rows).map((seg) => ({
      ...seg,
      color: seg.id === OTHERS_ID ? OTHERS_COLOR : categories.byId.get(seg.id)?.colorHex ?? OTHERS_COLOR,
      label: seg.id === OTHERS_ID ? t('others') : categories.byId.get(seg.id)?.name ?? '—',
    }));
  }, [breakdown, categories, t]);

  const bars: { kind: string; data: BarDatum[] } | null = useMemo(() => {
    if (!transactions) return null;
    const cb = chartBuckets(period, weekStart);
    if (!cb) return null;
    const values = bucketSums(transactions, cb.buckets, stats.chartType);
    const data = cb.buckets.map((b, i) => {
      let short: string;
      let title: string;
      if (cb.kind === 'day') {
        short = period.kind === 'week' ? f.weekdayNarrow(isoWeekday(b.start)) : String(dayOf(b.start));
        title = f.dayShort(b.start);
      } else if (cb.kind === 'week') {
        short = f.monthDay(b.start).replace(/\.$/, '');
        title = f.range(b.start, b.end);
      } else {
        short = f.monthShort(b.start).replace('.', '');
        title = f.monthYear(b.start);
      }
      return { key: b.start, value: values[i] ?? 0, label: short, title, highlighted: today >= b.start && today <= b.end };
    });
    return { kind: cb.kind, data };
  }, [transactions, period, weekStart, stats.chartType, f, today]);

  const emptyKey = (() => {
    const base = stats.chartType === 'EXPENSE' ? 'noExpenses' : 'noIncome';
    const suffix = period.kind === 'day' ? 'Day' : period.kind === 'week' ? 'Week' : period.kind === 'month' ? 'Month' : period.kind === 'year' ? 'Year' : 'Period';
    return `${base}${suffix}` as const;
  })();

  const selectedSeg = donut.find((s) => s.id === selected) ?? null;
  const chartColor = stats.chartType === 'EXPENSE' ? 'var(--expense)' : 'var(--income)';

  const onTouchStart = (e: React.TouchEvent) => {
    const p = e.touches[0]!;
    touch.current = { x: p.clientX, y: p.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const p = e.changedTouches[0]!;
    const dx = p.clientX - s.x;
    const dy = p.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };

  const pickerLabel = (
    <span className="period-nav__label" data-testid="period-label">
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <Icon name="expand_more" style={{ width: '1.25rem', height: '1.25rem', color: 'var(--text-3)' }} />
    </span>
  );

  return (
    <Screen title={t('statistics')} large tab testId="stats-screen">
      <div className="stack" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <Segmented<PeriodKind>
          value={stats.kind}
          ariaLabel={t('period')}
          options={[
            { value: 'day', label: t('day') },
            { value: 'week', label: t('week') },
            { value: 'month', label: t('month') },
            { value: 'year', label: t('year') },
            { value: 'custom', label: t('period') },
          ]}
          onChange={setKind}
        />

        <div className="period-nav">
          <button type="button" className="btn btn--icon" aria-label={t('previous')} onClick={() => go(-1)} data-testid="period-prev">
            <Icon name="chevron_left" />
          </button>
          {period.kind === 'day' || period.kind === 'week' ? (
            <DateInput value={period.kind === 'day' ? period.start : period.start} onChange={(d) => setStatsPeriod(periodFor(period.kind, d, weekStart))} ariaLabel={period.kind === 'day' ? t('chooseDay') : t('chooseWeek')} className="grow">
              {pickerLabel}
            </DateInput>
          ) : period.kind === 'month' ? (
            <DateInput type="month" value={period.start} onChange={(d) => setStatsPeriod(periodFor('month', d, weekStart))} ariaLabel={t('chooseMonth')} className="grow">
              {pickerLabel}
            </DateInput>
          ) : (
            <button type="button" className="grow" style={{ display: 'flex' }} onClick={() => setPicker(period.kind === 'year' ? 'year' : 'range')} aria-label={period.kind === 'year' ? t('chooseYear') : t('chooseRange')}>
              {pickerLabel}
            </button>
          )}
          <button type="button" className="btn btn--icon" aria-label={t('next')} onClick={() => go(1)} data-testid="period-next">
            <Icon name="chevron_right" />
          </button>
        </div>
        {!isCurrent && (
          <button type="button" className="btn btn--secondary btn--sm" style={{ alignSelf: 'center' }} onClick={goToday} data-testid="period-today">
            <Icon name="today" style={{ width: '1.125rem', height: '1.125rem' }} />
            {t('today')}
          </button>
        )}

        {sums && (
          <div className="stats-summary anim-in" key={`sum-${animKey}`} data-testid="stats-summary">
            <div className="stats-summary__item">
              <span className="stats-summary__label">{t('incomes')}</span>
              <span className="stats-summary__value" style={{ color: 'var(--income)' }}>
                <Amount value={sums.income} />
              </span>
            </div>
            <div className="stats-summary__item">
              <span className="stats-summary__label">{t('expenses')}</span>
              <span className="stats-summary__value" style={{ color: 'var(--expense)' }}>
                <Amount value={sums.expenses} />
              </span>
            </div>
            <div className="stats-summary__item">
              <span className="stats-summary__label">{t('net')}</span>
              <span className="stats-summary__value">{formatAmount(sums.net, { currency: settings.currency, sign: 'value' })}</span>
            </div>
          </div>
        )}

        <Segmented<TxType>
          value={stats.chartType}
          ariaLabel={t('type')}
          className={stats.chartType === 'EXPENSE' ? 'segmented--expense' : 'segmented--income'}
          options={[
            { value: 'EXPENSE', label: t('expenses') },
            { value: 'INCOME', label: t('incomes') },
          ]}
          onChange={(chartType) => setStatsState({ chartType })}
        />

        {breakdown && categories && (
          <div className="card stack">
            <DonutChart segments={donut} selectedId={selected} onSelect={setSelected}>
              {breakdown.total <= 0 ? (
                <span className="donut-center__label" style={{ whiteSpace: 'normal', fontSize: '0.8125rem' }} data-testid="donut-empty">
                  {t(emptyKey)}
                </span>
              ) : selectedSeg ? (
                <>
                  <span className="donut-center__label" style={{ color: selectedSeg.color }}>
                    {selectedSeg.label}
                  </span>
                  <span className="donut-center__value">{formatAmount(selectedSeg.amount, { currency: settings.currency, bare: true })}</span>
                  <span className="donut-center__pct">{formatPercent(selectedSeg.share)}</span>
                </>
              ) : (
                <>
                  <span className="donut-center__label">{t('total')}</span>
                  <span className="donut-center__value">{formatAmount(breakdown.total, { currency: settings.currency, bare: true })}</span>
                  <span className="donut-center__pct">{settings.currency}</span>
                </>
              )}
            </DonutChart>
            {breakdown.rows.length > 0 && (
              <div className="list" data-testid="category-list">
                {breakdown.rows.map((row) => {
                  const cat = categories.byId.get(row.categoryId);
                  const color = cat?.colorHex ?? OTHERS_COLOR;
                  return (
                    <button
                      key={row.categoryId}
                      type="button"
                      className="row row--plain"
                      style={{ padding: '0.625rem 0', background: 'transparent' }}
                      onClick={() => navigate({ name: 'transactions', query: { type: stats.chartType, categoryId: row.categoryId, start: period.start, end: period.end } })}
                      data-testid="category-row"
                    >
                      <span className="legend-dot" style={{ background: color }} />
                      <CategoryIcon iconKey={cat?.iconKey ?? 'category'} colorHex={color} size="2.25rem" soft />
                      <span className="row__body">
                        <span className="row-flex" style={{ justifyContent: 'space-between' }}>
                          <span className="row__title">{cat?.name ?? '—'}</span>
                          <span className="amount small">{formatAmount(row.amount, { currency: settings.currency, bare: true })}</span>
                        </span>
                        <span className="row-flex" style={{ gap: '0.5rem' }}>
                          <span className="progress-bar grow">
                            <span className="progress-bar__fill" style={{ width: `${Math.max(2, row.share * 100)}%`, background: color, display: 'block' }} />
                          </span>
                          <span className="faint small tabular" style={{ minWidth: '3rem', textAlign: 'right' }}>
                            {formatPercent(row.share)}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {bars && (
          <div className="card stack stack--tight">
            <div className="section-title" style={{ margin: 0 }}>
              <span>{t('overTime')}</span>
            </div>
            <BarChart data={bars.data} color={chartColor} formatValue={(v) => formatAmount(v, { currency: settings.currency })} />
          </div>
        )}
      </div>

      {picker === 'year' && (
        <YearPicker
          year={yearOf(period.start)}
          today={today}
          onClose={() => setPicker(null)}
          onPick={(y) => {
            setStatsPeriod(periodFor('year', `${y}-01-01`, weekStart));
            setPicker(null);
          }}
        />
      )}
      {picker === 'range' && (
        <RangePicker
          start={period.start}
          end={period.end}
          today={today}
          onClose={() => setPicker(null)}
          onPick={(s, e) => {
            setStatsPeriod(customPeriod(s, e));
            setPicker(null);
          }}
        />
      )}
    </Screen>
  );
}

function YearPicker({ year, today, onClose, onPick }: { year: number; today: ISODate; onClose: () => void; onPick: (y: number) => void }) {
  const { t } = useI18n();
  const first = useLiveQuery(() => db.transactions.orderBy('date').first(), []);
  const minYear = Math.min(first ? yearOf(first.date) : yearOf(today), year, yearOf(today) - 1);
  const years: number[] = [];
  for (let y = yearOf(today) + 1; y >= minYear; y--) years.push(y);
  return (
    <Sheet title={t('chooseYear')} onClose={onClose} testId="year-picker">
      <div className="list">
        {years.map((y) => (
          <button key={y} type="button" className="row row--plain" aria-pressed={y === year} onClick={() => onPick(y)} style={{ background: 'transparent' }}>
            <span className="row__title grow">{y}</span>
            {y === year && <Icon name="check" style={{ color: 'var(--accent)' }} />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function RangePicker({ start, end, today, onClose, onPick }: { start: ISODate; end: ISODate; today: ISODate; onClose: () => void; onPick: (s: ISODate, e: ISODate) => void }) {
  const { t, f } = useI18n();
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  return (
    <Sheet
      title={t('chooseRange')}
      onClose={onClose}
      testId="range-picker"
      footer={
        <button type="button" className="btn btn--primary" onClick={() => onPick(s, e)}>
          {t('apply')}
        </button>
      }
    >
      <div className="stack">
        <div className="settings-row" style={{ padding: '0.5rem 0' }}>
          <span className="settings-row__body settings-row__title">{t('from')}</span>
          <DateInput value={s} max={today} onChange={setS} ariaLabel={t('from')}>
            <span className="chip chip--soft">
              <Icon name="event" />
              {f.date(s)}
            </span>
          </DateInput>
        </div>
        <div className="settings-row" style={{ padding: '0.5rem 0' }}>
          <span className="settings-row__body settings-row__title">{t('to')}</span>
          <DateInput value={e} max={today} onChange={setE} ariaLabel={t('to')}>
            <span className="chip chip--soft">
              <Icon name="event" />
              {f.date(e)}
            </span>
          </DateInput>
        </div>
      </div>
    </Sheet>
  );
}
