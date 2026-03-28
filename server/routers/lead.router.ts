import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createLeadSchema, updateLeadSchema, updateLeadStatusSchema, sendMessageSchema } from "../../shared/schemas/leads";
import { tenantProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import * as LeadService from "../services/lead.service";
import { emitEvent } from "../services/eventBus";
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
      await LeadService.updateLead(ctx.db, ctx.tenantId, input.leadId, { status: "booked", appointmentAt: input.appointmentTime });
      await LeadService.addLeadTags(ctx.db, ctx.tenantId, input.leadId, ["booked_client"]);
      await emitEvent({ type: "appointment.booked", tenantId: ctx.tenantId, data: { leadId: input.leadId, appointmentTime: input.appointmentTime, phone: lead.phone, name: lead.name }, userId: ctx.user.id, timestamp: new Date() });
      return { success: true };
    }),

  markCancelled: tenantProcedure
    .input(z.object({ leadId: z.number(), appointmentTime: z.date().optional() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await LeadService.getLeadById(ctx.db, ctx.tenantId, input.leadId);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
      await LeadService.updateLeadStatus(ctx.db, ctx.tenantId, input.leadId, "contacted");
      await LeadService.addLeadTags(ctx.db, ctx.tenantId, input.leadId, ["cancelled"]);
      await emitEvent({ type: "appointment.cancelled", tenantId: ctx.tenantId, data: { leadId: input.leadId, appointmentTime: input.appointmentTime ?? lead.appointmentAt, phone: lead.phone, name: lead.name }, userId: ctx.user.id, timestamp: new Date() });
      return { success: true };
    }),
});
