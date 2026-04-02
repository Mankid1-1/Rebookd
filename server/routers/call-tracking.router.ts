/**
 * 📞 CALL TRACKING ROUTER
 * tRPC endpoints for the Live Call Tracking dashboard.
 */

import { z } from "zod";
import { router, tenantProcedure } from "../_core/trpc";
import * as CallTrackingService from "../services/call-tracking.service";
import * as TrackingNumberService from "../services/tracking-number.service";

export const callTrackingRouter = router({
  // ─── KPI Stats ────────────────────────────────────────────────────────────
  stats: tenantProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      return CallTrackingService.getCallStats(ctx.db, ctx.tenantId, input?.days ?? 30);
    }),

  // ─── Chart Data ───────────────────────────────────────────────────────────
  callsByDay: tenantProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      return CallTrackingService.getCallsByDay(ctx.db, ctx.tenantId, input?.days ?? 30);
    }),

  callsByHour: tenantProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      return CallTrackingService.getCallsByHour(ctx.db, ctx.tenantId, input?.days ?? 30);
    }),

  // ─── Top Callers ──────────────────────────────────────────────────────────
  topCallers: tenantProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }).optional())
    .query(async ({ ctx, input }) => {
      return CallTrackingService.getTopCallers(ctx.db, ctx.tenantId, input?.limit ?? 10);
    }),

  // ─── Live Feed ────────────────────────────────────────────────────────────
  recentActivity: tenantProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return CallTrackingService.getRecentCalls(ctx.db, ctx.tenantId, input?.limit ?? 20);
    }),

  // ─── Paginated Call List ──────────────────────────────────────────────────
  list: tenantProcedure
    .input(z.object({
      direction: z.enum(["inbound", "outbound"]).optional(),
      status: z.enum(["ringing", "in_progress", "completed", "missed", "voicemail", "failed", "busy", "no_answer"]).optional(),
      search: z.string().optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      return CallTrackingService.listCalls(ctx.db, ctx.tenantId, {
        direction: input?.direction,
        status: input?.status,
        search: input?.search,
        dateFrom: input?.dateFrom ? new Date(input.dateFrom) : undefined,
        dateTo: input?.dateTo ? new Date(input.dateTo) : undefined,
        page: input?.page ?? 1,
        limit: input?.limit ?? 50,
      });
    }),

  // ─── Manual Call Log (for Google Voice / manual entry) ────────────────────
  logManualCall: tenantProcedure
    .input(z.object({
      direction: z.enum(["inbound", "outbound"]),
      callerNumber: z.string().min(1).max(20),
      calledNumber: z.string().min(1).max(20),
      status: z.enum(["completed", "missed", "voicemail", "no_answer"]).default("completed"),
      duration: z.number().min(0).default(0),
      startedAt: z.string().datetime().optional(),
      notes: z.string().max(2000).optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const callId = await CallTrackingService.logCall(ctx.db, {
        tenantId: ctx.tenantId,
        direction: input.direction,
        callerNumber: input.callerNumber,
        calledNumber: input.calledNumber,
        status: input.status,
        duration: input.duration,
        startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
        endedAt: input.duration > 0
          ? new Date((input.startedAt ? new Date(input.startedAt).getTime() : Date.now()) + input.duration * 1000)
          : undefined,
        provider: "manual",
        notes: input.notes,
        tags: input.tags,
      });
      return { success: true, callId };
    }),

  // ─── Tracking Number Management ───────────────────────────────────────────

  /** Get tenant's current tracking number (if provisioned) */
  getTrackingNumber: tenantProcedure.query(async ({ ctx }) => {
    const num = await TrackingNumberService.getTrackingNumber(ctx.db, ctx.tenantId);
    if (!num) return null;
    return {
      id: num.id,
      number: num.number,
      forwardTo: num.forwardTo,
      provider: num.provider,
      status: num.status,
      label: num.label,
    };
  }),

  /** Search available Twilio numbers to buy */
  searchAvailableNumbers: tenantProcedure
    .input(z.object({
      areaCode: z.string().max(6).optional(),
      country: z.string().length(2).default("US"),
    }).optional())
    .query(async ({ input }) => {
      return TrackingNumberService.searchAvailableNumbers(
        input?.areaCode,
        input?.country ?? "US",
        10
      );
    }),

  /** Provision a tracking number (buy from Twilio) */
  provisionNumber: tenantProcedure
    .input(z.object({
      phoneNumber: z.string().min(10).max(20),
      forwardTo: z.string().min(10).max(20),
      label: z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return TrackingNumberService.provisionTrackingNumber(
        ctx.db, ctx.tenantId, input.phoneNumber, input.forwardTo, input.label
      );
    }),

  /** Update where calls are forwarded to */
  updateForwardTo: tenantProcedure
    .input(z.object({
      phoneId: z.number(),
      forwardTo: z.string().min(10).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      await TrackingNumberService.updateForwardTo(ctx.db, ctx.tenantId, input.phoneId, input.forwardTo);
      return { success: true };
    }),

  /** Release a tracking number */
  releaseNumber: tenantProcedure
    .input(z.object({ phoneId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await TrackingNumberService.releaseTrackingNumber(ctx.db, ctx.tenantId, input.phoneId);
      return { success: true };
    }),

  // ─── Click-to-Call ────────────────────────────────────────────────────────

  /** Initiate an outbound call — connects employee to lead via tracking number */
  initiateCall: tenantProcedure
    .input(z.object({
      employeePhone: z.string().min(10).max(20),
      leadPhone: z.string().min(10).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      return TrackingNumberService.initiateOutboundCall(
        ctx.db, ctx.tenantId, input.employeePhone, input.leadPhone
      );
    }),
});
