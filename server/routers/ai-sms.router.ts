/**
 * AI SMS Router
 * tRPC routes for AI-powered SMS generation, A/B experiment management,
 * and usage analytics.
 */

import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../_core/trpc";
import { aiSmsExperiments, aiSmsResults } from "../../drizzle/schema";
import { generateAiMessage } from "../services/ai-sms-generator.service";
import { getExperimentResults } from "../services/ab-testing.service";
import type { MessageType, Tone } from "../_core/messageTemplates";

// ─── Shared Zod Schemas ─────────────────────────────────────────────────────

const toneSchema = z.enum(["friendly", "professional", "casual", "urgent", "empathetic"]);

const messageTypeSchema = z.enum([
  "confirmation",
  "cancellation",
  "rebooking",
  "reminder",
  "no_show",
  "follow_up",
  "after_hours",
  "lead_capture",
  "retention_rebooking",
  "loyalty_reward",
  "reactivation",
  "card_on_file",
  "deposit_request",
  "cancellation_fee",
  "no_show_penalty",
  "payment_reminder",
  "gap_fill",
  "off_peak_offer",
  "reschedule",
  "generic",
]);

const experimentStatusSchema = z.enum(["draft", "running", "paused", "completed"]);

// ─── Router ─────────────────────────────────────────────────────────────────

export const aiSmsRouter = router({
  /**
   * Generate an AI preview message without sending it.
   * Useful for the front-end preview panel.
   */
  preview: tenantProcedure
    .input(
      z.object({
        messageType: messageTypeSchema,
        tone: toneSchema.default("friendly"),
        leadId: z.number().int().positive().optional(),
        variables: z
          .record(z.string(), z.unknown())
          .optional()
          .default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Require a lead for context-aware generation
      if (!input.leadId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "leadId is required for AI SMS preview",
        });
      }

      const result = await generateAiMessage(
        ctx.db,
        ctx.tenantId,
        input.leadId,
        input.messageType as MessageType,
        input.tone as Tone,
        input.variables as Record<string, unknown>,
      );

      return result;
    }),

  /**
   * List all experiments for the current tenant.
   */
  listExperiments: tenantProcedure.query(async ({ ctx }) => {
    const experiments = await ctx.db
      .select()
      .from(aiSmsExperiments)
      .where(eq(aiSmsExperiments.tenantId, ctx.tenantId))
      .orderBy(desc(aiSmsExperiments.createdAt));

    return experiments;
  }),

  /**
   * Create a new A/B experiment.
   */
  createExperiment: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        automationKey: z.string().min(1).max(100),
        trafficPercent: z.number().int().min(1).max(100).default(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check for existing running experiment on same automation key
      const [existing] = await ctx.db
        .select({ id: aiSmsExperiments.id })
        .from(aiSmsExperiments)
        .where(
          and(
            eq(aiSmsExperiments.tenantId, ctx.tenantId),
            eq(aiSmsExperiments.automationKey, input.automationKey),
            eq(aiSmsExperiments.status, "running"),
          ),
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `An experiment is already running for automation "${input.automationKey}". Stop it before creating a new one.`,
        });
      }

      const [inserted] = await ctx.db.insert(aiSmsExperiments).values({
        tenantId: ctx.tenantId,
        name: input.name,
        automationKey: input.automationKey,
        trafficPercent: input.trafficPercent,
        status: "draft",
      });

      return { id: Number(inserted.insertId), status: "draft" as const };
    }),

  /**
   * Update an experiment's status or traffic percentage.
   */
  updateExperiment: tenantProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: experimentStatusSchema.optional(),
        trafficPercent: z.number().int().min(1).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify experiment belongs to tenant
      const [experiment] = await ctx.db
        .select()
        .from(aiSmsExperiments)
        .where(
          and(
            eq(aiSmsExperiments.id, input.id),
            eq(aiSmsExperiments.tenantId, ctx.tenantId),
          ),
        )
        .limit(1);

      if (!experiment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Experiment not found",
        });
      }

      const updates: Record<string, unknown> = {};

      if (input.status !== undefined) {
        updates.status = input.status;

        // Set timestamps based on status transitions
        if (input.status === "running" && experiment.status !== "running") {
          updates.startedAt = new Date();
        }
        if (
          (input.status === "completed" || input.status === "paused") &&
          experiment.status === "running"
        ) {
          updates.endedAt = new Date();
        }
      }

      if (input.trafficPercent !== undefined) {
        updates.trafficPercent = input.trafficPercent;
      }

      if (Object.keys(updates).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No fields to update",
        });
      }

      await ctx.db
        .update(aiSmsExperiments)
        .set(updates)
        .where(eq(aiSmsExperiments.id, input.id));

      return { id: input.id, ...updates };
    }),

  /**
   * Get aggregated results for an experiment.
   */
  getResults: tenantProcedure
    .input(
      z.object({
        experimentId: z.number().int().positive(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify experiment belongs to tenant
      const [experiment] = await ctx.db
        .select({ id: aiSmsExperiments.id, name: aiSmsExperiments.name })
        .from(aiSmsExperiments)
        .where(
          and(
            eq(aiSmsExperiments.id, input.experimentId),
            eq(aiSmsExperiments.tenantId, ctx.tenantId),
          ),
        )
        .limit(1);

      if (!experiment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Experiment not found",
        });
      }

      const results = await getExperimentResults(ctx.db, input.experimentId);

      return {
        experiment,
        variants: results,
      };
    }),

  /**
   * Usage statistics: token consumption, fallback rate, average latency.
   */
  usageStats: tenantProcedure.query(async ({ ctx }) => {
    const [stats] = await ctx.db
      .select({
        totalMessages: sql<number>`COUNT(*)`.as("totalMessages"),
        llmMessages: sql<number>`SUM(CASE WHEN ${aiSmsResults.generationMethod} = 'llm' THEN 1 ELSE 0 END)`.as("llmMessages"),
        fallbackMessages: sql<number>`SUM(CASE WHEN ${aiSmsResults.generationMethod} = 'template_fallback' THEN 1 ELSE 0 END)`.as("fallbackMessages"),
        totalPromptTokens: sql<number>`COALESCE(SUM(${aiSmsResults.promptTokens}), 0)`.as("totalPromptTokens"),
        totalCompletionTokens: sql<number>`COALESCE(SUM(${aiSmsResults.completionTokens}), 0)`.as("totalCompletionTokens"),
        avgLatencyMs: sql<number | null>`AVG(${aiSmsResults.latencyMs})`.as("avgLatencyMs"),
      })
      .from(aiSmsResults)
      .where(eq(aiSmsResults.tenantId, ctx.tenantId));

    const total = Number(stats?.totalMessages ?? 0);
    const llm = Number(stats?.llmMessages ?? 0);
    const fallback = Number(stats?.fallbackMessages ?? 0);

    return {
      totalMessages: total,
      llmMessages: llm,
      fallbackMessages: fallback,
      fallbackRate: total > 0 ? fallback / total : 0,
      totalPromptTokens: Number(stats?.totalPromptTokens ?? 0),
      totalCompletionTokens: Number(stats?.totalCompletionTokens ?? 0),
      avgLatencyMs: stats?.avgLatencyMs != null ? Math.round(Number(stats.avgLatencyMs)) : null,
    };
  }),
});
