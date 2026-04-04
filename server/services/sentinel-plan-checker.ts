/**
 * Sentinel Plan Checker — validates billing/gating consistency.
 *
 * Runs during sentinel's poll cycle to detect:
 *  - Founder accounts being charged (should be free)
 *  - Features incorrectly gated during soft launch (everything should be open)
 *  - ROI guarantee not active when it should be
 *  - Expired trials not transitioned
 *
 * All checks use batch queries (JOINs) to avoid N+1 performance issues.
 * Reports inconsistencies to systemErrorLogs so sentinel can auto-repair.
 */

import { eq, and, sql, lt } from "drizzle-orm";
import { tenants, subscriptions, featureConfigs } from "../../drizzle/schema";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";

// ── Business Rules ───────────────────────────────────────────────────────────

const SOFT_LAUNCH_ACTIVE = process.env.SOFT_LAUNCH_ACTIVE !== "false";

interface PlanViolation {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  tenantId: number;
  tenantName: string;
  billingType: string;
  message: string;
  detail: Record<string, unknown>;
}

// ── Main Checker ─────────────────────────────────────────────────────────────

export async function checkPlanConsistency(db: Db): Promise<PlanViolation[]> {
  const violations: PlanViolation[] = [];

  try {
    const founderViolations = await checkFounderAccounts(db);
    violations.push(...founderViolations);

    if (SOFT_LAUNCH_ACTIVE) {
      const gatingViolations = await checkSoftLaunchGating(db);
      violations.push(...gatingViolations);
    }

    const roiViolations = await checkRoiGuarantees(db);
    violations.push(...roiViolations);

    const trialViolations = await checkExpiredTrials(db);
    violations.push(...trialViolations);
  } catch (err) {
    logger.warn("[sentinel-plan-checker] Error during plan consistency check", {
      error: String(err),
    });
  }

  return violations;
}

// ── Founder Account Checks (single JOIN query) ──────────────────────────────

async function checkFounderAccounts(db: Db): Promise<PlanViolation[]> {
  const violations: PlanViolation[] = [];

  try {
    // Single query: JOIN founder tenants with their active paid subscriptions
    const rows = await db
      .select({
        tenantId: tenants.id,
        tenantName: tenants.name,
        billingType: tenants.billingType,
        subId: subscriptions.id,
        customMonthlyPrice: subscriptions.customMonthlyPrice,
        isPromotional: subscriptions.isPromotional,
      })
      .from(tenants)
      .innerJoin(subscriptions, eq(subscriptions.tenantId, tenants.id))
      .where(
        and(
          eq(tenants.billingType, "founder"),
          eq(tenants.active, true),
          eq(subscriptions.status, "active"),
        ),
      );

    for (const row of rows) {
      if (row.customMonthlyPrice && row.customMonthlyPrice > 0 && !row.isPromotional) {
        violations.push({
          type: "founder_charged",
          severity: "critical",
          tenantId: row.tenantId,
          tenantName: row.tenantName,
          billingType: row.billingType,
          message: `[PLAN_VIOLATION] Founder account "${row.tenantName}" has monthly charge of $${(row.customMonthlyPrice / 100).toFixed(2)} — should be free`,
          detail: {
            subscriptionId: row.subId,
            customMonthlyPrice: row.customMonthlyPrice,
            isPromotional: row.isPromotional,
          },
        });
      }
    }
  } catch (err) {
    logger.warn("[sentinel-plan-checker] Error checking founder accounts", { error: String(err) });
  }

  return violations;
}

// ── Soft Launch Gating Checks ────────────────────────────────────────────────

async function checkSoftLaunchGating(db: Db): Promise<PlanViolation[]> {
  const violations: PlanViolation[] = [];

  try {
    const disabledConfigs = await db
      .select()
      .from(featureConfigs)
      .where(
        and(
          sql`${featureConfigs.feature} LIKE 'sentinel_disabled_%'`,
          eq(featureConfigs.enabled, false),
        ),
      );

    for (const config of disabledConfigs) {
      const featureName = config.feature.replace("sentinel_disabled_", "");
      const isGatingFeature = ["billing", "plans", "subscription", "checkout"].some(
        (k) => featureName.includes(k),
      );

      if (isGatingFeature) {
        violations.push({
          type: "soft_launch_gated",
          severity: "high",
          tenantId: config.tenantId || 0,
          tenantName: "platform",
          billingType: "system",
          message: `[PLAN_VIOLATION] Feature "${featureName}" is disabled during soft launch — all features should be accessible`,
          detail: {
            configId: config.id,
            feature: config.feature,
            tenantId: config.tenantId,
            reason: "Soft launch is active, billing features should not be gated",
          },
        });
      }
    }
  } catch (err) {
    logger.warn("[sentinel-plan-checker] Error checking soft launch gating", { error: String(err) });
  }

  return violations;
}

// ── ROI Guarantee Checks (single JOIN query) ─────────────────────────────────

async function checkRoiGuarantees(db: Db): Promise<PlanViolation[]> {
  const violations: PlanViolation[] = [];

  try {
    // Single query: JOIN active subscriptions with their tenant info
    const rows = await db
      .select({
        subId: subscriptions.id,
        tenantId: subscriptions.tenantId,
        guaranteeStatus: subscriptions.guaranteeStatus,
        guaranteeExpiresAt: subscriptions.guaranteeExpiresAt,
        isPromotional: subscriptions.isPromotional,
        subCreatedAt: subscriptions.createdAt,
        tenantName: tenants.name,
        billingType: tenants.billingType,
      })
      .from(subscriptions)
      .innerJoin(tenants, eq(tenants.id, subscriptions.tenantId))
      .where(eq(subscriptions.status, "active"));

    for (const row of rows) {
      // During soft launch, every active subscription should have a guarantee
      // Skip admin/system/internal accounts — they don't need ROI guarantees
      const isInternalAccount =
        !row.billingType                                       // not yet onboarded (internal/admin)
        || (row.billingType as string) === "admin"
        || (row.billingType as string) === "system"
        || row.billingType === "founder"
        || row.tenantName?.toLowerCase().includes("admin");
      if (SOFT_LAUNCH_ACTIVE && !row.guaranteeStatus && !isInternalAccount) {
        violations.push({
          type: "missing_roi_guarantee",
          severity: "medium",
          tenantId: row.tenantId,
          tenantName: row.tenantName,
          billingType: row.billingType,
          message: `[PLAN_VIOLATION] Active subscription for "${row.tenantName}" missing ROI guarantee during soft launch`,
          detail: {
            subscriptionId: row.subId,
            guaranteeStatus: row.guaranteeStatus,
            isPromotional: row.isPromotional,
            createdAt: row.subCreatedAt,
          },
        });
      }

      // Check if guarantee has expired but status not updated
      if (
        row.guaranteeStatus === "active" &&
        row.guaranteeExpiresAt &&
        new Date(row.guaranteeExpiresAt) < new Date()
      ) {
        violations.push({
          type: "expired_guarantee_not_updated",
          severity: "medium",
          tenantId: row.tenantId,
          tenantName: row.tenantName,
          billingType: row.billingType,
          message: `[PLAN_VIOLATION] ROI guarantee expired for "${row.tenantName}" but status still "active"`,
          detail: {
            subscriptionId: row.subId,
            guaranteeExpiresAt: row.guaranteeExpiresAt,
            guaranteeStatus: row.guaranteeStatus,
          },
        });
      }
    }
  } catch (err) {
    logger.warn("[sentinel-plan-checker] Error checking ROI guarantees", { error: String(err) });
  }

  return violations;
}

// ── Expired Trial Checks (single JOIN query) ─────────────────────────────────

async function checkExpiredTrials(db: Db): Promise<PlanViolation[]> {
  const violations: PlanViolation[] = [];

  // During soft launch, expired trials are fine — don't bill them
  if (SOFT_LAUNCH_ACTIVE) return violations;

  try {
    // Single query: JOIN expired trial subscriptions with tenant info
    const rows = await db
      .select({
        subId: subscriptions.id,
        tenantId: subscriptions.tenantId,
        trialEndsAt: subscriptions.trialEndsAt,
        status: subscriptions.status,
        tenantName: tenants.name,
        billingType: tenants.billingType,
      })
      .from(subscriptions)
      .innerJoin(tenants, eq(tenants.id, subscriptions.tenantId))
      .where(
        and(
          eq(subscriptions.status, "trialing"),
          lt(subscriptions.trialEndsAt, new Date()),
        ),
      );

    for (const row of rows) {
      violations.push({
        type: "expired_trial_not_transitioned",
        severity: "high",
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        billingType: row.billingType,
        message: `[PLAN_VIOLATION] Trial expired for "${row.tenantName}" but subscription still in "trialing" status`,
        detail: {
          subscriptionId: row.subId,
          trialEndsAt: row.trialEndsAt,
          currentStatus: row.status,
        },
      });
    }
  } catch (err) {
    logger.warn("[sentinel-plan-checker] Error checking expired trials", { error: String(err) });
  }

  return violations;
}
