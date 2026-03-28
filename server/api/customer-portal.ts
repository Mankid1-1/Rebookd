/**
 * 🎯 CUSTOMER PORTAL API ROUTES
 * TRPC procedures for Stripe Customer Portal integration
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure } from '../_core/trpc';
import * as CustomerPortalService from '../services/customer-portal.service';

// Validation schemas
const createPortalSessionSchema = z.object({
  customerId: z.string(),
  returnUrl: z.string().optional(),
  allowPromotionCodes: z.boolean().default(true),
  billingAddressCollection: z.enum(['auto', 'required']).default('auto'),
});

const getSubscriptionDetailsSchema = z.object({
  customerId: z.string(),
});

const updatePaymentMethodSchema = z.object({
  customerId: z.string(),
  paymentMethodId: z.string(),
});

const removePaymentMethodSchema = z.object({
  customerId: z.string(),
  paymentMethodId: z.string(),
});

const addPaymentMethodSchema = z.object({
  customerId: z.string(),
  paymentMethodId: z.string(),
});

const getBillingHistorySchema = z.object({
  customerId: z.string(),
  limit: z.number().min(1).max(100).default(12),
});

const downloadInvoiceSchema = z.object({
  invoiceId: z.string(),
});

const createSetupIntentSchema = z.object({
  customerId: z.string(),
});

export const customerPortalRouter = {
  // Create Customer Portal session
  createPortalSession: protectedProcedure
    .input(createPortalSessionSchema)
    .mutation(async ({ input }) => {
      const session = await CustomerPortalService.createCustomerPortalSession({
        customerId: input.customerId,
        returnUrl: input.returnUrl,
        allowPromotionCodes: input.allowPromotionCodes,
        billingAddressCollection: input.billingAddressCollection,
      });
      
      return {
        success: true,
        portalUrl: session.url,
        sessionId: session.sessionId,
        message: "Customer portal session created successfully",
      };
    }),

  // Get subscription details for portal display
  getSubscriptionDetails: protectedProcedure
    .input(getSubscriptionDetailsSchema)
    .query(async ({ input }) => {
      const details = await CustomerPortalService.getCustomerSubscriptionDetails(input.customerId);
      
      return {
        success: true,
        details,
        message: "Subscription details retrieved successfully",
      };
    }),

  // Update default payment method
  updateDefaultPaymentMethod: protectedProcedure
    .input(updatePaymentMethodSchema)
    .mutation(async ({ input }) => {
      await CustomerPortalService.updateDefaultPaymentMethod(
        input.customerId,
        input.paymentMethodId
      );
      
      return {
        success: true,
        message: "Default payment method updated successfully",
      };
    }),

  // Remove payment method
  removePaymentMethod: protectedProcedure
    .input(removePaymentMethodSchema)
    .mutation(async ({ input }) => {
      await CustomerPortalService.removePaymentMethod(
        input.customerId,
        input.paymentMethodId
      );
      
      return {
        success: true,
        message: "Payment method removed successfully",
      };
    }),

  // Add new payment method
  addPaymentMethod: protectedProcedure
    .input(addPaymentMethodSchema)
    .mutation(async ({ input }) => {
      await CustomerPortalService.addPaymentMethod(
        input.customerId,
        input.paymentMethodId
      );
      
      return {
        success: true,
        message: "Payment method added successfully",
      };
    }),

  // Get billing history
  getBillingHistory: protectedProcedure
    .input(getBillingHistorySchema)
    .query(async ({ input }) => {
      const history = await CustomerPortalService.getBillingHistory(
        input.customerId,
        input.limit
      );
      
      return {
        success: true,
        history,
        total: history.length,
        message: "Billing history retrieved successfully",
      };
    }),

  // Download invoice PDF
  downloadInvoice: protectedProcedure
    .input(downloadInvoiceSchema)
    .query(async ({ input }) => {
      const pdfUrl = await CustomerPortalService.downloadInvoicePdf(input.invoiceId);
      
      return {
        success: true,
        pdfUrl,
        message: "Invoice PDF download link generated",
      };
    }),

  // Get upcoming invoice details
  getUpcomingInvoice: protectedProcedure
    .input(getSubscriptionDetailsSchema)
    .query(async ({ input }) => {
      const upcomingInvoice = await CustomerPortalService.getUpcomingInvoice(input.customerId);
      
      return {
        success: true,
        upcomingInvoice,
        message: "Upcoming invoice details retrieved",
      };
    }),

  // Create setup intent for adding payment method
  createSetupIntent: protectedProcedure
    .input(createSetupIntentSchema)
    .mutation(async ({ input }) => {
      const setupIntent = await CustomerPortalService.createSetupIntent(input.customerId);
      
      return {
        success: true,
        setupIntent,
        message: "Setup intent created successfully",
      };
    }),
};
