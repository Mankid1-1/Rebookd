/**
 * User Journey Tracker — detects confused, stuck, or abandoning users.
 *
 * Observes SPA navigation (history.pushState/replaceState + popstate) to detect:
 *  - Navigation loops: cycling between 2-3 pages 6+ times (user can't find what they need)
 *  - Stuck pages: dwelling >3x the page's average dwell time (feature is confusing)
 *  - Onboarding abandonment: leaving /onboarding before completing
 *
 * Reports to sentinel via /api/system/client-error with [JOURNEY_*] prefixes.
 * Posts dwell times to /api/system/sentinel-metric for adaptive baseline learning.
 */

// ── Config ───────────────────────────────────────────────────────────────────

const MAX_HISTORY = 20;
const LOOP_THRESHOLD = 6; // 6+ visits to same small set of pages
const STUCK_MULTIPLIER = 3; // 3x normal dwell time
const STATIC_STUCK_THRESHOLD_MS = 600_000; // 10 min static fallback
const MAX_REPORTS_PER_SESSION = 8;
const DEDUP_COOLDOWN_MS = 300_000; // 5 min dedup
const METRIC_FLUSH_INTERVAL_MS = 300_000; // Flush every 5 min
const INITIAL_DELAY_MS = 3_000;

// ── State ────────────────────────────────────────────────────────────────────

let initialized = false;
let reportCount = 0;
const reportedPatterns = new Map<string, number>();
const pageHistory: Array<{ path: string; enteredAt: number }> = [];
const dwellTimes = new Map<string, number[]>(); // path → dwell time samples
const pendingMetrics: Array<{ metric: string; value: number; detail?: Record<string, unknown> }> = [];

// ── Navigation Recording ─────────────────────────────────────────────────────

function recordNavigation(path: string): void {
  const now = Date.now();

  // Record dwell time for the previous page
  if (pageHistory.length > 0) {
    const prev = pageHistory[pageHistory.length - 1];
    const dwell = now - prev.enteredAt;
    if (dwell > 500 && dwell < 3_600_000) { // Between 0.5s and 1h
      let samples = dwellTimes.get(prev.path);
      if (!samples) {
        samples = [];
        dwellTimes.set(prev.path, samples);
      }
      samples.push(dwell);
      if (samples.length > 20) samples.shift();

      pendingMetrics.push({
        metric: `dwell:${prev.path}`,
        value: dwell,
        detail: { from: prev.path, to: path },
      });
    }
  }

  // Add to history
  pageHistory.push({ path, enteredAt: now });
  if (pageHistory.length > MAX_HISTORY) pageHistory.shift();

  // Check for patterns
  checkLoopPattern();
  checkOnboardingAbandonment(path);
}

// ── Pattern Detection ────────────────────────────────────────────────────────

function checkLoopPattern(): void {
  if (pageHistory.length < LOOP_THRESHOLD) return;

  // Count unique paths in last 10 visits
  const recent = pageHistory.slice(-10);
  const pathCounts = new Map<string, number>();
  for (const entry of recent) {
    pathCounts.set(entry.path, (pathCounts.get(entry.path) || 0) + 1);
  }

  // Find if 2-3 pages dominate (each visited 3+ times)
  const dominantPaths = [...pathCounts.entries()]
    .filter(([_, count]) => count >= 3)
    .map(([path]) => path);

  if (dominantPaths.length >= 2 && dominantPaths.length <= 3) {
    const totalDominant = dominantPaths.reduce((sum, p) => sum + (pathCounts.get(p) || 0), 0);
    if (totalDominant >= LOOP_THRESHOLD) {
      reportPattern("loop", dominantPaths.join(" ↔ "), {
        pages: dominantPaths,
        visitCounts: Object.fromEntries(pathCounts),
        recentHistory: recent.map((e) => e.path),
      });
    }
  }
}

// Pages where long dwell times are expected (reading content, not "stuck")
const STUCK_EXEMPT_PATHS = ["/", "/home", "/pricing", "/about", "/blog"];

function checkStuckPage(): void {
  if (pageHistory.length === 0) return;

  const current = pageHistory[pageHistory.length - 1];
  if (STUCK_EXEMPT_PATHS.includes(current.path)) return;

  const dwell = Date.now() - current.enteredAt;
  const samples = dwellTimes.get(current.path);
  const avgDwell = samples && samples.length >= 3
    ? samples.reduce((a, b) => a + b, 0) / samples.length
    : STATIC_STUCK_THRESHOLD_MS / STUCK_MULTIPLIER;

  const threshold = Math.max(avgDwell * STUCK_MULTIPLIER, STATIC_STUCK_THRESHOLD_MS);

  if (dwell > threshold) {
    reportPattern("stuck", current.path, {
      page: current.path,
      dwellMs: dwell,
      avgDwellMs: Math.round(avgDwell),
      thresholdMs: Math.round(threshold),
      sampleCount: samples?.length || 0,
    });
  }
}

function checkOnboardingAbandonment(newPath: string): void {
  if (pageHistory.length < 2) return;

  const prev = pageHistory[pageHistory.length - 2];
  if (prev.path.startsWith("/onboarding") && !newPath.startsWith("/onboarding")) {
    // User left onboarding — check if they completed it
    const onboardingVisits = pageHistory.filter((e) => e.path.startsWith("/onboarding"));
    const maxStep = onboardingVisits.reduce((max, e) => {
      const stepMatch = e.path.match(/step[/-]?(\d+)/i);
      return stepMatch ? Math.max(max, parseInt(stepMatch[1])) : max;
    }, 1);

    if (maxStep < 3) {
      reportPattern("abandoned", "onboarding", {
        lastStep: maxStep,
        exitedTo: newPath,
        timeInOnboarding: Date.now() - onboardingVisits[0].enteredAt,
      });
    }
  }
}

// ── Reporting ────────────────────────────────────────────────────────────────

function reportPattern(
  type: "loop" | "stuck" | "abandoned",
  key: string,
  detail: Record<string, unknown>,
): void {
  if (reportCount >= MAX_REPORTS_PER_SESSION) return;

  const dedupKey = `${type}:${key}`;
  const now = Date.now();
  const lastReport = reportedPatterns.get(dedupKey) || 0;
  if (now - lastReport < DEDUP_COOLDOWN_MS) return;

  reportedPatterns.set(dedupKey, now);
  reportCount++;

  const prefixMap = { loop: "[JOURNEY_LOOP]", stuck: "[JOURNEY_STUCK]", abandoned: "[JOURNEY_ABANDONED]" };
  const labelMap = {
    loop: `User looping between pages: ${key}`,
    stuck: `User stuck on ${key}`,
    abandoned: `User abandoned ${key}`,
  };

  const message = `${prefixMap[type]} ${labelMap[type]}`;

  fetch("/api/system/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      message,
      stack: JSON.stringify({ journeyType: type, ...detail, page: window.location.pathname }, null, 2),
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
    body: JSON.stringify({ category: "journey", metrics: batch }),
  }).catch(() => {});
}

// ── Initialization ──────────────────────────────────────────────────────────

export function initJourneyTracker(): void {
  if (initialized || typeof window === "undefined") return;
  if (process.env.NODE_ENV === "development") return;
  initialized = true;

  // Patch history methods to observe SPA navigation
  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);

  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    origPush(...args);
    recordNavigation(window.location.pathname);
  };

  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    origReplace(...args);
    recordNavigation(window.location.pathname);
  };

  window.addEventListener("popstate", () => {
    recordNavigation(window.location.pathname);
  });

  // Record initial page
  setTimeout(() => {
    recordNavigation(window.location.pathname);

    // Periodic stuck-page check (every 2 min to reduce noise)
    setInterval(checkStuckPage, 120_000);

    // Periodic metric flush
    setInterval(flushMetrics, METRIC_FLUSH_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}
