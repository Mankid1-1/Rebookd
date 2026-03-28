// Lightweight i18n utility — no heavy library needed for now
export type Locale = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'nl' | 'ja' | 'ko' | 'zh';

export const SUPPORTED_LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
];

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'MXN', symbol: 'MX$', label: 'Mexican Peso' },
] as const;

export type Currency = typeof SUPPORTED_CURRENCIES[number]['code'];

const LOCALE_KEY = 'rebooked_locale';
const CURRENCY_KEY = 'rebooked_currency';

export function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored && SUPPORTED_LOCALES.some(l => l.code === stored)) return stored as Locale;
  } catch {}
  // Auto-detect from browser
  const browserLang = navigator.language?.split('-')[0] as Locale;
  if (SUPPORTED_LOCALES.some(l => l.code === browserLang)) return browserLang;
  return 'en';
}

export function setStoredLocale(locale: Locale) {
  localStorage.setItem(LOCALE_KEY, locale);
}

export function getStoredCurrency(): Currency {
  try {
    const stored = localStorage.getItem(CURRENCY_KEY);
    if (stored && SUPPORTED_CURRENCIES.some(c => c.code === stored)) return stored as Currency;
  } catch {}
  return 'USD';
}

export function setStoredCurrency(currency: Currency) {
  localStorage.setItem(CURRENCY_KEY, currency);
}

export function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  const locale = getStoredLocale();
  const localeMap: Record<Locale, string> = {
    en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE',
    pt: 'pt-BR', it: 'it-IT', nl: 'nl-NL', ja: 'ja-JP',
    ko: 'ko-KR', zh: 'zh-CN',
  };
  return new Intl.NumberFormat(localeMap[locale] || 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── First-visit prompt tracking ────────────────────────────────────────────

const PROMPT_KEY = 'rebooked_locale_prompt_seen';

export function hasSeenLocalePrompt(): boolean {
  try {
    return localStorage.getItem(PROMPT_KEY) === '1';
  } catch {
    return false;
  }
}

export function markLocalePromptSeen() {
  try {
    localStorage.setItem(PROMPT_KEY, '1');
  } catch {}
}
