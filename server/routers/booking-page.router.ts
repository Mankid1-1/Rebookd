/**
 * BOOKING PAGE ROUTER
 *
 * Protected tRPC endpoints for managing the tenant booking page
 * and viewing bookings made through it.
 */

import { z } from "zod";
import { router, tenantProcedure, publicProcedure } from "../_core/trpc";
import * as BookingPageService from "../services/booking-page.service";
import * as PublicBookingService from "../services/public-booking.service";

const serviceSchema = z.object({
  name: z.string().min(1),
  durationMinutes: z.number().int().min(5).max(480),
  price: z.number().min(0).optional(),
});

const businessHoursSchema = z.record(
  z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
  z
    .object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) })
    .nullable(),
);

export const bookingPageRouter = router({
  // ─── Get tenant's booking page ─────────────────────────────────────────────
  get: tenantProcedure.query(async ({ ctx }) => {
    return BookingPageService.getBookingPage(ctx.db, ctx.tenantId);
  }),

  // ─── Create booking page ──────────────────────────────────────────────────
  create: tenantProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        services: z.array(serviceSchema).optional(),
        businessHours: businessHoursSchema.optional(),
        slotDurationMinutes: z.number().int().min(5).max(480).optional(),
        bufferMinutes: z.number().int().min(0).max(120).optional(),
        maxAdvanceDays: z.number().int().min(1).max(365).optional(),
        brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        logoUrl: z.string().url().max(500).optional(),
        confirmationMessage: z.string().max(500).optional(),
        calendarConnectionId: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return BookingPageService.createBookingPage(ctx.db, ctx.tenantId, input);
    }),

  // ─── Update booking page ──────────────────────────────────────────────────
  update: tenantProcedure
    .input(
      z.object({
        id: z.number().int(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().max(2000).optional(),
        services: z.array(serviceSchema).optional(),
        businessHours: businessHoursSchema.optional(),
        slotDurationMinutes: z.number().int().min(5).max(480).optional(),
        bufferMinutes: z.number().int().min(0).max(120).optional(),
        maxAdvanceDays: z.number().int().min(1).max(365).optional(),
        brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        logoUrl: z.string().url().max(500).optional(),
        confirmationMessage: z.string().max(500).optional(),
        calendarConnectionId: z.number().int().optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return BookingPageService.updateBookingPage(ctx.db, ctx.tenantId, id, data);
    }),

  // ─── List bookings (paginated) ────────────────────────────────────────────
  listBookings: tenantProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(100).default(20),
          status: z
            .enum(["confirmed", "cancelled", "rescheduled", "no_show", "completed"])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return BookingPageService.listBookings(ctx.db, ctx.tenantId, {
        page: input?.page ?? 1,
        limit: input?.limit ?? 20,
        status: input?.status,
      });
    }),

  // ─── Booking metrics ─────────────────────────────────────────────────────
  getMetrics: tenantProcedure.query(async ({ ctx }) => {
    return BookingPageService.getMetrics(ctx.db, ctx.tenantId);
  }),

  // ─── Public: get booking page by slug (no auth) ───────────────────────────
  bySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      return BookingPageService.getBookingPageBySlug(ctx.db, input.slug);
    }),

  // ─── Public: get available slots for a date ───────────────────────────────
  availableSlots: publicProcedure
    .input(
      z.object({
        bookingPageId: z.number().int(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ ctx, input }) => {
      return PublicBookingService.getAvailableSlots(ctx.db, input.bookingPageId, input.date);
    }),

  // ─── Public: create a booking ─────────────────────────────────────────────
  book: publicProcedure
    .input(
      z.object({
        bookingPageId: z.number().int(),
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
      // Resolve tenantId from booking page
      const page = await BookingPageService.getBookingPageById(ctx.db, input.bookingPageId);
      if (!page || !page.enabled) {
        return { success: false as const, error: "booking_page_not_found" };
      }
      return PublicBookingService.createBooking(
        ctx.db,
        page.tenantId,
        input.bookingPageId,
        { name: input.name, phone: input.phone, email: input.email },
        { start: input.slotStart, end: input.slotEnd, serviceName: input.serviceName },
        input.source,
      );
    }),
});
