/**
 * 🎯 REFERRAL PAYOUT PROCESSOR
 * Manual job for processing scheduled referral payouts (no cron dependency)
 */

import { processReferralPayouts } from '../jobs/referral-payout-processor';
import { EmailService } from '../services/email.service';
import { ENV } from '../_core/env';

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

    // Send error notification to admin
    await notifyAdminOfPayoutError(error);

    throw error;
  }
}

/**
 * Notify admin of successful payout processing
 */
async function notifyAdminOfPayoutSuccess(result: { processed: number; total: number; message: string }): Promise<void> {
  const adminEmail = ENV.emailFromAddress || 'hello@rebooked.com';
  const timestamp = new Date().toISOString();

  try {
    await EmailService.sendEmail({
      to: adminEmail,
      subject: `[Rebooked] Referral Payout Report - ${result.processed} processed`,
      text: [
        `Referral Payout Processing Complete`,
        ``,
        `Timestamp: ${timestamp}`,
        `Payouts processed: ${result.processed}`,
        `Total scheduled: ${result.total}`,
        ``,
        `Summary: ${result.message}`,
      ].join('\n'),
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Referral Payout Report</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #0D1B2A;">Referral Payout Processing Complete</h2>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Timestamp</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${timestamp}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Payouts Processed</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${result.processed}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Total Scheduled</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${result.total}</td></tr>
    </table>
    <p>${result.message}</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="font-size: 12px; color: #666;">Rebooked Admin Notification</p>
  </div>
</body>
</html>`,
    });
    console.log(`📧 Admin success notification sent to ${adminEmail}`);
  } catch (emailErr) {
    // Log but don't throw - notification failure shouldn't break payout flow
    console.error(`📧 Failed to send admin success notification:`, emailErr);
  }
}

/**
 * Notify admin of payout processing errors
 */
async function notifyAdminOfPayoutError(error: any): Promise<void> {
  const adminEmail = ENV.emailFromAddress || 'hello@rebooked.com';
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  try {
    await EmailService.sendEmail({
      to: adminEmail,
      subject: `[Rebooked] ALERT: Referral Payout Processing Failed`,
      text: [
        `Referral Payout Processing FAILED`,
        ``,
        `Timestamp: ${timestamp}`,
        `Error: ${errorMessage}`,
        errorStack ? `\nStack trace:\n${errorStack}` : '',
        ``,
        `Action required: Please investigate and retry payout processing manually.`,
      ].join('\n'),
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Payout Error Alert</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #c0392b;">Referral Payout Processing FAILED</h2>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Timestamp</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${timestamp}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Error</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee; color: #c0392b;">${errorMessage}</td></tr>
    </table>
    ${errorStack ? `<details><summary>Stack Trace</summary><pre style="background: #f8f8f8; padding: 12px; overflow-x: auto; font-size: 12px;">${errorStack}</pre></details>` : ''}
    <p style="background: #ffeaa7; padding: 12px; border-radius: 4px;"><strong>Action required:</strong> Please investigate and retry payout processing manually.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="font-size: 12px; color: #666;">Rebooked Admin Alert</p>
  </div>
</body>
</html>`,
    });
    console.error(`📧 Admin error notification sent to ${adminEmail}`);
  } catch (emailErr) {
    // Log but don't throw - notification failure shouldn't mask the original error
    console.error(`📧 Failed to send admin error notification:`, emailErr);
  }
}
