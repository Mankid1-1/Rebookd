/**
 * n8n Analytics Service
 *
 * Provides aggregated metrics for n8n workflow executions:
 * - Execution counts, success rates, avg durations by workflow
 * - n8n vs built-in engine comparison
 * - Per-workflow ROI attribution via recovery_events
 */

import { sql, eq, and, gte, lte, like, count, avg, sum } from "drizzle-orm";
import { automationLogs, recoveryEvents } from "../../drizzle/schema";
import type { Db } from "../_core/context";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface N8nExecutionMetrics {
  totalExecutions: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  tcpaBlockedCount: number;
  avgDurationMs: number;
  byWorkflow: Array<{
    workflowKey: string;
    total: number;
    success: number;
    failed: number;
    avgDurationMs: number;
    lastExecutedAt: string | null;
  }>;
}

export interface N8nComparisonMetrics {
  n8n: { total: number; success: number; failed: number; avgDurationMs: number };
  builtIn: { total: number; success: number; failed: number; avgDurationMs: number };
}

export interface WorkflowRoiMetrics {
  workflowKey: string;
  leadsContacted: number;
  leadsRecovered: number;
  conversionRate: number;
  estimatedRevenue: number;
  realizedRevenue: number;
}

/**
 * Get aggregated n8n execution metrics for a tenant.
 */
export async function getN8nExecutionMetrics(
  db: Db,
  tenantId: number,
  dateRange: DateRange,
): Promise<N8nExecutionMetrics> {
  // Overall counts
  const rows = await (db as any)
    .select({
      status: automationLogs.status,
      cnt: sql<number>`COUNT(*)`,
      avgDur: sql<number>`AVG(${automationLogs.durationMs})`,
    })
    .from(automationLogs)
    .where(
      and(
        eq(automationLogs.tenantId, tenantId),
        like(automationLogs.automationKey, "n8n:%"),
        gte(automationLogs.createdAt, dateRange.from),
        lte(automationLogs.createdAt, dateRange.to),
      ),
    )
    .groupBy(automationLogs.status);

  const statusMap = new Map<string, { cnt: number; avgDur: number }>();
  let totalExecutions = 0;
  let totalDurSum = 0;
  let totalDurCount = 0;

  for (const row of rows) {
    statusMap.set(row.status, { cnt: Number(row.cnt), avgDur: Number(row.avgDur) || 0 });
    totalExecutions += Number(row.cnt);
    if (row.avgDur) {
      totalDurSum += Number(row.avgDur) * Number(row.cnt);
      totalDurCount += Number(row.cnt);
    }
  }

  // Per-workflow breakdown
  const byWorkflowRows = await (db as any)
    .select({
      automationKey: automationLogs.automationKey,
      status: automationLogs.status,
      cnt: sql<number>`COUNT(*)`,
      avgDur: sql<number>`AVG(${automationLogs.durationMs})`,
      lastExec: sql<string>`MAX(${automationLogs.createdAt})`,
    })
    .from(automationLogs)
    .where(
      and(
        eq(automationLogs.tenantId, tenantId),
        like(automationLogs.automationKey, "n8n:%"),
        gte(automationLogs.createdAt, dateRange.from),
        lte(automationLogs.createdAt, dateRange.to),
      ),
    )
    .groupBy(automationLogs.automationKey, automationLogs.status);

  // Aggregate per workflow
  const workflowMap = new Map<string, any>();
  for (const row of byWorkflowRows) {
    const key = (row.automationKey as string).replace("n8n:", "");
    if (!workflowMap.has(key)) {
      workflowMap.set(key, { workflowKey: key, total: 0, success: 0, failed: 0, avgDurationMs: 0, lastExecutedAt: null });
    }
    const wf = workflowMap.get(key)!;
    const cnt = Number(row.cnt);
    wf.total += cnt;
    if (row.status === "completed" || row.status === "success") wf.success += cnt;
    if (row.status === "failed") wf.failed += cnt;
    if (row.avgDur) wf.avgDurationMs = Number(row.avgDur);
    if (row.lastExec && (!wf.lastExecutedAt || row.lastExec > wf.lastExecutedAt)) {
      wf.lastExecutedAt = row.lastExec;
    }
  }

  return {
    totalExecutions,
    successCount: statusMap.get("completed")?.cnt ?? statusMap.get("success")?.cnt ?? 0,
    failedCount: statusMap.get("failed")?.cnt ?? 0,
    skippedCount: statusMap.get("skipped")?.cnt ?? 0,
    tcpaBlockedCount: statusMap.get("tcpa_blocked")?.cnt ?? 0,
    avgDurationMs: totalDurCount > 0 ? Math.round(totalDurSum / totalDurCount) : 0,
    byWorkflow: [...workflowMap.values()],
  };
}

/**
 * Compare n8n-handled vs built-in engine executions.
 */
export async function getN8nVsBuiltInComparison(
  db: Db,
  tenantId: number,
  dateRange: DateRange,
): Promise<N8nComparisonMetrics> {
  const allRows = await (db as any)
    .select({
      isN8n: sql<boolean>`${automationLogs.automationKey} LIKE 'n8n:%'`,
      status: automationLogs.status,
      cnt: sql<number>`COUNT(*)`,
      avgDur: sql<number>`AVG(${automationLogs.durationMs})`,
    })
    .from(automationLogs)
    .where(
      and(
        eq(automationLogs.tenantId, tenantId),
        gte(automationLogs.createdAt, dateRange.from),
        lte(automationLogs.createdAt, dateRange.to),
      ),
    )
    .groupBy(sql`${automationLogs.automationKey} LIKE 'n8n:%'`, automationLogs.status);

  const n8n = { total: 0, success: 0, failed: 0, avgDurationMs: 0 };
  const builtIn = { total: 0, success: 0, failed: 0, avgDurationMs: 0 };

  for (const row of allRows) {
    const target = row.isN8n ? n8n : builtIn;
    const cnt = Number(row.cnt);
    target.total += cnt;
    if (row.status === "completed" || row.status === "success") target.success += cnt;
    if (row.status === "failed") target.failed += cnt;
    if (row.avgDur) target.avgDurationMs = Number(row.avgDur);
  }

  return { n8n, builtIn };
}

/**
 * Per-workflow ROI attribution via recovery_events.
 */
export async function getPerWorkflowRoi(
  db: Db,
  tenantId: number,
  dateRange: DateRange,
): Promise<WorkflowRoiMetrics[]> {
  // Join automation_logs with recovery_events for n8n workflows
  const rows = await (db as any).execute(sql`
    SELECT
      al.automationKey,
      COUNT(DISTINCT CASE WHEN al.status IN ('completed', 'success') THEN al.leadId END) as leadsContacted,
      COUNT(DISTINCT CASE WHEN re.status = 'recovered' THEN re.leadId END) as leadsRecovered,
      COALESCE(SUM(re.estimatedRevenue), 0) as estimatedRevenue,
      COALESCE(SUM(re.realizedRevenue), 0) as realizedRevenue
    FROM automation_logs al
    LEFT JOIN recovery_events re ON re.tenantId = al.tenantId AND re.leadId = al.leadId
      AND re.createdAt >= ${dateRange.from} AND re.createdAt <= ${dateRange.to}
    WHERE al.tenantId = ${tenantId}
      AND al.automationKey LIKE 'n8n:%'
      AND al.createdAt >= ${dateRange.from}
      AND al.createdAt <= ${dateRange.to}
    GROUP BY al.automationKey
    ORDER BY realizedRevenue DESC
  `);

  const results: WorkflowRoiMetrics[] = [];
  const data = rows[0] ?? rows;

  for (const row of (Array.isArray(data) ? data : [])) {
    const contacted = Number(row.leadsContacted) || 0;
    const recovered = Number(row.leadsRecovered) || 0;
    results.push({
      workflowKey: (row.automationKey as string).replace("n8n:", ""),
      leadsContacted: contacted,
      leadsRecovered: recovered,
      conversionRate: contacted > 0 ? recovered / contacted : 0,
      estimatedRevenue: Number(row.estimatedRevenue) || 0,
      realizedRevenue: Number(row.realizedRevenue) || 0,
    });
  }

  return results;
}
