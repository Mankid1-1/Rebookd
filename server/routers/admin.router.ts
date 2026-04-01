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
import * as DeploymentService from "../services/deployment.service";
import * as SentinelService from "../services/sentinel.service";
import { getAnomalyStats } from "../_core/flawless-gate";
import { EmailService } from "../services/email.service";
import { BUILD_VERSION } from "../../shared/version";

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
        await auditAdminRead(ctx, "admin.users.toggleActive", { userId: input.userId, active: input.active });
        return { success: true };
      }),
    changeAccountType: adminProcedure
      .input(z.object({ userId: z.number(), accountType: z.enum(["business", "referral", "both"]) }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db.update(users).set({ accountType: input.accountType }).where(eq(users.id, input.userId));
        await auditAdminRead(ctx, "admin.users.changeAccountType", { userId: input.userId, accountType: input.accountType });
        return { success: true };
      }),
    changeRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) {
          throw new Error("Cannot change your own role");
        }
        await ctx.db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
        await auditAdminRead(ctx, "admin.users.changeRole", { userId: input.userId, role: input.role });
        return { success: true };
      }),
  }),
  changePlan: adminProcedure
    .input(z.object({ tenantId: z.number(), planId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Get or create subscription for this tenant
      const existingSub = await TenantService.getSubscriptionByTenantId(ctx.db, input.tenantId);
      if (existingSub) {
        await ctx.db.update(subscriptions)
          .set({ planId: input.planId, status: "active" })
          .where(eq(subscriptions.id, existingSub.id));
      } else {
        await ctx.db.insert(subscriptions).values({
          tenantId: input.tenantId,
          planId: input.planId,
          status: "active",
          currentPeriodStart: sql`NOW()`,
          currentPeriodEnd: sql`DATE_ADD(NOW(), INTERVAL 30 DAY)`,
        });
      }
      await auditAdminRead(ctx, "admin.changePlan", { tenantId: input.tenantId, planId: input.planId });
      return { success: true };
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

  // ─── Live Update System: Deployments & System Info ──────────────────
  deployments: router({
    list: adminProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).optional() }).optional())
      .query(async ({ ctx, input }) => {
        await auditAdminRead(ctx, "admin.deployments.list");
        return DeploymentService.getDeployHistory(ctx.db, input?.limit ?? 20);
      }),

    latest: adminProcedure.query(async ({ ctx }) => {
      return DeploymentService.getLatestDeployment(ctx.db);
    }),

    liveStats: adminProcedure.query(async ({ ctx }) => {
      await auditAdminRead(ctx, "admin.deployments.liveStats");

      const [deployStats, healthModule] = await Promise.all([
        DeploymentService.getDeployStats(ctx.db),
        import("../_core/health-check"),
      ]);
      const health = await healthModule.performHealthCheck();

      return {
        deployStats,
        traffic: health.traffic,
        sentinel: health.sentinel,
        circuitBreakers: health.circuitBreakers,
        disabledFeatures: health.disabledFeatures,
        clientErrors: health.clientErrors,
        database: health.database,
        memory: health.memory,
      };
    }),

    record: adminProcedure
      .input(z.object({
        version: z.string(),
        gitHash: z.string().optional(),
        gitBranch: z.string().optional(),
        status: z.enum(["started", "uploading", "reloading", "verified", "failed", "rolled_back"]),
        deployedBy: z.string().optional(),
        durationMs: z.number().optional(),
        changelog: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await auditAdminRead(ctx, "admin.deployments.record", { version: input.version });
        return DeploymentService.recordDeployment(ctx.db, input);
      }),
  }),

  systemInfo: adminProcedure.query(async ({ ctx }) => {
    await auditAdminRead(ctx, "admin.systemInfo");

    const memUsage = process.memoryUsage();
    const [tenantCount] = await ctx.db.select({ c: sql<number>`COUNT(*)` }).from(tenants);
    const [userCount] = await ctx.db.select({ c: sql<number>`COUNT(*)` }).from(users);
    const [leadCount] = await ctx.db.select({ c: sql<number>`COUNT(*)` }).from(leads);

    const latestDeploy = await DeploymentService.getLatestDeployment(ctx.db);

    return {
      version: BUILD_VERSION,
      uptime: Math.floor(process.uptime()),
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapPressure: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      counts: {
        tenants: Number(tenantCount?.c ?? 0),
        users: Number(userCount?.c ?? 0),
        leads: Number(leadCount?.c ?? 0),
      },
      latestDeploy: latestDeploy ? {
        version: latestDeploy.version,
        status: latestDeploy.status,
        deployedBy: latestDeploy.deployedBy,
        createdAt: latestDeploy.createdAt,
        durationMs: latestDeploy.durationMs,
      } : null,
    };
  }),

  // ─── Autopilot Repair Engine ────────────────────────────────────────────────
  repairs: router({
    list: adminProcedure
      .input(z.object({
        status: z.enum(["detected", "diagnosing", "patching", "testing", "verifying", "deployed", "failed", "escalated"]).optional(),
        page: z.number().min(1).default(1).optional(),
        limit: z.number().min(1).max(100).default(50).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        await auditAdminRead(ctx, "admin.repairs.list", { status: input?.status });
        const { page, limit } = clampAdminPagination(input);
        const offset = (page - 1) * limit;
        const jobs = await SentinelService.getRepairJobs(ctx.db, {
          status: input?.status as any,
          limit,
          offset,
        });
        return { repairs: jobs, page, limit };
      }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        await auditAdminRead(ctx, "admin.repairs.getById", { repairJobId: input.id });
        const job = await SentinelService.getRepairJobById(ctx.db, input.id);
        if (!job) return null;
        return job;
      }),

    retry: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await auditAdminRead(ctx, "admin.repairs.retry", { repairJobId: input.id });
        await SentinelService.updateRepairJobStatus(ctx.db, input.id, "detected");
        return { success: true };
      }),

    escalate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await auditAdminRead(ctx, "admin.repairs.escalate", { repairJobId: input.id });
        await SentinelService.updateRepairJobStatus(ctx.db, input.id, "escalated");
        return { success: true };
      }),

    stats: adminProcedure.query(async ({ ctx }) => {
      await auditAdminRead(ctx, "admin.repairs.stats");
      const repairStats = await SentinelService.getRepairStats(ctx.db);
      const anomalyStats = getAnomalyStats();
      return { repairStats, anomalyStats };
    }),

    graphicalProfile: adminProcedure.query(async ({ ctx }) => {
      await auditAdminRead(ctx, "admin.repairs.graphicalProfile");
      return SentinelService.getGraphicalErrorProfile(ctx.db);
    }),

    sentinelHealth: adminProcedure.query(async ({ ctx }) => {
      await auditAdminRead(ctx, "admin.repairs.sentinelHealth");
      const [{ getDisabledFeatures }, { performHealthCheck }] = await Promise.all([
        import("../_core/sentinel-bridge"),
        import("../_core/health-check"),
      ]);
      const [disabledFeatures, health] = await Promise.all([
        getDisabledFeatures(ctx.db),
        performHealthCheck(),
      ]);
      return { disabledFeatures, sentinel: health.sentinel };
    }),
  }),

  // ─── Sentinel Observability Dashboard ─────────────────────────────────────
  sentinel: router({
    metricsTimeseries: adminProcedure
      .input(z.object({
        hours: z.number().min(1).max(168).default(24).optional(),
        tenantId: z.number().optional(),
        metric: z.string().optional(),
        category: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        await auditAdminRead(ctx, "admin.sentinel.metricsTimeseries", input ?? {});
        return SentinelService.getMetricsTimeseries(ctx.db, {
          hours: input?.hours,
          tenantId: input?.tenantId,
          metric: input?.metric,
          category: input?.category,
        });
      }),

    metricsCategories: adminProcedure.query(async ({ ctx }) => {
      await auditAdminRead(ctx, "admin.sentinel.metricsCategories");
      return SentinelService.getMetricsCategories(ctx.db);
    }),

    analyzerViolations: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(500).default(100).optional() }).optional())
      .query(async ({ ctx, input }) => {
        await auditAdminRead(ctx, "admin.sentinel.analyzerViolations");
        return SentinelService.getAnalyzerViolations(ctx.db, { limit: input?.limit });
      }),

    featureDisableHistory: adminProcedure.query(async ({ ctx }) => {
      await auditAdminRead(ctx, "admin.sentinel.featureDisableHistory");
      return SentinelService.getFeatureDisableHistory(ctx.db);
    }),

    repairEffectiveness: adminProcedure
      .input(z.object({ days: z.number().min(1).max(90).default(14).optional() }).optional())
      .query(async ({ ctx, input }) => {
        await auditAdminRead(ctx, "admin.sentinel.repairEffectiveness");
        return SentinelService.getRepairEffectiveness(ctx.db, { days: input?.days });
      }),
  }),
});
