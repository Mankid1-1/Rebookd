import { and, desc, eq, sql } from "drizzle-orm";
import { plans, subscriptions, usage } from "../../drizzle/schema";
import { AppError } from "../_core/appErrors";
import type { Db } from "../_core/context";

export async function getTenantUsageState(db: Db, tenantId: number) {
  const [usageRow] = await db
    .select()
    .from(usage)
    .where(eq(usage.tenantId, tenantId))
    .orderBy(desc(usage.periodStart))
    .limit(1);

  const [subscriptionRow] = await db
    .select({ sub: subscriptions, plan: plans })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, "active")))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  return {
    usage: usageRow,
    subscription: subscriptionRow?.sub,
    plan: subscriptionRow?.plan,
  };
}

export async function assertUsageCapAvailable(db: Db, tenantId: number) {
  const state = await getTenantUsageState(db, tenantId);
  const cap = state.plan?.maxMessages ?? 0;
  const used = state.usage?.messagesSent ?? 0;

  if (cap > 0 && used >= cap) {
    throw new AppError("USAGE_CAP_EXCEEDED", "Monthly SMS usage cap exceeded", 429);
  }

  return { cap, used };
}

/**
 * Atomically increments outbound SMS usage when under plan cap (prevents concurrent over-send).
 * `cap === 0` means unlimited (no cap check).
 */
export async function incrementOutboundUsageIfAllowed(db: Db, tenantId: number): Promise<boolean> {
  const state = await getTenantUsageState(db, tenantId);
  const cap = state.plan?.maxMessages ?? 0;
  const usageRow = state.usage;
  if (!usageRow) return false;

  if (cap === 0) {
    await db
      .update(usage)
      .set({ messagesSent: sql`${usage.messagesSent} + 1`, updatedAt: new Date() })
      .where(eq(usage.id, usageRow.id));
    return true;
  }

  const result = await db.execute(sql`
    UPDATE usage u
    INNER JOIN subscriptions s ON s.tenantId = u.tenantId AND s.status = 'active'
    INNER JOIN plans p ON p.id = s.planId
    SET u.messagesSent = u.messagesSent + 1, u.updatedAt = NOW()
    WHERE u.id = ${usageRow.id} AND u.tenantId = ${tenantId} AND u.messagesSent < p.maxMessages
  `);

  const header = (Array.isArray(result) ? result[0] : result) as { affectedRows?: number };
  return (header?.affectedRows ?? 0) > 0;
}
