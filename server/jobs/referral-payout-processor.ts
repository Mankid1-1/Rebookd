/**
 * REFERRAL PAYOUT PROCESSOR
 * Processes referral payouts 1 month after completion.
 * Uses Drizzle ORM throughout - no raw SQL.
 */

import { processScheduledPayouts } from '../services/referral.service';
import { getDb } from '../db';
import { referrals, referralPayouts } from '../../drizzle/schema';
import { eq, and, isNull, lte, gte, desc, sql } from 'drizzle-orm';

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

// Re-export for external use
export { processScheduledPayouts };

/**
 * Manual trigger for processing scheduled payouts.
 * Can be called via API endpoint or admin dashboard.
 */
export async function processReferralPayouts(): Promise<PayoutResult> {
  console.log('Processing scheduled referral payouts...');

  try {
    const result = await processScheduledPayouts();

    const message = result.processed > 0
      ? `Successfully processed ${result.processed} referral payouts out of ${result.total} scheduled`
      : `No payouts ready for processing (${result.total} scheduled)`;

    console.log(message);

    return {
      processed: result.processed,
      total: result.total,
      message,
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Error processing referral payouts:', error);

    return {
      processed: 0,
      total: 0,
      message: `Error processing payouts: ${errMsg}`,
    };
  }
}

/**
 * Get upcoming payout schedule (for admin dashboard)
 */
export async function getUpcomingPayoutSchedule(): Promise<UpcomingPayout[]> {
  const db = await getDb();

  try {
    const now = new Date();

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
          eq(referrals.status, 'completed'),
          isNull(referrals.payoutProcessedAt)
        )
      )
      .orderBy(referrals.payoutScheduledAt)
      .limit(50);

    return upcomingPayouts.map((payout) => ({
      ...payout,
      daysUntilPayout: payout.payoutScheduledAt
        ? Math.ceil(
            (new Date(payout.payoutScheduledAt).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null,
    }));
  } catch (error: unknown) {
    console.error('Error getting upcoming payout schedule:', error);
    return [];
  }
}

/**
 * Get payout processing statistics (for admin dashboard)
 */
export async function getPayoutProcessingStats(): Promise<PayoutStats> {
  const db = await getDb();

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Referrals processed today (have a payoutProcessedAt >= start of today)
    const todayProcessed = await db
      .select({ id: referrals.id })
      .from(referrals)
      .where(gte(referrals.payoutProcessedAt, today));

    // Pending payouts (completed, not yet processed, scheduled time has passed)
    const pendingPayouts = await db
      .select({ id: referrals.id })
      .from(referrals)
      .where(
        and(
          eq(referrals.status, 'completed'),
          isNull(referrals.payoutProcessedAt),
          lte(referrals.payoutScheduledAt, new Date())
        )
      );

    // Total amount paid out via referral_payouts
    const totalPaidRecords = await db
      .select({ amount: referralPayouts.amount })
      .from(referralPayouts)
      .where(eq(referralPayouts.status, 'completed'));

    const totalPaidOut = totalPaidRecords.reduce((sum, p) => sum + p.amount, 0);

    // Most recent processing time today
    const lastProcessed = await db
      .select({ payoutProcessedAt: referrals.payoutProcessedAt })
      .from(referrals)
      .where(gte(referrals.payoutProcessedAt, today))
      .orderBy(desc(referrals.payoutProcessedAt))
      .limit(1);

    return {
      processedToday: todayProcessed.length,
      pendingProcessing: pendingPayouts.length,
      totalPaidOut,
      lastProcessingTime: lastProcessed[0]?.payoutProcessedAt ?? null,
    };
  } catch (error: unknown) {
    console.error('Error getting payout processing stats:', error);
    return {
      processedToday: 0,
      pendingProcessing: 0,
      totalPaidOut: 0,
      lastProcessingTime: null,
    };
  }
}

/**
 * Get referral payout timeline for a specific user
 */
export async function getUserPayoutTimeline(userId: number): Promise<Array<{
  referralId: number;
  referralCode: string;
  status: string;
  rewardAmount: number;
  completedAt: Date | null;
  payoutScheduledAt: Date | null;
  payoutProcessedAt: Date | null;
  payoutStatus: string;
  payoutMethod: string | null;
  daysUntilPayout: number | null;
}>> {
  const db = await getDb();

  try {
    const now = new Date();

    const userReferrals = await db
      .select({
        id: referrals.id,
        referralCode: referrals.referralCode,
        referredUserId: referrals.referredUserId,
        status: referrals.status,
        rewardAmount: referrals.rewardAmount,
        completedAt: referrals.completedAt,
        payoutScheduledAt: referrals.payoutScheduledAt,
        payoutProcessedAt: referrals.payoutProcessedAt,
        createdAt: referrals.createdAt,
      })
      .from(referrals)
      .where(eq(referrals.referrerId, userId))
      .orderBy(desc(referrals.createdAt));

    // Get payout records for this user
    const payouts = await db
      .select({
        amount: referralPayouts.amount,
        status: referralPayouts.status,
        createdAt: referralPayouts.createdAt,
        processedAt: referralPayouts.processedAt,
        method: referralPayouts.method,
      })
      .from(referralPayouts)
      .where(eq(referralPayouts.userId, userId))
      .orderBy(desc(referralPayouts.createdAt));

    return userReferrals.map((referral) => {
      const payout = payouts.find(
        (p) =>
          p.amount === referral.rewardAmount &&
          referral.completedAt &&
          p.createdAt >= referral.completedAt
      );

      return {
        referralId: referral.id,
        referralCode: referral.referralCode,
        status: referral.status,
        rewardAmount: referral.rewardAmount,
        completedAt: referral.completedAt,
        payoutScheduledAt: referral.payoutScheduledAt,
        payoutProcessedAt: referral.payoutProcessedAt,
        payoutStatus: payout ? payout.status : 'pending',
        payoutMethod: payout ? payout.method : null,
        daysUntilPayout:
          referral.payoutScheduledAt && !referral.payoutProcessedAt
            ? Math.ceil(
                (new Date(referral.payoutScheduledAt).getTime() - now.getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : null,
      };
    });
  } catch (error: unknown) {
    console.error('Error getting user payout timeline:', error);
    return [];
  }
}
