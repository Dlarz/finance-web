import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../../app/AppState';
import { APP_VERSION, BUILD_DATE, clock, db } from '../../app/container';
import { useDialogs } from '../../app/dialogs';
import { navigate } from '../../app/router';
import { shareOrDownload } from '../../app/share';
import { useToast } from '../../app/toast';
import { backupFileName, createBackup } from '../../data/backup';
import { loadDemoData } from '../../data/demoData';
import { deleteAllData, markBackupDone } from '../../data/maintenance';
import { sortTransactions, tagNamesByTransaction } from '../../data/transactionsRepo';
import { CURRENCIES, type LanguageSetting, type ThemeSetting } from '../../data/types';
import { buildCsv } from '../../domain/csv';
import type { WeekStart } from '../../domain/dates';
import { amountToInput, applyKeypadKey, formatAmount, parseAmountInput } from '../../domain/money';
import { useI18n } from '../../i18n';
import { Chip } from '../components/Chip';
import { ChoiceSheet } from '../components/ChoiceSheet';
import { Icon } from '../components/Icon';
import { AmountDisplay, Keypad } from '../components/Keypad';
import { Screen } from '../components/Screen';
import { useTransactionCount } from '../hooks';
import { useRestoreFlow } from './restoreFlow';

/** Creates a backup zip and shares or downloads it. Shared by Settings and the Home reminder. */
export function useBackupAction(): () => Promise<void> {
  const { t } = useI18n();
  const toast = useToast();
  return useCallback(async () => {
    try {
      const blob = await createBackup(db, clock, APP_VERSION);
      const result = await shareOrDownload(blob, backupFileName(clock.today()));
      if (result === 'cancelled') return;
      await markBackupDone(db, clock);
      toast.show(result === 'shared' ? t('backupDone') : t('backupShared'));
    } catch (e) {
      console.error(e);
      toast.show(t('error'));
    }
  }, [t, toast]);
}

function Row({ icon, title, hint, value, onClick, danger, chevron = true, testId }: { icon: string; title: string; hint?: string; value?: ReactNode; onClick?: () => void; danger?: boolean; chevron?: boolean; testId?: string }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`settings-row${danger ? ' settings-row--danger' : ''}`} onClick={onClick} data-testid={testId}>
      <span className="icon-circle icon-circle--soft settings-row__icon" style={danger ? ({ '--icon-color': 'var(--expense)' } as React.CSSProperties) : undefined}>
        <Icon name={icon} />
      </span>
      <span className="settings-row__body">
        <span className="settings-row__title">{title}</span>
        {hint && <span className="settings-row__hint">{hint}</span>}
      </span>
      {value !== undefined && <span className="settings-row__value">{value}</span>}
      {onClick && chevron && <Icon name="chevron_right" className="row__chevron" />}
    </Tag>
  );
}

export function SettingsScreen() {
  const i18n = useI18n();
  const { t, f, lang } = i18n;
  const { settings, updateSettings, standalone } = useApp();
  const toast = useToast();
  const dialogs = useDialogs();
  const count = useTransactionCount();
  const backup = useBackupAction();
  const restore = useRestoreFlow({ db, clock, dialogs, toast, t });
  const restoreInput = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<'currency' | 'weekStart' | 'theme' | 'language' | 'balance' | null>(null);
  const [busy, setBusy] = useState(false);
  const lastBackupText = settings.lastBackupAt ? t('lastBackup', { date: f.dateTime(settings.lastBackupAt) }) : t('lastBackupNever');
  const persisted = useLiveQuery(async () => (navigator.storage?.persisted ? navigator.storage.persisted() : true), []);

  const exportCsv = async () => {
    const [all, categories, tags] = await Promise.all([db.transactions.toArray(), db.categories.toArray(), tagNamesByTransaction(db)]);
    if (all.length === 0) {
      toast.show(t('nothingToExport'));
      return;
    }
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const csv = buildCsv(
      sortTransactions(all).map((tx) => ({ date: tx.date, type: tx.type, category: catName.get(tx.categoryId) ?? '', amount: tx.amount, currency: settings.currency, tags: tags.get(tx.id) ?? [], comment: tx.comment })),
    );
    const result = await shareOrDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `financeapp-${clock.today()}.csv`);
    if (result !== 'cancelled') toast.show(t('exportDone'));
  };

  const deleteAll = async () => {
    if (!(await dialogs.confirm({ title: t('deleteAllTitle'), text: t('deleteAllText'), confirmLabel: t('continue'), danger: true }))) return;
    if (!(await dialogs.confirm({ title: t('deleteAllTitle2'), text: t('deleteAllText2'), confirmLabel: t('deleteAllConfirm'), danger: true }))) return;
    await deleteAllData(db);
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith('fa:')) localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    navigate({ name: 'home' }, { replace: true });
  };

  const loadDemo = async () => {
    setBusy(true);
    try {
      await loadDemoData(db, clock, lang);
      toast.show(t('demoLoaded'));
    } catch (e) {
      console.error(e);
      toast.show(t('error'));
    } finally {
      setBusy(false);
    }
  };

  const themeLabel = settings.theme === 'system' ? t('themeSystem') : settings.theme === 'light' ? t('themeLight') : t('themeDark');
  const langLabel = settings.language === 'system' ? t('languageSystem') : settings.language === 'de' ? t('german') : t('english');

  return (
    <Screen title={t('settings')} back testId="settings-screen">
      <div className="stack">
        <div>
          <div className="section-title">{t('general')}</div>
          <div className="list list--card">
            <Row icon="account_balance_wallet" title={t('startingBalance')} value={formatAmount(settings.startingBalance, { currency: settings.currency, sign: 'value' })} onClick={() => setSheet('balance')} testId="row-starting-balance" />
            <Row icon="currency_exchange" title={t('currency')} value={settings.currency} onClick={() => setSheet('currency')} testId="row-currency" />
            <Row icon="view_week" title={t('weekStart')} value={settings.weekStart === 'monday' ? t('monday') : t('sunday')} onClick={() => setSheet('weekStart')} testId="row-week-start" />
            <Row icon="language" title={t('language')} value={langLabel} onClick={() => setSheet('language')} testId="row-language" />
          </div>
        </div>
        <div>
          <div className="section-title">{t('appearance')}</div>
          <div className="list list--card">
            <Row icon={settings.theme === 'dark' ? 'dark_mode' : settings.theme === 'light' ? 'light_mode' : 'brightness_auto'} title={t('theme')} value={themeLabel} onClick={() => setSheet('theme')} testId="row-theme" />
          </div>
        </div>
        <div>
          <div className="section-title">{t('data')}</div>
          <div className="list list--card">
            <Row icon="category" title={t('categories')} onClick={() => navigate({ name: 'categories' })} testId="row-categories" />
            <Row icon="sell" title={t('tags')} onClick={() => navigate({ name: 'tags' })} testId="row-tags" />
            <Row icon="repeat" title={t('recurringTitle')} onClick={() => navigate({ name: 'recurring' })} testId="row-recurring" />
            <Row icon="download" title={t('exportCsv')} hint={t('exportCsvHint')} onClick={() => void exportCsv()} chevron={false} testId="row-export" />
            <Row icon="backup" title={t('backup')} hint={lastBackupText} onClick={() => void backup()} chevron={false} testId="row-backup" />
            <Row icon="restore" title={t('restore')} hint={t('restoreHint')} onClick={() => restoreInput.current?.click()} chevron={false} testId="row-restore" />
            {count === 0 && <Row icon="science" title={t('loadDemo')} hint={t('loadDemoHint')} onClick={busy ? undefined : () => void loadDemo()} chevron={false} testId="row-demo" />}
            <Row icon="delete_forever" title={t('deleteAllData')} onClick={() => void deleteAll()} danger chevron={false} testId="row-delete-all" />
          </div>
          {persisted === false && !standalone && (
            <div className="notice notice--warning" style={{ marginTop: '0.75rem' }}>
              <Icon name="warning" />
              <span>{t('storageWarning')}</span>
            </div>
          )}
        </div>
        <div>
          <div className="section-title">{t('about')}</div>
          <div className="list list--card">
            <Row icon="add_to_home_screen" title={t('installApp')} hint={t('installAppHint')} onClick={() => navigate({ name: 'install' })} testId="row-install" />
            <Row icon="info" title={t('version')} value={`${APP_VERSION}${BUILD_DATE ? ` · ${BUILD_DATE}` : ''}`} />
          </div>
        </div>
      </div>
      <input
        ref={restoreInput}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="visually-hidden"
        tabIndex={-1}
        data-testid="restore-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void restore(file);
        }}
      />

      {sheet === 'currency' && (
        <ChoiceSheet
          title={t('currency')}
          value={settings.currency}
          choices={CURRENCIES.map((c) => ({ value: c, label: c }))}
          onClose={() => setSheet(null)}
          onPick={(currency) => {
            void updateSettings({ currency });
            setSheet(null);
          }}
        />
      )}
      {sheet === 'weekStart' && (
        <ChoiceSheet<WeekStart>
          title={t('weekStart')}
          value={settings.weekStart}
          choices={[
            { value: 'monday', label: t('monday') },
            { value: 'sunday', label: t('sunday') },
          ]}
          onClose={() => setSheet(null)}
          onPick={(weekStart) => {
            void updateSettings({ weekStart });
            setSheet(null);
          }}
        />
      )}
      {sheet === 'theme' && (
        <ChoiceSheet<ThemeSetting>
          title={t('theme')}
          value={settings.theme}
          choices={[
            { value: 'system', label: t('themeSystem') },
            { value: 'light', label: t('themeLight') },
            { value: 'dark', label: t('themeDark') },
          ]}
          onClose={() => setSheet(null)}
          onPick={(theme) => {
            void updateSettings({ theme });
            setSheet(null);
          }}
        />
      )}
      {sheet === 'language' && (
        <ChoiceSheet<LanguageSetting>
          title={t('language')}
          value={settings.language}
          choices={[
            { value: 'system', label: t('languageSystem') },
            { value: 'de', label: t('german') },
            { value: 'en', label: t('english') },
          ]}
          onClose={() => setSheet(null)}
          onPick={(language) => {
            void updateSettings({ language });
            setSheet(null);
          }}
        />
      )}
      {sheet === 'balance' && (
        <BalanceDialog
          value={settings.startingBalance}
          currency={settings.currency}
          onClose={() => setSheet(null)}
          onSave={(startingBalance) => {
            void updateSettings({ startingBalance });
            setSheet(null);
          }}
        />
      )}
    </Screen>
  );
}

function BalanceDialog({ value, currency, onClose, onSave }: { value: number; currency: string; onClose: () => void; onSave: (v: number) => void }) {
  const { t } = useI18n();
  const [text, setText] = useState(amountToInput(Math.abs(value)));
  const [negative, setNegative] = useState(value < 0);
  const parsed = text === '' ? 0 : parseAmountInput(text);
  return (
    <div className="overlay overlay--center" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={t('startingBalance')} data-testid="balance-dialog">
        <h2 className="dialog__title">{t('startingBalance')}</h2>
        <p className="dialog__text">{t('startingBalanceHint')}</p>
        <AmountDisplay text={text} currency={currency} active onClick={() => {}} negative={negative} />
        <div className="chips" style={{ justifyContent: 'center' }}>
          <Chip selected={negative} onClick={() => setNegative((n) => !n)} icon="remove">
            {t('negative')}
          </Chip>
        </div>
        <Keypad open onKey={(k) => setText((v) => applyKeypadKey(v, k))} />
        <div className="dialog__actions dialog__actions--row">
          <button type="button" className="btn btn--tonal" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className="btn btn--primary" disabled={parsed === null} onClick={() => parsed !== null && onSave(negative ? -parsed : parsed)} data-testid="balance-save">
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
