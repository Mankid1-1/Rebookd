/**
 * 🚀 STRIPE CONNECT SERVICE
 * Multi-tenant Stripe Connect platform implementation
 * Based on Stripe sample code with Rebooked integration
 */

import Stripe from 'stripe';
import { z } from 'zod';

// Types for Stripe Connect
export interface ConnectAccount {
  id: string;
  email: string;
  display_name: string;
  payouts_enabled: boolean;
  charges_enabled: boolean;
  details_submitted: boolean;
  requirements?: any;
}

export interface ConnectAccountLink {
  url: string;
}

export interface ConnectProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  priceId: string;
  period?: string;
  image: string;
}

export interface CheckoutSession {
  url: string;
  sessionId: string;
}

export interface PortalSession {
  url: string;
}

// Validation schemas
const createConnectAccountSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
});

const createProductSchema = z.object({
  productName: z.string().min(1),
  productDescription: z.string().min(1),
  productPrice: z.number().min(50), // Minimum $0.50
  accountId: z.string().min(1),
});

const createCheckoutSessionSchema = z.object({
  priceId: z.string().min(1),
  accountId: z.string().min(1),
});

const createPortalSessionSchema = z.object({
  session_id: z.string().min(1),
});

class StripeConnectService {
  private stripe: Stripe;

  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2022-11-15',
    });
  }

  /**
   * Create a new Stripe Connect account
   */
  async createConnectAccount(data: z.infer<typeof createConnectAccountSchema>): Promise<ConnectAccount> {
    const validated = createConnectAccountSchema.parse(data);

    try {
      const account = await this.stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: validated.email,
        business_profile: {
          name: validated.displayName,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      return {
        id: account.id,
        email: validated.email,
        display_name: validated.displayName,
        payouts_enabled: account.payouts_enabled,
        charges_enabled: account.charges_enabled,
        details_submitted: account.details_submitted,
      };
    } catch (error) {
      console.error('Error creating Connect account:', error);
      throw new Error(`Failed to create Connect account: ${error.message}`);
    }
  }

  /**
   * Create account link for onboarding
   */
  async createAccountLink(accountId: string): Promise<ConnectAccountLink> {
    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        type: 'account_onboarding',
        refresh_url: `${process.env.APP_URL}/onboarding/refresh`,
        return_url: `${process.env.APP_URL}/onboarding/complete?accountId=${accountId}`,
      });

      return { url: accountLink.url };
    } catch (error) {
      console.error('Error creating account link:', error);
      throw new Error(`Failed to create account link: ${error.message}`);
    }
  }

  /**
   * Get account status and requirements
   */
  async getAccountStatus(accountId: string): Promise<ConnectAccount> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);

      return {
        id: account.id,
        email: account.email || '',
        display_name: account.business_profile?.name || '',
        payouts_enabled: account.payouts_enabled,
        charges_enabled: account.charges_enabled,
        details_submitted: account.details_submitted,
        requirements: account.requirements,
      };
    } catch (error) {
      console.error('Error getting account status:', error);
      throw new Error(`Failed to get account status: ${error.message}`);
    }
  }

  /**
   * Create a product and price for a connected account
   */
  async createProduct(data: z.infer<typeof createProductSchema>): Promise<ConnectProduct> {
    const validated = createProductSchema.parse(data);

    try {
      // Create the product on the connected account
      const product = await this.stripe.products.create(
        {
          name: validated.productName,
          description: validated.productDescription,
        },
        { stripeAccount: validated.accountId }
      );

      // Create a price for the product on the connected account
      const price = await this.stripe.prices.create(
        {
          product: product.id,
          unit_amount: validated.productPrice,
          currency: 'usd',
        },
        { stripeAccount: validated.accountId }
      );

      return {
        id: product.id,
        name: validated.productName,
        description: validated.productDescription,
        price: validated.productPrice,
        priceId: price.id,
        image: 'https://i.imgur.com/6Mvijcm.png',
      };
    } catch (error) {
      console.error('Error creating product:', error);
      throw new Error(`Failed to create product: ${error.message}`);
    }
  }

  /**
   * Get products for a specific account
   */
  async getProducts(accountId: string): Promise<ConnectProduct[]> {
    try {
      const options: any = {
        expand: ['data.product'],
        active: true,
        limit: 100,
      };

      // If accountId is not 'platform', fetch from connected account
      if (accountId !== 'platform') {
        options.stripeAccount = accountId;
      }

      const prices = await this.stripe.prices.list(options);

      return prices.data.map((price: any) => ({
        id: price.product.id,
        name: price.product.name,
        description: price.product.description,
        price: price.unit_amount,
        priceId: price.id,
        period: price.recurring ? price.recurring.interval : null,
        image: 'https://i.imgur.com/6Mvijcm.png',
      }));
    } catch (error) {
      console.error('Error fetching products:', error);
      throw new Error(`Failed to fetch products: ${error.message}`);
    }
  }

  /**
   * Create checkout session for connected account
   */
  async createCheckoutSession(data: z.infer<typeof createCheckoutSessionSchema>): Promise<CheckoutSession> {
    const validated = createCheckoutSessionSchema.parse(data);

    try {
      // Get the price's type from Stripe
      const price = await this.stripe.prices.retrieve(validated.priceId, {
        stripeAccount: validated.accountId,
      });
      const priceType = price.type;
      const mode = priceType === 'recurring' ? 'subscription' : 'payment';

      const session = await this.stripe.checkout.sessions.create({
        line_items: [
          {
            price: validated.priceId,
            quantity: 1,
          },
        ],
        mode,
        success_url: `${process.env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL}/checkout/cancel`,
        payment_intent_data: {
          application_fee_amount: 123, // Platform fee in cents
        },
      }, {
        stripeAccount: validated.accountId,
      });

      return {
        url: session.url,
        sessionId: session.id,
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error(`Failed to create checkout session: ${error.message}`);
    }
  }

  /**
   * Create subscription to platform (for platform services)
   */
  async subscribeToPlatform(accountId: string): Promise<CheckoutSession> {
    try {
      const priceId = process.env.STRIPE_FLEX_PRICE_ID;
      if (!priceId) {
        throw new Error('STRIPE_FLEX_PRICE_ID environment variable is required');
      }

      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${process.env.APP_URL}?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${process.env.APP_URL}?canceled=true`,
      });

      return {
        url: session.url,
        sessionId: session.id,
      };
    } catch (error) {
      console.error('Error creating platform subscription:', error);
      throw new Error(`Failed to create platform subscription: ${error.message}`);
    }
  }

  /**
   * Create billing portal session
   */
  async createPortalSession(sessionId: string): Promise<PortalSession> {
    const validated = createPortalSessionSchema.parse({ session_id: sessionId });

    try {
      // Get the Stripe customer we previously created
      const session = await this.stripe.checkout.sessions.retrieve(validated.session_id);
      
      const portalSession = await this.stripe.billingPortal.sessions.create({
        customer: (session as any).customer,
        return_url: `${process.env.APP_URL}/?session_id=${validated.session_id}`,
      });

      return { url: portalSession.url };
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw new Error(`Failed to create portal session: ${error.message}`);
    }
  }

  /**
   * Parse webhook event
   */
  constructWebhookEvent(body: string, signature: string, secret: string) {
    try {
      return this.stripe.webhooks.constructEvent(body, signature, secret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error(`Webhook signature verification failed: ${error.message}`);
    }
  }
}

// Export singleton instance
export const stripeConnectService = new StripeConnectService();
export default stripeConnectService;
