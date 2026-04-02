import { z } from "zod";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { subscriptions } from "../../drizzle/schema";
import { tenantProcedure, publicProcedure, router } from "../_core/trpc";
import type { Db } from "../_core/context";
import * as TenantService from "../services/tenant.service";
import * as BillingService from "../services/billing.service";
import * as AdminAuditService from "../services/admin-audit.service";
import * as StripeCheckoutService from "../services/stripe-checkout.service";

async function auditAdminRead(
  ctx: { db: Db; user: { id: number; email?: string | null }; req: { path?: string } },
  action: string,
  metadata?: Record<string, unknown>,
) {
  await AdminAuditService.recordAdminAudit(ctx.db, {
    adminUserId: ctx.user.id,
    adminEmail: ctx.user.email,
    action,
    route: ctx.req.path,
    metadata,
    targetTenantId: typeof metadata?.tenantId === "number" ? metadata.tenantId : undefined,
    targetUserId: typeof metadata?.userId === "number" ? metadata.userId : undefined,
  });
}

export const billingRouter = router({
  createCheckoutSession: tenantProcedure
    .input(z.object({
      priceId: z.string().optional(),
      planType: z.enum(['founder', 'flex']).default('flex'),
      referralCode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const checkoutUrl = await StripeCheckoutService.createCheckoutSession({
        customerEmail: ctx.user.email ?? '',
        userId: ctx.user.id.toString(),
        tenantId: String(ctx.tenantId),
        planType: input.planType,
        referralCode: input.referralCode,
      });
      return { url: checkoutUrl, id: null };
    }),

  changePlan: tenantProcedure
    .input(z.object({ priceId: z.string(), prorateImmediately: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      // Check if this is an admin operation and audit it
      if (ctx.user.role === 'admin') {
        await auditAdminRead(ctx, "admin.billing.changePlan", {
          targetTenantId: ctx.tenantId,
          priceId: input.priceId,
          prorateImmediately: input.prorateImmediately
        });
      }

      const updated = await BillingService.changeSubscriptionPlan(ctx.db, {
        tenantId: ctx.tenantId,
        priceId: input.priceId,
        prorateImmediately: input.prorateImmediately,
      });
      return { success: true, status: updated.status };
    }),

  createCustomerPortal: tenantProcedure
    .input(z.object({ returnUrl: z.string().url().optional() }))
    .mutation(async ({ ctx, input }) => {
      // Use centralized Stripe singleton from _core/stripe.ts
      const { stripe } = await import("../_core/stripe");
      const rows = await ctx.db.select().from(subscriptions).where(eq(subscriptions.tenantId, ctx.tenantId)).limit(1);
      const subRow = rows[0];
      let customerId: string | undefined;
      if (subRow?.stripeId) {
        const stripeSub = await stripe.subscriptions.retrieve(subRow.stripeId).catch(() => null);
        customerId = typeof stripeSub?.customer === "string" ? stripeSub.customer : undefined;
      }
      if (!customerId) return { url: null, error: "No active subscription found. Please subscribe to a plan first." };
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: input.returnUrl || `${process.env.APP_URL || "http://localhost:3000"}/billing`,
      });
      return { url: portal.url };
    }),

  invoices: tenantProcedure.query(async ({ ctx }) => {
    const [invoices, refunds] = await Promise.all([
      BillingService.listInvoicesByTenant(ctx.db, ctx.tenantId),
      BillingService.listRefundsByTenant(ctx.db, ctx.tenantId),
    ]);
    return { invoices, refunds };
  }),

  refundInvoice: tenantProcedure
    .input(z.object({
      stripeInvoiceId: z.string(),
      amount: z.number().int().positive().optional(),
      reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if this is an admin operation and audit it
      if (ctx.user.role === 'admin') {
        await auditAdminRead(ctx, "admin.billing.refundInvoice", {
          targetTenantId: ctx.tenantId,
          stripeInvoiceId: input.stripeInvoiceId,
          amount: input.amount,
          reason: input.reason
        });
      }

      const refund = await BillingService.issueRefundForInvoiceCharge(ctx.db, {
        tenantId: ctx.tenantId,
        stripeInvoiceId: input.stripeInvoiceId,
        amount: input.amount,
        reason: input.reason,
      });
      return { success: true, refundId: refund.id };
    }),

  revenueShare: tenantProcedure.query(async ({ ctx }) => {
    return BillingService.calculateRevenueShare(ctx.db, ctx.tenantId);
  }),

  roiGuarantee: tenantProcedure.query(async ({ ctx }) => {
    return BillingService.checkRoiGuarantee(ctx.db, ctx.tenantId);
  }),
});

export const plansRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.db) return [];
    return TenantService.getAllPlans(ctx.db);
  }),
});
