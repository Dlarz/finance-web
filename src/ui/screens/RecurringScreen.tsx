import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../../app/AppState';
import { clock, db } from '../../app/container';
import { navigate } from '../../app/router';
import { nextRuleDate, pauseRule, resumeRule } from '../../data/rulesRepo';
import { useI18n } from '../../i18n';
import { Amount } from '../components/Amount';
import { EmptyState } from '../components/EmptyState';
import { CategoryIcon, Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { useCategories } from '../hooks';
import { describeSchedule } from '../schedule';

export function RecurringScreen() {
  const i18n = useI18n();
  const { t, f } = i18n;
  const { today } = useApp();
  const categories = useCategories();
  const rules = useLiveQuery(() => db.recurringRules.toArray(), []);
  const sorted = rules ? [...rules].sort((a, b) => Number(a.isPaused) - Number(b.isPaused) || a.createdAt - b.createdAt) : [];

  return (
    <Screen
      title={t('recurringTitle')}
      back
      testId="recurring-screen"
      actions={
        <button type="button" className="btn btn--icon" aria-label={t('newRule')} onClick={() => navigate({ name: 'rule', id: null })} data-testid="add-rule">
          <Icon name="add" />
        </button>
      }
    >
      {rules && rules.length === 0 && (
        <EmptyState
          icon="repeat"
          title={t('recurringEmptyTitle')}
          text={t('recurringEmptyText')}
          action={
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => navigate({ name: 'rule', id: null })}>
              <Icon name="add" />
              {t('newRule')}
            </button>
          }
        />
      )}
      {rules && rules.length > 0 && categories && (
        <div className="list list--card">
          {sorted.map((rule) => {
            const cat = categories.byId.get(rule.categoryId);
            const next = nextRuleDate(rule, today);
            const ended = !rule.isPaused && next === null;
            return (
              <div key={rule.id} className="row" data-testid="rule-row" style={{ alignItems: 'flex-start', paddingRight: '0.5rem' }}>
                <button type="button" className="row-flex grow" style={{ textAlign: 'left', alignItems: 'flex-start' }} onClick={() => navigate({ name: 'rule', id: rule.id })}>
                  <CategoryIcon iconKey={cat?.iconKey ?? 'category'} colorHex={cat?.colorHex ?? '#6B7280'} />
                  <span className="row__body">
                    <span className="row-flex" style={{ justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span className="row__title">{rule.comment || cat?.name || '—'}</span>
                      <Amount value={rule.amount} type={rule.type} />
                    </span>
                    <span className="row__subtitle" style={{ whiteSpace: 'normal' }}>
                      {describeSchedule(rule, i18n, { withEnd: true })}
                    </span>
                    <span className="row__subtitle">
                      {rule.isPaused ? (
                        <span className="pill">{t('paused')}</span>
                      ) : ended ? (
                        <span className="pill pill--muted">{t('ended')}</span>
                      ) : (
                        <>
                          <Icon name="event" />
                          {t('nextDate')}: {next ? f.date(next) : '—'}
                        </>
                      )}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn--icon"
                  aria-label={rule.isPaused ? t('resume') : t('pause')}
                  onClick={() => void (rule.isPaused ? resumeRule(db, clock, rule.id) : pauseRule(db, clock, rule.id))}
                  data-testid="rule-toggle"
                >
                  <Icon name={rule.isPaused ? 'play_arrow' : 'pause'} style={{ color: 'var(--text-2)' }} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
