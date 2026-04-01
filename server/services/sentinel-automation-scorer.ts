/**
 * Automation Effectiveness Scorer — ranks automations by ROI, detects dead ones.
 *
 * Uses automation_jobs + recovery_events (the tables that exist in production)
 * to compute:
 *  - Runs vs. conversions per automation per tenant
 *  - Dead automations (>20 completed runs, 0 conversions)
 *  - Degrading automations (high failure rate)
 *
 * Runs every 10 sentinel cycles (~10 min).
 * Reports violations to systemErrorLogs with [AUTOMATION_*] prefix.
 */

import { and, eq, gt, isNull, sql, count } from "drizzle-orm";
import { automationJobs, automations, recoveryEvents, tenants } from "../../drizzle/schema";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";

interface AutomationViolation {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  tenantId: number;
  tenantName: string;
  message: string;
  detail: Record<string, unknown>;
}

const DEAD_AUTOMATION_RUN_THRESHOLD = 20;

export async function scoreAutomations(db: Db): Promise<AutomationViolation[]> {
  const violations: AutomationViolation[] = [];

  try {
    const dead = await findDeadAutomations(db);
    violations.push(...dead);
  } catch (err) {
    logger.warn("[sentinel-automation-scorer] Error checking dead automations", { error: String(err) });
  }

  try {
    const failing = await findHighFailureAutomations(db);
    violations.push(...failing);
  } catch (err) {
    logger.warn("[sentinel-automation-scorer] Error checking failing automations", { error: String(err) });
  }

  try {
    const spikes = await findRecentWorkflowFailures(db);
    violations.push(...spikes);
  } catch (err) {
    logger.warn("[sentinel-automation-scorer] Error checking 24h workflow failures", { error: String(err) });
  }

  try {
    const orphaned = await checkOrphanedEventTypes(db);
    violations.push(...orphaned);
  } catch (err) {
    logger.warn("[sentinel-automation-scorer] Error checking orphaned event types", { error: String(err) });
  }

  return violations;
}

// ── Dead Automations ────────────────────────────────────────────────────────

async function findDeadAutomations(db: Db): Promise<AutomationViolation[]> {
  const violations: AutomationViolation[] = [];
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Count completed jobs per automation per tenant
  const runCounts = await db
    .select({
      tenantId: automationJobs.tenantId,
      automationId: automationJobs.automationId,
      runs: count(),
      tenantName: tenants.name,
    })
    .from(automationJobs)
    .innerJoin(tenants, eq(tenants.id, automationJobs.tenantId))
    .where(
      and(
        eq(automationJobs.status, "completed"),
        gt(automationJobs.createdAt, since),
      ),
    )
    .groupBy(automationJobs.tenantId, automationJobs.automationId, tenants.name);

  // Per-automation conversion count from recovery_events
  const conversionCounts = await db
    .select({
      tenantId: recoveryEvents.tenantId,
      automationId: recoveryEvents.automationId,
      conversions: count(),
    })
    .from(recoveryEvents)
    .where(
      and(
        sql`${recoveryEvents.status} IN ('converted', 'realized', 'manual_realized')`,
        gt(recoveryEvents.createdAt, since),
      ),
    )
    .groupBy(recoveryEvents.tenantId, recoveryEvents.automationId);

  const conversionMap = new Map<string, number>();
  for (const row of conversionCounts) {
    if (row.automationId) {
      conversionMap.set(`${row.tenantId}:${row.automationId}`, row.conversions);
    }
  }

  for (const run of runCounts) {
    if (run.runs < DEAD_AUTOMATION_RUN_THRESHOLD) continue;

    const conversions = conversionMap.get(`${run.tenantId}:${run.automationId}`) ?? 0;
    if (conversions > 0) continue;

    violations.push({
      type: "dead_automation",
      severity: "medium",
      tenantId: run.tenantId,
      tenantName: run.tenantName,
      message: `[AUTOMATION_DEAD] automationId=${run.automationId} has ${run.runs} completed runs with 0 conversions for "${run.tenantName}" in 30 days`,
      detail: {
        automationId: run.automationId,
        runs: run.runs,
        conversions: 0,
        periodDays: 30,
      },
    });
  }

  return violations;
}

// ── High Failure Rate Automations (7-day) ─────────────────────────────────────

async function findHighFailureAutomations(db: Db): Promise<AutomationViolation[]> {
  const violations: AutomationViolation[] = [];
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      tenantId: automationJobs.tenantId,
      automationId: automationJobs.automationId,
      total: count(),
      failed: sql<number>`SUM(CASE WHEN ${automationJobs.status} = 'failed' THEN 1 ELSE 0 END)`,
      tenantName: tenants.name,
    })
    .from(automationJobs)
    .innerJoin(tenants, eq(tenants.id, automationJobs.tenantId))
    .where(gt(automationJobs.createdAt, since))
    .groupBy(automationJobs.tenantId, automationJobs.automationId, tenants.name);

  for (const row of rows) {
    if (row.total < 3) continue;

    const failRate = (row.failed || 0) / row.total;

    if (failRate > 0.2) {
      violations.push({
        type: "automation_high_failure",
        severity: "high",
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        message: `[AUTOMATION_DEGRADING] automationId=${row.automationId} has ${Math.round(failRate * 100)}% failure rate for "${row.tenantName}" (${row.failed}/${row.total} in 7d)`,
        detail: {
          automationId: row.automationId,
          total: row.total,
          failed: row.failed,
          failRate: Math.round(failRate * 100),
        },
      });
    }
  }

  return violations;
}

// ── Per-Workflow Error Rate (24h window) ─────────────────────────────────────

async function findRecentWorkflowFailures(db: Db): Promise<AutomationViolation[]> {
  const violations: AutomationViolation[] = [];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      tenantId: automationJobs.tenantId,
      automationId: automationJobs.automationId,
      total: count(),
      failed: sql<number>`SUM(CASE WHEN ${automationJobs.status} = 'failed' THEN 1 ELSE 0 END)`,
      tenantName: tenants.name,
    })
    .from(automationJobs)
    .innerJoin(tenants, eq(tenants.id, automationJobs.tenantId))
    .where(gt(automationJobs.createdAt, since))
    .groupBy(automationJobs.tenantId, automationJobs.automationId, tenants.name);

  for (const row of rows) {
    if (row.total < 3) continue;

    const failRate = (row.failed || 0) / row.total;
    if (failRate > 0.3) {
      violations.push({
        type: "automation_workflow_failure_spike",
        severity: "high",
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        message: `[AUTOMATION_SPIKE] automationId=${row.automationId} has ${Math.round(failRate * 100)}% failure rate for "${row.tenantName}" in last 24h (${row.failed}/${row.total})`,
        detail: {
          automationId: row.automationId,
          total: row.total,
          failed: row.failed,
          failRate: Math.round(failRate * 100),
          windowHours: 24,
        },
      });
    }
  }

  return violations;
}

// ── Orphaned Event Types ──────────────────────────────────────────────────────

async function checkOrphanedEventTypes(db: Db): Promise<AutomationViolation[]> {
  const violations: AutomationViolation[] = [];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find pending jobs whose automation no longer exists (deleted/disabled)
  const rows = await db
    .select({
      tenantId: automationJobs.tenantId,
      tenantName: tenants.name,
      eventType: automationJobs.eventType,
      orphanCount: count(),
    })
    .from(automationJobs)
    .innerJoin(tenants, eq(tenants.id, automationJobs.tenantId))
    .leftJoin(automations, eq(automations.id, automationJobs.automationId))
    .where(
      and(
        eq(automationJobs.status, "pending"),
        gt(automationJobs.createdAt, since),
        isNull(automations.id),
      ),
    )
    .groupBy(automationJobs.tenantId, tenants.name, automationJobs.eventType);

  for (const row of rows) {
    violations.push({
      type: "unmapped_event_type",
      severity: "medium",
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      message: `[ORPHANED_JOBS] ${row.orphanCount} pending job(s) for event "${row.eventType}" in "${row.tenantName}" have no matching automation (deleted or disabled)`,
      detail: {
        eventType: row.eventType,
        orphanCount: row.orphanCount,
        windowHours: 24,
      },
    });
  }

  return violations;
}
