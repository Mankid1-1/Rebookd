import { sql } from "drizzle-orm";
import { automations } from "../../drizzle/schema";
import type { EventPayload } from "../../shared/events";
import { normalizePhoneE164 } from "../../shared/phone";
import type { Db } from "../_core/context";
import { resolveTemplate, sendSMS } from "../_core/sms";
import type { SMSResult } from "../_core/sms";
import * as AutomationJobService from "./automationJob.service";
import * as AutomationService from "./automation.service";
import * as LeadService from "./lead.service";
import * as TenantService from "./tenant.service";
import * as RecoveryAttribution from "./recovery-attribution.service";
import * as TcpaCompliance from "./tcpaCompliance.service";
import * as SystemService from "./system.service";

const MAX_RETRY = 3;

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
      "appointment.cancelled": ["appointment_reminder"],
    } as Record<string, string[]>)[eventType] ?? []
  );
}

function shouldAutomateForEvent(automation: any, event: EventPayload): boolean {
  return eventToTriggerTypes(event.type).includes(automation.triggerType);
}

/** Recovery-related event types that should create attribution tracking */
const RECOVERY_EVENT_TYPES: Set<string> = new Set([
  "appointment.no_show",
  "appointment.cancelled",
  "lead.created", // lead capture recovery
]);

/** Map event types to leakage types for attribution */
function getLeakageType(eventType: string): string {
  switch (eventType) {
    case "appointment.no_show": return "no_show";
    case "appointment.cancelled": return "cancellation";
    case "lead.created": return "new_lead";
    default: return "followup";
  }
}

async function executeStep(db: Db, step: any, event: EventPayload, tenantId: number, leadId?: number, automationId?: number) {
  switch (step.type) {
    case "sms":
    case "send_message": {
      // TCPA compliance: check consent + unsubscribe status before sending
      if (leadId) {
        const tcpaCheck = await TcpaCompliance.canSendSms(db, tenantId, leadId);
        if (!tcpaCheck.allowed) {
          console.log(`TCPA block: skipping SMS to lead ${leadId} — ${tcpaCheck.reason}`);
          return;
        }
      }

      let toPhone = event.data?.phone ?? event.data?.leadPhone;
      if (!toPhone && leadId) {
        const lead = await LeadService.getLeadById(db, tenantId, leadId);
        toPhone = lead?.phone;
      }
      if (!toPhone) throw new Error("No target phone number for sms step");
      const normalized = normalizePhoneE164(String(toPhone));
      if (!normalized) throw new Error("Invalid phone number for SMS automation step");

      // Create recovery attribution event for recovery-type automations
      let recoveryEventId: number | undefined;
      let trackingToken: string | undefined;
      const isRecoveryEvent = leadId && RECOVERY_EVENT_TYPES.has(event.type);

      if (isRecoveryEvent) {
        const recovery = await RecoveryAttribution.createRecoveryEvent(db, {
          tenantId,
          leadId: leadId!,
          automationId,
          leakageType: getLeakageType(event.type),
          originalAppointmentId: event.data?.appointmentId ? String(event.data.appointmentId) : undefined,
          estimatedRevenue: Number(event.data?.estimatedRevenue || 25000), // default $250 in cents
        });
        recoveryEventId = recovery.recoveryEventId;
        trackingToken = recovery.trackingToken;
      }

      // Resolve template and append tracking token to SMS body
      let body = resolveTemplate(String(step.message || step.body || ""), { ...event.data });
      if (trackingToken) {
        body += `\n\nRef: ${trackingToken}`;
      }

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
          automationId,
        });
      }
      return;
    }
    case "webhook": {
      if (!step.url) throw new Error("No webhook URL provided");
      const response = await fetch(step.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, step }),
      });
      if (!response.ok) throw new Error(`Webhook call failed ${response.status}`);
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
    
    // Execute non-delay steps without blocking the event loop
    // Use setImmediate to yield to the event loop
    await new Promise<void>((resolve, reject) => {
      setImmediate(async () => {
        try {
          await executeStep(db, step, event, event.tenantId, leadId, automation.id);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
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

  // Run automations in parallel to avoid blocking the event loop
  const automationPromises = automationsToRun.map(async (automation) => {
    if (!automation.enabled || !shouldAutomateForEvent(automation, event)) return;
    const leadId = typeof event.data?.leadId === "number" ? event.data.leadId : undefined;
    try {
      await continueAutomation(resolvedDb, automation, event, 0, leadId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await AutomationService.updateAutomation(resolvedDb, event.tenantId, automation.id, {
        errorCount: sql`${automations.errorCount} + 1` as any,
        lastRunAt: new Date(),
      });
      // Surface error to tenant dashboard via system errors
      await SystemService.createSystemError(resolvedDb as any, {
        type: "automation",
        message: `Automation "${automation.name || automation.id}" failed: ${errorMsg}`,
        detail: JSON.stringify({ automationId: automation.id, leadId, eventType: event.type, error: errorMsg }),
        tenantId: event.tenantId,
      }).catch(() => undefined);
      console.error(`Automation ${automation.id} failed:`, error);
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
      // TCPA: re-check lead consent before executing delayed steps
      if (job.leadId) {
        const tcpaCheck = await TcpaCompliance.canSendSms(db, job.tenantId, job.leadId);
        if (!tcpaCheck.allowed) {
          await AutomationJobService.failAutomationJob(db, job.id, `TCPA block: ${tcpaCheck.reason}`);
          continue;
        }
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
      await AutomationJobService.failAutomationJob(db, job.id, error instanceof Error ? error.message : String(error));
    }
  }
}
