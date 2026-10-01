import type { ReactNode } from 'react';
import { goBack } from '../../app/router';
import { useI18n } from '../../i18n';
import { Icon } from './Icon';

interface ScreenProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** show a back button; the function is called instead of history back when given */
  back?: boolean | (() => void);
  actions?: ReactNode;
  large?: boolean;
  tab?: boolean;
  children: ReactNode;
  bodyClassName?: string;
  footer?: ReactNode;
  testId?: string;
}

export function Screen({ title, subtitle, back, actions, large = false, tab = false, children, bodyClassName, footer, testId }: ScreenProps) {
  const { t } = useI18n();
  return (
    <section className={`screen${tab ? ' screen--tab' : ''}`} data-testid={testId}>
      <header className={`screen__header${large ? ' screen__header--large' : ''}`}>
        {back && (
          <button type="button" className="btn btn--icon" aria-label={t('back')} onClick={() => (typeof back === 'function' ? back() : goBack())} style={{ marginLeft: '-0.5rem' }} data-testid="back-button">
            <Icon name="arrow_back" />
          </button>
        )}
        <div className="grow">
          <h1 className={`screen__title${large ? '' : ' screen__title--center'}`} style={back && !large ? { paddingRight: actions ? 0 : '2.75rem' } : undefined}>
            {title}
          </h1>
          {subtitle && <div className="screen__subtitle">{subtitle}</div>}
        </div>
        {actions}
      </header>
      <div className={`screen__body${tab ? ' screen__body--tab' : ''}${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>
      {footer}
    </section>
  );
}
