import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { mergeSettings, writeSettings } from '../data/settingsRepo';
import type { Settings } from '../data/types';
import type { ISODate } from '../domain/dates';
import { createI18n, I18nContext, resolveLanguage, type Language } from '../i18n';
import { clock, db } from './container';

interface AppContextValue {
  settings: Settings;
  lang: Language;
  today: ISODate;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  /** true when the app runs from the Home Screen (standalone) */
  standalone: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('AppProvider missing');
  return v;
}

export function useSettings(): Settings {
  return useApp().settings;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

/** Today's date; re-evaluated when the app comes back to the foreground or the day changes. */
export function useToday(): ISODate {
  const [today, setToday] = useState(() => clock.today());
  useEffect(() => {
    const check = () => setToday((prev) => (prev === clock.today() ? prev : clock.today()));
    const interval = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  return today;
}

function applyTheme(theme: Settings['theme']): () => void {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    root.setAttribute('data-theme', resolved);
    const color = resolved === 'dark' ? '#0e1015' : '#f2f3f7';
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) meta.content = color;
  };
  apply();
  try {
    localStorage.setItem('fa:theme', theme);
  } catch {
    /* private mode */
  }
  media.addEventListener('change', apply);
  return () => media.removeEventListener('change', apply);
}

export function AppProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const rows = useLiveQuery(() => db.settings.toArray(), []);
  const settings = useMemo(() => (rows ? mergeSettings(rows) : null), [rows]);
  const today = useToday();
  const [standalone] = useState(isStandalone);

  const lang = useMemo(() => resolveLanguage(settings?.language ?? 'system', navigator.languages ?? [navigator.language]), [settings?.language]);
  const i18n = useMemo(() => createI18n(lang), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('fa:lang', settings?.language === 'system' || !settings ? '' : settings.language);
    } catch {
      /* ignore */
    }
  }, [lang, settings]);

  useEffect(() => (settings ? applyTheme(settings.theme) : undefined), [settings?.theme, settings]);

  const updateSettings = useCallback((patch: Partial<Settings>) => writeSettings(db, patch), []);

  const value = useMemo<AppContextValue | null>(
    () => (settings ? { settings, lang, today, updateSettings, standalone } : null),
    [settings, lang, today, updateSettings, standalone],
  );

  if (!value) return <>{fallback}</>;
  return (
    <AppContext.Provider value={value}>
      <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
    </AppContext.Provider>
  );
}
