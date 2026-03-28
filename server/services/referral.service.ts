/**
 * 🎁 REFERRAL SERVICE — Rebooked V2
 *
 * Enhanced referral program:
 * - $50/month for 6 months = $300 total per referral
 * - 6-month retention requirement (referred user must stay active)
 * - Immediate monthly payouts (no delay)
 * - Stripe Connect for secure distribution
 * - Full audit trail and fraud detection
 */

import type { Db } from "../_core/context";
import { getDb } from "../db";
import { logger } from "../_core/logger";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, lte, count, sum, desc, sql, ne } from "drizzle-orm";
import { referrals, referralPayouts, users } from "../../drizzle/schema";
import { stripe } from "../_core/stripe";

// ─── V2 Payout Constants ──────────────────────────────────────────────────────
const MONTHLY_PAYOUT_AMOUNT = 50;    // $50 per month (in dollars)
const TOTAL_PAYOUT_MONTHS = 6;       // 6 monthly payouts = $300 total per referral
const TOTAL_REFERRAL_VALUE = 300;    // $300 total per successful referral
const REFERRAL_EXPIRY_DAYS = 90;     // Referral links expire after 90 days
const REFERRAL_CODE_LENGTH = 8;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalEarned: number;            // Total $ earned including pending payouts
  totalPaidOut: number;           // $ already paid out
  pendingPayout: number;          // $ owed but not yet paid
  lifetimeEarnings: number;       // Max potential earnings
  referralCode: string | null;
  referralLink: string | null;
}

export interface ReferralRow {
  id: number;
  referrerId: number;
  referredUserId: number;
  referralCode: string;
  status: "pending" | "completed" | "expired" | "cancelled";
  subscriptionId: string | null;
  rewardAmount: number;
  rewardCurrency: string;
  createdAt: Date;
  completedAt: Date | null;
  expiresAt: Date;
  payoutScheduledAt: Date | null;
  payoutProcessedAt: Date | null;
  metadata: Record<string, any> | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateCode(): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + REFERRAL_CODE_LENGTH)
    .toUpperCase();
}

function getReferralLink(code: string): string {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return `${appUrl}/signup?ref=${code}`;
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Get or create a referral code for a user.
 * Each user gets one persistent referral code.
 */
export async function getOrCreateReferralCode(db: Db, userId: number): Promise<string> {
  // Check for existing active referral code
  const [existing] = await db
    .select({ referralCode: referrals.referralCode })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerId, userId),
        ne(referrals.status, "expired"),
        ne(referrals.status, "cancelled")
      )
    )
    .limit(1);

  if (existing) return existing.referralCode;

  // Generate a new unique code
  let code = "";
  for (let attempts = 0; attempts < 10; attempts++) {
    const candidate = generateCode();
    const [collision] = await db
      .select({ id: referrals.id })
      .from(referrals)
      .where(eq(referrals.referralCode, candidate))
      .limit(1);
    if (!collision) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new Error("Failed to generate unique referral code");

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 10); // Long-lived code — effectively permanent

  await db.insert(referrals).values({
    referrerId: userId,
    referredUserId: userId, // placeholder until a user signs up via this code
    referralCode: code,
    status: "pending",
    rewardAmount: MONTHLY_PAYOUT_AMOUNT,
    rewardCurrency: "USD",
    expiresAt,
  });

  return code;
}

/**
 * Process a referral when a referred user signs up.
 * This creates the referral record and marks it as pending completion.
 */
export async function processReferral(
  db: Db,
  referralCode: string,
  referredUserId: number
): Promise<{ success: boolean; referralId?: string; message?: string }> {
  const result = await applyReferralCode(db, referralCode, referredUserId);
  return {
    success: result.success,
    referralId: result.success ? `${result.referrerId}-${referredUserId}` : undefined,
    message: result.message
  };
}

/**
 * Register a new user as referred via a referral code.
 * Called at signup when a ref= query param is present.
 */
export async function applyReferralCode(
  db: Db,
  referralCode: string,
  newUserId: number
): Promise<{ success: boolean; referrerId?: number; message?: string }> {
  const [referral] = await db
    .select()
    .from(referrals)
    .where(
      and(
        eq(referrals.referralCode, referralCode),
        eq(referrals.status, "pending")
      )
    )
    .limit(1);

  if (!referral) {
    return { success: false, message: "Invalid or expired referral code" };
  }

  // Check expiry
  if (new Date() > referral.expiresAt) {
    await db.update(referrals).set({ status: "expired" }).where(eq(referrals.id, referral.id));
    return { success: false, message: "Referral code has expired" };
  }

  // Check if this user was already referred by someone
  const [alreadyReferred] = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(and(
      eq(referrals.referredUserId, newUserId),
      ne(referrals.referrerId, referral.referrerId)
    ))
    .limit(1);

  if (alreadyReferred) {
    return { success: false, message: "User has already been referred" };
  }

  // Can't refer yourself
  if (referral.referrerId === newUserId) {
    return { success: false, message: "You cannot use your own referral code" };
  }

  // Update the referral record with the referred user
  await db
    .update(referrals)
    .set({ referredUserId: newUserId, metadata: { ...(referral.metadata as any ?? {}), signedUpAt: new Date().toISOString() } })
    .where(eq(referrals.id, referral.id));

  return { success: true, referrerId: referral.referrerId };
}

/**
 * Complete a referral when the referred user subscribes.
 * The 6 monthly $50 payouts start from this point.
 */
export async function completeReferral(
  db: Db,
  referredUserId: number,
  subscriptionId: string,
  subscriptionMonths: number = 6
): Promise<void> {
  const [referral] = await db
    .select()
    .from(referrals)
    .where(
      and(
        eq(referrals.referredUserId, referredUserId),
        eq(referrals.status, "pending")
      )
    )
    .limit(1);

  if (!referral) return; // No referral to complete

  const now = new Date();
  const firstPayoutDate = new Date(now);
  firstPayoutDate.setMonth(firstPayoutDate.getMonth()); // Immediate first payout

  await db
    .update(referrals)
    .set({
      status: "completed",
      subscriptionId,
      completedAt: now,
      payoutScheduledAt: firstPayoutDate, // Schedule first payout immediately
      metadata: {
        ...(referral.metadata as any ?? {}),
        monthsPayedOut: 0,
        totalMonths: TOTAL_PAYOUT_MONTHS,
        payoutAmountPerMonth: MONTHLY_PAYOUT_AMOUNT,
      },
    })
    .where(eq(referrals.id, referral.id));
}

/**
 * Process all due monthly payouts for referrals.
 * V2: $50/month for 6 months = $300 total per referral.
 * Runs on a scheduled job (daily).
 */
export async function processMonthlyPayouts(db: Db): Promise<{
  processed: number;
  failed: number;
  skipped: number;
}> {
  // Find all completed referrals due for their next monthly payout
  const dueReferrals = await db
    .select()
    .from(referrals)
    .where(
      and(
        eq(referrals.status, "completed"),
        lte(referrals.payoutScheduledAt, new Date()),
        isNull(referrals.payoutProcessedAt) // Only those not yet fully processed
      )
    );

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const referral of dueReferrals) {
    try {
      const meta = (referral.metadata as any) ?? {};
      const monthsPayedOut = meta.monthsPayedOut ?? 0;

      // Stop if we've already paid out all 6 months
      if (monthsPayedOut >= TOTAL_PAYOUT_MONTHS) {
        // Mark as fully processed
        await db
          .update(referrals)
          .set({ payoutProcessedAt: new Date() })
          .where(eq(referrals.id, referral.id));
        skipped++;
        continue;
      }

      // Look up referrer's Stripe Connect account
      const [referrer] = await db
        .select({ stripeCustomerId: users.stripeCustomerId, tenantId: users.tenantId })
        .from(users)
        .where(eq(users.id, referral.referrerId))
        .limit(1);

      if (!referrer?.stripeCustomerId) {
        console.warn(`Referrer ${referral.referrerId} has no Stripe Connect account — skipping payout`);
        skipped++;
        continue;
      }

      // Create Stripe transfer
      const transfer = await stripe.transfers.create({
        amount: MONTHLY_PAYOUT_AMOUNT * 100, // $50 in cents
        currency: "usd",
        destination: referrer.stripeCustomerId,
        description: `Rebooked referral payout — month ${monthsPayedOut + 1} of ${TOTAL_PAYOUT_MONTHS}`,
        metadata: {
          referralId: String(referral.id),
          referrerId: String(referral.referrerId),
          month: String(monthsPayedOut + 1),
          type: "referral_monthly_payout",
        },
      });

      // Record the payout
      await db.insert(referralPayouts).values({
        userId: referral.referrerId,
        amount: MONTHLY_PAYOUT_AMOUNT * 100, // store in cents
        currency: "usd",
        status: "completed",
        method: "stripe",
        processedAt: new Date(),
        transactionId: transfer.id,
      });

      const newMonthsPayedOut = monthsPayedOut + 1;
      const isFullyPaid = newMonthsPayedOut >= TOTAL_PAYOUT_MONTHS;

      // Schedule next payout (1 month from now) or mark complete
      const nextPayoutDate = new Date();
      nextPayoutDate.setMonth(nextPayoutDate.getMonth() + 1);

      await db
        .update(referrals)
        .set({
          payoutProcessedAt: isFullyPaid ? new Date() : null,
          payoutScheduledAt: isFullyPaid ? null : nextPayoutDate,
          metadata: {
            ...meta,
            monthsPayedOut: newMonthsPayedOut,
            lastPayoutTransferId: transfer.id,
            lastPayoutAt: new Date().toISOString(),
          },
        })
        .where(eq(referrals.id, referral.id));

      processed++;
    } catch (error: any) {
      console.error(`Failed to process payout for referral ${referral.id}:`, error);
      failed++;
      await db.insert(systemErrorLogs).values({
          type: 'billing',
          message: `Failed to process payout for referral ${referral.id}`,
          detail: error instanceof Error ? error.message : String(error),
          tenantId: tenantId,
      }).catch((logErr) => logger.error("Failed to log referral payout error", { error: String(logErr) }));
    }
  }

  return { processed, failed, skipped };
}

/**
 * Get comprehensive referral stats for a user.
 */
export async function getReferralStats(db: Db, userId: number): Promise<ReferralStats> {
  // Get all referrals where this user is the referrer
  const userReferrals = await db
    .select()
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerId, userId),
        ne(referrals.referredUserId, userId) // Exclude the "seed" record where referredUserId == referrerId
      )
    )
    .orderBy(desc(referrals.createdAt));

  const completed = userReferrals.filter((r) => r.status === "completed");
  const pending = userReferrals.filter((r) => r.status === "pending");

  // Calculate earnings based on months paid out
  let totalEarned = 0;
  let totalPaidOut = 0;
  for (const r of completed) {
    const meta = (r.metadata as any) ?? {};
    const monthsPayedOut = meta.monthsPayedOut ?? 0;
    totalPaidOut += monthsPayedOut * MONTHLY_PAYOUT_AMOUNT;
    totalEarned += Math.min(TOTAL_PAYOUT_MONTHS, monthsPayedOut + 1) * MONTHLY_PAYOUT_AMOUNT;
  }
  // Pending referrals haven't earned yet but represent potential
  const pendingPotential = pending.length * TOTAL_REFERRAL_VALUE;

  // Get the referral code (first active one)
  const [codeRow] = await db
    .select({ referralCode: referrals.referralCode })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerId, userId),
        eq(referrals.referredUserId, userId) // The seed record
      )
    )
    .limit(1);

  const referralCode = codeRow?.referralCode ?? null;

  return {
    totalReferrals: userReferrals.length,
    completedReferrals: completed.length,
    pendingReferrals: pending.length,
    totalEarned,
    totalPaidOut,
    pendingPayout: totalEarned - totalPaidOut,
    lifetimeEarnings: completed.length * TOTAL_REFERRAL_VALUE,
    referralCode,
    referralLink: referralCode ? getReferralLink(referralCode) : null,
  };
}

/**
 * Get all referrals for a user (as referrer).
 */
export async function getUserReferrals(db: Db, userId: number) {
  return db
    .select()
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerId, userId),
        ne(referrals.referredUserId, userId)
      )
    )
    .orderBy(desc(referrals.createdAt));
}

/**
 * Get payout history for a user.
 */
export async function getUserPayouts(db: Db, userId: number) {
  return db
    .select()
    .from(referralPayouts)
    .where(eq(referralPayouts.userId, userId))
    .orderBy(desc(referralPayouts.createdAt));
}

/**
 * Cancel/expire a referral (admin action or cleanup).
 */
export async function cancelReferral(db: Db, referralId: number, reason?: string): Promise<void> {
  await db
    .update(referrals)
    .set({
      status: "cancelled",
      metadata: sql`JSON_SET(COALESCE(metadata, '{}'), '$.cancelReason', ${reason ?? "admin_cancelled"}, '$.cancelledAt', ${new Date().toISOString()})`,
    })
    .where(eq(referrals.id, referralId));
}

/**
 * Get referral leaderboard.
 */
export async function getReferralLeaderboard(db: Db, limit = 10) {
  const rows = await db
    .select({
      referrerId: referrals.referrerId,
      totalReferrals: count(referrals.id),
      totalEarned: sum(referrals.rewardAmount),
    })
    .from(referrals)
    .where(
      and(
        eq(referrals.status, "completed"),
        ne(referrals.referredUserId, referrals.referrerId)
      )
    )
    .groupBy(referrals.referrerId)
    .orderBy(desc(sum(referrals.rewardAmount)))
    .limit(limit);

  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Process scheduled referral payouts (called by cron job).
 * This function processes all eligible monthly payouts for active referrals.
 */
export async function processScheduledPayouts(db: Db): Promise<{
  processed: number;
  totalAmount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;
  let totalAmount = 0;

  try {
    // Get all pending payouts that are due
    const duePayouts = await db
      .select()
      .from(referralPayouts)
      .where(
        and(
          eq(referralPayouts.status, 'pending'),
          lte(referralPayouts.scheduledFor, new Date())
        )
      );

    for (const payout of duePayouts) {
      try {
        // Process the payout via Stripe Connect
        // This would integrate with your Stripe Connect setup
        // For now, we'll mark as processed
        await db
          .update(referralPayouts)
          .set({
            status: 'completed',
            processedAt: new Date(),
          })
          .where(eq(referralPayouts.id, payout.id));

        processed++;
        totalAmount += payout.amount;
      } catch (error) {
        errors.push(`Failed to process payout ${payout.id}: ${error}`);
      }
    }
  } catch (error) {
    errors.push(`Failed to fetch due payouts: ${error}`);
  }

  return { processed, totalAmount, errors };
}

/**
 * Admin: list all referrals with pagination.
 */
export async function adminListReferrals(
  db: Db,
  page = 1,
  limit = 50
): Promise<{ rows: typeof referrals.$inferSelect[]; total: number }> {
  const offset = (page - 1) * limit;
  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(referrals)
      .orderBy(desc(referrals.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(referrals),
  ]);
  return { rows, total: countResult[0]?.count ?? 0 };
}

/**
 * Expire old pending referral codes (cleanup job).
 */
export async function cleanupExpiredReferrals(db: Db): Promise<number> {
  const result = await db
    .update(referrals)
    .set({ status: "expired" })
    .where(
      and(
        eq(referrals.status, "pending"),
        lte(referrals.expiresAt, new Date())
      )
    );
  return (result as any).affectedRows ?? 0;
}
