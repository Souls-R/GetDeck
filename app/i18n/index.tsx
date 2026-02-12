'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import zh, { type Translations } from './zh';
import ja from './ja';
import en from './en';

export type Locale = 'zh' | 'ja' | 'en';

const translations: Record<Locale, Translations> = { zh, ja, en };

const localeToLang: Record<Locale, string> = { zh: 'zh-CN', ja: 'ja', en: 'en' };

const STORAGE_KEY = 'getdeck-locale';

function getNestedValue(obj: unknown, path: string): string | undefined {
  let current = obj;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectLocale(): Locale {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('en')) return 'en';
  return 'zh';
}

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'zh';
  const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (saved && translations[saved]) return saved;
  const detected = detectLocale();
  localStorage.setItem(STORAGE_KEY, detected);
  return detected;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  useEffect(() => {
    document.documentElement.lang = localeToLang[locale];
    document.title = translations[locale].layout.title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', translations[locale].layout.description);
    if (document.body.dataset.i18nHide) {
      delete document.body.dataset.i18nHide;
      document.body.style.opacity = '';
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    const val = getNestedValue(translations[locale], key);
    if (val === undefined) {
      // Fallback to zh
      const fallback = getNestedValue(translations.zh, key);
      return fallback ? interpolate(fallback, vars) : key;
    }
    return interpolate(val, vars);
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
