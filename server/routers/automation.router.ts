import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { phoneSchema } from "../../shared/schemas/leads";
import { protectedProcedure, tenantProcedure, router } from "../_core/trpc";
import * as AutomationService from "../services/automation.service";
import * as TenantService from "../services/tenant.service";
import { runAutomationsForEvent } from "../services/automation-runner.service";
import type { EventType } from "../../shared/events";
import { automationTemplates } from "../../shared/templates";
import { generateMessage, generateMessageVariations } from "../_core/messageGenerator";
import type { Tone } from "../_core/messageTemplates";
import { rewriteInTone } from "../_core/messageRewriter";

// ─── Automation Config Validation Schemas ────────────────────────────────────
// Ensures triggerConfig, conditions, and actions are well-formed before DB write.

const automationStepSchema = z.object({
  type: z.enum(["sms", "send_message", "delay", "webhook", "state_transition", "condition_check"]),
  body: z.string().optional(),
  message: z.string().optional(),
  messageKey: z.string().optional(),
  messageBody: z.string().optional(),
  tone: z.enum(["friendly", "professional", "casual", "urgent", "empathetic"]).optional(),
  value: z.union([z.number(), z.string()]).optional(), // delay seconds
  delaySeconds: z.number().optional(),
  url: z.string().url().optional(), // webhook URL
  targetState: z.enum(["detected", "contacted", "recovered", "billed"]).optional(),
}).passthrough(); // allow extra fields for forward compatibility

const automationConditionSchema = z.object({
  logic: z.enum(["and", "or"]).optional(),
  rules: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.unknown(),
  })).optional(),
}).passthrough();

/**
 * Validates an actions array. Returns the array if valid, throws TRPCError if not.
 */
function validateActions(actions: unknown): Array<Record<string, unknown>> {
  if (!actions || !Array.isArray(actions)) return [];
  try {
    return actions.map((step) => automationStepSchema.parse(step));
  } catch (err) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid automation step configuration: ${err instanceof z.ZodError ? err.issues.map(e => e.message).join(", ") : String(err)}`,
    });
  }
}

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
        actions: validateActions([{ type: "send_message", body: String(input.config.message || ""), tone: "friendly" }]),
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
      type AutoTriggerType = "new_lead" | "inbound_message" | "status_change" | "time_delay" | "appointment_reminder" | "missed_call" | "cancellation_flurry" | "win_back" | "birthday" | "loyalty_milestone" | "review_request" | "waitlist_slot_opened" | "rescheduling";
      const triggerMapping: Record<string, AutoTriggerType> = {
        "lead.created": "new_lead",
        "appointment.booked": "appointment_reminder",
        "appointment.no_show": "time_delay",
        "appointment.cancelled": "appointment_reminder",
        "message.received": "inbound_message",
      };
      type AutoCategory = "follow_up" | "reactivation" | "appointment" | "welcome" | "custom" | "no_show" | "cancellation" | "loyalty" | "review" | "rescheduling" | "waiting_list" | "lead_capture";
      await AutomationService.upsertAutomationByKey(ctx.db, ctx.tenantId, template.key, {
        name: template.name,
        category: template.category as AutoCategory,
        triggerType: (triggerMapping[template.trigger] || "new_lead") as "new_lead" | "inbound_message" | "status_change" | "time_delay" | "appointment_reminder",
        triggerConfig: {},
        conditions: [],
        actions: validateActions(template.steps),
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

  // One-click enable: create + configure + enable in a single call
  quickEnable: tenantProcedure
    .input(z.object({
      key: z.string(),
      config: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const entitled = await TenantService.tenantHasAutomationAccess(ctx.db, ctx.tenantId);
      if (!entitled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot enable automations: trial has expired or subscription is inactive",
        });
      }

      const template = automationTemplates.find((t) => t.key === input.key);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: `Unknown automation: ${input.key}` });

      type AutoTriggerType = "new_lead" | "inbound_message" | "status_change" | "time_delay" | "appointment_reminder" | "missed_call" | "cancellation_flurry" | "win_back" | "birthday" | "loyalty_milestone" | "review_request" | "waitlist_slot_opened" | "rescheduling";
      const triggerMapping: Record<string, AutoTriggerType> = {
        "lead.created": "new_lead",
        "appointment.booked": "appointment_reminder",
        "appointment.no_show": "time_delay",
        "appointment.cancelled": "appointment_reminder",
        "message.received": "inbound_message",
      };
      type AutoCategory = "follow_up" | "reactivation" | "appointment" | "welcome" | "custom" | "no_show" | "cancellation" | "loyalty" | "review" | "rescheduling" | "waiting_list" | "lead_capture";

      await AutomationService.upsertAutomationByKey(ctx.db, ctx.tenantId, template.key, {
        name: template.name,
        category: template.category as AutoCategory,
        triggerType: (triggerMapping[template.trigger] || "new_lead") as AutoTriggerType,
        triggerConfig: input.config ?? {},
        conditions: [],
        actions: validateActions(template.steps),
        enabled: true,
      });

      return { success: true };
    }),
});

export const aiRouter = router({
  rewrite: tenantProcedure
    .input(z.object({ message: z.string().min(1), tone: z.enum(["friendly", "professional", "casual", "urgent", "empathetic"]) }))
    .mutation(({ input }) => {
      // Fully in-house rewrite — zero external API cost
      const rewritten = rewriteInTone(input.message, input.tone as Tone);
      return { rewritten };
    }),

  // Optimizes a message for the given context (used by MessageOptimizer component)
  optimizeMessage: tenantProcedure
    .input(z.object({
      message: z.string().min(1).optional(),
      originalMessage: z.string().min(1).optional(),
      tone: z.enum(["friendly", "professional", "casual", "urgent", "empathetic"]).optional(),
      messageType: z.string().optional(),
      creativityLevel: z.number().optional(),
      userSkillLevel: z.string().optional(),
      businessType: z.string().optional(),
      context: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(({ input }) => {
      const raw = input.originalMessage ?? input.message ?? "";
      const tone = (input.tone ?? "friendly") as Tone;
      const msgType = (input.messageType ?? "generic") as any;

      // In-house optimization: rewrite in tone + generate alternatives
      const optimized = rewriteInTone(raw, tone);
      const improvements: string[] = [];
      const variants: string[] = [];

      // Score the message based on SMS best practices
      let score = 60;
      if (optimized.length <= 160) { score += 10; improvements.push("Message fits in a single SMS segment"); }
      if (optimized.length > 0 && optimized.length <= 120) { score += 5; improvements.push("Short and punchy — great for mobile"); }
      if (/\{[a-zA-Z]+\}/.test(optimized)) { score += 5; improvements.push("Uses personalization variables"); }
      if (/[!?]/.test(optimized)) { score += 3; improvements.push("Has a clear call to action"); }
      if (optimized.length > 160) { score -= 10; improvements.push("Consider shortening to fit 1 SMS segment (160 chars)"); }

      // Generate 2 tone variants
      const tones: Tone[] = ["friendly", "professional", "casual", "urgent", "empathetic"];
      const otherTones = tones.filter((t) => t !== tone).slice(0, 2);
      for (const t of otherTones) {
        variants.push(rewriteInTone(raw, t));
      }

      // Generate a fresh template-based alternative if messageType is known
      if (msgType !== "generic") {
        try {
          const fresh = generateMessage({ type: msgType, tone, variables: {} });
          if (fresh && fresh !== optimized) variants.push(fresh);
        } catch { /* type not found — fine */ }
      }

      return {
        success: true,
        optimized,
        optimizedMessage: optimized,
        suggestions: improvements,
        optimization: {
          optimizedMessage: optimized,
          score: Math.min(score, 100),
          improvements,
          variants: variants.slice(0, 3),
        },
      };
    }),

  // ─── Message generation (in-house, no external API cost) ───────────────
  generate: protectedProcedure
    .input(z.object({
      type: z.string(),
      tone: z.enum(["friendly", "professional", "casual", "urgent", "empathetic"]),
      variables: z.record(z.string(), z.string()).default({}),
      maxChars: z.number().optional(),
    }))
    .mutation(({ input }) => {
      const message = generateMessage({
        type: input.type as any,
        tone: input.tone as Tone,
        variables: input.variables,
        maxChars: input.maxChars,
      });
      return { message, charCount: message.length };
    }),

  generateVariations: protectedProcedure
    .input(z.object({
      type: z.string(),
      tone: z.enum(["friendly", "professional", "casual", "urgent", "empathetic"]),
      variables: z.record(z.string(), z.string()).default({}),
      count: z.number().min(1).max(5).default(3),
    }))
    .mutation(({ input }) => {
      const variations = generateMessageVariations(
        { type: input.type as any, tone: input.tone as Tone, variables: input.variables },
        input.count,
      );
      return { variations };
    }),

  // ─── RebookedAI Chat (action engine + knowledge base Q&A) ──────────────
  chat: tenantProcedure
    .input(z.object({
      message: z.string().min(1),
      history: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        timestamp: z.number(),
      })).optional(),
      skillLevel: z.enum(["basic", "beginner", "intermediate", "advanced", "expert"]).optional(),
      pendingAction: z.object({
        type: z.string(),
        params: z.record(z.string(), z.unknown()),
      }).nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { detectIntent, executeAction } = await import("../_core/chatActions");
        const { getUserById } = await import("../services/user.service");
        const AnalyticsService = await import("../services/analytics.service");
        const CalendarSync = await import("../services/calendar/calendar-sync.service");
        const LeadService = await import("../services/lead.service");

        console.log("[RebookedAI] chat message:", input.message, "tenantId:", ctx.tenantId);

        // ── Build user profile with LIVE platform data (rich context) ──
        const [tenant, automations, user, planLimits, dashMetrics, calConnections, recentLeadsData, revenueMetrics, leakageMetrics, deliveryRaw, trendData] = await Promise.all([
          TenantService.getTenantById(ctx.db, ctx.tenantId),
          AutomationService.getAutomations(ctx.db, ctx.tenantId),
          getUserById(ctx.db, ctx.user.id),
          TenantService.getTenantPlanLimits(ctx.db, ctx.tenantId),
          AnalyticsService.getDashboardMetrics(ctx.db, ctx.tenantId).catch(() => ({ leadCount: 0, messageCount: 0, automationCount: 0, bookedCount: 0 })),
          CalendarSync.listConnections(ctx.db, ctx.tenantId).catch(() => []),
          LeadService.getLeads(ctx.db, ctx.tenantId, { limit: 10 }).catch(() => ({ leads: [], total: 0 })),
          AnalyticsService.getRevenueRecoveryMetrics(ctx.db, ctx.tenantId).catch(() => ({
            totalRecoveredRevenue: 0, recentRecoveredRevenue: 0, overallRecoveryRate: 0, recentRecoveryRate: 0,
            avgRevenuePerBooking: 0, qualifiedLeadsCount: 0, contactedLeadsCount: 0, lostLeadsCount: 0,
            totalLeadsCount: 0, bookedLeadsCount: 0, recentBookingsCount: 0, recoveredLeadsCount: 0,
            potentialRevenue: 0, lostRevenue: 0, pipelineRevenue: 0,
          })),
          AnalyticsService.getLeakageMetrics(ctx.db, ctx.tenantId).catch(() => ({
            unconfirmedAppointments: 0, qualifiedUnbooked: 0, cancellationsUnrecovered: 0, failedDeliveryRecovery: 0,
          })),
          AnalyticsService.getMessageVolume(ctx.db, ctx.tenantId, 30).catch(() => []),
          AnalyticsService.getRevenueTrends(ctx.db, ctx.tenantId, 30).catch(() => []),
        ]);

        const settings = (tenant?.settings ?? {}) as Record<string, any>;
        const leads = recentLeadsData?.leads ?? [];
        const noShowCount = leads.filter((l: any) => l.status === "lost").length;

        // Count today's appointments from calendar connections
        let todayAppointments = 0;
        try {
          const now = new Date();
          const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
          const events = await CalendarSync.getCalendarEvents(ctx.db, ctx.tenantId, now, endOfDay);
          todayAppointments = events?.length ?? 0;
        } catch { /* non-fatal */ }

        // Compute delivery stats from message volume data
        const deliveryArr = Array.isArray(deliveryRaw) ? deliveryRaw : [];
        const outbound = deliveryArr.filter((m: any) => m.direction === "outbound");
        const totalSent = outbound.reduce((s: number, m: any) => s + Number(m.count || 0), 0);
        const failedEst = Math.round(totalSent * 0.05); // conservative fallback
        const deliveredEst = totalSent - failedEst;
        const deliveryStats = { total: totalSent, delivered: deliveredEst, failed: failedEst, rate: totalSent > 0 ? (deliveredEst / totalSent) * 100 : 100 };

        // Compute trend direction
        const trends = Array.isArray(trendData) ? trendData : [];
        let revenueTrend: "up" | "down" | "flat" = "flat";
        let leadTrend: "up" | "down" | "flat" = "flat";
        if (trends.length >= 14) {
          const mid = Math.floor(trends.length / 2);
          const recentBookings = trends.slice(mid).reduce((s: number, t: any) => s + (t.bookings || 0), 0);
          const olderBookings = trends.slice(0, mid).reduce((s: number, t: any) => s + (t.bookings || 0), 0);
          revenueTrend = recentBookings > olderBookings * 1.1 ? "up" : recentBookings < olderBookings * 0.9 ? "down" : "flat";
          const recentLeadsT = trends.slice(mid).reduce((s: number, t: any) => s + (t.totalLeads || 0), 0);
          const olderLeadsT = trends.slice(0, mid).reduce((s: number, t: any) => s + (t.totalLeads || 0), 0);
          leadTrend = recentLeadsT > olderLeadsT * 1.1 ? "up" : recentLeadsT < olderLeadsT * 0.9 ? "down" : "flat";
        }

        const realRevenue = revenueMetrics.totalRecoveredRevenue ?? 0;

        const profile = {
          userId: ctx.user.id,
          tenantId: ctx.tenantId,
          tenantName: tenant?.name ?? "",
          email: user?.email ?? settings.email ?? "",
          phone: tenant?.phone ?? settings.phone ?? "",
          website: tenant?.website ?? settings.website ?? "",
          address: settings.address ?? "",
          city: settings.city ?? "",
          stateRegion: settings.stateRegion ?? "",
          zipCode: settings.zipCode ?? "",
          timezone: tenant?.timezone ?? "",
          industry: tenant?.industry ?? "",
          skillLevel: user?.skillLevel ?? "basic",
          automations: automations.map((a: any) => ({
            key: a.key ?? a.triggerType ?? "",
            name: a.name ?? "",
            enabled: !!a.enabled,
          })),
          planName: planLimits.planName ?? "Free",
          messagesSent: dashMetrics.messageCount ?? 0,
          revenueRecovered: realRevenue,
          leadCount: dashMetrics.leadCount ?? 0,
          bookedCount: dashMetrics.bookedCount ?? 0,
          noShowCount,
          connectedCalendars: calConnections?.length ?? 0,
          recentLeads: leads.slice(0, 10).map((l: any) => ({ name: l.name || "Unnamed", status: l.status, phone: l.phone })),
          todayAppointments,
          // ── Rich context ──
          totalRecoveredRevenue: realRevenue,
          recentRecoveredRevenue: revenueMetrics.recentRecoveredRevenue ?? 0,
          overallRecoveryRate: revenueMetrics.overallRecoveryRate ?? 0,
          recentRecoveryRate: revenueMetrics.recentRecoveryRate ?? 0,
          avgRevenuePerBooking: revenueMetrics.avgRevenuePerBooking ?? 0,
          qualifiedLeadCount: revenueMetrics.qualifiedLeadsCount ?? 0,
          contactedLeadCount: revenueMetrics.contactedLeadsCount ?? 0,
          lostLeadCount: revenueMetrics.lostLeadsCount ?? 0,
          leakageMetrics,
          deliveryStats,
          revenueTrend,
          leadTrend,
        };

        // ── Step 1: Detect intent from user message ──
        const intent = detectIntent(input.message);

        if (intent) {
          console.log("[RebookedAI] detected intent:", intent.action, "params:", intent.params);

          const actionResult = await executeAction(
            ctx.db,
            ctx.tenantId,
            ctx.user.id,
            intent,
            profile,
            input.pendingAction ?? null,
          );

          console.log("[RebookedAI] action result:", actionResult.actionType, "executed:", actionResult.executed);

          // Build action-aware suggestions (context-sensitive)
          const actionSuggestions: string[] = [];
          if (actionResult.needsConfirmation) {
            actionSuggestions.push("Yes, go ahead", "No, cancel");
          } else if (actionResult.actionType === "show_profile") {
            actionSuggestions.push("Show my revenue", "Show my automations", "How can I improve?");
          } else if (actionResult.actionType === "show_automations") {
            actionSuggestions.push("How are my automations performing?", "Enable appointment reminder", "Show revenue leakage");
          } else if (actionResult.actionType === "show_revenue") {
            actionSuggestions.push("Show revenue leakage", "Predict my revenue", "How can I improve?");
          } else if (actionResult.actionType === "show_leakage") {
            actionSuggestions.push("How can I improve?", "Show my automations", "Predict my revenue");
          } else if (actionResult.actionType === "show_predictions") {
            actionSuggestions.push("Show revenue leakage", "How can I improve?", "Generate a report");
          } else if (actionResult.actionType === "generate_report") {
            actionSuggestions.push("How can I improve?", "Show revenue leakage", "Predict my revenue");
          } else if (actionResult.actionType === "optimize_suggestions") {
            actionSuggestions.push("Show my automations", "Show revenue leakage", "Generate a report");
          } else {
            // Default: data-driven suggestions based on profile state
            if (profile.totalRecoveredRevenue > 0) actionSuggestions.push("Show my revenue");
            if (profile.leakageMetrics.qualifiedUnbooked > 0) actionSuggestions.push("Show revenue leakage");
            if (actionSuggestions.length < 3) actionSuggestions.push("How can I improve?");
            if (actionSuggestions.length < 3) actionSuggestions.push("Generate a report");
          }

          return {
            answer: actionResult.confirmationMessage,
            confidence: intent.confidence,
            category: "action" as const,
            suggestions: actionSuggestions,
            matchedQuestion: input.message,
            action: {
              pending: actionResult.needsConfirmation ?? false,
              executed: actionResult.executed,
              pendingAction: actionResult.pendingAction ?? undefined,
              description: actionResult.description,
            },
          };
        }

        // ── Step 2: Knowledge base, then LLM fallback if low confidence ──
        console.log("[RebookedAI] no intent detected, trying KB then LLM");
        const { processUserQuery, chatWithContext } = await import("../_core/chatEngine");
        const { generateInsights } = await import("../_core/chatInsights");
        const kbResult = processUserQuery(input.message, input.history, input.skillLevel);

        // Generate proactive insights to attach to the response
        let proactiveInsight: { type: string; title: string; message: string; actionLabel?: string; actionIntent?: string } | undefined;
        try {
          const insights = generateInsights(profile);
          if (insights.length > 0) {
            const top = insights[0];
            proactiveInsight = { type: top.type, title: top.title, message: top.message, actionLabel: top.actionLabel, actionIntent: top.actionIntent };
          }
        } catch { /* non-fatal */ }

        // If KB confidence is low, use smart context engine (in-house, no external API)
        if (kbResult.confidence < 0.4) {
          console.log("[RebookedAI] KB confidence low (" + kbResult.confidence.toFixed(2) + "), routing to context engine");
          const llmResult = await chatWithContext(input.message, profile, input.history);
          return {
            answer: llmResult.answer,
            confidence: llmResult.confidence,
            category: llmResult.category,
            suggestions: llmResult.suggestions,
            matchedQuestion: llmResult.matchedQuestion,
            action: undefined,
            proactiveInsight,
          };
        }

        return {
          answer: kbResult.answer,
          confidence: kbResult.confidence,
          category: kbResult.category,
          suggestions: kbResult.suggestions,
          matchedQuestion: kbResult.matchedQuestion,
          action: undefined,
          proactiveInsight,
        };
      } catch (err: any) {
        console.error("[RebookedAI] chat error:", err);

        // If it's already a TRPCError, rethrow
        if (err instanceof TRPCError) throw err;

        return {
          answer: "Sorry, something went wrong processing your message. Please try again.",
          confidence: 0,
          category: "error",
          suggestions: ["Show my profile", "What can you do?"],
          matchedQuestion: input.message,
          action: undefined,
        };
      }
    }),

  // ─── RebookedAI Suggested questions (data-adaptive) ──────────────────
  suggestions: tenantProcedure
    .input(z.object({ category: z.string().optional(), skillLevel: z.enum(["basic", "beginner", "intermediate", "advanced", "expert"]).optional() }))
    .query(async ({ ctx, input }) => {
      const { getSuggestedQuestions } = await import("../_core/chatEngine");
      const baseSuggestions = getSuggestedQuestions(input.category, input.skillLevel);

      // Build data-adaptive priority suggestions
      const priority: string[] = [];
      try {
        const AnalyticsService = await import("../services/analytics.service");
        const CalendarSync = await import("../services/calendar/calendar-sync.service");
        const [metrics, connections] = await Promise.all([
          AnalyticsService.getDashboardMetrics(ctx.db, ctx.tenantId).catch(() => null),
          CalendarSync.listConnections(ctx.db, ctx.tenantId).catch(() => []),
        ]);
        if ((connections?.length ?? 0) === 0) priority.push("Connect your booking software");
        if ((metrics?.leadCount ?? 0) === 0) priority.push("How do I add my first lead?");
        if ((metrics?.leadCount ?? 0) > 0 && (metrics?.bookedCount ?? 0) === 0) priority.push("How can I convert leads to bookings?");
        if ((metrics?.messageCount ?? 0) < 5) priority.push("Send your first SMS campaign");
        if ((metrics?.leadCount ?? 0) > 5) priority.push("How am I doing?");
        priority.push("What should I do next?");
      } catch { /* use base suggestions */ }

      // Merge: priority first, then fill with base (no dupes)
      const merged = [...priority];
      for (const s of baseSuggestions) {
        if (!merged.includes(s) && merged.length < 8) merged.push(s);
      }
      return merged.slice(0, 8);
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
