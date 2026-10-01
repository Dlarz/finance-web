import { useEffect, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { Icon } from './Icon';

interface SheetProps {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
}

/** A bottom sheet. Closes on scrim tap or Escape. */
export function Sheet({ title, onClose, children, footer, testId }: SheetProps) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" data-testid={testId}>
        <div className="sheet__handle" />
        {title !== undefined && (
          <div className="sheet__header">
            <h2 className="sheet__title">{title}</h2>
            <button type="button" className="btn btn--icon" aria-label={t('close')} onClick={onClose} style={{ marginRight: '-0.5rem' }}>
              <Icon name="close" />
            </button>
          </div>
        )}
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__footer">{footer}</div>}
      </div>
    </div>
  );
}
