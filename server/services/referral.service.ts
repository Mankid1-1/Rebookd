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
import { referrals, referralPayouts, users, subscriptions } from "../../drizzle/schema";
import { stripe } from "../_core/stripe";
import { randomBytes, createHmac } from "crypto";

// ─── V2 Payout Constants ──────────────────────────────────────────────────────
const MONTHLY_PAYOUT_AMOUNT_CENTS = 5000;  // $50 per month (in cents)
const MONTHLY_PAYOUT_AMOUNT_DOLLARS = 50;  // $50 per month (display)
const TOTAL_PAYOUT_MONTHS = 6;             // 6 monthly payouts = $300 total per referral
const TOTAL_REFERRAL_VALUE_CENTS = 30000;  // $300 total per successful referral (in cents)
const TOTAL_REFERRAL_VALUE_DOLLARS = 300;  // $300 total (display)
const REFERRAL_EXPIRY_DAYS = 90;           // Referral links expire after 90 days
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

// HMAC secret for binding referral codes to users — uses app encryption key
const REFERRAL_HMAC_SECRET = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "rebooked-referral-secret";

/**
 * Generate a cryptographically secure referral code bound to a specific user.
 * Format: RB-<10 random chars><4 char HMAC signature>
 * - Random portion: crypto.randomBytes (not Math.random)
 * - Signature: HMAC-SHA256 of (userId + random portion), truncated to 4 chars
 * - This prevents code fabrication — only the server can produce valid codes
 */
function generateCode(userId: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No ambiguous chars (0/O, 1/I/L)
  const bytes = randomBytes(REFERRAL_CODE_LENGTH + 4); // Extra entropy
  let randomPart = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH + 2; i++) {
    randomPart += chars[bytes[i] % chars.length];
  }

  // HMAC signature: binds this code to the user who generated it
  const signature = createHmac("sha256", REFERRAL_HMAC_SECRET)
    .update(`${userId}:${randomPart}`)
    .digest("hex")
    .slice(0, 4)
    .toUpperCase();

  return `RB-${randomPart}${signature}`;
}

/**
 * Verify that a referral code has a valid HMAC signature for the claimed owner.
 * Returns true if the code's signature matches the userId it was generated for.
 */
export function verifyCodeSignature(code: string, userId: number): boolean {
  // Extract parts: RB-<randomPart(10)><signature(4)>
  const body = code.replace("RB-", "");
  if (body.length < 6) return false;
  const randomPart = body.slice(0, -4);
  const claimedSig = body.slice(-4);

  const expectedSig = createHmac("sha256", REFERRAL_HMAC_SECRET)
    .update(`${userId}:${randomPart}`)
    .digest("hex")
    .slice(0, 4)
    .toUpperCase();

  return claimedSig === expectedSig;
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

  // Generate a cryptographically secure, user-bound referral code
  let code = "";
  for (let attempts = 0; attempts < 10; attempts++) {
    const candidate = generateCode(userId);
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
    rewardAmount: MONTHLY_PAYOUT_AMOUNT_CENTS,
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

  // Verify HMAC signature — ensures code was generated by our server for the claimed owner
  if (!verifyCodeSignature(referralCode, referral.referrerId)) {
    logger.warn("Referral code signature mismatch — possible fabrication attempt", {
      code: referralCode, claimedReferrer: referral.referrerId, newUser: newUserId,
    });
    return { success: false, message: "Invalid referral code" };
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
        payoutAmountPerMonth: MONTHLY_PAYOUT_AMOUNT_CENTS,
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

      // FIX #17: Check that the referred user's subscription is still active
      // Don't pay out if the referred user has cancelled
      if (referral.referredUserId) {
        const [referredUser] = await db
          .select({ tenantId: users.tenantId })
          .from(users)
          .where(eq(users.id, referral.referredUserId))
          .limit(1);

        if (referredUser?.tenantId) {
          const [refSub] = await db
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.tenantId, referredUser.tenantId))
            .orderBy(desc(subscriptions.createdAt))
            .limit(1);

          if (!refSub || refSub.status === "canceled" || refSub.status === "unpaid") {
            logger.info("Referral payout skipped — referred user subscription inactive", {
              referralId: referral.id, referredUserId: referral.referredUserId, status: refSub?.status,
            });
            skipped++;
            continue;
          }
        }
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
        amount: MONTHLY_PAYOUT_AMOUNT_CENTS, // $50.00 = 5000 cents
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
        amount: MONTHLY_PAYOUT_AMOUNT_CENTS, // $50.00 = 5000 cents
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
      logger.error(`Failed to process payout for referral ${referral.id}`, {
        error: error instanceof Error ? error.message : String(error),
        referralId: referral.id,
        referrerId: referral.referrerId,
      });
      failed++;
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

  // Calculate earnings based on months paid out (all in cents)
  let totalEarnedCents = 0;
  let totalPaidOutCents = 0;
  for (const r of completed) {
    const meta = (r.metadata as any) ?? {};
    const monthsPayedOut = meta.monthsPayedOut ?? 0;
    totalPaidOutCents += monthsPayedOut * MONTHLY_PAYOUT_AMOUNT_CENTS;
    totalEarnedCents += Math.min(TOTAL_PAYOUT_MONTHS, monthsPayedOut + 1) * MONTHLY_PAYOUT_AMOUNT_CENTS;
  }

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
    totalEarned: totalEarnedCents / 100,          // Return in dollars for display
    totalPaidOut: totalPaidOutCents / 100,
    pendingPayout: (totalEarnedCents - totalPaidOutCents) / 100,
    lifetimeEarnings: (completed.length * TOTAL_REFERRAL_VALUE_CENTS) / 100,
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
 * Delegates to processMonthlyPayouts which handles the actual Stripe transfers.
 */
export async function processScheduledPayouts(db: Db): Promise<{
  processed: number;
  totalAmount: number;
  errors: string[];
}> {
  const result = await processMonthlyPayouts(db);
  return {
    processed: result.processed,
    totalAmount: result.processed * MONTHLY_PAYOUT_AMOUNT_CENTS,
    errors: result.failed > 0 ? [`${result.failed} payout(s) failed — check logs`] : [],
  };
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
