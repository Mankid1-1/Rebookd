/**
 * REVIEW ROUTING ROUTER (protected)
 *
 * Tenant-scoped endpoints for configuring and viewing smart review routing.
 */

import { z } from "zod";
import { router, tenantProcedure } from "../_core/trpc";
import * as ReviewRoutingService from "../services/review-routing.service";
import * as TenantService from "../services/tenant.service";

export const reviewRoutingRouter = router({
  // ─── Get Review Routing Config ──────────────────────────────────────────
  getConfig: tenantProcedure.query(async ({ ctx }) => {
    const tenant = await TenantService.getTenantById(ctx.db, ctx.tenantId);
    const settings = (tenant?.settings ?? {}) as Record<string, any>;
    const config = settings.reviewRouting ?? {
      googleUrl: "",
      yelpUrl: "",
      facebookUrl: "",
      threshold: 4,
      preferredPlatform: "google",
    };
    return config;
  }),

  // ─── Update Review Routing Config ───────────────────────────────────────
  updateConfig: tenantProcedure
    .input(
      z.object({
        googleUrl: z.string().url().optional().or(z.literal("")),
        yelpUrl: z.string().url().optional().or(z.literal("")),
        facebookUrl: z.string().url().optional().or(z.literal("")),
        threshold: z.number().int().min(1).max(5).optional(),
        preferredPlatform: z.enum(["google", "yelp", "facebook"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Merge with existing config
      const tenant = await TenantService.getTenantById(ctx.db, ctx.tenantId);
      const existingSettings = (tenant?.settings ?? {}) as Record<string, any>;
      const existingConfig = existingSettings.reviewRouting ?? {};

      const updatedConfig = {
        ...existingConfig,
        ...Object.fromEntries(
          Object.entries(input).filter(([, v]) => v !== undefined),
        ),
      };

      await TenantService.updateTenant(ctx.db, ctx.tenantId, {
        settings: { reviewRouting: updatedConfig },
      });

      return updatedConfig;
    }),

  // ─── Get Review Metrics ─────────────────────────────────────────────────
  getMetrics: tenantProcedure.query(async ({ ctx }) => {
    return ReviewRoutingService.getReviewMetrics(ctx.db, ctx.tenantId);
  }),

  // ─── List Review Requests ──────────────────────────────────────────────
  listRequests: tenantProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(100).optional(),
          status: z
            .enum(["sent", "rated", "review_clicked", "feedback_submitted", "expired"])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ReviewRoutingService.listReviewRequests(ctx.db, ctx.tenantId, {
        page: input?.page,
        limit: input?.limit,
        status: input?.status,
      });
    }),

  // ─── List Feedback (convenience filter) ────────────────────────────────
  listFeedback: tenantProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ReviewRoutingService.listReviewRequests(ctx.db, ctx.tenantId, {
        page: input?.page,
        limit: input?.limit,
        status: "feedback_submitted",
      });
    }),

  // ─── Create Review Request (manual trigger) ─────────────────────────────
  createRequest: tenantProcedure
    .input(z.object({ leadId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      return ReviewRoutingService.createReviewRequest(ctx.db, ctx.tenantId, input.leadId);
    }),
});
