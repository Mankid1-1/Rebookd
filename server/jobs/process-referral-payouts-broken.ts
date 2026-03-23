/**
 * 🎯 REFERRAL PAYOUT PROCESSOR
 * Manual job for processing scheduled referral payouts
 *
 * Maintains the 6-month completion + 1-month delay workflow:
 * 1. Referral completes after referred user subscribes for 6+ months
 * 2. Payout is scheduled for 1 month after completion
 * 3. This processor handles payouts when scheduled time arrives
 */

import {
  processScheduledPayouts,
  getPayoutProcessingStats as getStatsFromService,
} from "../services/referral.service";
import { getDb } from "../db";
import { referrals, referralPayouts } from "../../drizzle/schema";
import { eq, and, isNull, lte, gte } from "drizzle-orm";

export interface PayoutResult {
  processed: number;
  total: number;
  message: string;
}

export interface UpcomingPayout {
  id: number;
  referrerId: number;
  rewardAmount: number;
  payoutScheduledAt: Date | null;
  completedAt: Date | null;
  daysUntilPayout: number | null;
}

export interface PayoutStats {
  processedToday: number;
  pendingProcessing: number;
  totalPaidOut: number;
  lastProcessingTime: Date | null;
}

/**
 * Process referral payouts (manual trigger for testing)
 */
export function startReferralPayoutProcessor(): void {
  console.log("🎯 Referral payout processor ready for manual execution");
}

/**
 * Manual trigger for testing (can be called via API)
 */
export async function triggerPayoutProcessing(): Promise<PayoutResult> {
  console.log("🎯 Manually triggering referral payout processing...");

  try {
    const result = await processScheduledPayouts();

    const message =
      result.processed > 0
        ? `Successfully processed ${result.processed} referral payouts out of ${result.total} scheduled`
        : `No payouts ready for processing (${result.total} scheduled)`;

    console.log(`✅ ${message}`);

    await notifyAdminOfPayoutSuccess({
      processed: result.processed,
      total: result.total,
      message,
    });

    return { processed: result.processed, total: result.total, message };
  } catch (error) {
    console.error("❌ Error in manual payout processing:", error);
    await notifyAdminOfPayoutError(error);
    throw error;
  }
}

async function notifyAdminOfPayoutSuccess(result: PayoutResult): Promise<void> {
  console.log(`📧 Admin success notification: ${result.message}`);
}

async function notifyAdminOfPayoutError(error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `📧 Admin error notification: Referral payout processing failed:`,
    error
  );
}

/**
 * Get upcoming referral payouts
 */
export async function getUpcomingReferralPayouts(): Promise<UpcomingPayout[]> {
  const db = await getDb();

  const upcomingPayouts = await db
    .select({
      id: referrals.id,
      referrerId: referrals.referrerId,
      rewardAmount: referrals.rewardAmount,
      payoutScheduledAt: referrals.payoutScheduledAt,
      completedAt: referrals.completedAt,
    })
    .from(referrals)
    .where(
      and(
        eq(referrals.status, "completed"),
        isNull(referrals.payoutProcessedAt)
      )
    )
    .orderBy(referrals.payoutScheduledAt);

  return upcomingPayouts
    .map(payout => ({
      ...payout,
      daysUntilPayout: payout.payoutScheduledAt
        ? Math.ceil(
            (new Date(payout.payoutScheduledAt).getTime() -
              new Date().getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null,
    }))
    .slice(0, 50);
}

/**
 * Get payout processing statistics (for admin dashboard)
 */
export async function getPayoutProcessingStats(): Promise<PayoutStats> {
  const db = await getDb();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayProcessed = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(
      and(
        eq(referrals.status, "completed"),
        isNull(referrals.payoutProcessedAt)
      )
    );

  const pendingPayouts = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(
      and(
        eq(referrals.status, "completed"),
        isNull(referrals.payoutProcessedAt),
        lte(referrals.payoutScheduledAt, new Date())
      )
    );

  const totalPaidRecords = await db
    .select({ amount: referralPayouts.amount })
    .from(referralPayouts)
    .where(eq(referralPayouts.status, "completed"));

  const totalPaidOut = totalPaidRecords.reduce((sum, p) => sum + p.amount, 0);

  const lastProcessed = await db
    .select({ payoutProcessedAt: referrals.payoutProcessedAt })
    .from(referrals)
    .where(eq(referrals.payoutProcessedAt, today))
    .orderBy(referrals.payoutProcessedAt)
    .limit(1);

  return {
    processedToday: todayProcessed.length,
    pendingProcessing: pendingPayouts.length,
    totalPaidOut: totalPaidOut,
    lastProcessingTime: lastProcessed[0]?.payoutProcessedAt || null,
  };
}
