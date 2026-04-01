/**
 * n8n Rate Limiter Service
 *
 * In-memory sliding window rate limiter for n8n callback endpoints.
 * Keyed by tenantId:endpoint, with configurable limits per endpoint.
 * Auto-cleans stale entries every 10 minutes.
 */

interface RateBucket {
  timestamps: number[];
}

const buckets = new Map<string, RateBucket>();

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  const maxWindowMs = 120_000; // 2 minutes is the longest window we support
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < maxWindowMs);
    if (bucket.timestamps.length === 0) {
      buckets.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Check if a request is within rate limits.
 * Returns true if allowed, false if rate-limited.
 */
export function checkN8nRateLimit(
  tenantId: number,
  endpoint: string,
  limit: number,
  windowMs: number = 60_000,
): boolean {
  const key = `${tenantId}:${endpoint}`;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  // Prune timestamps outside the window
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    return false;
  }

  bucket.timestamps.push(now);
  return true;
}

/**
 * Get current rate limit usage for monitoring.
 */
export function getRateLimitUsage(
  tenantId: number,
  endpoint: string,
  windowMs: number = 60_000,
): { current: number; window: number } {
  const key = `${tenantId}:${endpoint}`;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket) return { current: 0, window: windowMs };

  const current = bucket.timestamps.filter((t) => now - t < windowMs).length;
  return { current, window: windowMs };
}
