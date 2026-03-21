// ONBOARDING
import { tenants, users } from "../drizzle/schema";
const onboarding = router({
  setup: protectedProcedure
    .input(z.object({ businessName: z.string().min(1), industry: z.string().min(1), timezone: z.string().optional(), city: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Create tenant
      const slugBase = input.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      let slug = slugBase;
      // Ensure slug is unique
      let suffix = 1;
      while (true) {
        const existing = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
        if (!existing || existing.length === 0) break;
        slug = `${slugBase}-${suffix++}`;
      }

      const result = await db.insert(tenants).values({
        name: input.businessName,
        slug,
        industry: input.industry,
        timezone: input.timezone || "America/New_York",
      });
      // Get the inserted tenantId (MySQL: result.insertId)
      const tenantId = result.insertId || (Array.isArray(result) && result[0]?.insertId);
      await db.update(users).set({ tenantId }).where(users.id.eq(ctx.user.id));
      return { success: true, tenantId };
    }),
});
// server/routers.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { desc, eq, and } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { sendSMS, resolveTemplate } from "./_core/sms";
import { sendEmail } from "./_core/email";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import {
  getDb,
  getAllPlans,
  getUserById,
  getTenantById,
  getLeadsByTenantId,
  getLeadById,
  getMessagesByLeadId,
  createLead,
  getAutomationsByTenantId,
  getPhoneNumbersByTenantId,
  addPhoneNumber,
  removePhoneNumber,
  setDefaultPhoneNumber,
  setInboundPhoneNumber,
  getAutomationByKey,
  createAutomation,
  updateAutomation,
  upsertAutomationByKey,
  getTemplatesByTenantId,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getDashboardMetrics,
  getLeadStatusBreakdown,
  getMessageVolume,
  getAllTenants,
  getAllUsers,
  getSystemErrors,
  getSubscriptionByTenantId,
  getUsageByTenantId,
  updateTenant,
  getApiKeysByTenantId,
  createApiKey,
  revokeApiKey,
} from "./db";
import { emitEvent } from "./services/eventBus";
import { runAutomationsForEvent } from "./services/automationRunner";
import { automationTemplates } from "../shared/templates";

import {
  users,
  tenants,
  leads,
  messages,
  automations,
  templates,
  usage,
  subscriptions,
  phoneNumbers,
} from "../drizzle/schema";

async function getTenantId(userId: number) {
  const user = await getUserById(userId);
  if (user?.tenantId) return user.tenantId;

  throw new TRPCError({ code: "FORBIDDEN", message: "No tenant found" });
}

export const appRouter = router({
  onboarding,
  // AUTH
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
      .input(z.object({ email: z.string().email(), password: z.string().min(8) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
        const passwordHash = await bcrypt.hash(input.password, 10);
        const openId = randomUUID();
        await db.insert(users).values({
          openId,
          email: input.email,
          passwordHash,
          loginMethod: "password",
          role: "user",
          active: true,
        });
        // Set session cookie
        ctx.res.cookie(COOKIE_NAME, openId, {
          ...getSessionCookieOptions(ctx.req),
          httpOnly: true,
          secure: true,
          sameSite: "none",
        });
        if (input.email) {
          await sendEmail({
            to: input.email,
            subject: "Welcome to Rebookd",
            text: "Thanks for signing up! Your account is all set. Log in to configure Twilio and start automations.",
          }).catch((err) => console.error("Welcome email failed", err));
        }
        return { success: true };
      }),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(8) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        if (!user.passwordHash) throw new TRPCError({ code: "UNAUTHORIZED", message: "No password set for this user" });
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid password" });
        // Set session cookie
        ctx.res.cookie(COOKIE_NAME, user.openId, {
          ...getSessionCookieOptions(ctx.req),
          httpOnly: true,
          secure: true,
          sameSite: "none",
        });
        return { success: true };
      }),
  }),

  // LEADS
  leads: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        phone: z.string().min(10),
        email: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await createLead({
          tenantId,
          name: input.name,
          phone: input.phone,
          email: input.email ?? undefined,
        });

        await emitEvent({
          type: "lead.created",
          tenantId,
          data: { name: input.name, phone: input.phone },
          userId: ctx.user.id,
          timestamp: new Date(),
        });

        return { ok: true };
      }),

    sendMessage: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        body: z.string().min(1),
        tone: z.enum(["friendly", "professional", "casual", "urgent", "empathetic"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const db = await getDb();

        let finalBody = input.body;
        if (input.tone) {
          try {
            const rewritten = await invokeLLM({
              messages: [
                { role: "system", content: `Rewrite in ${input.tone} tone. Under 160 chars. Return only text.` },
                { role: "user", content: input.body },
              ],
            });
            const content = rewritten.choices?.[0]?.message?.content || rewritten.text || "";
            finalBody = content.trim() || finalBody;
          } catch (err) {
            console.error("AI rewrite failed:", err);
          }
        }

        const lead = await db.query.leads.findFirst({ where: eq(leads.id, input.leadId) });
        if (!lead || lead.tenantId !== tenantId) throw new TRPCError({ code: "NOT_FOUND" });

        const res = await sendSMS(lead.phone, finalBody, undefined, tenantId);

        await db.insert(messages).values({
          tenantId,
          leadId: input.leadId,
          direction: "outbound",
          body: finalBody,
          status: res.success ? "sent" : "failed",
          twilioSid: res.sid,
        });

        await emitEvent({
          type: "message.sent",
          tenantId,
          data: { leadId: input.leadId, body: finalBody },
          userId: ctx.user.id,
          timestamp: new Date(),
        });

        return { success: res.success };
      }),

    markNoShow: protectedProcedure
      .input(z.object({ leadId: z.number(), appointmentTime: z.date().optional() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const db = await getDb();
        const lead = await getLeadById(tenantId, input.leadId);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND" });

        await db.update(leads).set({ status: "lost", updatedAt: new Date() }).where(eq(leads.id, input.leadId));

        await emitEvent({
          type: "appointment.no_show",
          tenantId,
          data: {
            leadId: input.leadId,
            appointmentTime: input.appointmentTime ?? lead.appointmentAt,
            phone: lead.phone,
            name: lead.name,
          },
          userId: ctx.user.id,
          timestamp: new Date(),
        });

        return { success: true };
      }),

    markBooked: protectedProcedure
      .input(z.object({ leadId: z.number(), appointmentTime: z.date() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const db = await getDb();
        const lead = await getLeadById(tenantId, input.leadId);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND" });

        await db.update(leads).set({ status: "booked", appointmentAt: input.appointmentTime, updatedAt: new Date() }).where(eq(leads.id, input.leadId));

        await emitEvent({
          type: "appointment.booked",
          tenantId,
          data: { leadId: input.leadId, appointmentTime: input.appointmentTime, phone: lead.phone, name: lead.name },
          userId: ctx.user.id,
          timestamp: new Date(),
        });

        return { success: true };
      }),

    markCancelled: protectedProcedure
      .input(z.object({ leadId: z.number(), appointmentTime: z.date().optional() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const db = await getDb();
        const lead = await getLeadById(tenantId, input.leadId);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND" });

        await db.update(leads).set({ status: "contacted", updatedAt: new Date() }).where(eq(leads.id, input.leadId));

        await emitEvent({
          type: "appointment.cancelled",
          tenantId,
          data: { leadId: input.leadId, appointmentTime: input.appointmentTime ?? lead.appointmentAt, phone: lead.phone, name: lead.name },
          userId: ctx.user.id,
          timestamp: new Date(),
        });

        return { success: true };
      }),

    list: protectedProcedure
      .input(z.object({ page: z.number().min(1).optional().default(1), limit: z.number().min(1).optional().default(20) }).optional())
      .query(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const page = input?.page ?? 1;
        const limit = input?.limit ?? 20;
        return getLeadsByTenantId(tenantId, { page, limit });
      }),

    messages: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        return getMessagesByLeadId(tenantId, input.leadId);
      }),
  }),

  // AUTOMATIONS
  automations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = await getTenantId(ctx.user.id);
      return getAutomationsByTenantId(tenantId);
    }),

    catalog: protectedProcedure.query(async () => {
      return automationTemplates;
    }),

    toggleByKey: protectedProcedure
      .input(z.object({ key: z.string(), enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const automation = await getAutomationByKey(tenantId, input.key);
        if (!automation) throw new TRPCError({ code: "NOT_FOUND" });
        await updateAutomation(tenantId, automation.id, { enabled: input.enabled });
        return { success: true };
      }),

    configureByKey: protectedProcedure
      .input(z.object({ key: z.string(), config: z.record(z.any()) }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const automation = await getAutomationByKey(tenantId, input.key);
        if (!automation) throw new TRPCError({ code: "NOT_FOUND" });

        await upsertAutomationByKey(tenantId, input.key, {
          name: automation.name,
          category: automation.category,
          triggerType: automation.triggerType,
          triggerConfig: input.config,
          actions: [{ type: "send_message", body: String(input.config.message || automation.triggerConfig?.message || ""), tone: "friendly" }],
          enabled: automation.enabled,
        });

        return { success: true };
      }),

    activateTemplate: protectedProcedure
      .input(z.object({ templateKey: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const template = automationTemplates.find((t) => t.key === input.templateKey);
        if (!template) throw new TRPCError({ code: "NOT_FOUND" });

        const triggerMapping: Record<string, string> = {
          "lead.created": "new_lead",
          "appointment.booked": "appointment_reminder",
          "appointment.no_show": "time_delay",
          "appointment.cancelled": "appointment_reminder",
          "message.received": "inbound_message",
          "message.sent": "inbound_message",
        };

        await upsertAutomationByKey(tenantId, template.key, {
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

    test: protectedProcedure
      .input(z.object({
        automationId: z.number(),
        testPhone: z.string().min(10),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const db = await getDb();

        const auto = await db.query.automations.findFirst({
          where: and(eq(automations.id, input.automationId), eq(automations.tenantId, tenantId)),
        });

        if (!auto) throw new TRPCError({ code: "NOT_FOUND" });

        const mockEvent: any = {
          type: auto.triggerType,
          tenantId,
          data: { phone: input.testPhone, first_name: "Test User" },
          timestamp: new Date(),
        };

        await runAutomationsForEvent(mockEvent);

        return { success: true, message: "Test sequence fired" };
      }),
  }),

  // AI
  ai: router({
    rewrite: protectedProcedure
      .input(z.object({
        message: z.string().min(1),
        tone: z.enum(["friendly", "professional", "casual", "urgent", "empathetic"]),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `Expert SMS copywriter. Rewrite in ${input.tone} tone. Under 160 chars. Return ONLY the message.`,
              },
              { role: "user", content: input.message },
            ],
          });
          const content = result.choices?.[0]?.message?.content || result.text || "";
          return { rewritten: content.trim() };
        } catch (err) {
          console.error("AI rewrite error:", err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI rewrite failed" });
        }
      }),
  }),

  // TEMPLATES
  templates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = await getTenantId(ctx.user.id);
      return await getTemplatesByTenantId(tenantId);
    }),

    create: protectedProcedure
      .input(z.object({
        key: z.string(),
        name: z.string(),
        body: z.string(),
        tone: z.enum(["friendly", "professional", "casual", "urgent"]).optional(),
        category: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await createTemplate({ ...input, tenantId });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        templateId: z.number(),
        name: z.string().optional(),
        body: z.string().optional(),
        tone: z.enum(["friendly", "professional", "casual", "urgent"]).optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await updateTemplate(tenantId, input.templateId, input);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ templateId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await deleteTemplate(tenantId, input.templateId);
        return { success: true };
      }),

    preview: protectedProcedure
      .input(z.object({ body: z.string(), tone: z.enum(["friendly", "professional", "casual", "urgent"]) }))
      .mutation(async ({ ctx, input }) => {
        const { rewriteMessage } = await import("./services/ai");
        const rewritten = await rewriteMessage(input.body, input.tone);
        return { rewritten };
      }),
  }),

  apiKeys: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = await getTenantId(ctx.user.id);
      return await getApiKeysByTenantId(tenantId);
    }),

    create: protectedProcedure
      .input(z.object({ label: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const key = `rk_${randomUUID().replace(/-/g, "")}`;
        const keyPrefix = key.slice(0, 7);
        const keyHash = await bcrypt.hash(key, 10);
        await createApiKey(tenantId, keyHash, keyPrefix, input.label);
        return { key };
      }),

    revoke: protectedProcedure
      .input(z.object({ keyId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await revokeApiKey(tenantId, input.keyId);
        return { success: true };
      }),
  }),

  // WEBHOOKS
  webhooks: router({
    receive: publicProcedure
      .input(z.object({
        event: z.enum(["lead.created","appointment.booked","appointment.no_show","appointment.cancelled","message.received","message.sent"]),
        data: z.record(z.any()),
        tenantId: z.number().optional(),
        userId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const tenantId = input.tenantId;
        if (!tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "tenantId required" });
        }

        await emitEvent({
          type: input.event,
          data: input.data,
          tenantId,
          userId: input.userId,
          timestamp: new Date(),
        });

        return { success: true };
      }),
  }),

  // TENANT
  tenant: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = await getTenantId(ctx.user.id);
      const tenant = await getTenantById(tenantId);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      return tenant;
    }),

    update: protectedProcedure
      .input(z.object({ name: z.string().optional(), timezone: z.string().optional(), industry: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await updateTenant(tenantId, input);
        return { success: true };
      }),

    subscription: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = await getTenantId(ctx.user.id);
      const subscriptionData = await getSubscriptionByTenantId(tenantId);
      if (!subscriptionData) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
      return subscriptionData;
    }),

    usage: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = await getTenantId(ctx.user.id);
      const usageData = await getUsageByTenantId(tenantId);
      if (!usageData) throw new TRPCError({ code: "NOT_FOUND", message: "Usage data not found" });
      return usageData;
    }),

    phoneNumbers: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = await getTenantId(ctx.user.id);
      return await getPhoneNumbersByTenantId(tenantId);
    }),

    addPhoneNumber: protectedProcedure
      .input(z.object({ number: z.string().min(8), label: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await addPhoneNumber(tenantId, input.number, input.label);
        return { success: true };
      }),

    removePhoneNumber: protectedProcedure
      .input(z.object({ phoneNumberId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await removePhoneNumber(tenantId, input.phoneNumberId);
        return { success: true };
      }),

    setDefaultNumber: protectedProcedure
      .input(z.object({ phoneNumberId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await setDefaultPhoneNumber(tenantId, input.phoneNumberId);
        return { success: true };
      }),

    setDefaultPhoneNumber: protectedProcedure
      .input(z.object({ phoneNumberId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await setDefaultPhoneNumber(tenantId, input.phoneNumberId);
        return { success: true };
      }),

    setInboundPhoneNumber: protectedProcedure
      .input(z.object({ phoneNumberId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await setInboundPhoneNumber(tenantId, input.phoneNumberId);
        return { success: true };
      }),
  }),

  // ANALYTICS, BILLING, ADMIN
  analytics: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = await getTenantId(ctx.user.id);
      const metrics = await getDashboardMetrics(tenantId);
      const statusBreakdown = await getLeadStatusBreakdown(tenantId);
      const messageVolume = await getMessageVolume(tenantId);
      return { metrics, statusBreakdown, messageVolume };
    }),
  }),

  plans: router({
    list: publicProcedure.query(async () => {
      return await getAllPlans();
    }),
  }),

  billing: router({
    getPlans: publicProcedure.query(async () => [{ id: 1, name: "Starter", price: 29 }]),

    createCheckoutSession: protectedProcedure
      .input(z.object({ priceId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2022-11-15" });

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [{ price: input.priceId, quantity: 1 }],
          success_url: `${process.env.APP_URL || "http://localhost:3000"}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.APP_URL || "http://localhost:3000"}/billing/cancel`,
          metadata: { tenantId: String(tenantId) },
          customer_email: ctx.user.email,
        });

        return { url: session.url, id: session.id };
      }),

    createCustomerPortal: protectedProcedure
      .input(z.object({ returnUrl: z.string().url().optional() }))
      .mutation(async ({ ctx, input }) => {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2022-11-15" });
        const db = await getDb();
        const tenantId = await getTenantId(ctx.user.id);

        const rows = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId)).limit(1);
        const subRow = rows[0];
        let customerId: string | undefined;
        if (subRow?.stripeId) {
          const stripeSub = await stripe.subscriptions.retrieve(subRow.stripeId).catch(() => null);
          customerId = (stripeSub as any)?.customer;
        }

        if (!customerId) throw new TRPCError({ code: "BAD_REQUEST", message: "No Stripe customer found for tenant" });

        const portal = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: input.returnUrl || `${process.env.APP_URL || "http://localhost:3000"}/billing`,
        });

        return { url: portal.url };
      }),
  }),

  admin: router({
    tenants: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return getAllTenants();
      }),
    }),
    users: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return getAllUsers();
      }),
    }),
    systemHealth: router({
      errors: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return getSystemErrors();
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
