/**
 * Production Health Check & System Monitoring
 * Comprehensive diagnostics for production deployment
 */

import http from 'http';
import { tmpdir } from 'os';
import { readFileSync, statSync } from 'fs';
import { sql } from 'drizzle-orm';
import { logger } from './logger';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  database: { status: string; latency: number };
  redis: { status: string; latency: number };
  memory: { used: number; limit: number; percent: number };
  cpu: { usage: number };
  traffic: { level: string; connections: number; eventLoopLagMs: number; heapPercent: number };
  sentinel: { status: string; lastHeartbeat: string | null; activeRepairs: number; cycleCount?: number; lastRepairAttemptAt?: string | null };
  circuitBreakers: { query: string; general: string; sms: string };
  disabledFeatures: string[];
  clientErrors: { last5min: number; ratePerMin: number };
  services: Record<string, any>;
}

export async function performHealthCheck(): Promise<HealthStatus> {
  const startTime = Date.now();

  const [dbHealth, redisHealth, memHealth] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkMemory(),
  ]);
  const sentinelHealth = checkSentinel();

  // Circuit breaker states
  let queryBreakerState = "closed";
  let generalBreakerState = "closed";
  let smsBreakerState = "closed";
  let disabledFeatures: string[] = [];

  try {
    const { globalCircuitBreaker } = await import("./query-timeout.service");
    queryBreakerState = globalCircuitBreaker.getState();
  } catch {}

  try {
    const { smsCircuitBreaker } = await import("./sms");
    smsBreakerState = smsCircuitBreaker.getState();
  } catch {}

  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (db) {
      const { getDisabledFeatures } = await import("./sentinel-bridge");
      disabledFeatures = await getDisabledFeatures(db);
    }
  } catch {}

  const breakerOpen = queryBreakerState === "open" || generalBreakerState === "open";
  const featuresDisabled = disabledFeatures.length > 0;

  // Traffic stats
  let trafficStats = { level: "normal", connections: 0, eventLoopLagMs: 0, heapPercent: 0 };
  try {
    const { trafficMonitor } = await import("./traffic-monitor");
    const stats = trafficMonitor.getStats();
    trafficStats = {
      level: stats.level,
      connections: stats.activeConnections,
      eventLoopLagMs: stats.eventLoopLagMs,
      heapPercent: stats.heapUsagePercent,
    };
  } catch {}

  // Client error rate (from in-memory counter)
  const clientErrorStats = getClientErrorRate();

  const trafficCritical = trafficStats.level === "critical";

  const redisDown = redisHealth.status !== 'healthy' && redisHealth.status !== 'not_configured';
  const overallStatus =
    dbHealth.status !== 'healthy' || redisDown
      ? 'unhealthy'
      : trafficCritical
        ? 'degraded'
        : breakerOpen || featuresDisabled
          ? 'degraded'
          : 'healthy';

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbHealth,
    redis: redisHealth,
    memory: memHealth,
    cpu: { usage: process.cpuUsage().user },
    traffic: trafficStats,
    sentinel: sentinelHealth,
    circuitBreakers: { query: queryBreakerState, general: generalBreakerState, sms: smsBreakerState },
    disabledFeatures,
    clientErrors: clientErrorStats,
    services: {
      database: dbHealth.status,
      redis: redisHealth.status,
      memory: memHealth.percent < 80 ? 'healthy' : 'warning',
      traffic: trafficStats.level === 'normal' ? 'healthy' : trafficStats.level === 'high' ? 'warning' : 'critical',
      sentinel: sentinelHealth.status,
    },
  };
}

async function checkDatabase(): Promise<{ status: string; latency: number }> {
  try {
    const startTime = Date.now();

    const { getDb } = await import('../db');
    const db = await getDb();
    if (db) {
      await db.execute(sql`SELECT 1`);
    }

    const latency = Date.now() - startTime;
    return { status: 'healthy', latency };
  } catch (error) {
    logger.error('Database health check failed', { error });
    return { status: 'unhealthy', latency: -1 };
  }
}

async function checkRedis(): Promise<{ status: string; latency: number }> {
  // Redis is not currently used in this stack — report as not_configured
  // instead of lying about healthy status.
  if (!process.env.REDIS_URL) {
    return { status: 'not_configured', latency: 0 };
  }
  try {
    const startTime = Date.now();
    // TODO: Implement actual Redis ping when Redis is added to the stack
    const latency = Date.now() - startTime;
    return { status: 'healthy', latency };
  } catch (error) {
    logger.warn('Redis health check failed (non-critical)', { error });
    return { status: 'degraded', latency: -1 };
  }
}

function checkMemory(): { used: number; limit: number; percent: number } {
  const usage = process.memoryUsage();
  // Use actual heap total as limit (reflects V8's current allocation)
  const limit = usage.heapTotal || (4 * 1024 * 1024 * 1024);
  const used = usage.heapUsed;
  const percent = limit > 0 ? (used / limit) * 100 : 0;

  if (percent > 90) {
    logger.error('Memory usage critical', { percent, used: Math.round(used / 1024 / 1024) });
  } else if (percent > 75) {
    logger.warn('Memory usage high', { percent, used: Math.round(used / 1024 / 1024) });
  }

  return { used, limit, percent };
}

function checkSentinel(): { status: string; lastHeartbeat: string | null; activeRepairs: number; cycleCount?: number; lastRepairAttemptAt?: string | null } {
  const heartbeatPath = process.env.SENTINEL_HEARTBEAT_FILE || `${tmpdir()}/sentinel-heartbeat.json`;
  try {
    const stat = statSync(heartbeatPath, { throwIfNoEntry: false });
    if (!stat) {
      return { status: 'not_running', lastHeartbeat: null, activeRepairs: 0 };
    }
    const ageMs = Date.now() - stat.mtimeMs;
    const data = JSON.parse(readFileSync(heartbeatPath, 'utf8'));
    // Stale if heartbeat is > 2.5× the 60s poll interval (150s) — not the previous 300s value
    const stale = ageMs > 150_000;
    return {
      status: stale ? 'stale' : (data.status === 'ok' ? 'healthy' : data.status),
      lastHeartbeat: data.ts || null,
      activeRepairs: data.activeRepairs || 0,
      cycleCount: data.cycleCount,
      lastRepairAttemptAt: data.lastRepairAttemptAt ?? null,
    };
  } catch {
    return { status: 'unknown', lastHeartbeat: null, activeRepairs: 0 };
  }
}

// ── Client Error Rate Tracker ─────────────────────────────────────────────
// Ring buffer of timestamps so we can compute errors/min over the last 5 minutes.

const CLIENT_ERROR_WINDOW_MS = 5 * 60 * 1000; // 5 min
const clientErrorTimestamps: number[] = [];

/** Call this whenever a client error is received. */
export function recordClientError(): void {
  clientErrorTimestamps.push(Date.now());
  // Prune old entries
  const cutoff = Date.now() - CLIENT_ERROR_WINDOW_MS;
  while (clientErrorTimestamps.length > 0 && clientErrorTimestamps[0] < cutoff) {
    clientErrorTimestamps.shift();
  }
}

function getClientErrorRate(): { last5min: number; ratePerMin: number } {
  const cutoff = Date.now() - CLIENT_ERROR_WINDOW_MS;
  while (clientErrorTimestamps.length > 0 && clientErrorTimestamps[0] < cutoff) {
    clientErrorTimestamps.shift();
  }
  const count = clientErrorTimestamps.length;
  return { last5min: count, ratePerMin: Math.round((count / 5) * 10) / 10 };
}

// Health check endpoint handler
// Returns full details only when a valid INTERNAL_HEALTH_TOKEN is provided;
// otherwise returns a minimal status to avoid leaking internal state to attackers.
export function healthCheckHandler(req: http.IncomingMessage, res: http.ServerResponse) {
  performHealthCheck()
    .then((status) => {
      const authHeader = req.headers["x-health-token"] || req.headers["authorization"]?.replace("Bearer ", "");
      const expectedToken = process.env.INTERNAL_HEALTH_TOKEN;
      const isAuthorized = expectedToken && authHeader === expectedToken;

      const code = status.status === 'healthy' ? 200 : 503;

      if (isAuthorized) {
        // Full details for authenticated monitoring systems
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status, null, 2));
      } else {
        // Minimal response for unauthenticated requests — no internal details
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: status.status,
          timestamp: status.timestamp,
        }));
      }
    })
    .catch((error) => {
      logger.error('Health check failed', { error });
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'unhealthy' }));
    });
}
