import { useState, useEffect, useCallback } from "react";
import { Shield, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

const COOKIE_KEY = "rebooked_cookie_consent";
const COOKIE_VERSION = "3"; // bumped to re-trigger consent for marketing category

export interface CookiePreferences {
  version: string;
  essential: boolean; // always true, cannot be toggled off
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
  timestamp: string;
}

function getConsent(): CookiePreferences | null {
  try {
    const stored = localStorage.getItem(COOKIE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as CookiePreferences;
    if (parsed.version !== COOKIE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setConsent(prefs: Omit<CookiePreferences, "version" | "timestamp" | "essential">) {
  const full: CookiePreferences = {
    version: COOKIE_VERSION,
    essential: true,
    analytics: prefs.analytics,
    functional: prefs.functional,
    marketing: prefs.marketing,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(COOKIE_KEY, JSON.stringify(full));
  return full;
}

/** Hook to read current cookie preferences from anywhere in the app */
export function useCookiePreferences(): CookiePreferences | null {
  const [prefs, setPrefs] = useState<CookiePreferences | null>(() => getConsent());

  useEffect(() => {
    const handler = () => setPrefs(getConsent());
    window.addEventListener("cookie-consent-updated", handler);
    return () => window.removeEventListener("cookie-consent-updated", handler);
  }, []);

  return prefs;
}

/** Small button to re-open cookie preferences. Place in footer or layout. */
export function CookiePreferencesButton() {
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent("cookie-consent-manage"));
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Manage cookie preferences"
    >
      <Settings className="w-3 h-3" />
      Cookie Preferences
    </button>
  );
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showManagePreferences, setShowManagePreferences] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [functionalEnabled, setFunctionalEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(true);

  const openBanner = useCallback(() => {
    // Pre-fill toggles from existing consent if present
    const existing = getConsent();
    if (existing) {
      setAnalyticsEnabled(existing.analytics);
      setFunctionalEnabled(existing.functional);
      setMarketingEnabled(existing.marketing);
      setShowManagePreferences(true);
    } else {
      setShowManagePreferences(false);
    }
    setVisible(true);
  }, []);

  useEffect(() => {
    // Small delay so it doesn't flash on page load
    const timer = setTimeout(() => {
      if (!getConsent()) {
        setVisible(true);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Listen for "manage preferences" events from CookiePreferencesButton
  useEffect(() => {
    const handler = () => openBanner();
    window.addEventListener("cookie-consent-manage", handler);
    return () => window.removeEventListener("cookie-consent-manage", handler);
  }, [openBanner]);

  if (!visible) return null;

  const acceptAll = () => {
    setConsent({ analytics: true, functional: true, marketing: true });
    window.dispatchEvent(new Event("cookie-consent-updated"));
    setVisible(false);
  };

  const acceptEssentialOnly = () => {
    setConsent({ analytics: false, functional: false, marketing: false });
    window.dispatchEvent(new Event("cookie-consent-updated"));
    setVisible(false);
  };

  const savePreferences = () => {
    setConsent({ analytics: analyticsEnabled, functional: functionalEnabled, marketing: marketingEnabled });
    window.dispatchEvent(new Event("cookie-consent-updated"));
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6 animate-in slide-in-from-bottom-5 duration-500">
      <div className="max-w-3xl mx-auto bg-card border border-border rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
        {/* Main banner */}
        <div className="p-5 md:p-6">
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Shield className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="font-semibold text-sm text-foreground">
                  {showManagePreferences ? "Manage Cookie Preferences" : "Cookie & Privacy Notice"}
                </h3>
                <button
                  onClick={() => {
                    if (!getConsent()) acceptEssentialOnly();
                    else setVisible(false);
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                We use essential, analytics, and marketing cookies to run and improve Rebooked.
                Analytics are collected in aggregate without personally identifiable information.
                Marketing cookies enable conversion tracking for our advertising partners.
                By continuing to use Rebooked, you agree to our{" "}
                <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>{" "}
                and{" "}
                <a href="/terms" className="text-primary hover:underline">Terms of Service</a>.
              </p>

              {/* Category toggles */}
              {(showManagePreferences || showDetails) && (
                <div className="mb-4 space-y-3 text-xs text-muted-foreground border-t border-border/50 pt-3">
                  {/* Essential - always on */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-foreground mb-0.5">Essential Cookies</p>
                      <p>Required for login, session management, and security. Cannot be disabled.</p>
                    </div>
                    <div className="ml-4 shrink-0">
                      <div
                        className="w-9 h-5 rounded-full bg-primary flex items-center cursor-not-allowed opacity-70"
                        title="Always active"
                        aria-label="Essential cookies are always active"
                      >
                        <div className="w-4 h-4 rounded-full bg-white shadow-sm ml-auto mr-0.5 transition-all" />
                      </div>
                    </div>
                  </div>

                  {/* Analytics - optional */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-foreground mb-0.5">Analytics</p>
                      <p>Aggregated usage data to improve our platform. No personal data is collected or shared with third parties.</p>
                    </div>
                    <div className="ml-4 shrink-0">
                      <button
                        role="switch"
                        aria-checked={analyticsEnabled}
                        aria-label="Toggle analytics cookies"
                        onClick={() => setAnalyticsEnabled(!analyticsEnabled)}
                        className={`w-9 h-5 rounded-full flex items-center transition-colors ${
                          analyticsEnabled ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                            analyticsEnabled ? "ml-auto mr-0.5" : "ml-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Functional - optional */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-foreground mb-0.5">Functional</p>
                      <p>Remembers your preferences such as language, timezone, and display settings for a personalised experience.</p>
                    </div>
                    <div className="ml-4 shrink-0">
                      <button
                        role="switch"
                        aria-checked={functionalEnabled}
                        aria-label="Toggle functional cookies"
                        onClick={() => setFunctionalEnabled(!functionalEnabled)}
                        className={`w-9 h-5 rounded-full flex items-center transition-colors ${
                          functionalEnabled ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                            functionalEnabled ? "ml-auto mr-0.5" : "ml-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Marketing - optional */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-foreground mb-0.5">Marketing</p>
                      <p>Enables conversion tracking for Meta (Facebook), Google Ads, and Reddit to measure ad performance. No personal data is shared beyond anonymous conversion signals.</p>
                    </div>
                    <div className="ml-4 shrink-0">
                      <button
                        role="switch"
                        aria-checked={marketingEnabled}
                        aria-label="Toggle marketing cookies"
                        onClick={() => setMarketingEnabled(!marketingEnabled)}
                        className={`w-9 h-5 rounded-full flex items-center transition-colors ${
                          marketingEnabled ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                            marketingEnabled ? "ml-auto mr-0.5" : "ml-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Additional info shown in expanded details */}
                  {showDetails && (
                    <>
                      <div>
                        <p className="font-medium text-foreground mb-1">Third-Party Services</p>
                        <p>Stripe (payments), Telnyx (SMS delivery), and Cloudflare (CDN/security) may set their own cookies as described in their respective privacy policies.</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-1">Your Rights (GDPR / CCPA)</p>
                        <p>You may request access, correction, or deletion of your data at any time by contacting{" "}
                          <a href="mailto:rebooked@rebooked.org" className="text-primary hover:underline">rebooked@rebooked.org</a>.
                          See our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a> for full details.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {showManagePreferences ? (
                  <>
                    <Button size="sm" onClick={savePreferences} className="h-8 px-4 text-xs font-medium">
                      Save Preferences
                    </Button>
                    <Button size="sm" variant="outline" onClick={acceptAll} className="h-8 px-4 text-xs font-medium">
                      Accept All
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={acceptAll} className="h-8 px-4 text-xs font-medium">
                      Accept All
                    </Button>
                    <Button size="sm" variant="outline" onClick={acceptEssentialOnly} className="h-8 px-4 text-xs font-medium">
                      Essential Only
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowManagePreferences(true)}
                      className="h-8 px-4 text-xs font-medium"
                    >
                      Manage Preferences
                    </Button>
                  </>
                )}
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  {showDetails ? "Hide details" : "Cookie details"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
