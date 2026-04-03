/**
 * Broadcast / Segment Messaging Service
 *
 * Allows tenants to send targeted SMS blasts to lead segments or
 * filtered lead lists. Respects TCPA consent, resolves per-lead
 * template variables, and logs every message.
 */

import { eq, and, sql, lte, inArray, ne, isNull, isNotNull } from "drizzle-orm";
import { leads, messages, leadSegments, leadSegmentMembers } from "../../drizzle/schema";
import type { Db } from "../_core/context";
import { sendSMS } from "../_core/sms";
import { resolveTemplate } from "../_core/sms";
import { decrypt } from "../_core/crypto";
import { logger } from "../_core/logger";
import * as TcpaCompliance from "./tcpa-compliance.service";
import * as TenantService from "./tenant.service";
import * as LeadService from "./lead.service";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BroadcastFilter {
  status?: string[];
  inactiveDays?: number; // hasn't had a message in N days
  minVisits?: number;
  maxVisits?: number;
  tags?: string[];
}

export interface BroadcastRequest {
  tenantId: number;
  message: string; // Template with {{name}}, {{business}}, etc.
  segmentId?: number; // send to a specific segment
  filter?: BroadcastFilter;
  dryRun?: boolean; // preview recipients without sending
}

export interface BroadcastRecipient {
  leadId: number;
  name: string | null;
  phone: string;
  status: string;
}

export interface BroadcastResult {
  totalRecipients: number;
  sent: number;
  failed: number;
  blocked: number; // TCPA blocked
  recipients?: BroadcastRecipient[];
}

// ── Internals ────────────────────────────────────────────────────────────────

/**
 * Build the recipient list from either a segmentId or ad-hoc filter criteria.
 * Returns raw DB rows (phone is still encrypted).
 */
async function buildRecipientQuery(
  db: Db,
  tenantId: number,
  opts: Pick<BroadcastRequest, "segmentId" | "filter">,
) {
  // ── Segment-based query ──────────────────────────────────────────────
  if (opts.segmentId) {
    // Verify the segment belongs to this tenant
    const [seg] = await db
      .select({ id: leadSegments.id })
      .from(leadSegments)
      .where(and(eq(leadSegments.id, opts.segmentId), eq(leadSegments.tenantId, tenantId)))
      .limit(1);

    if (!seg) {
      return [];
    }

    const rows = await db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        status: leads.status,
      })
      .from(leadSegmentMembers)
      .innerJoin(leads, eq(leads.id, leadSegmentMembers.leadId))
      .where(
        and(
          eq(leadSegmentMembers.segmentId, opts.segmentId),
          eq(leads.tenantId, tenantId),
          ne(leads.status, "unsubscribed"),
        ),
      );

    return rows;
  }

  // ── Filter-based query ───────────────────────────────────────────────
  const conditions: ReturnType<typeof eq>[] = [
    eq(leads.tenantId, tenantId),
    ne(leads.status, "unsubscribed"),
  ];

  const filter = opts.filter;

  if (filter?.status && filter.status.length > 0) {
    conditions.push(
      inArray(leads.status, filter.status as any),
    );
  }

  if (filter?.inactiveDays && filter.inactiveDays > 0) {
    const cutoff = new Date(Date.now() - filter.inactiveDays * 86_400_000);
    conditions.push(
      sql`(${leads.lastMessageAt} IS NULL OR ${leads.lastMessageAt} <= ${cutoff})`,
    );
  }

  if (filter?.minVisits !== undefined) {
    conditions.push(sql`${leads.visitCount} >= ${filter.minVisits}`);
  }

  if (filter?.maxVisits !== undefined) {
    conditions.push(sql`${leads.visitCount} <= ${filter.maxVisits}`);
  }

  if (filter?.tags && filter.tags.length > 0) {
    // Match leads whose tags JSON array contains at least one of the specified tags
    const tagConditions = filter.tags.map(
      (tag) => sql`JSON_CONTAINS(${leads.tags}, ${JSON.stringify(tag)})`,
    );
    conditions.push(sql`(${sql.join(tagConditions, sql` OR `)})`);
  }

  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      status: leads.status,
    })
    .from(leads)
    .where(and(...conditions));

  return rows;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Preview broadcast recipients without sending any messages.
 */
export async function previewBroadcast(
  db: Db,
  request: BroadcastRequest,
): Promise<BroadcastResult> {
  const rows = await buildRecipientQuery(db, request.tenantId, {
    segmentId: request.segmentId,
    filter: request.filter,
  });

  // Decrypt names/phones for the preview
  const recipients: BroadcastRecipient[] = rows.map((r) => ({
    leadId: r.id,
    name: r.name ? decrypt(r.name) : null,
    phone: decrypt(r.phone),
    status: r.status,
  }));

  return {
    totalRecipients: recipients.length,
    sent: 0,
    failed: 0,
    blocked: 0,
    recipients,
  };
}

/**
 * Send a broadcast SMS to all matching leads.
 * Checks TCPA consent per lead, resolves template variables, logs messages.
 */
export async function sendBroadcast(
  db: Db,
  request: BroadcastRequest,
): Promise<BroadcastResult> {
  const rows = await buildRecipientQuery(db, request.tenantId, {
    segmentId: request.segmentId,
    filter: request.filter,
  });

  if (rows.length === 0) {
    return { totalRecipients: 0, sent: 0, failed: 0, blocked: 0 };
  }

  // Fetch tenant name for {{business}} variable
  const tenant = await TenantService.getTenantById(db, request.tenantId);
  const businessName = tenant?.name ?? "Our Business";

  let sent = 0;
  let failed = 0;
  let blocked = 0;

  for (const row of rows) {
    // TCPA check
    const consent = await TcpaCompliance.canSendSms(db, request.tenantId, row.id);
    if (!consent.allowed) {
      blocked++;
      logger.info("Broadcast SMS blocked (TCPA)", {
        tenantId: request.tenantId,
        leadId: row.id,
        reason: consent.reason,
      });
      continue;
    }

    const decryptedPhone = decrypt(row.phone);
    const decryptedName = row.name ? decrypt(row.name) : null;

    // Resolve template variables
    const body = resolveTemplate(request.message, {
      name: decryptedName || "there",
      business: businessName,
      phone: decryptedPhone,
    });

    try {
      const res = await sendSMS(decryptedPhone, body, undefined, request.tenantId);

      // Log the message
      await LeadService.createMessage(db, {
        tenantId: request.tenantId,
        leadId: row.id,
        direction: "outbound",
        body,
        status: res.success ? "sent" : "failed",
        twilioSid: res.sid,
        provider: res.provider,
        providerError: [res.errorCode, res.error].filter(Boolean).join(": ") || undefined,
        retryCount: res.retryCount || 0,
        failedAt: res.success ? undefined : new Date(),
        deliveredAt: res.success ? new Date() : undefined,
      });

      if (res.success) {
        sent++;
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
      logger.error("Broadcast SMS send error", {
        tenantId: request.tenantId,
        leadId: row.id,
        error: String(err),
      });
    }
  }

  logger.info("Broadcast completed", {
    tenantId: request.tenantId,
    totalRecipients: rows.length,
    sent,
    failed,
    blocked,
  });

  return { totalRecipients: rows.length, sent, failed, blocked };
}

/**
 * Return the most recent outbound broadcast-style messages (grouped by body text)
 * for the tenant. This gives a quick view of recent blasts.
 */
export async function getRecentBroadcasts(
  db: Db,
  tenantId: number,
  limit = 10,
) {
  const rows = await db
    .select({
      body: messages.body,
      sentAt: sql<Date>`MIN(${messages.createdAt})`.as("sentAt"),
      recipientCount: sql<number>`COUNT(*)`.as("recipientCount"),
      deliveredCount: sql<number>`SUM(CASE WHEN ${messages.status} IN ('sent','delivered') THEN 1 ELSE 0 END)`.as("deliveredCount"),
      failedCount: sql<number>`SUM(CASE WHEN ${messages.status} = 'failed' THEN 1 ELSE 0 END)`.as("failedCount"),
    })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.direction, "outbound"),
        isNull(messages.automationId), // only manual / broadcast messages
      ),
    )
    .groupBy(messages.body)
    .orderBy(sql`sentAt DESC`)
    .limit(limit);

  return rows;
}
