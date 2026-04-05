/**
 * Funnel Event Tracking
 *
 * Unified dispatcher that sends conversion events to:
 * 1. Umami (cookie-free analytics — always on)
 * 2. Google Ads / GA4 (if loaded and consent given)
 * 3. Reddit Pixel (if loaded)
 * 4. Internal beacon API (for funnel analytics dashboard)
 */

import { getAttribution } from "./attribution";

// Dedup guard — prevents the same event from firing twice within 1 second
const _lastEvent: { key: string; ts: number } = { key: "", ts: 0 };
function isDuplicate(event: string, provider: string): boolean {
  const key = `${provider}:${event}`;
  const now = Date.now();
  if (key === _lastEvent.key && now - _lastEvent.ts < 1000) return true;
  _lastEvent.key = key;
  _lastEvent.ts = now;
  return false;
}

// Standard funnel events
export type FunnelEvent =
  | "page_view_landing"
  | "page_view_industry"
  | "cta_click_hero"
  | "cta_click_pricing"
  | "cta_click_referral"
  | "roi_calculator_used"
  | "email_capture_shown"
  | "email_capture_submitted"
  | "signup_started"
  | "signup_completed"
  | "onboarding_started"
  | "onboarding_step_completed"
  | "onboarding_completed"
  | "first_automation_enabled"
  | "first_recovery_sent"
  | "referral_prompt_shown"
  | "referral_shared";

interface EventProperties {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Track a funnel event across all configured analytics providers.
 */
export function trackFunnelEvent(event: FunnelEvent, properties?: EventProperties): void {
  const props = { ...properties, url: window.location.pathname };

  // 1. Umami — always available, cookie-free
  try {
    const umami = (window as any).umami;
    if (umami?.track) {
      umami.track(event, props);
    }
  } catch {
    // ignore
  }

  // 2. Google Ads / GA4 — only if loaded
  try {
    const gtag = (window as any).gtag;
    if (typeof gtag === "function") {
      const gtagMap: Partial<Record<FunnelEvent, string>> = {
        signup_completed: "sign_up",
        email_capture_submitted: "generate_lead",
        onboarding_completed: "begin_checkout",
      };
      gtag("event", gtagMap[event] || event, props);
    }
  } catch {
    // ignore
  }

  // 3. Reddit Pixel — only if loaded
  try {
    const rdt = (window as any).rdt;
    if (typeof rdt === "function") {
      const redditMap: Partial<Record<FunnelEvent, [string, string?]>> = {
        // Page views — one PageVisit per navigation
        page_view_landing:          ["PageVisit"],
        page_view_industry:         ["PageVisit"],
        // Interest signals
        roi_calculator_used:        ["ViewContent"],
        email_capture_shown:        ["ViewContent"],
        referral_prompt_shown:      ["ViewContent"],
        // Intent — CTA clicks
        cta_click_pricing:          ["AddToCart"],
        cta_click_hero:             ["AddToCart"],
        cta_click_referral:         ["AddToCart"],
        // Lead capture — actual form submissions only
        email_capture_submitted:    ["Lead"],
        referral_shared:            ["Lead"],
        // Conversion — single SignUp per user (not onboarding steps)
        signup_completed:           ["SignUp"],
        // Revenue — first real recovery
        first_recovery_sent:        ["Purchase"],
      };
      const mapped = redditMap[event];
      if (mapped && !isDuplicate(mapped[0], "rdt")) {
        rdt("track", mapped[0], props);
      }
    }
  } catch {
    // ignore
  }

  // 4. Internal beacon — fire-and-forget to server
  try {
    const attribution = getAttribution();
    const payload = {
      event,
      properties: props,
      sessionId: getSessionId(),
      attribution: attribution.lastTouch,
      pageUrl: window.location.href,
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    navigator.sendBeacon("/api/funnel/track", blob);
  } catch {
    // ignore
  }
}

// Stable session ID for grouping events within a visit
let _sessionId: string | null = null;
function getSessionId(): string {
  if (_sessionId) return _sessionId;
  try {
    const stored = sessionStorage.getItem("rb_session_id");
    if (stored) {
      _sessionId = stored;
      return stored;
    }
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem("rb_session_id", id);
    _sessionId = id;
    return id;
  } catch {
    return `fallback-${Date.now()}`;
  }
}
