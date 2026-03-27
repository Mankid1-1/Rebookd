/**
 * 🎯 CUSTOMER PORTAL API ROUTES
 * TRPC procedures for Stripe Customer Portal integration
 */

import { z } from 'zod';
import { tenantProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { stripeSubscriptions } from '../../drizzle/schema';
import * as CustomerPortalService from '../services/customer-portal.service';

/** Verify a Stripe customerId belongs to the calling tenant */
async function verifyCustomerOwnership(db: any, tenantId: number, customerId: string) {
  const [sub] = await db.select({ id: stripeSubscriptions.id })
    .from(stripeSubscriptions)
    .where(and(eq(stripeSubscriptions.tenantId, tenantId), eq(stripeSubscriptions.customerId, customerId)))
    .limit(1);
  if (!sub) throw new TRPCError({ code: 'FORBIDDEN', message: 'Customer does not belong to your account' });
}

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
  createPortalSession: tenantProcedure
    .input(createPortalSessionSchema)
    .mutation(async ({ input, ctx }) => {
      await verifyCustomerOwnership(ctx.db, ctx.tenantId, input.customerId);
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
  getSubscriptionDetails: tenantProcedure
    .input(getSubscriptionDetailsSchema)
    .query(async ({ input, ctx }) => {
      await verifyCustomerOwnership(ctx.db, ctx.tenantId, input.customerId);
      const details = await CustomerPortalService.getCustomerSubscriptionDetails(input.customerId);
      
      return {
        success: true,
        details,
        message: "Subscription details retrieved successfully",
      };
    }),

  // Update default payment method
  updateDefaultPaymentMethod: tenantProcedure
    .input(updatePaymentMethodSchema)
    .mutation(async ({ input, ctx }) => {
      await verifyCustomerOwnership(ctx.db, ctx.tenantId, input.customerId);
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
  removePaymentMethod: tenantProcedure
    .input(removePaymentMethodSchema)
    .mutation(async ({ input, ctx }) => {
      await verifyCustomerOwnership(ctx.db, ctx.tenantId, input.customerId);
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
  addPaymentMethod: tenantProcedure
    .input(addPaymentMethodSchema)
    .mutation(async ({ input, ctx }) => {
      await verifyCustomerOwnership(ctx.db, ctx.tenantId, input.customerId);
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
  getBillingHistory: tenantProcedure
    .input(getBillingHistorySchema)
    .query(async ({ input, ctx }) => {
      await verifyCustomerOwnership(ctx.db, ctx.tenantId, input.customerId);
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
  downloadInvoice: tenantProcedure
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
  getUpcomingInvoice: tenantProcedure
    .input(getSubscriptionDetailsSchema)
    .query(async ({ input, ctx }) => {
      await verifyCustomerOwnership(ctx.db, ctx.tenantId, input.customerId);
      const upcomingInvoice = await CustomerPortalService.getUpcomingInvoice(input.customerId);
      
      return {
        success: true,
        upcomingInvoice,
        message: "Upcoming invoice details retrieved",
      };
    }),

  // Create setup intent for adding payment method
  createSetupIntent: tenantProcedure
    .input(createSetupIntentSchema)
    .mutation(async ({ input, ctx }) => {
      await verifyCustomerOwnership(ctx.db, ctx.tenantId, input.customerId);
      const setupIntent = await CustomerPortalService.createSetupIntent(input.customerId);
      
      return {
        success: true,
        setupIntent,
        message: "Setup intent created successfully",
      };
    }),
};
