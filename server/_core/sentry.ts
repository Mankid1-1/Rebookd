/**
 * Sentry error tracking — optional, only active when SENTRY_DSN is set.
 *
 * We use the @sentry/node SDK lazily so the app starts fine without it.
 * Install: pnpm add @sentry/node
 */

let _initialized = false;

export async function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: 0.1,
    });
    _initialized = true;
    console.log("[Sentry] Initialized");
  } catch {
    console.warn("[Sentry] @sentry/node not installed — skipping error tracking. Run: pnpm add @sentry/node");
  }
}

export async function captureException(err: unknown, context?: Record<string, unknown>) {
  if (!_initialized) {
    // Fallback: structured console error when Sentry is unavailable
    const errMsg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(JSON.stringify({
      level: "error",
      timestamp: new Date().toISOString(),
      message: errMsg,
      ...(stack ? { stack } : {}),
      ...(context ? { context } : {}),
    }));
    return;
  }
  try {
    const Sentry = await import("@sentry/node");
    Sentry.withScope((scope) => {
      if (context) scope.setExtras(context);
      Sentry.captureException(err);
    });
  } catch {
    // Sentry call failed — fallback to structured console
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      level: "error",
      timestamp: new Date().toISOString(),
      message: errMsg,
      source: "sentry_fallback",
      ...(context ? { context } : {}),
    }));
  }
}
