import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { phoneSchema } from "../../shared/schemas/leads";
import { protectedProcedure, tenantProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import * as AutomationService from "../services/automation.service";
import * as TenantService from "../services/tenant.service";
import { runAutomationsForEvent } from "../services/automation-runner.service";
import type { EventType } from "../../shared/events";
import { automationTemplates } from "../../shared/templates";
import { isAppError } from "../_core/appErrors";

export const automationsRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => AutomationService.getAutomations(ctx.db, ctx.tenantId)),

  catalog: protectedProcedure.query(async () => automationTemplates),

  toggleByKey: tenantProcedure
    .input(z.object({ key: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      // Check trial status before enabling automations
      if (input.enabled) {
        const entitled = await TenantService.tenantHasAutomationAccess(ctx.db, ctx.tenantId);
        if (!entitled) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot enable automations: trial has expired or subscription is inactive"
          });
        }
        // Check plan automation limits
        const limits = await TenantService.getTenantPlanLimits(ctx.db, ctx.tenantId);
        const allAutomations = await AutomationService.getAutomations(ctx.db, ctx.tenantId);
        const enabledCount = allAutomations.filter((a) => a.enabled).length;
        if (enabledCount >= limits.maxAutomations) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Your ${limits.planName} plan allows up to ${limits.maxAutomations} active automations. Upgrade to Rebooked for unlimited automations.`,
          });
        }
      }

      const automation = await AutomationService.getAutomationByKey(ctx.db, ctx.tenantId, input.key);
      if (!automation) throw new TRPCError({ code: "NOT_FOUND" });
      await AutomationService.updateAutomation(ctx.db, ctx.tenantId, automation.id, { enabled: input.enabled });
      return { success: true };
    }),

  configureByKey: tenantProcedure
    .input(z.object({ key: z.string(), config: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      // Check trial status before configuring automations
      const entitled = await TenantService.tenantHasAutomationAccess(ctx.db, ctx.tenantId);
      if (!entitled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot configure automations: trial has expired or subscription is inactive"
        });
      }

      const automation = await AutomationService.getAutomationByKey(ctx.db, ctx.tenantId, input.key);
      if (!automation) throw new TRPCError({ code: "NOT_FOUND" });
      await AutomationService.upsertAutomationByKey(ctx.db, ctx.tenantId, input.key, {
        name: automation.name,
        category: automation.category,
        triggerType: automation.triggerType,
        triggerConfig: input.config,
        actions: [{ type: "send_message", body: String(input.config.message || ""), tone: "friendly" }],
        enabled: automation.enabled,
      });
      return { success: true };
    }),

  activateTemplate: tenantProcedure
    .input(z.object({ templateKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check trial status before activating automation templates
      const entitled = await TenantService.tenantHasAutomationAccess(ctx.db, ctx.tenantId);
      if (!entitled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot activate automations: trial has expired or subscription is inactive"
        });
      }

      const template = automationTemplates.find(t => t.key === input.templateKey);
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      type AutoTriggerType = "new_lead" | "inbound_message" | "status_change" | "time_delay" | "appointment_reminder" | "custom";
      const triggerMapping: Record<string, AutoTriggerType> = {
        "lead.created": "new_lead",
        "appointment.booked": "appointment_reminder",
        "appointment.no_show": "time_delay",
        "appointment.cancelled": "appointment_reminder",
        "message.received": "inbound_message",
      };
      type AutoCategory = "follow_up" | "reactivation" | "appointment" | "welcome" | "custom" | "no_show" | "cancellation" | "loyalty";
      await AutomationService.upsertAutomationByKey(ctx.db, ctx.tenantId, template.key, {
        name: template.name,
        category: template.category as AutoCategory,
        triggerType: (triggerMapping[template.trigger] || "new_lead") as "new_lead" | "inbound_message" | "status_change" | "time_delay" | "appointment_reminder",
        triggerConfig: {},
        conditions: [],
        actions: template.steps as Array<Record<string, unknown>>,
        enabled: true,
      });
      return { success: true };
    }),

  test: tenantProcedure
    .input(z.object({ automationId: z.number(), testPhone: phoneSchema }))
    .mutation(async ({ ctx, input }) => {
      const auto = await AutomationService.getAutomationById(ctx.db, ctx.tenantId, input.automationId);
      if (!auto) throw new TRPCError({ code: "NOT_FOUND" });
      await runAutomationsForEvent({ type: auto.triggerType as EventType, tenantId: ctx.tenantId, data: { phone: input.testPhone, first_name: "Test User" }, timestamp: new Date() });
      return { success: true, message: "Test sequence fired" };
    }),
});

export const aiRouter = router({
  rewrite: tenantProcedure
    .input(z.object({ message: z.string().min(1), tone: z.enum(["friendly", "professional", "casual", "urgent", "empathetic"]) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const limits = await TenantService.getTenantPlanLimits(ctx.db, ctx.tenantId);
        if (!limits.hasAiRewrite) {
          throw new TRPCError({ code: "FORBIDDEN", message: "AI rewrite is available on the Rebooked plan. Upgrade to access this feature." });
        }
        const result = await invokeLLM({ messages: [
          { role: "system", content: `Expert SMS copywriter. Rewrite in ${input.tone} tone. Under 160 chars. Return ONLY the message.` },
          { role: "user", content: input.message },
        ]});
        const content = (typeof result.choices?.[0]?.message?.content === "string" ? result.choices[0].message.content : "") || "";
        return { rewritten: content.trim() };
      } catch (err) {
        console.error("AI rewrite error:", err);
        if (isAppError(err)) {
          throw new TRPCError({ code: err.statusCode === 503 ? "SERVICE_UNAVAILABLE" : "INTERNAL_SERVER_ERROR", message: err.message });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI rewrite failed" });
      }
    }),

  // Optimizes a message for the given context (used by MessageOptimizer component)
  optimizeMessage: tenantProcedure
    .input(z.object({
      message: z.string().min(1).optional(),
      originalMessage: z.string().min(1).optional(),
      tone: z.string().optional(),
      messageType: z.string().optional(),
      creativityLevel: z.number().optional(),
      userSkillLevel: z.string().optional(),
      businessType: z.string().optional(),
      context: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const raw = input.originalMessage ?? input.message ?? "";
      // Delegate to AI rewrite if tone is provided
      if (input.tone) {
        try {
          const { invokeLLM } = await import("../_core/llm");
          const result = await invokeLLM({ messages: [
            { role: "system", content: `Expert SMS copywriter. Rewrite in ${input.tone} tone. Under 160 chars. Return ONLY the message.` },
            { role: "user", content: raw },
          ]});
          const content = (typeof result.choices?.[0]?.message?.content === "string" ? result.choices[0].message.content : "") || "";
          const optimized = content.trim() || raw;
          return {
            success: true,
            optimized,
            optimizedMessage: optimized,
            suggestions: [],
            optimization: {
              optimizedMessage: optimized,
              score: 85,
              improvements: [],
              variants: [],
            },
          };
        } catch {
          // Fall through to default
        }
      }
      return {
        success: true,
        optimized: raw,
        optimizedMessage: raw,
        suggestions: [],
        optimization: {
          optimizedMessage: raw,
          score: 70,
          improvements: [],
          variants: [],
        },
      };
    }),

  dryRun: tenantProcedure
    .input(z.object({ automationId: z.number(), leadId: z.number() }))
    .query(async ({ ctx, input }) => {
      const automation = await AutomationService.getAutomationById(ctx.db, ctx.tenantId, input.automationId);
      if (!automation) throw new TRPCError({ code: "NOT_FOUND", message: "Automation not found" });

      const { getLeadById } = await import("../services/lead.service");
      const lead = await getLeadById(ctx.db, ctx.tenantId, input.leadId);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });

      const tenant = await TenantService.getTenantById(ctx.db, ctx.tenantId);
      const config = automation.triggerConfig as Record<string, unknown> | null;
      const message = (config?.message as string) ?? "No message configured";

      const rendered = message
        .replace(/\{\{name\}\}/g, lead.name ?? "Customer")
        .replace(/\{\{business\}\}/g, tenant?.name ?? "Business")
        .replace(/\{\{phone\}\}/g, lead.phone ?? "")
        .replace(/\{\{date\}\}/g, new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }))
        .replace(/\{\{time\}\}/g, new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));

      return {
        wouldSend: true,
        message: rendered,
        recipientPhone: lead.phone ?? "",
        scheduledFor: new Date().toISOString(),
      };
    }),
});
