import { navigate, type Route } from '../../app/router';
import { useI18n } from '../../i18n';
import { Icon } from './Icon';

export function TabBar({ active }: { active: Route['name'] }) {
  const { t } = useI18n();
  const tabs: Array<{ name: 'home' | 'stats' | 'transactions'; icon: string; label: string; route: Route }> = [
    { name: 'home', icon: 'home', label: t('navHome'), route: { name: 'home' } },
    { name: 'stats', icon: 'insights', label: t('navStats'), route: { name: 'stats' } },
    { name: 'transactions', icon: 'receipt_long', label: t('navTransactions'), route: { name: 'transactions', query: {} } },
  ];
  return (
    <nav className="tabbar" aria-label="Navigation">
      {tabs.slice(0, 2).map((tab) => (
        <TabItem key={tab.name} tab={tab} active={active === tab.name} />
      ))}
      <button type="button" className="fab" aria-label={t('addTransaction')} onClick={() => navigate({ name: 'add' })} data-testid="fab-add">
        <Icon name="add" />
      </button>
      {tabs.slice(2).map((tab) => (
        <TabItem key={tab.name} tab={tab} active={active === tab.name} />
      ))}
    </nav>
  );
}

function TabItem({ tab, active }: { tab: { name: string; icon: string; label: string; route: Route }; active: boolean }) {
  return (
    <button type="button" className="tabbar__item" aria-current={active ? 'page' : undefined} onClick={() => navigate(tab.route, { replace: true })} data-testid={`tab-${tab.name}`}>
      <Icon name={tab.icon} />
      <span>{tab.label}</span>
    </button>
  );
}
