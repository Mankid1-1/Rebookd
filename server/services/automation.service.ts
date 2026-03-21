import { eq, and, desc, isNull } from "drizzle-orm";
import { automations } from "../../drizzle/schema";

import type { Db } from "../_core/context";

export async function getAutomations(db: Db, tenantId: number) {
  return db
    .select()
    .from(automations)
    .where(and(eq(automations.tenantId, tenantId), isNull(automations.deletedAt)))
    .orderBy(desc(automations.createdAt));
}

export async function getAutomationById(db: Db, tenantId: number, automationId: number) {
  const result = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, automationId), eq(automations.tenantId, tenantId), isNull(automations.deletedAt)))
    .limit(1);
  return result[0];
}

export async function getAutomationByKey(db: Db, tenantId: number, key: string) {
  const result = await db
    .select()
    .from(automations)
    .where(and(eq(automations.tenantId, tenantId), eq(automations.key, key), isNull(automations.deletedAt)))
    .limit(1);
  return result[0];
}

export async function updateAutomation(
  db: Db,
  tenantId: number,
  automationId: number,
  data: Partial<{
    name: string;
    category: any;
    enabled: boolean;
    triggerType: string;
    triggerConfig: Record<string, unknown>;
    conditions: Array<Record<string, unknown>>;
    actions: Array<Record<string, unknown>>;
    runCount: any;
    errorCount: any;
    lastRunAt: Date;
  }>
) {
  await db
    .update(automations)
    .set({ ...data, updatedAt: new Date() } as Partial<typeof automations.$inferInsert>)
    .where(and(eq(automations.id, automationId), eq(automations.tenantId, tenantId), isNull(automations.deletedAt)));
}

export async function createAutomation(db: Db, data: {
  tenantId: number;
  name: string;
  key: string;
  category: "follow_up" | "reactivation" | "appointment" | "welcome" | "custom" | "no_show" | "cancellation" | "loyalty";
  enabled?: boolean;
  triggerType: "new_lead" | "inbound_message" | "status_change" | "time_delay" | "appointment_reminder";
  triggerConfig?: Record<string, unknown>;
  conditions?: Array<Record<string, unknown>>;
  actions?: Array<Record<string, unknown>>;
}) {
  await db.insert(automations).values(data);
  return { success: true };
}

export async function deleteAutomation(db: Db, tenantId: number, automationId: number) {
  await db
    .update(automations)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(automations.id, automationId), eq(automations.tenantId, tenantId), isNull(automations.deletedAt)));
}

export async function upsertAutomationByKey(db: Db, tenantId: number, key: string, data: {
  name?: string;
  category?: "follow_up" | "reactivation" | "appointment" | "welcome" | "custom" | "no_show" | "cancellation" | "loyalty";
  triggerType?: "new_lead" | "inbound_message" | "status_change" | "time_delay" | "appointment_reminder";
  triggerConfig?: Record<string, unknown>;
  conditions?: Array<Record<string, unknown>>;
  actions?: Array<Record<string, unknown>>;
  enabled?: boolean;
}) {
  const existing = await getAutomationByKey(db, tenantId, key);
  if (existing) {
    await updateAutomation(db, tenantId, existing.id, {
      name: data.name,
      category: data.category,
      triggerType: data.triggerType,
      triggerConfig: data.triggerConfig,
      conditions: data.conditions,
      actions: data.actions,
      enabled: data.enabled,
    });
    return existing;
  }

  const inserted = await db.insert(automations).values({
    tenantId,
    key,
    name: data.name ?? key,
    category: data.category ?? "custom",
    triggerType: data.triggerType ?? "new_lead",
    triggerConfig: data.triggerConfig ?? {},
    conditions: data.conditions ?? [],
    actions: data.actions ?? [],
    enabled: data.enabled ?? true,
  });
  return inserted;
}

export async function getAutomationsByTrigger(db: Db, tenantId: number, triggerType: string) {
  return db
    .select()
    .from(automations)
    .where(and(eq(automations.tenantId, tenantId), eq(automations.triggerType, triggerType as any), eq(automations.enabled, true), isNull(automations.deletedAt)))
    .orderBy(desc(automations.createdAt));
}
