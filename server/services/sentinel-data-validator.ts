/**
 * Data Consistency Validator — finds orphaned records, stale state, and conflicts.
 *
 * Catches silent data problems that never throw errors:
 *  - Orphaned messages (leadId references deleted lead)
 *  - Stale recovery events (stuck in 'sent' for >7 days)
 *  - Orphaned recovery events (stranded in 'sent' with no automation log, >10 min)
 *  - Stuck recovery state machine (sent >48h, no response)
 *  - Lead status stalls (qualified leads stuck >14 days with no progression)
 *  - Subscription state conflicts (active with expired trial end)
 *  - Job queue depth (pending jobs exceeding thresholds)
 *
 * Runs every 30 sentinel cycles (~30 min) — heavy queries, not time-sensitive.
 * Reports PlanViolation objects at "medium" severity.
 */

import { and, eq, gt, lt, sql, count, isNull, min } from "drizzle-orm";
import { automationJobs, automationLogs, leads, recoveryEvents, subscriptions, tenants } from "../../drizzle/schema";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";

interface ConsistencyViolation {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  tenantId: number;
  tenantName: string;
  message: string;
  detail: Record<string, unknown>;
}

export async function validateDataConsistency(db: Db): Promise<ConsistencyViolation[]> {
  const violations: ConsistencyViolation[] = [];

  // Batch 1: Combined recovery event checks (stale + orphaned + stuck) in one query
  try {
    const recoveryViolations = await checkRecoveryEventsBatched(db);
    violations.push(...recoveryViolations);
  } catch (err) {
    logger.warn("[sentinel-data-validator] Error in batched recovery event check", { error: String(err) });
  }

  // Batch 2: Independent checks run in parallel (different tables, no conflicts)
  const [stalledResult, conflictResult, queueResult] = await Promise.allSettled([
    checkStalledLeads(db),
    checkSubscriptionConflicts(db),
    checkJobQueueDepth(db),
  ]);

  if (stalledResult.status === "fulfilled") {
    violations.push(...stalledResult.value);
  } else {
    logger.warn("[sentinel-data-validator] Error checking stalled leads", { error: String(stalledResult.reason) });
  }

  if (conflictResult.status === "fulfilled") {
    violations.push(...conflictResult.value);
  } else {
    logger.warn("[sentinel-data-validator] Error checking subscription conflicts", { error: String(conflictResult.reason) });
  }

  if (queueResult.status === "fulfilled") {
    violations.push(...queueResult.value);
  } else {
    logger.warn("[sentinel-data-validator] Error checking job queue depth", { error: String(queueResult.reason) });
  }

  return violations;
}

// ── Batched Recovery Event Checks ───────────────────────────────────────────

/**
 * Combines stale (7d), orphaned (10min, no log), and stuck (48h, no response)
 * recovery event checks into a single query with conditional aggregation.
 * Reduces 3 separate queries with JOINs to 1.
 */
async function checkRecoveryEventsBatched(db: Db): Promise<ConsistencyViolation[]> {
  const violations: ConsistencyViolation[] = [];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const rows = await db
    .select({
      tenantId: recoveryEvents.tenantId,
      tenantName: tenants.name,
      staleCount: sql<number>`SUM(CASE WHEN ${recoveryEvents.status} = 'sent' AND ${recoveryEvents.updatedAt} < ${sevenDaysAgo} THEN 1 ELSE 0 END)`,
      orphanCount: sql<number>`SUM(CASE WHEN ${recoveryEvents.status} = 'sent' AND ${recoveryEvents.createdAt} < ${tenMinAgo} AND ${automationLogs.id} IS NULL THEN 1 ELSE 0 END)`,
      stuckCount: sql<number>`SUM(CASE WHEN ${recoveryEvents.status} = 'sent' AND ${recoveryEvents.sentAt} < ${fortyEightHoursAgo} AND ${recoveryEvents.respondedAt} IS NULL THEN 1 ELSE 0 END)`,
    })
    .from(recoveryEvents)
    .innerJoin(tenants, eq(tenants.id, recoveryEvents.tenantId))
    .leftJoin(automationLogs, eq(automationLogs.recoveryEventId, recoveryEvents.id))
    .where(eq(recoveryEvents.status, "sent"))
    .groupBy(recoveryEvents.tenantId, tenants.name);

  for (const row of rows) {
    const staleCount = Number(row.staleCount) || 0;
    const orphanCount = Number(row.orphanCount) || 0;
    const stuckCount = Number(row.stuckCount) || 0;

    if (staleCount >= 2) {
      violations.push({
        type: "stale_recovery_events",
        severity: "medium",
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        message: `[DATA_CONSISTENCY] ${staleCount} recovery events stuck in "sent" for >7 days for "${row.tenantName}" — consider expiring`,
        detail: { staleCount, staleDays: 7 },
      });
    }

    if (orphanCount >= 1) {
      violations.push({
        type: "orphaned_recovery_events",
        severity: "high",
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        message: `[ORPHANED_EVENTS] ${orphanCount} recovery event(s) for "${row.tenantName}" stuck in "sent" >10 min with no automation log — job enqueue likely failed`,
        detail: { orphanCount },
      });
    }

    if (stuckCount >= 3) {
      violations.push({
        type: "stuck_recovery_state_machine",
        severity: "medium",
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        message: `[STATE_MACHINE] ${stuckCount} recovery event(s) for "${row.tenantName}" sent >48h ago with no response — possible SMS delivery failure`,
        detail: { stuckCount, windowHours: 48 },
      });
    }
  }

  return violations;
}

// ── Stalled Leads ────────────────────────────────────────────────────────────

async function checkStalledLeads(db: Db): Promise<ConsistencyViolation[]> {
  const violations: ConsistencyViolation[] = [];

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      tenantId: leads.tenantId,
      cnt: count(),
      tenantName: tenants.name,
    })
    .from(leads)
    .innerJoin(tenants, eq(tenants.id, leads.tenantId))
    .where(
      and(
        eq(leads.status, "qualified"),
        lt(leads.updatedAt, cutoff),
      ),
    )
    .groupBy(leads.tenantId, tenants.name);

  for (const row of rows) {
    if (row.cnt >= 1) { // lowered from 3
      violations.push({
        type: "stalled_leads",
        severity: "medium",
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        message: `[DATA_CONSISTENCY] ${row.cnt} qualified lead(s) stuck >14 days for "${row.tenantName}" — pipeline stall detected`,
        detail: { stalledCount: row.cnt, stalledDays: 14 },
      });
    }
  }

  return violations;
}

// ── Subscription State Conflicts ─────────────────────────────────────────────

async function checkSubscriptionConflicts(db: Db): Promise<ConsistencyViolation[]> {
  const violations: ConsistencyViolation[] = [];

  const rows = await db
    .select({
      tenantId: subscriptions.tenantId,
      subId: subscriptions.id,
      status: subscriptions.status,
      trialEndsAt: subscriptions.trialEndsAt,
      tenantName: tenants.name,
    })
    .from(subscriptions)
    .innerJoin(tenants, eq(tenants.id, subscriptions.tenantId))
    .where(
      and(
        eq(subscriptions.status, "active"),
        gt(subscriptions.trialEndsAt, new Date()),
      ),
    )
    .limit(20);

  for (const row of rows) {
    violations.push({
      type: "subscription_state_conflict",
      severity: "low",
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      message: `[DATA_CONSISTENCY] Subscription for "${row.tenantName}" is "active" but trialEndsAt is in the future — state conflict`,
      detail: {
        subscriptionId: row.subId,
        status: row.status,
        trialEndsAt: row.trialEndsAt,
      },
    });
  }

  return violations;
}

// ── Job Queue Depth ──────────────────────────────────────────────────────────

const JOB_QUEUE_MAX = 500;
const JOB_QUEUE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

async function checkJobQueueDepth(db: Db): Promise<ConsistencyViolation[]> {
  const violations: ConsistencyViolation[] = [];

  const rows = await db
    .select({
      tenantId: automationJobs.tenantId,
      tenantName: tenants.name,
      pendingCount: count(),
      oldestCreatedAt: min(automationJobs.createdAt),
    })
    .from(automationJobs)
    .innerJoin(tenants, eq(tenants.id, automationJobs.tenantId))
    .where(eq(automationJobs.status, "pending"))
    .groupBy(automationJobs.tenantId, tenants.name);

  const now = Date.now();

  for (const row of rows) {
    const oldestAgeMs = row.oldestCreatedAt ? now - new Date(row.oldestCreatedAt).getTime() : 0;
    const queueBacklogged = row.pendingCount > JOB_QUEUE_MAX;
    const queueStuck = oldestAgeMs > JOB_QUEUE_MAX_AGE_MS;

    if (queueBacklogged || queueStuck) {
      violations.push({
        type: "job_queue_depth",
        severity: "high",
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        message: `[JOB_QUEUE] ${row.pendingCount} pending job(s) for "${row.tenantName}"${queueStuck ? ` — oldest pending ${Math.round(oldestAgeMs / 60000)} min` : ""}${queueBacklogged ? ` (exceeds ${JOB_QUEUE_MAX} threshold)` : ""}`,
        detail: {
          pendingCount: row.pendingCount,
          oldestCreatedAt: row.oldestCreatedAt,
          oldestAgeMinutes: Math.round(oldestAgeMs / 60000),
          queueBacklogged,
          queueStuck,
        },
      });
    }
  }

  return violations;
}
