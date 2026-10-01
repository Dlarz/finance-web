import { isStandalone } from '../../app/AppState';
import { goBack } from '../../app/router';
import { useI18n } from '../../i18n';
import { Icon } from '../components/Icon';

const DISMISS_KEY = 'fa:install-dismissed';

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iDevice = /iPhone|iPad|iPod/.test(ua);
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iDevice || iPadOS;
}

/** Show the install guide when opened in Safari on an iPhone instead of from the Home Screen. */
export function shouldShowInstallHint(): boolean {
  if (typeof window === 'undefined') return false;
  if (isStandalone()) return false;
  if (!isIOS()) return false;
  try {
    if (localStorage.getItem(DISMISS_KEY) === '1') return false;
  } catch {
    /* ignore */
  }
  return true;
}

export function InstallScreen({ onContinue, forced = false }: { onContinue?: () => void; forced?: boolean }) {
  const { t } = useI18n();
  const ios = isIOS();
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    if (onContinue) onContinue();
    else goBack({ name: 'settings' });
  };
  return (
    <section className="screen" data-testid="install-screen">
      <div className="onboarding" style={{ justifyContent: 'center' }}>
        <img className="onboarding__logo" src="./icons/icon-192.png" alt="" width={72} height={72} />
        <h1 className="onboarding__title">{t('installTitle')}</h1>
        <p className="muted" style={{ fontSize: '1.0625rem' }}>
          {t('installIntro')}
        </p>
        {ios || forced ? (
          <div className="card stack" style={{ marginTop: '0.5rem' }}>
            <div className="step">
              <span className="step__num">1</span>
              <span className="row-flex" style={{ gap: '0.375rem' }}>
                {t('installStep1')} <Icon name="ios_share" style={{ color: 'var(--accent)' }} />
              </span>
            </div>
            <div className="step">
              <span className="step__num">2</span>
              <span className="row-flex" style={{ gap: '0.375rem' }}>
                {t('installStep2')} <Icon name="add_to_home_screen" style={{ color: 'var(--accent)' }} />
              </span>
            </div>
            <div className="step">
              <span className="step__num">3</span>
              <span>{t('installStep3')}</span>
            </div>
          </div>
        ) : (
          <div className="notice">
            <Icon name="info" />
            <span>{t('installNotSafari')}</span>
          </div>
        )}
        <div className="notice notice--warning">
          <Icon name="warning" />
          <span>{t('installReason')}</span>
        </div>
        <div style={{ flex: '1 1 auto' }} />
        <button type="button" className="link link--small" style={{ alignSelf: 'center' }} onClick={dismiss} data-testid="install-continue">
          {forced ? t('back') : t('installContinue')}
        </button>
      </div>
    </section>
  );
}
