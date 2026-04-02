import { eq, and, gte, lte, desc, sql, ne, isNull, or, lt } from "drizzle-orm";
import {
  waitingListEntries,
  waitlistOffers,
  calendarEvents,
  leads,
  messages,
  tenants,
} from "../../drizzle/schema";
import type { Db } from "../_core/context";
import { sendSMS } from "../_core/sms";
import { logger } from "../_core/logger";
import * as LeadService from "./lead.service";
import { decrypt } from "../_core/crypto";

// ─── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_RESPONSE_MINUTES = 30;
const DEFAULT_MAX_OFFERS = 5;

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

// ─── Priority Calculation ───────────────────────────────────────────────────────

function calculatePriority(
  visitCount: number,
  loyaltyTier: string | null | undefined,
): number {
  let priority = 0;

  // Visit-based priority (0-50 range)
  if (visitCount >= 20) priority += 50;
  else if (visitCount >= 10) priority += 40;
  else if (visitCount >= 5) priority += 30;
  else if (visitCount >= 2) priority += 20;
  else priority += 10;

  // Loyalty tier bonus (0-40 range)
  switch (loyaltyTier) {
    case "platinum":
      priority += 40;
      break;
    case "gold":
      priority += 30;
      break;
    case "silver":
      priority += 20;
      break;
    case "bronze":
      priority += 10;
      break;
  }

  return priority;
}

// ─── Tenant Config Helpers ──────────────────────────────────────────────────────

interface WaitlistConfig {
  enabled: boolean;
  maxOffers: number;
  responseMinutes: number;
}

async function getWaitlistConfig(
  db: Db,
  tenantId: number,
): Promise<WaitlistConfig> {
  const [tenant] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const cfg = (tenant?.settings as Record<string, any>)?.waitlistAutoFill;
  return {
    enabled: cfg?.enabled ?? true,
    maxOffers: cfg?.maxOffers ?? DEFAULT_MAX_OFFERS,
    responseMinutes: cfg?.responseMinutes ?? DEFAULT_RESPONSE_MINUTES,
  };
}

// ─── Format helpers ─────────────────────────────────────────────────────────────

function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mStr} ${suffix}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Core Service Functions ─────────────────────────────────────────────────────

/**
 * Add a lead to the waiting list with auto-calculated priority.
 */
export async function addToWaitlist(
  db: Db,
  tenantId: number,
  leadId: number,
  preferences: {
    preferredDay?: string;
    preferredTimeStart?: string;
    preferredTimeEnd?: string;
    serviceType?: string;
    notes?: string;
  },
) {
  // Fetch lead to calculate priority
  const lead = await LeadService.getLeadById(db, tenantId, leadId);
  if (!lead) {
    throw new Error("Lead not found");
  }

  const priority = calculatePriority(lead.visitCount, lead.loyaltyTier);

  const [result] = await db.insert(waitingListEntries).values({
    tenantId,
    leadId,
    preferredDay: preferences.preferredDay?.toLowerCase() || null,
    preferredTimeStart: preferences.preferredTimeStart || null,
    preferredTimeEnd: preferences.preferredTimeEnd || null,
    serviceType: preferences.serviceType || null,
    priority,
    status: "active",
    notes: preferences.notes || null,
  });

  const entryId = result.insertId;

  logger.info("Waitlist entry added", {
    tenantId,
    leadId,
    entryId,
    priority,
  });

  const [entry] = await db
    .select()
    .from(waitingListEntries)
    .where(eq(waitingListEntries.id, entryId))
    .limit(1);

  return entry;
}

/**
 * Remove a lead from the waiting list.
 */
export async function removeFromWaitlist(
  db: Db,
  tenantId: number,
  entryId: number,
) {
  await db
    .update(waitingListEntries)
    .set({ status: "removed", updatedAt: new Date() })
    .where(
      and(
        eq(waitingListEntries.id, entryId),
        eq(waitingListEntries.tenantId, tenantId),
      ),
    );

  logger.info("Waitlist entry removed", { tenantId, entryId });
}

/**
 * Core auto-fill: called when an appointment is cancelled.
 * Finds matching waitlist entries and sends slot-offer SMS messages.
 */
export async function handleCancellation(
  db: Db,
  tenantId: number,
  cancelledEvent: { id: number; startTime: Date; endTime: Date },
) {
  const config = await getWaitlistConfig(db, tenantId);
  if (!config.enabled) {
    logger.info("Waitlist auto-fill disabled for tenant", { tenantId });
    return 0;
  }

  // Extract day-of-week and time from the cancelled slot
  const dayOfWeek = DAY_NAMES[cancelledEvent.startTime.getDay()];
  const hours = cancelledEvent.startTime
    .getHours()
    .toString()
    .padStart(2, "0");
  const minutes = cancelledEvent.startTime
    .getMinutes()
    .toString()
    .padStart(2, "0");
  const slotTime = `${hours}:${minutes}`;

  // Find matching active waitlist entries
  const matchingEntries = await db
    .select({
      entry: waitingListEntries,
      leadPhone: leads.phone,
      leadName: leads.name,
    })
    .from(waitingListEntries)
    .innerJoin(leads, eq(waitingListEntries.leadId, leads.id))
    .where(
      and(
        eq(waitingListEntries.tenantId, tenantId),
        eq(waitingListEntries.status, "active"),
        or(
          isNull(waitingListEntries.preferredDay),
          eq(waitingListEntries.preferredDay, dayOfWeek),
        ),
        or(
          isNull(waitingListEntries.preferredTimeStart),
          lte(waitingListEntries.preferredTimeStart, slotTime),
        ),
        or(
          isNull(waitingListEntries.preferredTimeEnd),
          gte(waitingListEntries.preferredTimeEnd, slotTime),
        ),
      ),
    )
    .orderBy(desc(waitingListEntries.priority), waitingListEntries.createdAt)
    .limit(config.maxOffers);

  if (matchingEntries.length === 0) {
    logger.info("No matching waitlist entries for cancelled slot", {
      tenantId,
      cancelledEventId: cancelledEvent.id,
      dayOfWeek,
      slotTime,
    });
    return 0;
  }

  const responseDeadline = new Date(
    Date.now() + config.responseMinutes * 60_000,
  );
  const formattedTime = formatTime12h(slotTime);
  const formattedDay = capitalize(dayOfWeek);
  let offersSent = 0;

  for (const row of matchingEntries) {
    try {
      // Update entry status to offered
      await db
        .update(waitingListEntries)
        .set({ status: "offered", updatedAt: new Date() })
        .where(eq(waitingListEntries.id, row.entry.id));

      // Decrypt lead info
      const phone = row.leadPhone ? decrypt(row.leadPhone) : null;
      const name = row.leadName ? decrypt(row.leadName) : "there";

      if (!phone) {
        logger.warn("Waitlist lead has no phone number", {
          tenantId,
          leadId: row.entry.leadId,
        });
        continue;
      }

      // Send SMS offer
      const smsBody = `${name}, a ${formattedTime} slot just opened on ${formattedDay}! Want it? Reply YES within ${config.responseMinutes} min.`;

      const smsResult = await sendSMS(phone, smsBody, undefined, tenantId);

      // Create message record
      await LeadService.createMessage(db, {
        tenantId,
        leadId: row.entry.leadId,
        direction: "outbound",
        body: smsBody,
        status: smsResult.success ? "sent" : "failed",
        twilioSid: smsResult.sid,
        toNumber: phone,
      });

      // Insert waitlist offer
      await db.insert(waitlistOffers).values({
        tenantId,
        waitlistEntryId: row.entry.id,
        leadId: row.entry.leadId,
        cancelledEventId: cancelledEvent.id,
        slotStart: cancelledEvent.startTime,
        slotEnd: cancelledEvent.endTime,
        status: "sent",
        responseDeadline,
      });

      offersSent++;

      logger.info("Waitlist offer sent", {
        tenantId,
        leadId: row.entry.leadId,
        entryId: row.entry.id,
        cancelledEventId: cancelledEvent.id,
      });
    } catch (err) {
      logger.error("Failed to send waitlist offer", {
        tenantId,
        entryId: row.entry.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("Waitlist auto-fill completed", {
    tenantId,
    cancelledEventId: cancelledEvent.id,
    offersSent,
    matchesFound: matchingEntries.length,
  });

  return offersSent;
}

/**
 * Handle a YES/NO reply from a lead regarding a waitlist offer.
 */
export async function handleWaitlistReply(
  db: Db,
  tenantId: number,
  leadId: number,
  isAccept: boolean,
) {
  const now = new Date();

  // Find the active (sent, not expired) offer for this lead
  const [activeOffer] = await db
    .select()
    .from(waitlistOffers)
    .where(
      and(
        eq(waitlistOffers.tenantId, tenantId),
        eq(waitlistOffers.leadId, leadId),
        eq(waitlistOffers.status, "sent"),
        gte(waitlistOffers.responseDeadline, now),
      ),
    )
    .orderBy(desc(waitlistOffers.createdAt))
    .limit(1);

  if (!activeOffer) {
    logger.info("No active waitlist offer found for lead reply", {
      tenantId,
      leadId,
      isAccept,
    });
    return null;
  }

  // Get lead phone for SMS responses
  const lead = await LeadService.getLeadById(db, tenantId, leadId);
  const phone = lead?.phone ?? null;

  if (isAccept) {
    // Check if any other offer for the same cancelled event was already accepted
    const [alreadyAccepted] = await db
      .select({ id: waitlistOffers.id })
      .from(waitlistOffers)
      .where(
        and(
          eq(waitlistOffers.tenantId, tenantId),
          eq(
            waitlistOffers.cancelledEventId,
            activeOffer.cancelledEventId!,
          ),
          eq(waitlistOffers.status, "accepted"),
        ),
      )
      .limit(1);

    if (alreadyAccepted) {
      // Slot already taken
      await db
        .update(waitlistOffers)
        .set({ status: "slot_filled", respondedAt: now })
        .where(eq(waitlistOffers.id, activeOffer.id));

      // Revert entry to active so they can get future offers
      await db
        .update(waitingListEntries)
        .set({ status: "active", updatedAt: now })
        .where(eq(waitingListEntries.id, activeOffer.waitlistEntryId));

      if (phone) {
        const body =
          "Sorry, that slot was just filled! You're still on the waiting list and we'll let you know when the next one opens up.";
        await sendSMS(phone, body, undefined, tenantId);
        await LeadService.createMessage(db, {
          tenantId,
          leadId,
          direction: "outbound",
          body,
          toNumber: phone,
        });
      }

      logger.info("Waitlist offer slot already filled", {
        tenantId,
        leadId,
        offerId: activeOffer.id,
      });

      return { ...activeOffer, status: "slot_filled" as const };
    }

    // Accept the offer
    await db
      .update(waitlistOffers)
      .set({ status: "accepted", respondedAt: now })
      .where(eq(waitlistOffers.id, activeOffer.id));

    // Mark the waitlist entry as booked
    await db
      .update(waitingListEntries)
      .set({ status: "booked", updatedAt: now })
      .where(eq(waitingListEntries.id, activeOffer.waitlistEntryId));

    // Mark all other offers for the same cancelled event as slot_filled
    await db
      .update(waitlistOffers)
      .set({ status: "slot_filled" })
      .where(
        and(
          eq(waitlistOffers.tenantId, tenantId),
          eq(
            waitlistOffers.cancelledEventId,
            activeOffer.cancelledEventId!,
          ),
          ne(waitlistOffers.id, activeOffer.id),
          eq(waitlistOffers.status, "sent"),
        ),
      );

    // Revert entries for those slot_filled offers back to active
    const slotFilledOffers = await db
      .select({ waitlistEntryId: waitlistOffers.waitlistEntryId })
      .from(waitlistOffers)
      .where(
        and(
          eq(waitlistOffers.tenantId, tenantId),
          eq(
            waitlistOffers.cancelledEventId,
            activeOffer.cancelledEventId!,
          ),
          ne(waitlistOffers.id, activeOffer.id),
          eq(waitlistOffers.status, "slot_filled"),
        ),
      );

    for (const o of slotFilledOffers) {
      await db
        .update(waitingListEntries)
        .set({ status: "active", updatedAt: now })
        .where(eq(waitingListEntries.id, o.waitlistEntryId));
    }

    // Send confirmation SMS
    if (phone) {
      const slotTime = formatTime12h(
        `${activeOffer.slotStart.getHours().toString().padStart(2, "0")}:${activeOffer.slotStart.getMinutes().toString().padStart(2, "0")}`,
      );
      const slotDay = capitalize(
        DAY_NAMES[activeOffer.slotStart.getDay()],
      );
      const body = `You're booked for ${slotTime} on ${slotDay}! See you then.`;
      await sendSMS(phone, body, undefined, tenantId);
      await LeadService.createMessage(db, {
        tenantId,
        leadId,
        direction: "outbound",
        body,
        toNumber: phone,
      });
    }

    logger.info("Waitlist offer accepted", {
      tenantId,
      leadId,
      offerId: activeOffer.id,
    });

    return { ...activeOffer, status: "accepted" as const };
  }

  // Decline the offer
  await db
    .update(waitlistOffers)
    .set({ status: "declined", respondedAt: now })
    .where(eq(waitlistOffers.id, activeOffer.id));

  // Return entry to active
  await db
    .update(waitingListEntries)
    .set({ status: "active", updatedAt: now })
    .where(eq(waitingListEntries.id, activeOffer.waitlistEntryId));

  if (phone) {
    const body = "No problem! You're still on the waiting list.";
    await sendSMS(phone, body, undefined, tenantId);
    await LeadService.createMessage(db, {
      tenantId,
      leadId,
      direction: "outbound",
      body,
      toNumber: phone,
    });
  }

  logger.info("Waitlist offer declined", {
    tenantId,
    leadId,
    offerId: activeOffer.id,
  });

  return { ...activeOffer, status: "declined" as const };
}

/**
 * Expire stale offers whose response deadline has passed.
 * Called periodically from a background worker.
 */
export async function expireStaleOffers(db: Db) {
  const now = new Date();

  // Find all expired offers
  const staleOffers = await db
    .select({
      id: waitlistOffers.id,
      waitlistEntryId: waitlistOffers.waitlistEntryId,
      tenantId: waitlistOffers.tenantId,
    })
    .from(waitlistOffers)
    .where(
      and(
        eq(waitlistOffers.status, "sent"),
        lt(waitlistOffers.responseDeadline, now),
      ),
    );

  if (staleOffers.length === 0) return 0;

  for (const offer of staleOffers) {
    await db
      .update(waitlistOffers)
      .set({ status: "expired" })
      .where(eq(waitlistOffers.id, offer.id));

    // Return the waitlist entry to active
    await db
      .update(waitingListEntries)
      .set({ status: "active", updatedAt: now })
      .where(eq(waitingListEntries.id, offer.waitlistEntryId));
  }

  logger.info("Expired stale waitlist offers", {
    count: staleOffers.length,
  });

  return staleOffers.length;
}

/**
 * Aggregated waitlist metrics for a tenant.
 */
export async function getWaitlistMetrics(db: Db, tenantId: number) {
  // Active entries count
  const [activeRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(waitingListEntries)
    .where(
      and(
        eq(waitingListEntries.tenantId, tenantId),
        eq(waitingListEntries.status, "active"),
      ),
    );

  // Offer counts by status
  const offerStats = await db
    .select({
      status: waitlistOffers.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(waitlistOffers)
    .where(eq(waitlistOffers.tenantId, tenantId))
    .groupBy(waitlistOffers.status);

  const statusCounts: Record<string, number> = {};
  let totalOffersSent = 0;
  for (const row of offerStats) {
    statusCounts[row.status] = row.count;
    totalOffersSent += row.count;
  }

  const acceptedCount = statusCounts["accepted"] ?? 0;
  const declinedCount = statusCounts["declined"] ?? 0;
  const expiredCount = statusCounts["expired"] ?? 0;
  const sentCount = statusCounts["sent"] ?? 0;
  const slotFilledCount = statusCounts["slot_filled"] ?? 0;

  const fillRate =
    totalOffersSent > 0
      ? Math.round((acceptedCount / totalOffersSent) * 10000) / 100
      : 0;

  return {
    activeEntries: activeRow?.count ?? 0,
    totalOffersSent,
    sentCount,
    acceptedCount,
    declinedCount,
    expiredCount,
    slotFilledCount,
    fillRate,
  };
}

/**
 * Paginated list of waitlist entries for a tenant.
 */
export async function listWaitlistEntries(
  db: Db,
  tenantId: number,
  opts: { status?: string; limit?: number; offset?: number } = {},
) {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const conditions = [eq(waitingListEntries.tenantId, tenantId)];
  if (opts.status) {
    conditions.push(eq(waitingListEntries.status, opts.status as any));
  }

  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(waitingListEntries)
    .where(and(...conditions));

  const rows = await db
    .select({
      entry: waitingListEntries,
      leadName: leads.name,
      leadPhone: leads.phone,
    })
    .from(waitingListEntries)
    .innerJoin(leads, eq(waitingListEntries.leadId, leads.id))
    .where(and(...conditions))
    .orderBy(desc(waitingListEntries.priority), waitingListEntries.createdAt)
    .limit(limit)
    .offset(offset);

  return {
    entries: rows.map((r) => ({
      ...r.entry,
      leadName: r.leadName ? decrypt(r.leadName) : null,
      leadPhone: r.leadPhone ? decrypt(r.leadPhone) : null,
    })),
    total: countRow?.count ?? 0,
  };
}

/**
 * Paginated list of waitlist offers for a tenant.
 */
export async function listWaitlistOffers(
  db: Db,
  tenantId: number,
  opts: { status?: string; limit?: number; offset?: number } = {},
) {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const conditions = [eq(waitlistOffers.tenantId, tenantId)];
  if (opts.status) {
    conditions.push(eq(waitlistOffers.status, opts.status as any));
  }

  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(waitlistOffers)
    .where(and(...conditions));

  const rows = await db
    .select({
      offer: waitlistOffers,
      leadName: leads.name,
    })
    .from(waitlistOffers)
    .innerJoin(leads, eq(waitlistOffers.leadId, leads.id))
    .where(and(...conditions))
    .orderBy(desc(waitlistOffers.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    offers: rows.map((r) => ({
      ...r.offer,
      leadName: r.leadName ? decrypt(r.leadName) : null,
    })),
    total: countRow?.count ?? 0,
  };
}
