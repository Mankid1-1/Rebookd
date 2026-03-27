/**
 * ROI Guarantee Service
 *
 * Implements the risk-free guarantee for Rebooked customers:
 *   - First 20 "risk_free_20" clients: free if no positive ROI after 90 days
 *   - First 10 "flex_10" clients: reduced $99/mo base, same 15% share, free if no positive ROI
 *
 * ROI calculation (from the CLIENT's perspective):
 *   recoveredRevenue = total realized revenue from recovery_events
 *   costToClient     = subscription fee + (recoveredRevenue × revenueSharePercent / 100)
 *   clientNetROI     = recoveredRevenue - costToClient
 *                    = recoveredRevenue × (1 - revenueSharePercent/100) - subscriptionFee
 *
 * If clientNetROI <= 0 at guarantee evaluation, the subscription base fee is refunded.
 * The revenue share is NOT refunded — it only exists when recovery actually happened.
 */

import { eq, and, sql, gte, lte, isNotNull } from "drizzle-orm";
import { subscriptions, plans, recoveryEvents, tenants } from "../../drizzle/schema";
import type { Db } from "../_core/context";
import { logger } from "../_core/logger";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ROICalculation {
  tenantId: number;
  periodStart: Date;
  periodEnd: Date;
  recoveredRevenue: number;       // cents — what the client recovered
  subscriptionFee: number;        // cents — plan's monthly base fee
  revenueSharePercent: number;    // e.g. 15
  revenueShareAmount: number;     // cents — what Rebooked earned from share
  clientNetROI: number;           // cents — client's net gain/loss
  isPositiveROI: boolean;
}

export interface GuaranteeStatus {
  tenantId: number;
  cohort: "risk_free_20" | "flex_10" | null;
  status: "active" | "satisfied" | "refunded" | "expired" | null;
  startedAt: Date | null;
  expiresAt: Date | null;
  currentROI: ROICalculation | null;
  daysRemaining: number | null;
}

// ─── Cohort Slot Tracking ───────────────────────────────────────────────────

/**
 * Count how many guarantee slots have been claimed for a given cohort.
 */
export async function getGuaranteeCohortCount(
  db: Db,
  cohort: "risk_free_20" | "flex_10"
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(subscriptions)
    .where(eq(subscriptions.guaranteeCohort, cohort));
  return Number(result?.count ?? 0);
}

/**
 * Check if a cohort still has available slots.
 */
export async function isCohortAvailable(
  db: Db,
  cohort: "risk_free_20" | "flex_10"
): Promise<{ available: boolean; claimed: number; total: number }> {
  const maxSlots = cohort === "risk_free_20" ? 20 : 10;
  const claimed = await getGuaranteeCohortCount(db, cohort);
  return { available: claimed < maxSlots, claimed, total: maxSlots };
}

// ─── Guarantee Enrollment ───────────────────────────────────────────────────

/**
 * Enroll a subscription into a guarantee cohort.
 * Called during onboarding or plan upgrade when eligible.
 */
export async function enrollInGuarantee(
  db: Db,
  subscriptionId: number,
  cohort: "risk_free_20" | "flex_10"
): Promise<{ enrolled: boolean; reason?: string }> {
  const availability = await isCohortAvailable(db, cohort);
  if (!availability.available) {
    return {
      enrolled: false,
      reason: `${cohort} cohort is full (${availability.claimed}/${availability.total})`,
    };
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 90); // 90-day guarantee window

  await db
    .update(subscriptions)
    .set({
      guaranteeCohort: cohort,
      guaranteeStatus: "active",
      guaranteeStartedAt: now,
      guaranteeExpiresAt: expiresAt,
    })
    .where(eq(subscriptions.id, subscriptionId));

  logger.info("Enrolled subscription in guarantee", {
    subscriptionId,
    cohort,
    expiresAt,
    slotsRemaining: availability.total - availability.claimed - 1,
  });

  return { enrolled: true };
}

// ─── ROI Calculation ────────────────────────────────────────────────────────

/**
 * Calculate ROI for a specific tenant over a billing period.
 * Uses recovery_events.realizedRevenue as the single source of truth.
 */
export async function calculateTenantROI(
  db: Db,
  tenantId: number,
  periodStart?: Date,
  periodEnd?: Date
): Promise<ROICalculation> {
  const end = periodEnd || new Date();
  const start = periodStart || (() => {
    const d = new Date(end);
    d.setDate(d.getDate() - 30);
    return d;
  })();

  // Get tenant's plan details
  const [sub] = await db
    .select({
      planPriceMonthly: plans.priceMonthly,
      revenueSharePercent: plans.revenueSharePercent,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  const subscriptionFee = sub?.planPriceMonthly ?? 0;
  const revenueSharePercent = sub?.revenueSharePercent ?? 0;

  // Get realized recovered revenue for this period
  const [revenue] = await db
    .select({
      totalRealized: sql<number>`COALESCE(SUM(${recoveryEvents.realizedRevenue}), 0)`,
    })
    .from(recoveryEvents)
    .where(
      and(
        eq(recoveryEvents.tenantId, tenantId),
        eq(recoveryEvents.isPrimaryAttribution, true),
        sql`${recoveryEvents.status} IN ('realized', 'manual_realized')`,
        gte(recoveryEvents.realizedAt, start),
        lte(recoveryEvents.realizedAt, end)
      )
    );

  const recoveredRevenue = Number(revenue?.totalRealized ?? 0);
  const revenueShareAmount = Math.round(recoveredRevenue * revenueSharePercent / 100);
  const clientNetROI = recoveredRevenue - subscriptionFee - revenueShareAmount;

  return {
    tenantId,
    periodStart: start,
    periodEnd: end,
    recoveredRevenue,
    subscriptionFee,
    revenueSharePercent,
    revenueShareAmount,
    clientNetROI,
    isPositiveROI: clientNetROI > 0,
  };
}

/**
 * Calculate cumulative ROI since guarantee started (for guarantee evaluation).
 */
export async function calculateGuaranteeROI(
  db: Db,
  tenantId: number
): Promise<ROICalculation | null> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.tenantId, tenantId),
        isNotNull(subscriptions.guaranteeCohort),
        eq(subscriptions.guaranteeStatus, "active")
      )
    )
    .limit(1);

  if (!sub || !sub.guaranteeStartedAt) return null;

  return calculateTenantROI(db, tenantId, sub.guaranteeStartedAt, new Date());
}

// ─── Guarantee Evaluation ───────────────────────────────────────────────────

/**
 * Evaluate a single tenant's guarantee status.
 * Called at billing cycle or on-demand by admin.
 *
 * Returns the action taken (if any).
 */
export async function evaluateGuarantee(
  db: Db,
  tenantId: number
): Promise<{ action: "none" | "satisfied" | "refund_eligible" | "expired" | "not_enrolled"; roi?: ROICalculation }> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.tenantId, tenantId),
        isNotNull(subscriptions.guaranteeCohort)
      )
    )
    .limit(1);

  if (!sub || !sub.guaranteeCohort) {
    return { action: "not_enrolled" };
  }

  if (sub.guaranteeStatus !== "active") {
    return { action: "none" };
  }

  const now = new Date();
  const roi = await calculateTenantROI(
    db,
    tenantId,
    sub.guaranteeStartedAt || sub.createdAt,
    now
  );

  // Update last ROI check
  await db
    .update(subscriptions)
    .set({
      lastRoiCheckAt: now,
      lastRoiAmount: roi.clientNetROI,
    })
    .where(eq(subscriptions.id, sub.id));

  // If positive ROI at any point, mark guarantee as satisfied
  if (roi.isPositiveROI) {
    await db
      .update(subscriptions)
      .set({ guaranteeStatus: "satisfied" })
      .where(eq(subscriptions.id, sub.id));

    logger.info("Guarantee satisfied — positive ROI achieved", {
      tenantId,
      clientNetROI: roi.clientNetROI,
      recoveredRevenue: roi.recoveredRevenue,
    });

    return { action: "satisfied", roi };
  }

  // Check if guarantee window has expired
  if (sub.guaranteeExpiresAt && now >= sub.guaranteeExpiresAt) {
    if (!roi.isPositiveROI) {
      // Negative ROI at expiration → eligible for refund
      await db
        .update(subscriptions)
        .set({ guaranteeStatus: "refunded" })
        .where(eq(subscriptions.id, sub.id));

      logger.warn("Guarantee triggered — negative ROI at expiration, refund eligible", {
        tenantId,
        clientNetROI: roi.clientNetROI,
        recoveredRevenue: roi.recoveredRevenue,
        subscriptionFee: roi.subscriptionFee,
      });

      return { action: "refund_eligible", roi };
    }

    // Positive ROI at expiration
    await db
      .update(subscriptions)
      .set({ guaranteeStatus: "satisfied" })
      .where(eq(subscriptions.id, sub.id));

    return { action: "satisfied", roi };
  }

  return { action: "none", roi };
}

/**
 * Evaluate ALL active guarantees. Called by a cron job or admin action.
 * Returns summary of actions taken.
 */
export async function evaluateAllGuarantees(db: Db): Promise<{
  evaluated: number;
  satisfied: number;
  refundEligible: number;
  stillActive: number;
  details: Array<{ tenantId: number; action: string; roi?: ROICalculation }>;
}> {
  const activeGuarantees = await db
    .select({
      tenantId: subscriptions.tenantId,
      subscriptionId: subscriptions.id,
    })
    .from(subscriptions)
    .where(
      and(
        isNotNull(subscriptions.guaranteeCohort),
        eq(subscriptions.guaranteeStatus, "active")
      )
    );

  const results = {
    evaluated: activeGuarantees.length,
    satisfied: 0,
    refundEligible: 0,
    stillActive: 0,
    details: [] as Array<{ tenantId: number; action: string; roi?: ROICalculation }>,
  };

  for (const sub of activeGuarantees) {
    const result = await evaluateGuarantee(db, sub.tenantId);
    results.details.push({ tenantId: sub.tenantId, action: result.action, roi: result.roi });

    switch (result.action) {
      case "satisfied":
        results.satisfied++;
        break;
      case "refund_eligible":
        results.refundEligible++;
        break;
      default:
        results.stillActive++;
    }
  }

  logger.info("Guarantee evaluation complete", {
    evaluated: results.evaluated,
    satisfied: results.satisfied,
    refundEligible: results.refundEligible,
    stillActive: results.stillActive,
  });

  return results;
}

// ─── Guarantee Status Query ─────────────────────────────────────────────────

/**
 * Get full guarantee status for a tenant (used by dashboard).
 */
export async function getGuaranteeStatus(
  db: Db,
  tenantId: number
): Promise<GuaranteeStatus> {
  const [sub] = await db
    .select({
      tenantId: subscriptions.tenantId,
      guaranteeCohort: subscriptions.guaranteeCohort,
      guaranteeStatus: subscriptions.guaranteeStatus,
      guaranteeStartedAt: subscriptions.guaranteeStartedAt,
      guaranteeExpiresAt: subscriptions.guaranteeExpiresAt,
    })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  if (!sub || !sub.guaranteeCohort) {
    return {
      tenantId,
      cohort: null,
      status: null,
      startedAt: null,
      expiresAt: null,
      currentROI: null,
      daysRemaining: null,
    };
  }

  let currentROI: ROICalculation | null = null;
  if (sub.guaranteeStatus === "active" && sub.guaranteeStartedAt) {
    currentROI = await calculateTenantROI(db, tenantId, sub.guaranteeStartedAt, new Date());
  }

  const daysRemaining = sub.guaranteeExpiresAt
    ? Math.max(0, Math.ceil((sub.guaranteeExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return {
    tenantId,
    cohort: sub.guaranteeCohort as "risk_free_20" | "flex_10" | null,
    status: sub.guaranteeStatus as "active" | "satisfied" | "refunded" | "expired" | null,
    startedAt: sub.guaranteeStartedAt,
    expiresAt: sub.guaranteeExpiresAt,
    currentROI,
    daysRemaining,
  };
}

// ─── Admin: Guarantee Overview ──────────────────────────────────────────────

/**
 * Get overview of all guarantee cohorts for admin dashboard.
 */
export async function getGuaranteeOverview(db: Db) {
  const [riskFree] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      active: sql<number>`SUM(CASE WHEN guaranteeStatus = 'active' THEN 1 ELSE 0 END)`,
      satisfied: sql<number>`SUM(CASE WHEN guaranteeStatus = 'satisfied' THEN 1 ELSE 0 END)`,
      refunded: sql<number>`SUM(CASE WHEN guaranteeStatus = 'refunded' THEN 1 ELSE 0 END)`,
    })
    .from(subscriptions)
    .where(eq(subscriptions.guaranteeCohort, "risk_free_20"));

  const [flex] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      active: sql<number>`SUM(CASE WHEN guaranteeStatus = 'active' THEN 1 ELSE 0 END)`,
      satisfied: sql<number>`SUM(CASE WHEN guaranteeStatus = 'satisfied' THEN 1 ELSE 0 END)`,
      refunded: sql<number>`SUM(CASE WHEN guaranteeStatus = 'refunded' THEN 1 ELSE 0 END)`,
    })
    .from(subscriptions)
    .where(eq(subscriptions.guaranteeCohort, "flex_10"));

  return {
    riskFree20: {
      slotsUsed: Number(riskFree?.total ?? 0),
      slotsTotal: 20,
      slotsAvailable: 20 - Number(riskFree?.total ?? 0),
      active: Number(riskFree?.active ?? 0),
      satisfied: Number(riskFree?.satisfied ?? 0),
      refunded: Number(riskFree?.refunded ?? 0),
    },
    flex10: {
      slotsUsed: Number(flex?.total ?? 0),
      slotsTotal: 10,
      slotsAvailable: 10 - Number(flex?.total ?? 0),
      active: Number(flex?.active ?? 0),
      satisfied: Number(flex?.satisfied ?? 0),
      refunded: Number(flex?.refunded ?? 0),
    },
  };
}
