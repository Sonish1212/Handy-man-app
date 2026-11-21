import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { proStrings } from '../data/proStrings';
import { storage } from './storage';
import { isProApp } from './variant';

const STORAGE_KEY = 'language';
const LANGUAGES = ['ne', 'en'];

const LanguageContext = createContext(null);

function readSavedLanguage() {
  try {
    const saved = storage?.getItem(STORAGE_KEY);
    return LANGUAGES.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

// The language of the professional app, remembered on the phone. It starts
// in Nepali there; the customer app shows both languages side by side and
// does not use this yet.
export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => readSavedLanguage() ?? (isProApp ? 'ne' : 'en'));

  const setLang = useCallback((next) => {
    setLangState(next);
    try {
      storage?.setItem(STORAGE_KEY, next);
    } catch {
      // Not saved; the choice still applies until the app closes.
    }
  }, []);

  // t('work.price', { amount: 'Rs 480' }): the line in the chosen language,
  // falling back to English, then to the key itself.
  const t = useCallback(
    (key, values) => {
      const line = proStrings[lang]?.[key] ?? proStrings.en[key] ?? key;
      if (!values) return line;
      return line.replace(/\{(\w+)\}/g, (_, name) => {
        const value = values[name];
        // Counts like "step 2 of 7" read in Nepali digits (२ / ७). Text such
        // as names, phone numbers and amounts is passed as a string and kept.
        if (typeof value === 'number' && lang === 'ne') return toNepaliDigits(value);
        return value ?? '';
      });
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useT() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useT must be used inside LanguageProvider');
  return context;
}

const NEPALI_DIGITS = '०१२३४५६७८९';
export const toNepaliDigits = (number) => String(number).replace(/[0-9]/g, (digit) => NEPALI_DIGITS[digit]);
