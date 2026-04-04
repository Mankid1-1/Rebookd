import { z } from "zod";
import { and, eq, desc, not, like } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createLeadSchema, updateLeadSchema, updateLeadStatusSchema, sendMessageSchema } from "../../shared/schemas/leads";
import { tenantProcedure, router, createTrpcRateLimit } from "../_core/trpc";
import { rewriteInTone } from "../_core/messageRewriter";
import type { Tone } from "../_core/messageTemplates";
import * as LeadService from "../services/lead.service";
import * as BroadcastService from "../services/broadcast.service";
import { leadStatusLog, leads as leadsTable } from "../../drizzle/schema";
import { decrypt } from "../_core/crypto";
import { scoreLead } from "../services/lead-scoring.service";
import { emitEvent } from "../services/event-bus.service";
import { isAppError } from "../_core/appErrors";
import { recordStatusChange } from "../services/lead-status-engine.service";

export const leadsRouter = router({
  list: tenantProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(100).default(20),
          search: z.string().max(200).optional(),
          status: z
            .enum(["new", "contacted", "qualified", "booked", "lost", "unsubscribed"])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return LeadService.getLeads(ctx.db, ctx.tenantId, {
        page: input?.page ?? 1,
        limit: input?.limit ?? 20,
        search: input?.search,
        status: input?.status,
      });
    }),

  get: tenantProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ ctx, input }) => {
      const lead = await LeadService.getLeadById(ctx.db, ctx.tenantId, input.leadId);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
      return lead;
    }),

  getScore: tenantProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ ctx, input }) => {
      return scoreLead(ctx.db, ctx.tenantId, input.leadId);
    }),

  create: tenantProcedure
    .input(createLeadSchema)
    .mutation(async ({ ctx, input }) => {
      const created = await LeadService.createLead(ctx.db, { tenantId: ctx.tenantId, name: input.name, phone: input.phone, email: input.email ?? undefined });
      if (!("duplicate" in created && created.duplicate)) {
        await emitEvent({ type: "lead.created", tenantId: ctx.tenantId, data: { name: input.name, phone: input.phone }, userId: ctx.user.id, timestamp: new Date() });
      }
      return created;
    }),

  update: tenantProcedure
    .input(updateLeadSchema)
    .mutation(async ({ ctx, input }) => {
      await LeadService.updateLead(ctx.db, ctx.tenantId, input.leadId, { name: input.name, email: input.email, phone: input.phone, appointmentAt: input.appointmentAt });
      return { success: true };
    }),

  updateStatus: tenantProcedure
    .input(updateLeadStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const lead = await LeadService.getLeadById(ctx.db, ctx.tenantId, input.leadId);
      if (lead) {
        await recordStatusChange(ctx.db, ctx.tenantId, input.leadId, lead.status, input.status, "manual", `user:${ctx.user.id}`);
      }
      await LeadService.updateLeadStatus(ctx.db, ctx.tenantId, input.leadId, input.status);
      return { success: true };
    }),

  messages: tenantProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ ctx, input }) => {
      return LeadService.getMessagesByLeadId(ctx.db, ctx.tenantId, input.leadId);
    }),

  sendMessage: tenantProcedure
    .use(createTrpcRateLimit(30, 60_000, (ctx) => `sms:tenant:${ctx.tenantId}`))
    .input(sendMessageSchema)
    .mutation(async ({ ctx, input }) => {
      let finalBody = input.body;
      if (input.tone) {
        try {
          finalBody = rewriteInTone(input.body, input.tone as Tone) || finalBody;
        } catch (err) {
          console.error("In-house tone rewrite failed:", err);
        }
      }
      const res = await LeadService.sendMessage(
        ctx.db,
        ctx.tenantId,
        input.leadId,
        finalBody,
        input.idempotencyKey,
      );
      await emitEvent({ type: "message.sent", tenantId: ctx.tenantId, data: { leadId: input.leadId, body: finalBody }, userId: ctx.user.id, timestamp: new Date() });
      return { success: res.success, errorCode: "errorCode" in res ? res.errorCode : undefined, deduplicated: "deduplicated" in res ? res.deduplicated : undefined };
    }),

  markNoShow: tenantProcedure
    .input(z.object({ leadId: z.number(), appointmentTime: z.date().optional() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await LeadService.getLeadById(ctx.db, ctx.tenantId, input.leadId);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
      await recordStatusChange(ctx.db, ctx.tenantId, input.leadId, lead.status, "lost", "manual_no_show", `user:${ctx.user.id}`);
      await LeadService.updateLeadStatus(ctx.db, ctx.tenantId, input.leadId, "lost");
      await LeadService.addLeadTags(ctx.db, ctx.tenantId, input.leadId, ["no_show"]);
      await emitEvent({ type: "appointment.no_show", tenantId: ctx.tenantId, data: { leadId: input.leadId, appointmentTime: input.appointmentTime ?? lead.appointmentAt, phone: lead.phone, name: lead.name }, userId: ctx.user.id, timestamp: new Date() });
      return { success: true };
    }),

  markBooked: tenantProcedure
    .input(z.object({ leadId: z.number(), appointmentTime: z.date() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await LeadService.getLeadById(ctx.db, ctx.tenantId, input.leadId);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });

      // Increment visit count and calculate loyalty tier
      const newVisitCount = ((lead as any).visitCount ?? 0) + 1;
      const loyaltyTier = newVisitCount >= 15 ? 'platinum' : newVisitCount >= 10 ? 'gold' : newVisitCount >= 5 ? 'silver' : newVisitCount >= 3 ? 'bronze' : null;

      await recordStatusChange(ctx.db, ctx.tenantId, input.leadId, lead.status, "booked", "manual_booked", `user:${ctx.user.id}`);
      await LeadService.updateLead(ctx.db, ctx.tenantId, input.leadId, {
        status: "booked",
        appointmentAt: input.appointmentTime,
        visitCount: newVisitCount,
        loyaltyTier,
      } as any);
      await LeadService.addLeadTags(ctx.db, ctx.tenantId, input.leadId, ["booked_client"]);
      await emitEvent({ type: "appointment.booked", tenantId: ctx.tenantId, data: { leadId: input.leadId, appointmentTime: input.appointmentTime, phone: lead.phone, name: lead.name, visitCount: newVisitCount, loyaltyTier }, userId: ctx.user.id, timestamp: new Date() });

      // Fire loyalty milestone event if they just crossed a tier threshold
      if ([3, 5, 10, 15].includes(newVisitCount)) {
        await emitEvent({ type: "lead.loyalty_milestone" as any, tenantId: ctx.tenantId, data: { leadId: input.leadId, phone: lead.phone, name: lead.name, visitCount: newVisitCount, milestone: newVisitCount, loyaltyTier }, userId: ctx.user.id, timestamp: new Date() });
      }

      return { success: true };
    }),

  markCancelled: tenantProcedure
    .input(z.object({ leadId: z.number(), appointmentTime: z.date().optional() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await LeadService.getLeadById(ctx.db, ctx.tenantId, input.leadId);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
      await recordStatusChange(ctx.db, ctx.tenantId, input.leadId, lead.status, "contacted", "manual_cancelled", `user:${ctx.user.id}`);
      await LeadService.updateLeadStatus(ctx.db, ctx.tenantId, input.leadId, "contacted");
      await LeadService.addLeadTags(ctx.db, ctx.tenantId, input.leadId, ["cancelled"]);

      const appointmentTime = input.appointmentTime ?? lead.appointmentAt;
      await emitEvent({ type: "appointment.cancelled", tenantId: ctx.tenantId, data: { leadId: input.leadId, appointmentTime, phone: lead.phone, name: lead.name }, userId: ctx.user.id, timestamp: new Date() });

      // Open the slot for waiting list — triggers cancellation_flurry workflow
      // which notifies qualified (waiting list) leads about the newly available time
      if (appointmentTime) {
        const apptDate = new Date(appointmentTime as any);
        await emitEvent({
          type: "waitlist.slot_opened" as any,
          tenantId: ctx.tenantId,
          data: {
            leadId: input.leadId,
            appointmentTime,
            date: apptDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
            time: apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          },
          userId: ctx.user.id,
          timestamp: new Date(),
        });
      }

      return { success: true };
    }),

  csvImport: tenantProcedure
    .input(z.object({
      csvContent: z.string().min(1).max(5_000_000),
      platform: z.enum(["square", "vagaro", "booksy", "fresha", "generic"]).default("generic"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { importLeadsFromCSV } = await import("../services/csv-import.service");
      return importLeadsFromCSV(ctx.db, ctx.tenantId, input.csvContent, input.platform);
    }),

  // ─── Broadcast / Segment Messaging ──────────────────────────────────────────

  broadcastPreview: tenantProcedure
    .input(
      z.object({
        message: z.string().min(1).max(1600),
        segmentId: z.number().int().optional(),
        filter: z
          .object({
            status: z.array(z.enum(["new", "contacted", "qualified", "booked", "lost"])).optional(),
            inactiveDays: z.number().int().min(1).max(365).optional(),
            minVisits: z.number().int().min(0).optional(),
            maxVisits: z.number().int().min(0).optional(),
            tags: z.array(z.string().max(50)).max(20).optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return BroadcastService.previewBroadcast(ctx.db, {
        tenantId: ctx.tenantId,
        message: input.message,
        segmentId: input.segmentId,
        filter: input.filter,
        dryRun: true,
      });
    }),

  broadcastSend: tenantProcedure
    .input(
      z.object({
        message: z.string().min(1).max(1600),
        segmentId: z.number().int().optional(),
        filter: z
          .object({
            status: z.array(z.enum(["new", "contacted", "qualified", "booked", "lost"])).optional(),
            inactiveDays: z.number().int().min(1).max(365).optional(),
            minVisits: z.number().int().min(0).optional(),
            maxVisits: z.number().int().min(0).optional(),
            tags: z.array(z.string().max(50)).max(20).optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await BroadcastService.sendBroadcast(ctx.db, {
        tenantId: ctx.tenantId,
        message: input.message,
        segmentId: input.segmentId,
        filter: input.filter,
      });

      await emitEvent({
        type: "message.sent",
        tenantId: ctx.tenantId,
        data: {
          broadcastSent: result.sent,
          broadcastFailed: result.failed,
          broadcastBlocked: result.blocked,
          totalRecipients: result.totalRecipients,
        },
        userId: ctx.user.id,
        timestamp: new Date(),
      });

      return result;
    }),

  recentBroadcasts: tenantProcedure.query(async ({ ctx }) => {
    return BroadcastService.getRecentBroadcasts(ctx.db, ctx.tenantId);
  }),

  // ─── Status History (auto-status engine) ─────────────────────────────────────

  statusHistory: tenantProcedure
    .input(z.object({ leadId: z.number(), limit: z.number().int().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(leadStatusLog)
        .where(and(
          eq(leadStatusLog.tenantId, ctx.tenantId),
          eq(leadStatusLog.leadId, input.leadId),
        ))
        .orderBy(desc(leadStatusLog.createdAt))
        .limit(input.limit);
      return rows;
    }),

  recentAutoTransitions: tenantProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const rows = await ctx.db
        .select({
          id: leadStatusLog.id,
          leadId: leadStatusLog.leadId,
          leadName: leadsTable.name,
          fromStatus: leadStatusLog.fromStatus,
          toStatus: leadStatusLog.toStatus,
          trigger: leadStatusLog.trigger,
          triggeredBy: leadStatusLog.triggeredBy,
          createdAt: leadStatusLog.createdAt,
        })
        .from(leadStatusLog)
        .leftJoin(leadsTable, eq(leadStatusLog.leadId, leadsTable.id))
        .where(and(
          eq(leadStatusLog.tenantId, ctx.tenantId),
          not(like(leadStatusLog.triggeredBy, "user:%")),
        ))
        .orderBy(desc(leadStatusLog.createdAt))
        .limit(limit);

      // Decrypt lead names for display
      return rows.map(r => ({
        ...r,
        leadName: r.leadName ? (() => { try { return decrypt(r.leadName); } catch { return r.leadName; } })() : null,
      }));
    }),
});
