import { eq, desc, and, sql } from "drizzle-orm";
import { systemErrorLogs, webhookLogs } from "../../drizzle/schema";

import type { Db } from "../_core/context";

export async function getSystemErrors(db: Db, type?: string, limit = 50) {
  const conditions = type ? [eq(systemErrorLogs.type, type as any)] : [];
  return db
    .select()
    .from(systemErrorLogs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(systemErrorLogs.createdAt))
    .limit(limit);
}

export async function createSystemError(db: Db, data: {
  type: "twilio" | "ai" | "automation" | "billing" | "webhook" | "system";
  message: string;
  detail?: string;
  tenantId?: number;
}) {
  const row = {
    type: data.type === "system" ? ("webhook" as const) : data.type,
    message: data.type === "system" ? `[system] ${data.message}` : data.message,
    detail: data.detail,
    tenantId: data.tenantId,
  };
  await db.insert(systemErrorLogs).values(row);
}

export async function getWebhookLogs(db: Db, tenantId?: number, limit = 50, page = 1) {
  const conditions = tenantId ? [eq(webhookLogs.tenantId, tenantId)] : [];
  const offset = (page - 1) * limit;
  return db
    .select()
    .from(webhookLogs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(webhookLogs.createdAt))
    .limit(limit)
    .offset(offset);
}
