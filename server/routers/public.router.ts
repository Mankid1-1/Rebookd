/**
 * PUBLIC ROUTER (unauthenticated)
 *
 * Endpoints that require NO auth — accessed via token-validated links
 * embedded in SMS messages.
 *
 * Current:
 *   - Feedback page load & submission (Feature 1 - Review Routing)
 *
 * Future:
 *   - Public booking pages (Feature 4)
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { reviewRequests, tenants } from "../../drizzle/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { logger } from "../_core/logger";
import * as ReviewRoutingService from "../services/review-routing.service";
import * as BookingPageService from "../services/booking-page.service";
import * as PublicBookingService from "../services/public-booking.service";
import { enrollInSequence } from "../services/email-marketing.service";

export const publicRouter = router({
  // ─── Get Feedback Page Data ─────────────────────────────────────────────
  // Validates the token and returns business name + branding for the
  // client-side feedback form.
  getFeedbackPage: publicProcedure
    .input(z.object({ token: z.string().min(1).max(128) }))
    .query(async ({ ctx, input }) => {
      // Look up the review request by token
      const [request] = await ctx.db
        .select({
          id: reviewRequests.id,
          tenantId: reviewRequests.tenantId,
          status: reviewRequests.status,
          rating: reviewRequests.rating,
          expiresAt: reviewRequests.expiresAt,
        })
        .from(reviewRequests)
        .where(eq(reviewRequests.token, input.token))
        .limit(1);

      if (!request) {
        return { valid: false, reason: "not_found" } as const;
      }

      if (new Date(request.expiresAt) < new Date()) {
        return { valid: false, reason: "expired" } as const;
      }

      if (request.status === "feedback_submitted") {
        return { valid: false, reason: "already_submitted" } as const;
      }

      // Get tenant info for branding
      const [tenant] = await ctx.db
        .select({
          name: tenants.name,
          settings: tenants.settings,
        })
        .from(tenants)
        .where(eq(tenants.id, request.tenantId))
        .limit(1);

      const settings = (tenant?.settings ?? {}) as Record<string, any>;

      return {
        valid: true,
        businessName: tenant?.name ?? "Business",
        brandColor: settings.brandColor ?? "#00A896",
        rating: request.rating,
      } as const;
    }),

  // ─── Submit Feedback ────────────────────────────────────────────────────
  // Token-authenticated — no login required.
  submitFeedback: publicProcedure
    .input(
      z.object({
        token: z.string().min(1).max(128),
        rating: z.number().int().min(1).max(5).optional(),
        feedbackText: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // If a rating adjustment is provided, update it
      if (input.rating !== undefined) {
        const [request] = await ctx.db
          .select({ id: reviewRequests.id })
          .from(reviewRequests)
          .where(eq(reviewRequests.token, input.token))
          .limit(1);

        if (request) {
          await ctx.db
            .update(reviewRequests)
            .set({ rating: input.rating })
            .where(eq(reviewRequests.id, request.id));
        }
      }

      const result = await ReviewRoutingService.submitFeedback(
        ctx.db,
        input.token,
        input.feedbackText,
      );

      if (!result.success) {
        logger.warn("Public feedback submission failed", {
          reason: result.reason,
          token: input.token.slice(0, 8) + "...",
        });
      }

      return result;
    }),

  // ─── Email Subscriber Capture ────────────────────────────────────────────
  // Pre-signup lead capture from ROI calculator, industry pages, blog, etc.
  captureEmail: publicProcedure
    .input(
      z.object({
        email: z.string().email().max(320),
        name: z.string().max(255).optional(),
        source: z.enum(["roi_calculator", "industry_page", "blog", "waitlist", "footer"]).default("roi_calculator"),
        industry: z.string().max(100).optional(),
        roiData: z.record(z.unknown()).optional(),
        attribution: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const nameVal = input.name || null;
        const industryVal = input.industry || null;
        const roiDataVal = input.roiData ? JSON.stringify(input.roiData) : null;
        const attributionVal = input.attribution ? JSON.stringify(input.attribution) : null;

        // Upsert — if email already exists, just update source/attribution
        await ctx.db.execute(sql`INSERT INTO email_subscribers (email, name, source, industry, roiData, attribution)
                VALUES (${input.email}, ${nameVal}, ${input.source}, ${industryVal}, ${roiDataVal}, ${attributionVal})
                ON DUPLICATE KEY UPDATE
                  name = COALESCE(VALUES(name), name),
                  source = VALUES(source),
                  industry = COALESCE(VALUES(industry), industry),
                  roiData = COALESCE(VALUES(roiData), roiData),
                  attribution = COALESCE(VALUES(attribution), attribution)`);

        // Enroll in welcome drip sequence (fire-and-forget)
        try {
          const subResult = await ctx.db.execute(sql`SELECT id FROM email_subscribers WHERE email = ${input.email} LIMIT 1`);
          const rows = (Array.isArray(subResult) ? subResult[0] : subResult) as any[];
          if (rows?.[0]?.id) {
            await enrollInSequence(ctx.db, rows[0].id, "welcome", {
              name: input.name,
              industry: input.industry,
              ...(input.roiData || {}),
            });
          }
        } catch (enrollErr) {
          logger.warn("Failed to enroll in welcome sequence", { error: String(enrollErr) });
        }

        return { success: true as const };
      } catch (err) {
        logger.error("Failed to capture email subscriber", { error: String(err), email: input.email.slice(0, 3) + "***" });
        return { success: false as const, error: "capture_failed" };
      }
    }),

  // ─── Public Booking: Get booking page by slug ────────────────────────────
  getBookingPage: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const page = await BookingPageService.getBookingPageBySlug(ctx.db, input.slug);
      if (!page) return null;
      // Return only public-facing fields
      return {
        id: page.id,
        slug: page.slug,
        title: page.title,
        description: page.description,
        services: page.services,
        businessHours: page.businessHours,
        slotDurationMinutes: page.slotDurationMinutes,
        bufferMinutes: page.bufferMinutes,
        maxAdvanceDays: page.maxAdvanceDays,
        brandColor: page.brandColor,
        logoUrl: page.logoUrl,
      };
    }),

  // ─── Public Booking: Get available slots for a date ──────────────────────
  getAvailableSlots: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(100),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ ctx, input }) => {
      const page = await BookingPageService.getBookingPageBySlug(ctx.db, input.slug);
      if (!page) return { slots: [], error: "not_found" };
      return { slots: await PublicBookingService.getAvailableSlots(ctx.db, page.id, input.date) };
    }),

  // ─── Public Booking: Create a booking ────────────────────────────────────
  createBooking: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(100),
        name: z.string().min(1).max(255),
        phone: z.string().min(5).max(20),
        email: z.string().email().max(320).optional(),
        slotStart: z.string().datetime(),
        slotEnd: z.string().datetime(),
        serviceName: z.string().max(255).optional(),
        source: z.enum(["sms_link", "direct", "qr_code", "website"]).default("direct"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const page = await BookingPageService.getBookingPageBySlug(ctx.db, input.slug);
      if (!page) {
        return { success: false as const, error: "booking_page_not_found" };
      }
      return PublicBookingService.createBooking(
        ctx.db,
        page.tenantId,
        page.id,
        { name: input.name, phone: input.phone, email: input.email },
        { start: input.slotStart, end: input.slotEnd, serviceName: input.serviceName },
        input.source,
      );
    }),
});
