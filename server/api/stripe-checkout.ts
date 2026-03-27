/**
 * 💳 STRIPE CHECKOUT API ROUTES
 * TRPC procedures for Stripe Checkout integration
 */

import { z } from 'zod';
import { publicProcedure, tenantProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { stripeSubscriptions, subscriptions, plans } from '../../drizzle/schema';
import * as StripeCheckoutService from '../services/stripe-checkout.service';

/** Verify a Stripe customerId belongs to the calling tenant */
async function verifyCustomerOwnership(db: any, tenantId: number, customerId: string) {
  const [sub] = await db.select({ id: stripeSubscriptions.id })
    .from(stripeSubscriptions)
    .where(and(eq(stripeSubscriptions.tenantId, tenantId), eq(stripeSubscriptions.customerId, customerId)))
    .limit(1);
  if (!sub) throw new TRPCError({ code: 'FORBIDDEN', message: 'Customer does not belong to your account' });
}

/** Verify a Stripe subscriptionId belongs to the calling tenant */
async function verifySubscriptionOwnership(db: any, tenantId: number, subscriptionId: string) {
  const [sub] = await db.select({ id: stripeSubscriptions.id })
    .from(stripeSubscriptions)
    .where(and(eq(stripeSubscriptions.tenantId, tenantId), eq(stripeSubscriptions.id, subscriptionId)))
    .limit(1);
  if (!sub) throw new TRPCError({ code: 'FORBIDDEN', message: 'Subscription does not belong to your account' });
}

// Validation schemas
const createCheckoutSessionSchema = z.object({
  customerEmail: z.string().email(),
  referralCode: z.string().optional(),
});

const reportUsageSchema = z.object({
  customerId: z.string(),
  recoveredAmount: z.number().min(0),
});

const createPortalSessionSchema = z.object({
  customerId: z.string(),
});

const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string(),
});

const resumeSubscriptionSchema = z.object({
  subscriptionId: z.string(),
});

const getSubscriptionDetailsSchema = z.object({
  subscriptionId: z.string(),
});

const getCurrentUsageSchema = z.object({
  customerId: z.string(),
});

export const stripeCheckoutRouter = {
  // Create Stripe Checkout Session
  createCheckoutSession: tenantProcedure
    .input(createCheckoutSessionSchema)
    .mutation(async ({ input, ctx }) => {
      const checkoutUrl = await StripeCheckoutService.createCheckoutSession({
        customerEmail: input.customerEmail,
        userId: ctx.user.id.toString(),
        tenantId: ctx.tenantId.toString(),
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

  // Report revenue recovery usage
  reportUsage: tenantProcedure
    .input(reportUsageSchema)
    .mutation(async ({ input, ctx }) => {
      await verifyCustomerOwnership(ctx.db, ctx.tenantId, input.customerId);
      await StripeCheckoutService.reportRevenueUsage(
        input.customerId,
        input.recoveredAmount
      );
      
      return {
        success: true,
        message: `Reported $${input.recoveredAmount} revenue recovery`,
      };
    }),

  // Get current usage for billing period
  getCurrentUsage: tenantProcedure
    .input(getCurrentUsageSchema)
    .query(async ({ input, ctx }) => {
      await verifyCustomerOwnership(ctx.db, ctx.tenantId, input.customerId);
      const usage = await StripeCheckoutService.getCurrentUsage(input.customerId);

      // Look up tenant's plan-specific revenue share rate instead of hardcoded 15%
      const [sub] = await ctx.db.select({ revenueSharePercent: plans.revenueSharePercent })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(eq(subscriptions.tenantId, ctx.tenantId))
        .limit(1);
      const revenueShareRate = (sub?.revenueSharePercent ?? 15) / 100;

      return {
        success: true,
        usage,
        estimatedCharge: usage * revenueShareRate,
        revenueSharePercent: sub?.revenueSharePercent ?? 15,
        message: `Current usage: $${usage} recovered revenue`,
      };
    }),

  // Create customer portal session
  createPortalSession: tenantProcedure
    .input(createPortalSessionSchema)
    .mutation(async ({ input, ctx }) => {
      await verifyCustomerOwnership(ctx.db, ctx.tenantId, input.customerId);
      const portalUrl = await StripeCheckoutService.createCustomerPortalSession(input.customerId);
      
      return {
        success: true,
        portalUrl,
        message: "Customer portal session created",
      };
    }),

  // Cancel subscription
  cancelSubscription: tenantProcedure
    .input(cancelSubscriptionSchema)
    .mutation(async ({ input, ctx }) => {
      await verifySubscriptionOwnership(ctx.db, ctx.tenantId, input.subscriptionId);
      await StripeCheckoutService.cancelSubscription(input.subscriptionId);
      
      return {
        success: true,
        message: "Subscription will be cancelled at period end",
      };
    }),

  // Resume cancelled subscription
  resumeSubscription: tenantProcedure
    .input(resumeSubscriptionSchema)
    .mutation(async ({ input, ctx }) => {
      await verifySubscriptionOwnership(ctx.db, ctx.tenantId, input.subscriptionId);
      await StripeCheckoutService.resumeSubscription(input.subscriptionId);
      
      return {
        success: true,
        message: "Subscription resumed successfully",
      };
    }),

  // Get subscription details
  getSubscriptionDetails: tenantProcedure
    .input(getSubscriptionDetailsSchema)
    .query(async ({ input, ctx }) => {
      await verifySubscriptionOwnership(ctx.db, ctx.tenantId, input.subscriptionId);
      const subscription = await StripeCheckoutService.getSubscriptionDetails(input.subscriptionId);
      
      return {
        success: true,
        subscription,
        message: "Subscription details retrieved",
      };
    }),
};
