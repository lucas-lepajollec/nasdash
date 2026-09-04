'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { BCP47, interpolate, messages, type UiLanguage } from './messages';

const STORAGE_KEY = 'nasdash.ui_language';
const languageListeners = new Set<() => void>();

function isUiLanguage(value: string | null | undefined): value is UiLanguage {
  return value === 'en' || value === 'fr' || value === 'es' || value === 'de';
}

export function readRequestedLanguage() {
  if (typeof window === 'undefined') return null;
  const requested = new URLSearchParams(window.location.search).get('lang');
  return isUiLanguage(requested) ? requested : null;
}

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isUiLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

function readClientLanguage(): UiLanguage {
  return readRequestedLanguage() ?? readStoredLanguage() ?? 'en';
}

function subscribeToLanguage(listener: () => void) {
  languageListeners.add(listener);
  window.addEventListener('storage', listener);
  window.addEventListener('popstate', listener);
  return () => {
    languageListeners.delete(listener);
    window.removeEventListener('storage', listener);
    window.removeEventListener('popstate', listener);
  };
}

function readServerLanguage(): UiLanguage {
  return 'en';
}

type Translate = (key: string, variables?: Record<string, string | number>) => string;

interface I18nContextValue {
  language: UiLanguage;
  locale: string;
  setLanguage: (language: UiLanguage) => void;
  t: Translate;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribeToLanguage, readClientLanguage, readServerLanguage);

  const setLanguage = useCallback((nextLanguage: UiLanguage) => {
    try {
      localStorage.setItem(STORAGE_KEY, nextLanguage);
      const url = new URL(window.location.href);
      if (url.searchParams.has('lang')) {
        url.searchParams.set('lang', nextLanguage);
        window.history.replaceState(window.history.state, '', url);
      }
    } catch {}
    languageListeners.forEach((listener) => listener());
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = messages[language]['meta.title'];
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute('content', messages[language]['meta.description']);
  }, [language]);

  const t = useCallback<Translate>((key, variables) => {
    const template = messages[language][key] ?? messages.en[key] ?? key;
    return interpolate(template, variables);
  }, [language]);

  const value = useMemo<I18nContextValue>(() => ({
    language,
    locale: BCP47[language],
    setLanguage,
    t,
  }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
}
