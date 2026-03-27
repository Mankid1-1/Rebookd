import { useState, useEffect } from "react";
import { Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const COOKIE_KEY = "rebooked_cookie_consent";
const COOKIE_VERSION = "1"; // bump to re-show after policy changes

type ConsentLevel = "all" | "essential" | null;

function getConsent(): ConsentLevel {
  try {
    const stored = localStorage.getItem(COOKIE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed.version !== COOKIE_VERSION) return null;
    return parsed.level as ConsentLevel;
  } catch {
    return null;
  }
}

function setConsent(level: "all" | "essential") {
  localStorage.setItem(
    COOKIE_KEY,
    JSON.stringify({ level, version: COOKIE_VERSION, timestamp: Date.now() })
  );
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Small delay so it doesn't flash on page load
    const timer = setTimeout(() => {
      if (!getConsent()) setVisible(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const accept = (level: "all" | "essential") => {
    setConsent(level);
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
                <h3 className="font-semibold text-sm text-foreground">Cookie & Privacy Notice</h3>
                <button
                  onClick={() => accept("essential")}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                We use essential cookies for authentication and session management.
                We do not use advertising or third-party tracking cookies.
                Analytics are collected in aggregate without personally identifiable information.
                By continuing to use Rebooked, you agree to our{" "}
                <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>{" "}
                and{" "}
                <a href="/terms" className="text-primary hover:underline">Terms of Service</a>.
              </p>

              {/* Expandable details */}
              {showDetails && (
                <div className="mb-4 space-y-3 text-xs text-muted-foreground border-t border-border/50 pt-3">
                  <div>
                    <p className="font-medium text-foreground mb-1">Essential Cookies (Always Active)</p>
                    <p>Required for login, session management, and security. Cannot be disabled.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Analytics</p>
                    <p>Aggregated usage data to improve our platform. No personal data is collected or shared with third parties.</p>
                  </div>
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
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={() => accept("all")} className="h-8 px-4 text-xs font-medium">
                  Accept All
                </Button>
                <Button size="sm" variant="outline" onClick={() => accept("essential")} className="h-8 px-4 text-xs font-medium">
                  Essential Only
                </Button>
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
