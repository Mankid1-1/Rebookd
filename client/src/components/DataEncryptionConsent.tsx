import { useState, useEffect } from "react";
import { Lock, X, Shield, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "rebooked_data_encryption_consent";
const CONSENT_VERSION = "1";
const COOKIE_KEY = "rebooked_cookie_consent";

function hasAcceptedCookies(): boolean {
  try {
    const stored = localStorage.getItem(COOKIE_KEY);
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    return parsed.version != null;
  } catch {
    return false;
  }
}

function hasAcceptedDataConsent(): boolean {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    return parsed.version === CONSENT_VERSION;
  } catch {
    return false;
  }
}

function saveDataConsent() {
  localStorage.setItem(
    CONSENT_KEY,
    JSON.stringify({
      version: CONSENT_VERSION,
      accepted: true,
      timestamp: new Date().toISOString(),
    })
  );
}

export function DataEncryptionConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show after cookie consent has been accepted and this consent hasn't been given yet
    const check = () => {
      if (hasAcceptedCookies() && !hasAcceptedDataConsent()) {
        // Small delay after cookie consent so both don't appear at once
        setTimeout(() => setVisible(true), 800);
      }
    };

    // Check on mount
    check();

    // Also listen for when cookie consent is accepted
    const handler = () => setTimeout(check, 1200);
    window.addEventListener("cookie-consent-updated", handler);
    return () => window.removeEventListener("cookie-consent-updated", handler);
  }, []);

  if (!visible) return null;

  const accept = () => {
    saveDataConsent();
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[99] p-4 md:p-6 animate-in slide-in-from-bottom-5 duration-500">
      <div className="max-w-3xl mx-auto bg-card border border-success/20 rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
        <div className="p-5 md:p-6">
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-4.5 h-4.5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="font-semibold text-sm text-foreground">
                  Data Encryption &amp; Privacy Notice
                </h3>
                <button
                  onClick={accept}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                All data we receive or access via your connected accounts (Google Calendar, Outlook,
                Calendly, etc.) is <strong className="text-foreground">tokenized and encrypted using AES-256-GCM
                </strong> before storage. This includes client names, phone numbers, email addresses, and
                appointment details. Sensitive data like credit card numbers is automatically detected and
                redacted — we never store payment information directly.
              </p>

              <div className="flex flex-wrap gap-3 mb-3">
                <div className="flex items-center gap-1.5 text-[10px] text-success bg-success/10 rounded-full px-2.5 py-1 font-medium">
                  <Shield className="h-3 w-3" /> AES-256-GCM Encryption
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-success bg-success/10 rounded-full px-2.5 py-1 font-medium">
                  <Lock className="h-3 w-3" /> Data Tokenization
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-success bg-success/10 rounded-full px-2.5 py-1 font-medium">
                  <Shield className="h-3 w-3" /> PCI Compliant via Stripe
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-success bg-success/10 rounded-full px-2.5 py-1 font-medium">
                  <Lock className="h-3 w-3" /> TLS In-Transit
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={accept} className="h-8 px-4 text-xs font-medium">
                  I Understand
                </Button>
                <a
                  href="/privacy"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  Privacy Policy <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
