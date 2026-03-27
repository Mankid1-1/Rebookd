/**
 * 💳 STRIPE CHECKOUT SERVICE
 * Complete Stripe Checkout integration with metered billing
 */

import Stripe from 'stripe';
import { getDb } from '../db';
import { TRPCError } from '@trpc/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

// Price IDs from Stripe Dashboard
const FIXED_PRICE_ID = process.env.STRIPE_FIXED_PRICE_ID || 'price_FIXED_199';
const METERED_PRICE_ID = process.env.STRIPE_METERED_PRICE_ID || 'price_METERED_15';

// ─── Soft Launch: 30-day free trial for all founding clients ──────────────
const SOFT_LAUNCH_TRIAL_DAYS = 30;
const SOFT_LAUNCH_ACTIVE = true; // Set false when founding program ends

// Flex Plan tiered pricing: subscription scales with estimated monthly recovery
// Tiers ensure clients always keep the majority of recovered revenue
// Revenue share (20%) is metered separately via METERED_PRICE_ID
const FLEX_PRICE_MAP: Record<number, string> = {
  29: 'price_1TFDQgPC6Kl5W2cCWAdbB1ne',   // $29/mo — recovery up to $300/mo
  49: 'price_1TFDQhPC6Kl5W2cCLP4dsOdp',   // $49/mo — recovery $301-$500/mo
  79: 'price_1TExaTPC6Kl5W2cCMh7LayCd',   // $79/mo — recovery $501-$800/mo
  99: 'price_1TExaUPC6Kl5W2cC865JZHpr',   // $99/mo — recovery $801-$1200/mo
  129: 'price_1TFDQiPC6Kl5W2cCFVVkGscB',  // $129/mo — recovery $1201-$1800/mo
  149: 'price_1TExaWPC6Kl5W2cC5siHQ6qj',  // $149/mo — recovery $1800+/mo
};

function getFlexPriceId(sliderValue: number): string {
  const targetPrice = sliderValue <= 300 ? 29
    : sliderValue <= 500 ? 49
    : sliderValue <= 800 ? 79
    : sliderValue <= 1200 ? 99
    : sliderValue <= 1800 ? 129
    : 149;
  return FLEX_PRICE_MAP[targetPrice] || FLEX_PRICE_MAP[49];
}

export interface CheckoutSessionData {
  customerEmail: string;
  userId: string;
  tenantId: string;
  referralCode?: string;
  planType?: 'growth' | 'flex';
  flexSliderValue?: number; // $200-$2500 estimated monthly recovery slider
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

    // Determine which price to use
    const planType = data.planType || 'growth';
    const basePriceId = planType === 'flex' && data.flexSliderValue
      ? getFlexPriceId(data.flexSliderValue)
      : FIXED_PRICE_ID;

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price: basePriceId,
        quantity: 1,
      },
    ];

    // Both plans get metered revenue share (Rebooked 15%, Flex 20% of recovered revenue)
    lineItems.push({
      price: METERED_PRICE_ID,
    });

    // Soft launch: 30-day free trial — no charge until positive ROI
    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {};
    if (SOFT_LAUNCH_ACTIVE) {
      subscriptionData.trial_period_days = SOFT_LAUNCH_TRIAL_DAYS;
      subscriptionData.metadata = {
        softLaunch: 'true',
        foundingClient: 'true',
        roiGuarantee: 'true',
        planType,
        flexSliderValue: String(data.flexSliderValue || ''),
      };
    }

    // Create checkout session with trial
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      customer_email: customerEmail,
      line_items: lineItems,
      subscription_data: subscriptionData,
      success_url: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      payment_method_types: ['card', 'cashapp', 'link'],
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
        flexSliderValue: String(data.flexSliderValue || ''),
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
    
    await (db as any).insert('subscriptions').values({
      id: subscription.id,
      userId: session.metadata?.userId,
      tenantId: session.metadata?.tenantId,
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
    await (db as any).update('subscriptions')
      .set({ 
        cancelAtPeriodEnd: true,
        updatedAt: new Date()
      })
      .where('id', '=', subscriptionId);
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
    await (db as any).update('subscriptions')
      .set({ 
        cancelAtPeriodEnd: false,
        updatedAt: new Date()
      })
      .where('id', '=', subscriptionId);
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
    const result = await processReferral(referralCode, userId);
    
    if (result.success && result.referral) {
      // Complete the referral (6+ months requirement will be checked)
      await completeReferral(result.referral.id, subscriptionId, 6);
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
