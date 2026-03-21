import { eq, desc, and, sql, isNull } from "drizzle-orm";
import { tenants, subscriptions, usage, plans, phoneNumbers } from "../../drizzle/schema";
import { getUserById } from "./user.service";
import { TRPCError } from "@trpc/server";
import type { Db } from "../_core/context";
import { normalizePhoneNumber } from "../_core/phone";

export async function getTenantId(db: Db, userId: number) {
  const user = await getUserById(db, userId);
  if (user?.tenantId) return user.tenantId;

  throw new TRPCError({ code: "FORBIDDEN", message: "No tenant found" });
}

export async function getTenantById(db: Db, id: number) {
  const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return result[0];
}

export async function getAllTenants(db: Db, page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const [rows, countRows] = await Promise.all([
    db.select().from(tenants).orderBy(desc(tenants.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(tenants),
  ]);
  return { rows, total: Number(countRows[0]?.count ?? 0) };
}

export async function updateTenant(db: Db, id: number, data: Partial<{ name: string; timezone: string }>) {
  await db.update(tenants).set({ ...data, updatedAt: new Date() }).where(eq(tenants.id, id));
}

export async function getSubscriptionByTenantId(db: Db, tenantId: number) {
  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return result[0];
}

export function isSubscriptionEntitled(
  subscription:
    | {
        status?: string | null;
        trialEndsAt?: Date | string | null;
        currentPeriodEnd?: Date | string | null;
      }
    | undefined
    | null,
) {
  if (!subscription) return false;
  const now = Date.now();
  if (subscription.status === "active") return true;
  if (subscription.status === "trialing") {
    return subscription.trialEndsAt ? new Date(subscription.trialEndsAt).getTime() > now : true;
  }
  if (subscription.status === "past_due") {
    return subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).getTime() > now : false;
  }
  return false;
}

export async function tenantHasAutomationAccess(db: Db, tenantId: number) {
  const subscription = await getSubscriptionByTenantId(db, tenantId);
  return isSubscriptionEntitled(subscription);
}

export async function getUsageByTenantId(db: Db, tenantId: number) {
  const result = await db
    .select()
    .from(usage)
    .where(eq(usage.tenantId, tenantId))
    .orderBy(desc(usage.createdAt))
    .limit(1);
  return result[0];
}

export async function getAllPlans(db: Db) {
  return db.select().from(plans).orderBy(plans.priceMonthly);
}

export async function getPhoneNumbersByTenantId(db: Db, tenantId: number) {
  return db
    .select()
    .from(phoneNumbers)
    .where(and(eq(phoneNumbers.tenantId, tenantId), isNull(phoneNumbers.deletedAt)))
    .orderBy(desc(phoneNumbers.createdAt));
}

export async function addPhoneNumber(db: Db, tenantId: number, data: { number: string; title?: string }) {
  await db.insert(phoneNumbers).values({ tenantId, number: normalizePhoneNumber(data.number), label: data.title });
}

export async function removePhoneNumber(db: Db, tenantId: number, id: number) {
  await db
    .update(phoneNumbers)
    .set({ deletedAt: new Date() })
    .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.tenantId, tenantId), isNull(phoneNumbers.deletedAt)));
}

export async function setDefaultPhoneNumber(db: Db, tenantId: number, id: number) {
  await db.update(phoneNumbers).set({ isDefault: false }).where(and(eq(phoneNumbers.tenantId, tenantId), isNull(phoneNumbers.deletedAt)));
  await db.update(phoneNumbers).set({ isDefault: true }).where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.tenantId, tenantId), isNull(phoneNumbers.deletedAt)));
}

export async function setInboundPhoneNumber(db: Db, tenantId: number, id: number) {
  await db.update(phoneNumbers).set({ isInbound: false }).where(and(eq(phoneNumbers.tenantId, tenantId), isNull(phoneNumbers.deletedAt)));
  await db.update(phoneNumbers).set({ isInbound: true }).where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.tenantId, tenantId), isNull(phoneNumbers.deletedAt)));
}
