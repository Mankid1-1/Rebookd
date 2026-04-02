/**
 * n8n Callback Router
 *
 * These endpoints are called BY n8n workflows to perform actions that require
 * Rebooked's compliance enforcement (TCPA, rate limits, consent checks).
 *
 * n8n orchestrates WHAT to do and WHEN.
 * Rebooked enforces HOW — consent, quiet hours, rate limits, and audit logging.
 *
 * Authentication: n8nKey in body OR X-N8n-Signature HMAC header.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { sendSMS } from "../_core/sms";
import { getDb } from "../db";
import { leads, automationLogs, tenants, templates } from "../../drizzle/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { hasSmsConsent } from "../services/tcpa-compliance.service";
import { getN8nStatus } from "../services/n8n-bridge.service";
import { verifySignature } from "../services/n8n-bridge.service";
import { checkN8nRateLimit } from "../services/n8n-rate-limiter.service";
import { emitEvent } from "../services/event-bus.service";
import { nanoid } from "nanoid";
import { logger } from "../_core/logger";

// ─── Auth helpers ────��───────────────────────────────────────────────────────

/**
 * Dual auth: accepts EITHER n8nKey in body OR X-N8n-Signature HMAC header.
 * Backward-compatible with existing workflows using body key.
 */
function assertN8nAuth(key: string | undefined, ctx?: any) {
  if (!ENV.n8nApiKey) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "n8n API key not configured" });
  }

  // Method 1: Direct key comparison (legacy)
  if (key && key === ENV.n8nApiKey) return;

  // Method 2: HMAC signature verification (new)
  if (ctx?.req) {
    const signature = ctx.req.headers["x-n8n-signature"] as string | undefined;
    if (signature) {
      const rawBody = JSON.stringify(ctx.req.body);
      if (verifySignature(rawBody, signature, ENV.n8nApiKey)) return;
    }
  }

  // Both methods failed
  if (key !== ENV.n8nApiKey) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid n8n API key or signature" });
  }
}

function assertRateLimit(tenantId: number, endpoint: string, limit: number) {
  if (!checkN8nRateLimit(tenantId, endpoint, limit)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded for ${endpoint}: max ${limit}/min per tenant`,
    });
  }
}

// ─── Whitelist of events n8n can trigger back into the event bus ─────────────
const ALLOWED_TRIGGER_EVENTS = new Set([
  "lead.created",
  "lead.qualified",
  "lead.win_back_due",
  "lead.win_back_30d",
  "lead.vip_winback_45d",
  "lead.vip_winback_90d",
  "lead.birthday",
  "lead.loyalty_milestone",
  "lead.feedback_due",
  "lead.upsell_due",
  "lead.next_visit_due",
  "lead.followup_due",
  "appointment.booked",
  "appointment.confirmation_chase",
  "appointment.cancelled",
  "appointment.cancellation_rescue_7d",
  "appointment.rescheduled",
  "appointment.no_show",
  "appointment.no_show_rebook",
  "appointment.reminder_24h",
  "appointment.reminder_2h",
  "call.missed",
  "call.missed_followup",
  "call.missed_final",
  "message.received",
  "message.delivery_failed",
  "review.requested",
  "waitlist.slot_opened",
]);

export const n8nRouter = router({
  // ─── EXISTING ENDPOINTS (enhanced with dual auth) ──────────────────────────

  /**
   * n8n calls this to send an SMS through Rebooked.
   * Full TCPA + rate limit + consent checks enforced here.
   */
  sendSms: publicProcedure
    .input(
      z.object({
        n8nKey: z.string(),
        tenantId: z.number(),
        leadId: z.number(),
        body: z.string().min(1).max(1600),
        workflowKey: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertN8nAuth(input.n8nKey, ctx);
      assertRateLimit(input.tenantId, "sendSms", 100);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [lead] = await (db as any)
        .select()
        .from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.tenantId, input.tenantId)))
        .limit(1);

      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      }

      if (!lead.phone) {
        return { success: false, blocked: true, reason: "Lead has no phone number" };
      }

      const hasConsent = await hasSmsConsent(db, input.tenantId, input.leadId);
      if (!hasConsent) {
        logger.warn("[n8n] SMS blocked by TCPA compliance", {
          leadId: input.leadId,
          reason: "No SMS consent or lead is unsubscribed",
          workflowKey: input.workflowKey,
        });

        await (db as any).insert(automationLogs).values({
          id: nanoid(),
          tenantId: input.tenantId,
          leadId: input.leadId,
          automationKey: `n8n:${input.workflowKey}`,
          eventType: "n8n_sms",
          stepType: "sms",
          status: "tcpa_blocked",
          errorMessage: "No SMS consent or lead is unsubscribed",
          createdAt: new Date(),
        });

        return { success: false, blocked: true, reason: "No SMS consent or lead is unsubscribed" };
      }

      const result = await sendSMS(lead.phone, input.body, undefined, input.tenantId);

      await (db as any).insert(automationLogs).values({
        id: nanoid(),
        tenantId: input.tenantId,
        leadId: input.leadId,
        automationKey: `n8n:${input.workflowKey}`,
        eventType: "n8n_sms",
        stepType: "sms",
        status: result.success ? "completed" : "failed",
        errorMessage: result.error ?? null,
        metadata: JSON.stringify({ provider: result.provider, sid: result.sid }),
        createdAt: new Date(),
      });

      return { success: result.success, sid: result.sid, provider: result.provider, error: result.error };
    }),

  /**
   * n8n calls this to update a lead's status.
   */
  updateLead: publicProcedure
    .input(
      z.object({
        n8nKey: z.string(),
        tenantId: z.number(),
        leadId: z.number(),
        status: z.enum(["new", "contacted", "qualified", "booked", "closed", "unsubscribed"]).optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertN8nAuth(input.n8nKey, ctx);
      assertRateLimit(input.tenantId, "updateLead", 100);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.status) updates.status = input.status;
      if (input.notes) updates.notes = input.notes;

      await (db as any)
        .update(leads)
        .set(updates)
        .where(and(eq(leads.id, input.leadId), eq(leads.tenantId, input.tenantId)));

      return { success: true };
    }),

  /**
   * n8n calls this to log workflow execution results for monitoring.
   */
  logExecution: publicProcedure
    .input(
      z.object({
        n8nKey: z.string(),
        tenantId: z.number(),
        workflowKey: z.string(),
        leadId: z.number().optional(),
        status: z.enum(["success", "failed", "skipped"]),
        durationMs: z.number().optional(),
        errorMessage: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertN8nAuth(input.n8nKey, ctx);

      logger.info("[n8n] Workflow execution logged", {
        tenantId: input.tenantId,
        workflowKey: input.workflowKey,
        status: input.status,
        durationMs: input.durationMs,
      });

      const db = await getDb();
      if (db) {
        await (db as any).insert(automationLogs).values({
          id: nanoid(),
          tenantId: input.tenantId,
          leadId: input.leadId ?? null,
          automationKey: `n8n:${input.workflowKey}`,
          eventType: "n8n_execution",
          stepType: "n8n_workflow",
          status: input.status === "success" ? "completed" : input.status,
          durationMs: input.durationMs ?? null,
          errorMessage: input.errorMessage ?? null,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          createdAt: new Date(),
        });
      }

      return { success: true };
    }),

  /**
   * Get n8n connection status — used by the admin UI.
   */
  status: publicProcedure.query(async () => {
    return await getN8nStatus();
  }),

  // ─── NEW ENDPOINTS ���────────────────────────────────────────────────────────

  /**
   * n8n fetches lead details for message personalization.
   */
  getLeadInfo: publicProcedure
    .input(
      z.object({
        n8nKey: z.string(),
        tenantId: z.number(),
        leadId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      assertN8nAuth(input.n8nKey, ctx);
      assertRateLimit(input.tenantId, "getLeadInfo", 100);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [lead] = await (db as any)
        .select()
        .from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.tenantId, input.tenantId)))
        .limit(1);

      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      }

      return {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        status: lead.status,
        source: lead.source,
        tags: lead.tags,
        timezone: lead.timezone,
        notes: lead.notes,
        appointmentAt: lead.appointmentAt,
        lastMessageAt: lead.lastMessageAt,
        visitCount: lead.visitCount ?? 0,
        birthday: lead.birthday,
        createdAt: lead.createdAt,
      };
    }),

  /**
   * n8n fetches tenant business info for templates/personalization.
   */
  getTenantConfig: publicProcedure
    .input(
      z.object({
        n8nKey: z.string(),
        tenantId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      assertN8nAuth(input.n8nKey, ctx);
      assertRateLimit(input.tenantId, "getTenantConfig", 30);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [tenant] = await (db as any)
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      }

      return {
        id: tenant.id,
        businessName: tenant.name,
        timezone: tenant.timezone,
        industry: tenant.industry,
        website: tenant.website,
        phone: tenant.phone,
        plan: tenant.plan,
        bookingUrl: tenant.bookingUrl ?? `${ENV.frontendUrl}/book/${tenant.slug}`,
        reviewUrl: tenant.reviewUrl ?? null,
      };
    }),

  /**
   * n8n resolves a message template by key with variable substitution.
   */
  getTemplateContent: publicProcedure
    .input(
      z.object({
        n8nKey: z.string(),
        tenantId: z.number(),
        templateKey: z.string(),
        variables: z.record(z.string(), z.string()).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      assertN8nAuth(input.n8nKey, ctx);
      assertRateLimit(input.tenantId, "getTemplateContent", 100);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [template] = await (db as any)
        .select()
        .from(templates)
        .where(
          and(
            eq(templates.tenantId, input.tenantId),
            eq(templates.key, input.templateKey),
            isNull(templates.deletedAt),
          ),
        )
        .limit(1);

      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Template '${input.templateKey}' not found` });
      }

      let resolvedBody = template.body;
      if (input.variables) {
        for (const [key, value] of Object.entries(input.variables)) {
          resolvedBody = resolvedBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
        }
      }

      return {
        key: template.key,
        name: template.name,
        body: template.body,
        resolvedBody,
        tone: template.tone,
      };
    }),

  /**
   * n8n creates a new lead from external sources (web forms, integrations).
   * Emits a lead.created event through the event bus for downstream automations.
   */
  createLead: publicProcedure
    .input(
      z.object({
        n8nKey: z.string(),
        tenantId: z.number(),
        name: z.string().optional(),
        phone: z.string().min(7).max(20),
        email: z.string().email().optional(),
        source: z.string().optional(),
        notes: z.string().optional(),
        tags: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertN8nAuth(input.n8nKey, ctx);
      assertRateLimit(input.tenantId, "createLead", 50);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const result = await (db as any).insert(leads).values({
        tenantId: input.tenantId,
        name: input.name ?? "Unknown",
        phone: input.phone,
        email: input.email,
        source: input.source ?? "n8n",
        notes: input.notes,
        tags: input.tags,
        status: "new",
        smsConsent: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const leadId = result[0]?.insertId ?? result.insertId;

      // Emit event for downstream automations (welcome, follow-ups, etc.)
      await emitEvent({
        id: nanoid(),
        type: "lead.created",
        tenantId: input.tenantId,
        leadId,
        data: { phone: input.phone, name: input.name, source: input.source ?? "n8n" },
      } as any);

      // Audit log
      await (db as any).insert(automationLogs).values({
        id: nanoid(),
        tenantId: input.tenantId,
        leadId,
        automationKey: "n8n:create-lead",
        eventType: "n8n_create_lead",
        stepType: "api_call",
        status: "completed",
        createdAt: new Date(),
      });

      return { success: true, leadId };
    }),

  /**
   * n8n books an appointment for a lead.
   * Emits appointment.booked event for confirmation and reminder automations.
   */
  scheduleAppointment: publicProcedure
    .input(
      z.object({
        n8nKey: z.string(),
        tenantId: z.number(),
        leadId: z.number(),
        appointmentAt: z.string(), // ISO 8601
        duration: z.number().optional(), // minutes
        service: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertN8nAuth(input.n8nKey, ctx);
      assertRateLimit(input.tenantId, "scheduleAppointment", 50);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verify lead exists and belongs to tenant
      const [lead] = await (db as any)
        .select()
        .from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.tenantId, input.tenantId)))
        .limit(1);

      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      }

      const appointmentDate = new Date(input.appointmentAt);

      // Update lead with appointment info
      await (db as any)
        .update(leads)
        .set({
          appointmentAt: appointmentDate,
          status: "booked",
          updatedAt: new Date(),
        })
        .where(eq(leads.id, input.leadId));

      // Emit event for confirmation + reminder automations
      await emitEvent({
        id: nanoid(),
        type: "appointment.booked",
        tenantId: input.tenantId,
        leadId: input.leadId,
        data: {
          appointmentAt: appointmentDate.toISOString(),
          duration: input.duration ?? 60,
          service: input.service,
          notes: input.notes,
          leadName: lead.name,
          leadPhone: lead.phone,
        },
      } as any);

      // Audit log
      await (db as any).insert(automationLogs).values({
        id: nanoid(),
        tenantId: input.tenantId,
        leadId: input.leadId,
        automationKey: "n8n:schedule-appointment",
        eventType: "n8n_schedule_appointment",
        stepType: "api_call",
        status: "completed",
        metadata: JSON.stringify({ appointmentAt: input.appointmentAt, service: input.service }),
        createdAt: new Date(),
      });

      return { success: true, appointmentAt: appointmentDate.toISOString() };
    }),

  /**
   * n8n triggers whitelisted events back into the event bus.
   * Only a curated set of safe event types are allowed.
   */
  triggerEvent: publicProcedure
    .input(
      z.object({
        n8nKey: z.string(),
        tenantId: z.number(),
        eventType: z.string(),
        leadId: z.number().optional(),
        data: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertN8nAuth(input.n8nKey, ctx);
      assertRateLimit(input.tenantId, "triggerEvent", 30);

      if (!ALLOWED_TRIGGER_EVENTS.has(input.eventType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Event type '${input.eventType}' is not allowed. Allowed: ${[...ALLOWED_TRIGGER_EVENTS].join(", ")}`,
        });
      }

      await emitEvent({
        id: nanoid(),
        type: input.eventType,
        tenantId: input.tenantId,
        leadId: input.leadId,
        data: input.data ?? {},
      } as any);

      // Audit log
      const db = await getDb();
      if (db) {
        await (db as any).insert(automationLogs).values({
          id: nanoid(),
          tenantId: input.tenantId,
          leadId: input.leadId ?? null,
          automationKey: "n8n:trigger-event",
          eventType: input.eventType,
          stepType: "api_call",
          status: "completed",
          metadata: JSON.stringify({ triggeredBy: "n8n" }),
          createdAt: new Date(),
        });
      }

      return { success: true, eventType: input.eventType };
    }),
});
