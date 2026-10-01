import { useEffect, useState } from 'react';
import { AppProvider, isStandalone, useApp } from './app/AppState';
import { DialogProvider } from './app/dialogs';
import { applyUpdate, usePwaState } from './app/pwa';
import { TAB_ROUTES, useRoute, type Route } from './app/router';
import { ToastProvider } from './app/toast';
import { useRecurringRunner } from './app/useRecurringRunner';
import { useI18n } from './i18n';
import { Icon } from './ui/components/Icon';
import { TabBar } from './ui/components/TabBar';
import { AddEditScreen } from './ui/screens/AddEditScreen';
import { CategoriesScreen } from './ui/screens/CategoriesScreen';
import { HomeScreen } from './ui/screens/HomeScreen';
import { InstallScreen, shouldShowInstallHint } from './ui/screens/InstallScreen';
import { OnboardingScreen } from './ui/screens/OnboardingScreen';
import { RecurringScreen } from './ui/screens/RecurringScreen';
import { RuleEditScreen } from './ui/screens/RuleEditScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { StatsScreen } from './ui/screens/StatsScreen';
import { TagsScreen } from './ui/screens/TagsScreen';
import { TransactionDetailsScreen } from './ui/screens/TransactionDetailsScreen';
import { TransactionsScreen } from './ui/screens/TransactionsScreen';

function Splash() {
  return <div className="app" aria-busy="true" />;
}

function renderRoute(route: Route) {
  switch (route.name) {
    case 'home':
      return <HomeScreen key="home" />;
    case 'stats':
      return <StatsScreen key="stats" />;
    case 'transactions':
      return <TransactionsScreen key="transactions" query={route.query} />;
    case 'add':
      return <AddEditScreen key="add" />;
    case 'edit':
      return <AddEditScreen key={`edit-${route.id}`} editId={route.id} />;
    case 'transaction':
      return <TransactionDetailsScreen key={`tx-${route.id}`} id={route.id} />;
    case 'settings':
      return <SettingsScreen key="settings" />;
    case 'categories':
      return <CategoriesScreen key="categories" />;
    case 'tags':
      return <TagsScreen key="tags" />;
    case 'recurring':
      return <RecurringScreen key="recurring" />;
    case 'rule':
      return <RuleEditScreen key={`rule-${route.id ?? 'new'}`} id={route.id} />;
    case 'install':
      return <InstallScreen key="install" forced />;
  }
}

function UpdateBanner() {
  const { needRefresh } = usePwaState();
  const { t } = useI18n();
  if (!needRefresh) return null;
  return (
    <div className="update-banner" role="status" data-testid="update-banner">
      <Icon name="system_update" style={{ color: 'var(--accent)' }} />
      <span>{t('updateAvailable')}</span>
      <button type="button" className="btn btn--sm btn--primary" onClick={applyUpdate}>
        {t('reload')}
      </button>
    </div>
  );
}

function Shell() {
  const { settings } = useApp();
  const route = useRoute();
  const [installHint, setInstallHint] = useState(() => shouldShowInstallHint());
  useRecurringRunner(settings.onboarded);

  useEffect(() => {
    // When the app is installed later and opened from the Home Screen, never show the hint again.
    if (isStandalone()) setInstallHint(false);
  }, []);

  if (installHint && route.name !== 'install') {
    return (
      <ToastProvider hasTabs={false}>
        <div className="app">
          <InstallScreen onContinue={() => setInstallHint(false)} />
        </div>
      </ToastProvider>
    );
  }

  if (!settings.onboarded) {
    return (
      <ToastProvider hasTabs={false}>
        <div className="app">
          <OnboardingScreen />
        </div>
      </ToastProvider>
    );
  }

  const isTab = TAB_ROUTES.has(route.name);
  return (
    <ToastProvider hasTabs={isTab}>
      <div className="app">
        {renderRoute(route)}
        {isTab && <TabBar active={route.name} />}
        <UpdateBanner />
      </div>
    </ToastProvider>
  );
}

export function App() {
  return (
    <AppProvider fallback={<Splash />}>
      <DialogProvider>
        <Shell />
      </DialogProvider>
    </AppProvider>
  );
}
