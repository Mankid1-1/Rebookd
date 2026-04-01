import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createLeadSchema, updateLeadSchema, updateLeadStatusSchema, sendMessageSchema } from "../../shared/schemas/leads";
import { tenantProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import * as LeadService from "../services/lead.service";
import { emitEvent } from "../services/event-bus.service";
import { isAppError } from "../_core/appErrors";

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
      await LeadService.updateLeadStatus(ctx.db, ctx.tenantId, input.leadId, input.status);
      return { success: true };
    }),

  messages: tenantProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ ctx, input }) => {
      return LeadService.getMessagesByLeadId(ctx.db, ctx.tenantId, input.leadId);
    }),

  sendMessage: tenantProcedure
    .input(sendMessageSchema)
    .mutation(async ({ ctx, input }) => {
      let finalBody = input.body;
      if (input.tone) {
        try {
          const result = await invokeLLM({ messages: [
            { role: "system", content: `Rewrite in ${input.tone} tone. Under 160 chars. Return only text.` },
            { role: "user", content: input.body },
          ]});
          const content = (typeof result.choices?.[0]?.message?.content === "string" ? result.choices[0].message.content : "") || "";
          finalBody = content.trim() || finalBody;
        } catch (err) {
          if (!isAppError(err)) {
            console.error("AI rewrite failed:", err);
          }
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
});
