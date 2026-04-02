/**
 * 💳 STRIPE CHECKOUT API ROUTES
 * TRPC procedures for Stripe Checkout integration
 */

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { publicProcedure, protectedProcedure } from '../_core/trpc';
import * as StripeCheckoutService from '../services/stripe-checkout.service';
import { subscriptions } from '../../drizzle/schema';

// Validation schemas
const createCheckoutSessionSchema = z.object({
  customerEmail: z.string().email(),
  referralCode: z.string().optional(),
});


export const stripeCheckoutRouter = {
  // Create Stripe Checkout Session
  createCheckoutSession: protectedProcedure
    .input(createCheckoutSessionSchema)
    .mutation(async ({ input, ctx }) => {
      const checkoutUrl = await StripeCheckoutService.createCheckoutSession({
        customerEmail: input.customerEmail,
        userId: ctx.user.id.toString(),
        tenantId: ctx.user.tenantId?.toString() || '',
        referralCode: input.referralCode,
      });
      
      return {
        success: true,
        checkoutUrl,
        message: "Checkout session created successfully",
      };
    }),

  // Process successful checkout (webhook handler)
  processCheckoutSuccess: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      const subscriptionData = await StripeCheckoutService.processSuccessfulCheckout(input.sessionId);
      
      return {
        success: true,
        subscriptionData,
        message: "Checkout processed successfully",
      };
    }),

  // Report revenue recovery usage — uses caller's own subscription, ignores client-supplied customerId
  reportUsage: protectedProcedure
    .input(z.object({ recoveredAmount: z.number().min(0) }))
    .mutation(async ({ input, ctx }) => {
      // Resolve customerId from the caller's own subscription row — never trust client-supplied IDs
      const [sub] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.tenantId, ctx.user.tenantId ?? 0)).limit(1);
      if (!sub?.stripeCustomerId) throw new TRPCError({ code: 'NOT_FOUND', message: 'No active subscription found' });
      await StripeCheckoutService.reportRevenueUsage(sub.stripeCustomerId, input.recoveredAmount);
      return {
        success: true,
        message: `Reported $${input.recoveredAmount} revenue recovery`,
      };
    }),

  // Get current usage for billing period — resolves customerId server-side
  getCurrentUsage: protectedProcedure
    .query(async ({ ctx }) => {
      const [sub] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.tenantId, ctx.user.tenantId ?? 0)).limit(1);
      if (!sub?.stripeCustomerId) return { success: true, usage: 0, estimatedCharge: 0, message: 'No active subscription' };
      const usage = await StripeCheckoutService.getCurrentUsage(sub.stripeCustomerId);
      return {
        success: true,
        usage,
        // Revenue share: 15% for Flex Spots, 0% for Founder Spots
        estimatedCharge: usage * 0.15,
        message: `Current usage: $${usage} recovered revenue`,
      };
    }),

  // Create customer portal session — resolves customerId server-side, never from client
  createPortalSession: protectedProcedure
    .mutation(async ({ ctx }) => {
      const [sub] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.tenantId, ctx.user.tenantId ?? 0)).limit(1);
      if (!sub?.stripeCustomerId) throw new TRPCError({ code: 'NOT_FOUND', message: 'No active subscription found' });
      const portalUrl = await StripeCheckoutService.createCustomerPortalSession(sub.stripeCustomerId);
      return { success: true, portalUrl, message: "Customer portal session created" };
    }),

  // Cancel subscription — verifies ownership against caller's tenant before cancelling
  cancelSubscription: protectedProcedure
    .mutation(async ({ ctx }) => {
      const [sub] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.tenantId, ctx.user.tenantId ?? 0)).limit(1);
      if (!sub?.stripeId) throw new TRPCError({ code: 'NOT_FOUND', message: 'No active subscription found' });
      await StripeCheckoutService.cancelSubscription(sub.stripeId);
      return { success: true, message: "Subscription will be cancelled at period end" };
    }),

  // Resume cancelled subscription — verifies ownership against caller's tenant
  resumeSubscription: protectedProcedure
    .mutation(async ({ ctx }) => {
      const [sub] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.tenantId, ctx.user.tenantId ?? 0)).limit(1);
      if (!sub?.stripeId) throw new TRPCError({ code: 'NOT_FOUND', message: 'No subscription found' });
      await StripeCheckoutService.resumeSubscription(sub.stripeId);
      return { success: true, message: "Subscription resumed successfully" };
    }),

  // Get subscription details — only returns the caller's own subscription
  getSubscriptionDetails: protectedProcedure
    .query(async ({ ctx }) => {
      const [sub] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.tenantId, ctx.user.tenantId ?? 0)).limit(1);
      if (!sub?.stripeId) throw new TRPCError({ code: 'NOT_FOUND', message: 'No subscription found' });
      const subscription = await StripeCheckoutService.getSubscriptionDetails(sub.stripeId);
      return { success: true, subscription, message: "Subscription details retrieved" };
    }),
};
