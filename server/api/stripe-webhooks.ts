/**
 * 🚀 STRIPE WEBHOOK HANDLERS
 * Multi-tenant Stripe Connect webhook processing
 * Based on Stripe sample code with Rebooked integration
 */

import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { stripeConnectService } from '../services/stripe-connect.service';
import { processStripeWebhook } from '../webhooks/stripe-webhook-handler';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';
import { subscriptions, users, systemErrorLogs } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

// Webhook event types
const webhookEventTypes = [
  'customer.subscription.trial_will_end',
  'customer.subscription.deleted',
  'checkout.session.completed',
  'checkout.session.async_payment_failed',
  'account.updated',
  'payout.created',
  'payout.failed',
  'invoice.payment_succeeded',
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
          console.log(`📅 Subscription trial will end: ${status}`);
          // Handle subscription trial ending
          await handleSubscriptionTrialEnding(stripeObject);
          break;

        case 'customer.subscription.deleted':
          stripeObject = event.data.object;
          status = stripeObject.status;
          console.log(`❌ Subscription deleted: ${status}`);
          // Handle subscription deleted
          await handleSubscriptionDeleted(stripeObject);
          break;

        case 'checkout.session.completed':
          stripeObject = event.data.object;
          status = stripeObject.status;
          console.log(`✅ Checkout session completed: ${status}`);
          // Handle checkout session completed
          await handleCheckoutSessionCompleted(stripeObject);
          break;

        case 'checkout.session.async_payment_failed':
          stripeObject = event.data.object;
          status = stripeObject.status;
          console.log(`❌ Checkout session payment failed: ${status}`);
          // Handle checkout session failed
          await handleCheckoutSessionFailed(stripeObject);
          break;

        case 'account.updated':
          stripeObject = event.data.object;
          console.log(`🏢 Connect account updated: ${stripeObject.id}`);
          // Handle account updates
          await handleAccountUpdated(stripeObject);
          break;

        case 'payout.created':
          stripeObject = event.data.object;
          console.log(`💰 Payout created: $${stripeObject.amount / 100}`);
          // Handle payout created
          await handlePayoutCreated(stripeObject);
          break;

        case 'payout.failed':
          stripeObject = event.data.object;
          console.log(`❌ Payout failed: $${stripeObject.amount / 100}`);
          // Handle payout failed
          await handlePayoutFailed(stripeObject);
          break;

        case 'invoice.payment_succeeded':
          stripeObject = event.data.object;
          console.log(`✅ Invoice payment succeeded: $${stripeObject.amount_paid / 100}`);
          // Handle invoice payment succeeded
          await handleInvoicePaymentSucceeded(stripeObject);
          break;

        case 'invoice.payment_failed':
          stripeObject = event.data.object;
          console.log(`❌ Invoice payment failed: $${stripeObject.amount_due / 100}`);
          // Handle invoice payment failed
          await handleInvoicePaymentFailed(stripeObject);
          break;

        default:
          console.log(`ℹ️ Unhandled event type: ${event.type}`);
          break;
      }

      return { 
        success: true, 
        eventType: event.type,
        processed: true,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Webhook processing failed:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Webhook processing failed: ${(error as Error).message}`,
      });
    }
  });

// Event handler functions
async function handleSubscriptionTrialEnding(subscription: any) {
  const db = await getDb();
  try {
    // Update subscription status to indicate trial is ending
    await db.update(subscriptions)
      .set({ status: 'trialing', updatedAt: new Date() })
      .where(eq(subscriptions.stripeId, subscription.id));
    console.log('Subscription trial ending handled:', subscription.id);
  } catch (error) {
    console.error('Failed to handle trial ending:', error);
    await db.insert(systemErrorLogs).values({
      type: 'billing',
      message: `Failed to handle trial ending for subscription ${subscription.id}`,
      detail: (error as Error).message,
    });
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  const db = await getDb();
  try {
    // Cancel subscription in our database
    await db.update(subscriptions)
      .set({ status: 'canceled', updatedAt: new Date() })
      .where(eq(subscriptions.stripeId, subscription.id));
    console.log('Subscription deletion handled:', subscription.id);
  } catch (error) {
    console.error('Failed to handle subscription deletion:', error);
    await db.insert(systemErrorLogs).values({
      type: 'billing',
      message: `Failed to handle subscription deletion for ${subscription.id}`,
      detail: (error as Error).message,
    });
  }
}

async function handleCheckoutSessionCompleted(session: any) {
  try {
    // Process the successful checkout using our comprehensive webhook handler
    await processStripeWebhook({
      type: 'checkout.session.completed',
      data: { object: session }
    });
    console.log('✅ Checkout session processed successfully:', session.id);
  } catch (error) {
    console.error('❌ Failed to process checkout session:', error);
    throw error;
  }
}

async function handleCheckoutSessionFailed(session: any) {
  const db = await getDb();
  try {
    await db.insert(systemErrorLogs).values({
      type: 'billing',
      message: `Checkout session failed: ${session.id}`,
      detail: JSON.stringify({ sessionId: session.id, customerEmail: session.customer_email }),
    });
    console.log('Checkout session failure logged:', session.id);
  } catch (error) {
    console.error('Failed to log checkout failure:', error);
  }
}

async function handleAccountUpdated(account: any) {
  const db = await getDb();
  try {
    // Update user's Stripe Connect account status
    const chargesEnabled = account.charges_enabled;
    const payoutsEnabled = account.payouts_enabled;
    // Log the account update for admin review
    console.log('Connect account updated:', account.id, { chargesEnabled, payoutsEnabled });
  } catch (error) {
    console.error('Failed to handle account update:', error);
    await db.insert(systemErrorLogs).values({
      type: 'billing',
      message: `Failed to handle Connect account update ${account.id}`,
      detail: (error as Error).message,
    });
  }
}

async function handlePayoutCreated(payout: any) {
  const db = await getDb();
  try {
    console.log('Payout created:', payout.id, `$${payout.amount / 100}`);
  } catch (error) {
    console.error('Failed to handle payout creation:', error);
    await db.insert(systemErrorLogs).values({
      type: 'billing',
      message: `Failed to handle payout creation ${payout.id}`,
      detail: (error as Error).message,
    });
  }
}

async function handlePayoutFailed(payout: any) {
  const db = await getDb();
  try {
    await db.insert(systemErrorLogs).values({
      type: 'billing',
      message: `Payout failed: ${payout.id} - $${payout.amount / 100}`,
      detail: JSON.stringify({ payoutId: payout.id, failureCode: payout.failure_code, failureMessage: payout.failure_message }),
    });
    console.log('Payout failure logged:', payout.id);
  } catch (error) {
    console.error('Failed to log payout failure:', error);
  }
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  const db = await getDb();
  try {
    // Update subscription status to active on successful payment
    if (invoice.subscription) {
      await db.update(subscriptions)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(subscriptions.stripeId, invoice.subscription));
    }
    console.log('Invoice payment succeeded:', invoice.id);
  } catch (error) {
    console.error('Failed to handle invoice payment success:', error);
    await db.insert(systemErrorLogs).values({
      type: 'billing',
      message: `Failed to handle invoice payment success ${invoice.id}`,
      detail: (error as Error).message,
    });
  }
}

async function handleInvoicePaymentFailed(invoice: any) {
  const db = await getDb();
  try {
    // Mark subscription as past_due on payment failure
    if (invoice.subscription) {
      await db.update(subscriptions)
        .set({ status: 'past_due', updatedAt: new Date() })
        .where(eq(subscriptions.stripeId, invoice.subscription));
    }
    await db.insert(systemErrorLogs).values({
      type: 'billing',
      message: `Invoice payment failed: ${invoice.id}`,
      detail: JSON.stringify({ invoiceId: invoice.id, subscriptionId: invoice.subscription, amountDue: invoice.amount_due }),
    });
    console.log('Invoice payment failure handled:', invoice.id);
  } catch (error) {
    console.error('Failed to handle invoice payment failure:', error);
  }
}

// Export webhook router
export const stripeWebhookRouter = router({
  processWebhookEvent,
});

export default stripeWebhookRouter;
