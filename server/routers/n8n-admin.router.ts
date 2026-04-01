/**
 * n8n Admin Router
 *
 * Admin-only endpoints for managing n8n workflows, viewing execution history,
 * managing the dead letter queue, and monitoring system health.
 *
 * All endpoints require admin authentication via adminProcedure.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { automationLogs, n8nDeadLetterQueue, n8nWorkflowSync } from "../../drizzle/schema";
import { eq, and, like, gte, lte, desc, sql, count } from "drizzle-orm";
import {
  syncWorkflowRegistry,
  fetchN8nWorkflows,
  activateN8nWorkflow,
  deactivateN8nWorkflow,
  getWorkflowExecutions,
  getExecutionDetail,
  checkN8nAdminApi,
} from "../services/n8n-workflow-sync.service";
import {
  getN8nExecutionMetrics,
  getN8nVsBuiltInComparison,
  getPerWorkflowRoi,
} from "../services/n8n-analytics.service";
import {
  getCircuitBreakerState,
  getEventWebhookMap,
  dispatchToN8n,
  reprocessDeadLetterQueue,
} from "../services/n8n-bridge.service";
import { logger } from "../_core/logger";

export const n8nAdminRouter = router({
  // ─── Workflow Management ───────────────────────────────────────────────────

  /**
   * List all workflows: merged view of Rebooked registry + n8n actual state.
   */
  listWorkflows: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    // Return cached sync data from DB (fast)
    const syncRecords = await (db as any)
      .select()
      .from(n8nWorkflowSync)
      .orderBy(n8nWorkflowSync.workflowKey);

    return syncRecords.map((r: any) => ({
      workflowKey: r.workflowKey,
      n8nWorkflowId: r.n8nWorkflowId,
      n8nActive: r.n8nActive,
      syncStatus: r.syncStatus,
      lastSyncAt: r.lastSyncAt,
      metadata: r.metadata,
    }));
  }),

  /**
   * Trigger full sync of all workflows.
   */
  syncAll: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const results = await syncWorkflowRegistry(db);
    return {
      success: true,
      total: results.length,
      synced: results.filter((r) => r.syncStatus === "synced").length,
      missing: results.filter((r) => r.syncStatus === "missing_in_n8n").length,
      unknown: results.filter((r) => r.syncStatus === "unknown_in_rebooked").length,
      workflows: results,
    };
  }),

  /**
   * Activate a workflow in n8n.
   */
  activateWorkflow: adminProcedure
    .input(z.object({ n8nWorkflowId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await activateN8nWorkflow(input.n8nWorkflowId);
      return { success: true, active: result.active, name: result.name };
    }),

  /**
   * Deactivate a workflow in n8n.
   */
  deactivateWorkflow: adminProcedure
    .input(z.object({ n8nWorkflowId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await deactivateN8nWorkflow(input.n8nWorkflowId);
      return { success: true, active: result.active, name: result.name };
    }),

  // ─── Execution History ─────────────────────────────────────────────────────

  /**
   * Get n8n execution history from Rebooked's automation_logs.
   */
  getExecutionHistory: adminProcedure
    .input(
      z.object({
        workflowKey: z.string().optional(),
        status: z.enum(["completed", "failed", "skipped", "tcpa_blocked", "started"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const conditions = [like(automationLogs.automationKey, "n8n:%")];
      if (input.workflowKey) {
        conditions.push(eq(automationLogs.automationKey, `n8n:${input.workflowKey}`));
      }
      if (input.status) {
        conditions.push(eq(automationLogs.status, input.status));
      }

      const rows = await (db as any)
        .select()
        .from(automationLogs)
        .where(and(...conditions))
        .orderBy(desc(automationLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Get total count
      const [countResult] = await (db as any)
        .select({ total: sql<number>`COUNT(*)` })
        .from(automationLogs)
        .where(and(...conditions));

      return {
        executions: rows.map((r: any) => ({
          id: r.id,
          tenantId: r.tenantId,
          leadId: r.leadId,
          workflowKey: (r.automationKey as string).replace("n8n:", ""),
          eventType: r.eventType,
          stepType: r.stepType,
          status: r.status,
          durationMs: r.durationMs,
          errorMessage: r.errorMessage,
          metadata: r.metadata,
          createdAt: r.createdAt,
        })),
        total: Number(countResult?.total ?? 0),
      };
    }),

  /**
   * Get execution detail from n8n API.
   */
  getN8nExecutionDetail: adminProcedure
    .input(z.object({ executionId: z.string() }))
    .query(async ({ input }) => {
      return await getExecutionDetail(input.executionId);
    }),

  // ─── Metrics & Analytics ───────────────────────────────────────────────────

  /**
   * Aggregated execution metrics per tenant.
   */
  getExecutionMetrics: adminProcedure
    .input(
      z.object({
        tenantId: z.number().optional(),
        from: z.string().optional(), // ISO date
        to: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const from = input.from ? new Date(input.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = input.to ? new Date(input.to) : new Date();

      // If tenantId provided, get per-tenant metrics
      if (input.tenantId) {
        return await getN8nExecutionMetrics(db, input.tenantId, { from, to });
      }

      // Platform-wide metrics (admin overview)
      const rows = await (db as any)
        .select({
          status: automationLogs.status,
          cnt: sql<number>`COUNT(*)`,
          avgDur: sql<number>`AVG(${automationLogs.durationMs})`,
        })
        .from(automationLogs)
        .where(
          and(
            like(automationLogs.automationKey, "n8n:%"),
            gte(automationLogs.createdAt, from),
            lte(automationLogs.createdAt, to),
          ),
        )
        .groupBy(automationLogs.status);

      let total = 0;
      let success = 0;
      let failed = 0;
      for (const row of rows) {
        const cnt = Number(row.cnt);
        total += cnt;
        if (row.status === "completed" || row.status === "success") success += cnt;
        if (row.status === "failed") failed += cnt;
      }

      return { totalExecutions: total, successCount: success, failedCount: failed, successRate: total > 0 ? success / total : 0 };
    }),

  /**
   * n8n vs built-in comparison.
   */
  getComparison: adminProcedure
    .input(
      z.object({
        tenantId: z.number(),
        from: z.string().optional(),
        to: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      return await getN8nVsBuiltInComparison(db, input.tenantId, {
        from: input.from ? new Date(input.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: input.to ? new Date(input.to) : new Date(),
      });
    }),

  /**
   * Per-workflow ROI attribution.
   */
  getWorkflowRoi: adminProcedure
    .input(
      z.object({
        tenantId: z.number(),
        from: z.string().optional(),
        to: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      return await getPerWorkflowRoi(db, input.tenantId, {
        from: input.from ? new Date(input.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: input.to ? new Date(input.to) : new Date(),
      });
    }),

  // ─── Dead Letter Queue ─────────────────────────────────────────────────────

  /**
   * List DLQ entries with pagination.
   */
  getDlqEntries: adminProcedure
    .input(
      z.object({
        status: z.enum(["pending", "reprocessing", "succeeded", "exhausted"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const conditions = [];
      if (input.status) {
        conditions.push(eq(n8nDeadLetterQueue.status, input.status));
      }

      const rows = await (db as any)
        .select()
        .from(n8nDeadLetterQueue)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(n8nDeadLetterQueue.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await (db as any)
        .select({ total: sql<number>`COUNT(*)` })
        .from(n8nDeadLetterQueue)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return {
        entries: rows,
        total: Number(countResult?.total ?? 0),
      };
    }),

  /**
   * Retry a specific DLQ entry.
   */
  retryDlqEntry: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [entry] = await (db as any)
        .select()
        .from(n8nDeadLetterQueue)
        .where(eq(n8nDeadLetterQueue.id, input.id))
        .limit(1);

      if (!entry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "DLQ entry not found" });
      }

      // Attempt re-dispatch
      const event = entry.payload;
      const handled = await dispatchToN8n(event as any, true);

      if (handled) {
        await (db as any)
          .update(n8nDeadLetterQueue)
          .set({ status: "succeeded", attempts: entry.attempts + 1, lastAttemptAt: new Date() })
          .where(eq(n8nDeadLetterQueue.id, input.id));
        return { success: true, message: "Event re-dispatched successfully" };
      }

      await (db as any)
        .update(n8nDeadLetterQueue)
        .set({ attempts: entry.attempts + 1, lastAttemptAt: new Date() })
        .where(eq(n8nDeadLetterQueue.id, input.id));

      return { success: false, message: "Re-dispatch failed — n8n may be unavailable" };
    }),

  /**
   * Discard a DLQ entry (mark as exhausted).
   */
  discardDlqEntry: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await (db as any)
        .update(n8nDeadLetterQueue)
        .set({ status: "exhausted" })
        .where(eq(n8nDeadLetterQueue.id, input.id));

      return { success: true };
    }),

  /**
   * Trigger DLQ reprocessing manually.
   */
  reprocessDlq: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const processed = await reprocessDeadLetterQueue(db, 20);
    return { success: true, processed };
  }),

  // ─── Health & Monitoring ───────────────────────────────────────────────────

  /**
   * Get circuit breaker state and other health info.
   */
  getHealth: adminProcedure.query(async () => {
    const db = await getDb();
    const adminApiAccessible = await checkN8nAdminApi();

    let dlqPendingCount = 0;
    if (db) {
      const [result] = await (db as any)
        .select({ cnt: sql<number>`COUNT(*)` })
        .from(n8nDeadLetterQueue)
        .where(eq(n8nDeadLetterQueue.status, "pending"));
      dlqPendingCount = Number(result?.cnt ?? 0);
    }

    return {
      circuitBreaker: getCircuitBreakerState(),
      adminApiAccessible,
      dlqPendingCount,
      eventWebhookMap: getEventWebhookMap(),
    };
  }),

  /**
   * Manually trigger a workflow with test data (admin only).
   */
  triggerWorkflow: adminProcedure
    .input(
      z.object({
        eventType: z.string(),
        tenantId: z.number(),
        leadId: z.number().optional(),
        data: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { nanoid } = await import("nanoid");
      const { emitEvent } = await import("../services/event-bus.service");

      await emitEvent({
        id: nanoid(),
        type: input.eventType,
        tenantId: input.tenantId,
        leadId: input.leadId,
        data: input.data ?? {},
      } as any);

      return { success: true, eventType: input.eventType };
    }),
});
