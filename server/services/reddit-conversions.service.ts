/**
 * REDDIT CONVERSIONS API — Server-side event tracking
 *
 * Sends conversion events to Reddit's Conversions API for server-side attribution.
 * Uses the same conversionId format as the client-side pixel for dedup.
 *
 * Endpoint: POST https://ads-api.reddit.com/api/v2.0/conversions/events/{pixel_id}
 * Auth: Bearer {conversion_access_token}
 * Docs: https://business.reddithelp.com/s/article/send-conversion-events-with-the-API
 */

import crypto from "crypto";
import { logger } from "../_core/logger";

const PIXEL_ID = process.env.REDDIT_PIXEL_ID || "";
const ACCESS_TOKEN = process.env.REDDIT_CONVERSION_TOKEN || "";
const API_URL = `https://ads-api.reddit.com/api/v2.0/conversions/events/${PIXEL_ID}`;

// Standard Reddit event types
type RedditEventType =
  | "PageVisit"
  | "ViewContent"
  | "Search"
  | "AddToCart"
  | "AddToWishlist"
  | "Lead"
  | "SignUp"
  | "Purchase"
  | "Custom";

interface RedditConversionEvent {
  event_at: string; // ISO 8601
  event_type: { tracking_type: RedditEventType };
  user: {
    email?: string;       // SHA256 lowercase trimmed
    external_id?: string; // SHA256 hashed
    ip_address?: string;
    user_agent?: string;
  };
  event_metadata?: {
    item_count?: number;
    value_decimal?: number;
    currency?: string;
    conversion_id?: string;
    products?: Array<{ id?: string; name?: string; category?: string }>;
  };
}

function isEnabled(): boolean {
  return !!(PIXEL_ID && ACCESS_TOKEN);
}

/**
 * Canonicalize an email per Reddit's spec before hashing:
 * 1. Lowercase
 * 2. Strip alias (everything between first + and @)
 * 3. Remove non-alphanumeric chars from username
 * 4. SHA256 → lowercase hex
 */
function canonicalizeEmail(email: string): string {
  const lower = email.trim().toLowerCase();
  const [username, domain] = lower.split("@");
  if (!username || !domain) return lower;
  // Strip alias: remove everything from first + to end of username
  const noAlias = username.replace(/\+.*$/, "");
  // Remove non-alphanumeric from username
  const clean = noAlias.replace(/[^a-z0-9]/g, "");
  return `${clean}@${domain}`;
}

/**
 * SHA256 hash a value after canonicalization (Reddit's requirement).
 * For emails, applies Reddit's full canonicalization spec.
 */
function hashEmail(email: string): string {
  return crypto
    .createHash("sha256")
    .update(canonicalizeEmail(email))
    .digest("hex");
}

/**
 * SHA256 hash a generic value (external IDs, etc).
 */
function hashValue(value: string): string {
  return crypto
    .createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex");
}

/**
 * Generate a conversionId matching the client-side format for dedup.
 */
function makeConversionId(eventName: string): string {
  return `${eventName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Send conversion event(s) to the Reddit Conversions API.
 * Fire-and-forget — never blocks the caller.
 */
async function sendEvents(events: RedditConversionEvent[]): Promise<void> {
  if (!isEnabled()) {
    logger.debug("Reddit CAPI disabled (no token/pixel)");
    return;
  }

  try {
    const body = JSON.stringify({
      test_mode: false,
      events,
    });

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn("Reddit CAPI error", {
        status: res.status,
        body: text.slice(0, 500),
      });
    } else {
      logger.info("Reddit CAPI event sent", {
        count: events.length,
        types: events.map((e) => e.event_type.tracking_type),
      });
    }
  } catch (err: any) {
    logger.warn("Reddit CAPI request failed", { error: err?.message });
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Track a SignUp event (user completes registration + email verification).
 */
export function trackSignUp(email: string, ipAddress?: string, userAgent?: string): void {
  if (!isEnabled()) return;

  const event: RedditConversionEvent = {
    event_at: new Date().toISOString(),
    event_type: { tracking_type: "SignUp" },
    user: {
      email: hashEmail(email),
      ...(ipAddress && { ip_address: ipAddress }),
      ...(userAgent && { user_agent: userAgent }),
    },
    event_metadata: {
      conversion_id: makeConversionId("signup_completed"),
    },
  };

  // Fire-and-forget
  sendEvents([event]).catch(() => {});
}

/**
 * Track a Lead event (email capture, referral share).
 */
export function trackLead(email: string, source?: string): void {
  if (!isEnabled()) return;

  const event: RedditConversionEvent = {
    event_at: new Date().toISOString(),
    event_type: { tracking_type: "Lead" },
    user: {
      email: hashEmail(email),
    },
    event_metadata: {
      conversion_id: makeConversionId("lead_captured"),
      ...(source && { products: [{ category: source }] }),
    },
  };

  sendEvents([event]).catch(() => {});
}

/**
 * Track a Purchase event (recovery revenue realized — payment captured).
 */
export function trackPurchase(opts: {
  email?: string;
  externalId?: string;
  revenueCents: number;
  currency?: string;
  ipAddress?: string;
}): void {
  if (!isEnabled()) return;

  const event: RedditConversionEvent = {
    event_at: new Date().toISOString(),
    event_type: { tracking_type: "Purchase" },
    user: {
      ...(opts.email && { email: hashEmail(opts.email) }),
      ...(opts.externalId && { external_id: hashValue(opts.externalId) }),
      ...(opts.ipAddress && { ip_address: opts.ipAddress }),
    },
    event_metadata: {
      conversion_id: makeConversionId("first_recovery_sent"),
      value_decimal: opts.revenueCents / 100,
      currency: opts.currency || "USD",
      item_count: 1,
    },
  };

  sendEvents([event]).catch(() => {});
}
