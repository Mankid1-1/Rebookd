/**
 * UTM Attribution Capture
 *
 * Captures UTM parameters, ad click IDs, and referral codes from the URL
 * on page load. Stores first-touch (localStorage) and last-touch (sessionStorage)
 * so attribution survives navigation and can be sent at signup.
 */

const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const AD_PARAMS = ["gclid", "fbclid", "msclkid"] as const;
const FIRST_TOUCH_KEY = "rb_attribution_first";
const LAST_TOUCH_KEY = "rb_attribution_last";

export interface AttributionData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  ref?: string;
  landingPage: string;
  referrer: string;
  timestamp: string;
}

function extractParams(): AttributionData | null {
  const url = new URL(window.location.href);
  const data: Partial<AttributionData> = {};
  let hasAny = false;

  for (const key of UTM_PARAMS) {
    const val = url.searchParams.get(key);
    if (val) {
      data[key] = val;
      hasAny = true;
    }
  }

  for (const key of AD_PARAMS) {
    const val = url.searchParams.get(key);
    if (val) {
      data[key] = val;
      hasAny = true;
    }
  }

  const ref = url.searchParams.get("ref");
  if (ref) {
    data.ref = ref;
    hasAny = true;
  }

  // Even if no UTM params, capture organic referrer if present
  if (!hasAny && !document.referrer) return null;

  return {
    ...data,
    landingPage: window.location.pathname + window.location.search,
    referrer: document.referrer || "(direct)",
    timestamp: new Date().toISOString(),
  } as AttributionData;
}

/**
 * Call once on app mount. Captures attribution from URL params and stores
 * first-touch (written once) and last-touch (written every visit with params).
 */
export function captureAttribution(): void {
  try {
    const data = extractParams();
    if (!data) return;

    // Last-touch: always overwrite
    sessionStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(data));

    // First-touch: write only if not already set
    if (!localStorage.getItem(FIRST_TOUCH_KEY)) {
      localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(data));
    }
  } catch {
    // Storage blocked (incognito, quota) — silently ignore
  }
}

/**
 * Returns first-touch and last-touch attribution for sending at signup.
 */
export function getAttribution(): {
  firstTouch: AttributionData | null;
  lastTouch: AttributionData | null;
} {
  try {
    const first = localStorage.getItem(FIRST_TOUCH_KEY);
    const last = sessionStorage.getItem(LAST_TOUCH_KEY);
    return {
      firstTouch: first ? JSON.parse(first) : null,
      lastTouch: last ? JSON.parse(last) : null,
    };
  } catch {
    return { firstTouch: null, lastTouch: null };
  }
}

/**
 * Returns the referral code from attribution if present.
 */
export function getReferralCode(): string | null {
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (ref) return ref;

    const last = sessionStorage.getItem(LAST_TOUCH_KEY);
    if (last) {
      const data = JSON.parse(last);
      return data.ref || null;
    }
    const first = localStorage.getItem(FIRST_TOUCH_KEY);
    if (first) {
      const data = JSON.parse(first);
      return data.ref || null;
    }
  } catch {
    // ignore
  }
  return null;
}
