import { and, desc, eq, gte, sql } from "drizzle-orm";
import { automations, messages, recoveryEvents } from "../../drizzle/schema";
import type { EventPayload } from "../../shared/events";
import { normalizePhoneE164 } from "../../shared/phone";
import type { Db } from "../_core/context";
import { resolveTemplate, sendSMS } from "../_core/sms";
import type { SMSResult } from "../_core/sms";
import * as AutomationJobService from "./automation-job.service";
import * as AutomationService from "./automation.service";
import * as LeadService from "./lead.service";
import * as TenantService from "./tenant.service";
import * as TcpaCompliance from "./tcpa-compliance.service";
import { evaluateConditions, checkAutomationOverride, getLeadSegmentIds, type ConditionGroup } from "./conditions-engine.service";
import { logAutomationStep } from "./automationCore";
import { isRegisteredWorkflow, getWorkflowsByTrigger } from "./recoveryWorkflows";
import { executeAutomation } from "./automationCore";
import { logger } from "../_core/logger";
import crypto from "crypto";
import dns from "dns/promises";
import * as LinkTokenService from "./link-token.service";
import * as TemplateService from "./template.service";

const MAX_RETRY = 3;
const STEP_TIMEOUT_MS = 30_000; // 30 seconds max per step
const WEBHOOK_TIMEOUT_MS = 10_000; // 10 seconds for webhook calls
const WEBHOOK_RATE_LIMIT_PER_HOUR = 100;

// ─── In-memory webhook rate limiter ─────────────────────────────────────────
const webhookRateMap = new Map<number, { count: number; windowStart: number }>();

function checkWebhookRateLimit(tenantId: number): boolean {
  const now = Date.now();
  const entry = webhookRateMap.get(tenantId);
  if (!entry || now - entry.windowStart > 3_600_000) {
    webhookRateMap.set(tenantId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= WEBHOOK_RATE_LIMIT_PER_HOUR) return false;
  entry.count++;
  return true;
}

// Prune stale entries every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 3_600_000;
  for (const [k, v] of webhookRateMap) {
    if (v.windowStart < cutoff) webhookRateMap.delete(k);
  }
}, 600_000).unref();

// ─── TCPA Per-Contact Daily Cap (#1) ────────────────────────────────────────
// Hard limit: no single lead receives more than this many outbound SMS in 24 hours.
const MAX_SMS_PER_LEAD_PER_DAY = parseInt(process.env.MAX_SMS_PER_LEAD_PER_DAY || "3", 10);

async function isWithinPerContactDailyCap(db: Db, tenantId: number, leadId: number): Promise<boolean> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ c: sql<number>`count(*)` })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.leadId, leadId),
        eq(messages.direction, "outbound"),
        gte(messages.createdAt, dayAgo),
      )
    );
  return Number(row?.c ?? 0) < MAX_SMS_PER_LEAD_PER_DAY;
}

/**
 * TCPA quiet hours check: no SMS before 8am or after 9pm in recipient timezone.
 * Returns true if current time is within allowed sending hours.
 *
 * FIX #5: fail-closed — if timezone parsing fails, BLOCK the send rather than
 * risk delivering outside quiet hours. The job will be retried next worker cycle.
 */
function isWithinTcpaHours(recipientTimezone?: string): boolean {
  try {
    const tz = recipientTimezone || "America/New_York";
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    });
    const localHour = parseInt(formatter.format(new Date()), 10);
    return localHour >= 8 && localHour < 21;
  } catch {
    // FIX #5: fail-closed — block send when timezone is unparseable
    logger.warn("TCPA: timezone parsing failed, blocking send (fail-closed)", { recipientTimezone });
    return false;
  }
}

/**
 * FIX #2: Calculate the next valid 8am window in the recipient's timezone.
 * Used to reschedule jobs that were blocked by quiet hours.
 */
function getNextTcpaWindowStart(recipientTimezone?: string): Date {
  const tz = recipientTimezone || "America/New_York";
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    });
    const localHour = parseInt(formatter.format(now), 10);

    // If it's before 8am today, next window is 8am today
    // If it's 9pm or later, next window is 8am tomorrow
    const hoursUntil8am = localHour < 8
      ? 8 - localHour
      : (24 - localHour) + 8;

    return new Date(now.getTime() + hoursUntil8am * 60 * 60 * 1000);
  } catch {
    // Fallback: try again in 1 hour
    return new Date(Date.now() + 60 * 60 * 1000);
  }
}

/**
 * Validates that a webhook URL is safe to call.
 * Blocks SSRF vectors: private/loopback IPs, cloud metadata endpoints, non-HTTPS.
 */
const BLOCKED_IP_PATTERNS = [
  /^localhost$/,
  /^127\./,
  /^0\.0\.0\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,   // AWS/GCP metadata service & link-local
  /^100\.64\./,    // Carrier-grade NAT
  /^::1$/,
  /^fc[0-9a-f]{2}:/,
  /^fe[89ab][0-9a-f]:/,  // link-local IPv6
  /^fd[0-9a-f]{2}:/,     // unique local IPv6
  /^0$/,
];

function isBlockedIp(ip: string): boolean {
  return BLOCKED_IP_PATTERNS.some((re) => re.test(ip.toLowerCase()));
}

/**
 * Validates that a webhook URL is safe to call.
 * Blocks SSRF vectors: private/loopback IPs, cloud metadata endpoints, non-HTTPS.
 * Also resolves DNS to prevent DNS rebinding attacks.
 */
async function validateWebhookUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid webhook URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS");
  }

  const host = parsed.hostname.toLowerCase();

  // Check hostname string patterns first
  if (isBlockedIp(host)) {
    throw new Error("Webhook URL may not target a private or internal address");
  }

  // DNS rebinding protection: resolve hostname and check resolved IPs
  try {
    const ipv4s = await dns.resolve4(host).catch(() => [] as string[]);
    const ipv6s = await dns.resolve6(host).catch(() => [] as string[]);
    const allIps = [...ipv4s, ...ipv6s];

    for (const ip of allIps) {
      if (isBlockedIp(ip)) {
        logger.warn("Webhook DNS rebinding blocked", { host, resolvedIp: ip });
        throw new Error("Webhook URL resolves to a private or internal address (DNS rebinding blocked)");
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("DNS rebinding")) throw err;
    // DNS resolution failure is not a security block — allow (HTTPS will still verify cert)
    logger.warn("Webhook DNS resolution failed (allowing)", { host, error: String(err) });
  }
}

async function sendWithRetry(
  to: string,
  body: string,
  fromNumber: string | undefined,
  tenantId: number,
  attempt = 1,
): Promise<SMSResult> {
  const res = await sendSMS(to, body, fromNumber, tenantId);
  if (res.success) return res;
  if (attempt < MAX_RETRY) {
    return sendWithRetry(to, body, fromNumber, tenantId, attempt + 1);
  }
  return res;
}

function eventToTriggerTypes(eventType: EventPayload["type"]): string[] {
  return (
    ({
      "lead.created": ["new_lead"],
      "message.received": ["inbound_message"],
      "message.sent": ["inbound_message"],
      "appointment.booked": ["appointment_reminder"],
      "appointment.no_show": ["time_delay", "appointment_reminder"],
      "appointment.cancelled": ["appointment_reminder", "cancellation_flurry"],
      "appointment.rescheduled": ["rescheduling"],
      "call.missed": ["missed_call"],
      "lead.win_back_due": ["win_back"],
      "lead.birthday": ["birthday"],
      "lead.loyalty_milestone": ["loyalty_milestone"],
      "review.requested": ["review_request"],
      "waitlist.slot_opened": ["waitlist_slot_opened", "cancellation_flurry"],
    } as Record<string, string[]>)[eventType] ?? (() => {
      logger.warn("Unmapped event type in eventToTriggerTypes — no automations will fire", { eventType });
      return [] as string[];
    })()
  );
}

function shouldAutomateForEvent(automation: any, event: EventPayload): boolean {
  return eventToTriggerTypes(event.type).includes(automation.triggerType);
}

async function executeStep(db: Db, step: any, event: EventPayload, tenantId: number, leadId?: number) {
  switch (step.type) {
    case "sms":
    case "send_message": {
      // ── TCPA KILL-SWITCH ─────────────────────────────────────────────
      // This check MUST happen before any SMS send. If the lead replied
      // STOP or has no consent on record, we literally cannot send.
      if (leadId) {
        const tcpaCheck = await TcpaCompliance.canSendSms(db, tenantId, leadId);
        if (!tcpaCheck.allowed) {
          logger.info("TCPA Kill-Switch: SMS blocked in executeStep", {
            tenantId, leadId, reason: tcpaCheck.reason,
          });
          return; // Silently skip — do NOT throw
        }
      }

      // ── TCPA Per-Contact Daily Cap (#1) ──────────────────────────────
      if (leadId) {
        const withinCap = await isWithinPerContactDailyCap(db, tenantId, leadId);
        if (!withinCap) {
          logger.info("TCPA: per-contact daily cap reached, blocking SMS", {
            tenantId, leadId, cap: MAX_SMS_PER_LEAD_PER_DAY,
          });
          return; // Block — prevent over-messaging a single contact
        }
      }

      // ── TCPA Quiet Hours (FIX #2: reschedule instead of drop) ───────
      // No SMS before 8am or after 9pm in the recipient's timezone.
      // Fallback chain: event.data.timezone → lead.timezone → tenant.timezone → America/New_York
      let recipientTz = (event.data?.timezone as string) || undefined;
      if (!recipientTz && leadId) {
        try {
          const lead = await LeadService.getLeadById(db, tenantId, leadId);
          recipientTz = (lead as any)?.timezone || undefined;
        } catch { /* best effort */ }
      }
      if (!recipientTz) {
        try {
          const tenant = await TenantService.getTenantById(db, tenantId);
          recipientTz = (tenant as any)?.timezone || undefined;
        } catch { /* best effort */ }
      }
      if (!isWithinTcpaHours(recipientTz)) {
        const nextWindow = getNextTcpaWindowStart(recipientTz);
        logger.info("TCPA Quiet Hours: SMS deferred, rescheduling", {
          tenantId, leadId, timezone: recipientTz, nextRunAt: nextWindow.toISOString(),
        });
        // Throw a typed error so the job processor can reschedule
        const err = new Error("TCPA_QUIET_HOURS");
        (err as any).nextRunAt = nextWindow;
        throw err;
      }

      let toPhone = event.data?.phone ?? event.data?.leadPhone;
      if (!toPhone && leadId) {
        const lead = await LeadService.getLeadById(db, tenantId, leadId);
        toPhone = lead?.phone;
      }
      if (!toPhone) throw new Error("No target phone number for sms step");
      const normalized = normalizePhoneE164(String(toPhone));
      if (!normalized) throw new Error("Invalid phone number for SMS automation step");

      // Enrich template vars with tenant business name if not already in event data
      const templateVars: Record<string, unknown> = { ...event.data };
      if (!templateVars.business) {
        try {
          const tenant = await TenantService.getTenantById(db, tenantId);
          if (tenant) templateVars.business = tenant.name;
        } catch { /* best effort */ }
      }

      // Generate validated booking link if not provided in event data
      if (!templateVars.bookingLink && leadId) {
        try {
          const linkResult = await LinkTokenService.createLinkToken(db, tenantId, leadId, "booking");
          templateVars.bookingLink = linkResult.url;
        } catch (err) {
          logger.warn("Failed to create booking link token, using fallback", { tenantId, leadId, error: String(err) });
          const baseUrl = process.env.APP_URL || 'https://app.rebooked.com';
          templateVars.bookingLink = `${baseUrl}/book/fallback`;
        }
      }

      // Generate validated review link if not provided in event data
      if (!templateVars.reviewLink && leadId) {
        try {
          const linkResult = await LinkTokenService.createLinkToken(db, tenantId, leadId, "review");
          templateVars.reviewLink = linkResult.url;
        } catch (err) {
          logger.warn("Failed to create review link token, using fallback", { tenantId, leadId, error: String(err) });
          const baseUrl = process.env.APP_URL || 'https://app.rebooked.com';
          templateVars.reviewLink = `${baseUrl}/review/fallback`;
        }
      }

      // Look up custom template from DB, fall back to hardcoded workflow body
      let templateBody = String(step.message || step.body || "");
      if (step.messageKey) {
        try {
          const customTemplate = await TemplateService.getTemplateByKey(db, tenantId, step.messageKey);
          if (customTemplate?.body) {
            templateBody = customTemplate.body;
          }
        } catch { /* use default */ }
      }

      const body = resolveTemplate(templateBody, templateVars);
      const res = await sendWithRetry(normalized, body, undefined, tenantId);
      if (leadId) {
        await LeadService.createMessage(db, {
          tenantId,
          leadId,
          direction: "outbound",
          body,
          status: res.success ? "sent" : "failed",
          twilioSid: res.sid,
          provider: res.provider,
          providerError: [res.errorCode, res.error].filter(Boolean).join(": ") || undefined,
          retryCount: res.retryCount || 0,
          deliveredAt: res.success ? new Date() : undefined,
          failedAt: res.success ? undefined : new Date(),
        });
      }
      return;
    }
    case "webhook": {
      if (!step.url) throw new Error("No webhook URL provided");
      await validateWebhookUrl(String(step.url));

      // Per-tenant webhook rate limiting
      if (!checkWebhookRateLimit(tenantId)) {
        throw new Error("RATE_LIMITED: webhook rate limit exceeded (100/hour)");
      }

      // Webhook call with timeout
      const webhookController = new AbortController();
      const webhookTimer = setTimeout(() => webhookController.abort(), WEBHOOK_TIMEOUT_MS);
      try {
        const response = await fetch(step.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, step }),
          signal: webhookController.signal,
        });
        if (!response.ok) throw new Error(`Webhook call failed ${response.status}`);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error(`Webhook timed out after ${WEBHOOK_TIMEOUT_MS}ms`);
        }
        throw err;
      } finally {
        clearTimeout(webhookTimer);
      }
      return;
    }
    case "state_transition": {
      // Recovery state transitions: detected → contacted → recovered → billed
      // These update the recovery_events table for revenue attribution tracking
      if (step.targetState && leadId) {
        try {
          const [latestRecovery] = await db
            .select({ id: recoveryEvents.id })
            .from(recoveryEvents)
            .where(and(
              eq(recoveryEvents.tenantId, tenantId),
              eq(recoveryEvents.leadId, leadId),
            ))
            .orderBy(desc(recoveryEvents.createdAt))
            .limit(1);

          if (latestRecovery) {
            const updates: Record<string, any> = { status: step.targetState, updatedAt: new Date() };
            if (step.targetState === 'contacted') updates.respondedAt = new Date();
            if (step.targetState === 'converted') updates.convertedAt = new Date();
            if (step.targetState === 'realized') updates.realizedAt = new Date();
            await db.update(recoveryEvents).set(updates).where(eq(recoveryEvents.id, latestRecovery.id));
            logger.info("Recovery state transition", { tenantId, leadId, state: step.targetState, recoveryEventId: latestRecovery.id });
          }
        } catch (err) {
          logger.warn("State transition failed (non-fatal)", { tenantId, leadId, error: String(err) });
        }
      }
      return;
    }
    default:
      return;
  }
}

async function continueAutomation(
  db: Db,
  automation: any,
  event: EventPayload,
  startStepIndex: number,
  leadId?: number,
) {
  const steps = Array.isArray(automation.actions) ? automation.actions : [];
  
  // Execute steps in parallel where possible, but handle delays sequentially
  for (let index = startStepIndex; index < steps.length; index += 1) {
    const step = steps[index];
    
    if (step?.type === "delay") {
      const seconds = Number(step.value ?? 0);

      if (seconds < 0) {
        // ── Negative delay: schedule BEFORE an appointment ──────────────
        // e.g. -86400 = 24h before appointment. We compute the send time
        // from the appointment's start time in event.data.appointmentAt.
        const appointmentAt = event.data?.appointmentAt
          ? new Date(event.data.appointmentAt as string | number)
          : null;

        if (appointmentAt && !isNaN(appointmentAt.getTime())) {
          const sendAt = new Date(appointmentAt.getTime() + seconds * 1000);
          if (sendAt.getTime() > Date.now()) {
            await AutomationJobService.enqueueAutomationJob(db, {
              tenantId: event.tenantId,
              automationId: automation.id,
              leadId,
              eventType: event.type,
              eventData: event.data,
              stepIndex: index + 1,
              nextRunAt: sendAt,
            });
            return;
          }
          // If the send time is already past (booked too close to now),
          // fall through and execute immediately.
        }
        // If no appointmentAt provided, skip the delay and execute now.
        continue;
      }

      if (seconds > 0) {
        await AutomationJobService.enqueueAutomationJob(db, {
          tenantId: event.tenantId,
          automationId: automation.id,
          leadId,
          eventType: event.type,
          eventData: event.data,
          stepIndex: index + 1,
          nextRunAt: new Date(Date.now() + seconds * 1000),
        });
        return;
      }
      continue;
    }
    
    // ── Per-step TCPA re-check for multi-step workflows ─────────────────
    // If a lead replied STOP after the first SMS, block subsequent SMS steps.
    if ((step.type === "sms" || step.type === "send_message") && leadId) {
      const recheck = await TcpaCompliance.canSendSms(db, event.tenantId, leadId);
      if (!recheck.allowed) {
        logger.info("TCPA re-check blocked delayed SMS step", {
          tenantId: event.tenantId, leadId, stepIndex: index, reason: recheck.reason,
        });
        continue; // Skip this step, try next
      }
      const withinCap = await isWithinPerContactDailyCap(db, event.tenantId, leadId);
      if (!withinCap) {
        logger.info("TCPA daily cap blocked delayed SMS step", {
          tenantId: event.tenantId, leadId, stepIndex: index,
        });
        continue;
      }
    }

    // Execute with timeout to prevent hung steps from blocking the worker
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        setImmediate(async () => {
          try {
            await executeStep(db, step, event, event.tenantId, leadId);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Step execution timed out after ${STEP_TIMEOUT_MS}ms`)), STEP_TIMEOUT_MS),
      ),
    ]);
  }
  
  await AutomationService.updateAutomation(db, event.tenantId, automation.id, {
    runCount: sql`${automations.runCount} + 1` as any,
    lastRunAt: new Date(),
  });
}

export async function runAutomationsForEvent(event: EventPayload, db?: Db) {
  let resolvedDb: Db;
  if (db) {
    resolvedDb = db;
  } else {
    const { getDb } = await import("../db");
    const liveDb = await getDb();
    if (!liveDb) return;
    resolvedDb = liveDb;
  }

  const entitled = await TenantService.tenantHasAutomationAccess(resolvedDb, event.tenantId);
  if (!entitled) {
    return;
  }

  const eventTriggers = eventToTriggerTypes(event.type);
  let automationsToRun: any[] = [];
  for (const trigger of eventTriggers) {
    const list = await AutomationService.getAutomationsByTrigger(resolvedDb, event.tenantId, trigger);
    automationsToRun = automationsToRun.concat(list);
  }

  const seen = new Set<number>();
  automationsToRun = automationsToRun.filter((automation) => {
    if (seen.has(automation.id)) return false;
    seen.add(automation.id);
    return true;
  });

  // ── Check for registered workflows that match this event ─────────────
  // These go through the new automationCore engine with state machine,
  // TCPA kill-switch, cooldown, and background job offloading.
  const registeredWorkflows = getWorkflowsByTrigger(event.type);
  const leadIdForWorkflow = typeof event.data?.leadId === "number" ? event.data.leadId : undefined;

  if (registeredWorkflows.length > 0 && leadIdForWorkflow) {
    const workflowPromises = registeredWorkflows.map(async (workflow) => {
      try {
        await executeAutomation(resolvedDb, {
          tenantId: event.tenantId,
          leadId: leadIdForWorkflow,
          workflowKey: workflow.key,
          eventType: event.type,
          eventData: event.data as Record<string, unknown>,
          estimatedRevenue: typeof event.data?.estimatedRevenue === "number"
            ? event.data.estimatedRevenue
            : undefined,
        });
      } catch (error) {
        logger.error(`Workflow ${workflow.key} failed:`, { error: String(error) });
      }
    });
    await Promise.allSettled(workflowPromises);
  }

  // ── Legacy/custom automations (backward compatible) ─────────────────
  // Automations NOT in the workflow registry continue through the
  // existing continueAutomation() path.
  const automationPromises = automationsToRun.map(async (automation) => {
    if (!automation.enabled || !shouldAutomateForEvent(automation, event)) return;

    // Skip if this automation key is handled by the new workflow engine
    if (isRegisteredWorkflow(automation.key)) return;

    const leadId = typeof event.data?.leadId === "number" ? event.data.leadId : undefined;

    // ── Conditions & Override checks ───────────────────────────────────
    if (leadId) {
      // Check per-lead automation override
      const override = await checkAutomationOverride(resolvedDb, leadId, automation.key);
      if (override === false) return; // Force disabled for this lead

      // Evaluate automation conditions against lead
      if (automation.conditions && Array.isArray(automation.conditions) === false && (automation.conditions as any).logic) {
        const lead = await LeadService.getLeadById(resolvedDb, event.tenantId, leadId);
        if (lead) {
          const segmentIds = await getLeadSegmentIds(resolvedDb, leadId);
          const matches = evaluateConditions(lead, automation.conditions as ConditionGroup, { segmentIds });
          if (!matches) return; // Lead doesn't match conditions
        }
      }
    }

    try {
      await continueAutomation(resolvedDb, automation, event, 0, leadId);
    } catch (error) {
      await AutomationService.updateAutomation(resolvedDb, event.tenantId, automation.id, {
        errorCount: sql`${automations.errorCount} + 1` as any,
        lastRunAt: new Date(),
      });
      logger.error(`Automation ${automation.id} failed:`, { error: String(error) });
    }
  });

  // Wait for all automations to complete (or fail)
  await Promise.allSettled(automationPromises);
}

export async function processQueuedAutomationJobs(db: Db, limit = 50) {
  const jobs = await AutomationJobService.claimDueAutomationJobs(db, limit);
  for (const job of jobs) {
    try {
      const entitled = await TenantService.tenantHasAutomationAccess(db, job.tenantId);
      if (!entitled) {
        await AutomationJobService.failAutomationJob(db, job.id, "Tenant subscription is no longer entitled to run automations");
        continue;
      }
      const automation = await AutomationService.getAutomationById(db, job.tenantId, job.automationId);
      if (!automation || !automation.enabled) {
        await AutomationJobService.failAutomationJob(db, job.id, "Automation no longer available");
        continue;
      }
      const event: EventPayload = {
        type: job.eventType as EventPayload["type"],
        tenantId: job.tenantId,
        data: (job.eventData ?? {}) as Record<string, unknown>,
        timestamp: new Date(),
      };
      await continueAutomation(db, automation, event, job.stepIndex, job.leadId ?? undefined);
      await AutomationJobService.completeAutomationJob(db, job.id);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);

      // FIX #2: Reschedule jobs blocked by TCPA quiet hours
      if (errMsg === "TCPA_QUIET_HOURS" && (error as any).nextRunAt) {
        await AutomationJobService.rescheduleAutomationJob(db, job.id, (error as any).nextRunAt, "Deferred: TCPA quiet hours");
        continue;
      }

      // FIX #7: Reschedule jobs blocked by rate limiting (with jitter)
      if (errMsg.includes("RATE_LIMITED") || errMsg.includes("rate limit")) {
        const jitter = Math.floor(30_000 + Math.random() * 60_000); // 30-90s
        const retryAt = new Date(Date.now() + jitter);
        await AutomationJobService.rescheduleAutomationJob(db, job.id, retryAt, "Deferred: rate limited");
        continue;
      }

      // FIX #9/#10: For transient send failures, reschedule with exponential backoff + jitter
      if (job.attempts < MAX_RETRY && (errMsg.includes("timeout") || errMsg.includes("ECONNRESET") || errMsg.includes("503"))) {
        const baseBackoff = Math.pow(2, job.attempts) * 5000; // 10s, 20s, 40s
        const jitter = Math.floor(Math.random() * baseBackoff * 0.5); // 0-50% jitter
        const retryAt = new Date(Date.now() + baseBackoff + jitter);
        await AutomationJobService.rescheduleAutomationJob(db, job.id, retryAt, errMsg);
        continue;
      }

      await AutomationJobService.failAutomationJob(db, job.id, errMsg);
    }
  }
}
