import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { useApp } from '../../app/AppState';
import { db } from '../../app/container';
import { useDialogs } from '../../app/dialogs';
import { goBack, navigate } from '../../app/router';
import { useToast } from '../../app/toast';
import { deleteTransaction, getTransactionDetails, restoreTransaction } from '../../data/transactionsRepo';
import { useI18n } from '../../i18n';
import { Amount } from '../components/Amount';
import { CategoryIcon, Icon } from '../components/Icon';
import { PictureGrid } from '../components/Pictures';
import { Screen } from '../components/Screen';
import { useCategories } from '../hooks';

export function TransactionDetailsScreen({ id }: { id: string }) {
  const { t, f, relativeDay } = useI18n();
  const { today } = useApp();
  const toast = useToast();
  const dialogs = useDialogs();
  const categories = useCategories();
  const details = useLiveQuery(() => getTransactionDetails(db, id), [id]);

  useEffect(() => {
    if (details === null) goBack();
  }, [details]);

  const remove = async () => {
    const ok = await dialogs.confirm({ title: t('deleteTransactionTitle'), text: t('deleteTransactionText'), confirmLabel: t('delete'), danger: true });
    if (!ok) return;
    const snapshot = await deleteTransaction(db, id);
    if (snapshot) toast.show(t('transactionDeleted'), { action: { label: t('undo'), onClick: () => void restoreTransaction(db, snapshot) } });
    goBack();
  };

  const tx = details?.transaction;
  const category = tx ? categories?.byId.get(tx.categoryId) : undefined;

  return (
    <Screen
      title={t('transaction')}
      back
      testId="details-screen"
      actions={
        tx && (
          <button type="button" className="btn btn--icon" aria-label={t('edit')} onClick={() => navigate({ name: 'edit', id })} data-testid="edit-button">
            <Icon name="edit" />
          </button>
        )
      }
    >
      {tx && details && (
        <div className="stack">
          <div className="card text-center" style={{ padding: '1.75rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <CategoryIcon iconKey={category?.iconKey ?? 'category'} colorHex={category?.colorHex ?? '#6B7280'} size="3.5rem" />
            </div>
            <div className="card__value card__value--md" style={{ fontSize: '2rem' }}>
              <Amount value={tx.amount} type={tx.type} />
            </div>
            <div className="muted" style={{ marginTop: '0.375rem', fontWeight: 600 }}>
              {category?.name ?? '—'}
            </div>
            <div className="faint small" style={{ marginTop: '0.125rem' }}>
              {tx.type === 'EXPENSE' ? t('expense') : t('income')}
            </div>
          </div>

          <div className="list list--card">
            <DetailRow icon="event" label={t('date')} value={`${relativeDay(tx.date, today)} · ${f.dayLong(tx.date)}`} />
            {tx.comment && <DetailRow icon="notes" label={t('comment')} value={tx.comment} multiline />}
            {details.tags.length > 0 && (
              <div className="settings-row">
                <span className="icon-circle icon-circle--soft settings-row__icon">
                  <Icon name="sell" />
                </span>
                <span className="settings-row__body">
                  <span className="settings-row__hint">{t('tags')}</span>
                  <span className="tag-list" style={{ marginTop: '0.25rem' }}>
                    {details.tags.map((tag) => (
                      <span key={tag.id} className="tag">
                        {tag.name}
                      </span>
                    ))}
                  </span>
                </span>
              </div>
            )}
            {tx.recurringRuleId && (
              <button type="button" className="settings-row" onClick={() => navigate({ name: 'rule', id: tx.recurringRuleId! })} data-testid="open-rule">
                <span className="icon-circle icon-circle--soft settings-row__icon">
                  <Icon name="repeat" />
                </span>
                <span className="settings-row__body">
                  <span className="settings-row__hint">{t('fromRecurringRule')}</span>
                  <span className="settings-row__title" style={{ color: 'var(--accent)' }}>
                    {t('openRule')}
                  </span>
                </span>
                <Icon name="chevron_right" className="row__chevron" />
              </button>
            )}
            <DetailRow icon="schedule" label={t('created')} value={f.dateTime(tx.createdAt)} />
            {tx.updatedAt !== tx.createdAt && <DetailRow icon="history" label={t('edited')} value={f.dateTime(tx.updatedAt)} />}
          </div>

          {details.attachments.length > 0 && (
            <div className="field">
              <span className="field__label">{t('pictures')}</span>
              <PictureGrid items={details.attachments.map((a) => ({ id: a.id, data: a.data, thumb: a.thumb, mimeType: a.mimeType }))} />
            </div>
          )}

          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => navigate({ name: 'edit', id })}>
            <Icon name="edit" />
            {t('edit')}
          </button>
          <button type="button" className="btn btn--danger-soft btn--block" onClick={() => void remove()} data-testid="delete-button">
            <Icon name="delete" />
            {t('delete')}
          </button>
        </div>
      )}
    </Screen>
  );
}

function DetailRow({ icon, label, value, multiline }: { icon: string; label: string; value: string; multiline?: boolean }) {
  return (
    <div className="settings-row">
      <span className="icon-circle icon-circle--soft settings-row__icon">
        <Icon name={icon} />
      </span>
      <span className="settings-row__body">
        <span className="settings-row__hint">{label}</span>
        <span className="settings-row__title" style={multiline ? { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontWeight: 500 } : { overflowWrap: 'anywhere' }}>
          {value}
        </span>
      </span>
    </div>
  );
}
