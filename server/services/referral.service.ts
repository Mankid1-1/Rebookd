/**
 * REFERRAL SERVICE
 * Comprehensive referral system with $50 per 6-month subscription incentive
 * Uses type-safe Drizzle ORM throughout - no raw SQL
 */

import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, lte, lt, sql, desc } from "drizzle-orm";
import { referrals, referralPayouts, systemErrorLogs, users } from "../../drizzle/schema";
import Stripe from "stripe";
import { ENV } from "../_core/env";

const stripe = new Stripe(ENV.stripeSecretKey || "", { apiVersion: "2022-11-15" as any });

// Constants
const REFERRAL_REWARD_AMOUNT = 50; // $50 per successful referral
const REFERRAL_EXPIRY_DAYS = 90; // Referral links expire after 90 days
const MIN_SUBSCRIPTION_MONTHS = 6; // Minimum 6 months for reward
const REFERRAL_CODE_LENGTH = 8;

/**
 * Generate a unique referral code for a user
 */
export async function generateReferralCode(userId: number): Promise<string> {
  const db = await getDb();

  // Check if user already has an active referral code
  const existingReferral = await db.select({
    referralCode: referrals.referralCode,
  })
    .from(referrals)
    .where(and(
      eq(referrals.referrerId, userId),
      sql`${referrals.status} IN ('pending', 'completed')`
    ))
    .limit(1);

  if (existingReferral.length > 0) {
    return existingReferral[0].referralCode;
  }

  // Generate unique code
  let code: string = "";
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    code = Math.random()
      .toString(36)
      .substring(2, 2 + REFERRAL_CODE_LENGTH)
      .toUpperCase();

    const existing = await db.select({ id: referrals.id })
      .from(referrals)
      .where(eq(referrals.referralCode, code))
      .limit(1);

    isUnique = existing.length === 0;
    attempts++;
  }

  if (!isUnique) {
    throw new Error("Failed to generate unique referral code");
  }

  // Create referral record
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFERRAL_EXPIRY_DAYS);

  await db.insert(referrals).values({
    referrerId: userId,
    referredUserId: 0, // Placeholder until someone uses the code
    referralCode: code,
    status: "pending",
    rewardAmount: REFERRAL_REWARD_AMOUNT,
    rewardCurrency: "USD",
    expiresAt,
  });

  return code;
}

/**
 * Validate and process a referral code
 */
export async function processReferral(
  referralCode: string,
  referredUserId: number
): Promise<{ success: boolean; referralId?: number; message?: string }> {
  const db = await getDb();

  // Find referral
  const matchingReferrals = await db.select({
    id: referrals.id,
    referrerId: referrals.referrerId,
    referralCode: referrals.referralCode,
    status: referrals.status,
    expiresAt: referrals.expiresAt,
    rewardAmount: referrals.rewardAmount,
    rewardCurrency: referrals.rewardCurrency,
  })
    .from(referrals)
    .where(and(
      eq(referrals.referralCode, referralCode),
      eq(referrals.status, "pending")
    ))
    .limit(1);

  if (matchingReferrals.length === 0) {
    return { success: false, message: "Invalid or expired referral code" };
  }

  const referral = matchingReferrals[0];

  // Check if referral has expired
  if (referral.expiresAt && new Date() > referral.expiresAt) {
    await db.update(referrals)
      .set({ status: "expired" })
      .where(eq(referrals.id, referral.id));
    return { success: false, message: "Referral code has expired" };
  }

  // Prevent self-referral
  if (referral.referrerId === referredUserId) {
    return { success: false, message: "Cannot use your own referral code" };
  }

  // Check if user has already been referred
  const existingReferral = await db.select({ id: referrals.id })
    .from(referrals)
    .where(and(
      eq(referrals.referredUserId, referredUserId),
      sql`${referrals.status} IN ('pending', 'completed')`
    ))
    .limit(1);

  if (existingReferral.length > 0) {
    return { success: false, message: "User has already used a referral code" };
  }

  // Update referral with referred user
  await db.update(referrals)
    .set({ referredUserId })
    .where(eq(referrals.id, referral.id));

  return {
    success: true,
    referralId: referral.id,
  };
}

/**
 * Complete a referral when referred user subscribes for 6+ months
 */
export async function completeReferral(
  referralId: number,
  subscriptionId: string,
  subscriptionMonths: number
): Promise<void> {
  const db = await getDb();

  // Verify subscription meets minimum requirements
  if (subscriptionMonths < MIN_SUBSCRIPTION_MONTHS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Subscription must be at least ${MIN_SUBSCRIPTION_MONTHS} months for referral reward`
    });
  }

  // Update referral as completed but schedule payout for 1 month later
  const payoutScheduledDate = new Date();
  payoutScheduledDate.setMonth(payoutScheduledDate.getMonth() + 1);

  await db.update(referrals)
    .set({
      status: "completed",
      subscriptionId,
      completedAt: new Date(),
      payoutScheduledAt: payoutScheduledDate,
    })
    .where(eq(referrals.id, referralId));
}

/**
 * Process scheduled referral payouts (runs daily)
 */
export async function processScheduledPayouts(): Promise<{ processed: number; total: number }> {
  const db = await getDb();

  const dueReferrals = await db.select({
    id: referrals.id,
    referrerId: referrals.referrerId,
    rewardAmount: referrals.rewardAmount,
    referredUserId: referrals.referredUserId,
  })
    .from(referrals)
    .where(and(
      eq(referrals.status, "completed"),
      lte(referrals.payoutScheduledAt, new Date()),
      isNull(referrals.payoutProcessedAt)
    ));

  let processed = 0;

  for (const referral of dueReferrals) {
    let tenantId: number | null = null;
    try {
      const userResults = await db.select({
        stripeCustomerId: users.stripeCustomerId,
        tenantId: users.tenantId
      }).from(users).where(eq(users.id, referral.referrerId)).limit(1);

      const referrer = userResults[0];
      if (referrer && referrer.tenantId) {
        tenantId = referrer.tenantId;
      }

      if (!referrer?.stripeCustomerId) {
        throw new Error(`No Stripe account for referrer ${referral.referrerId}`);
      }

      // Use stripeCustomerId - this should be the Stripe Connect account ID (acct_xxx)
      // If the user has a Connect account, use that for the transfer destination
      const payout = await stripe.transfers.create({
        amount: referral.rewardAmount * 100,
        currency: 'usd',
        destination: referrer.stripeCustomerId,
        description: `Referral payout for referred user ${referral.referredUserId}`,
        metadata: {
          referralId: String(referral.id),
          type: 'referral_payout',
        },
      });

      await db.insert(referralPayouts).values({
        userId: referral.referrerId,
        amount: referral.rewardAmount,
        transactionId: payout.id,
        status: 'completed',
        method: 'stripe',
        processedAt: new Date(),
      });

      await db.update(referrals)
        .set({ payoutProcessedAt: new Date() })
        .where(eq(referrals.id, referral.id));

      processed++;
    } catch (error) {
      console.error(`Failed to process payout for referral ${referral.id}:`, error);
      await db.insert(systemErrorLogs).values({
        type: 'billing',
        message: `Failed to process payout for referral ${referral.id}`,
        detail: (error as Error).message,
        tenantId: tenantId,
      });
    }
  }

  return { processed, total: dueReferrals.length };
}

/**
 * Get referral statistics for a user
 */
export async function getReferralStats(userId: number) {
  const db = await getDb();

  const allReferrals = await db.select({
    status: referrals.status,
    rewardAmount: referrals.rewardAmount,
  })
    .from(referrals)
    .where(eq(referrals.referrerId, userId));

  const completed = allReferrals.filter(r => r.status === "completed");
  const pending = allReferrals.filter(r => r.status === "pending");

  // Get payout records
  const payouts = await db.select({
    amount: referralPayouts.amount,
  })
    .from(referralPayouts)
    .where(and(
      eq(referralPayouts.userId, userId),
      eq(referralPayouts.status, "completed")
    ));

  const totalPaidOut = payouts.reduce((sum, p) => sum + p.amount, 0);
  const totalEarned = completed.reduce((sum, r) => sum + r.rewardAmount, 0);
  const availableForPayout = totalEarned - totalPaidOut;

  return {
    totalReferrals: allReferrals.length,
    completedReferrals: completed.length,
    pendingReferrals: pending.length,
    totalEarned,
    availableForPayout,
    lifetimeEarnings: totalEarned,
  };
}

/**
 * Get all referrals for a user
 */
export async function getUserReferrals(userId: number, limit: number = 10) {
  const db = await getDb();

  return await db.select({
    id: referrals.id,
    referredUserId: referrals.referredUserId,
    referralCode: referrals.referralCode,
    status: referrals.status,
    rewardAmount: referrals.rewardAmount,
    rewardCurrency: referrals.rewardCurrency,
    createdAt: referrals.createdAt,
    completedAt: referrals.completedAt,
    expiresAt: referrals.expiresAt,
    metadata: referrals.metadata,
  })
    .from(referrals)
    .where(eq(referrals.referrerId, userId))
    .orderBy(desc(referrals.createdAt))
    .limit(limit);
}

/**
 * Request payout of available referral earnings
 */
export async function requestPayout(
  userId: number,
  method: "paypal" | "stripe" | "bank_transfer"
) {
  const db = await getDb();

  // Get available balance
  const stats = await getReferralStats(userId);

  if (stats.availableForPayout <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No available earnings for payout"
    });
  }

  // Create payout record
  await db.insert(referralPayouts).values({
    userId,
    amount: stats.availableForPayout,
    currency: "USD",
    method,
    status: "pending",
  });

  // Return the created payout
  const [payout] = await db.select()
    .from(referralPayouts)
    .where(and(
      eq(referralPayouts.userId, userId),
      eq(referralPayouts.status, "pending")
    ))
    .orderBy(desc(referralPayouts.createdAt))
    .limit(1);

  return payout;
}

/**
 * Get user's payout history
 */
export async function getUserPayouts(userId: number) {
  const db = await getDb();

  return await db.select({
    id: referralPayouts.id,
    amount: referralPayouts.amount,
    currency: referralPayouts.currency,
    status: referralPayouts.status,
    method: referralPayouts.method,
    createdAt: referralPayouts.createdAt,
    processedAt: referralPayouts.processedAt,
    transactionId: referralPayouts.transactionId,
  })
    .from(referralPayouts)
    .where(eq(referralPayouts.userId, userId))
    .orderBy(desc(referralPayouts.createdAt));
}

/**
 * Clean up expired referrals
 */
export async function cleanupExpiredReferrals(): Promise<number> {
  const db = await getDb();

  await db.update(referrals)
    .set({ status: "expired" })
    .where(and(
      lt(referrals.expiresAt, new Date()),
      eq(referrals.status, "pending")
    ));

  // MySQL doesn't return affected rows from update easily, so count expired
  const expired = await db.select({ count: sql<number>`count(*)` })
    .from(referrals)
    .where(eq(referrals.status, "expired"));

  return Number(expired[0]?.count ?? 0);
}

/**
 * Get referral leaderboard - uses parameterized queries (no SQL injection)
 */
export async function getReferralLeaderboard(
  limit: number = 10,
  timeframe: "all" | "month" | "year" = "all"
): Promise<Array<{ userId: number; totalReferrals: number; totalEarned: number }>> {
  const db = await getDb();

  // Build conditions array for type-safe filtering
  const conditions = [eq(referrals.status, "completed")];

  if (timeframe === "month") {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    conditions.push(sql`${referrals.completedAt} >= ${monthStart}`);
  } else if (timeframe === "year") {
    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);
    conditions.push(sql`${referrals.completedAt} >= ${yearStart}`);
  }

  const safeLimit = Math.min(Math.max(1, limit), 50);

  const results = await db.select({
    userId: referrals.referrerId,
    totalReferrals: sql<number>`count(*)`,
    totalEarned: sql<number>`COALESCE(SUM(${referrals.rewardAmount}), 0)`,
  })
    .from(referrals)
    .where(and(...conditions))
    .groupBy(referrals.referrerId)
    .orderBy(sql`totalEarned DESC`)
    .limit(safeLimit);

  return results.map(r => ({
    userId: r.userId,
    totalReferrals: Number(r.totalReferrals),
    totalEarned: Number(r.totalEarned),
  }));
}
