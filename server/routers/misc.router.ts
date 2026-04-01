/**
 * Miscellaneous stub routers for frontend-expected procedures that don't yet
 * have a full backend implementation. These prevent tRPC type errors and
 * runtime 404s when components/hooks call these procedures.
 *
 * Each router returns sensible empty/default data so the UI degrades gracefully.
 */

import { z } from "zod";
import { sql, eq, and, count, isNull } from "drizzle-orm";
import { protectedProcedure, tenantProcedure, publicProcedure, router } from "../_core/trpc";
import { tenants, subscriptions, recoveryEvents, featureConfigs, calendarConnections } from "../../drizzle/schema";
import { ENV } from "../_core/env";

// ─── locations ───────────────────────────────────────────────────────────────
export const locationsRouter = router({
  list: tenantProcedure.query(async () => {
    return [];
  }),

  create: tenantProcedure
    .input(z.object({
      name: z.string(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      phone: z.string().optional(),
      timezone: z.string().optional(),
    }))
    .mutation(async () => ({ success: true })),

  update: tenantProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      phone: z.string().optional(),
      timezone: z.string().optional(),
    }))
    .mutation(async () => ({ success: true })),

  delete: tenantProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async () => ({ success: true })),
});

// ─── notifications ────────────────────────────────────────────────────────────
export const notificationsRouter = router({
  unreadCounts: protectedProcedure.query(async () => ({
    messages: 0,
    tasks: 0,
    alerts: 0,
  })),
});

// ─── user ────────────────────────────────────────────────────────────────────
export const userRouter = router({
  permissions: protectedProcedure.query(async ({ ctx }) => ({
    canMessage: true,
    canViewTasks: true,
    canCreateCampaigns: ctx.user?.role === "admin",
    canCreateAutomations: true,
    canViewAnalytics: true,
    canManageTeam: ctx.user?.role === "admin",
  })),

  preferences: protectedProcedure.query(async () => ({
    theme: "dark",
    language: "en",
    timezone: "America/New_York",
    emailNotifications: true,
    smsNotifications: false,
  })),
});

// ─── integrations ────────────────────────────────────────────────────────────
export const integrationsRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    // Return connected integration status based on env vars and DB state
    const integrations: Array<{ id: string; name: string; status: "connected" | "not_configured" | "error"; type: string }> = [];

    // SMS providers
    if (ENV.phoneserviceUrl && ENV.phoneserviceApiKey) {
      integrations.push({ id: "phoneservice", name: "Phone Service (Android Gateway)", status: "connected", type: "sms" });
    }
    if (ENV.telnyxApiKey) {
      integrations.push({ id: "telnyx", name: "Telnyx SMS", status: "connected", type: "sms" });
    } else if (ENV.twilioAccountSid) {
      integrations.push({ id: "twilio", name: "Twilio SMS", status: "connected", type: "sms" });
    }
    if (!ENV.phoneserviceUrl && !ENV.telnyxApiKey && !ENV.twilioAccountSid) {
      integrations.push({ id: "sms", name: "SMS Provider", status: "not_configured", type: "sms" });
    }

    // Stripe
    if (ENV.stripeSecretKey) {
      integrations.push({ id: "stripe", name: "Stripe Payments", status: "connected", type: "payments" });
    } else {
      integrations.push({ id: "stripe", name: "Stripe Payments", status: "not_configured", type: "payments" });
    }

    // Calendar connections for this tenant
    try {
      const calConns = await ctx.db
        .select({ provider: calendarConnections.provider, syncEnabled: calendarConnections.syncEnabled })
        .from(calendarConnections)
        .where(eq(calendarConnections.tenantId, ctx.tenantId));
      for (const conn of calConns) {
        integrations.push({
          id: `calendar_${conn.provider}`,
          name: `${conn.provider.charAt(0).toUpperCase() + conn.provider.slice(1)} Calendar`,
          status: conn.syncEnabled ? "connected" : "error",
          type: "calendar",
        });
      }
    } catch { /* non-critical */ }

    return integrations;
  }),
});

// ─── featureFlags ─────────────────────────────────────────────────────────────
// Note: Frontend accidentally calls `trpc.featureFlags.useQuery()` (only 2 levels).
// tRPC expects trpc.<router>.<procedure>.useQuery(), so `featureFlags` itself would
// need to be a router with a default procedure. We expose it as a top-level query
// via a wrapper router that the index wires up as `featureFlags`.
export const featureFlagsRouter = router({
  get: tenantProcedure.query(async ({ ctx }) => {
    // Load feature flags from DB for this tenant, with sensible defaults
    const defaults: Record<string, boolean> = {
      enableAdvancedReporting: false,
      enableMultiLocation: false,
      enableAiRewrite: true,
      enablePersonalization: false,
      enableCalendarSync: true,
      enableReferralProgram: true,
      enableReviewRequests: true,
      enableWaitingList: true,
    };

    try {
      const configs = await ctx.db
        .select({ feature: featureConfigs.feature, enabled: featureConfigs.enabled })
        .from(featureConfigs)
        .where(eq(featureConfigs.tenantId, ctx.tenantId));

      for (const cfg of configs) {
        if (cfg.feature in defaults) {
          defaults[cfg.feature] = cfg.enabled;
        }
      }
    } catch { /* return defaults on error */ }

    return defaults;
  }),
});

// ─── personalization ─────────────────────────────────────────────────────────
export const personalizationRouter = router({
  getProfile: protectedProcedure
    .input(z.object({ userId: z.union([z.number(), z.string()]).optional() }).optional())
    .query(async () => null),

  getInsights: protectedProcedure
    .input(z.object({ userId: z.union([z.number(), z.string()]).optional() }).optional())
    .query(async () => ({ insights: [] as unknown[] })),

  getRecommendations: protectedProcedure
    .input(z.object({ userId: z.union([z.number(), z.string()]).optional() }).optional())
    .query(async () => ({ recommendations: [] as unknown[] })),

  generateProfile: protectedProcedure
    .input(z.object({ userId: z.union([z.number(), z.string()]).optional() }).optional())
    .mutation(async () => ({ success: true })),

  applyRecommendation: protectedProcedure
    .input(z.object({ recommendationId: z.string() }))
    .mutation(async () => ({ success: true })),
});

// ─── reports ─────────────────────────────────────────────────────────────────
export const reportsRouter = router({
  generate: tenantProcedure
    .input(z.object({
      type: z.string().optional(),
      reportType: z.string().optional(), // alias used by AdvancedReporting component
      dateRange: z.object({ start: z.string(), end: z.string() }).optional(),
      customDateRange: z.object({ start: z.string(), end: z.string() }).optional(),
      dateFilter: z.string().optional(),
      metrics: z.array(z.string()).optional(),
      format: z.enum(["pdf", "csv", "json"]).optional(),
    }))
    .mutation(async () => ({
      success: true,
      message: "Report generation is not yet available.",
      downloadUrl: null as string | null,
    })),
});

// ─── scheduling ──────────────────────────────────────────────────────────────
export const schedulingRouter = router({
  optimize: tenantProcedure
    .input(z.object({
      date: z.string().optional(),
      preferences: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async () => ({
      success: true,
      suggestions: [],
      message: "Smart scheduling optimization is not yet available.",
    })),
});

// ─── misc (bug reports) ─────────────────────────────────────────────────────
export const miscRouter = router({
  reportBug: protectedProcedure
    .input(z.object({
      description: z.string().min(5).max(2000),
      category: z.string(),
      page: z.string(),
      theme: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { createSystemError } = await import("../services/system.service");

      // Create a high-priority system error that sentinel will pick up
      await createSystemError(ctx.db, {
        type: "client",
        message: `[USER_BUG_REPORT] ${input.category}: ${input.description.slice(0, 200)}`,
        detail: JSON.stringify({
          fullDescription: input.description,
          category: input.category,
          page: input.page,
          theme: input.theme,
          reportedBy: ctx.user?.email || ctx.user?.name || "unknown",
          userId: ctx.user?.id,
          tenantId: ctx.tenantId ?? null,
          timestamp: new Date().toISOString(),
          userAgent: "user-reported",
        }),
        severity: input.category === "bug" ? "high" : "medium",
        tenantId: ctx.tenantId ?? undefined,
        errorCategory: input.category === "visual" ? "rendering" : input.category === "performance" ? "performance" : "runtime",
      });

      return { success: true };
    }),
});

// ─── platformStats ──────────────────────────────────────────────────────────
export const platformStatsRouter = router({
  live: publicProcedure.query(async ({ ctx }) => {
    const [tenantCount] = await ctx.db.select({ value: count() }).from(tenants);
    const [recoveryAgg] = await ctx.db
      .select({
        totalRecovered: count(),
        revenueCents: sql<number>`COALESCE(SUM(${recoveryEvents.realizedRevenue}), 0)`,
      })
      .from(recoveryEvents);
    const [founderCount] = await ctx.db
      .select({ value: count() })
      .from(subscriptions)
      .where(eq(subscriptions.guaranteeCohort, "risk_free_20"));
    const [flexCount] = await ctx.db
      .select({ value: count() })
      .from(subscriptions)
      .where(eq(subscriptions.guaranteeCohort, "flex_10"));

    return {
      totalClients: tenantCount?.value ?? 0,
      appointmentsRecovered: recoveryAgg?.totalRecovered ?? 0,
      revenueRecoveredCents: recoveryAgg?.revenueCents ?? 0,
      founderSlotsUsed: founderCount?.value ?? 0,
      flexSlotsUsed: flexCount?.value ?? 0,
    };
  }),
});

