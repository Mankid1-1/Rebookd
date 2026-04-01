/**
 * Graphical Profiler — passive browser-side telemetry for UI/performance anomalies.
 *
 * Uses PerformanceObserver (layout-shift, LCP, longtask, paint) and MutationObserver
 * to detect graphical inconsistencies and report them to sentinel via the standard
 * /api/system/client-error endpoint. Reports are deduped: max 1 per anomaly type
 * per page per 60 seconds.
 *
 * This runs entirely in the background with no impact on UI thread.
 */

type AnomalyType =
  | "cls"
  | "lcp"
  | "fcp"
  | "longtask"
  | "dom_thrash"
  | "paint_timeout";

// ─── Thresholds ──────────────────────────────────────────────────────────────

const CLS_THRESHOLD = 0.1;        // Google "poor" CLS score
const LCP_THRESHOLD_MS = 2500;    // Google "poor" LCP
const FCP_THRESHOLD_MS = 1800;    // Google "needs improvement" FCP
const LONGTASK_COUNT_THRESHOLD = 3; // 3+ long tasks in 10s window = congestion
const LONGTASK_WINDOW_MS = 10_000;
const DOM_MUTATION_THRESHOLD = 150; // mutations per animation frame = thrashing
const DEDUP_WINDOW_MS = 60_000;

// ─── State ───────────────────────────────────────────────────────────────────

const reported = new Map<string, number>(); // "type:page" → timestamp
let longTaskTimes: number[] = [];

// ─── Dedup Helper ────────────────────────────────────────────────────────────

function shouldReport(type: AnomalyType, page: string): boolean {
  const key = `${type}:${page}`;
  const now = Date.now();
  const last = reported.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) return false;
  reported.set(key, now);
  // Prune stale entries
  for (const [k, ts] of reported) {
    if (now - ts > DEDUP_WINDOW_MS) reported.delete(k);
  }
  return true;
}

// ─── Reporter ────────────────────────────────────────────────────────────────

function sendAnomaly(
  type: AnomalyType,
  score: number,
  unit: string,
  extra?: Record<string, unknown>,
): void {
  const page = window.location.pathname;
  if (!shouldReport(type, page)) return;

  const label =
    type === "cls" ? "Cumulative Layout Shift" :
    type === "lcp" ? "Largest Contentful Paint" :
    type === "fcp" ? "First Contentful Paint" :
    type === "longtask" ? "Main Thread Congestion (Long Tasks)" :
    type === "dom_thrash" ? "DOM Thrashing (excessive mutations)" :
    "Paint Timeout";

  const message = `[PERF_ANOMALY] ${label}: ${score}${unit} on ${page}`;

  fetch("/api/system/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      message,
      errorCategory: "performance",
      pageUrl: page,
      performanceData: { type, score, unit, page, ...extra },
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
  }).catch(() => {});
}

function sendVisualAnomaly(
  type: AnomalyType,
  description: string,
  extra?: Record<string, unknown>,
): void {
  const page = window.location.pathname;
  if (!shouldReport(type, page)) return;

  const message = `[VISUAL_ANOMALY] ${description} on ${page}`;

  fetch("/api/system/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      message,
      errorCategory: "graphical",
      pageUrl: page,
      performanceData: { type, description, page, ...extra },
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
  }).catch(() => {});
}

// ─── PerformanceObserver Setup ───────────────────────────────────────────────

function observeLayoutShift(): void {
  if (!("PerformanceObserver" in window)) return;
  try {
    let clsScore = 0;
    let windowStart = Date.now();

    const observer = new PerformanceObserver((list) => {
      const now = Date.now();
      // Reset window every 5s
      if (now - windowStart > 5_000) {
        clsScore = 0;
        windowStart = now;
      }
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
        if (!shift.hadRecentInput && shift.value) {
          clsScore += shift.value;
          if (clsScore > CLS_THRESHOLD) {
            sendAnomaly("cls", parseFloat(clsScore.toFixed(3)), "", {
              windowDurationMs: now - windowStart,
            });
          }
        }
      }
    });
    observer.observe({ type: "layout-shift", buffered: true });
  } catch {}
}

function observeLCP(): void {
  if (!("PerformanceObserver" in window)) return;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const lcp = entry as PerformanceEntry & { startTime: number };
        if (lcp.startTime > LCP_THRESHOLD_MS) {
          sendAnomaly("lcp", Math.round(lcp.startTime), "ms", {
            element: (entry as any).element?.tagName,
            url: (entry as any).url,
          });
        }
      }
    });
    observer.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {}
}

function observePaint(): void {
  if (!("PerformanceObserver" in window)) return;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint" && entry.startTime > FCP_THRESHOLD_MS) {
          sendAnomaly("fcp", Math.round(entry.startTime), "ms");
        }
      }
    });
    observer.observe({ type: "paint", buffered: true });
  } catch {}
}

function observeLongTasks(): void {
  if (!("PerformanceObserver" in window)) return;
  try {
    const observer = new PerformanceObserver((list) => {
      const now = Date.now();
      for (const entry of list.getEntries()) {
        longTaskTimes.push(now);
      }
      // Prune outside window
      longTaskTimes = longTaskTimes.filter((t) => now - t < LONGTASK_WINDOW_MS);
      if (longTaskTimes.length >= LONGTASK_COUNT_THRESHOLD) {
        sendAnomaly("longtask", longTaskTimes.length, " tasks/10s", {
          windowMs: LONGTASK_WINDOW_MS,
        });
        longTaskTimes = []; // Reset after reporting
      }
    });
    observer.observe({ type: "longtask", buffered: false });
  } catch {}
}

// ─── MutationObserver for DOM Thrashing ─────────────────────────────────────

function observeDomThrashing(): void {
  if (typeof MutationObserver === "undefined") return;
  let mutationCount = 0;
  let rafScheduled = false;

  const observer = new MutationObserver((mutations) => {
    mutationCount += mutations.length;
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(() => {
        if (mutationCount > DOM_MUTATION_THRESHOLD) {
          sendVisualAnomaly("dom_thrash", `DOM thrashing: ${mutationCount} mutations in one frame`, {
            mutationCount,
          });
        }
        mutationCount = 0;
        rafScheduled = false;
      });
    }
  });

  // Only observe body once the DOM is ready
  const startObserving = () => {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true, attributes: false });
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserving, { once: true });
  } else {
    startObserving();
  }
}

// ─── Public Init ─────────────────────────────────────────────────────────────

let profilerInitialized = false;

export function initGraphicalProfiler(): void {
  if (profilerInitialized || typeof window === "undefined") return;
  profilerInitialized = true;

  // Defer until after first paint to avoid slowing initial render
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => {
      observeLayoutShift();
      observeLCP();
      observePaint();
      observeLongTasks();
      observeDomThrashing();
    }, { timeout: 3000 });
  } else {
    setTimeout(() => {
      observeLayoutShift();
      observeLCP();
      observePaint();
      observeLongTasks();
      observeDomThrashing();
    }, 1000);
  }
}
