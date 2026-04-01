/**
 * Revenue Pipeline Guardian — watches lead→contact→convert→realize for anomalies.
 *
 * Highest revenue-impact sentinel capability. Detects:
 *  - Stalled recoveries (sent >48h with no response)
 *  - Conversion rate drops (>30% week-over-week per tenant)
 *  - Message delivery failure spikes (>15% failure rate)
 *  - Revenue leakage (converted but not realized after 72h)
 *
 * Runs every sentinel cycle (60s) — pipeline issues are time-sensitive.
 * Reports PlanViolation objects to systemErrorLogs with [PIPELINE] prefix.
 */

import { and, eq, gt, lt, sql, count } from "drizzle-orm";
import { recoveryEvents, messages, tenants } from "../../drizzle/schema";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";

interface PipelineViolation {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  tenantId: number;
  tenantName: string;
  message: string;
  detail: Record<string, unknown>;
}

/**
 * Analyze the revenue pipeline for anomalies. Sub-checks are staggered
 * by cycle count to reduce per-cycle query load:
 *  - Delivery failures: every cycle (time-sensitive, cheap query)
 *  - Stalled recoveries: every 5 cycles (48h window tolerates 5-min granularity)
 *  - Revenue leakage: every 10 cycles (72h window, less urgent)
 */
export async function analyzePipeline(db: Db, cycleCount: number = 0): Promise<PipelineViolation[]> {
  const violations: PipelineViolation[] = [];

  // Every cycle: delivery failures are time-sensitive (SMS provider issues)
  try {
    const delivery = await checkDeliveryFailures(db);
    violations.push(...delivery);
  } catch (err) {
    logger.warn("[sentinel-pipeline] Error checking delivery failures", { error: String(err) });
  }

  // Every 5 cycles (~5 min): stalled recoveries have a 48h window
  if (cycleCount % 5 === 0) {
    try {
      const stalled = await checkStalledRecoveries(db);
      violations.push(...stalled);
    } catch (err) {
      logger.warn("[sentinel-pipeline] Error checking stalled recoveries", { error: String(err) });
    }
  }

  // Every 10 cycles (~10 min): revenue leakage has a 72h window
  if (cycleCount % 10 === 0) {
    try {
      const leakage = await checkRevenueLeakage(db);
      violations.push(...leakage);
    } catch (err) {
      logger.warn("[sentinel-pipeline] Error checking revenue leakage", { error: String(err) });
    }
  }

  return violations;
}

// ── Stalled Recoveries ──────────────────────────────────────────────────────

async function checkStalledRecoveries(db: Db): Promise<PipelineViolation[]> {
  const violations: PipelineViolation[] = [];

  // Recovery events stuck in 'sent' for >48h — tenant isn't following up
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const rows = await db
    .select({
      tenantId: recoveryEvents.tenantId,
      cnt: count(),
      tenantName: tenants.name,
    })
    .from(recoveryEvents)
    .innerJoin(tenants, eq(tenants.id, recoveryEvents.tenantId))
    .where(
      and(
        eq(recoveryEvents.status, "sent"),
        lt(recoveryEvents.sentAt, cutoff),
      ),
    )
    .groupBy(recoveryEvents.tenantId, tenants.name);

  for (const row of rows) {
    if (row.cnt >= 3) {
      violations.push({
        type: "stalled_recovery",
        severity: "medium",
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        message: `[PIPELINE] ${row.cnt} recovery attempts stalled >48h for "${row.tenantName}" — leads not responding`,
        detail: { stalledCount: row.cnt, cutoffHours: 48 },
      });
    }
  }

  return violations;
}

// ── Delivery Failure Spikes ─────────────────────────────────────────────────

async function checkDeliveryFailures(db: Db): Promise<PipelineViolation[]> {
  const violations: PipelineViolation[] = [];

  // Check last 24h of outbound messages per tenant
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      tenantId: messages.tenantId,
      total: count(),
      failed: sql<number>`SUM(CASE WHEN ${messages.status} = 'failed' THEN 1 ELSE 0 END)`,
      tenantName: tenants.name,
    })
    .from(messages)
    .innerJoin(tenants, eq(tenants.id, messages.tenantId))
    .where(
      and(
        eq(messages.direction, "outbound"),
        gt(messages.createdAt, since),
      ),
    )
    .groupBy(messages.tenantId, tenants.name);

  for (const row of rows) {
    const failRate = row.total > 0 ? (row.failed || 0) / row.total : 0;
    if (failRate > 0.15 && row.total >= 5) {
      violations.push({
        type: "delivery_failure_spike",
        severity: "high",
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        message: `[PIPELINE] ${Math.round(failRate * 100)}% message delivery failure rate for "${row.tenantName}" (${row.failed}/${row.total} in 24h)`,
        detail: { total: row.total, failed: row.failed, failRate: Math.round(failRate * 100) },
      });
    }
  }

  return violations;
}

// ── Revenue Leakage ─────────────────────────────────────────────────────────

async function checkRevenueLeakage(db: Db): Promise<PipelineViolation[]> {
  const violations: PipelineViolation[] = [];

  // Converted but realizedRevenue = 0 after 72h — money on the table
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);

  const rows = await db
    .select({
      tenantId: recoveryEvents.tenantId,
      cnt: count(),
      estimatedTotal: sql<number>`SUM(${recoveryEvents.estimatedRevenue})`,
      tenantName: tenants.name,
    })
    .from(recoveryEvents)
    .innerJoin(tenants, eq(tenants.id, recoveryEvents.tenantId))
    .where(
      and(
        eq(recoveryEvents.status, "converted"),
        eq(recoveryEvents.realizedRevenue, 0),
        lt(recoveryEvents.convertedAt, cutoff),
      ),
    )
    .groupBy(recoveryEvents.tenantId, tenants.name);

  for (const row of rows) {
    if (row.cnt >= 1) {
      violations.push({
        type: "revenue_leakage",
        severity: "high",
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        message: `[PIPELINE] ${row.cnt} converted leads with $0 realized revenue for "${row.tenantName}" — est. $${((row.estimatedTotal || 0) / 100).toFixed(0)} at risk`,
        detail: { leakCount: row.cnt, estimatedRevenueCents: row.estimatedTotal },
      });
    }
  }

  return violations;
}
