import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useApp } from '../../app/AppState';
import { db } from '../../app/container';
import { navigate } from '../../app/router';
import { sortTransactions } from '../../data/transactionsRepo';
import { computeBalance } from '../../domain/balance';
import { endOfMonth, startOfMonth } from '../../domain/dates';
import { totals } from '../../domain/statistics';
import { useI18n } from '../../i18n';
import { Amount, AnimatedAmount } from '../components/Amount';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { TransactionRow } from '../components/TransactionRow';
import { useAttachmentIds, useCategories, useTagNames } from '../hooks';
import { useBackupAction } from './SettingsScreen';

const BACKUP_REMINDER_DAYS = 14;

export function HomeScreen() {
  const { t, f, relativeDay } = useI18n();
  const { settings, today } = useApp();
  const categories = useCategories();
  const tagNames = useTagNames();
  const withPictures = useAttachmentIds();
  const all = useLiveQuery(() => db.transactions.toArray(), []);
  const backup = useBackupAction();

  const balance = useMemo(() => (all ? computeBalance(settings.startingBalance, all) : null), [all, settings.startingBalance]);
  const monthTotals = useMemo(() => {
    if (!all) return null;
    const start = startOfMonth(today);
    const end = endOfMonth(today);
    return totals(all.filter((tx) => tx.date >= start && tx.date <= end));
  }, [all, today]);
  const recent = useMemo(() => (all ? sortTransactions(all).slice(0, 5) : []), [all]);

  const showBackupReminder = useMemo(() => {
    if (!all || all.length === 0) return false;
    const ageLimit = Date.now() - BACKUP_REMINDER_DAYS * 86_400_000;
    if (settings.lastBackupAt != null) return settings.lastBackupAt < ageLimit;
    const firstUse = settings.firstUseAt ?? Math.min(...all.map((x) => x.createdAt));
    return firstUse < ageLimit;
  }, [all, settings.lastBackupAt, settings.firstUseAt]);

  const loaded = all && categories && balance !== null && monthTotals;

  return (
    <Screen
      title={t('overview')}
      subtitle={f.dayFull(today)}
      large
      tab
      testId="home-screen"
      actions={
        <button type="button" className="btn btn--icon btn--icon-tonal" aria-label={t('navSettings')} onClick={() => navigate({ name: 'settings' })} data-testid="open-settings">
          <Icon name="settings" />
        </button>
      }
    >
      {loaded && (
        <div className="stack">
          <div className={`card card--accent${balance < 0 ? ' card--negative' : ''}`} data-testid="balance-card">
            <div className="card__label">{t('totalBalance')}</div>
            <div className="card__value">
              <AnimatedAmount value={balance} />
            </div>
          </div>
          <div className="card-grid-2">
            <div className="card kpi kpi--income">
              <span className="kpi__label">
                <Icon name="north_east" />
                {t('incomeThisMonth')}
              </span>
              <span className="kpi__value">
                <Amount value={monthTotals.income} type="INCOME" signed={false} colored={false} />
              </span>
            </div>
            <div className="card kpi kpi--expense">
              <span className="kpi__label">
                <Icon name="south_west" />
                {t('expensesThisMonth')}
              </span>
              <span className="kpi__value">
                <Amount value={monthTotals.expenses} type="EXPENSE" signed={false} colored={false} />
              </span>
            </div>
          </div>
          {showBackupReminder && (
            <div className="card stack stack--tight" data-testid="backup-reminder" style={{ borderColor: 'var(--warning)', background: 'var(--warning-soft)' }}>
              <div className="row-flex">
                <Icon name="backup" style={{ color: 'var(--warning)' }} />
                <strong>{t('backupReminderTitle')}</strong>
              </div>
              <p className="small muted">{settings.lastBackupAt == null ? t('backupReminderNever') : t('backupReminderText')}</p>
              <button type="button" className="btn btn--primary btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => void backup()}>
                {t('backupNow')}
              </button>
            </div>
          )}
          <div>
            <div className="section-title">
              <span>{t('recentTransactions')}</span>
              {all.length > 0 && (
                <button type="button" className="section-title__action" onClick={() => navigate({ name: 'transactions', query: {} }, { replace: true })}>
                  {t('seeAll')}
                </button>
              )}
            </div>
            {recent.length === 0 ? (
              <div className="card card--tight">
                <EmptyState icon="receipt_long" title={t('homeEmptyTitle')} text={t('homeEmptyText')} />
              </div>
            ) : (
              <div className="list list--card">
                {recent.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    transaction={tx}
                    category={categories.byId.get(tx.categoryId)}
                    tags={tagNames?.get(tx.id)}
                    hasPictures={withPictures?.has(tx.id)}
                    dateLabel={relativeDay(tx.date, today)}
                    onClick={() => navigate({ name: 'transaction', id: tx.id })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Screen>
  );
}
