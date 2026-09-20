import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  LanguageProfile,
  NER_STATES_LANGUAGES,
  getLanguageProfileByCode,
  getLanguageProfileByState,
} from './languages';

import { en, TranslationKey } from './translations/en';
import { as } from './translations/as';
import { bn } from './translations/bn';
import { ne } from './translations/ne';
import { mni } from './translations/mni';
import { kha } from './translations/kha';
import { lus } from './translations/lus';
import { nag } from './translations/nag';
import { ny } from './translations/ny';

const TRANSLATIONS: Record<string, Record<TranslationKey, string>> = {
  en,
  as,
  bn,
  ne,
  mni,
  kha,
  lus,
  nag,
  ny,
};

interface I18nContextType {
  language: string;
  state: string;
  languageProfile: LanguageProfile;
  bilingualMode: boolean;
  setLanguage: (code: string) => void;
  setStateAndSuggestLanguage: (stateName: string) => void;
  toggleBilingualMode: () => void;
  t: (key: TranslationKey, fallback?: string) => string;
  tBilingual: (key: TranslationKey, fallback?: string) => { primary: string; secondary?: string };
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<string>(() => {
    return localStorage.getItem('mindcare_language') || 'as'; // Default to Assamese for NER prototype
  });

  const [state, setStateName] = useState<string>(() => {
    return localStorage.getItem('mindcare_state') || 'Assam';
  });

  const [bilingualMode, setBilingualMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('mindcare_bilingual_mode');
    return saved ? JSON.parse(saved) : true; // Default Bilingual on for demo clarity
  });

  const [languageProfile, setLanguageProfile] = useState<LanguageProfile>(() => {
    return getLanguageProfileByCode(language);
  });

  useEffect(() => {
    localStorage.setItem('mindcare_language', language);
    localStorage.setItem('mindcare_state', state);
    localStorage.setItem('mindcare_bilingual_mode', JSON.stringify(bilingualMode));
    setLanguageProfile(getLanguageProfileByCode(language));
  }, [language, state, bilingualMode]);

  const setLanguage = (code: string) => {
    setLanguageState(code);
  };

  const setStateAndSuggestLanguage = (stateName: string) => {
    setStateName(stateName);
    const suggested = getLanguageProfileByState(stateName);
    setLanguageState(suggested.languageCode);
  };

  const toggleBilingualMode = () => {
    setBilingualMode(prev => !prev);
  };

  const t = (key: TranslationKey, fallback?: string): string => {
    const catalog = TRANSLATIONS[language] || TRANSLATIONS.en;
    return catalog[key] || TRANSLATIONS.en[key] || fallback || key;
  };

  const tBilingual = (key: TranslationKey, fallback?: string) => {
    const primary = t(key, fallback);
    if (!bilingualMode || language === 'en') {
      return { primary };
    }
    const secondary = TRANSLATIONS.en[key] || fallback;
    return { primary, secondary };
  };

  return (
    <I18nContext.Provider
      value={{
        language,
        state,
        languageProfile,
        bilingualMode,
        setLanguage,
        setStateAndSuggestLanguage,
        toggleBilingualMode,
        t,
        tBilingual,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

export * from './languages';
export type { TranslationKey } from './translations/en';
