'use client';

import { create } from 'zustand';
import en from './i18n/en';
import mn from './i18n/mn';

export type Language = 'en' | 'mn';

export const dict: Record<Language, Record<string, string>> = {
  en,
  mn,
};

type I18nState = {
  lang: Language;
  setLang: (lang: Language) => void;
};

export const useI18n = create<I18nState>((set) => ({
  lang: (typeof window !== 'undefined' && (localStorage.getItem('lang') as Language)) || 'en',
  setLang: (lang: Language) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lang', lang);
      try { document.documentElement.lang = lang; } catch {}
    }
    set({ lang });
  },
}));

export function t(key: string, lang?: Language): string {
  const active = lang ?? useI18n.getState().lang;
  return dict[active][key] ?? dict.en[key] ?? key;
}

export function useT() {
  const lang = useI18n((s) => s.lang);
  return (key: string) => t(key, lang);
}
