/**
 * 🎯 REFERRAL SERVICE
 * Comprehensive referral system with 50$ per 6-month subscription incentive
 */

import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, lte } from "drizzle-orm";
import { referrals, referralPayouts, systemErrorLogs, users } from "../../drizzle/schema";
import { stripe } from "../_core/stripe";

export interface Referral {
  id: string;
  referrerId: string;
  referredUserId: string;
  referralCode: string;
  status: "pending" | "completed" | "expired" | "cancelled";
  subscriptionId?: string;
  rewardAmount: number;
  rewardCurrency: string;
  createdAt: Date;
  completedAt?: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

export interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalEarned: number;
  availableForPayout: number;
  lifetimeEarnings: number;
}

export interface ReferralPayout {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: "pending" | "processing" | "completed" | "failed";
  method: "paypal" | "stripe" | "bank_transfer";
  createdAt: Date;
  processedAt?: Date;
  transactionId?: string;
}

// Constants
const REFERRAL_REWARD_AMOUNT = 50; // $50 per successful referral
const REFERRAL_EXPIRY_DAYS = 90; // Referral links expire after 90 days
const MIN_SUBSCRIPTION_MONTHS = 6; // Minimum 6 months for reward
const REFERRAL_CODE_LENGTH = 8;

/**
 * Generate a unique referral code for a user
 */
export async function generateReferralCode(userId: string): Promise<string> {
  const db = await getDb();
  
  // Check if user already has an active referral code
  const existingReferral = await (db as any).select({
    referralCode: true
  })
    .from("referrals")
    .where("referrerId", "=", userId)
    .where("status", "in", ["pending", "completed"])
    .limit(1);

  if (existingReferral.length > 0) {
    return existingReferral[0].referralCode;
  }

  // Generate unique code
  let code: string;
  let isUnique = false;
  let attempts = 0;
  
  while (!isUnique && attempts < 10) {
    code = Math.random()
      .toString(36)
      .substring(2, 2 + REFERRAL_CODE_LENGTH)
      .toUpperCase();
    
    const existing = await (db as any).select({ id: true })
      .from("referrals")
      .where("referralCode", "=", code)
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

  await (db as any).insert("referrals")
    .values({
      id: crypto.randomUUID(),
      referrerId: userId,
      referralCode: code,
      status: "pending",
      rewardAmount: REFERRAL_REWARD_AMOUNT,
      rewardCurrency: "USD",
      createdAt: new Date(),
      expiresAt,
    });

  return code!;
}

/**
 * Validate and process a referral code
 */
export async function processReferral(
  referralCode: string, 
  referredUserId: string
): Promise<{ success: boolean; referral?: Referral; message?: string }> {
  const db = await getDb();
  
  // Find referral
  const referrals = await (db as any).select({
    id: true,
    referrerId: true,
    referralCode: true,
    status: true,
    expiresAt: true,
    rewardAmount: true,
    rewardCurrency: true,
  })
    .from("referrals")
    .where("referralCode", "=", referralCode)
    .where("status", "=", "pending")
    .limit(1);

  if (referrals.length === 0) {
    return { success: false, message: "Invalid or expired referral code" };
  }

  const referral = referrals[0];

  // Check if referral has expired
  if (new Date() > referral.expiresAt) {
    await (db as any).update("referrals")
      .set({ status: "expired" })
      .where("id", "=", referral.id);
    return { success: false, message: "Referral code has expired" };
  }

  // Check if user has already been referred
  const existingReferral = await (db as any).select({ id: true })
    .from("referrals")
    .where("referredUserId", "=", referredUserId)
    .limit(1);

  if (existingReferral.length > 0) {
    return { success: false, message: "User has already used a referral code" };
  }

  // Update referral with referred user
  await (db as any).update("referrals")
    .set({ 
      referredUserId,
      status: "pending",
      updatedAt: new Date()
    })
    .where("id", "=", referral.id);

  return { 
    success: true, 
    referral: { ...referral, referredUserId, status: "pending" as const }
  };
}

/**
 * Complete a referral when referred user subscribes for 6+ months
 */
export async function completeReferral(
  referralId: string, 
  subscriptionId: string,
  subscriptionMonths: number
): Promise<Referral> {
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
  payoutScheduledDate.setMonth(payoutScheduledDate.getMonth() + 1); // 1 month from now
  
  const updatedReferral = await (db as any).update("referrals")
    .set({
      status: "completed",
      subscriptionId,
      completedAt: new Date(),
      payoutScheduledAt: payoutScheduledDate,
      updatedAt: new Date()
    })
    .where("id", "=", referralId)
    .returning("*")
    .execute();

  if (updatedReferral.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral not found"
    });
  }

  // Schedule payout for 1 month later (don't create payout record yet)
  // The payout will be created by the scheduled job when the time comes

  return updatedReferral[0] as Referral;
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
        throw new Error(`No Stripe Connect account for referrer ${referral.referrerId}`);
      }

      const payout = await stripe.transfers.create({
        amount: referral.rewardAmount * 100,
        currency: 'usd',
        destination: referrer.stripeCustomerId, // Assuming this is the connect ID
        description: `Referral payout for referred user ${referral.referredUserId}`,
        metadata: {
          referralId: referral.id,
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
        .set({
          payoutProcessedAt: new Date(),
        })
        .where(eq(referrals.id, referral.id));
      
      processed++;
    } catch (error) {
      console.error(`Failed to process payout for referral ${referral.id}:`, error);
      await db.insert(systemErrorLogs).values({
          type: 'billing',
          message: `Failed to process payout for referral ${referral.id}`,
          detail: error instanceof Error ? error.message : String(error),
          tenantId: tenantId,
      });
    }
  }
  
  return { processed, total: dueReferrals.length };
}

/**
 * Get referral statistics for a user
 */
export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const db = await getDb();
  
  const referrals = await (db as any).select({
    status: true,
    rewardAmount: true,
    completedAt: true,
  })
    .from("referrals")
    .where("referrerId", "=", userId);

  const completed = referrals.filter(r => r.status === "completed");
  const pending = referrals.filter(r => r.status === "pending");

  // Get payout records
  const payouts = await (db as any).select({
    amount: true,
    status: true,
  })
    .from("referral_payouts")
    .where("userId", "=", userId)
    .where("status", "=", "completed");

  const totalPaidOut = payouts.reduce((sum, p) => sum + p.amount, 0);

  const totalEarned = completed.reduce((sum, r) => sum + r.rewardAmount, 0);
  const availableForPayout = totalEarned - totalPaidOut;

  return {
    totalReferrals: referrals.length,
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
export async function getUserReferrals(userId: string): Promise<Referral[]> {
  const db = await getDb();
  
  return await (db as any).select({
    id: true,
    referredUserId: true,
    referralCode: true,
    status: true,
    rewardAmount: true,
    rewardCurrency: true,
    createdAt: true,
    completedAt: true,
    expiresAt: true,
    metadata: true,
  })
    .from("referrals")
    .where("referrerId", "=", userId)
    .orderBy("createdAt", "desc");
}



/**
 * Request payout of available referral earnings
 */
export async function requestPayout(
  userId: string,
  method: "paypal" | "stripe" | "bank_transfer"
): Promise<ReferralPayout> {
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
  const payout = await (db as any).insert("referral_payouts")
    .values({
      id: crypto.randomUUID(),
      userId,
      amount: stats.availableForPayout,
      currency: "USD",
      method,
      status: "pending",
      createdAt: new Date(),
    })
    .returning("*")
    .execute();

  return payout[0] as ReferralPayout;
}

/**
 * Get user's payout history
 */
export async function getUserPayouts(userId: string): Promise<ReferralPayout[]> {
  const db = await getDb();
  
  return await (db as any).select({
    id: true,
    amount: true,
    currency: true,
    status: true,
    method: true,
    createdAt: true,
    processedAt: true,
    transactionId: true,
  })
    .from("referral_payouts")
    .where("userId", "=", userId)
    .orderBy("createdAt", "desc");
}

/**
 * Clean up expired referrals
 */
export async function cleanupExpiredReferrals(): Promise<number> {
  const db = await getDb();
  
  const result = await (db as any).update("referrals")
    .set({ 
      status: "expired",
      updatedAt: new Date()
    })
    .where("expiresAt", "<", new Date())
    .where("status", "=", "pending");

  return result.changes || 0;
}

/**
 * Get referral leaderboard
 */
export async function getReferralLeaderboard(
  limit: number = 10,
  timeframe: "all" | "month" | "year" = "all"
): Promise<Array<{ userId: string; totalReferrals: number; totalEarned: number; rank: number }>> {
  const db = await getDb();
  
  let whereClause = "r.status = 'completed'";
  
  if (timeframe === "month") {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    whereClause += ` AND r.completedAt >= '${monthStart.toISOString()}'`;
  } else if (timeframe === "year") {
    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);
    whereClause += ` AND r.completedAt >= '${yearStart.toISOString()}'`;
  }

  const query = `
    SELECT 
      r.referrerId as userId,
      COUNT(*) as totalReferrals,
      SUM(r.rewardAmount) as totalEarned,
      RANK() OVER (ORDER BY SUM(r.rewardAmount) DESC) as rank
    FROM referrals r
    WHERE ${whereClause}
    GROUP BY r.referrerId
    ORDER BY totalEarned DESC
    LIMIT ${limit}
  `;

  return await (db as any).execute(query);
}
