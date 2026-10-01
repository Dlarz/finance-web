import { useRef, useState } from 'react';
import { useApp } from '../../app/AppState';
import { clock, db } from '../../app/container';
import { useDialogs } from '../../app/dialogs';
import { useToast } from '../../app/toast';
import { completeOnboarding } from '../../data/maintenance';
import { CURRENCIES } from '../../data/types';
import { applyKeypadKey, parseAmountInput } from '../../domain/money';
import { useI18n } from '../../i18n';
import { AmountDisplay, Keypad } from '../components/Keypad';
import { Chip } from '../components/Chip';
import { useRestoreFlow } from './restoreFlow';

export function OnboardingScreen() {
  const { t } = useI18n();
  const { lang } = useApp();
  const toast = useToast();
  const dialogs = useDialogs();
  const [text, setText] = useState('');
  const [negative, setNegative] = useState(false);
  const [currency, setCurrency] = useState<string>('CHF');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const restore = useRestoreFlow({ db, clock, dialogs, toast, t });

  const start = async () => {
    setBusy(true);
    try {
      const parsed = text === '' ? 0 : parseAmountInput(text) ?? 0;
      await completeOnboarding(db, lang, { startingBalance: negative ? -parsed : parsed, currency });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="screen" data-testid="onboarding">
      <div className="onboarding" style={{ overflowY: 'auto' }}>
        <img className="onboarding__logo" src="./icons/icon-192.png" alt="" width={72} height={72} />
        <div>
          <h1 className="onboarding__title">{t('welcomeTitle')}</h1>
          <p className="muted" style={{ marginTop: '0.375rem', fontSize: '1.0625rem' }}>
            {t('welcomeText')}
          </p>
        </div>
        <div className="card" style={{ marginTop: '0.5rem' }}>
          <div className="card__label" style={{ color: 'var(--text-2)' }}>
            {t('startingBalanceQuestion')}
          </div>
          <AmountDisplay text={text} currency={currency} active onClick={() => {}} negative={negative} />
          <p className="hint text-center">{t('startingBalanceHint')}</p>
          <div className="chips" style={{ justifyContent: 'center', marginTop: '0.75rem' }} role="radiogroup" aria-label={t('currency')}>
            {CURRENCIES.map((c) => (
              <Chip key={c} selected={c === currency} onClick={() => setCurrency(c)}>
                {c}
              </Chip>
            ))}
            <Chip selected={negative} onClick={() => setNegative((v) => !v)} icon="remove" testId="toggle-negative">
              {t('negative')}
            </Chip>
          </div>
          <Keypad open onKey={(k) => setText((v) => applyKeypadKey(v, k))} />
        </div>
        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={start} disabled={busy} data-testid="onboarding-start">
          {t('start')}
        </button>
        <button type="button" className="link" style={{ alignSelf: 'center' }} onClick={() => fileRef.current?.click()} data-testid="onboarding-restore">
          {t('restoreFromBackup')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="visually-hidden"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void restore(file);
          }}
        />
      </div>
    </section>
  );
}
