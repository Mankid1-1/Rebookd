import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SUPPORTED_LOCALES,
  SUPPORTED_CURRENCIES,
  getStoredLocale,
  setStoredLocale,
  getStoredCurrency,
  setStoredCurrency,
  hasSeenLocalePrompt,
  markLocalePromptSeen,
  type Locale,
  type Currency,
} from "@/utils/i18n";
import { useLocale } from "@/contexts/LocaleContext";

// ─── Footer Language/Currency Toggle ────────────────────────────────────────

export function LanguageSelector() {
  const [open, setOpen] = useState(false);
  const { locale, currency, setLocale, setCurrency } = useLocale();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const currentLocale = SUPPORTED_LOCALES.find(l => l.code === locale);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
        aria-label="Language and currency settings"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{currentLocale?.flag} {currentLocale?.code.toUpperCase()}</span>
        <span className="text-border">|</span>
        <span>{currency}</span>
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-64 bg-card border border-border rounded-xl shadow-xl shadow-black/20 overflow-hidden z-[60] animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="p-3 border-b border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Language</p>
            <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
              {SUPPORTED_LOCALES.map(l => (
                <button
                  key={l.code}
                  onClick={() => setLocale(l.code)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                    locale === l.code
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <span>{l.flag}</span>
                  <span className="truncate">{l.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Currency</p>
            <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
              {SUPPORTED_CURRENCIES.map(c => (
                <button
                  key={c.code}
                  onClick={() => setCurrency(c.code)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                    currency === c.code
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <span className="font-mono">{c.symbol}</span>
                  <span className="truncate">{c.code}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── First-Visit Welcome Modal ──────────────────────────────────────────────

export function LocaleOnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState<Locale>(getStoredLocale);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(getStoredCurrency);
  const { setLocale, setCurrency } = useLocale();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasSeenLocalePrompt()) {
        setVisible(true);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const handleConfirm = () => {
    setLocale(selectedLocale);
    setCurrency(selectedCurrency);
    markLocalePromptSeen();
    setVisible(false);
  };

  const handleSkip = () => {
    markLocalePromptSeen();
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl shadow-black/30 overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-6 pb-4 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Globe className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Welcome to Rebooked
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose your language and currency preference
          </p>
        </div>

        {/* Language Grid */}
        <div className="px-6 pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Language</p>
          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
            {SUPPORTED_LOCALES.map(l => (
              <button
                key={l.code}
                onClick={() => setSelectedLocale(l.code)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  selectedLocale === l.code
                    ? "bg-primary/15 text-primary font-medium border border-primary/30 ring-1 ring-primary/20"
                    : "hover:bg-muted/50 text-muted-foreground border border-transparent"
                }`}
              >
                <span className="text-base">{l.flag}</span>
                <span className="truncate flex-1 text-left">{l.label}</span>
                {selectedLocale === l.code && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Currency Grid */}
        <div className="px-6 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-3">Currency</p>
          <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
            {SUPPORTED_CURRENCIES.map(c => (
              <button
                key={c.code}
                onClick={() => setSelectedCurrency(c.code)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  selectedCurrency === c.code
                    ? "bg-primary/15 text-primary font-medium border border-primary/30 ring-1 ring-primary/20"
                    : "hover:bg-muted/50 text-muted-foreground border border-transparent"
                }`}
              >
                <span className="font-mono text-base w-6 text-center">{c.symbol}</span>
                <span className="truncate flex-1 text-left">{c.label}</span>
                {selectedCurrency === c.code && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-3 border-t border-border/50 flex gap-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleSkip}>
            Skip (English / USD)
          </Button>
          <Button size="sm" className="flex-1" onClick={handleConfirm}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
