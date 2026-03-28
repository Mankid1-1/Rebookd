/**
 * 🎯 STRIPE WEBHOOK HANDLER
 * Complete webhook event processing for subscription lifecycle management
 */

import Stripe from 'stripe';
import { getDb } from '../db';
import { TRPCError } from '@trpc/server';
import * as UserService from '../services/user.service';
import * as EmailService from '../services/email.service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

export interface WebhookEvent {
  type: string;
  data: {
    object: Record<string, unknown> & { id?: string };
  };
}

/**
 * Process Stripe webhook events
 */
export async function processStripeWebhook(event: WebhookEvent): Promise<void> {
  const db = await getDb();
  
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

    // Log webhook event for audit
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

  // Store subscription in database
  await (db as any).insert('subscriptions').values({
    id: subscription.id,
    userId: parseInt(userId || '0'),
    tenantId: parseInt(tenantId || '0'),
    customerId: customerId,
    status: subscription.status,
    priceId: subscription.items.data[0]?.price?.id || '',
    quantity: subscription.items.data[0]?.quantity || 1,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    metadata: {
      referralCode: referralCode || '',
      meteredPriceId: subscription.items.data.find(item => 
        item.price?.recurring?.usage_type === 'metered'
      )?.price?.id || '',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Update user with Stripe customer ID
  if (userId) {
    await (db as any).update('users')
      .set({ 
        stripeCustomerId: customerId,
        updatedAt: new Date()
      })
      .where('id', '=', parseInt(userId));
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

  // Update subscription status
  await (db as any).update('subscriptions')
    .set({ 
      status: 'active',
      updatedAt: new Date()
    })
    .where('id', '=', subscriptionId);

  // Get user for notification
  const user = await (db as any).select({
    id: true,
    email: true,
    name: true
  })
    .from('users')
    .where('stripeCustomerId', '=', customerId)
    .limit(1);

  if (user.length > 0) {
    // Send payment confirmation email
    await sendPaymentConfirmationEmail(user[0].id, invoice.amount_paid / 100);
  }

  // Log payment event
  await logPaymentEvent({
    customerId,
    subscriptionId,
    amount: invoice.amount_paid,
    status: 'paid',
    invoiceId: invoice.id,
    createdAt: new Date(),
  });
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

  // Update subscription status
  await (db as any).update('subscriptions')
    .set({ 
      status: 'past_due',
      updatedAt: new Date()
    })
    .where('id', '=', subscriptionId);

  // Get user for notification
  const user = await (db as any).select({
    id: true,
    email: true,
    name: true
  })
    .from('users')
    .where('stripeCustomerId', '=', customerId)
    .limit(1);

  if (user.length > 0) {
    // Send payment failure email
    await sendInvoicePaymentFailureEmail(user[0].id, invoice.amount_due / 100);
  }

  // Log payment event
  await logPaymentEvent({
    customerId,
    subscriptionId,
    amount: invoice.amount_due,
    status: 'failed',
    invoiceId: invoice.id,
    createdAt: new Date(),
  });
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
  const user = await (db as any).select({
    id: true,
    email: true,
    name: true
  })
    .from('users')
    .where('stripeCustomerId', '=', customerId)
    .limit(1);

  if (user.length > 0) {
    // Send upcoming invoice email
    await sendUpcomingInvoiceEmail(user[0].id, invoice.amount_due / 100);
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

  // Update subscription in database
  await (db as any).update('subscriptions')
    .set({ 
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date()
    })
    .where('id', '=', subscription.id);
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const db = await getDb();
  
  console.log(`❌ Subscription deleted: ${subscription.id}`);

  // Update subscription status
  await (db as any).update('subscriptions')
    .set({ 
      status: 'canceled',
      updatedAt: new Date()
    })
    .where('id', '=', subscription.id);

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

  // Update customer email in database if changed
  if (customer.email) {
    await (db as any).update('users')
      .set({ 
        email: customer.email,
        updatedAt: new Date()
      })
      .where('stripeCustomerId', '=', customer.id);
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

// Helper functions

async function processReferralCompletion(referralCode: string, userId: string, subscriptionId: string): Promise<void> {
  try {
    const { processReferral, completeReferral } = await import('../services/referral.service');
    
    const result = await processReferral(referralCode, userId);
    
    if (result.success && result.referral) {
      await completeReferral(result.referral.id, subscriptionId, 6);
    }
  } catch (error) {
    console.error('Failed to process referral completion:', error);
  }
}

async function activateUserAccount(userId: number): Promise<void> {
  const db = await getDb();
  
  await (db as any).update('users')
    .set({ 
      active: true,
      updatedAt: new Date()
    })
    .where('id', '=', userId);
}

async function deactivateUserAccount(userId?: string): Promise<void> {
  if (!userId) return;
  
  const db = await getDb();
  
  await (db as any).update('users')
    .set({ 
      active: false,
      updatedAt: new Date()
    })
    .where('id', '=', parseInt(userId));
}

async function logWebhookEvent(event: WebhookEvent, status: string, error?: string): Promise<void> {
  const db = await getDb();
  
  await (db as any).insert('webhook_events').values({
    id: crypto.randomUUID(),
    eventType: event.type,
    eventId: event.data.object.id ?? "",
    status,
    error,
    payload: JSON.stringify(event),
    createdAt: new Date(),
  });
}

async function logPaymentEvent(paymentData: {
  customerId: string;
  subscriptionId: string;
  amount: number;
  status: string;
  invoiceId: string;
  createdAt: Date;
}): Promise<void> {
  const db = await getDb();
  
  await (db as any).insert('payment_events').values({
    id: crypto.randomUUID(),
    customerId: paymentData.customerId,
    subscriptionId: paymentData.subscriptionId,
    amount: paymentData.amount,
    status: paymentData.status,
    invoiceId: paymentData.invoiceId,
    createdAt: paymentData.createdAt,
  });
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
