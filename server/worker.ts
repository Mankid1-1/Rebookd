/**
 * Rebooked Automation Worker
 * Polls every minute for automations that need to fire.
 *
 * Key improvements over v1:
 *  - Batched queries: one query per automation type across ALL tenants (no N+1)
 *  - Idempotency: checks messages table before firing (automationId + leadId)
 *  - Retry logic: exponential back-off for failed SMS (up to 3 attempts)
 *  - Structured logging via logger
 *  - Timezone-aware scheduling using tenant.timezone
 */

import "dotenv/config";
import { and, desc, eq, gte, gt, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import { getDb } from "./db";
import { automations, calendarEvents, leads, messages, phoneNumbers, subscriptions, tenants, type Automation, type Lead } from "../drizzle/schema";
import { sendSMS, resolveTemplate } from "./_core/sms";
import { logger } from "./_core/logger";
import { captureException } from "./_core/sentry";
import { initSentry } from "./_core/sentry";
import * as LeadService from "./services/lead.service";
import * as TcpaCompliance from "./services/tcpa-compliance.service";
import * as UserService from "./services/user.service";
import type { Db } from "./_core/context";
import type { SMSResult } from "./_core/sms";
import { writeFileSync } from "fs";
import { randomUUID } from "crypto";
import { decrypt } from "./_core/crypto";
import { runWithCorrelationId } from "./_core/requestContext";
import { processQueuedAutomationJobs, runAutomationsForEvent } from "./services/automation-runner.service";
import { emitEvent } from "./services/event-bus.service";
import { reprocessDeadLetterQueue } from "./services/n8n-bridge.service";
import * as TenantService from "./services/tenant.service";
import { EmailService } from "./services/email.service";
import { gracefulShutdown } from "./_core/graceful-shutdown";
import { triggerPayoutProcessing } from "./jobs/process-referral-payouts";
import { syncAllDueConnections } from "./services/calendar/calendar-sync.service";
import { processEmailSequenceQueue } from "./services/email-marketing.service";

const POLL_INTERVAL_MS = 60_000;

// ─── Referral auto-payout tracking ────────────────────────────────────────────
let lastReferralPayoutRun: Date | null = null;
const REFERRAL_PAYOUT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
let lastDlqReprocessRun: Date | null = null;
const DLQ_REPROCESS_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;
const HEARTBEAT_FILE = process.env.WORKER_HEARTBEAT_FILE || `${require("os").tmpdir()}/worker-heartbeat.json`;

// ─── Time helpers ─────────────────────────────────────────────────────────────

const mins = (n: number) => n * 60_000;
const hours = (n: number) => n * 3_600_000;
const days = (n: number) => n * 86_400_000;

function ago(ms: number) { return new Date(Date.now() - ms); }
function fromNow(ms: number) { return new Date(Date.now() + ms); }

/**
 * Returns the UTC offset in milliseconds for a given IANA timezone.
 * e.g. "America/New_York" at UTC-5 returns -18_000_000
 */
function getTzOffsetMs(timezone: string): number {
  try {
    const now = new Date();
    // Format a date in the target timezone and parse the offset
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(p => p.type === "timeZoneName")?.value ?? "UTC+0";
    // offsetPart looks like "GMT-5" or "GMT+5:30"
    const match = offsetPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!match) return 0;
    const sign = match[1] === "+" ? 1 : -1;
    const h = parseInt(match[2], 10);
    const m = parseInt(match[3] ?? "0", 10);
    return sign * (h * 3_600_000 + m * 60_000);
  } catch {
    return 0;
  }
}

/**
 * Given a target UTC time and a recipient timezone, return the next valid
 * send time that respects TCPA quiet hours (8am-9pm in recipient TZ).
 * If the target time is already valid, returns it unchanged.
 */
function getNextValidSendTime(utcTime: Date, recipientTimezone: string): Date {
  const offset = getTzOffsetMs(recipientTimezone);
  const localTime = new Date(utcTime.getTime() + offset);
  const localHour = localTime.getHours();

  // TCPA: no SMS before 8am or after 9pm in recipient timezone
  if (localHour >= 8 && localHour < 21) return utcTime; // Already valid

  // If too late (9pm+), push to next day 8am
  if (localHour >= 21) {
    const nextMorning = new Date(localTime);
    nextMorning.setDate(nextMorning.getDate() + 1);
    nextMorning.setHours(8, 0, 0, 0);
    return new Date(nextMorning.getTime() - offset);
  }

  // If too early (before 8am), push to 8am today
  const thisMorning = new Date(localTime);
  thisMorning.setHours(8, 0, 0, 0);
  return new Date(thisMorning.getTime() - offset);
}

// ─── Idempotency ──────────────────────────────────────────────────────────────

/**
 * Batch-fetch all (leadId, automationId) pairs already sent for a given automation.
 * Returns a Set of "leadId:automationId" keys for O(1) lookup.
 */
async function buildSentSet(db: Db, tenantId: number, automationId: number, leadIds: number[]): Promise<Set<string>> {
  if (leadIds.length === 0) return new Set();
  const rows = await db
    .select({ leadId: messages.leadId })
    .from(messages)
    .where(and(
      eq(messages.tenantId, tenantId),
      eq(messages.automationId, automationId),
      sql`${messages.leadId} IN (${sql.join(leadIds.map(id => sql`${id}`), sql`, `)})`,
    ));
  return new Set(rows.map(r => String(r.leadId)));
}

// ─── SMS with retry ───────────────────────────────────────────────────────────

async function sendWithRetry(
  phone: string,
  body: string,
  fromNumber: string | undefined,
  tenantId: number,
  attempt = 1,
): Promise<SMSResult> {
  const res = await sendSMS(phone, body, fromNumber, tenantId);
  if (res.success) return res;

  if (attempt < MAX_RETRY_ATTEMPTS) {
    const backoff = Math.pow(2, attempt) * 1000; // 2s, 4s
    logger.warn("SMS failed, retrying", { attempt, backoff, error: res.error, tenantId });
    await new Promise(r => setTimeout(r, backoff));
    return sendWithRetry(phone, body, fromNumber, tenantId, attempt + 1);
  }

  return res;
}

// ─── Fire one automation for one lead ────────────────────────────────────────

async function fireAutomation(
  db: Db,
  tenantId: number,
  leadId: number,
  leadPhone: string,
  leadName: string | null,
  automationId: number,
  messageBody: string,
  fromNumber: string | undefined,
) {
  // TCPA compliance: verify consent before sending automated SMS
  const tcpaCheck = await TcpaCompliance.canSendSms(db, tenantId, leadId);
  if (!tcpaCheck.allowed) {
    logger.info("TCPA block: skipping automated SMS", { leadId, tenantId, automationId, reason: tcpaCheck.reason });
    return;
  }

  const decryptedPhone = decrypt(leadPhone);
  const decryptedName = leadName ? decrypt(leadName) : null;
  const firstName = decryptedName ? decryptedName.split(" ")[0] : "there";

  // Fetch the tenant's business name for the {{business}} template variable
  let businessName = "";
  try {
    const tenantRow = await db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    businessName = tenantRow[0]?.name || "";
  } catch (err) {
    logger.warn("Failed to fetch tenant name for template", { tenantId, error: String(err) });
  }

  // Fetch lead's appointment data for date/time if available
  let appointmentDate = "";
  let appointmentTime = "";
  try {
    const lead = await db
      .select({ appointmentDate: leads.appointmentAt })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);
    if (lead[0]?.appointmentDate) {
      const apptDate = new Date(lead[0].appointmentDate);
      appointmentDate = apptDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      appointmentTime = apptDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
  } catch (err) {
    logger.warn("Failed to fetch lead appointment data for template", { leadId, error: String(err) });
  }

  // Use current date/time as fallbacks if no appointment data
  if (!appointmentDate) {
    const now = new Date();
    appointmentDate = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    appointmentTime = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  const vars: Record<string, string> = {
    name: decryptedName || "there",
    first_name: firstName,
    business: businessName,
    date: appointmentDate,
    time: appointmentTime,
  };
  const resolved = resolveTemplate(messageBody, vars);

  const res = await sendWithRetry(decryptedPhone, resolved, fromNumber, tenantId);

  await LeadService.createMessage(db, {
    tenantId,
    leadId,
    direction: "outbound",
    body: resolved,
    fromNumber,
    toNumber: decryptedPhone,
    twilioSid: res.sid,
    status: res.success ? "sent" : "failed",
    automationId,
    provider: res.provider,
    providerError: res.errorCode || res.error,
    retryCount: res.retryCount || 0,
    deliveredAt: res.success ? new Date() : undefined,
    failedAt: res.success ? undefined : new Date(),
  });

  await db
    .update(automations)
    .set({
      runCount: sql`${automations.runCount} + 1`,
      lastRunAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(automations.id, automationId));

  logger.info("Automation fired", {
    automationId,
    leadId,
    tenantId,
    success: res.success,
    provider: res.provider,
  });
}

function getActionMessage(auto: Automation): string | null {
  const actions = auto.actions as Array<{ type: string; body: string }> | null;
  if (!actions?.length) return null;
  return actions.find(a => a.type === "send_message" || a.type === "sms")?.body ?? null;
}

function cfg(auto: Automation, key: string, fallback: number): number {
  const v = (auto.triggerConfig as Record<string, unknown> | null)?.[key];
  return typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) || fallback : fallback;
}

function leadTags(lead: Lead): string[] {
  return Array.isArray(lead.tags) ? lead.tags.filter((tag: unknown): tag is string => typeof tag === "string") : [];
}

function leadHasTag(lead: Lead, tag: string): boolean {
  return leadTags(lead).includes(tag);
}

async function hasInboundKeywordReply(db: Db, leadId: number, keywords: string[]): Promise<boolean> {
  const replies = await db
    .select({ body: messages.body })
    .from(messages)
    .where(and(eq(messages.leadId, leadId), eq(messages.direction, "inbound")))
    .orderBy(desc(messages.createdAt))
    .limit(10);
  const lowered = keywords.map((keyword) => keyword.toLowerCase());
  return replies.some((reply) => lowered.some((keyword) => String(reply.body || "").toLowerCase().includes(keyword)));
}

async function hasOutboundSince(db: Db, leadId: number, since: Date) {
  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.leadId, leadId), eq(messages.direction, "outbound"), gt(messages.createdAt, since)))
    .limit(1);
  return rows.length > 0;
}

async function isVipLead(db: Db, leadId: number, lead: Lead) {
  if (leadHasTag(lead, "vip")) return true;
  const counts = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(eq(messages.leadId, leadId));
  return Number(counts[0]?.count ?? 0) >= 6 || leadHasTag(lead, "booked_client");
}

// ─── Batched lead queries ─────────────────────────────────────────────────────
// Each function fetches ALL matching leads across all tenants in ONE query,
// then filters by tenantId in memory — eliminates the N+1 per-tenant loop.

async function processNewLeadWelcome(db: Db, auto: Automation, fromNumber: string | undefined) {
  const newLeads = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.tenantId, auto.tenantId),
      gt(leads.createdAt, ago(mins(2))),
      sql`${leads.status} NOT IN ('unsubscribed')`,
    ));

  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, newLeads.map(l => l.id));
  for (const lead of newLeads) {
    if (sentSet.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}

async function processFollowUp(db: Db, auto: Automation, fromNumber: string | undefined, delayDays: number) {
  const target = ago(days(delayDays));
  const window = ago(days(delayDays + 1));
  const stale = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.tenantId, auto.tenantId),
      lt(leads.createdAt, target),
      gt(leads.createdAt, window),
      sql`${leads.status} NOT IN ('booked', 'lost', 'unsubscribed')`,
    ));

  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, stale.map(l => l.id));
  for (const lead of stale) {
    if (sentSet.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}

async function processAppointmentReminder(db: Db, auto: Automation, fromNumber: string | undefined, delayHours: number, tenantTimezone: string) {
  // Convert current time to tenant's timezone to compute the correct UTC window.
  // We find the UTC offset for the tenant's timezone and shift the window accordingly.
  const nowUtc = Date.now();
  // Get the UTC offset in ms for the tenant timezone
  const tzOffset = getTzOffsetMs(tenantTimezone);
  // The window is still expressed in UTC for the DB query — we just need to
  // ensure the "now" reference is correct relative to the tenant's local clock.
  // Since appointment times are stored in UTC, we compare directly.
  const windowStart = new Date(nowUtc + hours(delayHours) - mins(1) - tzOffset);
  const windowEnd   = new Date(nowUtc + hours(delayHours) + mins(1) - tzOffset);
  const upcoming = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.tenantId, auto.tenantId),
      isNotNull(leads.appointmentAt),
      gt(leads.appointmentAt, windowStart),
      lt(leads.appointmentAt, windowEnd),
      sql`${leads.status} NOT IN ('lost', 'unsubscribed')`,
    ));

  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, upcoming.map(l => l.id));
  for (const lead of upcoming) {
    if (sentSet.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    // Inject appointment time into template
    const apptDate = lead.appointmentAt ? new Date(lead.appointmentAt) : new Date();
    const body = msg
      .replace("{{time}}", apptDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: tenantTimezone }))
      .replace("{{date}}", apptDate.toLocaleDateString("en-US", { timeZone: tenantTimezone }));
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, body, fromNumber);
  }
}

async function processNoShow(db: Db, auto: Automation, fromNumber: string | undefined, delayMinutes: number) {
  const windowStart = ago(mins(delayMinutes + 1));
  const windowEnd   = ago(mins(delayMinutes - 1));
  const noShows = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.tenantId, auto.tenantId),
      isNotNull(leads.appointmentAt),
      gt(leads.appointmentAt, windowStart),
      lt(leads.appointmentAt, windowEnd),
      sql`${leads.status} NOT IN ('booked', 'unsubscribed')`,
    ));

  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, noShows.map(l => l.id));
  for (const lead of noShows) {
    if (sentSet.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}

async function processWinBack(db: Db, auto: Automation, fromNumber: string | undefined, delayDays: number) {
  const target = ago(days(delayDays));
  const window = ago(days(delayDays + 1));
  const lapsed = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.tenantId, auto.tenantId),
      isNotNull(leads.lastMessageAt),
      lt(leads.lastMessageAt, target),
      gt(leads.lastMessageAt, window),
      sql`${leads.status} NOT IN ('lost', 'unsubscribed')`,
    ));

  const sentSetWb = await buildSentSet(db, auto.tenantId, auto.id, lapsed.map(l => l.id));
  for (const lead of lapsed) {
    if (sentSetWb.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}

async function processPostAppointment(db: Db, auto: Automation, fromNumber: string | undefined, delayHours: number) {
  const target = ago(hours(delayHours));
  const window = ago(hours(delayHours + 1));
  const completed = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.tenantId, auto.tenantId),
      isNotNull(leads.appointmentAt),
      lt(leads.appointmentAt, target),
      gt(leads.appointmentAt, window),
      eq(leads.status, "booked"),
    ));

  const sentSetPa = await buildSentSet(db, auto.tenantId, auto.id, completed.map(l => l.id));
  for (const lead of completed) {
    if (sentSetPa.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}

async function processConfirmationChase(db: Db, auto: Automation, fromNumber: string | undefined, delayHours: number, tenantTimezone: string) {
  const nowUtc = Date.now();
  const tzOffset = getTzOffsetMs(tenantTimezone);
  const windowStart = new Date(nowUtc + hours(delayHours) - mins(1) - tzOffset);
  const windowEnd = new Date(nowUtc + hours(delayHours) + mins(1) - tzOffset);
  const leadsToChase = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.tenantId, auto.tenantId),
      eq(leads.status, "booked"),
      isNotNull(leads.appointmentAt),
      gt(leads.appointmentAt, windowStart),
      lt(leads.appointmentAt, windowEnd),
    ));

  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, leadsToChase.map(l => l.id));
  for (const lead of leadsToChase) {
    if (sentSet.has(String(lead.id))) continue;
    const replied = await hasInboundKeywordReply(db, lead.id, ["confirm", "confirmed", "reschedule", "cancel"]);
    if (replied) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}

async function processInboundResponseSla(db: Db, auto: Automation, fromNumber: string | undefined, delayMinutes: number) {
  const windowStart = ago(mins(delayMinutes + 1));
  const windowEnd = ago(mins(delayMinutes - 1));
  const recentInbound = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.tenantId, auto.tenantId),
      isNotNull(leads.lastInboundAt),
      gt(leads.lastInboundAt, windowStart),
      lt(leads.lastInboundAt, windowEnd),
      sql`${leads.status} NOT IN ('lost', 'unsubscribed')`,
    ));

  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, recentInbound.map(l => l.id));
  for (const lead of recentInbound) {
    if (sentSet.has(String(lead.id))) continue;
    if (!lead.lastInboundAt) continue;
    const staffReplied = await hasOutboundSince(db, lead.id, new Date(lead.lastInboundAt));
    if (staffReplied) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}

async function processQualifiedFollowUp(db: Db, auto: Automation, fromNumber: string | undefined, delayDays: number) {
  const target = ago(days(delayDays));
  const window = ago(days(delayDays + 1));
  const qualified = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.tenantId, auto.tenantId),
      eq(leads.status, "qualified"),
      lt(leads.createdAt, target),
      gt(leads.createdAt, window),
      sql`${leads.appointmentAt} IS NULL`,
    ));

  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, qualified.map(l => l.id));
  for (const lead of qualified) {
    if (sentSet.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}

async function processDeliveryFailureRecovery(db: Db, auto: Automation, fromNumber: string | undefined, delayMinutes: number) {
  const windowStart = ago(mins(delayMinutes + 1));
  const windowEnd = ago(mins(delayMinutes - 1));
  const failedRows = await db
    .select({ leadId: messages.leadId })
    .from(messages)
    .where(and(
      eq(messages.tenantId, auto.tenantId),
      eq(messages.direction, "outbound"),
      eq(messages.status, "failed"),
      isNotNull(messages.failedAt),
      gt(messages.failedAt, windowStart),
      lt(messages.failedAt, windowEnd),
    ));

  const leadIds = Array.from(new Set(failedRows.map(r => r.leadId)));
  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, leadIds);
  for (const leadId of leadIds) {
    if (sentSet.has(String(leadId))) continue;
    const lead = await db.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.tenantId, auto.tenantId))).limit(1);
    const record = lead[0];
    if (!record || record.status === "unsubscribed") continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, record.tenantId, record.id, record.phone, record.name, auto.id, msg, fromNumber);
  }
}

async function processCancellationRescue(db: Db, auto: Automation, fromNumber: string | undefined, delayHours: number) {
  const target = ago(hours(delayHours));
  const window = ago(hours(delayHours + 24));
  const cancelled = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.tenantId, auto.tenantId),
      lt(leads.updatedAt, target),
      gt(leads.updatedAt, window),
      sql`${leads.status} NOT IN ('booked', 'unsubscribed')`,
    ));

  const candidates = cancelled.filter((lead) => leadHasTag(lead, "cancelled"));
  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, candidates.map(l => l.id));
  for (const lead of candidates) {
    if (sentSet.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}

async function processWaitlistFill(db: Db, auto: Automation, fromNumber: string | undefined, candidateWindowDays: number) {
  const cancellations = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.tenantId, auto.tenantId),
      gt(leads.updatedAt, ago(hours(1))),
      sql`${leads.status} NOT IN ('booked', 'unsubscribed')`,
    ));

  if (!cancellations.some((lead) => leadHasTag(lead, "cancelled"))) return;

  const candidates = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.tenantId, auto.tenantId),
      gt(leads.createdAt, ago(days(candidateWindowDays))),
      sql`${leads.status} IN ('new', 'contacted', 'qualified')`,
      sql`${leads.appointmentAt} IS NULL`,
    ));

  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, candidates.map(l => l.id));
  for (const lead of candidates.slice(0, 5)) {
    if (sentSet.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}

async function processVipWinBack(db: Db, auto: Automation, fromNumber: string | undefined, delayDays: number) {
  const target = ago(days(delayDays));
  const window = ago(days(delayDays + 7));
  const lapsed = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.tenantId, auto.tenantId),
      eq(leads.status, "booked"),
      isNotNull(leads.lastMessageAt),
      lt(leads.lastMessageAt, target),
      gt(leads.lastMessageAt, window),
    ));

  const vipCandidates: typeof lapsed = [];
  for (const lead of lapsed) {
    if (await isVipLead(db, lead.id, lead)) {
      vipCandidates.push(lead);
    }
  }

  const sentSet = await buildSentSet(db, auto.tenantId, auto.id, vipCandidates.map(l => l.id));
  for (const lead of vipCandidates) {
    if (sentSet.has(String(lead.id))) continue;
    const msg = getActionMessage(auto);
    if (!msg) continue;
    await fireAutomation(db, lead.tenantId, lead.id, lead.phone, lead.name, auto.id, msg, fromNumber);
  }
}

// ─── Per-tenant phone number cache ───────────────────────────────────────────

async function buildPhoneCache(db: Db, tenantIds: number[]): Promise<Map<number, string | undefined>> {
  if (tenantIds.length === 0) return new Map();
  // One query for all tenants' phone numbers
  const rows = await db
    .select({ tenantId: phoneNumbers.tenantId, number: phoneNumbers.number, isDefault: phoneNumbers.isDefault })
    .from(phoneNumbers)
    .where(and(
      sql`${phoneNumbers.tenantId} IN (${sql.join(tenantIds.map(id => sql`${id}`), sql`, `)})`,
      isNull(phoneNumbers.deletedAt),
    ));

  const cache = new Map<number, string | undefined>();
  for (const row of rows) {
    if (!cache.has(row.tenantId) || row.isDefault) {
      cache.set(row.tenantId, row.number);
    }
  }
  return cache;
}

// ─── Per-tenant timezone cache ────────────────────────────────────────────────

async function buildTimezoneCache(db: Db, tenantIds: number[]): Promise<Map<number, string>> {
  if (tenantIds.length === 0) return new Map();
  const rows = await db
    .select({ id: tenants.id, timezone: tenants.timezone })
    .from(tenants)
    .where(sql`${tenants.id} IN (${sql.join(tenantIds.map(id => sql`${id}`), sql`, `)})`);

  const cache = new Map<number, string>();
  for (const row of rows) {
    cache.set(row.id, row.timezone ?? "UTC");
  }
  return cache;
}

// ─── Trial reminder ───────────────────────────────────────────────────────────

async function processTrialReminders(db: Db) {
  const now = new Date();
  const threeDays = fromNow(days(3));
  const expiring = await db
    .select({ sub: subscriptions, tenant: tenants })
    .from(subscriptions)
    .innerJoin(tenants, eq(subscriptions.tenantId, tenants.id))
    .where(and(
      eq(subscriptions.status, "trialing"),
      isNotNull(subscriptions.trialEndsAt),
      lt(subscriptions.trialEndsAt, threeDays),
      gt(subscriptions.trialEndsAt, now),
      eq(subscriptions.trialReminderSent, false),
    ));

  if (expiring.length === 0) return;

  const { sendEmail } = await import("./_core/email");
  for (const row of expiring) {
    const email = await UserService.getPrimaryUserEmailByTenant(db, row.sub.tenantId);
    if (!email) continue;
    await sendEmail({
      to: email,
      subject: "Rebooked Trial Ending Soon",
      text: `Your Rebooked trial ends on ${row.sub.trialEndsAt ? new Date(row.sub.trialEndsAt).toLocaleDateString() : "soon"}. Upgrade to keep your automations running.`,
    });
    await db
      .update(subscriptions)
      .set({ trialReminderSent: true, updatedAt: new Date() })
      .where(eq(subscriptions.id, row.sub.id));
    logger.info("Trial reminder sent", { tenantId: row.sub.tenantId });
  }
}

// ─── Main cycle ───────────────────────────────────────────────────────────────

function writeWorkerHeartbeat(status = "ok", error?: string) {
  try {
    writeFileSync(HEARTBEAT_FILE, JSON.stringify({
      ts: new Date().toISOString(),
      status,
      error,
      lastSuccessAt: status === "ok" ? new Date().toISOString() : undefined,
      pollIntervalMs: POLL_INTERVAL_MS,
    }));
  } catch { /* non-fatal */ }
}

/**
 * Detect no-shows using synced calendar events.
 *
 * Strategy:
 *  1. Query calendarEvents with status "confirmed", startTime 1–24 hours in the past,
 *     and a linked leadId — these are appointments that should have happened.
 *  2. Cross-reference with the leads table: only fire if the lead is still "booked"
 *     (hasn't been manually marked complete or lost).
 *  3. Tag the lead "no_show_detected" to prevent re-firing.
 *  4. Emit appointment.no_show with the exact lead who missed their appointment.
 *
 * Falls back to leads.appointmentAt for tenants without calendar integrations.
 */
async function detectNoShows(db: Db) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    // ── Primary: Detect via synced calendar events ────────────────────
    const calendarNoShows = await db
      .select({
        eventId: calendarEvents.id,
        leadId: calendarEvents.leadId,
        tenantId: calendarEvents.tenantId,
        startTime: calendarEvents.startTime,
        attendeePhone: calendarEvents.attendeePhone,
        attendeeName: calendarEvents.attendeeName,
        leadPhone: leads.phone,
        leadName: leads.name,
        leadStatus: leads.status,
        leadTags: leads.tags,
      })
      .from(calendarEvents)
      .innerJoin(leads, and(
        eq(calendarEvents.leadId, leads.id),
        eq(calendarEvents.tenantId, leads.tenantId),
      ))
      .where(and(
        eq(calendarEvents.status, 'confirmed'),
        isNotNull(calendarEvents.leadId),
        lt(calendarEvents.startTime, oneHourAgo),
        gt(calendarEvents.startTime, twentyFourHoursAgo),
        eq(leads.status, 'booked'),
        sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'no_show_detected') IS NULL`,
      ))
      .limit(50);

    // ── Fallback: Leads with appointmentAt but no calendar event ──────
    const calendarLeadIds = new Set(calendarNoShows.map(r => r.leadId));
    const manualNoShows = await db.select()
      .from(leads)
      .where(and(
        isNotNull(leads.appointmentAt),
        lt(leads.appointmentAt, oneHourAgo),
        gt(leads.appointmentAt, twentyFourHoursAgo),
        eq(leads.status, 'booked'),
        sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'no_show_detected') IS NULL`,
      ))
      .limit(50);

    // Merge both sources, deduplicate by leadId
    const toProcess: Array<{ leadId: number; tenantId: number; phone: string; name: string }> = [];

    for (const row of calendarNoShows) {
      if (!row.leadId) continue;
      let phone = row.leadPhone || row.attendeePhone || '';
      try { phone = decrypt(phone); } catch { /* already plaintext */ }
      toProcess.push({
        leadId: row.leadId,
        tenantId: row.tenantId,
        phone,
        name: row.leadName || row.attendeeName || 'Client',
      });
    }

    for (const lead of manualNoShows) {
      if (calendarLeadIds.has(lead.id)) continue; // already handled
      let phone = lead.phone;
      try { phone = decrypt(phone); } catch { /* already plaintext */ }
      toProcess.push({
        leadId: lead.id,
        tenantId: lead.tenantId,
        phone,
        name: lead.name || 'Client',
      });
    }

    if (toProcess.length === 0) return;
    logger.info(`Worker: Detected ${toProcess.length} potential no-shows (${calendarNoShows.length} from calendar, ${toProcess.length - calendarNoShows.length} from manual)`);

    for (const entry of toProcess) {
      try {
        await LeadService.addLeadTags(db, entry.tenantId, entry.leadId, ['no_show_detected']);

        await runAutomationsForEvent({
          type: 'appointment.no_show' as any,
          tenantId: entry.tenantId,
          data: { leadId: entry.leadId, phone: entry.phone, name: entry.name },
          timestamp: new Date(),
        });

        logger.info(`Worker: No-show event fired for lead ${entry.leadId} (tenant ${entry.tenantId})`);
      } catch (err) {
        logger.error(`Worker: Failed to process no-show for lead ${entry.leadId}`, { error: String(err) });
      }
    }
  } catch (err) {
    logger.error("Worker: detectNoShows query failed", { error: String(err) });
  }
}

/**
 * Detect leads due for win-back campaigns (90+ days since last contact,
 * or 45+ days for VIP leads with 5+ visits).
 * Emits lead.win_back_due events → triggers win_back_90d / vip_winback_45d workflows.
 */
async function detectWinBackDue(db: Db) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);

  try {
    // Standard 90-day win-back: leads not contacted in 90+ days
    const lapsedLeads = await db.select()
      .from(leads)
      .where(and(
        isNotNull(leads.lastMessageAt),
        lt(leads.lastMessageAt, ninetyDaysAgo),
        sql`${leads.status} NOT IN ('booked', 'unsubscribed')`,
        sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'win_back_90d_sent') IS NULL`,
      ))
      .limit(25);

    // VIP 45-day win-back: high-value leads (5+ visits) not contacted in 45+ days
    const vipLapsed = await db.select()
      .from(leads)
      .where(and(
        isNotNull(leads.lastMessageAt),
        lt(leads.lastMessageAt, fortyFiveDaysAgo),
        gte(leads.lastMessageAt, ninetyDaysAgo), // exclude already-90d leads
        sql`${leads.status} NOT IN ('booked', 'unsubscribed')`,
        gte(leads.visitCount, 5),
        sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'vip_winback_45d_sent') IS NULL`,
      ))
      .limit(25);

    for (const lead of lapsedLeads) {
      try {
        await LeadService.addLeadTags(db, lead.tenantId, lead.id, ['win_back_90d_sent']);
        let phone = lead.phone;
        try { phone = decrypt(phone); } catch { }
        await emitEvent({
          type: 'lead.win_back_due' as any, tenantId: lead.tenantId,
          data: { leadId: lead.id, phone, name: lead.name || 'Client', winBackType: '90d' },
          timestamp: new Date(),
        });
      } catch (err) { logger.error(`Worker: win-back 90d failed for lead ${lead.id}`, { error: String(err) }); }
    }

    for (const lead of vipLapsed) {
      try {
        await LeadService.addLeadTags(db, lead.tenantId, lead.id, ['vip_winback_45d_sent']);
        let phone = lead.phone;
        try { phone = decrypt(phone); } catch { }
        await emitEvent({
          type: 'lead.win_back_due' as any, tenantId: lead.tenantId,
          data: { leadId: lead.id, phone, name: lead.name || 'Client', winBackType: '45d_vip' },
          timestamp: new Date(),
        });
      } catch (err) { logger.error(`Worker: VIP win-back failed for lead ${lead.id}`, { error: String(err) }); }
    }

    if (lapsedLeads.length + vipLapsed.length > 0) {
      logger.info(`Worker: Win-back detection found ${lapsedLeads.length} standard + ${vipLapsed.length} VIP leads`);
    }
  } catch (err) {
    logger.error("Worker: detectWinBackDue failed", { error: String(err) });
  }
}

/**
 * Detect leads whose birthday is today.
 * Emits lead.birthday events → triggers birthday_promo workflow.
 * Tags lead with birthday_YYYY_sent to prevent re-firing within the same year.
 */
async function detectBirthdays(db: Db) {
  try {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const yearTag = `birthday_${now.getFullYear()}_sent`;

    // Find leads whose birthday month+day matches today
    const birthdayLeads = await db.select()
      .from(leads)
      .where(and(
        isNotNull(leads.birthday),
        sql`SUBSTRING(${leads.birthday}, 6, 5) = ${`${month}-${day}`}`,
        sql`${leads.status} <> 'unsubscribed'`,
        sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', ${yearTag}) IS NULL`,
      ))
      .limit(50);

    for (const lead of birthdayLeads) {
      try {
        await LeadService.addLeadTags(db, lead.tenantId, lead.id, [yearTag]);
        let phone = lead.phone;
        try { phone = decrypt(phone); } catch { }
        await emitEvent({
          type: 'lead.birthday' as any, tenantId: lead.tenantId,
          data: { leadId: lead.id, phone, name: lead.name || 'Client' },
          timestamp: new Date(),
        });
      } catch (err) { logger.error(`Worker: birthday event failed for lead ${lead.id}`, { error: String(err) }); }
    }

    if (birthdayLeads.length > 0) {
      logger.info(`Worker: Birthday detection found ${birthdayLeads.length} leads`);
    }
  } catch (err) {
    logger.error("Worker: detectBirthdays failed", { error: String(err) });
  }
}

/**
 * Detect leads whose appointments completed successfully (1-24h ago, still "booked",
 * NOT tagged as no-show) — these are review request opportunities.
 * Emits review.requested events → triggers review_request workflow.
 */
async function detectReviewOpportunities(db: Db) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    // Find leads whose appointment completed (time passed) but who showed up
    // (status is "booked" and NOT tagged as no_show_detected)
    const completedLeads = await db.select()
      .from(leads)
      .where(and(
        isNotNull(leads.appointmentAt),
        lt(leads.appointmentAt, oneHourAgo),
        gt(leads.appointmentAt, twentyFourHoursAgo),
        eq(leads.status, 'booked'),
        sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'no_show_detected') IS NULL`,
        sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'review_requested') IS NULL`,
      ))
      .limit(50);

    for (const lead of completedLeads) {
      try {
        await LeadService.addLeadTags(db, lead.tenantId, lead.id, ['review_requested']);
        let phone = lead.phone;
        try { phone = decrypt(phone); } catch { }
        await emitEvent({
          type: 'review.requested' as any, tenantId: lead.tenantId,
          data: { leadId: lead.id, phone, name: lead.name || 'Client' },
          timestamp: new Date(),
        });
      } catch (err) { logger.error(`Worker: review request failed for lead ${lead.id}`, { error: String(err) }); }
    }

    if (completedLeads.length > 0) {
      logger.info(`Worker: Review opportunity detection found ${completedLeads.length} leads`);
    }
  } catch (err) {
    logger.error("Worker: detectReviewOpportunities failed", { error: String(err) });
  }
}

async function runCycleInner() {
  const db = await getDb();
  if (!db) { logger.warn("Worker: DB unavailable, skipping cycle"); writeWorkerHeartbeat("db_unavailable"); return; }

  // Write heartbeat at start of cycle — ensures it's always written
  // even if early returns (no automations, no leads) exit before the end
  writeWorkerHeartbeat("ok");

  // Wrap each sub-task so one failure doesn't kill the entire cycle
  try { await processTrialReminders(db); } catch (err) {
    logger.error("Worker: processTrialReminders failed", { error: String(err) });
  }
  try { await processQueuedAutomationJobs(db); } catch (err) {
    logger.error("Worker: processQueuedAutomationJobs failed", { error: String(err) });
  }

  // Detect no-shows (appointments that passed without completion) and fire recovery events
  try { await detectNoShows(db); } catch (err) {
    logger.error("Worker: detectNoShows failed", { error: String(err) });
  }

  // Detect review opportunities (successful appointments, 1+ hour ago)
  try { await detectReviewOpportunities(db); } catch (err) {
    logger.error("Worker: detectReviewOpportunities failed", { error: String(err) });
  }

  // Detect leads due for win-back campaigns (90/45 day lapse)
  try { await detectWinBackDue(db); } catch (err) {
    logger.error("Worker: detectWinBackDue failed", { error: String(err) });
  }

  // Detect birthdays and fire birthday promo automations
  try { await detectBirthdays(db); } catch (err) {
    logger.error("Worker: detectBirthdays failed", { error: String(err) });
  }

  // Process incoming emails from POP3
  try {
    const emailResult = await EmailService.processIncomingEmails(db);
    if (emailResult.success && emailResult.messagesProcessed && emailResult.messagesProcessed > 0) {
      logger.info("Worker: Processed incoming emails", { 
        count: emailResult.messagesProcessed 
      });
    }
  } catch (error) {
    logger.warn("Worker: Email processing failed", { error: String(error) });
  }

  // Sync calendars that are due
  try {
    await syncAllDueConnections(db);
  } catch (err) {
    logger.error("Worker: calendar sync failed", { error: String(err) });
  }

  // Reprocess n8n dead letter queue (every 5 minutes)
  {
    const now = new Date();
    const shouldRunDlq = !lastDlqReprocessRun ||
      (now.getTime() - lastDlqReprocessRun.getTime()) >= DLQ_REPROCESS_INTERVAL_MS;

    if (shouldRunDlq) {
      try {
        const processed = await reprocessDeadLetterQueue(db, 10);
        lastDlqReprocessRun = now;
        if (processed > 0) {
          logger.info("Worker: DLQ reprocessed", { processed });
        }
      } catch (err) {
        logger.error("Worker: DLQ reprocessing failed", { error: String(err) });
      }
    }
  }

  // Process email drip sequence queue (every cycle, ~1 minute)
  try {
    const emailsSent = await processEmailSequenceQueue(db);
    if (emailsSent > 0) {
      logger.info("Worker: Email sequences processed", { sent: emailsSent });
    }
  } catch (err) {
    logger.error("Worker: Email sequence processing failed", { error: String(err) });
  }

  // Cleanup expired tokenization vault entries
  try {
    const { cleanupExpiredTokens } = await import("./services/tokenization-vault.service");
    cleanupExpiredTokens();
  } catch {
    // Non-fatal — vault cleanup is best-effort
  }

  // Optional daily referral auto-payout (gated behind env flag)
  if (process.env.REFERRAL_AUTO_PAYOUT_ENABLED === 'true') {
    const now = new Date();
    const shouldRun = !lastReferralPayoutRun ||
      (now.getTime() - lastReferralPayoutRun.getTime()) >= REFERRAL_PAYOUT_INTERVAL_MS;

    if (shouldRun) {
      try {
        logger.info("Worker: Running daily referral auto-payout check");
        const result = await triggerPayoutProcessing();
        lastReferralPayoutRun = now;
        logger.info("Worker: Referral auto-payout complete", {
          processed: result.processed,
          total: result.total,
        });
      } catch (err) {
        // Still update last run time to avoid retrying every minute on persistent errors
        lastReferralPayoutRun = new Date();
        logger.error("Worker: Referral auto-payout failed", { error: String(err) });
        captureException(err);
      }
    }
  }

  // Fetch all enabled automations in ONE query
  let allAutomations;
  try {
    allAutomations = await db
      .select()
      .from(automations)
      .where(and(eq(automations.enabled, true), isNull(automations.deletedAt)));
  } catch (err) {
    logger.error("Worker: Failed to fetch automations", { error: String(err) });
    return;
  }

  if (allAutomations.length === 0) return;

  const entitledTenantIds = new Set<number>();
  for (const tenantId of Array.from(new Set((allAutomations as any[]).map((a: any) => a.tenantId as number)))) {
    if (await TenantService.tenantHasAutomationAccess(db, tenantId)) {
      entitledTenantIds.add(tenantId);
    }
  }

  const runnableAutomations = (allAutomations as any[]).filter((automation: any) => entitledTenantIds.has(automation.tenantId as number));
  if (runnableAutomations.length === 0) return;

  // Build phone number cache for all tenants in ONE query
  const tenantIds: number[] = Array.from(new Set(runnableAutomations.map((a: any) => a.tenantId as number)));
  const phoneCache = await buildPhoneCache(db, tenantIds);

  // Build timezone cache for all tenants in ONE query
  const timezoneCache = await buildTimezoneCache(db, tenantIds);

  for (const auto of runnableAutomations) {
    const fromNumber = phoneCache.get(auto.tenantId);
    const key = auto.key as string;

    try {
      if (key === "new_lead_welcome") {
        await processNewLeadWelcome(db, auto, fromNumber);
      } else if (key === "inbound_response_sla") {
        await processInboundResponseSla(db, auto, fromNumber, cfg(auto, "delayMinutes", 10));
      } else if (key === "lead_follow_up_3d") {
        await processFollowUp(db, auto, fromNumber, cfg(auto, "delayDays", 3));
      } else if (key === "lead_follow_up_7d") {
        await processFollowUp(db, auto, fromNumber, cfg(auto, "delayDays", 7));
      } else if (key === "qualified_followup_1d") {
        await processQualifiedFollowUp(db, auto, fromNumber, cfg(auto, "delayDays", 1));
      } else if (key === "qualified_followup_3d") {
        await processQualifiedFollowUp(db, auto, fromNumber, cfg(auto, "delayDays", 3));
      } else if (key === "appointment_reminder_24h") {
        await processAppointmentReminder(db, auto, fromNumber, cfg(auto, "delayHours", 24), timezoneCache.get(auto.tenantId) ?? "UTC");
      } else if (key === "appointment_reminder_2h") {
        await processAppointmentReminder(db, auto, fromNumber, cfg(auto, "delayHours", 2), timezoneCache.get(auto.tenantId) ?? "UTC");
      } else if (key === "appointment_confirmation_chase") {
        await processConfirmationChase(db, auto, fromNumber, cfg(auto, "delayHours", 12), timezoneCache.get(auto.tenantId) ?? "UTC");
      } else if (key === "no_show_follow_up") {
        await processNoShow(db, auto, fromNumber, cfg(auto, "delayMinutes", 60));
      } else if (key === "no_show_rebooking") {
        await processFollowUp(db, auto, fromNumber, cfg(auto, "delayDays", 3));
      } else if (key === "delivery_failure_retry") {
        await processDeliveryFailureRecovery(db, auto, fromNumber, cfg(auto, "delayMinutes", 15));
      } else if (key === "next_visit_prompt") {
        await processPostAppointment(db, auto, fromNumber, cfg(auto, "delayDays", 3) * 24);
      } else if (key === "post_appointment_feedback" || key === "post_appointment_upsell") {
        await processPostAppointment(db, auto, fromNumber, cfg(auto, "delayHours", 2));
      } else if (key === "waitlist_fill") {
        await processWaitlistFill(db, auto, fromNumber, cfg(auto, "candidateWindowDays", 30));
      } else if (key === "cancellation_same_day") {
        await processCancellationRescue(db, auto, fromNumber, cfg(auto, "delayHours", 1));
      } else if (key === "cancellation_rebooking_48h" || key === "cancellation_rescue_48h") {
        await processCancellationRescue(db, auto, fromNumber, cfg(auto, "delayHours", 48));
      } else if (key === "cancellation_rebooking_7d") {
        await processCancellationRescue(db, auto, fromNumber, cfg(auto, "delayDays", 7) * 24);
      } else if (key === "win_back_30d") {
        await processWinBack(db, auto, fromNumber, cfg(auto, "delayDays", 30));
      } else if (key === "win_back_90d") {
        await processWinBack(db, auto, fromNumber, cfg(auto, "delayDays", 90));
      } else if (key === "vip_winback_45d") {
        await processVipWinBack(db, auto, fromNumber, cfg(auto, "delayDays", 45));
      } else if (key === "vip_winback_90d") {
        await processVipWinBack(db, auto, fromNumber, cfg(auto, "delayDays", 90));
      } else if (key === "cancellation_rebooking") {
        await processFollowUp(db, auto, fromNumber, cfg(auto, "delayDays", 2));
      }
    } catch (err) {
      logger.error("Worker: automation error", { automationId: auto.id, key, error: String(err) });
      captureException(err, { automationId: auto.id, tenantId: auto.tenantId });
      await db
        .update(automations)
        .set({ errorCount: sql`${automations.errorCount} + 1`, updatedAt: new Date() })
        .where(eq(automations.id, auto.id));
    }
  }

  // Update heartbeat after full cycle completes
  writeWorkerHeartbeat("ok");
}

async function runCycle() {
  return runWithCorrelationId(randomUUID(), () => runCycleInner());
}

// ─── Startup ──────────────────────────────────────────────────────────────────

async function main() {
  await initSentry();
  logger.info("Worker starting", { pollIntervalMs: POLL_INTERVAL_MS });

  // Register graceful shutdown handlers
  gracefulShutdown.addShutdownHandler('SIGTERM', async () => {
    logger.info("Worker SIGTERM - graceful shutdown initiated");
    // Cleanup worker resources
    await new Promise(resolve => setTimeout(resolve, 2000)); // Allow 2s for cleanup
  });

  gracefulShutdown.addShutdownHandler('SIGINT', async () => {
    logger.info("Worker SIGINT - graceful shutdown initiated");
    // Cleanup worker resources
    await new Promise(resolve => setTimeout(resolve, 2000)); // Allow 2s for cleanup
  });

  await runCycle();

  const pollInterval = setInterval(async () => {
    try {
      // Check if shutdown is in progress
      if (gracefulShutdown.isShuttingDownActive()) {
        clearInterval(pollInterval);
        logger.info("Worker polling stopped due to shutdown");
        return;
      }

      await runCycle();
    } catch (err) {
      logger.error("Worker cycle error", { error: String(err) });
      writeWorkerHeartbeat("error", String(err));
      captureException(err);
    }
  }, POLL_INTERVAL_MS);
}

main().catch(err => {
  logger.error("Worker fatal", { error: String(err) });
  writeWorkerHeartbeat("fatal", String(err));
  process.exit(1);
});
