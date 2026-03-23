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
