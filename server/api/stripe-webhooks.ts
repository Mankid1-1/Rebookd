/**
 * STRIPE WEBHOOK HANDLERS
 * Multi-tenant Stripe Connect webhook processing
 * Based on Stripe sample code with Rebooked integration
 */

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { publicProcedure, router } from '../_core/trpc';
import { stripeConnectService } from '../services/stripe-connect.service';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';
import { users, subscriptions, billingInvoices, tenants, systemErrorLogs, plans } from '../../drizzle/schema';
import { EmailService } from '../services/email.service';
import { logger } from '../_core/logger';

// Webhook event types
const webhookEventTypes = [
  'customer.subscription.trial_will_end',
  'customer.subscription.deleted',
  'checkout.session.completed',
  'checkout.session.async_payment_failed',
  'account.updated',
  'payout.created',
  'payout.failed',
  'invoice.paid',
  'invoice.payment_failed',
] as const;

// Process webhook events
export const processWebhookEvent = publicProcedure
  .input(z.object({
    body: z.string(),
    signature: z.string(),
    endpointSecret: z.string(),
  }))
  .mutation(async ({ input }) => {
    try {
      const event = stripeConnectService.constructWebhookEvent(
        input.body,
        input.signature,
        input.endpointSecret
      );

      let stripeObject;
      let status;

      // Handle different event types
      switch (event.type) {
        case 'customer.subscription.trial_will_end':
          stripeObject = event.data.object;
          status = stripeObject.status;
          logger.info(`[Webhook] Subscription trial will end: ${status}`);
          await handleSubscriptionTrialEnding(stripeObject);
          break;

        case 'customer.subscription.deleted':
          stripeObject = event.data.object;
          status = stripeObject.status;
          logger.info(`[Webhook] Subscription deleted: ${status}`);
          await handleSubscriptionDeleted(stripeObject);
          break;

        case 'checkout.session.completed':
          stripeObject = event.data.object;
          status = stripeObject.status;
          logger.info(`[Webhook] Checkout session completed: ${status}`);
          await handleCheckoutSessionCompleted(stripeObject);
          break;

        case 'checkout.session.async_payment_failed':
          stripeObject = event.data.object;
          status = stripeObject.status;
          logger.info(`[Webhook] Checkout session payment failed: ${status}`);
          await handleCheckoutSessionFailed(stripeObject);
          break;

        case 'account.updated':
          stripeObject = event.data.object;
          logger.info(`[Webhook] Connect account updated: ${stripeObject.id}`);
          await handleAccountUpdated(stripeObject);
          break;

        case 'payout.created':
          stripeObject = event.data.object;
          logger.info(`[Webhook] Payout created: $${stripeObject.amount / 100}`);
          await handlePayoutCreated(stripeObject);
          break;

        case 'payout.failed':
          stripeObject = event.data.object;
          logger.info(`[Webhook] Payout failed: $${stripeObject.amount / 100}`);
          await handlePayoutFailed(stripeObject);
          break;

        case 'invoice.paid':
          stripeObject = event.data.object;
          logger.info(`[Webhook] Invoice payment succeeded: $${stripeObject.amount_paid / 100}`);
          await handleInvoicePaymentSucceeded(stripeObject);
          break;

        case 'invoice.payment_failed':
          stripeObject = event.data.object;
          logger.info(`[Webhook] Invoice payment failed: $${stripeObject.amount_due / 100}`);
          await handleInvoicePaymentFailed(stripeObject);
          break;

        default:
          logger.info(`[Webhook] Unhandled event type: ${event.type}`);
          break;
      }

      return {
        success: true,
        eventType: event.type,
        processed: true,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('[Webhook] Processing failed', { detail: String(error) });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Webhook processing failed: ${(error as Error).message}`,
      });
    }
  });

// ─── Helper: look up user by Stripe customer ID ─────────────────────────────

async function findUserByStripeCustomerId(customerId: string) {
  const db = await getDb();
  const result = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  return result[0] ?? null;
}

async function findSubscriptionByStripeId(stripeSubId: string) {
  const db = await getDb();
  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubId))
    .limit(1);
  return result[0] ?? null;
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

async function handleSubscriptionTrialEnding(subscription: any) {
  try {
    logger.info('[Webhook:TrialEnding] Processing subscription', { detail: String(subscription.id) });

    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

    const user = await findUserByStripeCustomerId(customerId);
    if (!user) {
      logger.warn('[Webhook:TrialEnding] No user found for customer', { detail: String(customerId) });
      return;
    }

    // Update subscription trial reminder flag in the database
    const db = await getDb();
    const existingSub = await findSubscriptionByStripeId(subscription.id);

    if (existingSub) {
      await db
        .update(subscriptions)
        .set({ status: 'trialing', trialReminderSent: true, updatedAt: new Date() })
        .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
    }

    // Send trial ending notification email
    const trialEndDate = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toLocaleDateString()
      : 'soon';

    if (user.email) {
      await EmailService.sendEmail({
        to: user.email,
        subject: 'Your Rebooked Trial is Ending Soon',
        text: `Hi ${user.name || 'there'},\n\nYour free trial ends on ${trialEndDate}. To continue using Rebooked without interruption, please add a payment method to your account.\n\nIf you have any questions, just reply to this email.\n\nBest regards,\nThe Rebooked Team`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Trial Ending Soon</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #e67e22;">Your Trial is Ending Soon</h1>
  <p>Hi ${user.name || 'there'},</p>
  <p>Your free trial ends on <strong>${trialEndDate}</strong>. To continue using Rebooked without interruption, please add a payment method to your account.</p>
  <div style="background: #fef9e7; border-left: 4px solid #e67e22; padding: 15px; margin: 20px 0;">
    <strong>What happens next?</strong>
    <p style="margin: 5px 0 0 0;">After your trial ends, your subscription will automatically convert to a paid plan. Make sure your payment details are up to date.</p>
  </div>
  <p>If you have any questions, just reply to this email.</p>
  <p>Best regards,<br>The Rebooked Team</p>
  <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
  <p style="font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} Rebooked. All rights reserved.</p>
</body>
</html>`,
      });
    }

    logger.info(`[Webhook:TrialEnding] Processed successfully for user: ${user.email}`);
  } catch (error) {
    logger.error('[Webhook:TrialEnding] Error', { detail: String(error) });
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  try {
    logger.info('[Webhook:SubDeleted] Processing subscription', { detail: String(subscription.id) });

    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

    const db = await getDb();

    // Update the subscription status to canceled
    const existingSub = await findSubscriptionByStripeId(subscription.id);
    if (existingSub) {
      await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          canceledAt: new Date(),
          endedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
    }

    // Find the user to send cancellation email
    const user = await findUserByStripeCustomerId(customerId);
    if (user?.email) {
      await EmailService.sendEmail({
        to: user.email,
        subject: 'Subscription Canceled - Rebooked',
        text: `Hi ${user.name || 'there'},\n\nYour Rebooked subscription has been canceled. You will continue to have access until the end of your current billing period.\n\nWe're sorry to see you go. If you change your mind, you can resubscribe at any time.\n\nBest regards,\nThe Rebooked Team`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Subscription Canceled</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #e74c3c;">Subscription Canceled</h1>
  <p>Hi ${user.name || 'there'},</p>
  <p>Your Rebooked subscription has been canceled. You will continue to have access until the end of your current billing period.</p>
  <div style="background: #fdf2f2; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0;">
    <strong>Changed your mind?</strong>
    <p style="margin: 5px 0 0 0;">You can resubscribe at any time from your account settings.</p>
  </div>
  <p>We're sorry to see you go. If there's anything we could have done better, please let us know by replying to this email.</p>
  <p>Best regards,<br>The Rebooked Team</p>
  <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
  <p style="font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} Rebooked. All rights reserved.</p>
</body>
</html>`,
      });
    }

    logger.info('[Webhook:SubDeleted] Processed successfully for customer', { detail: String(customerId) });
  } catch (error) {
    logger.error('[Webhook:SubDeleted] Error', { detail: String(error) });
  }
}

async function handleCheckoutSessionCompleted(session: any) {
  try {
    // Persist subscription to DB using proper Drizzle ORM
    const db = await getDb();
    const stripeSubId = typeof session.subscription === 'string' ? session.subscription : undefined;
    const tenantId = session.metadata?.tenantId ? Number(session.metadata.tenantId) : undefined;

    if (stripeSubId && tenantId) {
      const { stripe } = await import('../_core/stripe');
      const sub = await stripe.subscriptions.retrieve(stripeSubId, { expand: ['items.data.price'] }).catch(() => null);
      const existing = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId)).limit(1);
      const payload = {
        stripeId: stripeSubId,
        stripeSubscriptionId: stripeSubId,
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
        status: ((sub?.status ?? 'active') as 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete'),
        currentPeriodStart: sub?.current_period_start ? new Date(sub.current_period_start * 1000) : undefined,
        currentPeriodEnd: sub?.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
        trialEndsAt: sub?.trial_end ? new Date(sub.trial_end * 1000) : undefined,
        updatedAt: new Date(),
      };
      // Resolve planId from Stripe price or fall back to existing/default
      const priceId = sub?.items?.data?.[0]?.price?.id;
      let resolvedPlanId = existing[0]?.planId ?? 1;
      if (priceId) {
        const [matchedPlan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.stripePriceId, priceId)).limit(1);
        if (matchedPlan) resolvedPlanId = matchedPlan.id;
      }
      if (existing[0]) {
        await db.update(subscriptions).set(payload).where(eq(subscriptions.tenantId, tenantId));
      } else {
        await db.insert(subscriptions).values({ tenantId, planId: resolvedPlanId, ...payload });
      }
    }

    // Send confirmation email if we have a customer email
    const customerEmail = session.customer_details?.email || session.customer_email;
    const customerName = session.customer_details?.name || 'there';

    if (customerEmail) {
      await EmailService.sendEmail({
        to: customerEmail,
        subject: 'Welcome to Rebooked - Payment Confirmed',
        text: `Hi ${customerName},\n\nThank you for subscribing to Rebooked! Your payment has been confirmed and your account is now active.\n\nYou can start using all features right away.\n\nBest regards,\nThe Rebooked Team`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Payment Confirmed</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #27ae60;">Payment Confirmed!</h1>
  <p>Hi ${customerName},</p>
  <p>Thank you for subscribing to Rebooked! Your payment has been confirmed and your account is now active.</p>
  <div style="background: #eafaf1; border-left: 4px solid #27ae60; padding: 15px; margin: 20px 0;">
    <strong>You're all set!</strong>
    <p style="margin: 5px 0 0 0;">You can start using all features right away. Log in to your dashboard to get started.</p>
  </div>
  <p>If you need any help getting started, just reply to this email.</p>
  <p>Best regards,<br>The Rebooked Team</p>
  <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
  <p style="font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} Rebooked. All rights reserved.</p>
</body>
</html>`,
      });
    }

    logger.info('[Webhook:CheckoutComplete] Processed successfully', { detail: String(session.id) });
  } catch (error) {
    logger.error('[Webhook:CheckoutComplete] Failed to process checkout session', { detail: String(error) });
  }
}

async function handleCheckoutSessionFailed(session: any) {
  try {
    logger.info('[Webhook:CheckoutFailed] Processing session', { detail: String(session.id) });

    const customerEmail = session.customer_details?.email || session.customer_email;
    const customerName = session.customer_details?.name || 'there';

    // Log the failure in system error logs
    const db = await getDb();
    await db.insert(systemErrorLogs).values({
      type: 'billing',
      message: `Checkout session payment failed: ${session.id}`,
      detail: JSON.stringify({
        sessionId: session.id,
        customerId: session.customer,
        paymentStatus: session.payment_status,
        customerEmail,
      }),
      resolved: false,
    });

    // Send failure notification email
    if (customerEmail) {
      await EmailService.sendEmail({
        to: customerEmail,
        subject: 'Payment Failed - Rebooked',
        text: `Hi ${customerName},\n\nUnfortunately, your payment could not be processed. This can happen for a number of reasons, such as insufficient funds or an expired card.\n\nPlease try again with a different payment method. If you continue to experience issues, please contact our support team.\n\nBest regards,\nThe Rebooked Team`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Payment Failed</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #e74c3c;">Payment Could Not Be Processed</h1>
  <p>Hi ${customerName},</p>
  <p>Unfortunately, your payment could not be processed. This can happen for a number of reasons, such as insufficient funds or an expired card.</p>
  <div style="background: #fdf2f2; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0;">
    <strong>What to do next:</strong>
    <ul style="margin: 5px 0 0 0; padding-left: 20px;">
      <li>Check that your card details are correct</li>
      <li>Try a different payment method</li>
      <li>Contact your bank if the problem persists</li>
    </ul>
  </div>
  <p>If you continue to experience issues, please contact our support team by replying to this email.</p>
  <p>Best regards,<br>The Rebooked Team</p>
  <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
  <p style="font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} Rebooked. All rights reserved.</p>
</body>
</html>`,
      });
    }

    logger.info('[Webhook:CheckoutFailed] Processed successfully', { detail: String(session.id) });
  } catch (error) {
    logger.error('[Webhook:CheckoutFailed] Error', { detail: String(error) });
  }
}

async function handleAccountUpdated(account: any) {
  try {
    logger.info('[Webhook:AccountUpdated] Processing account', { detail: String(account.id) });

    const db = await getDb();

    // Find the tenant linked to this Stripe Connect account
    // Since there is no dedicated connect accounts table, we log the event
    // and update tenants if a matching user with this account is found
    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;
    const detailsSubmitted = account.details_submitted ?? false;

    logger.info('[Webhook:AccountUpdated] Account status', {
      accountId: account.id,
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted,
      requirementsDue: account.requirements?.currently_due?.length ?? 0,
    });

    // Log significant account status changes to system error logs for admin visibility
    if (account.requirements?.currently_due?.length > 0) {
      await db.insert(systemErrorLogs).values({
        type: 'billing',
        message: `Stripe Connect account ${account.id} has outstanding requirements`,
        detail: JSON.stringify({
          accountId: account.id,
          chargesEnabled,
          payoutsEnabled,
          detailsSubmitted,
          currentlyDue: account.requirements.currently_due,
          eventuallyDue: account.requirements.eventually_due,
          pastDue: account.requirements.past_due,
        }),
        resolved: false,
      });
    }

    // If the account has been disabled, notify admin
    if (!chargesEnabled || !payoutsEnabled) {
      const adminUsers = await db
        .select()
        .from(users)
        .where(eq(users.role, 'admin'));

      for (const admin of adminUsers) {
        if (admin.email) {
          await EmailService.sendEmail({
            to: admin.email,
            subject: `Stripe Connect Account Requires Attention - ${account.id}`,
            text: `A Stripe Connect account requires attention.\n\nAccount ID: ${account.id}\nCharges Enabled: ${chargesEnabled}\nPayouts Enabled: ${payoutsEnabled}\nDetails Submitted: ${detailsSubmitted}\n\nPlease review the account in the Stripe Dashboard.`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Connect Account Update</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #e67e22;">Connect Account Requires Attention</h1>
  <p>A Stripe Connect account needs review:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Account ID</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${account.id}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Charges Enabled</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${chargesEnabled ? 'Yes' : 'No'}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Payouts Enabled</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${payoutsEnabled ? 'Yes' : 'No'}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Details Submitted</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${detailsSubmitted ? 'Yes' : 'No'}</td></tr>
  </table>
  <p>Please review the account in the <a href="https://dashboard.stripe.com/connect/accounts/${account.id}">Stripe Dashboard</a>.</p>
  <p>Best regards,<br>Rebooked System</p>
</body>
</html>`,
          });
        }
      }
    }

    logger.info('[Webhook:AccountUpdated] Processed successfully', { detail: String(account.id) });
  } catch (error) {
    logger.error('[Webhook:AccountUpdated] Error', { detail: String(error) });
  }
}

async function handlePayoutCreated(payout: any) {
  try {
    logger.info('[Webhook:PayoutCreated] Processing payout', { detail: String(payout.id) });

    const amountDollars = (payout.amount / 100).toFixed(2);
    const currency = (payout.currency || 'usd').toUpperCase();
    const arrivalDate = payout.arrival_date
      ? new Date(payout.arrival_date * 1000).toLocaleDateString()
      : 'pending';

    // Log the payout event in system logs for record-keeping
    const db = await getDb();
    await db.insert(systemErrorLogs).values({
      type: 'billing',
      message: `Payout created: ${payout.id} - $${amountDollars} ${currency}`,
      detail: JSON.stringify({
        payoutId: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        arrivalDate: payout.arrival_date,
        method: payout.method,
        status: payout.status,
        destination: payout.destination,
      }),
      resolved: true, // Payout creation is informational, not an error
    });

    // Notify admin users about the payout
    const adminUsers = await db
      .select()
      .from(users)
      .where(eq(users.role, 'admin'));

    for (const admin of adminUsers) {
      if (admin.email) {
        await EmailService.sendEmail({
          to: admin.email,
          subject: `Payout Created - $${amountDollars} ${currency}`,
          text: `A new payout has been initiated.\n\nPayout ID: ${payout.id}\nAmount: $${amountDollars} ${currency}\nExpected Arrival: ${arrivalDate}\nMethod: ${payout.method || 'standard'}\n\nThis payout will be deposited to your bank account automatically.`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Payout Created</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #27ae60;">Payout Initiated</h1>
  <p>A new payout has been created and is on its way to your bank account.</p>
  <div style="background: #eafaf1; border-left: 4px solid #27ae60; padding: 15px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 5px 10px;"><strong>Amount</strong></td><td style="padding: 5px 10px;">$${amountDollars} ${currency}</td></tr>
      <tr><td style="padding: 5px 10px;"><strong>Payout ID</strong></td><td style="padding: 5px 10px;">${payout.id}</td></tr>
      <tr><td style="padding: 5px 10px;"><strong>Expected Arrival</strong></td><td style="padding: 5px 10px;">${arrivalDate}</td></tr>
      <tr><td style="padding: 5px 10px;"><strong>Method</strong></td><td style="padding: 5px 10px;">${payout.method || 'standard'}</td></tr>
    </table>
  </div>
  <p>Best regards,<br>Rebooked System</p>
</body>
</html>`,
        });
      }
    }

    logger.info('[Webhook:PayoutCreated] Processed successfully', { detail: String(payout.id) });
  } catch (error) {
    logger.error('[Webhook:PayoutCreated] Error', { detail: String(error) });
  }
}

async function handlePayoutFailed(payout: any) {
  try {
    logger.info('[Webhook:PayoutFailed] Processing payout failure', { detail: String(payout.id) });

    const amountDollars = (payout.amount / 100).toFixed(2);
    const currency = (payout.currency || 'usd').toUpperCase();
    const failureCode = payout.failure_code || 'unknown';
    const failureMessage = payout.failure_message || 'No details available';

    // Log the failure in system error logs and flag for admin review
    const db = await getDb();
    await db.insert(systemErrorLogs).values({
      type: 'billing',
      message: `Payout FAILED: ${payout.id} - $${amountDollars} ${currency} - ${failureCode}`,
      detail: JSON.stringify({
        payoutId: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        failureCode,
        failureMessage,
        destination: payout.destination,
        method: payout.method,
      }),
      resolved: false, // Needs admin attention
    });

    // Notify admin users about the failure
    const adminUsers = await db
      .select()
      .from(users)
      .where(eq(users.role, 'admin'));

    for (const admin of adminUsers) {
      if (admin.email) {
        await EmailService.sendEmail({
          to: admin.email,
          subject: `URGENT: Payout Failed - $${amountDollars} ${currency}`,
          text: `A payout has failed and requires immediate attention.\n\nPayout ID: ${payout.id}\nAmount: $${amountDollars} ${currency}\nFailure Code: ${failureCode}\nFailure Reason: ${failureMessage}\n\nPlease review the payout in the Stripe Dashboard and take corrective action.`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Payout Failed</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #e74c3c;">Payout Failed</h1>
  <p>A payout has failed and requires immediate attention.</p>
  <div style="background: #fdf2f2; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 5px 10px;"><strong>Amount</strong></td><td style="padding: 5px 10px;">$${amountDollars} ${currency}</td></tr>
      <tr><td style="padding: 5px 10px;"><strong>Payout ID</strong></td><td style="padding: 5px 10px;">${payout.id}</td></tr>
      <tr><td style="padding: 5px 10px;"><strong>Failure Code</strong></td><td style="padding: 5px 10px;">${failureCode}</td></tr>
      <tr><td style="padding: 5px 10px;"><strong>Failure Reason</strong></td><td style="padding: 5px 10px;">${failureMessage}</td></tr>
    </table>
  </div>
  <p><strong>Action required:</strong> Please review the payout in the <a href="https://dashboard.stripe.com/payouts/${payout.id}">Stripe Dashboard</a> and take corrective action.</p>
  <p>Best regards,<br>Rebooked System</p>
</body>
</html>`,
        });
      }
    }

    logger.info('[Webhook:PayoutFailed] Processed and admins notified', { detail: String(payout.id) });
  } catch (error) {
    logger.error('[Webhook:PayoutFailed] Error', { detail: String(error) });
  }
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  try {
    logger.info('[Webhook:InvoiceSuccess] Processing invoice', { detail: String(invoice.id) });

    const db = await getDb();
    const amountPaidDollars = ((invoice.amount_paid || 0) / 100).toFixed(2);

    // Update or insert the invoice record in billing_invoices
    const existingInvoice = await db
      .select()
      .from(billingInvoices)
      .where(eq(billingInvoices.stripeInvoiceId, invoice.id))
      .limit(1);

    if (existingInvoice.length > 0) {
      await db
        .update(billingInvoices)
        .set({
          status: invoice.status || 'paid',
          amountPaid: invoice.amount_paid || 0,
          amountRemaining: invoice.amount_remaining || 0,
          stripeChargeId: invoice.charge || null,
          hostedInvoiceUrl: invoice.hosted_invoice_url || null,
          invoicePdfUrl: invoice.invoice_pdf || null,
          updatedAt: new Date(),
        })
        .where(eq(billingInvoices.stripeInvoiceId, invoice.id));
    } else {
      // Find the tenant via the subscription's customer ID
      const customerId = typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;
      const user = customerId ? await findUserByStripeCustomerId(customerId) : null;
      const tenantId = user?.tenantId;

      if (tenantId) {
        await db.insert(billingInvoices).values({
          tenantId,
          stripeInvoiceId: invoice.id,
          stripeChargeId: invoice.charge || null,
          number: invoice.number || null,
          status: invoice.status || 'paid',
          currency: invoice.currency || 'usd',
          subtotal: invoice.subtotal || 0,
          total: invoice.total || 0,
          amountPaid: invoice.amount_paid || 0,
          amountRemaining: invoice.amount_remaining || 0,
          hostedInvoiceUrl: invoice.hosted_invoice_url || null,
          invoicePdfUrl: invoice.invoice_pdf || null,
          periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
          periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
        });
      }
    }

    // Update the stripe subscription status if applicable
    if (invoice.subscription) {
      const subId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id;

      const existingSub = await findSubscriptionByStripeId(subId);
      if (existingSub) {
        await db
          .update(subscriptions)
          .set({
            status: 'active',
            latestInvoiceId: invoice.id,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.stripeSubscriptionId, subId));
      }
    }

    // Send payment confirmation email
    const customerId = typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;
    const user = customerId ? await findUserByStripeCustomerId(customerId) : null;

    if (user?.email) {
      const invoiceUrl = invoice.hosted_invoice_url || '#';
      const invoicePdf = invoice.invoice_pdf || null;

      await EmailService.sendEmail({
        to: user.email,
        subject: `Payment Confirmed - $${amountPaidDollars}`,
        text: `Hi ${user.name || 'there'},\n\nYour payment of $${amountPaidDollars} has been processed successfully.\n\nInvoice: ${invoice.number || invoice.id}\n\nView your invoice: ${invoiceUrl}\n\nThank you for your continued subscription.\n\nBest regards,\nThe Rebooked Team`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Payment Confirmed</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #27ae60;">Payment Confirmed</h1>
  <p>Hi ${user.name || 'there'},</p>
  <p>Your payment has been processed successfully.</p>
  <div style="background: #eafaf1; border-left: 4px solid #27ae60; padding: 15px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 5px 10px;"><strong>Amount</strong></td><td style="padding: 5px 10px;">$${amountPaidDollars}</td></tr>
      <tr><td style="padding: 5px 10px;"><strong>Invoice</strong></td><td style="padding: 5px 10px;">${invoice.number || invoice.id}</td></tr>
    </table>
  </div>
  <p><a href="${invoiceUrl}" style="display: inline-block; background: #27ae60; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Invoice</a>${invoicePdf ? ` &nbsp; <a href="${invoicePdf}" style="display: inline-block; background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Download PDF</a>` : ''}</p>
  <p>Thank you for your continued subscription.</p>
  <p>Best regards,<br>The Rebooked Team</p>
  <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
  <p style="font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} Rebooked. All rights reserved.</p>
</body>
</html>`,
      });
    }

    logger.info('[Webhook:InvoiceSuccess] Processed successfully', { detail: String(invoice.id) });
  } catch (error) {
    logger.error('[Webhook:InvoiceSuccess] Error', { detail: String(error) });
  }
}

async function handleInvoicePaymentFailed(invoice: any) {
  try {
    logger.info('[Webhook:InvoiceFailed] Processing invoice', { detail: String(invoice.id) });

    const db = await getDb();
    const amountDueDollars = ((invoice.amount_due || 0) / 100).toFixed(2);

    // Update the invoice record if it exists
    const existingInvoice = await db
      .select()
      .from(billingInvoices)
      .where(eq(billingInvoices.stripeInvoiceId, invoice.id))
      .limit(1);

    if (existingInvoice.length > 0) {
      await db
        .update(billingInvoices)
        .set({
          status: invoice.status || 'open',
          amountPaid: invoice.amount_paid || 0,
          amountRemaining: invoice.amount_remaining || 0,
          updatedAt: new Date(),
        })
        .where(eq(billingInvoices.stripeInvoiceId, invoice.id));
    }

    // Update the subscription status to past_due
    if (invoice.subscription) {
      const subId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id;

      const existingSub = await findSubscriptionByStripeId(subId);
      if (existingSub) {
        await db
          .update(subscriptions)
          .set({
            status: 'past_due',
            latestInvoiceId: invoice.id,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.stripeSubscriptionId, subId));
      }
    }

    // Log the failure for admin review
    await db.insert(systemErrorLogs).values({
      type: 'billing',
      message: `Invoice payment failed: ${invoice.id} - $${amountDueDollars}`,
      detail: JSON.stringify({
        invoiceId: invoice.id,
        customerId: invoice.customer,
        subscriptionId: invoice.subscription,
        amountDue: invoice.amount_due,
        attemptCount: invoice.attempt_count,
        nextPaymentAttempt: invoice.next_payment_attempt,
      }),
      resolved: false,
    });

    // Send payment failure email with retry link
    const customerId = typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;
    const user = customerId ? await findUserByStripeCustomerId(customerId) : null;

    if (user?.email) {
      const retryUrl = invoice.hosted_invoice_url || '#';
      const nextAttempt = invoice.next_payment_attempt
        ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString()
        : null;

      await EmailService.sendEmail({
        to: user.email,
        subject: `Payment Failed - Action Required`,
        text: `Hi ${user.name || 'there'},\n\nWe were unable to process your payment of $${amountDueDollars} for your Rebooked subscription.\n\n${nextAttempt ? `We will automatically retry on ${nextAttempt}.` : ''}\n\nTo update your payment method or pay now, visit: ${retryUrl}\n\nIf your payment is not resolved, your account may be suspended.\n\nBest regards,\nThe Rebooked Team`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Payment Failed</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #e74c3c;">Payment Failed</h1>
  <p>Hi ${user.name || 'there'},</p>
  <p>We were unable to process your payment of <strong>$${amountDueDollars}</strong> for your Rebooked subscription.</p>
  <div style="background: #fdf2f2; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0;">
    <strong>What happens next?</strong>
    ${nextAttempt ? `<p style="margin: 5px 0 0 0;">We will automatically retry your payment on <strong>${nextAttempt}</strong>.</p>` : ''}
    <p style="margin: 5px 0 0 0;">To avoid any interruption to your service, please update your payment method as soon as possible.</p>
  </div>
  <p><a href="${retryUrl}" style="display: inline-block; background: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Update Payment Method</a></p>
  <p>If your payment is not resolved, your account access may be limited.</p>
  <p>Need help? Just reply to this email and our team will assist you.</p>
  <p>Best regards,<br>The Rebooked Team</p>
  <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
  <p style="font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} Rebooked. All rights reserved.</p>
</body>
</html>`,
      });
    }

    logger.info('[Webhook:InvoiceFailed] Processed and user notified', { detail: String(invoice.id) });
  } catch (error) {
    logger.error('[Webhook:InvoiceFailed] Error', { detail: String(error) });
  }
}

// Export webhook router
export const stripeWebhookRouter = router({
  processWebhookEvent,
});

export default stripeWebhookRouter;
