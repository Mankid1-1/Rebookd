/**
 * A/B Testing Service for AI SMS Experiments
 * Deterministic variant assignment and result tracking for comparing
 * AI-generated vs template-based SMS performance.
 */

import { eq, and, sql } from "drizzle-orm";
import { aiSmsExperiments, aiSmsResults } from "../../drizzle/schema";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";

// ─── Types ──────────────────────────────────────────────────────────────────

export type Variant = "ai" | "template";
export type GenerationMethod = "llm" | "template_fallback";

export interface ExperimentAggregation {
  experimentId: number;
  variant: Variant;
  total: number;
  replied: number;
  converted: number;
  replyRate: number;
  conversionRate: number;
  avgLatencyMs: number | null;
}

// ─── Variant Assignment ─────────────────────────────────────────────────────

/**
 * Deterministically assigns a variant for a given lead within an active
 * experiment. Uses `leadId % 100` to produce a stable bucket — the same
 * lead always gets the same variant for a given experiment.
 *
 * Returns 'template' when no active experiment exists (safe default).
 */
export async function getVariantForLead(
  db: Db,
  tenantId: number,
  automationKey: string,
  leadId: number,
): Promise<Variant> {
  const [experiment] = await db
    .select({
      id: aiSmsExperiments.id,
      trafficPercent: aiSmsExperiments.trafficPercent,
    })
    .from(aiSmsExperiments)
    .where(
      and(
        eq(aiSmsExperiments.tenantId, tenantId),
        eq(aiSmsExperiments.automationKey, automationKey),
        eq(aiSmsExperiments.status, "running"),
      ),
    )
    .limit(1);

  if (!experiment) {
    return "template";
  }

  // Deterministic bucket: leadId % 100 gives a 0-99 value
  const bucket = leadId % 100;
  return bucket < experiment.trafficPercent ? "ai" : "template";
}

// ─── Result Recording ───────────────────────────────────────────────────────

/**
 * Records the outcome of sending a message during an experiment so that
 * reply rates and conversion rates can be aggregated per variant.
 */
export async function recordResult(
  db: Db,
  experimentId: number,
  tenantId: number,
  leadId: number,
  messageId: number,
  variant: Variant,
  method: GenerationMethod,
  latencyMs?: number,
  promptTokens?: number,
  completionTokens?: number,
): Promise<void> {
  await db.insert(aiSmsResults).values({
    experimentId,
    tenantId,
    leadId,
    messageId,
    variant,
    generationMethod: method,
    latencyMs: latencyMs ?? null,
    promptTokens: promptTokens ?? null,
    completionTokens: completionTokens ?? null,
    replied: false,
    converted: false,
  });

  logger.info("AB test result recorded", {
    experimentId,
    tenantId,
    leadId,
    variant,
    method,
  });
}

// ─── Experiment Results Aggregation ─────────────────────────────────────────

/**
 * Aggregates experiment results grouped by variant, returning counts,
 * reply rates, conversion rates, and average latency for each arm.
 */
export async function getExperimentResults(
  db: Db,
  experimentId: number,
): Promise<ExperimentAggregation[]> {
  const rows = await db
    .select({
      variant: aiSmsResults.variant,
      total: sql<number>`COUNT(*)`.as("total"),
      replied: sql<number>`SUM(CASE WHEN ${aiSmsResults.replied} = 1 THEN 1 ELSE 0 END)`.as("replied"),
      converted: sql<number>`SUM(CASE WHEN ${aiSmsResults.converted} = 1 THEN 1 ELSE 0 END)`.as("converted"),
      avgLatencyMs: sql<number | null>`AVG(${aiSmsResults.latencyMs})`.as("avgLatencyMs"),
    })
    .from(aiSmsResults)
    .where(eq(aiSmsResults.experimentId, experimentId))
    .groupBy(aiSmsResults.variant);

  return rows.map((row) => ({
    experimentId,
    variant: row.variant as Variant,
    total: Number(row.total),
    replied: Number(row.replied ?? 0),
    converted: Number(row.converted ?? 0),
    replyRate: row.total > 0 ? Number(row.replied ?? 0) / Number(row.total) : 0,
    conversionRate: row.total > 0 ? Number(row.converted ?? 0) / Number(row.total) : 0,
    avgLatencyMs: row.avgLatencyMs != null ? Math.round(Number(row.avgLatencyMs)) : null,
  }));
}

// ─── Lookup Helper ──────────────────────────────────────────────────────────

/**
 * Finds the active experiment for a given tenant + automationKey,
 * returning the experiment ID or null if none is running.
 */
export async function getActiveExperimentId(
  db: Db,
  tenantId: number,
  automationKey: string,
): Promise<number | null> {
  const [experiment] = await db
    .select({ id: aiSmsExperiments.id })
    .from(aiSmsExperiments)
    .where(
      and(
        eq(aiSmsExperiments.tenantId, tenantId),
        eq(aiSmsExperiments.automationKey, automationKey),
        eq(aiSmsExperiments.status, "running"),
      ),
    )
    .limit(1);

  return experiment?.id ?? null;
}
