import { eq, desc, and, sql } from "drizzle-orm";
import { createHash } from "crypto";
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

/**
 * Auto-classify severity from error context.
 * - critical: unhandled exceptions, DB connection failures, auth system errors
 * - high: payment failures, SMS delivery failures
 * - medium: general API errors, validation failures (default)
 * - low: warnings, non-critical webhook issues
 */
function classifySeverity(type: string, message: string): "low" | "medium" | "high" | "critical" {
  const msg = message.toLowerCase();

  // Critical: crashes, DB query failures, connection failures, auth breakdowns
  if (msg.includes("fatal") || msg.includes("unhandled") || msg.includes("econnrefused") ||
      msg.includes("failed query") || msg.includes("query failed") ||
      msg.includes("deadlock") || msg.includes("lock wait timeout") ||
      msg.includes("duplicate entry") || msg.includes("column count") ||
      (msg.includes("database") && msg.includes("connect")) ||
      msg.includes("cannot read propert") || msg.includes("is not a function") ||
      msg.includes("typeerror") || msg.includes("referenceerror")) {
    return "critical";
  }

  // High: payment and SMS failures
  if (type === "billing" || type === "twilio" ||
      msg.includes("payment failed") || msg.includes("sms failed") || msg.includes("stripe")) {
    return "high";
  }

  // Low: informational
  if (msg.includes("warning") || msg.includes("deprecated") || msg.includes("informational")) {
    return "low";
  }

  return "medium";
}

function computeStackHash(detail?: string): string | undefined {
  if (!detail) return undefined;
  const normalized = detail.replace(/:\d+:\d+/g, "").replace(/\d{4}-\d{2}-\d{2}[\sT][\d:.Z]*/g, "").slice(0, 500);
  return createHash("sha256").update(normalized).digest("hex");
}

export async function createSystemError(db: Db, data: {
  type: "twilio" | "ai" | "automation" | "billing" | "webhook" | "system" | "client";
  message: string;
  detail?: string;
  tenantId?: number;
  severity?: "low" | "medium" | "high" | "critical";
  errorCategory?: "runtime" | "graphical" | "rendering" | "network" | "performance";
}) {
  const mappedType = data.type;
  const message = data.type === "system" ? `[system] ${data.message}` : data.message;
  const severity = data.severity || classifySeverity(mappedType, message);

  const row = {
    type: mappedType,
    message,
    detail: data.detail,
    tenantId: data.tenantId,
    severity,
    errorCategory: data.errorCategory ?? "runtime",
    stackTraceHash: computeStackHash(data.detail),
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
