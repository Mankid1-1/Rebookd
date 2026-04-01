/**
 * 🎯 STRIPE WEBHOOK HANDLER
 * Complete webhook event processing for subscription lifecycle management
 */

import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { TRPCError } from '@trpc/server';
import * as UserService from '../services/user.service';
import * as EmailService from '../services/email.service';
import { subscriptions, users, systemErrorLogs, webhookEvents, recoveryEvents } from '../../drizzle/schema';

// Use centralized Stripe singleton from _core/stripe.ts
import { stripe } from '../_core/stripe';

export interface WebhookEvent {
  type: string;
  id?: string;
  data: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    object: any;
  };
}

// ─── Idempotency: Track processed event IDs to prevent duplicate processing ───
const processedEvents = new Map<string, number>();
const DEDUP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Periodic cleanup every 15 minutes to bound memory usage
setInterval(() => {
  const cutoff = Date.now() - DEDUP_TTL_MS;
  for (const [key, ts] of processedEvents) {
    if (ts < cutoff) processedEvents.delete(key);
  }
}, 15 * 60 * 1000).unref();

function isDuplicateEvent(eventId: string | undefined): boolean {
  if (!eventId) return false;
  const ts = processedEvents.get(eventId);
  if (ts && Date.now() - ts < DEDUP_TTL_MS) return true;
  return false;
}

function markEventProcessed(eventId: string | undefined): void {
  if (!eventId) return;
  processedEvents.set(eventId, Date.now());
  // Cleanup old entries periodically
  if (processedEvents.size > 5000) {
    const cutoff = Date.now() - DEDUP_TTL_MS;
    for (const [key, ts] of processedEvents) {
      if (ts < cutoff) processedEvents.delete(key);
    }
  }
}

// ─── Grace period: Don't immediately downgrade on first payment failure ───────
const PAYMENT_GRACE_PERIOD_DAYS = 3;

/**
 * Process Stripe webhook events
 * FIX #15: Persistent idempotency — check DB in addition to in-memory cache
 */
export async function processStripeWebhook(event: WebhookEvent): Promise<void> {
  // In-memory fast-path check
  if (isDuplicateEvent(event.id)) {
    console.log(`⏭️ Skipping duplicate webhook event (in-memory): ${event.id}`);
    return;
  }

  const db = await getDb();

  // FIX #15: Persistent DB idempotency check (survives restarts)
  if (event.id) {
    try {
      const [existing] = await db
        .select({ id: webhookEvents.id })
        .from(webhookEvents)
        .where(eq(webhookEvents.stripeEventId, event.id))
        .limit(1);
      if (existing) {
        markEventProcessed(event.id); // Warm the in-memory cache
        console.log(`⏭️ Skipping duplicate webhook event (DB): ${event.id}`);
        return;
      }
    } catch {
      // If DB check fails, proceed with processing (fail-open for availability)
    }

    // FIX #15: Log event to DB BEFORE processing (claim the event)
    await logWebhookEvent(event, 'processing');
  }

  try {
    switch (event.type) {
      // Checkout Events
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
        
      case 'checkout.session.async_payment_failed':
        await handleCheckoutSessionPaymentFailed(event.data.object);
        break;

      // Invoice Events
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
        
      case 'invoice.upcoming':
        await handleInvoiceUpcoming(event.data.object);
        break;

      // Subscription Events
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      case 'customer.subscription.trial_will_end':
        await handleSubscriptionTrialWillEnd(event.data.object);
        break;

      // Customer Events
      case 'customer.created':
        await handleCustomerCreated(event.data.object);
        break;
        
      case 'customer.updated':
        await handleCustomerUpdated(event.data.object);
        break;
        
      case 'customer.deleted':
        await handleCustomerDeleted(event.data.object);
        break;

      // Payment Method Events
      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object);
        break;
        
      case 'payment_method.detached':
        await handlePaymentMethodDetached(event.data.object);
        break;

      // Dispute Events
      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object as unknown as Stripe.Dispute);
        break;

      case 'charge.dispute.closed':
        await handleDisputeClosed(event.data.object as unknown as Stripe.Dispute);
        break;

      // Payout Events (for Connect accounts)
      case 'payout.created':
        await handlePayoutCreated(event.data.object);
        break;
        
      case 'payout.failed':
        await handlePayoutFailed(event.data.object);
        break;
        
      case 'payout.paid':
        await handlePayoutPaid(event.data.object);
        break;

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    // Mark as processed for idempotency (in-memory cache)
    markEventProcessed(event.id);

    // FIX #15: Update webhook event status from 'processing' to 'processed'
    await logWebhookEvent(event, 'processed');

  } catch (error) {
    console.error(`Webhook processing failed for ${event.type}:`, error);
    await logWebhookEvent(event, 'failed', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Handle successful checkout session completion
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const db = await getDb();
  
  if (!session.customer || !session.subscription) {
    throw new Error('Invalid session data: missing customer or subscription');
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const userId = session.metadata?.userId;
  const tenantId = session.metadata?.tenantId;
  const referralCode = session.metadata?.referralCode;

  console.log(`✅ Processing checkout completion for user ${userId}, subscription ${subscriptionId}`);

  // Get full subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['customer', 'latest_invoice', 'items.data.price']
  });

  // Store subscription in database using Drizzle ORM
  const tenantIdInt = parseInt(tenantId || '0');
  const existing = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantIdInt)).limit(1);
  const subPayload = {
    stripeId: subscription.id,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    status: (subscription.status as 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete'),
    stripePriceId: subscription.items.data[0]?.price?.id ?? undefined,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    updatedAt: new Date(),
  };
  if (existing[0]) {
    await db.update(subscriptions).set(subPayload).where(eq(subscriptions.tenantId, tenantIdInt));
  } else {
    await db.insert(subscriptions).values({ tenantId: tenantIdInt, ...subPayload });
  }

  // Update user with Stripe customer ID
  if (userId) {
    await db.update(users)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(users.id, parseInt(userId)));
  }

  // Process referral if present
  if (referralCode && userId) {
    await processReferralCompletion(referralCode, userId, subscriptionId);
  }

  // Activate user account
  if (userId) {
    await activateUserAccount(parseInt(userId));
  }

  // Send welcome email
  await sendWelcomeEmail(parseInt(userId || '0'), session.customer_email || '');

  console.log(`✅ Checkout session processed successfully for subscription ${subscriptionId}`);
}

/**
 * Handle checkout session payment failure
 */
async function handleCheckoutSessionPaymentFailed(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId;
  const customerEmail = session.customer_email;

  console.log(`❌ Checkout payment failed for user ${userId}`);

  // Send payment failure email
  await sendPaymentFailureEmail(parseInt(userId || '0'), customerEmail || '');
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const db = await getDb();
  
  if (!invoice.customer || !invoice.subscription) {
    console.log('Invoice paid without customer or subscription, skipping');
    return;
  }

  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;

  console.log(`💰 Invoice paid for subscription ${subscriptionId}, amount: $${invoice.amount_paid / 100}`);

  // Update subscription status using Drizzle ORM
  await db.update(subscriptions)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(subscriptions.stripeId, subscriptionId));

  // Get user for notification
  const userRows = await db.select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (userRows.length > 0) {
    await sendPaymentConfirmationEmail(userRows[0].id, invoice.amount_paid / 100);
  }

  console.log(`[Billing] Invoice paid: ${invoice.id} for subscription ${subscriptionId}, amount $${invoice.amount_paid / 100}`);
}

/**
 * Handle invoice payment failure
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const db = await getDb();
  
  if (!invoice.customer || !invoice.subscription) {
    console.log('Invoice payment failed without customer or subscription, skipping');
    return;
  }

  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;

  console.log(`❌ Invoice payment failed for subscription ${subscriptionId}, amount: $${invoice.amount_due / 100}`);

  // Grace period: check if subscription is already past_due with grace period still active.
  // Only downgrade after PAYMENT_GRACE_PERIOD_DAYS of continued failure.
  const existing = await db.select({ status: subscriptions.status, updatedAt: subscriptions.updatedAt })
    .from(subscriptions)
    .where(eq(subscriptions.stripeId, subscriptionId))
    .limit(1);

  const now = new Date();
  if (existing[0]?.status === 'past_due' && existing[0]?.updatedAt) {
    const daysSincePastDue = (now.getTime() - new Date(existing[0].updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePastDue >= PAYMENT_GRACE_PERIOD_DAYS) {
      // Grace period expired — mark as unpaid (Stripe will handle cancellation)
      await db.update(subscriptions)
        .set({ status: 'unpaid', updatedAt: now })
        .where(eq(subscriptions.stripeId, subscriptionId));
      console.log(`[Billing] Grace period expired for ${subscriptionId} after ${Math.floor(daysSincePastDue)} days`);
    }
    // Still within grace period — keep as past_due, don't update timestamp
  } else {
    // First failure — mark as past_due, start grace period countdown
    await db.update(subscriptions)
      .set({ status: 'past_due', updatedAt: now })
      .where(eq(subscriptions.stripeId, subscriptionId));
  }

  // Get user for notification
  const userRows = await db.select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (userRows.length > 0) {
    await sendInvoicePaymentFailureEmail(userRows[0].id, invoice.amount_due / 100);
  }

  console.log(`[Billing] Invoice payment failed: ${invoice.id} for subscription ${subscriptionId}, amount $${invoice.amount_due / 100}`);
}

/**
 * Handle upcoming invoice notification
 */
async function handleInvoiceUpcoming(invoice: Stripe.Invoice): Promise<void> {
  const db = await getDb();
  
  if (!invoice.customer || !invoice.subscription) {
    return;
  }

  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;

  // Get user for notification
  const userRows = await db.select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (userRows.length > 0) {
    await sendUpcomingInvoiceEmail(userRows[0].id, invoice.amount_due / 100);
  }
}

/**
 * Handle subscription creation
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  console.log(`📝 Subscription created: ${subscription.id}`);
  
  // Subscription is already handled in checkout.session.completed
  // This is for additional logging or side effects
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const db = await getDb();
  
  console.log(`📝 Subscription updated: ${subscription.id}, status: ${subscription.status}`);

  // Update subscription in database using Drizzle ORM
  await db.update(subscriptions)
    .set({
      status: (subscription.status as 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete'),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeId, subscription.id));
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const db = await getDb();
  
  console.log(`❌ Subscription deleted: ${subscription.id}`);

  // Update subscription status using Drizzle ORM
  await db.update(subscriptions)
    .set({ status: 'canceled', updatedAt: new Date() })
    .where(eq(subscriptions.stripeId, subscription.id));

  // Deactivate user account
  await deactivateUserAccount(subscription.metadata?.userId);

  // Send cancellation email
  await sendSubscriptionCancelledEmail(parseInt(subscription.metadata?.userId || '0'));
}

/**
 * Handle trial ending notification
 */
async function handleSubscriptionTrialWillEnd(subscription: Stripe.Subscription): Promise<void> {
  console.log(`⏰ Trial ending for subscription: ${subscription.id}`);

  // Send trial ending email
  await sendTrialEndingEmail(parseInt(subscription.metadata?.userId || '0'));
}

/**
 * Handle customer creation
 */
async function handleCustomerCreated(customer: Stripe.Customer): Promise<void> {
  console.log(`👤 Customer created: ${customer.id}`);
  
  // Customer is already handled in checkout.session.completed
}

/**
 * Handle customer updates
 */
async function handleCustomerUpdated(customer: Stripe.Customer): Promise<void> {
  const db = await getDb();
  
  console.log(`👤 Customer updated: ${customer.id}`);

  // Update customer email in database if changed using Drizzle ORM
  if (customer.email) {
    await db.update(users)
      .set({ email: customer.email, updatedAt: new Date() })
      .where(eq(users.stripeCustomerId, customer.id));
  }
}

/**
 * Handle customer deletion
 */
async function handleCustomerDeleted(customer: Stripe.Customer): Promise<void> {
  console.log(`❌ Customer deleted: ${customer.id}`);
  
  // This is usually handled by subscription deletion
}

/**
 * Handle payment method attachment
 */
async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
  console.log(`💳 Payment method attached: ${paymentMethod.id}`);
}

/**
 * Handle payment method detachment
 */
async function handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
  console.log(`💳 Payment method detached: ${paymentMethod.id}`);
}

/**
 * Handle payout creation (for Connect accounts)
 */
async function handlePayoutCreated(payout: Stripe.Payout): Promise<void> {
  console.log(`💰 Payout created: $${payout.amount / 100}`);
}

/**
 * Handle payout failure
 */
async function handlePayoutFailed(payout: Stripe.Payout): Promise<void> {
  console.log(`❌ Payout failed: $${payout.amount / 100}`);
}

/**
 * Handle payout success
 */
async function handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
  console.log(`✅ Payout paid: $${payout.amount / 100}`);
}

/**
 * Handle dispute creation - alert admin immediately
 */
async function handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
  const db = await getDb();

  console.log(`⚠️ Dispute created: ${dispute.id}, amount: $${dispute.amount / 100}, reason: ${dispute.reason}`);

  // Log as a high-priority system event using Drizzle ORM
  await db.insert(systemErrorLogs).values({
    type: 'billing',
    message: `Stripe dispute created: ${dispute.id} for $${dispute.amount / 100}. Reason: ${dispute.reason}`,
    detail: JSON.stringify({
      disputeId: dispute.id,
      chargeId: typeof dispute.charge === 'string' ? dispute.charge : undefined,
      amount: dispute.amount,
      reason: dispute.reason,
      status: dispute.status,
    }),
    resolved: false,
  });

  // FIX #19: Reverse recovery event commission when dispute is created
  const paymentIntentId = (dispute as any).payment_intent;
  if (paymentIntentId && typeof paymentIntentId === 'string') {
    await db
      .update(recoveryEvents)
      .set({
        commissionStatus: "disputed",
        notes: `Dispute ${dispute.id}: ${dispute.reason}`,
        updatedAt: new Date(),
      })
      .where(eq(recoveryEvents.stripePaymentIntentId, paymentIntentId));
  }
}

/**
 * Handle dispute closure
 */
async function handleDisputeClosed(dispute: Stripe.Dispute): Promise<void> {
  console.log(`📋 Dispute closed: ${dispute.id}, status: ${dispute.status}`);

  const db = await getDb();
  await db.insert(systemErrorLogs).values({
    type: 'billing',
    message: `Stripe dispute closed: ${dispute.id}. Status: ${dispute.status}`,
    detail: JSON.stringify({ disputeId: dispute.id, status: dispute.status }),
    resolved: dispute.status === 'won',
  });

  // FIX #19: Update recovery event commission status based on dispute outcome
  const paymentIntentId = (dispute as any).payment_intent;
  if (paymentIntentId && typeof paymentIntentId === 'string') {
    if (dispute.status === 'lost') {
      // Dispute lost — zero out realized revenue and mark commission reversed
      await db
        .update(recoveryEvents)
        .set({
          realizedRevenue: 0,
          commissionAmount: 0,
          commissionStatus: "reversed",
          notes: `Dispute ${dispute.id} lost — revenue reversed`,
          updatedAt: new Date(),
        })
        .where(eq(recoveryEvents.stripePaymentIntentId, paymentIntentId));
    } else if (dispute.status === 'won') {
      // Dispute won — restore commission status
      await db
        .update(recoveryEvents)
        .set({
          commissionStatus: "pending",
          notes: `Dispute ${dispute.id} won — commission restored`,
          updatedAt: new Date(),
        })
        .where(eq(recoveryEvents.stripePaymentIntentId, paymentIntentId));
    }
  }
}

// Helper functions

async function processReferralCompletion(referralCode: string, userId: string, subscriptionId: string): Promise<void> {
  try {
    const db = await getDb();
    const { processReferral, completeReferral } = await import('../services/referral.service');
    
    const result = await processReferral(db, referralCode, parseInt(userId));
    
    if (result.success && result.referralId) {
      const referralId = result.referralId.split('-')[1]; // Extract referredUserId
      await completeReferral(db, parseInt(referralId), subscriptionId, 6);
    }
  } catch (error) {
    console.error('Failed to process referral completion:', error);
  }
}

async function activateUserAccount(userId: number): Promise<void> {
  if (!userId) return;
  const db = await getDb();
  await db.update(users)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

async function deactivateUserAccount(userId?: string): Promise<void> {
  if (!userId) return;
  const db = await getDb();
  await db.update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id, parseInt(userId)));
}

async function logWebhookEvent(event: WebhookEvent, status: string, error?: string): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(webhookEvents).values({
      stripeEventId: event.id ?? null,
      eventType: event.type,
      status: status as "processed" | "failed" | "skipped",
      objectId: event.data.object?.id ?? null,
      error: error ?? null,
      payload: { type: event.type, objectId: event.data.object?.id },
    });
  } catch (dbErr) {
    // Fallback to console if DB write fails — never let audit logging break webhook processing
    console.error(`[Webhook] Failed to persist audit log: ${dbErr}`);
  }
  console.log(`[Webhook] ${status.toUpperCase()} event=${event.type} id=${event.data.object?.id ?? 'unknown'}${error ? ` error=${error}` : ''}`);
}

async function logPaymentEvent(paymentData: {
  customerId: string;
  subscriptionId: string;
  amount: number;
  status: string;
  invoiceId: string;
  createdAt: Date;
}): Promise<void> {
  // payment_events table not in schema — log to console for audit trail
  console.log(`[Payment] status=${paymentData.status} invoice=${paymentData.invoiceId} sub=${paymentData.subscriptionId} amount=${paymentData.amount}`);
}

// Email functions (placeholders - implement with your email service)
async function sendWelcomeEmail(userId: number, email: string): Promise<void> {
  console.log(`📧 Sending welcome email to ${email} for user ${userId}`);
  // TODO: Implement email sending
}

async function sendPaymentConfirmationEmail(userId: number, amount: number): Promise<void> {
  console.log(`📧 Sending payment confirmation email to user ${userId}, amount: $${amount}`);
  // TODO: Implement email sending
}

async function sendPaymentFailureEmail(userId: number, email: string): Promise<void> {
  console.log(`📧 Sending payment failure email to ${email} for user ${userId}`);
  // TODO: Implement email sending
}

async function sendInvoicePaymentFailureEmail(userId: number, amount: number): Promise<void> {
  console.log(`📧 Sending invoice payment failure email to user ${userId}, amount: $${amount}`);
  // TODO: Implement email sending
}

async function sendUpcomingInvoiceEmail(userId: number, amount: number): Promise<void> {
  console.log(`📧 Sending upcoming invoice email to user ${userId}, amount: $${amount}`);
  // TODO: Implement email sending
}

async function sendSubscriptionCancelledEmail(userId: number): Promise<void> {
  console.log(`📧 Sending subscription cancelled email to user ${userId}`);
  // TODO: Implement email sending
}

async function sendTrialEndingEmail(userId: number): Promise<void> {
  console.log(`📧 Sending trial ending email to user ${userId}`);
  // TODO: Implement email sending
}
