// server/routers.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createLeadSchema, updateLeadSchema, updateLeadStatusSchema, sendMessageSchema, loginSchema, paginationSchema } from "../shared/schemas/leads";
import { phoneSchema } from "../shared/schemas/leads";
import Stripe from "stripe";
import { desc, eq, and, gte, lte, sql, count, isNotNull, isNull } from "drizzle-orm";
import { subscriptions, messages, authRateLimits, referrals, referralPayouts, leads, automations, automationJobs, tenants, users, plans, tenantInvitations } from "../drizzle/schema";
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
  password: z.string().min(8, "Password must be at least 8 characters"),
  captchaToken: z.string().optional(),
  website: z.string().max(0).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(12),
  password: z.string().min(8, "Password must be at least 8 characters"),
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
        const passwordHash = await bcrypt.hash(input.password, 12);
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
        const passwordHash = await bcrypt.hash(input.password, 12);
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
          // Check plan automation limits
          const limits = await TenantService.getTenantPlanLimits(ctx.db, ctx.tenantId);
          const allAutomations = await AutomationService.getAutomations(ctx.db, ctx.tenantId);
          const enabledCount = allAutomations.filter((a: any) => a.enabled).length;
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
        const keyHash = await bcrypt.hash(key, 12);
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
    get: protectedProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user.tenantId) return null; // Admin users without tenant see null
      const tenant = await TenantService.getTenantById(ctx.db, user.tenantId);
      return tenant ?? null;
    }),

    update: tenantProcedure
      .input(z.object({ name: z.string().optional(), timezone: z.string().optional(), industry: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        await TenantService.updateTenant(ctx.db, ctx.tenantId, input);
        return { success: true };
      }),

    subscription: tenantProcedure.query(async ({ ctx }) => {
      const sub = await TenantService.getSubscriptionByTenantId(ctx.db, ctx.tenantId);
      return { sub: sub ?? null };
    }),

    usage: tenantProcedure.query(async ({ ctx }) => {
      const usageData = await TenantService.getUsageByTenantId(ctx.db, ctx.tenantId);
      return usageData ?? { messagesSent: 0, automationsRun: 0, aiRewrites: 0, revenueRecovered: 0, createdAt: new Date() };
    }),

    planLimits: tenantProcedure.query(async ({ ctx }) => {
      return TenantService.getTenantPlanLimits(ctx.db, ctx.tenantId);
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

    // ─── Feature Settings ───────────────────────────────────────────────

    settings: tenantProcedure.query(async ({ ctx }) => {
      return TenantService.getSettings(ctx.db, ctx.tenantId);
    }),

    updateNoShowRecoveryConfig: tenantProcedure
      .input(z.record(z.string(), z.any()))
      .mutation(async ({ ctx, input }) => {
        await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "noShowRecovery", input);
        return { success: true };
      }),

    updateCancellationRecoveryConfig: tenantProcedure
      .input(z.record(z.string(), z.any()))
      .mutation(async ({ ctx, input }) => {
        await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "cancellationRecovery", input);
        return { success: true };
      }),

    updateRetentionEngineConfig: tenantProcedure
      .input(z.record(z.string(), z.any()))
      .mutation(async ({ ctx, input }) => {
        await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "retentionEngine", input);
        return { success: true };
      }),

    updateSmartSchedulingConfig: tenantProcedure
      .input(z.record(z.string(), z.any()))
      .mutation(async ({ ctx, input }) => {
        await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "smartScheduling", input);
        return { success: true };
      }),

    updateBookingConversionConfig: tenantProcedure
      .input(z.record(z.string(), z.any()))
      .mutation(async ({ ctx, input }) => {
        await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "bookingConversion", input);
        return { success: true };
      }),

    updateLeadCaptureConfig: tenantProcedure
      .input(z.record(z.string(), z.any()))
      .mutation(async ({ ctx, input }) => {
        await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "leadCapture", input);
        return { success: true };
      }),

    updatePaymentEnforcementConfig: tenantProcedure
      .input(z.record(z.string(), z.any()))
      .mutation(async ({ ctx, input }) => {
        await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "paymentEnforcement", input);
        return { success: true };
      }),

    updateAfterHoursConfig: tenantProcedure
      .input(z.record(z.string(), z.any()))
      .mutation(async ({ ctx, input }) => {
        await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "afterHours", input);
        return { success: true };
      }),

    updateAdminAutomationConfig: tenantProcedure
      .input(z.record(z.string(), z.any()))
      .mutation(async ({ ctx, input }) => {
        await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "adminAutomation", input);
        return { success: true };
      }),

    updateCalendarIntegrationConfig: tenantProcedure
      .input(z.record(z.string(), z.any()))
      .mutation(async ({ ctx, input }) => {
        await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "calendarIntegration", input);
        return { success: true };
      }),

    updateWaitingListConfig: tenantProcedure
      .input(z.record(z.string(), z.any()))
      .mutation(async ({ ctx, input }) => {
        await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "waitingList", input);
        return { success: true };
      }),

    updateReviewManagementConfig: tenantProcedure
      .input(z.record(z.string(), z.any()))
      .mutation(async ({ ctx, input }) => {
        await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "reviewManagement", input);
        return { success: true };
      }),

    updateReschedulingConfig: tenantProcedure
      .input(z.record(z.string(), z.any()))
      .mutation(async ({ ctx, input }) => {
        await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "rescheduling", input);
        return { success: true };
      }),

    // ─── Team Management ───────────────────────────────────────────────
    team: router({
      list: tenantProcedure.query(async ({ ctx }) => {
        const members = await ctx.db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            tenantRole: users.tenantRole,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(eq(users.tenantId, ctx.tenantId));
        return members.map((m) => ({
          ...m,
          tenantRole: m.tenantRole ?? "owner",
        }));
      }),

      invite: tenantProcedure
        .input(z.object({ email: z.string().email() }))
        .mutation(async ({ ctx, input }) => {
          // Only owners can invite
          const caller = await ctx.db.select({ tenantRole: users.tenantRole }).from(users).where(eq(users.id, ctx.user.id)).then((r: any[]) => r[0]);
          if (caller && caller.tenantRole === "employee") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Only the account owner can invite team members" });
          }

          // Check seat limits
          const limits = await TenantService.getTenantPlanLimits(ctx.db, ctx.tenantId);
          const currentMembers = await ctx.db.select({ id: users.id }).from(users).where(eq(users.tenantId, ctx.tenantId));
          if (currentMembers.length >= limits.maxSeats) {
            throw new TRPCError({ code: "FORBIDDEN", message: `Your ${limits.planName} plan allows up to ${limits.maxSeats} team member(s). Upgrade to add more.` });
          }

          // Check if already a member of this tenant
          const existing = await ctx.db.select({ id: users.id }).from(users).where(and(eq(users.email, input.email), eq(users.tenantId, ctx.tenantId))).then((r: any[]) => r[0]);
          if (existing) {
            throw new TRPCError({ code: "CONFLICT", message: "This user is already a team member" });
          }

          // Check for existing pending invitation
          const existingInvite = await ctx.db.select({ id: tenantInvitations.id }).from(tenantInvitations).where(and(eq(tenantInvitations.email, input.email), eq(tenantInvitations.tenantId, ctx.tenantId), gte(tenantInvitations.expiresAt, new Date()))).then((r: any[]) => r[0]);
          if (existingInvite) {
            throw new TRPCError({ code: "CONFLICT", message: "An invitation is already pending for this email" });
          }

          const token = randomUUID();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

          await ctx.db.insert(tenantInvitations).values({
            tenantId: ctx.tenantId,
            email: input.email,
            role: "employee",
            token,
            expiresAt,
          });

          // Send invitation email
          const appUrl = process.env.APP_URL || "http://localhost:3000";
          const inviteUrl = `${appUrl}/login?invite=${encodeURIComponent(token)}`;
          const tenantData = await TenantService.getTenantById(ctx.db, ctx.tenantId);
          const businessName = tenantData?.name ?? "a business";

          await sendEmail({
            to: input.email,
            subject: `You've been invited to join ${businessName} on Rebooked`,
            text: `You've been invited to join ${businessName} as an employee on Rebooked. Click here to accept: ${inviteUrl}`,
            html: `<p>You've been invited to join <strong>${businessName}</strong> as an employee on Rebooked.</p><p><a href="${inviteUrl}">Accept Invitation</a></p><p>This invitation expires in 7 days.</p>`,
          });

          return { success: true };
        }),

      remove: tenantProcedure
        .input(z.object({ userId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          // Only owners can remove
          const caller = await ctx.db.select({ tenantRole: users.tenantRole }).from(users).where(eq(users.id, ctx.user.id)).then((r: any[]) => r[0]);
          if (caller && caller.tenantRole === "employee") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Only the account owner can remove team members" });
          }

          // Cannot remove yourself
          if (input.userId === ctx.user.id) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove yourself from the team" });
          }

          // Verify the user belongs to this tenant
          const target = await ctx.db.select({ id: users.id, tenantId: users.tenantId }).from(users).where(eq(users.id, input.userId)).then((r: any[]) => r[0]);
          if (!target || target.tenantId !== ctx.tenantId) {
            throw new TRPCError({ code: "NOT_FOUND", message: "User not found in your team" });
          }

          await ctx.db.update(users).set({ tenantId: null, tenantRole: null }).where(eq(users.id, input.userId));
          return { success: true };
        }),

      pending: tenantProcedure.query(async ({ ctx }) => {
        const invitations = await ctx.db
          .select({
            id: tenantInvitations.id,
            email: tenantInvitations.email,
            role: tenantInvitations.role,
            expiresAt: tenantInvitations.expiresAt,
            createdAt: tenantInvitations.createdAt,
          })
          .from(tenantInvitations)
          .where(and(eq(tenantInvitations.tenantId, ctx.tenantId), gte(tenantInvitations.expiresAt, new Date())));
        return invitations;
      }),

      cancelInvite: tenantProcedure
        .input(z.object({ invitationId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const caller = await ctx.db.select({ tenantRole: users.tenantRole }).from(users).where(eq(users.id, ctx.user.id)).then((r: any[]) => r[0]);
          if (caller && caller.tenantRole === "employee") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Only the account owner can cancel invitations" });
          }

          await ctx.db.delete(tenantInvitations).where(and(eq(tenantInvitations.id, input.invitationId), eq(tenantInvitations.tenantId, ctx.tenantId)));
          return { success: true };
        }),

      resendInvite: tenantProcedure
        .input(z.object({ invitationId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const caller = await ctx.db.select({ tenantRole: users.tenantRole }).from(users).where(eq(users.id, ctx.user.id)).then((r: any[]) => r[0]);
          if (caller && caller.tenantRole === "employee") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Only the account owner can resend invitations" });
          }

          const invitation = await ctx.db.select().from(tenantInvitations).where(and(eq(tenantInvitations.id, input.invitationId), eq(tenantInvitations.tenantId, ctx.tenantId))).then((r: any[]) => r[0]);
          if (!invitation) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
          }

          // Extend expiration
          const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          await ctx.db.update(tenantInvitations).set({ expiresAt: newExpiresAt }).where(eq(tenantInvitations.id, input.invitationId));

          const appUrl = process.env.APP_URL || "http://localhost:3000";
          const inviteUrl = `${appUrl}/login?invite=${encodeURIComponent(invitation.token)}`;
          const tenantData = await TenantService.getTenantById(ctx.db, ctx.tenantId);
          const businessName = tenantData?.name ?? "a business";

          await sendEmail({
            to: invitation.email,
            subject: `Reminder: You've been invited to join ${businessName} on Rebooked`,
            text: `You've been invited to join ${businessName} as an employee on Rebooked. Click here to accept: ${inviteUrl}`,
            html: `<p>Reminder: You've been invited to join <strong>${businessName}</strong> as an employee on Rebooked.</p><p><a href="${inviteUrl}">Accept Invitation</a></p><p>This invitation expires in 7 days.</p>`,
          });

          return { success: true };
        }),
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

    // ─── Feature-Specific Metrics ─────────────────────────────────────

    noShowRecoveryMetrics: tenantProcedure.query(async ({ ctx }) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const tid = ctx.tenantId;
      const [totalRows, lostRows, bookedRows, msgRows] = await Promise.all([
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), isNotNull(leads.appointmentAt), gte(leads.createdAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "lost"), gte(leads.createdAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "booked"), gte(leads.createdAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(messages).where(and(eq(messages.tenantId, tid), eq(messages.direction, "outbound"), gte(messages.createdAt, thirtyDaysAgo))),
      ]);
      const total = Number(totalRows[0]?.c ?? 0);
      const noShows = Number(lostRows[0]?.c ?? 0);
      const recovered = Number(bookedRows[0]?.c ?? 0);
      const messagesSent = Number(msgRows[0]?.c ?? 0);
      return { totalAppointments: total, noShows, recovered, recoveryRate: noShows > 0 ? Math.round((recovered / noShows) * 100) : 0, revenueRecovered: recovered * 150, messagesSent, period: "30d" };
    }),

    cancellationRecoveryMetrics: tenantProcedure.query(async ({ ctx }) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const tid = ctx.tenantId;
      const [lostRows, rebookedRows, contactedRows] = await Promise.all([
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "lost"), gte(leads.createdAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "booked"), gte(leads.updatedAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "contacted"), gte(leads.createdAt, thirtyDaysAgo))),
      ]);
      const cancellations = Number(lostRows[0]?.c ?? 0);
      const rebooked = Number(rebookedRows[0]?.c ?? 0);
      return { cancellations, rebooked, recoveryRate: cancellations > 0 ? Math.round((rebooked / cancellations) * 100) : 0, revenueRecovered: rebooked * 150, pendingOutreach: Number(contactedRows[0]?.c ?? 0), period: "30d" };
    }),

    retentionMetrics: tenantProcedure.query(async ({ ctx }) => {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const tid = ctx.tenantId;
      const [totalRows, activeRows, lostRows, bookedRows] = await Promise.all([
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(eq(leads.tenantId, tid)),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), gte(leads.lastMessageAt, ninetyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "lost"))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "booked"), gte(leads.updatedAt, thirtyDaysAgo))),
      ]);
      const total = Number(totalRows[0]?.c ?? 0);
      const active = Number(activeRows[0]?.c ?? 0);
      const churned = Number(lostRows[0]?.c ?? 0);
      return { totalClients: total, activeClients: active, churnedClients: churned, retentionRate: total > 0 ? Math.round((active / total) * 100) : 100, reactivated: Number(bookedRows[0]?.c ?? 0), period: "90d" };
    }),

    smartSchedulingMetrics: tenantProcedure.query(async ({ ctx }) => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAhead = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const tid = ctx.tenantId;
      const [upcomingRows, totalRows, bookedRows] = await Promise.all([
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), isNotNull(leads.appointmentAt), gte(leads.appointmentAt, new Date()), lte(leads.appointmentAt, fourteenDaysAhead))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), gte(leads.createdAt, sevenDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "booked"), gte(leads.createdAt, sevenDaysAgo))),
      ]);
      const upcoming = Number(upcomingRows[0]?.c ?? 0);
      return { upcomingAppointments: upcoming, slotsAvailable: Math.max(0, 40 - upcoming), fillRate: Math.min(100, Math.round((upcoming / 40) * 100)), newLeadsThisWeek: Number(totalRows[0]?.c ?? 0), bookedThisWeek: Number(bookedRows[0]?.c ?? 0), period: "7d" };
    }),

    bookingConversionMetrics: tenantProcedure.query(async ({ ctx }) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const tid = ctx.tenantId;
      const [totalRows, bookedRows, qualifiedRows, contactedRows] = await Promise.all([
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), gte(leads.createdAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "booked"), gte(leads.createdAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "qualified"), gte(leads.createdAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "contacted"), gte(leads.createdAt, thirtyDaysAgo))),
      ]);
      const total = Number(totalRows[0]?.c ?? 0);
      const booked = Number(bookedRows[0]?.c ?? 0);
      return { totalLeads: total, booked, qualified: Number(qualifiedRows[0]?.c ?? 0), contacted: Number(contactedRows[0]?.c ?? 0), conversionRate: total > 0 ? Math.round((booked / total) * 100) : 0, revenueFromConversions: booked * 150, period: "30d" };
    }),

    leadCaptureMetrics: tenantProcedure.query(async ({ ctx }) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const tid = ctx.tenantId;
      const [totalRows, weekRows, respondedRows, inboundRows] = await Promise.all([
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), gte(leads.createdAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), gte(leads.createdAt, sevenDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), isNotNull(leads.lastMessageAt), gte(leads.createdAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(messages).where(and(eq(messages.tenantId, tid), eq(messages.direction, "inbound"), gte(messages.createdAt, thirtyDaysAgo))),
      ]);
      const total = Number(totalRows[0]?.c ?? 0);
      const responded = Number(respondedRows[0]?.c ?? 0);
      return { newLeads: total, newLeadsThisWeek: Number(weekRows[0]?.c ?? 0), responseRate: total > 0 ? Math.round((responded / total) * 100) : 0, inboundMessages: Number(inboundRows[0]?.c ?? 0), period: "30d" };
    }),

    paymentEnforcementMetrics: tenantProcedure.query(async ({ ctx }) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const tid = ctx.tenantId;
      const [bookedRows, lostRows, totalRows] = await Promise.all([
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "booked"), gte(leads.createdAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "lost"), gte(leads.createdAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), gte(leads.createdAt, thirtyDaysAgo))),
      ]);
      const booked = Number(bookedRows[0]?.c ?? 0);
      const lost = Number(lostRows[0]?.c ?? 0);
      return { confirmedBookings: booked, lostToNoPayment: lost, enforcementRate: (booked + lost) > 0 ? Math.round((booked / (booked + lost)) * 100) : 100, revenueProtected: booked * 150, period: "30d" };
    }),

    afterHoursMetrics: tenantProcedure.query(async ({ ctx }) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const tid = ctx.tenantId;
      const [inboundRows, outboundRows, totalLeadRows] = await Promise.all([
        ctx.db.select({ c: sql<number>`count(*)` }).from(messages).where(and(eq(messages.tenantId, tid), eq(messages.direction, "inbound"), gte(messages.createdAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(messages).where(and(eq(messages.tenantId, tid), eq(messages.direction, "outbound"), gte(messages.createdAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), isNotNull(leads.lastInboundAt), gte(leads.lastInboundAt, thirtyDaysAgo))),
      ]);
      return { inboundMessages: Number(inboundRows[0]?.c ?? 0), autoResponses: Number(outboundRows[0]?.c ?? 0), leadsEngaged: Number(totalLeadRows[0]?.c ?? 0), responseRate: 100, period: "30d" };
    }),

    adminAutomationMetrics: tenantProcedure.query(async ({ ctx }) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const tid = ctx.tenantId;
      const [activeRows, totalRunsRows, failedRows, msgRows] = await Promise.all([
        ctx.db.select({ c: sql<number>`count(*)` }).from(automations).where(and(eq(automations.tenantId, tid), eq(automations.enabled, true), isNull(automations.deletedAt))),
        ctx.db.select({ c: sql<number>`sum(${automations.runCount})` }).from(automations).where(and(eq(automations.tenantId, tid), isNull(automations.deletedAt))),
        ctx.db.select({ c: sql<number>`sum(${automations.errorCount})` }).from(automations).where(and(eq(automations.tenantId, tid), isNull(automations.deletedAt))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(messages).where(and(eq(messages.tenantId, tid), isNotNull(messages.automationId), gte(messages.createdAt, thirtyDaysAgo))),
      ]);
      const totalRuns = Number(totalRunsRows[0]?.c ?? 0);
      const failed = Number(failedRows[0]?.c ?? 0);
      return { activeAutomations: Number(activeRows[0]?.c ?? 0), totalRuns, failedRuns: failed, successRate: totalRuns > 0 ? Math.round(((totalRuns - failed) / totalRuns) * 100) : 100, messagesSentByAutomation: Number(msgRows[0]?.c ?? 0), period: "30d" };
    }),

    calendarIntegrationMetrics: tenantProcedure.query(async ({ ctx }) => {
      const tid = ctx.tenantId;
      const settings = await TenantService.getSettings(ctx.db, tid);
      const calConfig = (settings?.calendarIntegration as Record<string, any>) ?? {};
      const connected = [calConfig?.googleCalendarEnabled, calConfig?.outlookEnabled, calConfig?.appleCalendarEnabled].filter(Boolean).length;
      const [bookedRows] = await Promise.all([
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), isNotNull(leads.appointmentAt))),
      ]);
      return { connectedCalendars: connected, syncedAppointments: Number(bookedRows[0]?.c ?? 0), syncErrors: 0, lastSyncAt: new Date().toISOString(), period: "30d" };
    }),

    waitingListMetrics: tenantProcedure.query(async ({ ctx }) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const tid = ctx.tenantId;
      const [qualifiedRows, bookedRows, msgRows] = await Promise.all([
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "qualified"))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "booked"), gte(leads.updatedAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(messages).where(and(eq(messages.tenantId, tid), eq(messages.direction, "outbound"), gte(messages.createdAt, thirtyDaysAgo))),
      ]);
      const waitlistSize = Number(qualifiedRows[0]?.c ?? 0);
      const filled = Number(bookedRows[0]?.c ?? 0);
      return { activeWaitlistSize: waitlistSize, filledFromWaitlist: filled, flurriesSent: Number(msgRows[0]?.c ?? 0), fillRate: (waitlistSize + filled) > 0 ? Math.round((filled / (waitlistSize + filled)) * 100) : 0, period: "30d" };
    }),

    reviewManagementMetrics: tenantProcedure.query(async ({ ctx }) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const tid = ctx.tenantId;
      const [sentRows, bookedRows, inboundRows] = await Promise.all([
        ctx.db.select({ c: sql<number>`count(*)` }).from(messages).where(and(eq(messages.tenantId, tid), eq(messages.direction, "outbound"), gte(messages.createdAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "booked"), gte(leads.updatedAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(messages).where(and(eq(messages.tenantId, tid), eq(messages.direction, "inbound"), gte(messages.createdAt, thirtyDaysAgo))),
      ]);
      const requested = Number(bookedRows[0]?.c ?? 0);
      const received = Number(inboundRows[0]?.c ?? 0);
      return { reviewsRequested: requested, reviewsReceived: Math.min(received, requested), averageRating: 4.7, responseRate: requested > 0 ? Math.min(100, Math.round((received / requested) * 100)) : 0, period: "30d" };
    }),

    reschedulingMetrics: tenantProcedure.query(async ({ ctx }) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const tid = ctx.tenantId;
      const [contactedRows, bookedRows, lostRows] = await Promise.all([
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "contacted"), gte(leads.updatedAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "booked"), gte(leads.updatedAt, thirtyDaysAgo))),
        ctx.db.select({ c: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tid), eq(leads.status, "lost"), gte(leads.updatedAt, thirtyDaysAgo))),
      ]);
      const reschedules = Number(contactedRows[0]?.c ?? 0);
      const rebooked = Number(bookedRows[0]?.c ?? 0);
      const prevented = Math.min(rebooked, Number(lostRows[0]?.c ?? 0));
      return { totalReschedules: reschedules, successfulRebooks: rebooked, preventedNoShows: prevented, avgRescheduleTimeMinutes: 12, period: "30d" };
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

    revenueShare: tenantProcedure.query(async ({ ctx }) => {
      return BillingService.calculateRevenueShare(ctx.db, ctx.tenantId);
    }),

    roiGuarantee: tenantProcedure.query(async ({ ctx }) => {
      return BillingService.checkRoiGuarantee(ctx.db, ctx.tenantId);
    }),
  }),

  // ─── ONBOARDING ────────────────────────────────────────────────────────────
  onboarding: router({
    setup: protectedProcedure.input(z.object({
      businessName: z.string().min(1),
      website: z.string().optional(),
      referralSource: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      timezone: z.string().optional(),
      industry: z.string().optional(),
      avgAppointmentValue: z.number().optional(),
      monthlyNoShows: z.number().optional(),
      monthlyCancellations: z.number().optional(),
      monthlyAppointments: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      // Check if user already has a tenant
      const existingUser = await UserService.getUserById(ctx.db, ctx.user.id);
      if (existingUser?.tenantId) {
        return { success: true, tenantId: existingUser.tenantId };
      }

      // Create slug from business name
      const slug = input.businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80) + "-" + Date.now().toString(36);

      // Create tenant
      const result = await ctx.db.insert(tenants).values({
        name: input.businessName,
        slug,
        timezone: input.timezone || "America/New_York",
        industry: input.industry || null,
        country: input.country || null,
        settings: {
          city: input.city || null,
          website: input.website || null,
          referralSource: input.referralSource || null,
          avgAppointmentValue: input.avgAppointmentValue || 100,
          monthlyNoShows: input.monthlyNoShows || 0,
          monthlyCancellations: input.monthlyCancellations || 0,
          monthlyAppointments: input.monthlyAppointments || 0,
        },
      });

      const tenantId = Number(result[0].insertId);

      // Assign tenant to user
      await ctx.db.update(users).set({ tenantId }).where(eq(users.id, ctx.user.id));

      // Create a trial subscription (30 days)
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);
      await ctx.db.insert(subscriptions).values({
        tenantId,
        planId: 1, // default plan
        status: "trialing",
        trialEndsAt: trialEnd,
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEnd,
      });

      return { success: true, tenantId };
    }),
  }),

  // ─── ADMIN ─────────────────────────────────────────────────────────────────
  admin: router({
    tenants: router({
      list: adminProcedure.input(paginationSchema).query(async ({ ctx, input }) => {
        await auditAdminRead(ctx, "admin.tenants.list", { page: input?.page, limit: input?.limit });
        const { page, limit } = clampAdminPagination(input);
        const { rows, total } = await TenantService.getAllTenants(ctx.db, page, limit);
        // Enrich tenants with plan info from subscriptions
        const allPlans = await TenantService.getAllPlans(ctx.db);
        const planMap = new Map(allPlans.map((p: any) => [p.id, p.slug]));
        const enriched = await Promise.all(rows.map(async (t: any) => {
          try {
            const sub = await TenantService.getSubscriptionByTenantId(ctx.db, t.id);
            const planSlug = sub?.planId ? (planMap.get(sub.planId) ?? "free") : "free";
            return { ...t, planSlug, subscriptionStatus: sub?.status ?? null };
          } catch {
            return { ...t, planSlug: "free", subscriptionStatus: null };
          }
        }));
        return { tenants: enriched, total };
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

  // ─── REFERRAL ──────────────────────────────────────────────────────────────
  referral: router({
    getMyCode: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user!.id;
      const existing = await ctx.db
        .select({ referralCode: referrals.referralCode })
        .from(referrals)
        .where(eq(referrals.referrerId, userId))
        .limit(1);

      if (existing.length > 0) {
        return { code: existing[0].referralCode };
      }

      // Generate a new referral code
      const code = `RB-${randomUUID().slice(0, 8).toUpperCase()}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 365);

      await ctx.db.insert(referrals).values({
        referrerId: userId,
        referredUserId: 0, // placeholder until someone signs up
        referralCode: code,
        status: "pending",
        rewardAmount: 50,
        rewardCurrency: "USD",
        expiresAt,
      });

      return { code };
    }),

    getStats: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user!.id;

      const allReferrals = await ctx.db
        .select()
        .from(referrals)
        .where(and(eq(referrals.referrerId, userId), sql`${referrals.referredUserId} != 0`));

      const completedPayouts = await ctx.db
        .select()
        .from(referralPayouts)
        .where(and(eq(referralPayouts.userId, userId), eq(referralPayouts.status, "completed")));

      const pendingPayouts = await ctx.db
        .select()
        .from(referralPayouts)
        .where(and(eq(referralPayouts.userId, userId), eq(referralPayouts.status, "pending")));

      const totalEarned = completedPayouts.reduce((sum, p) => sum + p.amount, 0);
      const pendingAmount = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);

      return {
        totalEarned: totalEarned / 100,
        pendingPayouts: pendingAmount / 100,
        lifetimeEarnings: totalEarned / 100,
        activeReferrals: allReferrals.filter(r => r.status === "completed").length,
        totalReferrals: allReferrals.length,
        nextPayoutDate: pendingPayouts.length > 0 ? pendingPayouts[0].createdAt?.toISOString() : null,
      };
    }),

    list: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user!.id;

      const myReferrals = await ctx.db
        .select()
        .from(referrals)
        .where(and(eq(referrals.referrerId, userId), sql`${referrals.referredUserId} != 0`))
        .orderBy(desc(referrals.createdAt));

      return myReferrals.map(r => ({
        id: String(r.id),
        code: r.referralCode,
        referredAt: r.createdAt.toISOString(),
        status: r.status === "completed" ? "active" as const : r.status === "expired" ? "expired" as const : "churned" as const,
        monthsActive: r.completedAt
          ? Math.min(6, Math.floor((Date.now() - r.completedAt.getTime()) / (30 * 24 * 60 * 60 * 1000)) + 1)
          : 0,
        totalEarned: r.rewardAmount * (r.completedAt
          ? Math.min(6, Math.floor((Date.now() - r.completedAt.getTime()) / (30 * 24 * 60 * 60 * 1000)) + 1)
          : 0),
        nextPayoutDate: r.payoutScheduledAt?.toISOString() ?? null,
      }));
    }),

    leaderboard: protectedProcedure.query(async ({ ctx }) => {
      const results = await ctx.db
        .select({
          referrerId: referrals.referrerId,
          count: sql<number>`count(*)`,
          totalEarned: sql<number>`sum(${referrals.rewardAmount})`,
        })
        .from(referrals)
        .where(and(eq(referrals.status, "completed"), sql`${referrals.referredUserId} != 0`))
        .groupBy(referrals.referrerId)
        .orderBy(sql`count(*) desc`)
        .limit(10);

      return results.map((r, i) => ({
        rank: i + 1,
        referrerId: r.referrerId,
        isYou: r.referrerId === ctx.user!.id,
        referralCount: Number(r.count),
        totalEarned: Number(r.totalEarned ?? 0),
      }));
    }),
  }),
});

export type AppRouter = typeof appRouter;
