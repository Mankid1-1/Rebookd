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

async function executeStep(db: Db, step: any, event: EventPayload, tenantId: number, leadId?: number) {
  switch (step.type) {
    case "sms":
    case "send_message": {
      let toPhone = event.data?.phone ?? event.data?.leadPhone;
      if (!toPhone && leadId) {
        const lead = await LeadService.getLeadById(db, tenantId, leadId);
        toPhone = lead?.phone;
      }
      if (!toPhone) throw new Error("No target phone number for sms step");
      const normalized = normalizePhoneE164(String(toPhone));
      if (!normalized) throw new Error("Invalid phone number for SMS automation step");
      const body = resolveTemplate(String(step.message || step.body || ""), { ...event.data });
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
          await executeStep(db, step, event, event.tenantId, leadId);
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
      await AutomationService.updateAutomation(resolvedDb, event.tenantId, automation.id, {
        errorCount: sql`${automations.errorCount} + 1` as any,
        lastRunAt: new Date(),
      });
      // Log error but don't throw to avoid blocking other automations
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
