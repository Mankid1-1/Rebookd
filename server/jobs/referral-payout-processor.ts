/**
 * 🎯 REFERRAL PAYOUT PROCESSOR
 * Processes referral payouts 1 month after completion
 */

import { processScheduledPayouts } from '../services/referral.service';
import { getDb } from '../db';

// Export the function for external use
export { processScheduledPayouts };

/**
 * Manual trigger for processing scheduled payouts
 * Can be called via API endpoint or admin dashboard
 */
export async function processReferralPayouts(): Promise<{ processed: number; total: number; message: string }> {
  console.log('🎯 Processing scheduled referral payouts...');
  
  try {
    const result = await processScheduledPayouts();
    
    const message = result.processed > 0 
      ? `Successfully processed ${result.processed} referral payouts out of ${result.total} scheduled`
      : `No payouts ready for processing (${result.total} scheduled)`;
    
    console.log(`✅ ${message}`);
    
    return {
      processed: result.processed,
      total: result.total,
      message
    };
  } catch (error) {
    console.error('❌ Error processing referral payouts:', error);
    
    return {
      processed: 0,
      total: 0,
      message: `Error processing payouts: ${error.message}`
    };
  }
}

/**
 * Get upcoming payout schedule (for admin dashboard)
 */
export async function getUpcomingPayoutSchedule(): Promise<any[]> {
  const db = await getDb();
  
  try {
    const upcomingPayouts = await (db as any).select({
      id: true,
      referrerId: true,
      rewardAmount: true,
      payoutScheduledAt: true,
      completedAt: true,
    })
      .from("referrals")
      .where("status", "=", "completed")
      .where("payoutScheduledAt", ">", new Date())
      .where("payoutProcessedAt", "=", null)
      .orderBy("payoutScheduledAt", "asc")
      .limit(50);

    return upcomingPayouts.map(payout => ({
      ...payout,
      daysUntilPayout: Math.ceil((new Date(payout.payoutScheduledAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
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
    // Get today's processing results
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayStats = await (db as any).select({
      processed: true,
    })
      .from("referrals")
      .where("payoutProcessedAt", ">=", today);

    // Get pending payouts
    const pendingStats = await (db as any).select({
      count: true,
    })
      .from("referrals")
      .where("status", "=", "completed")
      .where("payoutProcessedAt", "=", null)
      .where("payoutScheduledAt", "<=", new Date());

    // Get total paid out
    const totalPaidStats = await (db as any).select({
      amount: true,
    })
      .from("referral_payouts")
      .where("status", "=", "completed");

    const totalPaid = totalPaidStats.reduce((sum, p) => sum + p.amount, 0);

    return {
      processedToday: todayStats.length,
      pendingProcessing: pendingStats[0]?.count || 0,
      totalPaidOut: totalPaid,
      lastProcessingTime: todayStats.length > 0 ? todayStats[todayStats.length - 1].processedAt : null,
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
export async function getUserPayoutTimeline(userId: string): Promise<any[]> {
  const db = await getDb();
  
  try {
    const referrals = await (db as any).select({
      id: true,
      referralCode: true,
      referredUserId: true,
      status: true,
      rewardAmount: true,
      completedAt: true,
      payoutScheduledAt: true,
      payoutProcessedAt: true,
      createdAt: true,
    })
      .from("referrals")
      .where("referrerId", "=", userId)
      .orderBy("createdAt", "desc");

    // Get payout records
    const payouts = await (db as any).select({
      amount: true,
      status: true,
      createdAt: true,
      processedAt: true,
      method: true,
    })
      .from("referral_payouts")
      .where("userId", "=", userId)
      .orderBy("createdAt", "desc");

    return referrals.map(referral => {
      const payout = payouts.find(p => p.amount === referral.rewardAmount && p.createdAt >= (referral.completedAt || new Date()));
      
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
          ? Math.ceil((new Date(referral.payoutScheduledAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          : null,
      };
    });
  } catch (error) {
    console.error('Error getting user payout timeline:', error);
    return [];
  }
}
