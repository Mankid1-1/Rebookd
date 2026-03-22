/**
 * Promotional Pricing Service
 * 
 * Handles promotional pricing calculations for first 50 clients
 * Free if total cost doesn't exceed $199/month
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { plans, subscriptions } from "../../drizzle/schema";
import type { Db } from "../_core/context";

export interface PromotionalEligibility {
  isEligible: boolean;
  promotionalSlotsRemaining: number;
  promotionalPriceCap: number; // in cents
  message: string;
}

export interface PromotionalPricing {
  basePrice: number; // in cents
  revenueShareFee: number; // in cents
  promotionalDiscount: number; // in cents
  finalPrice: number; // in cents
  isPromotional: boolean;
}

/**
 * Check if tenant is eligible for promotional pricing
 */
export async function checkPromotionalEligibility(
  db: Db,
  planId: number,
  tenantId?: number
): Promise<PromotionalEligibility> {
  // Get plan details
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);

  if (!plan || !plan.hasPromotion || plan.promotionalSlots <= 0) {
    return {
      isEligible: false,
      promotionalSlotsRemaining: 0,
      promotionalPriceCap: 0,
      message: "No promotional offer available for this plan"
    };
  }

  // Count current promotional subscriptions
  const [promotionalCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.planId, planId),
        eq(subscriptions.isPromotional, true),
        // Only count active promotional subscriptions
        sql`status = 'active' AND (promotionalExpiresAt IS NULL OR promotionalExpiresAt > NOW())`
      )
    );

  const slotsRemaining = Math.max(0, plan.promotionalSlots - promotionalCount.count);
  const isEligible = slotsRemaining > 0 && (!tenantId || !(await hasActiveSubscription(db, tenantId)));

  return {
    isEligible,
    promotionalSlotsRemaining: slotsRemaining,
    promotionalPriceCap: plan.promotionalPriceCap,
    message: isEligible 
      ? `Promotional pricing available! ${slotsRemaining} slots remaining.`
      : `No promotional slots remaining (${plan.promotionalSlots} total slots).`
  };
}

/**
 * Calculate promotional pricing for a subscription
 */
export async function calculatePromotionalPricing(
  db: Db,
  planId: number,
  recoveredRevenue: number, // in cents
  tenantId?: number
): Promise<PromotionalPricing> {
  // Get plan details
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);

  if (!plan) {
    throw new Error("Plan not found");
  }

  // Calculate standard pricing
  const basePrice = plan.priceMonthly;
  const revenueShareFee = Math.round(recoveredRevenue * (plan.revenueSharePercent / 100));
  const standardTotal = basePrice + revenueShareFee;

  // Check promotional eligibility
  const eligibility = await checkPromotionalEligibility(db, planId, tenantId);
  
  if (!eligibility.isEligible || !plan.hasPromotion) {
    return {
      basePrice,
      revenueShareFee,
      promotionalDiscount: 0,
      finalPrice: standardTotal,
      isPromotional: false
    };
  }

  // Apply promotional pricing
  const promotionalDiscount = Math.min(standardTotal, eligibility.promotionalPriceCap);
  const finalPrice = Math.max(0, standardTotal - promotionalDiscount);

  return {
    basePrice,
    revenueShareFee,
    promotionalDiscount,
    finalPrice,
    isPromotional: promotionalDiscount > 0
  };
}

/**
 * Create promotional subscription
 */
export async function createPromotionalSubscription(
  db: Db,
  tenantId: number,
  planId: number,
  subscriptionDurationMonths: number = 12
): Promise<boolean> {
  try {
    // Check eligibility
    const eligibility = await checkPromotionalEligibility(db, planId, tenantId);
    
    if (!eligibility.isEligible) {
      throw new Error(eligibility.message);
    }

    // Calculate promotional expiry
    const promotionalExpiresAt = new Date();
    promotionalExpiresAt.setMonth(promotionalExpiresAt.getMonth() + subscriptionDurationMonths);

    // Create or update subscription
    await db
      .update(subscriptions)
      .set({
        isPromotional: true,
        promotionalExpiresAt,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(subscriptions.tenantId, tenantId),
          eq(subscriptions.planId, planId)
        )
      );

    return true;
  } catch (error) {
    console.error("Failed to create promotional subscription:", error);
    return false;
  }
}

/**
 * Check if tenant already has active subscription
 */
async function hasActiveSubscription(db: Db, tenantId: number): Promise<boolean> {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.tenantId, tenantId),
        sql`status IN ('active', 'trialing')`
      )
    )
    .limit(1);

  return !!subscription;
}

/**
 * Get promotional statistics for admin dashboard
 */
export async function getPromotionalStatistics(db: Db, planId: number) {
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);

  if (!plan || !plan.hasPromotion) {
    return null;
  }

  // Count promotional subscriptions
  const [promotionalStats] = await db
    .select({
      active: sql<number>`count(*)`,
      expired: sql<number>`count(*)`
    })
    .from(subscriptions)
    .where(eq(subscriptions.planId, planId))
    .groupBy(sql`CASE 
      WHEN promotionalExpiresAt > NOW() OR promotionalExpiresAt IS NULL THEN 'active'
      ELSE 'expired'
    END`);

  return {
    totalSlots: plan.promotionalSlots,
    priceCap: plan.promotionalPriceCap,
    activePromotions: promotionalStats?.active || 0,
    expiredPromotions: promotionalStats?.expired || 0,
    slotsRemaining: Math.max(0, plan.promotionalSlots - (promotionalStats?.active || 0))
  };
}
