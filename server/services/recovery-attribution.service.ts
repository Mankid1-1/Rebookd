/**
 * RECOVERY ATTRIBUTION SERVICE
 *
 * Provides near-100% correlation between platform recovery actions and bank deposits.
 *
 * Flow:
 *   1. Automation sends recovery SMS → createRecoveryEvent() generates a trackingToken
 *   2. SMS body includes the trackingToken (or short-link containing it)
 *   3. When lead rebooks → markRecoveryConverted() links the new appointment
 *   4. When Stripe payment is captured → markRecoveryRealized() records actual revenue
 *   5. For off-platform payments → markManualRecovery() allows manual reconciliation
 *   6. getRecoveryLedger() exports a bank-statement-reconcilable ledger
 *
 * Attribution dedup: Only ONE recovery event per lead conversion gets isPrimaryAttribution=true.
 * Model: last_touch (the most recent automation that contacted the lead before conversion wins).
 */

import { eq, and, sql, desc, gte, lte, isNull, isNotNull, inArray } from "drizzle-orm";
import { recoveryEvents, leads, messages, automations, subscriptions, plans } from "../../drizzle/schema";
import type { Db } from "../_core/context";
import { logger } from "../_core/logger";
import * as RedditCAPI from "./reddit-conversions.service";

const DEFAULT_COMMISSION_RATE = 0.15;

// ─── Tracking Token Generation ───────────────────────────────────────────────

/**
 * Generate a unique, URL-safe tracking token for a recovery event.
 * Format: rb_{tenantId}_{leadId}_{timestamp}_{random}
 */
export function generateTrackingToken(tenantId: number, leadId: number): string {
  const ts = Date.now().toString(36);
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `rb_${tenantId}_${leadId}_${ts}_${rand}`;
}

// ─── Recovery Event Lifecycle ────────────────────────────────────────────────

/**
 * Create a recovery event when an automation sends a recovery SMS.
 * Returns the tracking token to embed in the SMS body.
 */
export async function createRecoveryEvent(
  db: Db,
  data: {
    tenantId: number;
    leadId: number;
    automationId?: number;
    messageId?: number;
    leakageType: string;
    originalAppointmentId?: string;
    estimatedRevenue?: number;
  }
): Promise<{ recoveryEventId: number; trackingToken: string }> {
  const trackingToken = generateTrackingToken(data.tenantId, data.leadId);

  const result = await db.insert(recoveryEvents).values({
    tenantId: data.tenantId,
    leadId: data.leadId,
    automationId: data.automationId,
    messageId: data.messageId,
    leakageType: data.leakageType,
    originalAppointmentId: data.originalAppointmentId,
    trackingToken,
    status: "sent",
    estimatedRevenue: data.estimatedRevenue || 0,
    sentAt: new Date(),
  });

  const recoveryEventId = Number((result as any)[0]?.insertId ?? (result as any).insertId ?? 0);

  logger.info("Recovery event created", {
    recoveryEventId,
    trackingToken,
    tenantId: data.tenantId,
    leadId: data.leadId,
    leakageType: data.leakageType,
  });

  return { recoveryEventId, trackingToken };
}

/**
 * Mark that the customer responded to a recovery SMS.
 */
export async function markRecoveryResponded(db: Db, tenantId: number, trackingToken: string): Promise<void> {
  await db
    .update(recoveryEvents)
    .set({ status: "responded", respondedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(recoveryEvents.trackingToken, trackingToken), eq(recoveryEvents.tenantId, tenantId), eq(recoveryEvents.status, "sent")));
}

/**
 * Mark that the customer rebooked after a recovery attempt.
 * Applies last-touch attribution dedup.
 */
export async function markRecoveryConverted(
  db: Db,
  tenantId: number,
  leadId: number,
  data: {
    recoveredAppointmentId?: string;
    estimatedRevenue?: number;
    /** If known, the specific tracking token. Otherwise, last-touch is used. */
    trackingToken?: string;
  }
): Promise<{ primaryEventId: number | null }> {
  // Find the most recent recovery event for this lead (last-touch attribution)
  const candidates = await db
    .select()
    .from(recoveryEvents)
    .where(
      and(
        eq(recoveryEvents.tenantId, tenantId),
        eq(recoveryEvents.leadId, leadId),
        inArray(recoveryEvents.status, ["sent", "responded"]),
      )
    )
    .orderBy(desc(recoveryEvents.sentAt))
    .limit(10);

  if (candidates.length === 0) {
    logger.info("No active recovery events for lead conversion", { tenantId, leadId });
    return { primaryEventId: null };
  }

  // If a specific tracking token was provided, use that; otherwise last-touch
  let primaryEvent = candidates[0];
  if (data.trackingToken) {
    const specific = candidates.find((e) => e.trackingToken === data.trackingToken);
    if (specific) primaryEvent = specific;
  }

  const now = new Date();

  // Mark ALL candidates as converted but only ONE as primary attribution
  for (const event of candidates) {
    const isPrimary = event.id === primaryEvent.id;
    await db
      .update(recoveryEvents)
      .set({
        status: "converted",
        convertedAt: now,
        recoveredAppointmentId: data.recoveredAppointmentId,
        estimatedRevenue: isPrimary ? (data.estimatedRevenue || event.estimatedRevenue) : event.estimatedRevenue,
        isPrimaryAttribution: isPrimary,
        updatedAt: now,
      })
      .where(eq(recoveryEvents.id, event.id));
  }

  // Tag the lead with recovery source
  await db
    .update(leads)
    .set({
      recoverySource: "rebookd_automation",
      updatedAt: now,
    })
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

  logger.info("Recovery conversion attributed", {
    primaryEventId: primaryEvent.id,
    totalCandidates: candidates.length,
    tenantId,
    leadId,
    trackingToken: primaryEvent.trackingToken,
  });

  return { primaryEventId: primaryEvent.id };
}

/**
 * Mark that a Stripe payment was captured for a recovery event.
 * This links the actual bank deposit to the recovery action.
 */
export async function markRecoveryRealized(
  db: Db,
  tenantId: number,
  leadId: number,
  data: {
    stripePaymentIntentId: string;
    stripeInvoiceId?: string;
    realizedRevenue: number; // in cents
    /** If known, target a specific recovery event */
    recoveryEventId?: number;
  }
): Promise<void> {
  const now = new Date();
  const conditions = [
    eq(recoveryEvents.tenantId, tenantId),
    eq(recoveryEvents.leadId, leadId),
    eq(recoveryEvents.isPrimaryAttribution, true),
  ];

  if (data.recoveryEventId) {
    conditions.push(eq(recoveryEvents.id, data.recoveryEventId));
  }

  // FIX #18: Read commission rate from the tenant's plan instead of hardcoding 15%
  let commissionRate = DEFAULT_COMMISSION_RATE;
  try {
    const [sub] = await db
      .select({ planId: subscriptions.planId })
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    if (sub?.planId) {
      const [plan] = await db
        .select({ revenueSharePercent: plans.revenueSharePercent })
        .from(plans)
        .where(eq(plans.id, sub.planId))
        .limit(1);
      if (plan && plan.revenueSharePercent > 0) {
        commissionRate = plan.revenueSharePercent / 100;
      }
    }
  } catch {
    // Fallback to default rate if plan lookup fails
  }
  const commissionAmount = Math.round(data.realizedRevenue * commissionRate);

  await db
    .update(recoveryEvents)
    .set({
      status: "realized",
      stripePaymentIntentId: data.stripePaymentIntentId,
      stripeInvoiceId: data.stripeInvoiceId,
      realizedRevenue: data.realizedRevenue,
      commissionRate: String(commissionRate),
      commissionAmount,
      commissionStatus: "pending",
      realizedAt: now,
      updatedAt: now,
    })
    .where(and(...conditions));

  logger.info("Recovery realized (payment captured)", {
    tenantId,
    leadId,
    stripePaymentIntentId: data.stripePaymentIntentId,
    realizedRevenue: data.realizedRevenue,
    commissionAmount,
  });

  // Reddit Conversions API — server-side Purchase event
  try {
    const [lead] = await db
      .select({ email: leads.email })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);
    RedditCAPI.trackPurchase({
      email: lead?.email || undefined,
      externalId: String(leadId),
      revenueCents: data.realizedRevenue,
    });
  } catch {
    // Non-fatal — don't break recovery flow for analytics
  }
}

// FIX #22: Threshold above which manual recoveries require notes (fraud prevention)
const MANUAL_RECOVERY_PROOF_THRESHOLD_CENTS = 10000; // $100

/**
 * Manually mark a recovery as realized (for off-platform payments like cash/POS).
 * FIX #22: Requires notes for recoveries above the proof threshold.
 */
export async function markManualRecovery(
  db: Db,
  tenantId: number,
  leadId: number,
  data: {
    realizedRevenue: number; // in cents
    notes?: string;
    recoveryEventId?: number;
  }
): Promise<void> {
  // FIX #22: Require notes/proof for manual recoveries above threshold
  if (data.realizedRevenue >= MANUAL_RECOVERY_PROOF_THRESHOLD_CENTS && !data.notes?.trim()) {
    throw new Error(
      `Manual recovery of $${(data.realizedRevenue / 100).toFixed(2)} requires notes/proof. ` +
      `Please provide a description of the off-platform payment (e.g., POS receipt, cash payment reference).`
    );
  }
  const now = new Date();

  if (data.recoveryEventId) {
    // Update specific event
    await db
      .update(recoveryEvents)
      .set({
        status: "manual_realized",
        realizedRevenue: data.realizedRevenue,
        realizedAt: now,
        notes: data.notes || "Manually marked as recovered (off-platform payment)",
        updatedAt: now,
      })
      .where(
        and(
          eq(recoveryEvents.id, data.recoveryEventId),
          eq(recoveryEvents.tenantId, tenantId),
        )
      );
  } else {
    // Find the primary attributed event for this lead
    const [event] = await db
      .select()
      .from(recoveryEvents)
      .where(
        and(
          eq(recoveryEvents.tenantId, tenantId),
          eq(recoveryEvents.leadId, leadId),
          eq(recoveryEvents.isPrimaryAttribution, true),
          inArray(recoveryEvents.status, ["sent", "responded", "converted"]),
        )
      )
      .orderBy(desc(recoveryEvents.sentAt))
      .limit(1);

    if (event) {
      await db
        .update(recoveryEvents)
        .set({
          status: "manual_realized",
          realizedRevenue: data.realizedRevenue,
          realizedAt: now,
          notes: data.notes || "Manually marked as recovered (off-platform payment)",
          updatedAt: now,
        })
        .where(eq(recoveryEvents.id, event.id));
    } else {
      // No existing event — create one for manual tracking
      const trackingToken = generateTrackingToken(tenantId, leadId);
      await db.insert(recoveryEvents).values({
        tenantId,
        leadId,
        leakageType: "manual",
        trackingToken,
        status: "manual_realized",
        realizedRevenue: data.realizedRevenue,
        isPrimaryAttribution: true,
        notes: data.notes || "Manual recovery — no prior automation",
        sentAt: now,
        realizedAt: now,
      });
    }
  }

  logger.info("Manual recovery marked", { tenantId, leadId, realizedRevenue: data.realizedRevenue });
}

/**
 * Expire old recovery events that never converted (default: 30 days).
 */
export async function expireStaleRecoveryEvents(db: Db, tenantId: number, maxAgeDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

  const result = await db
    .update(recoveryEvents)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(
        eq(recoveryEvents.tenantId, tenantId),
        inArray(recoveryEvents.status, ["sent", "responded"]),
        lte(recoveryEvents.sentAt, cutoff),
      )
    );

  return (result as any)[0]?.affectedRows ?? 0;
}

// ─── Analytics Queries ───────────────────────────────────────────────────────

/**
 * Get attribution-accurate revenue metrics.
 * Separates estimated (booked) from realized (paid) revenue.
 */
export async function getAttributedRevenueMetrics(db: Db, tenantId: number) {
  const [metrics] = await db
    .select({
      totalSent: sql<number>`SUM(CASE WHEN status IN ('sent','responded','converted','realized','manual_realized') THEN 1 ELSE 0 END)`,
      totalConverted: sql<number>`SUM(CASE WHEN status IN ('converted','realized','manual_realized') AND isPrimaryAttribution = true THEN 1 ELSE 0 END)`,
      totalRealized: sql<number>`SUM(CASE WHEN status IN ('realized','manual_realized') AND isPrimaryAttribution = true THEN 1 ELSE 0 END)`,
      estimatedRevenue: sql<number>`SUM(CASE WHEN status IN ('converted','realized','manual_realized') AND isPrimaryAttribution = true THEN estimatedRevenue ELSE 0 END)`,
      realizedRevenue: sql<number>`SUM(CASE WHEN status IN ('realized','manual_realized') AND isPrimaryAttribution = true THEN realizedRevenue ELSE 0 END)`,
      totalFailed: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
      totalExpired: sql<number>`SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END)`,
    })
    .from(recoveryEvents)
    .where(eq(recoveryEvents.tenantId, tenantId));

  const sent = Number(metrics?.totalSent ?? 0);
  const converted = Number(metrics?.totalConverted ?? 0);
  const realized = Number(metrics?.totalRealized ?? 0);

  return {
    totalRecoveryAttempts: sent,
    totalConverted: converted,
    totalRealized: realized,
    conversionRate: sent > 0 ? (converted / sent) * 100 : 0,
    realizationRate: converted > 0 ? (realized / converted) * 100 : 0,
    estimatedRecoveredRevenue: Number(metrics?.estimatedRevenue ?? 0), // potential (booked)
    realizedRecoveredRevenue: Number(metrics?.realizedRevenue ?? 0),   // actual (paid)
    totalFailed: Number(metrics?.totalFailed ?? 0),
    totalExpired: Number(metrics?.totalExpired ?? 0),
  };
}

/**
 * Get per-automation attribution breakdown — which automations are driving real revenue.
 */
export async function getAutomationAttribution(db: Db, tenantId: number) {
  const rows = await db
    .select({
      automationId: recoveryEvents.automationId,
      automationName: automations.name,
      leakageType: recoveryEvents.leakageType,
      totalSent: sql<number>`COUNT(*)`,
      totalConverted: sql<number>`SUM(CASE WHEN ${recoveryEvents.status} IN ('converted','realized','manual_realized') AND ${recoveryEvents.isPrimaryAttribution} = true THEN 1 ELSE 0 END)`,
      totalRealized: sql<number>`SUM(CASE WHEN ${recoveryEvents.status} IN ('realized','manual_realized') AND ${recoveryEvents.isPrimaryAttribution} = true THEN 1 ELSE 0 END)`,
      estimatedRevenue: sql<number>`SUM(CASE WHEN ${recoveryEvents.isPrimaryAttribution} = true THEN ${recoveryEvents.estimatedRevenue} ELSE 0 END)`,
      realizedRevenue: sql<number>`SUM(CASE WHEN ${recoveryEvents.isPrimaryAttribution} = true THEN ${recoveryEvents.realizedRevenue} ELSE 0 END)`,
    })
    .from(recoveryEvents)
    .leftJoin(automations, eq(recoveryEvents.automationId, automations.id))
    .where(eq(recoveryEvents.tenantId, tenantId))
    .groupBy(recoveryEvents.automationId, automations.name, recoveryEvents.leakageType);

  return rows.map((r) => ({
    automationId: r.automationId,
    automationName: r.automationName || "Manual/Unknown",
    leakageType: r.leakageType,
    totalSent: Number(r.totalSent),
    totalConverted: Number(r.totalConverted),
    totalRealized: Number(r.totalRealized),
    conversionRate: Number(r.totalSent) > 0 ? (Number(r.totalConverted) / Number(r.totalSent)) * 100 : 0,
    estimatedRevenue: Number(r.estimatedRevenue),
    realizedRevenue: Number(r.realizedRevenue),
  }));
}

// ─── Revenue Recovery Ledger (Exportable Proof) ──────────────────────────────

export interface LedgerEntry {
  recoveryEventId: number;
  date: string;
  leadId: number;
  leadName: string | null;
  leakageType: string;
  automationName: string | null;
  trackingToken: string;
  status: string;
  estimatedRevenue: number;
  realizedRevenue: number;
  stripePaymentIntentId: string | null;
  stripeInvoiceId: string | null;
  notes: string | null;
  sentAt: string;
  convertedAt: string | null;
  realizedAt: string | null;
}

/**
 * Generate a bank-statement-reconcilable Revenue Recovery Ledger.
 * Filters by date range, includes only primary-attributed events.
 */
export async function getRecoveryLedger(
  db: Db,
  tenantId: number,
  options: {
    startDate?: Date;
    endDate?: Date;
    statusFilter?: string[];
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ entries: LedgerEntry[]; totals: { estimated: number; realized: number; count: number } }> {
  const conditions = [
    eq(recoveryEvents.tenantId, tenantId),
    eq(recoveryEvents.isPrimaryAttribution, true),
  ];

  if (options.startDate) {
    conditions.push(gte(recoveryEvents.sentAt, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(recoveryEvents.sentAt, options.endDate));
  }
  if (options.statusFilter && options.statusFilter.length > 0) {
    conditions.push(inArray(recoveryEvents.status, options.statusFilter as any));
  }

  const rows = await db
    .select({
      recoveryEventId: recoveryEvents.id,
      leadId: recoveryEvents.leadId,
      leadName: leads.name,
      leakageType: recoveryEvents.leakageType,
      automationName: automations.name,
      trackingToken: recoveryEvents.trackingToken,
      status: recoveryEvents.status,
      estimatedRevenue: recoveryEvents.estimatedRevenue,
      realizedRevenue: recoveryEvents.realizedRevenue,
      stripePaymentIntentId: recoveryEvents.stripePaymentIntentId,
      stripeInvoiceId: recoveryEvents.stripeInvoiceId,
      notes: recoveryEvents.notes,
      sentAt: recoveryEvents.sentAt,
      convertedAt: recoveryEvents.convertedAt,
      realizedAt: recoveryEvents.realizedAt,
    })
    .from(recoveryEvents)
    .leftJoin(leads, eq(recoveryEvents.leadId, leads.id))
    .leftJoin(automations, eq(recoveryEvents.automationId, automations.id))
    .where(and(...conditions))
    .orderBy(desc(recoveryEvents.sentAt))
    .limit(options.limit || 500)
    .offset(options.offset || 0);

  const entries: LedgerEntry[] = rows.map((r) => ({
    recoveryEventId: r.recoveryEventId,
    date: r.sentAt ? new Date(r.sentAt).toISOString().split("T")[0] : "",
    leadId: r.leadId,
    leadName: r.leadName,
    leakageType: r.leakageType,
    automationName: r.automationName,
    trackingToken: r.trackingToken,
    status: r.status,
    estimatedRevenue: r.estimatedRevenue / 100,
    realizedRevenue: r.realizedRevenue / 100,
    stripePaymentIntentId: r.stripePaymentIntentId,
    stripeInvoiceId: r.stripeInvoiceId,
    notes: r.notes,
    sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : "",
    convertedAt: r.convertedAt ? new Date(r.convertedAt).toISOString() : null,
    realizedAt: r.realizedAt ? new Date(r.realizedAt).toISOString() : null,
  }));

  const totals = entries.reduce(
    (acc, e) => ({
      estimated: acc.estimated + e.estimatedRevenue,
      realized: acc.realized + e.realizedRevenue,
      count: acc.count + 1,
    }),
    { estimated: 0, realized: 0, count: 0 }
  );

  return { entries, totals };
}

/**
 * Format ledger entries as CSV for export.
 */
export function ledgerToCSV(entries: LedgerEntry[]): string {
  const headers = [
    "Date",
    "Recovery Event ID",
    "Lead ID",
    "Lead Name",
    "Leakage Type",
    "Automation",
    "Tracking Token",
    "Status",
    "Estimated Revenue",
    "Realized Revenue",
    "Stripe Payment Intent",
    "Stripe Invoice",
    "Sent At",
    "Converted At",
    "Realized At",
    "Notes",
  ];

  const rows = entries.map((e) => [
    e.date,
    e.recoveryEventId,
    e.leadId,
    `"${(e.leadName || "").replace(/"/g, '""')}"`,
    e.leakageType,
    `"${(e.automationName || "").replace(/"/g, '""')}"`,
    e.trackingToken,
    e.status,
    `$${e.estimatedRevenue.toFixed(2)}`,
    `$${e.realizedRevenue.toFixed(2)}`,
    e.stripePaymentIntentId || "",
    e.stripeInvoiceId || "",
    e.sentAt,
    e.convertedAt || "",
    e.realizedAt || "",
    `"${(e.notes || "").replace(/"/g, '""')}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
