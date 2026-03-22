import { eq, and, desc, sql, ilike, or } from "drizzle-orm";
import { leads, messages } from "../../drizzle/schema";
import { decrypt, encryptIfNeeded } from "../_core/crypto";
import { hashPhoneNumber, normalizePhoneNumber } from "../_core/phone";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";
import * as UsageService from "./usage.service";
import * as TcpaComplianceService from "./tcpaCompliance.service";
import { withQueryTimeout, withQueryRetry, QueryPerformanceMonitor } from "../_core/query-timeout.service";
import { searchLeads, getLeadByIdOptimized, getSearchMemoryStats } from "./lead-search-optimization.service";
import { encryptMessage, decryptMessage, messageEncryption } from "../_core/message-encryption";

function presentLead<T extends Record<string, any> | undefined>(lead: T): T {
  if (!lead) return lead;
  return {
    ...lead,
    phone: lead.phone ? decrypt(lead.phone) : lead.phone,
    name: lead.name ? decrypt(lead.name) : lead.name,
    email: lead.email ? decrypt(lead.email) : lead.email,
  };
}

function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.filter((tag): tag is string => typeof tag === "string" && tag.length > 0)));
}

export async function setLeadTags(db: Db, tenantId: number, leadId: number, tags: string[]) {
  await db
    .update(leads)
    .set({ tags: normalizeTags(tags), updatedAt: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));
}

export async function addLeadTags(db: Db, tenantId: number, leadId: number, tags: string[]) {
  const [lead] = await db
    .select({ tags: leads.tags })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .limit(1);
  const nextTags = normalizeTags([...(Array.isArray(lead?.tags) ? lead.tags : []), ...tags]);
  await setLeadTags(db, tenantId, leadId, nextTags);
}

export async function getLeads(
  db: Db,
  tenantId: number,
  opts?: { page?: number; limit?: number; search?: string; status?: string },
) {
  // Use optimized search service with memory management
  return await QueryPerformanceMonitor.trackQuery(
    () => searchLeads(db, tenantId, opts),
    'getLeads',
    1000 // 1 second slow threshold
  );
}

export async function getLeadById(
  db: Db,
  tenantId: number,
  leadId: number,
) {
  // Use optimized lead retrieval with caching and timeout
  const lead = await QueryPerformanceMonitor.trackQuery(
    () => getLeadByIdOptimized(db, tenantId, leadId),
    'getLeadById',
    500 // 500ms slow threshold
  );
  
  return presentLead(lead);
}

export async function createLead(db: Db, data: {
  tenantId: number;
  phone: string;
  name?: string;
  email?: string;
  source?: string;
  notes?: string;
}): Promise<{ success: true; duplicate?: boolean }> {
  const normalizedPhone = normalizePhoneNumber(data.phone);
  const phoneHash = hashPhoneNumber(normalizedPhone);
  const [existing] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.tenantId, data.tenantId), eq(leads.phoneHash, phoneHash)))
    .limit(1);
  if (existing) return { success: true, duplicate: true };

  await db.insert(leads).values({
    tenantId: data.tenantId,
    phone: encryptIfNeeded(normalizedPhone) ?? "",
    phoneHash,
    name: encryptIfNeeded(data.name) ?? undefined,
    email: encryptIfNeeded(data.email) ?? undefined,
    source: data.source,
    notes: data.notes,
  });
  return { success: true };
}

export async function updateLead(
  db: Db,
  tenantId: number,
  leadId: number,
  data: { name?: string; email?: string; phone?: string; notes?: string; status?: string; appointmentAt?: Date | null }
) {
  const updatePayload: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (typeof data.status !== "undefined") updatePayload.status = data.status as any;
  if (typeof data.notes !== "undefined") updatePayload.notes = data.notes;
  if (typeof data.appointmentAt !== "undefined") updatePayload.appointmentAt = data.appointmentAt;
  if (typeof data.name !== "undefined") updatePayload.name = encryptIfNeeded(data.name);
  if (typeof data.email !== "undefined") updatePayload.email = encryptIfNeeded(data.email || null);
  if (typeof data.phone !== "undefined") {
    const normalizedPhone = normalizePhoneNumber(data.phone);
    updatePayload.phone = encryptIfNeeded(normalizedPhone);
    updatePayload.phoneHash = hashPhoneNumber(normalizedPhone);
  }

  await db
    .update(leads)
    .set(updatePayload)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));
}

export async function updateLeadStatus(db: Db, tenantId: number, leadId: number, status: string) {
  await db
    .update(leads)
    .set({ status: status as any, updatedAt: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));
}

export async function getMessagesByLeadId(db: Db, tenantId: number, leadId: number) {
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.leadId, leadId), eq(messages.tenantId, tenantId)))
    .orderBy(messages.createdAt);
  return rows.map((message) => ({
    ...message,
    fromNumber: message.fromNumber ? decrypt(message.fromNumber) : message.fromNumber,
    toNumber: message.toNumber ? decrypt(message.toNumber) : message.toNumber,
  }));
}

export async function createMessage(db: Db, data: {
  tenantId: number;
  leadId: number;
  direction: "inbound" | "outbound";
  body: string;
  fromNumber?: string;
  toNumber?: string;
  twilioSid?: string;
  status?: "queued" | "sent" | "delivered" | "failed" | "received";
  tone?: string;
  aiRewritten?: boolean;
  automationId?: number;
  provider?: string;
  providerError?: string;
  retryCount?: number;
  idempotencyKey?: string;
  deliveredAt?: Date;
  failedAt?: Date;
}) {
  // Check if encryption is configured
  if (!messageEncryption.isConfigured()) {
    logger.warn('Message encryption not configured, storing plain text');
  }

  // Encrypt message body if encryption is available
  let encryptedBody = data.body;
  let encryptedFromNumber = data.fromNumber;
  let encryptedToNumber = data.toNumber;

  if (messageEncryption.isConfigured()) {
    try {
      const encryptedMsg = encryptMessage(data.body);
      encryptedBody = `${encryptedMsg.encrypted}:${encryptedMsg.iv}:${encryptedMsg.tag}`;
      
      if (data.fromNumber) {
        encryptedFromNumber = messageEncryption.encryptPhoneNumber(data.fromNumber);
      }
      
      if (data.toNumber) {
        encryptedToNumber = messageEncryption.encryptPhoneNumber(data.toNumber);
      }
    } catch (error) {
      logger.error('Message encryption failed:', error);
      // Fall back to plain text with legacy encryption
      encryptedBody = encryptIfNeeded(data.body);
      encryptedFromNumber = data.fromNumber ? encryptIfNeeded(data.fromNumber) : undefined;
      encryptedToNumber = data.toNumber ? encryptIfNeeded(data.toNumber) : undefined;
    }
  }

  return db.transaction(async (tx) => {
    const result = await tx.insert(messages).values({ 
      ...data, 
      body: encryptedBody,
      fromNumber: encryptedFromNumber,
      toNumber: encryptedToNumber,
      status: data.status || "sent" 
    });

    await tx
      .update(leads)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(and(eq(leads.id, data.leadId), eq(leads.tenantId, data.tenantId)));

    if (data.direction === "outbound" && data.status !== "failed") {
      const incremented = await UsageService.incrementOutboundUsageIfAllowed(tx as Db, data.tenantId);
      if (!incremented) {
        logger.error("Usage counter could not be incremented — cap race, missing usage row, or plan mismatch", {
          tenantId: data.tenantId,
          leadId: data.leadId,
        });
      }
    }
    return result;
  });
}

export async function getRecentMessages(db: Db, tenantId: number, limit = 10) {
  const rows = await db
    .select({ msg: messages, lead: leads })
    .from(messages)
    .innerJoin(leads, eq(messages.leadId, leads.id))
    .where(eq(messages.tenantId, tenantId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    msg: {
      ...row.msg,
      fromNumber: row.msg.fromNumber ? decrypt(row.msg.fromNumber) : row.msg.fromNumber,
      toNumber: row.msg.toNumber ? decrypt(row.msg.toNumber) : row.msg.toNumber,
    },
    lead: presentLead(row.lead),
  }));
}

export async function sendMessage(
  db: Db,
  tenantId: number,
  leadId: number,
  body: string,
  idempotencyKey?: string,
) {
  // Check TCPA compliance before sending
  const complianceCheck = await TcpaComplianceService.canSendSms(db, tenantId, leadId);
  if (!complianceCheck.allowed) {
    logger.warn("SMS blocked due to TCPA compliance", { 
      tenantId, 
      leadId, 
      reason: complianceCheck.reason 
    });
    return { 
      success: false, 
      error: `SMS not allowed: ${complianceCheck.reason}` 
    };
  }

  if (idempotencyKey) {
    const [existing] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), eq(messages.idempotencyKey, idempotencyKey)))
      .limit(1);
    if (existing) {
      return {
        success: existing.status !== "failed",
        sid: existing.twilioSid || undefined,
        deduplicated: true,
        errorCode: existing.providerError || undefined,
      };
    }
  }

  const [lead] = await db.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId))).limit(1);
  if (!lead) return { success: false, error: "Lead not found" };

  const phone = decrypt(lead.phone);

  const { sendSMS } = await import("../_core/sms");
  const res = await sendSMS(phone, body, undefined, tenantId);

  await createMessage(db, {
    tenantId,
    leadId,
    direction: "outbound",
    body,
    status: res.success ? "sent" : "failed",
    twilioSid: res.sid,
    provider: res.provider,
    providerError: [res.errorCode, res.error].filter(Boolean).join(": ") || undefined,
    retryCount: res.retryCount || 0,
    idempotencyKey,
    failedAt: res.success ? undefined : new Date(),
    deliveredAt: res.success ? new Date() : undefined,
  });

  return { success: res.success, sid: res.sid, errorCode: res.errorCode };
}
