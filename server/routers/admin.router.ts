import { z } from "zod";
import { eq, and, sql, gte, lte, desc, isNull } from "drizzle-orm";
import { paginationSchema } from "../../shared/schemas/leads";
import { tenants, subscriptions, users, leads, automations } from "../../drizzle/schema";
import type { Db } from "../_core/context";
import { adminProcedure, router } from "../_core/trpc";
import * as TenantService from "../services/tenant.service";
import * as UserService from "../services/user.service";
import * as SystemService from "../services/system.service";
import * as AiService from "../services/ai.service";
import * as AdminAuditService from "../services/admin-audit.service";
import { EmailService } from "../services/email.service";

function clampAdminPagination(input?: { page?: number; limit?: number }) {
  const page = Math.max(1, input?.page ?? 1);
  const limit = Math.min(100, Math.max(1, input?.limit ?? 50));
  return { page, limit };
}

async function auditAdminRead(
  ctx: { db: Db; user: { id: number; email?: string | null }; req: { path?: string } },
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

export const adminRouter = router({
  tenants: router({
    list: adminProcedure.input(paginationSchema).query(async ({ ctx, input }) => {
      await auditAdminRead(ctx, "admin.tenants.list", { page: input?.page, limit: input?.limit });
      const { page, limit } = clampAdminPagination(input);
      const { rows, total } = await TenantService.getAllTenants(ctx.db, page, limit);
      // Enrich tenants with plan info from subscriptions
      const allPlans = await TenantService.getAllPlans(ctx.db);
      const planMap = new Map(allPlans.map((p) => [p.id, p.slug]));
      const enriched = await Promise.all(rows.map(async (t) => {
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

  // ─── Churn Prevention: At-risk tenants ───────────────────────────
  churnRisk: adminProcedure.query(async ({ ctx }) => {
    await auditAdminRead(ctx, "admin.churnRisk.list");

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get all active tenants with their activity signals
    const tenantRows = await ctx.db
      .select({
        tenantId: tenants.id,
        tenantName: tenants.name,
        createdAt: tenants.createdAt,
      })
      .from(tenants);

    const atRiskTenants = await Promise.all(
      tenantRows.map(async (t) => {
        // Count recent logins (users with recent activity)
        const [loginActivity] = await ctx.db
          .select({ c: sql<number>`COUNT(*)` })
          .from(users)
          .where(and(eq(users.tenantId, t.tenantId), gte(users.lastSignedIn, thirtyDaysAgo)));

        // Count active automations
        const [autoActivity] = await ctx.db
          .select({ c: sql<number>`COUNT(*)` })
          .from(automations)
          .where(and(eq(automations.tenantId, t.tenantId), eq(automations.enabled, true), isNull(automations.deletedAt)));

        // Count recent messages
        const [msgActivity] = await ctx.db
          .select({ c: sql<number>`COUNT(*)` })
          .from(leads)
          .where(and(eq(leads.tenantId, t.tenantId), gte(leads.lastMessageAt, sevenDaysAgo)));

        const recentLogins = Number(loginActivity?.c ?? 0);
        const activeAutomations = Number(autoActivity?.c ?? 0);
        const recentMessages = Number(msgActivity?.c ?? 0);

        // Risk scoring: higher = more at risk
        let riskScore = 0;
        if (recentLogins === 0) riskScore += 40; // No logins in 30 days
        if (activeAutomations === 0) riskScore += 30; // No active automations
        if (recentMessages === 0) riskScore += 30; // No messages in 7 days

        return {
          tenantId: t.tenantId,
          tenantName: t.tenantName,
          riskScore,
          riskLevel: riskScore >= 70 ? "high" as const : riskScore >= 40 ? "medium" as const : "low" as const,
          signals: {
            recentLogins,
            activeAutomations,
            recentMessages,
          },
        };
      })
    );

    // Return sorted by risk (highest first), filter out low risk
    return atRiskTenants
      .filter((t) => t.riskScore >= 40)
      .sort((a, b) => b.riskScore - a.riskScore);
  }),
});
