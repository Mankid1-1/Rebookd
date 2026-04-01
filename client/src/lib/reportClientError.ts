/**
 * Shared client error reporting — used by both ErrorBoundary and
 * EnhancedErrorBoundary, plus global window error handlers.
 *
 * POSTs to /api/system/client-error (fire-and-forget) so sentinel
 * can track and auto-repair client-side errors.
 * Deduplicates: same error message suppressed for 30 seconds.
 */

import { initGraphicalProfiler } from "./graphicalProfiler";

const recentErrors = new Map<string, number>(); // key → timestamp
const DEDUP_WINDOW_MS = 30_000;
const MAX_DEDUP_ENTRIES = 10;

type ErrorCategory = "runtime" | "graphical" | "rendering" | "network" | "performance";

/**
 * Parse React's componentStack string into an array of the top N component names.
 * Input: "\n    at Button (/src/components/Button.tsx:10)\n    at Dashboard ..."
 * Output: ["Button", "Dashboard", ...]
 */
function parseComponentPath(componentStack: string | null | undefined, limit = 5): string[] {
  if (!componentStack) return [];
  return componentStack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "))
    .map((line) => {
      // Extract component name: "at ComponentName (/path...)" or "at ComponentName"
      const match = line.match(/^at\s+([A-Z][^\s(]+)/);
      return match?.[1] ?? null;
    })
    .filter((name): name is string => name !== null)
    .slice(0, limit);
}

/**
 * Infer errorCategory from the message prefix.
 */
function inferCategory(message: string): ErrorCategory {
  if (message.startsWith("[ERROR_PAGE_SHOWN]") || message.startsWith("[ERROR_PAGE_STUCK]")) {
    return "rendering";
  }
  if (message.startsWith("[PERF_ANOMALY]")) return "performance";
  if (message.startsWith("[VISUAL_ANOMALY]") || message.startsWith("[DEAD_CLICK]") || message.startsWith("[RAGE_CLICK]")) {
    return "graphical";
  }
  return "runtime";
}

export function reportClientError(error: Error, componentStack?: string | null): void {
  const key = error.message + (error.stack?.slice(0, 200) || "");
  const now = Date.now();
  const lastSeen = recentErrors.get(key);
  if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) return;
  // Prune old entries to avoid memory growth
  if (recentErrors.size >= MAX_DEDUP_ENTRIES) {
    for (const [k, ts] of recentErrors) {
      if (now - ts > DEDUP_WINDOW_MS) recentErrors.delete(k);
    }
  }
  recentErrors.set(key, now);

  const componentPath = parseComponentPath(componentStack);

  fetch("/api/system/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      message: error.message,
      stack: error.stack?.slice(0, 2000),
      componentStack: componentStack?.slice(0, 1000),
      componentPath,
      errorCategory: "runtime" satisfies ErrorCategory,
      pageUrl: window.location.pathname,
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
  }).catch(() => {}); // fire-and-forget
}

/**
 * Report that a user is seeing the "Something went wrong" error page.
 * Includes retry attempt count so sentinel can detect persistent crashes
 * and prioritize repair jobs for errors that block entire pages.
 */
export function reportErrorBoundaryShown(opts: {
  error: Error;
  retryCount: number;
  maxRetries: number;
  page: string;
  featureName?: string;
  componentStack?: string | null;
}): void {
  const attemptsLeft = opts.maxRetries - opts.retryCount + 1;
  const exhausted = attemptsLeft <= 0;
  const prefix = exhausted ? "[ERROR_PAGE_STUCK]" : "[ERROR_PAGE_SHOWN]";
  const severity = exhausted ? "critical" : "high";
  const errorCategory: ErrorCategory = "rendering";

  const message = `${prefix} User on error page at ${opts.page} — ${
    exhausted
      ? "all retries exhausted, page is broken"
      : `attempt ${opts.retryCount}, ${attemptsLeft} retries left`
  }: ${opts.error.message}`;

  const componentPath = parseComponentPath(opts.componentStack);

  fetch("/api/system/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      message,
      errorCategory,
      componentPath,
      pageUrl: opts.page,
      stack: JSON.stringify({
        errorName: opts.error.name,
        errorMessage: opts.error.message,
        stack: opts.error.stack?.slice(0, 2000),
        componentStack: opts.componentStack?.slice(0, 1000),
        page: opts.page,
        featureName: opts.featureName,
        retryCount: opts.retryCount,
        maxRetries: opts.maxRetries,
        attemptsLeft,
        exhausted,
        severity,
        userAgent: navigator.userAgent,
      }, null, 2),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
  }).catch(() => {});
}

// ── Global Handlers ──────────────────────────────────────────────────────────
// Registered once — catches errors outside React's error boundary tree.

let globalHandlersInitialized = false;

export function initGlobalErrorHandlers(): void {
  if (globalHandlersInitialized || typeof window === "undefined") return;
  globalHandlersInitialized = true;

  window.addEventListener("error", (event) => {
    if (event.error) {
      reportClientError(event.error);
    } else {
      reportClientError(new Error(event.message || "Unknown window error"));
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const error =
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason || "Unhandled promise rejection"));
    reportClientError(error);
  });

  // Start graphical/performance profiling
  initGraphicalProfiler();
}

// Re-export inferCategory for use in graphicalProfiler
export { inferCategory };
