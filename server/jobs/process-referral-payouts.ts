/**
 * REFERRAL PAYOUT PROCESSOR
 * Manual job for processing scheduled referral payouts (no cron dependency)
 */

import { processReferralPayouts } from './referral-payout-processor';
import type { PayoutResult } from './referral-payout-processor';

/**
 * Start referral payout processor (manual trigger only)
 */
export function startReferralPayoutProcessor(): void {
  console.log('Referral payout processor ready for manual execution');

  // Process payouts can be triggered manually via API endpoint
  // No automatic scheduling - admin controlled only
}

/**
 * Manual trigger for testing (can be called via API)
 */
export async function triggerPayoutProcessing(): Promise<PayoutResult> {
  console.log('Manually triggering referral payout processing...');

  try {
    const result = await processReferralPayouts();
    console.log(result.message);

    await notifyAdminOfPayoutSuccess(result);

    return result;
  } catch (error: unknown) {
    console.error('Error in manual payout processing:', error);
    await notifyAdminOfPayoutError(error);
    throw error;
  }
}

/**
 * Notify admin of successful payout processing
 */
async function notifyAdminOfPayoutSuccess(result: PayoutResult): Promise<void> {
  // TODO: Implement admin success notification (e.g. email or in-app alert)
  console.log(`Admin notification: ${result.message}`);
}

/**
 * Notify admin of payout processing errors
 */
async function notifyAdminOfPayoutError(error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  // TODO: Implement admin error notification (e.g. email or Sentry alert)
  console.error(`Admin error notification: Referral payout processing failed: ${message}`);
}
