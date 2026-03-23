// server/routers.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createLeadSchema, updateLeadSchema, updateLeadStatusSchema, sendMessageSchema, loginSchema, paginationSchema } from "../shared/schemas/leads";
import { phoneSchema } from "../shared/schemas/leads";
import Stripe from "stripe";
import { desc, eq, and, gte, sql } from "drizzle-orm";
import { subscriptions, messages, authRateLimits } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { sendEmail } from "./_core/email";
import { protectedProcedure, tenantProcedure, publicProcedure, adminProcedure, router } from "./_core/trpc";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import * as LeadService from "./services/lead.service";
import * as TenantService from "./services/tenant.service";
import * as UserService from "./services/user.service";
import * as AutomationService from "./services/automation.service";
import * as TemplateService from "./services/template.service";
import * as AnalyticsService from "./services/analytics.service";
import * as AiService from "./services/ai.service";
import * as AuthService from "./services/auth.service";
import * as SystemService from "./services/system.service";
import * as BillingService from "./services/billing.service";
import * as AdminAuditService from "./services/adminAudit.service";
import { EmailService } from "./services/email.service";
import { emitEvent } from "./services/eventBus";
import { runAutomationsForEvent } from "./services/automationRunner";
import { automationTemplates } from "../shared/templates";
import { isAppError } from "./_core/appErrors";
import { ENV } from "./_core/env";
import { verifyInboundWebhookSignature } from "./_core/webhookSignature";
import * as WebhookDedupService from "./services/webhookDedup.service";

function clampAdminPagination(input?: { page?: number; limit?: number }) {
  const page = Math.max(1, input?.page ?? 1);
  const limit = Math.min(100, Math.max(1, input?.limit ?? 50));
  return { page, limit };
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, "Password must contain at least 12 characters, including uppercase, lowercase, number, and special character"),
  captchaToken: z.string().optional(),
  website: z.string().max(0).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(12),
  password: z.string().min(12).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, "Password must contain at least 12 characters, including uppercase, lowercase, number, and special character"),
});

async function sendVerificationEmail(email: string, token: string) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const verifyUrl = `${appUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: email,
    subject: "Verify your Rebooked email",
    text: `Verify your email to activate your account: ${verifyUrl}`,
    html: `<p>Verify your email to activate your account.</p><p><a href="${verifyUrl}">Verify email</a></p>`,
  });
}

async function sendPasswordResetEmail(email: string, token: string) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const resetUrl = `${appUrl}/login?mode=reset&token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: email,
    subject: "Reset your Rebooked password",
    text: `Reset your password using this secure link: ${resetUrl}`,
    html: `<p>Reset your password using this secure link.</p><p><a href="${resetUrl}">Reset password</a></p>`,
  });
}

async function auditAdminRead(
  ctx: { db: any; user: { id: number; email?: string | null }; req: { path?: string } },
  action: string,
  metadata?: Record<string, unknown>,
) {
  await AdminAuditService.recordAdminAudit(ctx.db, {
    adminUserId: ctx.user.id,
    adminEmail: ctx.user.email,
    action,
    route: ctx.req.path,
    metadata,
    targetTenantId: typeof metadata?.tenantId === "number" ? metadata.tenantId : undefined,
    targetUserId: typeof metadata?.userId === "number" ? metadata.userId : undefined,
  });
}

// Database-backed auth rate limiting (per email, max 10 attempts / 15 min)
async function checkAuthRateLimit(db: any, email: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 15 * 60 * 1000);
  const maxAttempts = 10;
  
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(authRateLimits)
      .where(
        and(
          eq(authRateLimits.email, email),
          gte(authRateLimits.createdAt, windowStart)
        )
      );
    
    if (Number(count) >= maxAttempts) {
      return false;
    }
    
    // Record this attempt
    await db.insert(authRateLimits).values({
      email,
      createdAt: new Date(),
    });
    
    return true;
  } catch (error) {
    // If table doesn't exist, fall back to simple check
    console.warn("Auth rate limit table error:", error);
    return true;
  }
}

export const appRouter = router({
  // ─── AUTH ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => ctx.user ?? null),

    logout: protectedProcedure.mutation(async ({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, {
        maxAge: -1,
        ...getSessionCookieOptions(ctx.req),
        secure: true,
        sameSite: "none",
      });
      return { success: true };
    }),

    signup: publicProcedure
      .input(signupSchema)
      .mutation(async ({ input, ctx }) => {
        if (input.website) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Spam protection triggered" });
        }
        if (!await checkAuthRateLimit(ctx.db, input.email)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Try again later." });
        }
        const db = ctx.db;
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const existing = await UserService.getUserByEmail(db, input.email);
        if (existing?.emailVerifiedAt) throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
        if (existing && !existing.emailVerifiedAt) {
          const verifyToken = await AuthService.createEmailVerificationToken(db, existing.id, input.email);
          await sendVerificationEmail(input.email, verifyToken);
          return { success: true, pendingVerification: true };
        }
        const passwordHash = await bcrypt.hash(input.password, 10);
        const openId = randomUUID();
        await UserService.createUser(db, { openId, email: input.email, passwordHash, loginMethod: "password", role: "user", active: true });
        const created = await UserService.getUserByOpenId(db, openId);
        if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user" });
        const verifyToken = await AuthService.createEmailVerificationToken(db, created.id, input.email);
        await sendVerificationEmail(input.email, verifyToken);
        return { success: true, pendingVerification: true };
      }),

    login: publicProcedure
      .input(loginSchema)
      .mutation(async ({ input, ctx }) => {
        if (!await checkAuthRateLimit(ctx.db, input.email)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Try again later." });
        }
        const db = ctx.db;
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const user = await UserService.getUserByEmail(db, input.email);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        if (!user.passwordHash) throw new TRPCError({ code: "UNAUTHORIZED", message: "No password set for this user" });
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        if (!user.emailVerifiedAt) {
          const verifyToken = await AuthService.createEmailVerificationToken(db, user.id, user.email || input.email);
          await sendVerificationEmail(user.email || input.email, verifyToken);
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Verify your email before signing in. We sent a fresh link." });
        }
        await UserService.updateLastSignedIn(db, user.id);
        ctx.res.cookie(COOKIE_NAME, user.openId, { ...getSessionCookieOptions(ctx.req), httpOnly: true, secure: true, sameSite: "none" });
        return { success: true };
      }),

    requestPasswordReset: publicProcedure
      .input(forgotPasswordSchema)
      .mutation(async ({ input, ctx }) => {
        const user = await UserService.getUserByEmail(ctx.db, input.email);
        if (user?.passwordHash) {
          const token = await AuthService.createPasswordResetToken(ctx.db, user.id);
          await sendPasswordResetEmail(input.email, token);
        }
        return { success: true };
      }),

    resetPassword: publicProcedure
      .input(resetPasswordSchema)
      .mutation(async ({ input, ctx }) => {
        const row = await AuthService.consumePasswordResetToken(ctx.db, input.token);
        if (!row) throw new TRPCError({ code: "BAD_REQUEST", message: "Reset link is invalid or expired" });
        const passwordHash = await bcrypt.hash(input.password, 10);
        await UserService.setUserPasswordHash(ctx.db, row.userId, passwordHash);
        return { success: true };
      }),
  }),

  // ─── LEADS ─────────────────────────────────────────────────────────────────
  leads: router({
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
            const content = (result as any).choices?.[0]?.message?.content || "";
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
        return { success: res.success, errorCode: (res as any).errorCode, deduplicated: (res as any).deduplicated };
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
  }),

  // ─── AUTOMATIONS ───────────────────────────────────────────────────────────
  automations: router({
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
        }
        
        const automation = await AutomationService.getAutomationByKey(ctx.db, ctx.tenantId, input.key);
        if (!automation) throw new TRPCError({ code: "NOT_FOUND" });
        await AutomationService.updateAutomation(ctx.db, ctx.tenantId, automation.id, { enabled: input.enabled });
        return { success: true };
      }),

    configureByKey: tenantProcedure
      .input(z.object({ key: z.string(), config: z.record(z.string(), z.any()) }))
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
        const triggerMapping: Record<string, string> = {
          "lead.created": "new_lead",
          "appointment.booked": "appointment_reminder",
          "appointment.no_show": "time_delay",
          "appointment.cancelled": "appointment_reminder",
          "message.received": "inbound_message",
        };
        await AutomationService.upsertAutomationByKey(ctx.db, ctx.tenantId, template.key, {
          name: template.name,
          category: template.category as any,
          triggerType: triggerMapping[template.trigger] as any || "custom",
          triggerConfig: {},
          conditions: [],
          actions: template.steps as any,
          enabled: true,
        });
        return { success: true };
      }),

    test: tenantProcedure
      .input(z.object({ automationId: z.number(), testPhone: phoneSchema }))
      .mutation(async ({ ctx, input }) => {
        const auto = await AutomationService.getAutomationById(ctx.db, ctx.tenantId, input.automationId);
        if (!auto) throw new TRPCError({ code: "NOT_FOUND" });
        await runAutomationsForEvent({ type: auto.triggerType as any, tenantId: ctx.tenantId, data: { phone: input.testPhone, first_name: "Test User" }, timestamp: new Date() });
        return { success: true, message: "Test sequence fired" };
      }),
  }),

  // ─── AI ────────────────────────────────────────────────────────────────────
  ai: router({
    rewrite: protectedProcedure
      .input(z.object({ message: z.string().min(1), tone: z.enum(["friendly", "professional", "casual", "urgent", "empathetic"]) }))
      .mutation(async ({ input }) => {
        try {
          const result = await invokeLLM({ messages: [
            { role: "system", content: `Expert SMS copywriter. Rewrite in ${input.tone} tone. Under 160 chars. Return ONLY the message.` },
            { role: "user", content: input.message },
          ]});
          const content = (result as any).choices?.[0]?.message?.content || "";
          return { rewritten: content.trim() };
        } catch (err) {
          console.error("AI rewrite error:", err);
          if (isAppError(err)) {
            throw new TRPCError({ code: err.statusCode === 503 ? "SERVICE_UNAVAILABLE" : "INTERNAL_SERVER_ERROR", message: err.message });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI rewrite failed" });
        }
      }),
  }),

  // ─── TEMPLATES ─────────────────────────────────────────────────────────────
  templates: router({
    list: tenantProcedure.query(async ({ ctx }) => TemplateService.getTemplates(ctx.db, ctx.tenantId)),

    create: tenantProcedure
      .input(z.object({ key: z.string(), name: z.string(), body: z.string(), tone: z.enum(["friendly", "professional", "casual", "urgent"]).optional(), category: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        await TemplateService.createTemplate(ctx.db, { ...input, tenantId: ctx.tenantId });
        return { success: true };
      }),

    update: tenantProcedure
      .input(z.object({ templateId: z.number(), name: z.string().optional(), body: z.string().optional(), tone: z.enum(["friendly", "professional", "casual", "urgent"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        await TemplateService.updateTemplate(ctx.db, ctx.tenantId, input.templateId, input);
        return { success: true };
      }),

    delete: tenantProcedure
      .input(z.object({ templateId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await TemplateService.deleteTemplate(ctx.db, ctx.tenantId, input.templateId);
        return { success: true };
      }),

    preview: protectedProcedure
      .input(z.object({ body: z.string(), tone: z.enum(["friendly", "professional", "casual", "urgent"]) }))
      .mutation(async ({ input }) => {
        const { rewriteMessage } = await import("./services/ai");
        const rewritten = await rewriteMessage(input.body, input.tone);
        return { rewritten };
      }),
  }),

  // ─── API KEYS ──────────────────────────────────────────────────────────────
  apiKeys: router({
    list: tenantProcedure.query(async ({ ctx }) => AuthService.getApiKeys(ctx.db, ctx.tenantId)),

    create: tenantProcedure
      .input(z.object({ label: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const key = `rk_${randomUUID().replace(/-/g, "")}`;
        const keyHash = await bcrypt.hash(key, 10);
        await AuthService.createApiKey(ctx.db, ctx.tenantId, keyHash, key.slice(0, 7), input.label);
        return { key };
      }),

    revoke: tenantProcedure
      .input(z.object({ keyId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await AuthService.revokeApiKey(ctx.db, ctx.tenantId, input.keyId);
        return { success: true };
      }),
  }),

  // ─── WEBHOOKS ──────────────────────────────────────────────────────────────
  webhooks: router({
    receive: publicProcedure
      .input(z.object({
        event: z.enum(["lead.created", "appointment.booked", "appointment.no_show", "appointment.cancelled", "message.received", "message.sent"]),
        data: z.record(z.string(), z.any()),
        tenantId: z.number(),
        userId: z.number().optional(),
        signature: z.string().optional(),
        /** Client-supplied key; duplicate deliveries return deduplicated: true */
        idempotencyKey: z.string().min(8).max(64).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const isProd = process.env.NODE_ENV === "production";
        const secret = ENV.webhookSecret?.trim();
        const allowUnsigned = !isProd && process.env.WEBHOOK_ALLOW_UNSIGNED === "true";

        if (!secret) {
          if (!allowUnsigned) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: isProd
                ? "WEBHOOK_SECRET is required in production"
                : "Set WEBHOOK_SECRET or WEBHOOK_ALLOW_UNSIGNED=true (development only)",
            });
          }
        } else {
          const sig =
            input.signature ??
            (ctx.req.headers["x-webhook-signature"] as string | undefined) ??
            "";
          if (!sig || !verifyInboundWebhookSignature(secret, input.event, input.data, input.tenantId, sig)) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or missing webhook signature" });
          }
        }

        if (input.idempotencyKey) {
          if (!ctx.db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
          const first = await WebhookDedupService.tryClaimInboundWebhookDedup(ctx.db, input.tenantId, input.idempotencyKey);
          if (!first) return { success: true as const, deduplicated: true as const };
        }

        await emitEvent({ type: input.event, data: input.data, tenantId: input.tenantId, userId: input.userId, timestamp: new Date() });
        return { success: true as const };
      }),
  }),

  // ─── TENANT ────────────────────────────────────────────────────────────────
  tenant: router({
    get: tenantProcedure.query(async ({ ctx }) => {
      const tenant = await TenantService.getTenantById(ctx.db, ctx.tenantId);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      return tenant;
    }),

    update: tenantProcedure
      .input(z.object({ name: z.string().optional(), timezone: z.string().optional(), industry: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        await TenantService.updateTenant(ctx.db, ctx.tenantId, input);
        return { success: true };
      }),

    subscription: tenantProcedure.query(async ({ ctx }) => {
      const sub = await TenantService.getSubscriptionByTenantId(ctx.db, ctx.tenantId);
      if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
      return { sub };
    }),

    usage: tenantProcedure.query(async ({ ctx }) => {
      const usageData = await TenantService.getUsageByTenantId(ctx.db, ctx.tenantId);
      if (!usageData) throw new TRPCError({ code: "NOT_FOUND", message: "Usage data not found" });
      return usageData;
    }),

    phoneNumbers: tenantProcedure.query(async ({ ctx }) => TenantService.getPhoneNumbersByTenantId(ctx.db, ctx.tenantId)),

    addPhoneNumber: tenantProcedure
      .input(z.object({ number: phoneSchema, label: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        await TenantService.addPhoneNumber(ctx.db, ctx.tenantId, { number: input.number, title: input.label });
        return { success: true };
      }),

    removePhoneNumber: tenantProcedure
      .input(z.object({ phoneNumberId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await TenantService.removePhoneNumber(ctx.db, ctx.tenantId, input.phoneNumberId);
        return { success: true };
      }),

    setDefaultPhoneNumber: tenantProcedure
      .input(z.object({ phoneNumberId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await TenantService.setDefaultPhoneNumber(ctx.db, ctx.tenantId, input.phoneNumberId);
        return { success: true };
      }),

    setInboundPhoneNumber: tenantProcedure
      .input(z.object({ phoneNumberId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await TenantService.setInboundPhoneNumber(ctx.db, ctx.tenantId, input.phoneNumberId);
        return { success: true };
      }),
  }),

  // ─── ANALYTICS ─────────────────────────────────────────────────────────────
  analytics: router({
    dashboard: tenantProcedure.input(z.object({ days: z.number().int().min(1).max(90).default(30) }).optional()).query(async ({ ctx, input }) => {
      const [metrics, statusBreakdown, messageVolume, recentMessages, revenueMetrics, revenueTrends] = await Promise.all([
        AnalyticsService.getDashboardMetrics(ctx.db, ctx.tenantId),
        AnalyticsService.getLeadStatusBreakdown(ctx.db, ctx.tenantId),
        AnalyticsService.getMessageVolume(ctx.db, ctx.tenantId, input?.days ?? 30),
        LeadService.getRecentMessages(ctx.db, ctx.tenantId, 10),
        AnalyticsService.getRevenueRecoveryMetrics(ctx.db, ctx.tenantId),
        AnalyticsService.getRevenueTrends(ctx.db, ctx.tenantId, 90),
      ]);
      const leakage = await AnalyticsService.getLeakageMetrics(ctx.db, ctx.tenantId);
      return { metrics, statusBreakdown, messageVolume, recentMessages, leakage, revenueMetrics, revenueTrends };
    }),

    revenueLeakage: tenantProcedure.input(z.object({ days: z.number().int().min(1).max(365).default(90) })).query(async ({ ctx, input }) => {
      const LeakageService = await import("./services/revenue-leakage.service");
      const leakageReport = await LeakageService.detectRevenueLeakage(ctx.db, ctx.tenantId, input.days);
      return leakageReport;
    }),

    createRecoveryCampaign: tenantProcedure
      .input(z.object({
        leakageType: z.string(),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        messageTemplate: z.string().optional(),
        discountAmount: z.number().optional(),
        scheduleDelay: z.number().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const RecoveryService = await import("./services/revenue-recovery.service");
        const campaign = await RecoveryService.createRecoveryCampaign(
          ctx.db, 
          ctx.tenantId, 
          input.leakageType, 
          {
            priority: input.priority,
            messageTemplate: input.messageTemplate,
            discountAmount: input.discountAmount,
            scheduleDelay: input.scheduleDelay
          }
        );
        return campaign;
      }),

    executeRecoveryCampaign: tenantProcedure
      .input(z.object({ campaignId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const RecoveryService = await import("./services/revenue-recovery.service");
        const result = await RecoveryService.executeRecoveryCampaign(ctx.db, ctx.tenantId, input.campaignId);
        return result;
      }),

    analyzeRecoveryEffectiveness: tenantProcedure
      .input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
      .query(async ({ ctx, input }) => {
        const RecoveryService = await import("./services/revenue-recovery.service");
        const analysis = await RecoveryService.analyzeRecoveryEffectiveness(ctx.db, ctx.tenantId, input.days);
        return analysis;
      }),
  }),

  // ─── PLANS ─────────────────────────────────────────────────────────────────
  plans: router({
    list: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.db) return [];
      return TenantService.getAllPlans(ctx.db);
    }),
  }),

  // ─── BILLING ───────────────────────────────────────────────────────────────
  billing: router({
    createCheckoutSession: tenantProcedure
      .input(z.object({ priceId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2022-11-15" });
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [{ price: input.priceId, quantity: 1 }],
          success_url: `${process.env.APP_URL || "http://localhost:3000"}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.APP_URL || "http://localhost:3000"}/billing/cancel`,
          metadata: { tenantId: String(ctx.tenantId) },
          customer_email: ctx.user.email ?? undefined,
        });
        return { url: session.url, id: session.id };
      }),

    changePlan: tenantProcedure
      .input(z.object({ priceId: z.string(), prorateImmediately: z.boolean().default(true) }))
      .mutation(async ({ ctx, input }) => {
        // Check if this is an admin operation and audit it
        if (ctx.user.role === 'admin') {
          await auditAdminRead(ctx, "admin.billing.changePlan", { 
            targetTenantId: ctx.tenantId, 
            priceId: input.priceId, 
            prorateImmediately: input.prorateImmediately 
          });
        }
        
        const updated = await BillingService.changeSubscriptionPlan(ctx.db, {
          tenantId: ctx.tenantId,
          priceId: input.priceId,
          prorateImmediately: input.prorateImmediately,
        });
        return { success: true, status: updated.status };
      }),

    createCustomerPortal: tenantProcedure
      .input(z.object({ returnUrl: z.string().url().optional() }))
      .mutation(async ({ ctx, input }) => {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2022-11-15" });
        const rows = await ctx.db.select().from(subscriptions).where(eq(subscriptions.tenantId, ctx.tenantId)).limit(1);
        const subRow = rows[0];
        let customerId: string | undefined;
        if (subRow?.stripeId) {
          const stripeSub = await stripe.subscriptions.retrieve(subRow.stripeId).catch(() => null);
          customerId = (stripeSub as any)?.customer;
        }
        if (!customerId) throw new TRPCError({ code: "BAD_REQUEST", message: "No Stripe customer found" });
        const portal = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: input.returnUrl || `${process.env.APP_URL || "http://localhost:3000"}/billing`,
        });
        return { url: portal.url };
      }),

    invoices: tenantProcedure.query(async ({ ctx }) => {
      const [invoices, refunds] = await Promise.all([
        BillingService.listInvoicesByTenant(ctx.db, ctx.tenantId),
        BillingService.listRefundsByTenant(ctx.db, ctx.tenantId),
      ]);
      return { invoices, refunds };
    }),

    refundInvoice: tenantProcedure
      .input(z.object({
        stripeInvoiceId: z.string(),
        amount: z.number().int().positive().optional(),
        reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if this is an admin operation and audit it
        if (ctx.user.role === 'admin') {
          await auditAdminRead(ctx, "admin.billing.refundInvoice", { 
            targetTenantId: ctx.tenantId, 
            stripeInvoiceId: input.stripeInvoiceId, 
            amount: input.amount,
            reason: input.reason
          });
        }
        
        const refund = await BillingService.issueRefundForInvoiceCharge(ctx.db, {
          tenantId: ctx.tenantId,
          stripeInvoiceId: input.stripeInvoiceId,
          amount: input.amount,
          reason: input.reason,
        });
        return { success: true, refundId: refund.id };
      }),
  }),

  // ─── ONBOARDING ────────────────────────────────────────────────────────────
  onboarding: router({
    setup: tenantProcedure.input(z.any()).mutation(async () => ({ success: true })),
  }),

  // ─── ADMIN ─────────────────────────────────────────────────────────────────
  admin: router({
    tenants: router({
      list: adminProcedure.input(paginationSchema).query(async ({ ctx, input }) => {
        await auditAdminRead(ctx, "admin.tenants.list", { page: input?.page, limit: input?.limit });
        const { page, limit } = clampAdminPagination(input);
        const { rows, total } = await TenantService.getAllTenants(ctx.db, page, limit);
        return { tenants: rows, total };
      }),
    }),
    users: router({
      list: adminProcedure.input(paginationSchema).query(async ({ ctx, input }) => {
        await auditAdminRead(ctx, "admin.users.list", { page: input?.page, limit: input?.limit });
        const { page, limit } = clampAdminPagination(input);
        const { rows, total } = await UserService.getAllUsers(ctx.db, page, limit);
        return { users: rows, total };
      }),
      toggleActive: adminProcedure
        .input(z.object({ userId: z.number(), active: z.boolean() }))
        .mutation(async ({ ctx, input }) => {
          await UserService.updateUserActive(ctx.db, input.userId, input.active);
          return { success: true };
        }),
    }),
    systemHealth: router({
      errors: adminProcedure
        .input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
        .query(async ({ ctx, input }) => {
          await auditAdminRead(ctx, "admin.systemHealth.errors", { limit: input?.limit });
          const lim = Math.min(100, Math.max(1, input?.limit ?? 50));
          return SystemService.getSystemErrors(ctx.db, undefined, lim);
        }),
    }),
    webhookLogs: router({
      list: adminProcedure.input(paginationSchema).query(async ({ ctx, input }) => {
        await auditAdminRead(ctx, "admin.webhookLogs.list", { page: input?.page, limit: input?.limit });
        const { page, limit } = clampAdminPagination(input);
        return SystemService.getWebhookLogs(ctx.db, undefined, limit, page);
      }),
    }),
    aiLogs: router({
      list: adminProcedure.input(paginationSchema).query(async ({ ctx, input }) => {
        await auditAdminRead(ctx, "admin.aiLogs.list", { page: input?.page, limit: input?.limit });
        const { page, limit } = clampAdminPagination(input);
        return AiService.getAiLogs(ctx.db, undefined, limit, page);
      }),
    }),
    email: router({
      status: adminProcedure.query(async ({ ctx }) => {
        await auditAdminRead(ctx, "admin.email.status");
        return EmailService.getConfigurationStatus();
      }),
      
      test: adminProcedure.mutation(async ({ ctx }) => {
        await auditAdminRead(ctx, "admin.email.test");
        return EmailService.testEmailConfiguration();
      }),
      
      send: adminProcedure
        .input(z.object({
          to: z.string().email(),
          subject: z.string(),
          text: z.string(),
          html: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          await auditAdminRead(ctx, "admin.email.send", { to: input.to, subject: input.subject });
          return EmailService.sendEmail(input);
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
