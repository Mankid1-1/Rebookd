/**
 * 💳 STRIPE CHECKOUT API ROUTES
 * TRPC procedures for Stripe Checkout integration
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure } from '../_core/trpc';
import * as StripeCheckoutService from '../services/stripe-checkout.service';

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

  // Report revenue recovery usage
  reportUsage: protectedProcedure
    .input(reportUsageSchema)
    .mutation(async ({ input }) => {
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
  getCurrentUsage: protectedProcedure
    .input(getCurrentUsageSchema)
    .query(async ({ input }) => {
      const usage = await StripeCheckoutService.getCurrentUsage(input.customerId);
      
      return {
        success: true,
        usage,
        estimatedCharge: usage * 0.15, // 15% of recovered revenue
        message: `Current usage: $${usage} recovered revenue`,
      };
    }),

  // Create customer portal session
  createPortalSession: protectedProcedure
    .input(createPortalSessionSchema)
    .mutation(async ({ input }) => {
      const portalUrl = await StripeCheckoutService.createCustomerPortalSession(input.customerId);
      
      return {
        success: true,
        portalUrl,
        message: "Customer portal session created",
      };
    }),

  // Cancel subscription
  cancelSubscription: protectedProcedure
    .input(cancelSubscriptionSchema)
    .mutation(async ({ input }) => {
      await StripeCheckoutService.cancelSubscription(input.subscriptionId);
      
      return {
        success: true,
        message: "Subscription will be cancelled at period end",
      };
    }),

  // Resume cancelled subscription
  resumeSubscription: protectedProcedure
    .input(resumeSubscriptionSchema)
    .mutation(async ({ input }) => {
      await StripeCheckoutService.resumeSubscription(input.subscriptionId);
      
      return {
        success: true,
        message: "Subscription resumed successfully",
      };
    }),

  // Get subscription details
  getSubscriptionDetails: protectedProcedure
    .input(getSubscriptionDetailsSchema)
    .query(async ({ input }) => {
      const subscription = await StripeCheckoutService.getSubscriptionDetails(input.subscriptionId);
      
      return {
        success: true,
        subscription,
        message: "Subscription details retrieved",
      };
    }),
};
