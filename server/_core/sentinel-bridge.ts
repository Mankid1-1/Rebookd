/**
 * Sentinel Bridge — unified error coordination layer
 *
 * Every server-side error path calls reportToSentinel() so the sentinel
 * daemon can detect, deduplicate, and auto-repair issues.  The bridge
 * also exposes isFeatureDisabled() so the app can respect sentinel's
 * circuit-breaker decisions (feature disables) in real time.
 *
 * Design constraints:
 *  - Fire-and-forget: reportToSentinel never throws or blocks the caller.
 *  - Deduplication: in-memory LRU prevents DB flood under cascading failure.
 *  - Low overhead: isFeatureDisabled uses a short TTL cache per feature key.
 */

import { createHash } from "crypto";
import { logger } from "./logger";

// ── Types ────────────────────────────────────────────────────────────────────

type ErrorType = "twilio" | "ai" | "automation" | "billing" | "webhook" | "system";
type Severity = "low" | "medium" | "high" | "critical";

interface ReportOpts {
  type: ErrorType;
  message: string;
  detail?: string;
  severity?: Severity;
  tenantId?: number;
}

// ── Deduplication Cache ──────────────────────────────────────────────────────

const DEDUP_TTL_MS = 60_000; // 60 seconds
const DEDUP_MAX = 100;
const PRUNE_INTERVAL = 50; // sweep stale entries every N calls

interface DedupEntry {
  ts: number;
  count: number;
}

const dedupCache = new Map<string, DedupEntry>();
let callsSinceLastPrune = 0;

function dedupKey(opts: ReportOpts): string {
  const raw = `${opts.type}|${opts.message}|${(opts.detail ?? "").slice(0, 200)}`;
  return createHash("md5").update(raw).digest("hex");
}

function isDuplicate(key: string): boolean {
  const now = Date.now();

  // Periodic prune: sweep expired entries every PRUNE_INTERVAL calls
  // (prevents stale entries lingering when cache is below capacity)
  callsSinceLastPrune++;
  if (callsSinceLastPrune >= PRUNE_INTERVAL) {
    callsSinceLastPrune = 0;
    for (const [k, v] of dedupCache) {
      if (now - v.ts > DEDUP_TTL_MS) dedupCache.delete(k);
    }
  }

  // Hard capacity prune as safety net
  if (dedupCache.size >= DEDUP_MAX) {
    for (const [k, v] of dedupCache) {
      if (now - v.ts > DEDUP_TTL_MS) dedupCache.delete(k);
    }
  }

  const entry = dedupCache.get(key);
  if (entry && now - entry.ts < DEDUP_TTL_MS) {
    entry.count++;
    return true;
  }

  dedupCache.set(key, { ts: now, count: 1 });
  return false;
}

// ── Report to Sentinel ───────────────────────────────────────────────────────

/**
 * Fire-and-forget: writes to systemErrorLogs so sentinel can detect the error.
 * Never throws. Deduplicates identical errors within 60 seconds.
 */
export function reportToSentinel(opts: ReportOpts): void {
  try {
    const key = dedupKey(opts);
    if (isDuplicate(key)) return;

    // Lazy import to avoid circular deps and keep startup fast
    Promise.all([
      import("../db").then((m) => m.getDb()),
      import("../services/system.service"),
    ])
      .then(([db, SystemService]) => {
        if (!db) return;
        return SystemService.createSystemError(db, {
          type: opts.type,
          message: opts.message.slice(0, 500),
          detail: opts.detail?.slice(0, 5000),
          severity: opts.severity ?? "high",
          tenantId: opts.tenantId,
        });
      })
      .catch(() => {
        // Swallow — if we can't reach the DB we can't report errors about it
      });
  } catch {
    // Absolute safety net — this function must never throw
  }
}

// ── Circuit Breaker Reporting ────────────────────────────────────────────────

/**
 * Call when a local circuit breaker trips open.
 * Records the event so sentinel can track infrastructure stress.
 */
export function reportCircuitBreakerTrip(breakerName: string, failures: number): void {
  reportToSentinel({
    type: "system",
    message: `[CIRCUIT_BREAKER] ${breakerName} opened after ${failures} failures`,
    detail: JSON.stringify({ breaker: breakerName, failures, openedAt: new Date().toISOString() }),
    severity: "high",
  });
}

// ── Feature Disable Check ────────────────────────────────────────────────────

interface CacheEntry {
  disabled: boolean;
  ts: number;
}

const FEATURE_CACHE_TTL_MS = 5_000; // 5 seconds
const featureCache = new Map<string, CacheEntry>();

/**
 * Check if sentinel has disabled a feature via the circuit breaker.
 * Uses a 5-second TTL cache to avoid DB load per request.
 */
export async function isFeatureDisabled(
  db: any,
  feature: string,
  tenantId?: number,
): Promise<boolean> {
  const cacheKey = `${feature}:${tenantId ?? 0}`;
  const now = Date.now();
  const cached = featureCache.get(cacheKey);
  if (cached && now - cached.ts < FEATURE_CACHE_TTL_MS) {
    return cached.disabled;
  }

  try {
    const { featureConfigs } = await import("../../drizzle/schema");
    const { eq, and, inArray } = await import("drizzle-orm");

    const ids = [0]; // platform-wide
    if (tenantId) ids.push(tenantId);

    const rows = await db
      .select({ enabled: featureConfigs.enabled })
      .from(featureConfigs)
      .where(
        and(
          eq(featureConfigs.feature, `sentinel_disabled_${feature}`),
          inArray(featureConfigs.tenantId, ids),
        ),
      )
      .limit(1);

    const disabled = rows.length > 0 && rows[0].enabled === false;
    featureCache.set(cacheKey, { disabled, ts: now });
    return disabled;
  } catch (err) {
    // If we can't check, use last known state if available; otherwise fail closed
    logger.warn("[sentinel-bridge] Failed to check feature disable", { feature, error: String(err) });
    if (cached) return cached.disabled; // Stale cache is better than guessing
    return false; // No prior state — allow feature to avoid blocking on first startup
  }
}

/**
 * Get all currently disabled features (for health check endpoint).
 */
export async function getDisabledFeatures(db: any): Promise<string[]> {
  try {
    const { featureConfigs } = await import("../../drizzle/schema");
    const { like, eq, and } = await import("drizzle-orm");

    const rows = await db
      .select({ feature: featureConfigs.feature })
      .from(featureConfigs)
      .where(
        and(
          like(featureConfigs.feature, "sentinel_disabled_%"),
          eq(featureConfigs.enabled, false),
        ),
      );

    return rows.map((r: any) => r.feature.replace("sentinel_disabled_", ""));
  } catch {
    return [];
  }
}
