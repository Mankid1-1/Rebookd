/**
 * 💳 STRIPE CHECKOUT SERVICE
 * Complete Stripe Checkout integration with metered billing
 */

import Stripe from 'stripe';
import { getDb } from '../db';
import { TRPCError } from '@trpc/server';
import { stripeSubscriptions } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

// Price IDs from Stripe Dashboard
// Professional/Full: $199/mo base + $0.15/unit metered (15% share)
const PROFESSIONAL_FIXED_PRICE_ID = process.env.STRIPE_PRICE_PROFESSIONAL || 'price_1TDqZtPC6Kl5W2cCTLQrYsKS';
const PROFESSIONAL_METERED_PRICE_ID = process.env.STRIPE_METERED_PRICE_ID || 'price_1TDx2sPC6Kl5W2cCGPQgHuXz';
// Flex: slider $29-$149/mo base + $0.20/unit metered (20% share)
const FLEX_DEFAULT_PRICE_ID = process.env.STRIPE_PRICE_FLEX || 'price_1TExaUPC6Kl5W2cC865JZHpr';
const FLEX_METERED_PRICE_ID = process.env.STRIPE_METERED_PRICE_FLEX || 'price_1TFgLpPC6Kl5W2cCdN22c86O';

// Legacy fallbacks
const FIXED_PRICE_ID = PROFESSIONAL_FIXED_PRICE_ID;
const METERED_PRICE_ID = PROFESSIONAL_METERED_PRICE_ID;

export interface CheckoutSessionData {
  customerEmail: string;
  userId: string;
  tenantId: string;
  referralCode?: string;
  /** Recovery event ID for attribution tracking */
  recoveryEventId?: string;
  /** Plan type — determines which Stripe prices to use */
  planType?: 'professional' | 'flex';
  /** For flex plan: specific base price ID from slider selection */
  flexPriceId?: string;
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

    // Select prices based on plan type
    const isFlex = data.planType === 'flex';
    const basePriceId = isFlex
      ? (data.flexPriceId || FLEX_DEFAULT_PRICE_ID)
      : PROFESSIONAL_FIXED_PRICE_ID;
    const meteredPriceId = isFlex
      ? FLEX_METERED_PRICE_ID
      : PROFESSIONAL_METERED_PRICE_ID;

    // Create checkout session with both prices
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      customer_email: customerEmail,
      line_items: [
        {
          price: basePriceId,
          quantity: 1,
        },
        {
          price: meteredPriceId, // Revenue share metered price
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      payment_method_types: ['card'],
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
        recoveryEventId: data.recoveryEventId || '',
        planType: data.planType || 'professional',
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
    
    // Store subscription in database
    const db = await getDb();

    await db.insert(stripeSubscriptions).values({
      id: subscription.id,
      userId: parseInt(session.metadata?.userId || '0', 10),
      tenantId: parseInt(session.metadata?.tenantId || '0', 10),
      customerId: session.customer as string,
      status: subscription.status,
      priceId: FIXED_PRICE_ID,
      quantity: 1,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      metadata: {
        referralCode: session.metadata?.referralCode || '',
        meteredPriceId: METERED_PRICE_ID,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

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
export async function reportRevenueUsage(customerId: string, recoveredAmount: number, recoveryEventId?: string): Promise<void> {
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
      item.price.id === METERED_PRICE_ID || 
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

    console.log(`Reported $${recoveredAmount} revenue recovery for customer ${customerId}${recoveryEventId ? ` (recovery_event: ${recoveryEventId})` : ''}`);
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
      item.price.id === METERED_PRICE_ID || 
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
      return_url: `${process.env.FRONTEND_URL}/billing`,
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

    // Update in database
    const db = await getDb();
    await db.update(stripeSubscriptions)
      .set({
        cancelAtPeriodEnd: true,
        updatedAt: new Date()
      })
      .where(eq(stripeSubscriptions.id, subscriptionId));
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

    // Update in database
    const db = await getDb();
    await db.update(stripeSubscriptions)
      .set({
        cancelAtPeriodEnd: false,
        updatedAt: new Date()
      })
      .where(eq(stripeSubscriptions.id, subscriptionId));
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
    // Import referral service to avoid circular dependency
    const { processReferral, completeReferral } = await import('./referral.service');

    // First process the referral
    const result = await processReferral(referralCode, Number(userId));

    if (result.success && result.referralId) {
      // Complete the referral (6+ months requirement will be checked)
      await completeReferral(result.referralId, subscriptionId, 6);
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
      
    case 'invoice.payment_succeeded':
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
