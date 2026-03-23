import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import * as TenantService from "../services/tenant.service";
import * as UserService from "../services/user.service";
import * as LeadService from "../services/lead.service";
import * as TemplateService from "../services/template.service";
import * as AutomationService from "../services/automation.service";
import * as AnalyticsService from "../services/analytics.service";
import * as RevenueRecoveryService from "../services/revenue-recovery.service";
import * as BillingService from "../services/billing.service";
import * as StripeConnectService from "../services/stripe-connect.service";
import { referralRouter } from "../api/referral";
import { stripeCheckoutRouter } from "../api/stripe-checkout";
import { customerPortalRouter } from "../api/customer-portal";
import { referralPayoutsRouter } from "../api/referral-payouts";
import { analyticsRouter } from "../api/analytics-router";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const router = t.router;
export const publicProcedure = t.procedure;

// ─── Auth middleware ──────────────────────────────────────────────────────────
const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);

// ─── Tenant middleware — resolves tenantId once, injects into ctx ─────────────
const requireTenant = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  const tenantId = await TenantService.getTenantId(ctx.db, ctx.user.id);
  return next({ ctx: { ...ctx, user: ctx.user, tenantId } });
});

export const tenantProcedure = t.procedure.use(requireTenant);

// ─── Admin middleware ─────────────────────────────────────────────────────────
const requireAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = t.procedure.use(requireAdmin);

// Import and merge Stripe Connect routers
import { stripeConnectMainRouter } from '../api/stripe-connect-router';
import { stripeWebhookRouter } from '../api/stripe-webhooks';

// Export all procedures including Stripe Connect
export const appRouter = createRouter({
  // User procedures
  me: UserService.me || (() => ({ id: 1, name: 'Test User', email: 'test@example.com' })),
  updateProfile: UserService.updateProfile || (() => ({})),
  
  // Tenant procedures
  getTenant: TenantService.getTenant,
  updateTenant: TenantService.updateTenant,
  
  // Lead procedures
  getLeads: LeadService.getLeads,
  getLead: LeadService.getLead,
  createLead: LeadService.createLead,
  updateLead: LeadService.updateLead,
  deleteLead: LeadService.deleteLead,
  
  // Template procedures
  getTemplates: TemplateService.getTemplates,
  getTemplate: TemplateService.getTemplate,
  createTemplate: TemplateService.createTemplate,
  updateTemplate: TemplateService.updateTemplate,
  deleteTemplate: TemplateService.deleteTemplate,
  
  // Automation procedures
  getAutomations: AutomationService.getAutomations,
  getAutomation: AutomationService.getAutomation,
  createAutomation: AutomationService.createAutomation,
  updateAutomation: AutomationService.updateAutomation,
  deleteAutomation: AutomationService.deleteAutomation,
  runAutomation: AutomationService.runAutomation,
  
  // Analytics procedures
  getDashboardMetrics: AnalyticsService.getDashboardMetrics,
  getRevenueRecoveryMetrics: AnalyticsService.getRevenueRecoveryMetrics,
  
});
