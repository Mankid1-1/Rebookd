/**
 * Performance Vitals Monitor — catches slow pages and API latency before users complain.
 *
 * Measures:
 *  - tRPC API call latencies (fetch patch for /api/trpc/ URLs)
 *  - Page navigation timing (PerformanceObserver for 'navigation')
 *
 * Maintains a rolling 20-sample window per endpoint. Flags when a measurement
 * exceeds 2x the rolling median OR a static 3s threshold (whichever is higher).
 *
 * Reports anomalies to sentinel via /api/system/client-error with [PERF_ANOMALY] prefix.
 * Also posts raw timings to /api/system/sentinel-metric for baseline learning.
 */

// ── Config ───────────────────────────────────────────────────────────────────

const STATIC_SLOW_THRESHOLD_MS = 3_000;
const MEDIAN_MULTIPLIER = 2;
const WINDOW_SIZE = 20;
const MAX_REPORTS_PER_SESSION = 10;
const DEDUP_COOLDOWN_MS = 60_000;
const METRIC_FLUSH_INTERVAL_MS = 120_000; // Flush raw metrics every 2 min
const INITIAL_DELAY_MS = 5_000;

// ── State ────────────────────────────────────────────────────────────────────

let initialized = false;
let reportCount = 0;
const reportedEndpoints = new Map<string, number>();
const latencyWindows = new Map<string, number[]>();
const pendingMetrics: Array<{ metric: string; value: number; detail?: Record<string, unknown> }> = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function recordLatency(endpoint: string, ms: number): void {
  let window = latencyWindows.get(endpoint);
  if (!window) {
    window = [];
    latencyWindows.set(endpoint, window);
  }
  window.push(ms);
  if (window.length > WINDOW_SIZE) window.shift();

  // Queue for metric flush
  pendingMetrics.push({ metric: `api_latency:${endpoint}`, value: ms });

  // Check threshold
  const median = getMedian(window);
  const threshold = Math.max(STATIC_SLOW_THRESHOLD_MS, median * MEDIAN_MULTIPLIER);

  if (ms > threshold && window.length >= 3) {
    reportAnomaly(endpoint, ms, median, threshold);
  }
}

function reportAnomaly(endpoint: string, ms: number, median: number, threshold: number): void {
  if (reportCount >= MAX_REPORTS_PER_SESSION) return;

  const now = Date.now();
  const lastReport = reportedEndpoints.get(endpoint) || 0;
  if (now - lastReport < DEDUP_COOLDOWN_MS) return;

  reportedEndpoints.set(endpoint, now);
  reportCount++;

  const message = `[PERF_ANOMALY] Slow API: ${endpoint} took ${Math.round(ms)}ms (median ${Math.round(median)}ms, threshold ${Math.round(threshold)}ms)`;

  fetch("/api/system/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      message,
      stack: JSON.stringify({
        anomalyType: "slow_api",
        endpoint,
        durationMs: Math.round(ms),
        medianMs: Math.round(median),
        thresholdMs: Math.round(threshold),
        sampleCount: latencyWindows.get(endpoint)?.length || 0,
        page: window.location.pathname,
      }, null, 2),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
  }).catch(() => {});
}

// ── Metric Flushing ─────────────────────────────────────────────────────────

function flushMetrics(): void {
  if (pendingMetrics.length === 0) return;

  const batch = pendingMetrics.splice(0, 50);
  fetch("/api/system/sentinel-metric", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      category: "perf",
      metrics: batch,
    }),
  }).catch(() => {});
}

// ── Fetch Patching ──────────────────────────────────────────────────────────

function patchFetch(): void {
  const origFetch = window.fetch;
  window.fetch = function (...args: Parameters<typeof fetch>) {
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";

    // Only time tRPC API calls
    if (!url.includes("/api/trpc/")) {
      return origFetch.apply(this, args);
    }

    // Extract procedure name: /api/trpc/dashboard.stats → dashboard.stats
    const procedureMatch = url.match(/\/api\/trpc\/([^?]+)/);
    const endpoint = procedureMatch?.[1] || "unknown";
    const startTime = performance.now();

    return origFetch.apply(this, args).then(
      (response) => {
        const duration = performance.now() - startTime;
        recordLatency(endpoint, duration);
        return response;
      },
      (err) => {
        const duration = performance.now() - startTime;
        recordLatency(endpoint, duration);
        throw err;
      },
    );
  };
}

// ── Page Load Timing ────────────────────────────────────────────────────────

function observePageLoads(): void {
  if (typeof PerformanceObserver === "undefined") return;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "navigation") {
          const nav = entry as PerformanceNavigationTiming;
          const loadTime = nav.loadEventEnd - nav.startTime;
          if (loadTime > 0) {
            pendingMetrics.push({
              metric: "page_load",
              value: loadTime,
              detail: { page: window.location.pathname },
            });

            if (loadTime > STATIC_SLOW_THRESHOLD_MS) {
              reportAnomaly(`page:${window.location.pathname}`, loadTime, 0, STATIC_SLOW_THRESHOLD_MS);
            }
          }
        }
      }
    });
    observer.observe({ type: "navigation", buffered: true });
  } catch {
    // PerformanceObserver not supported for this type
  }
}

// ── Initialization ──────────────────────────────────────────────────────────

export function initPerformanceMonitor(): void {
  if (initialized || typeof window === "undefined") return;
  if (process.env.NODE_ENV === "development") return;
  initialized = true;

  patchFetch();

  setTimeout(() => {
    observePageLoads();
    setInterval(flushMetrics, METRIC_FLUSH_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}
