import { useI18n } from '../../i18n';
import { Icon } from './Icon';

interface KeypadProps {
  onKey: (key: string) => void;
  open: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function Keypad({ onKey, open }: KeypadProps) {
  const { t } = useI18n();
  return (
    <div className={`keypad-wrap${open ? '' : ' keypad-wrap--collapsed'}`} aria-hidden={!open} data-testid="keypad">
      <div className="keypad" role="group" aria-label={t('amount')}>
        {KEYS.map((k) => (
          <button key={k} type="button" className="keypad__key" onClick={() => onKey(k)} tabIndex={open ? 0 : -1} data-testid={`key-${k}`}>
            {k}
          </button>
        ))}
        <button type="button" className="keypad__key keypad__key--muted" onClick={() => onKey('.')} tabIndex={open ? 0 : -1} data-testid="key-dot">
          .
        </button>
        <button type="button" className="keypad__key" onClick={() => onKey('0')} tabIndex={open ? 0 : -1} data-testid="key-0">
          0
        </button>
        <button type="button" className="keypad__key keypad__key--muted" onClick={() => onKey('backspace')} aria-label="⌫" tabIndex={open ? 0 : -1} data-testid="key-backspace">
          <Icon name="backspace" />
        </button>
      </div>
    </div>
  );
}

interface AmountDisplayProps {
  text: string;
  currency: string;
  active: boolean;
  onClick: () => void;
  type?: 'EXPENSE' | 'INCOME';
  negative?: boolean;
}

/** The big amount above the keypad. Shows the raw keypad text with thousands separators. */
export function AmountDisplay({ text, currency, active, onClick, type, negative }: AmountDisplayProps) {
  const { t } = useI18n();
  const [whole = '', frac] = text.split('.');
  const wholeFmt = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  const shown = text === '' ? '0.00' : `${wholeFmt || '0'}${frac !== undefined ? `.${frac}` : ''}`;
  const cls = `amount-display${type === 'EXPENSE' ? ' amount-display--expense' : type === 'INCOME' ? ' amount-display--income' : ''}`;
  return (
    <button type="button" className={cls} onClick={onClick} aria-label={`${t('amount')}: ${shown} ${currency}`} data-testid="amount-display">
      <span className="amount-display__currency">{currency}</span>
      <span className={`amount-display__value${text === '' ? ' amount-display__value--empty' : ''}`}>
        {negative ? '−' : ''}
        {shown}
      </span>
      {active && <span className="amount-display__caret" aria-hidden="true" />}
    </button>
  );
}
