import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { translations, type TranslationKey } from '@/utils/translations';
import {
  getStoredLocale, setStoredLocale,
  getStoredCurrency, setStoredCurrency,
  formatCurrency as formatCurrencyRaw,
  type Locale, type Currency,
} from '@/utils/i18n';

interface LocaleContextType {
  locale: Locale;
  currency: Currency;
  setLocale: (locale: Locale) => void;
  setCurrency: (currency: Currency) => void;
  t: (key: TranslationKey) => string;
  formatCurrency: (amount: number) => string;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);
  const [currency, setCurrencyState] = useState<Currency>(getStoredCurrency);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setStoredLocale(newLocale);
  }, []);

  const setCurrency = useCallback((newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    setStoredCurrency(newCurrency);
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    const dict = translations[locale] || translations.en;
    const fallback = translations.en;
    return dict[key] || fallback[key] || key;
  }, [locale]);

  const formatCurrency = useCallback((amount: number): string => {
    return formatCurrencyRaw(amount, currency);
  }, [currency]);

  return (
    <LocaleContext.Provider value={{ locale, currency, setLocale, setCurrency, t, formatCurrency }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
