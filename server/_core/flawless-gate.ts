/**
 * Flawless Gate - Post-deployment response shape validator
 *
 * Lightweight observability middleware that validates tRPC responses
 * against registered schemas. Never blocks — only logs anomalies.
 * The real protection is the Triple-Lock (tsc + vitest + lint) in
 * the autopilot shell script; this provides a post-deploy safety net.
 */

import { logger } from "./logger";

// ─── Anomaly Tracking ────────────────────────────────────────────────────────

interface AnomalyBucket {
  total: number;
  anomalies: number;
  windowStart: number;
}

const WINDOW_MS = 5 * 60_000; // 5-minute sliding window
const ANOMALY_THRESHOLD = 0.01; // 1% anomaly rate triggers alert

/** Per-procedure anomaly buckets */
const buckets = new Map<string, AnomalyBucket>();

/**
 * Record a procedure response and optionally flag an anomaly.
 */
export function recordResponse(
  procedurePath: string,
  isAnomaly: boolean,
): void {
  const now = Date.now();
  let bucket = buckets.get(procedurePath);

  // Reset bucket if window expired
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    bucket = { total: 0, anomalies: 0, windowStart: now };
    buckets.set(procedurePath, bucket);
  }

  bucket.total++;
  if (isAnomaly) bucket.anomalies++;

  // Check threshold
  if (bucket.total >= 10 && bucket.anomalies / bucket.total > ANOMALY_THRESHOLD) {
    logger.warn(`[flawless-gate] Anomaly rate exceeded for ${procedurePath}`, {
      total: bucket.total,
      anomalies: bucket.anomalies,
      rate: (bucket.anomalies / bucket.total * 100).toFixed(1) + "%",
    });
    // Escalate to sentinel so it can track response-shape degradation
    import("./sentinel-bridge").then(({ reportToSentinel }) => {
      reportToSentinel({
        type: "system",
        message: `[FLAWLESS_GATE] Anomaly rate ${(bucket.anomalies / bucket.total * 100).toFixed(1)}% for ${procedurePath}`,
        detail: JSON.stringify({ total: bucket.total, anomalies: bucket.anomalies, procedurePath }),
        severity: "high",
      });
    }).catch(() => {});
  }
}

// ─── Response Shape Validators ───────────────────────────────────────────────

type ShapeValidator = (data: unknown) => boolean;

/** Registry of shape validators for critical procedures */
const validators = new Map<string, ShapeValidator>();

/**
 * Register a shape validator for a tRPC procedure path.
 * The validator returns true if the response shape is as expected.
 */
export function registerValidator(
  procedurePath: string,
  validator: ShapeValidator,
): void {
  validators.set(procedurePath, validator);
}

/**
 * Validate a response against its registered shape validator.
 * Returns true if valid or no validator registered (pass-through).
 */
export function validateResponse(
  procedurePath: string,
  data: unknown,
): boolean {
  const validator = validators.get(procedurePath);
  if (!validator) return true; // no validator = pass-through

  try {
    const valid = validator(data);
    recordResponse(procedurePath, !valid);
    if (!valid) {
      logger.warn(`[flawless-gate] Shape mismatch for ${procedurePath}`, {
        dataType: typeof data,
        isArray: Array.isArray(data),
      });
    }
    return valid;
  } catch (err) {
    logger.error(`[flawless-gate] Validator error for ${procedurePath}`, {
      error: String(err),
    });
    recordResponse(procedurePath, true);
    return false;
  }
}

// ─── Pre-registered Critical Validators ──────────────────────────────────────

// Dashboard stats must return an object with numeric fields
registerValidator("dashboard.stats", (data) =>
  data !== null && typeof data === "object" && !Array.isArray(data),
);

// Leads list must return an array
registerValidator("leads.list", (data) => Array.isArray(data));

// Automations list must return an array
registerValidator("automations.list", (data) => Array.isArray(data));

/**
 * Get current anomaly stats for the admin dashboard.
 * Also prunes stale buckets to prevent memory leak.
 */
export function getAnomalyStats(): Record<string, { total: number; anomalies: number; rate: string }> {
  const stats: Record<string, { total: number; anomalies: number; rate: string }> = {};
  const now = Date.now();
  for (const [path, bucket] of buckets) {
    if (now - bucket.windowStart <= WINDOW_MS && bucket.total > 0) {
      stats[path] = {
        total: bucket.total,
        anomalies: bucket.anomalies,
        rate: (bucket.anomalies / bucket.total * 100).toFixed(1) + "%",
      };
    } else if (now - bucket.windowStart > WINDOW_MS * 2) {
      // Prune buckets inactive for 2x the window to prevent memory leak
      buckets.delete(path);
    }
  }
  return stats;
}
