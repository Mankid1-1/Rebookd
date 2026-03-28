/**
 * Miscellaneous stub routers for frontend-expected procedures that don't yet
 * have a full backend implementation. These prevent tRPC type errors and
 * runtime 404s when components/hooks call these procedures.
 *
 * Each router returns sensible empty/default data so the UI degrades gracefully.
 */

import { z } from "zod";
import { protectedProcedure, tenantProcedure, publicProcedure, router } from "../_core/trpc";

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
  list: tenantProcedure.query(async () => []),
});

// ─── featureFlags ─────────────────────────────────────────────────────────────
// Note: Frontend accidentally calls `trpc.featureFlags.useQuery()` (only 2 levels).
// tRPC expects trpc.<router>.<procedure>.useQuery(), so `featureFlags` itself would
// need to be a router with a default procedure. We expose it as a top-level query
// via a wrapper router that the index wires up as `featureFlags`.
export const featureFlagsRouter = router({
  // The frontend calls `trpc.featureFlags.useQuery()` which is malformed —
  // it's missing the procedure name. We can't fix this via routing alone.
  // Add a stub procedure named "get" and a workaround noted below.
  // The actual call pattern is caught at the index level.
  get: publicProcedure.query(async () => ({
    enableAdvancedReporting: false,
    enableMultiLocation: false,
    enableAiRewrite: true,
    enablePersonalization: false,
  })),
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

