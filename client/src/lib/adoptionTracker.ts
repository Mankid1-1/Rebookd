/**
 * Feature Adoption Tracker — detects churn signals and underutilized features.
 *
 * Maps route visits to named feature categories and tracks touch counts.
 * Flushes batched adoption data to /api/system/sentinel-metric every 5 minutes.
 *
 * Server-side sentinel compares weekly touch counts to detect:
 *  - Declining engagement (churn signal)
 *  - Underutilized features that could help the tenant
 *  - Feature discovery patterns (which features do new users find first?)
 */

// ── Config ───────────────────────────────────────────────────────────────────

const FLUSH_INTERVAL_MS = 300_000; // 5 min
const INITIAL_DELAY_MS = 10_000;

// ── Route → Feature Mapping ──────────────────────────────────────────────────

const ROUTE_FEATURES: Record<string, string> = {
  "/dashboard": "dashboard",
  "/leads": "lead_management",
  "/automations": "automations",
  "/analytics": "analytics",
  "/settings": "settings",
  "/billing": "billing",
  "/inbox": "inbox",
  "/templates": "templates",
  "/no-show-recovery": "noshow_recovery",
  "/cancellation-recovery": "cancellation_recovery",
  "/booking-conversion": "booking_conversion",
  "/smart-scheduling": "smart_scheduling",
  "/retention-engine": "retention_engine",
  "/review-management": "review_management",
  "/waiting-list": "waiting_list",
  "/rescheduling": "rescheduling",
  "/after-hours": "after_hours",
  "/calendar-integration": "calendar_integration",
  "/contact-import": "contact_import",
  "/ai-tools": "ai_tools",
  "/referral": "referral",
  "/onboarding": "onboarding",
};

// ── State ────────────────────────────────────────────────────────────────────

let initialized = false;
const touchCounts = new Map<string, number>();
let sessionStart = 0;

// ── Feature Resolution ───────────────────────────────────────────────────────

function resolveFeature(path: string): string | null {
  // Exact match first
  if (ROUTE_FEATURES[path]) return ROUTE_FEATURES[path];

  // Prefix match (e.g., /leads/123 → lead_management)
  for (const [route, feature] of Object.entries(ROUTE_FEATURES)) {
    if (path.startsWith(route + "/") || path === route) return feature;
  }

  // Admin pages
  if (path.startsWith("/admin")) return "admin";

  return null;
}

function recordFeatureTouch(path: string): void {
  const feature = resolveFeature(path);
  if (!feature) return;

  touchCounts.set(feature, (touchCounts.get(feature) || 0) + 1);
}

// ── Flushing ─────────────────────────────────────────────────────────────────

function flushAdoption(): void {
  if (touchCounts.size === 0) return;

  const metrics: Array<{ metric: string; value: number; detail?: Record<string, unknown> }> = [];

  for (const [feature, count] of touchCounts) {
    metrics.push({
      metric: `adoption:${feature}`,
      value: count,
      detail: { sessionDurationMs: Date.now() - sessionStart },
    });
  }

  // Don't clear — accumulate for the session. Sentinel deduplicates by measuredAt window.
  // But reset counts so next flush only sends new touches.
  touchCounts.clear();

  fetch("/api/system/sentinel-metric", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ category: "adoption", metrics }),
  }).catch(() => {});
}

// ── Initialization ──────────────────────────────────────────────────────────

export function initAdoptionTracker(): void {
  if (initialized || typeof window === "undefined") return;
  if (process.env.NODE_ENV === "development") return;
  initialized = true;
  sessionStart = Date.now();

  // Patch history to track SPA navigation
  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);

  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    origPush(...args);
    recordFeatureTouch(window.location.pathname);
  };

  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    origReplace(...args);
    recordFeatureTouch(window.location.pathname);
  };

  window.addEventListener("popstate", () => {
    recordFeatureTouch(window.location.pathname);
  });

  // Record initial page after delay
  setTimeout(() => {
    recordFeatureTouch(window.location.pathname);
    setInterval(flushAdoption, FLUSH_INTERVAL_MS);
  }, INITIAL_DELAY_MS);

  // Flush on page unload
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAdoption();
  });
}
