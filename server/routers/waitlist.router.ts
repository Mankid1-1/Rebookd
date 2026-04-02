import { z } from "zod";
import { router, tenantProcedure } from "../_core/trpc";
import * as WaitlistService from "../services/waitlist-autofill.service";
import { eq } from "drizzle-orm";
import { tenants } from "../../drizzle/schema";

export const waitlistRouter = router({
  /**
   * Paginated list of waitlist entries with lead name joined.
   */
  list: tenantProcedure
    .input(
      z
        .object({
          status: z
            .enum(["active", "offered", "booked", "expired", "removed"])
            .optional(),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return WaitlistService.listWaitlistEntries(ctx.db, ctx.tenantId, {
        status: input?.status,
        limit: input?.limit,
        offset: input?.offset,
      });
    }),

  /**
   * Add a lead to the waiting list.
   */
  add: tenantProcedure
    .input(
      z.object({
        leadId: z.number(),
        preferredDay: z
          .enum([
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
          ])
          .optional(),
        preferredTimeStart: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional(),
        preferredTimeEnd: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional(),
        serviceType: z.string().max(100).optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return WaitlistService.addToWaitlist(ctx.db, ctx.tenantId, input.leadId, {
        preferredDay: input.preferredDay,
        preferredTimeStart: input.preferredTimeStart,
        preferredTimeEnd: input.preferredTimeEnd,
        serviceType: input.serviceType,
        notes: input.notes,
      });
    }),

  /**
   * Remove a waitlist entry.
   */
  remove: tenantProcedure
    .input(z.object({ entryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await WaitlistService.removeFromWaitlist(
        ctx.db,
        ctx.tenantId,
        input.entryId,
      );
      return { success: true };
    }),

  /**
   * Paginated list of offers.
   */
  listOffers: tenantProcedure
    .input(
      z
        .object({
          status: z
            .enum(["sent", "accepted", "declined", "expired", "slot_filled"])
            .optional(),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return WaitlistService.listWaitlistOffers(ctx.db, ctx.tenantId, {
        status: input?.status,
        limit: input?.limit,
        offset: input?.offset,
      });
    }),

  /**
   * Aggregated waitlist metrics.
   */
  getMetrics: tenantProcedure.query(async ({ ctx }) => {
    return WaitlistService.getWaitlistMetrics(ctx.db, ctx.tenantId);
  }),

  /**
   * Read the tenant's waitlist auto-fill config.
   */
  getConfig: tenantProcedure.query(async ({ ctx }) => {
    const [tenant] = await ctx.db
      .select({ settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    const cfg = (tenant?.settings as Record<string, any>)?.waitlistAutoFill;
    return {
      enabled: cfg?.enabled ?? true,
      maxOffers: cfg?.maxOffers ?? 5,
      responseMinutes: cfg?.responseMinutes ?? 30,
    };
  }),

  /**
   * Update the tenant's waitlist auto-fill config.
   */
  updateConfig: tenantProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        maxOffers: z.number().min(1).max(20).optional(),
        responseMinutes: z.number().min(5).max(1440).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Read current settings
      const [tenant] = await ctx.db
        .select({ settings: tenants.settings })
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);

      const currentSettings =
        (tenant?.settings as Record<string, any>) ?? {};
      const currentWaitlist = currentSettings.waitlistAutoFill ?? {};

      const updatedWaitlist = {
        ...currentWaitlist,
        ...(input.enabled !== undefined && { enabled: input.enabled }),
        ...(input.maxOffers !== undefined && { maxOffers: input.maxOffers }),
        ...(input.responseMinutes !== undefined && {
          responseMinutes: input.responseMinutes,
        }),
      };

      await ctx.db
        .update(tenants)
        .set({
          settings: {
            ...currentSettings,
            waitlistAutoFill: updatedWaitlist,
          },
        })
        .where(eq(tenants.id, ctx.tenantId));

      return updatedWaitlist;
    }),
});
