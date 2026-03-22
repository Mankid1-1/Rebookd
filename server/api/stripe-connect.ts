/**
 * 🚀 STRIPE CONNECT API ROUTES
 * Multi-tenant Stripe Connect platform endpoints
 * Based on Stripe sample code with Rebooked integration
 */

import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { stripeConnectService } from '../services/stripe-connect.service';
import { TRPCError } from '@trpc/server';

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

// Create a new Stripe Connect account
export const createConnectAccount = publicProcedure
  .input(createConnectAccountSchema)
  .mutation(async ({ input }) => {
    try {
      const account = await stripeConnectService.createConnectAccount(input);
      return { success: true, account };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
      });
    }
  });

// Create account link for onboarding
export const createAccountLink = publicProcedure
  .input(z.object({ accountId: z.string().min(1) }))
  .mutation(async ({ input }) => {
    try {
      const accountLink = await stripeConnectService.createAccountLink(input.accountId);
      return { success: true, url: accountLink.url };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
      });
    }
  });

// Get account status and requirements
export const getAccountStatus = publicProcedure
  .input(z.object({ accountId: z.string().min(1) }))
  .query(async ({ input }) => {
    try {
      const status = await stripeConnectService.getAccountStatus(input.accountId);
      return { success: true, status };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
      });
    }
  });

// Create a product and price for a connected account
export const createProduct = publicProcedure
  .input(createProductSchema)
  .mutation(async ({ input }) => {
    try {
      const product = await stripeConnectService.createProduct(input);
      return { success: true, product };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
      });
    }
  });

// Get products for a specific account
export const getProducts = publicProcedure
  .input(z.object({ accountId: z.string().min(1) }))
  .query(async ({ input }) => {
    try {
      const products = await stripeConnectService.getProducts(input.accountId);
      return { success: true, products };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
      });
    }
  });

// Create checkout session for connected account
export const createCheckoutSession = publicProcedure
  .input(createCheckoutSessionSchema)
  .mutation(async ({ input }) => {
    try {
      const session = await stripeConnectService.createCheckoutSession(input);
      return { success: true, url: session.url, sessionId: session.sessionId };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
      });
    }
  });

// Create subscription to platform (for platform services)
export const subscribeToPlatform = publicProcedure
  .input(z.object({ accountId: z.string().min(1) }))
  .mutation(async ({ input }) => {
    try {
      const session = await stripeConnectService.subscribeToPlatform(input.accountId);
      return { success: true, url: session.url, sessionId: session.sessionId };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
      });
    }
  });

// Create billing portal session
export const createPortalSession = publicProcedure
  .input(createPortalSessionSchema)
  .mutation(async ({ input }) => {
    try {
      const portalSession = await stripeConnectService.createPortalSession(input.session_id);
      return { success: true, url: portalSession.url };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
      });
    }
  });

// Export all procedures
export const stripeConnectRouter = router({
  createConnectAccount,
  createAccountLink,
  getAccountStatus,
  createProduct,
  getProducts,
  createCheckoutSession,
  createPortalSession,
  subscribeToPlatform,
});

export default stripeConnectRouter;
