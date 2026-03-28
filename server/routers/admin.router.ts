import { z } from "zod";
import { paginationSchema } from "../../shared/schemas/leads";
import { adminProcedure, router } from "../_core/trpc";
import * as TenantService from "../services/tenant.service";
import * as UserService from "../services/user.service";
import * as SystemService from "../services/system.service";
import * as AiService from "../services/ai.service";
import * as AdminAuditService from "../services/adminAudit.service";
import { EmailService } from "../services/email.service";

function clampAdminPagination(input?: { page?: number; limit?: number }) {
  const page = Math.max(1, input?.page ?? 1);
  const limit = Math.min(100, Math.max(1, input?.limit ?? 50));
  return { page, limit };
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

export const adminRouter = router({
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
});
