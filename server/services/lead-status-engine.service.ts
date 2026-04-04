/**
 * Lead Status Engine — Automatic status transitions + audit logging.
 *
 * Statuses self-update based on real activity (outbound SMS, inbound replies,
 * inactivity) but can always be overridden manually via the existing
 * LeadService.updateLeadStatus() path.
 */
import { eq, and } from "drizzle-orm";
import { leads, tenants, leadStatusLog } from "../../drizzle/schema";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";
import { emitEvent } from "./event-bus.service";

// ─── Transition Rules ──────────────────────────────────────────────────────

type LeadStatus = "new" | "contacted" | "qualified" | "booked" | "lost" | "unsubscribed";

/** Protected statuses that auto-transitions must never move a lead OUT of. */
const PROTECTED_STATUSES: ReadonlySet<LeadStatus> = new Set(["booked", "unsubscribed"]);

// ─── Tenant Settings Helper ────────────────────────────────────────────────

async function isAutoTransitionEnabled(db: Db, tenantId: number): Promise<boolean> {
  const [tenant] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant?.settings) return true; // default ON
  return tenant.settings.autoStatusTransitions !== false;
}

// ─── Audit Log ─────────────────────────────────────────────────────────────

export async function recordStatusChange(
  db: Db,
  tenantId: number,
  leadId: number,
  fromStatus: string,
  toStatus: string,
  trigger: string,
  triggeredBy: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await db.insert(leadStatusLog).values({
      tenantId,
      leadId,
      fromStatus,
      toStatus,
      trigger,
      triggeredBy,
      metadata: metadata ?? null,
    });
  } catch (err) {
    // Non-fatal — never block the primary operation because of logging
    logger.error("Failed to record status change", { tenantId, leadId, fromStatus, toStatus, error: String(err) });
  }
}

// ─── Auto-Transition: Outbound SMS Sent ────────────────────────────────────

/**
 * Called after an outbound SMS is successfully recorded.
 * Transitions:  new → contacted
 */
export async function autoTransitionOnOutbound(db: Db, tenantId: number, leadId: number) {
  if (!(await isAutoTransitionEnabled(db, tenantId))) return;

  const [lead] = await db
    .select({ status: leads.status })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .limit(1);

  if (!lead || lead.status !== "new") return;

  await db
    .update(leads)
    .set({ status: "contacted" as any, updatedAt: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

  await recordStatusChange(db, tenantId, leadId, "new", "contacted", "outbound_sms", "system");

  await emitEvent({
    type: "lead.status_changed",
    tenantId,
    data: { leadId, fromStatus: "new", toStatus: "contacted", trigger: "outbound_sms" },
    timestamp: new Date(),
  }).catch(() => {});

  logger.info("Auto-transition: new → contacted (outbound SMS)", { tenantId, leadId });
}

// ─── Auto-Transition: Inbound SMS Received ─────────────────────────────────

/**
 * Called after a non-STOP/HELP inbound SMS is recorded.
 * Transitions:
 *   new / contacted → qualified   (lead engaged)
 *   lost → contacted              (re-engagement)
 */
export async function autoTransitionOnInbound(db: Db, tenantId: number, leadId: number) {
  if (!(await isAutoTransitionEnabled(db, tenantId))) return;

  const [lead] = await db
    .select({ status: leads.status })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .limit(1);

  if (!lead) return;

  const currentStatus = lead.status as LeadStatus;

  // Don't auto-transition out of protected statuses
  if (PROTECTED_STATUSES.has(currentStatus)) return;

  let newStatus: LeadStatus | null = null;
  let eventType: string | null = null;

  if (currentStatus === "new" || currentStatus === "contacted") {
    newStatus = "qualified";
    eventType = "lead.auto_qualified";
  } else if (currentStatus === "lost") {
    newStatus = "contacted";
    eventType = "lead.re_engaged";
  }

  if (!newStatus || !eventType) return;

  await db
    .update(leads)
    .set({ status: newStatus as any, updatedAt: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

  await recordStatusChange(db, tenantId, leadId, currentStatus, newStatus, "inbound_sms", "system");

  await emitEvent({
    type: eventType as any,
    tenantId,
    data: { leadId, fromStatus: currentStatus, toStatus: newStatus, trigger: "inbound_sms" },
    timestamp: new Date(),
  }).catch(() => {});

  logger.info(`Auto-transition: ${currentStatus} → ${newStatus} (inbound SMS)`, { tenantId, leadId });
}

// ─── Auto-Transition: Stale Lead (called by worker) ────────────────────────

/**
 * Called by detectStaleLeads() in worker.ts.
 * Optionally transitions stale leads to "lost" if tenant has opted in.
 */
export async function autoTransitionStale(
  db: Db,
  tenantId: number,
  leadId: number,
  currentStatus: string,
  autoArchive: boolean,
) {
  if (autoArchive) {
    await db
      .update(leads)
      .set({ status: "lost" as any, updatedAt: new Date() })
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));

    await recordStatusChange(db, tenantId, leadId, currentStatus, "lost", "worker_stale", "worker");

    logger.info(`Auto-transition: ${currentStatus} → lost (stale ${autoArchive ? "archived" : "detected"})`, { tenantId, leadId });
  }

  await emitEvent({
    type: "lead.stale_detected",
    tenantId,
    data: { leadId, previousStatus: currentStatus, archived: autoArchive },
    timestamp: new Date(),
  }).catch(() => {});
}
