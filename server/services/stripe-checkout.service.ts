/**
 * 💳 STRIPE CHECKOUT SERVICE
 * Complete Stripe Checkout integration with metered billing
 */

import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { TRPCError } from '@trpc/server';
import { ENV } from '../_core/env';
import { subscriptions, plans } from '../../drizzle/schema';

// Use the centralized Stripe singleton — do NOT create a second instance
import { stripe } from '../_core/stripe';

// Price IDs from Stripe Dashboard — synced 2026-04-01
// Flex Spots: $199/mo + 15% revenue share (after 35-day free trial)
const FLEX_PRICE_ID = ENV.stripeFlexPriceId;             // $199/mo fixed
const FLEX_METERED_PRICE_ID = ENV.stripeFlexMeteredPriceId; // 15% rev share metered
// Founder Spots: $0/mo forever
const FOUNDER_PRICE_ID = ENV.stripeFounderPriceId;       // $0/mo

// ─── 35-day free trial for Flex clients (homepage source of truth) ────────
const TRIAL_DAYS = 35;
const SOFT_LAUNCH_ACTIVE = process.env.SOFT_LAUNCH_ACTIVE !== 'false';

export interface CheckoutSessionData {
  customerEmail: string;
  userId: string;
  tenantId: string;
  referralCode?: string;
  planType?: 'founder' | 'flex';
}

export interface SubscriptionData {
  customerId: string;
  subscriptionId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

/**
 * Create Stripe Checkout Session with both fixed and metered prices
 */
export async function createCheckoutSession(data: CheckoutSessionData): Promise<string> {
  const { customerEmail, userId, tenantId, referralCode } = data;

  try {
    // Create or retrieve Stripe customer
    let customerId: string;
    
    const existingCustomers = await stripe.customers.list({ email: customerEmail, limit: 1 });
    
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: customerEmail,
        metadata: {
          userId,
          tenantId,
          referralCode: referralCode || '',
        },
      });
      customerId = customer.id;
    }

    const planType = data.planType || 'flex';

    // Build line items based on plan type
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (planType === 'founder') {
      // Founder Spots: $0/mo — no metered billing, no trial needed (already free)
      lineItems.push({ price: FOUNDER_PRICE_ID, quantity: 1 });
    } else {
      // Flex Spots: $199/mo fixed + 15% revenue share metered
      lineItems.push({ price: FLEX_PRICE_ID, quantity: 1 });
      lineItems.push({ price: FLEX_METERED_PRICE_ID });
    }

    // Flex clients get a 35-day free trial — no charge until positive ROI
    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        planType,
        foundingClient: 'true',
        roiGuarantee: planType === 'flex' ? 'true' : 'false',
      },
    };
    if (planType === 'flex' && SOFT_LAUNCH_ACTIVE) {
      subscriptionData.trial_period_days = TRIAL_DAYS;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: lineItems,
      subscription_data: subscriptionData,
      success_url: `${ENV.frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ENV.frontendUrl}/pricing`,
      payment_method_types: planType === 'founder' ? ['card'] : ['card', 'cashapp', 'link'],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      metadata: {
        userId,
        tenantId,
        referralCode: referralCode || '',
        planType,
      },
    });

    return session.url!;
  } catch (error) {
    console.error('Stripe Checkout Session creation failed:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create checkout session',
    });
  }
}

/**
 * Process successful checkout and create subscription record
 */
export async function processSuccessfulCheckout(sessionId: string): Promise<SubscriptionData> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (!session.customer || !session.subscription) {
      throw new Error('Invalid session data');
    }

    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    
    // Store subscription in database using Drizzle ORM
    const db = await getDb();
    const tenantId = session.metadata?.tenantId ? Number(session.metadata.tenantId) : undefined;
    if (tenantId) {
      const existing = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId)).limit(1);
      const subPayload = {
        stripeId: subscription.id,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: session.customer as string,
        status: (subscription.status as 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete'),
        stripePriceId: subscription.items.data[0]?.price?.id ?? undefined,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date(),
      };
      // Resolve planId from Stripe price or fall back to existing/default
      const priceId = subscription.items.data[0]?.price?.id;
      let resolvedPlanId = existing[0]?.planId ?? 1;
      if (priceId) {
        const [matchedPlan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.stripePriceId, priceId)).limit(1);
        if (matchedPlan) resolvedPlanId = matchedPlan.id;
      }
      if (existing[0]) {
        await db.update(subscriptions).set(subPayload).where(eq(subscriptions.tenantId, tenantId));
      } else {
        await db.insert(subscriptions).values({ tenantId, planId: resolvedPlanId, ...subPayload });
      }
    }

    // Process referral if present
    if (session.metadata?.referralCode) {
      await processReferralCompletion(session.metadata.referralCode, session.metadata.userId, subscription.id);
    }

    return {
      customerId: session.customer as string,
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    };
  } catch (error) {
    console.error('Checkout processing failed:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to process checkout',
    });
  }
}

/**
 * Report revenue recovery to Stripe metered billing
 */
export async function reportRevenueUsage(customerId: string, recoveredAmount: number): Promise<void> {
  try {
    // For metered billing, we create usage records on the subscription
    // First get the customer's active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      console.warn('No active subscription found for customer:', customerId);
      return;
    }

    const subscription = subscriptions.data[0];
    
    // Find the metered price subscription item
    const meteredItem = subscription.items.data.find(item => 
      item.price.id === FLEX_METERED_PRICE_ID ||
      item.price.recurring?.usage_type === 'metered'
    );

    if (!meteredItem) {
      console.warn('No metered subscription item found for subscription:', subscription.id);
      return;
    }

    // Create usage record for the metered component
    await stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
      quantity: recoveredAmount, // Report in dollars (or scale to cents if needed)
      action: 'increment',
    });

    console.log(`Reported $${recoveredAmount} revenue recovery for customer ${customerId}`);
  } catch (error) {
    console.error('Failed to report revenue usage:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to report revenue usage',
    });
  }
}

/**
 * Get customer's current usage for the billing period
 */
export async function getCurrentUsage(customerId: string): Promise<number> {
  try {
    // For metered billing, we need to get usage from subscription items
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return 0;
    }

    const subscription = subscriptions.data[0];
    
    // Find the metered price subscription item
    const meteredItem = subscription.items.data.find(item => 
      item.price.id === FLEX_METERED_PRICE_ID ||
      item.price.recurring?.usage_type === 'metered'
    );

    if (!meteredItem) {
      return 0;
    }

    // Get usage records for this billing period
    const usageRecords = await stripe.subscriptionItems.listUsageRecordSummaries(meteredItem.id);
    
    // Calculate total usage for current period
    const totalUsage = usageRecords.data.reduce((sum, record) => {
      return sum + record.total_usage;
    }, 0);

    return totalUsage;
  } catch (error) {
    console.error('Failed to get current usage:', error);
    return 0;
  }
}

/**
 * Create customer portal session for subscription management
 */
export async function createCustomerPortalSession(customerId: string): Promise<string> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${ENV.frontendUrl}/billing`,
    });

    return session.url!;
  } catch (error) {
    console.error('Failed to create customer portal session:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create customer portal session',
    });
  }
}

/**
 * Cancel subscription at period end
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // Update in database using Drizzle ORM
    const db = await getDb();
    await db.update(subscriptions)
      .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(eq(subscriptions.stripeId, subscriptionId));
  } catch (error) {
    console.error('Failed to cancel subscription:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to cancel subscription',
    });
  }
}

/**
 * Resume cancelled subscription
 */
export async function resumeSubscription(subscriptionId: string): Promise<void> {
  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    // Update in database using Drizzle ORM
    const db = await getDb();
    await db.update(subscriptions)
      .set({ cancelAtPeriodEnd: false, updatedAt: new Date() })
      .where(eq(subscriptions.stripeId, subscriptionId));
  } catch (error) {
    console.error('Failed to resume subscription:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to resume subscription',
    });
  }
}

/**
 * Process referral completion when user subscribes
 */
async function processReferralCompletion(referralCode: string, userId: string, subscriptionId: string): Promise<void> {
  try {
    const db = await getDb();
    // Import referral service to avoid circular dependency
    const { processReferral, completeReferral } = await import('./referral.service');
    
    // First process the referral
    const result = await processReferral(db, referralCode, parseInt(userId));
    
    if (result.success && result.referralId) {
      const referralId = result.referralId.split('-')[1]; // Extract referredUserId
      // Complete the referral (6+ months requirement will be checked)
      await completeReferral(db, parseInt(referralId), subscriptionId, 6);
    }
  } catch (error) {
    console.error('Failed to process referral completion:', error);
    // Don't throw error - subscription should still succeed even if referral fails
  }
}

/**
 * Get subscription details from Stripe
 */
export async function getSubscriptionDetails(subscriptionId: string): Promise<any> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['customer', 'latest_invoice'],
    });
    
    return subscription;
  } catch (error) {
    console.error('Failed to get subscription details:', error);
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Subscription not found',
    });
  }
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhook(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      await processSuccessfulCheckout(session.id);
      break;
      
    case 'invoice.paid':
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`Payment succeeded for subscription ${invoice.subscription}`);
      break;
      
    case 'invoice.payment_failed':
      const failedInvoice = event.data.object as Stripe.Invoice;
      console.log(`Payment failed for subscription ${failedInvoice.subscription}`);
      break;
      
    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object as Stripe.Subscription;
      console.log(`Subscription deleted: ${deletedSubscription.id}`);
      break;
      
    default:
      console.log(`Unhandled webhook event type: ${event.type}`);
  }
}
