/**
 * 🎯 CUSTOMER PORTAL SERVICE
 * Stripe Customer Portal integration for self-service subscription management
 */

import Stripe from 'stripe';
import { getDb } from '../db';
import { TRPCError } from '@trpc/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

export interface CustomerPortalConfig {
  customerId: string;
  returnUrl?: string;
  allowPromotionCodes?: boolean;
  billingAddressCollection?: 'auto' | 'required';
}

export interface PortalSessionData {
  url: string;
  sessionId: string;
}

/**
 * Create a Customer Portal session for self-service management
 */
export async function createCustomerPortalSession(config: CustomerPortalConfig): Promise<PortalSessionData> {
  try {
    const { customerId, returnUrl, allowPromotionCodes = true, billingAddressCollection = 'auto' } = config;

    // Validate customer exists
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer || customer.deleted) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Customer not found',
      });
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${process.env.FRONTEND_URL}/billing`,
    });

    return {
      url: session.url,
      sessionId: session.id,
    };
  } catch (error) {
    console.error('Failed to create customer portal session:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create customer portal session',
    });
  }
}

/**
 * Get customer's subscription details for portal display
 */
export async function getCustomerSubscriptionDetails(customerId: string): Promise<any> {
  try {
    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 10,
      expand: ['data.customer', 'data.items.data.price'],
    });

    if (subscriptions.data.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No active subscription found',
      });
    }

    const subscription = subscriptions.data[0];

    // Get upcoming invoice
    let upcomingInvoice = null;
    try {
      upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: customerId,
        subscription: subscription.id,
      });
    } catch (error) {
      // No upcoming invoice (might be at end of period)
      console.log('No upcoming invoice found');
    }

    // Get payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
      limit: 5,
    });

    // Get billing history
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 10,
      status: 'paid',
    });

    // Get current usage for metered billing
    const currentUsage = await getCurrentUsage(subscription.id);

    return {
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        items: subscription.items.data.map(item => ({
          id: item.id,
          priceId: item.price?.id,
          nickname: item.price?.nickname || 'Rebooked Subscription',
          amount: item.price?.unit_amount || 0,
          currency: item.price?.currency || 'usd',
          recurring: item.price?.recurring,
          usageType: item.price?.recurring?.usage_type,
          quantity: item.quantity || 1,
        })),
      },
      upcomingInvoice: upcomingInvoice ? {
        amount: upcomingInvoice.amount_due / 100,
        currency: upcomingInvoice.currency,
        dueDate: upcomingInvoice.due_date ? new Date(upcomingInvoice.due_date * 1000) : null,
        lineItems: upcomingInvoice.lines.data.map(line => ({
          description: line.description,
          amount: line.amount / 100,
          quantity: line.quantity || 1,
        })),
      } : null,
      paymentMethods: paymentMethods.data.map(method => ({
        id: method.id,
        type: method.type,
        card: method.card ? {
          brand: method.card.brand,
          last4: method.card.last4,
          expMonth: method.card.exp_month,
          expYear: method.card.exp_year,
        } : null,
        isDefault: method.metadata?.isDefault === 'true',
      })),
      billingHistory: invoices.data.map(invoice => ({
        id: invoice.id,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency,
        status: invoice.status,
        createdAt: new Date(invoice.created * 1000),
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
      })),
      currentUsage,
    };
  } catch (error) {
    console.error('Failed to get customer subscription details:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to retrieve subscription details',
    });
  }
}

/**
 * Get current usage for metered billing
 */
async function getCurrentUsage(subscriptionId: string): Promise<any> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Find metered subscription items
    const meteredItems = subscription.items.data.filter(item => 
      item.price?.recurring?.usage_type === 'metered'
    );

    if (meteredItems.length === 0) {
      return { totalUsage: 0, items: [] };
    }

    const usageData = [];

    for (const item of meteredItems) {
      // Get usage records for this billing period
      const usageRecords = await stripe.subscriptionItems.listUsageRecordSummaries(item.id, {
        limit: 100,
      });

      const totalUsage = usageRecords.data.reduce((sum, record) => {
        return sum + record.total_usage;
      }, 0);

      usageData.push({
        subscriptionItemId: item.id,
        priceId: item.price?.id,
        nickname: item.price?.nickname || 'Revenue Recovery',
        unitAmount: item.price?.unit_amount || 0,
        totalUsage,
        estimatedCharge: totalUsage * (item.price?.unit_amount || 0) / 100, // Convert from cents
      });
    }

    const totalUsage = usageData.reduce((sum, item) => sum + item.estimatedCharge, 0);

    return {
      totalUsage,
      items: usageData,
    };
  } catch (error) {
    console.error('Failed to get current usage:', error);
    return { totalUsage: 0, items: [] };
  }
}

/**
 * Update customer's default payment method
 */
export async function updateDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
  try {
    // Update customer's default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Mark payment method as default in metadata
    await stripe.paymentMethods.update(paymentMethodId, {
      metadata: {
        isDefault: 'true',
      },
    });

    // Unmark other payment methods as default
    const otherPaymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    for (const method of otherPaymentMethods.data) {
      if (method.id !== paymentMethodId) {
        await stripe.paymentMethods.update(method.id, {
          metadata: {
            isDefault: 'false',
          },
        });
      }
    }
  } catch (error) {
    console.error('Failed to update default payment method:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update payment method',
    });
  }
}

/**
 * Remove a payment method
 */
export async function removePaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
  try {
    // Check if it's the default payment method
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    const customer = await stripe.customers.retrieve(customerId);

    if ((customer as any).invoice_settings?.default_payment_method === paymentMethodId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot remove default payment method. Please set a new default first.',
      });
    }

    // Detach the payment method
    await stripe.paymentMethods.detach(paymentMethodId);
  } catch (error) {
    console.error('Failed to remove payment method:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to remove payment method',
    });
  }
}

/**
 * Add a new payment method
 */
export async function addPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
  try {
    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // If this is the first payment method, make it default
    const existingMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    if (existingMethods.data.length === 1) {
      await updateDefaultPaymentMethod(customerId, paymentMethodId);
    }
  } catch (error) {
    console.error('Failed to add payment method:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to add payment method',
    });
  }
}

/**
 * Get customer's billing history
 */
export async function getBillingHistory(customerId: string, limit: number = 12): Promise<any[]> {
  try {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
      expand: ['data.customer'],
    });

    return invoices.data.map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency,
      status: invoice.status,
      createdAt: new Date(invoice.created * 1000),
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      totalTaxAmounts: invoice.total_tax_amounts || [],
      lines: invoice.lines.data.map(line => ({
        id: line.id,
        description: line.description,
        amount: line.amount / 100,
        quantity: line.quantity || 1,
        period: line.period,
      })),
    }));
  } catch (error) {
    console.error('Failed to get billing history:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to retrieve billing history',
    });
  }
}

/**
 * Download invoice PDF
 */
export async function downloadInvoicePdf(invoiceId: string): Promise<string> {
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);

    if (!invoice.invoice_pdf) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Invoice PDF not available',
      });
    }

    return invoice.invoice_pdf;
  } catch (error) {
    console.error('Failed to download invoice PDF:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to download invoice PDF',
    });
  }
}

/**
 * Get customer's upcoming invoice details
 */
export async function getUpcomingInvoice(customerId: string): Promise<any> {
  try {
    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      customer: customerId,
    });

    return {
      id: upcomingInvoice.hosted_invoice_url || 'upcoming',
      amount: upcomingInvoice.amount_due / 100,
      currency: upcomingInvoice.currency,
      dueDate: upcomingInvoice.due_date ? new Date(upcomingInvoice.due_date * 1000) : null,
      lineItems: upcomingInvoice.lines.data.map(line => ({
        id: line.id,
        description: line.description,
        amount: line.amount / 100,
        quantity: line.quantity || 1,
        period: line.period,
        price: line.price ? {
          id: line.price.id,
          nickname: line.price.nickname,
          unitAmount: line.price.unit_amount,
          currency: line.price.currency,
          recurring: line.price.recurring,
        } : null,
      })),
      subtotal: upcomingInvoice.subtotal / 100,
      tax: upcomingInvoice.tax / 100,
      total: upcomingInvoice.total / 100,
    };
  } catch (error) {
    console.error('Failed to get upcoming invoice:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to retrieve upcoming invoice',
    });
  }
}

/**
 * Create a setup intent for adding a new payment method
 */
export async function createSetupIntent(customerId: string): Promise<any> {
  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    return {
      clientSecret: setupIntent.client_secret,
      id: setupIntent.id,
    };
  } catch (error) {
    console.error('Failed to create setup intent:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create setup intent',
    });
  }
}
