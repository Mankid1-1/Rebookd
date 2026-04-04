/**
 * 🎯 REFERRAL PAYOUT PROCESSOR
 * Processes referral payouts 1 month after completion
 */

import { eq, and, gte, lte, isNull, asc, desc, sql } from 'drizzle-orm';
import { processScheduledPayouts } from '../services/referral.service';
import { getDb } from '../db';
import { referrals, referralPayouts } from '../../drizzle/schema';

// Export the function for external use
export { processScheduledPayouts };

/**
 * Manual trigger for processing scheduled payouts
 * Can be called via API endpoint or admin dashboard
 */
export async function processReferralPayouts(): Promise<{ processed: number; total: number; message: string }> {
  console.log('🎯 Processing scheduled referral payouts...');

  try {
    const db = await getDb();
    const result = await processScheduledPayouts(db);

    const message = result.processed > 0
      ? `Successfully processed ${result.processed} referral payouts (${result.totalAmount / 100} USD)`
      : `No payouts ready for processing`;

    console.log(`✅ ${message}`);

    return {
      processed: result.processed,
      total: result.processed,
      message
    };
  } catch (error) {
    console.error('❌ Error processing referral payouts:', error);

    return {
      processed: 0,
      total: 0,
      message: `Error processing payouts: ${(error as Error).message}`
    };
  }
}

/**
 * Get upcoming payout schedule (for admin dashboard)
 */
export async function getUpcomingPayoutSchedule(): Promise<any[]> {
  const db = await getDb();

  try {
    const upcomingPayouts = await db.select({
      id: referrals.id,
      referrerId: referrals.referrerId,
      rewardAmount: referrals.rewardAmount,
      payoutScheduledAt: referrals.payoutScheduledAt,
      completedAt: referrals.completedAt,
    })
      .from(referrals)
      .where(and(
        eq(referrals.status, "completed"),
        gte(referrals.payoutScheduledAt, new Date()),
        isNull(referrals.payoutProcessedAt),
      ))
      .orderBy(asc(referrals.payoutScheduledAt))
      .limit(50);

    return upcomingPayouts.map(payout => ({
      ...payout,
      daysUntilPayout: payout.payoutScheduledAt
        ? Math.ceil((new Date(payout.payoutScheduledAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
    }));
  } catch (error) {
    console.error('Error getting upcoming payout schedule:', error);
    return [];
  }
}

/**
 * Get payout processing statistics (for admin dashboard)
 */
export async function getPayoutProcessingStats(): Promise<any> {
  const db = await getDb();

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's processing results
    const todayStats = await db.select({
      id: referrals.id,
      payoutProcessedAt: referrals.payoutProcessedAt,
    })
      .from(referrals)
      .where(gte(referrals.payoutProcessedAt, today));

    // Get pending payouts count
    const pendingStats = await db.select({
      count: sql<number>`count(*)`,
    })
      .from(referrals)
      .where(and(
        eq(referrals.status, "completed"),
        isNull(referrals.payoutProcessedAt),
        lte(referrals.payoutScheduledAt, new Date()),
      ));

    // Get total paid out
    const totalPaidStats = await db.select({
      total: sql<number>`COALESCE(SUM(${referralPayouts.amount}), 0)`,
    })
      .from(referralPayouts)
      .where(eq(referralPayouts.status, "completed"));

    return {
      processedToday: todayStats.length,
      pendingProcessing: Number(pendingStats[0]?.count) || 0,
      totalPaidOut: Number(totalPaidStats[0]?.total) || 0,
      lastProcessingTime: todayStats.length > 0
        ? todayStats[todayStats.length - 1].payoutProcessedAt
        : null,
    };
  } catch (error) {
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
export async function getUserPayoutTimeline(userId: number): Promise<any[]> {
  const db = await getDb();

  try {
    const userReferrals = await db.select({
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

    const payouts = await db.select({
      id: referralPayouts.id,
      amount: referralPayouts.amount,
      status: referralPayouts.status,
      createdAt: referralPayouts.createdAt,
      processedAt: referralPayouts.processedAt,
      method: referralPayouts.method,
    })
      .from(referralPayouts)
      .where(eq(referralPayouts.userId, userId))
      .orderBy(desc(referralPayouts.createdAt));

    return userReferrals.map(referral => {
      const payout = payouts.find(p =>
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
        daysUntilPayout: referral.payoutScheduledAt && !referral.payoutProcessedAt
          ? Math.ceil((new Date(referral.payoutScheduledAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
      };
    });
  } catch (error) {
    console.error('Error getting user payout timeline:', error);
    return [];
  }
}
