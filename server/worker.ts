/**
 * Rebookd Automation Worker
 * Runs as a separate process: `npx tsx server/worker.ts`
 * Checks every minute for automations that need to fire.
 *
 * Handles:
 *  - new_lead_welcome        → fires immediately on lead creation (via DB poll)
 *  - lead_follow_up_3d/7d    → fires N days after lead.createdAt if not booked
 *  - appointment_reminder_*  → fires N hours before lead.appointmentAt
 *  - no_show_follow_up       → fires N minutes after appointmentAt if still not marked booked
 *  - no_show_rebooking       → fires N days after appointmentAt if not rebooked
 *  - cancellation_*          → fires when lead status becomes "lost" (manual trigger via router)
 *  - win_back_30d/90d        → fires N days after lead.lastMessageAt with no booking
 *  - post_appointment_*      → fires N hours after appointmentAt if status is "booked"
 *  - birthday_promo          → not yet implemented (requires birthday field)
 *  - loyalty_milestone       → not yet implemented (requires visit count)
 */

import "dotenv/config";
import { and, eq, isNotNull, lt, gt, sql } from "drizzle-orm";
import { getDb, getAutomationsByTenantId } from "./db";
import { tenants, subscriptions } from "../drizzle/schema";
import { leads, automations, messages, plans } from "../drizzle/schema";
import { sendSMS, resolveTemplate } from "./_core/sms";
import { getPhoneNumbersByTenantId } from "./db";

const POLL_INTERVAL_MS = 60_000; // 1 minute

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

// Check if we already sent this automation to this lead (prevent duplicates)
async function alreadySent(tenantId: number, leadId: number, automationId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const existing = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.leadId, leadId),
        eq(messages.automationId, automationId)
      )
    )
    .limit(1);
  return existing.length > 0;
}

// Fire a single automation for a lead
async function fireAutomation(
  tenantId: number,
  leadId: number,
  leadPhone: string,
  leadName: string | null,
  automationId: number,
  messageBody: string,
  fromNumber: string | undefined
) {
  const db = await getDb();
  if (!db) return;

  const vars: Record<string, string> = {
    name: leadName || "there",
    phone: fromNumber || "",
  };

  const resolved = resolveTemplate(messageBody, vars);
  const smsResult = await sendSMS(leadPhone, resolved, fromNumber, tenantId);

  // Log message
  await db.insert(messages).values({
    tenantId,
    leadId,
    direction: "outbound",
    body: resolved,
    fromNumber: fromNumber,
    toNumber: leadPhone,
    twilioSid: smsResult.sid,
    status: smsResult.success ? "sent" : "failed",
    automationId,
  });

  // Increment runCount
  await db
    .update(automations)
    .set({
      runCount: sql`${automations.runCount} + 1`,
      lastRunAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(automations.id, automationId));

  console.log(
    `[Worker] Fired automation #${automationId} → lead #${leadId} (${leadPhone}) — ${smsResult.success ? "sent" : "FAILED: " + smsResult.error}`
  );
}

// Get default message from automation actions array
function getActionMessage(auto: any): string | null {
  const actions = auto.actions as Array<{ type: string; body: string }> | null;
  if (!actions || actions.length === 0) return null;
  return actions.find((a) => a.type === "send_message")?.body ?? null;
}

// Get config value
function cfg(auto: any, key: string, fallback: number): number {
  const v = (auto.triggerConfig as Record<string, unknown> | null)?.[key];
  return typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) || fallback : fallback;
}

// ─── Main worker loop ─────────────────────────────────────────────────────────

async function runCycle() {
  const db = await getDb();
  if (!db) {
    console.warn("[Worker] DB not available, skipping cycle");
    return;
  }

  // Trial reminder pipeline
  const now = new Date();
  const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const expiringTrials = await db
    .select({ sub: subscriptions, tenant: tenants })
    .from(subscriptions)
    .innerJoin(tenants, eq(subscriptions.tenantId, tenants.id))
    .where(
      and(
        eq(subscriptions.status, "trialing"),
        isNotNull(subscriptions.trialEndsAt),
        lt(subscriptions.trialEndsAt, threeDays),
        gt(subscriptions.trialEndsAt, now),
        eq(subscriptions.trialReminderSent, false)
      )
    );

  if (expiringTrials.length > 0) {
    const { sendEmail } = await import("./_core/email");
    const { getPrimaryUserEmailByTenant } = await import("./db");
    for (const row of expiringTrials) {
      const tenantId = row.sub.tenantId;
      const userEmail = await getPrimaryUserEmailByTenant(tenantId);
      if (!userEmail) continue;
      await sendEmail({
        to: userEmail,
        subject: "Rebookd Trial Ending Soon",
        text: `Your Rebookd trial ends on ${new Date(row.sub.trialEndsAt).toLocaleDateString()}. Please upgrade to avoid interruption.`,
      });
      await db
        .update(subscriptions)
        .set({ trialReminderSent: true, updatedAt: new Date() })
        .where(eq(subscriptions.id, row.sub.id));
    }
  }

  // Get all enabled automations grouped by tenant
  const enabledAutomations = await db
    .select()
    .from(automations)
    .where(eq(automations.enabled, true));

  if (enabledAutomations.length === 0) return;

  // Group by tenant
  const byTenant: Record<number, typeof enabledAutomations> = {};
  for (const auto of enabledAutomations) {
    if (!byTenant[auto.tenantId]) byTenant[auto.tenantId] = [];
    byTenant[auto.tenantId].push(auto);
  }

  for (const [tenantIdStr, tenantAutomations] of Object.entries(byTenant)) {
    const tenantId = parseInt(tenantIdStr);

    // Get from number and tenant name for this tenant
    const [phones, tenantRow] = await Promise.all([
      getPhoneNumbersByTenantId(tenantId),
      db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tenantId)).limit(1),
    ]);
    const fromNumber = phones.find((p: any) => p.isDefault)?.number || phones[0]?.number;
    const tenantName = tenantRow[0]?.name || "";

    for (const auto of tenantAutomations) {
      const msgBody = getActionMessage(auto);
      if (!msgBody) continue; // no message configured yet

      try {
        await processAutomation(db, tenantId, auto, msgBody, fromNumber);
      } catch (err) {
        console.error(`[Worker] Error processing automation #${auto.id}:`, err);
      }
    }
  }
}

async function processAutomation(db: any, tenantId: number, auto: any, msgBody: string, fromNumber: string | undefined) {
  const key = auto.key as string;

  // ── New lead welcome ────────────────────────────────────────────────────────
  if (key === "new_lead_welcome") {
    // Find leads created in the last 2 minutes that haven't been welcomed
    const newLeads = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          gt(leads.createdAt, minutesAgo(2)),
        )
      );
    for (const lead of newLeads) {
      if (await alreadySent(tenantId, lead.id, auto.id)) continue;
      await fireAutomation(tenantId, lead.id, lead.phone, lead.name, auto.id, msgBody, fromNumber);
    }
  }

  // ── Lead follow-up 3 days ───────────────────────────────────────────────────
  if (key === "lead_follow_up_3d") {
    const delayDays = cfg(auto, "delayDays", 3);
    const target = daysAgo(delayDays);
    const window = daysAgo(delayDays + 1); // 1-day window
    const staleLeads = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          lt(leads.createdAt, target),
          gt(leads.createdAt, window),
          sql`${leads.status} NOT IN ('booked', 'lost', 'unsubscribed')`
        )
      );
    for (const lead of staleLeads) {
      if (await alreadySent(tenantId, lead.id, auto.id)) continue;
      await fireAutomation(tenantId, lead.id, lead.phone, lead.name, auto.id, msgBody, fromNumber);
    }
  }

  // ── Lead follow-up 7 days ───────────────────────────────────────────────────
  if (key === "lead_follow_up_7d") {
    const delayDays = cfg(auto, "delayDays", 7);
    const target = daysAgo(delayDays);
    const window = daysAgo(delayDays + 1);
    const staleLeads = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          lt(leads.createdAt, target),
          gt(leads.createdAt, window),
          sql`${leads.status} NOT IN ('booked', 'lost', 'unsubscribed')`
        )
      );
    for (const lead of staleLeads) {
      if (await alreadySent(tenantId, lead.id, auto.id)) continue;
      await fireAutomation(tenantId, lead.id, lead.phone, lead.name, auto.id, msgBody, fromNumber);
    }
  }

  // ── 24-hour appointment reminder ────────────────────────────────────────────
  if (key === "appointment_reminder_24h") {
    const delayHours = cfg(auto, "delayHours", 24);
    // Find leads whose appointment is ~delayHours from now (within a 1-min window)
    const windowStart = new Date(Date.now() + (delayHours * 60 - 1) * 60 * 1000);
    const windowEnd   = new Date(Date.now() + (delayHours * 60 + 1) * 60 * 1000);
    const upcoming = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          isNotNull(leads.appointmentAt),
          gt(leads.appointmentAt, windowStart),
          lt(leads.appointmentAt, windowEnd),
          sql`${leads.status} NOT IN ('lost', 'unsubscribed')`
        )
      );
    for (const lead of upcoming) {
      if (await alreadySent(tenantId, lead.id, auto.id)) continue;
      const apptTime = new Date(lead.appointmentAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const apptDate = new Date(lead.appointmentAt!).toLocaleDateString();
      const body = msgBody.replace("{{time}}", apptTime).replace("{{date}}", apptDate);
      await fireAutomation(tenantId, lead.id, lead.phone, lead.name, auto.id, body, fromNumber, tenantName);
    }
  }

  // ── 2-hour appointment reminder ─────────────────────────────────────────────
  if (key === "appointment_reminder_2h") {
    const delayHours = cfg(auto, "delayHours", 2);
    const windowStart = new Date(Date.now() + (delayHours * 60 - 1) * 60 * 1000);
    const windowEnd   = new Date(Date.now() + (delayHours * 60 + 1) * 60 * 1000);
    const upcoming = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          isNotNull(leads.appointmentAt),
          gt(leads.appointmentAt, windowStart),
          lt(leads.appointmentAt, windowEnd),
          sql`${leads.status} NOT IN ('lost', 'unsubscribed')`
        )
      );
    for (const lead of upcoming) {
      if (await alreadySent(tenantId, lead.id, auto.id)) continue;
      const apptTime = new Date(lead.appointmentAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const body = msgBody.replace("{{time}}", apptTime);
      await fireAutomation(tenantId, lead.id, lead.phone, lead.name, auto.id, body, fromNumber, tenantName);
    }
  }

  // ── No-show follow-up ───────────────────────────────────────────────────────
  if (key === "no_show_follow_up") {
    const delayMinutes = cfg(auto, "delayMinutes", 60);
    // Leads whose appointment was delayMinutes ago and status is still not booked/lost
    const windowStart = minutesAgo(delayMinutes + 1);
    const windowEnd   = minutesAgo(delayMinutes - 1);
    const noShows = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          isNotNull(leads.appointmentAt),
          gt(leads.appointmentAt, windowStart),
          lt(leads.appointmentAt, windowEnd),
          sql`${leads.status} NOT IN ('booked', 'unsubscribed')`
        )
      );
    for (const lead of noShows) {
      if (await alreadySent(tenantId, lead.id, auto.id)) continue;
      await fireAutomation(tenantId, lead.id, lead.phone, lead.name, auto.id, msgBody, fromNumber);
    }
  }

  // ── No-show rebooking (3 days after missed appointment) ────────────────────
  if (key === "no_show_rebooking") {
    const delayDays = cfg(auto, "delayDays", 3);
    const target    = daysAgo(delayDays);
    const window    = daysAgo(delayDays + 1);
    const noShows = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          isNotNull(leads.appointmentAt),
          lt(leads.appointmentAt, target),
          gt(leads.appointmentAt, window),
          sql`${leads.status} NOT IN ('booked', 'unsubscribed')`
        )
      );
    for (const lead of noShows) {
      if (await alreadySent(tenantId, lead.id, auto.id)) continue;
      await fireAutomation(tenantId, lead.id, lead.phone, lead.name, auto.id, msgBody, fromNumber);
    }
  }

  // ── Post-appointment feedback / upsell ──────────────────────────────────────
  if (key === "post_appointment_feedback" || key === "post_appointment_upsell") {
    const delayHours = cfg(auto, "delayHours", 2);
    const target     = hoursAgo(delayHours);
    const window     = hoursAgo(delayHours + 1);
    const completed = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          isNotNull(leads.appointmentAt),
          lt(leads.appointmentAt, target),
          gt(leads.appointmentAt, window),
          eq(leads.status, "booked")
        )
      );
    for (const lead of completed) {
      if (await alreadySent(tenantId, lead.id, auto.id)) continue;
      await fireAutomation(tenantId, lead.id, lead.phone, lead.name, auto.id, msgBody, fromNumber);
    }
  }

  // ── 30-day win-back ─────────────────────────────────────────────────────────
  if (key === "win_back_30d") {
    const delayDays = cfg(auto, "delayDays", 30);
    const target    = daysAgo(delayDays);
    const window    = daysAgo(delayDays + 1);
    const lapsed = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          isNotNull(leads.lastMessageAt),
          lt(leads.lastMessageAt, target),
          gt(leads.lastMessageAt, window),
          sql`${leads.status} NOT IN ('lost', 'unsubscribed')`
        )
      );
    for (const lead of lapsed) {
      if (await alreadySent(tenantId, lead.id, auto.id)) continue;
      await fireAutomation(tenantId, lead.id, lead.phone, lead.name, auto.id, msgBody, fromNumber);
    }
  }

  // ── 90-day win-back ─────────────────────────────────────────────────────────
  if (key === "win_back_90d") {
    const delayDays = cfg(auto, "delayDays", 90);
    const target    = daysAgo(delayDays);
    const window    = daysAgo(delayDays + 1);
    const lapsed = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          isNotNull(leads.lastMessageAt),
          lt(leads.lastMessageAt, target),
          gt(leads.lastMessageAt, window),
          sql`${leads.status} NOT IN ('lost', 'unsubscribed')`
        )
      );
    for (const lead of lapsed) {
      if (await alreadySent(tenantId, lead.id, auto.id)) continue;
      await fireAutomation(tenantId, lead.id, lead.phone, lead.name, auto.id, msgBody, fromNumber);
    }
  }

  // ── Cancellation acknowledgement ────────────────────────────────────────────
  // Fired via router when status changes to "lost" — see routers.ts cancellation trigger
  // The worker handles the delayed rebooking follow-up

  // ── Post-cancellation rebook (48h after status set to lost) ────────────────
  if (key === "cancellation_rebooking") {
    const delayHours = cfg(auto, "delayHours", 48);
    const target     = hoursAgo(delayHours);
    const window     = hoursAgo(delayHours + 1);
    const cancelled = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          eq(leads.status, "lost"),
          isNotNull(leads.updatedAt),
          lt(leads.updatedAt, target),
          gt(leads.updatedAt, window),
        )
      );
    for (const lead of cancelled) {
      if (await alreadySent(tenantId, lead.id, auto.id)) continue;
      await fireAutomation(tenantId, lead.id, lead.phone, lead.name, auto.id, msgBody, fromNumber);
    }
  }
}

// ─── Startup ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("[Worker] Rebookd automation worker starting...");
  console.log(`[Worker] Polling every ${POLL_INTERVAL_MS / 1000}s`);

  // Run immediately then on interval
  await runCycle();

  setInterval(async () => {
    try {
      await runCycle();
    } catch (err) {
      console.error("[Worker] Cycle error:", err);
    }
  }, POLL_INTERVAL_MS);
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Worker] SIGTERM received — shutting down gracefully");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("[Worker] SIGINT received — shutting down");
  process.exit(0);
});

main().catch(console.error);
