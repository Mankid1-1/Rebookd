/**
 * 🎯 REFERRAL PAYOUT PROCESSOR
 * Manual job for processing scheduled referral payouts (no cron dependency)
 */

import { processReferralPayouts } from '../jobs/referral-payout-processor';

/**
 * Start referral payout processor (manual trigger only)
 */
export function startReferralPayoutProcessor(): void {
  console.log('🎯 Referral payout processor ready for manual execution');
  
  // Process payouts can be triggered manually via API endpoint
  // No automatic scheduling - admin controlled only
}

/**
 * Manual trigger for testing (can be called via API)
 */
export async function triggerPayoutProcessing(): Promise<{ processed: number; total: number; message: string }> {
  console.log('🎯 Manually triggering referral payout processing...');
  
  try {
    const result = await processReferralPayouts();
    console.log(`✅ ${result.message}`);
    
    // Send success notification to admin
    await notifyAdminOfPayoutSuccess(result);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error in manual payout processing:', error);
    throw error;
  }
}

/**
 * Notify admin of successful payout processing
 */
async function notifyAdminOfPayoutSuccess(result: { processed: number; total: number; message: string }): Promise<void> {
  // TODO: Implement admin success notification
  console.log(`📧 Admin success notification: ${result.message}`);
}

/**
 * Notify admin of payout processing errors
 */
async function notifyAdminOfPayoutError(error: any): Promise<void> {
  // TODO: Implement admin error notification
  console.error(`📧 Admin error notification: Referral payout processing failed:`, error);
}
  
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
}

/**
 * Get payout processing statistics (for admin dashboard)
 */
export async function getPayoutProcessingStats(): Promise<any> {
  const db = await getDb();
  
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
}
