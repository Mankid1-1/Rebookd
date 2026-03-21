import { getDb, getLeadById, getAutomationsByTrigger } from "../db";
import { sendSMS, resolveTemplate } from "../_core/sms";
import { EventPayload } from "../../shared/events";
import { automations, messages } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

function eventToTriggerTypes(eventType: EventPayload['type']): string[] {
  return {
    "lead.created": ["new_lead"],
    "message.received": ["inbound_message"],
    "message.sent": ["inbound_message"],
    "appointment.booked": ["appointment_reminder"],
    "appointment.no_show": ["time_delay", "appointment_reminder"],
    "appointment.cancelled": ["appointment_reminder"],
  }[eventType] ?? [];
}

function shouldAutomateForEvent(automation: any, event: EventPayload): boolean {
  const triggerCandidates = eventToTriggerTypes(event.type);
  if (triggerCandidates.includes(automation.triggerType)) return true;

  // Category-based matching for no_show and cancellation events
  // Note: These categories may not exist in the schema, so we rely on triggerType matching
  if (event.type === "lead.created" && automation.triggerType === "new_lead") return true;

  return false;
}

async function runStep(step: any, event: EventPayload, tenantId: number, leadId?: number) {
  switch (step.type) {
    case "delay": {
      const seconds = Number(step.value ?? 0);
      if (seconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      }
      return { success: true };
    }
    case "sms": {
      const db = await getDb();
      let toPhone = event.data?.phone ?? event.data?.leadPhone;
      if (!toPhone && leadId) {
        const lead = await getLeadById(tenantId, leadId);
        toPhone = lead?.phone;
      }
      if (!toPhone) {
        throw new Error("No target phone number for sms step");
      }

      const variables = {
        ...event.data,
      };

      const body = resolveTemplate(String(step.message || ""), variables);
      const res = await sendSMS(toPhone, body, undefined, tenantId);

      if (db && leadId) {
        await db.insert(messages).values({
          tenantId,
          leadId,
          direction: "outbound",
          body,
          status: res.success ? "sent" : "failed",
          twilioSid: res.sid || null,
          createdAt: new Date(),
        } as any);
      }

      return res;
    }
    case "webhook": {
      const url = step.url;
      if (!url) throw new Error("No webhook URL provided");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, step }),
      });
      if (!response.ok) {
        throw new Error(`Webhook call failed ${response.status}`);
      }
      return { success: true };
    }
    default:
      console.warn(`[AutomationRunner] Unsupported step type: ${step.type}`);
      return { success: true };
  }
}

export async function runAutomationsForEvent(event: EventPayload) {
  console.log("[AutomationRunner] Received event", event.type, "for tenant", event.tenantId);

  const db = await getDb();
  if (!db) return;

  const eventTriggers = eventToTriggerTypes(event.type);

  let automationsToRun: any[] = [];
  for (const trigger of eventTriggers) {
    const list = await getAutomationsByTrigger(event.tenantId, trigger);
    automationsToRun = automationsToRun.concat(list);
  }

  // remove duplicates
  automationsToRun = Object.values(
    automationsToRun.reduce((acc, automation) => {
      acc[automation.id] = automation;
      return acc;
    }, {} as Record<number, any>)
  );

  if (automationsToRun.length === 0) {
    console.log("[AutomationRunner] No matching automations for event", event.type);
    return;
  }

  for (const automation of automationsToRun) {
    if (!automation.enabled) continue;
    if (!shouldAutomateForEvent(automation, event)) continue;

    const leadId = typeof event.data?.leadId === "number" ? event.data.leadId : undefined;

    try {
      const steps = Array.isArray(automation.actions) ? automation.actions : [];
      for (const step of steps) {
        await runStep(step, event, event.tenantId, leadId);
      }

      await db
        .update(automations)
        .set({ runCount: Number(automation.runCount ?? 0) + 1, lastRunAt: new Date(), updatedAt: new Date() })
        .where(eq(automations.id, automation.id));
    } catch (error) {
      console.error("[AutomationRunner] Automation failed", automation.id, error);
      await db
        .update(automations)
        .set({
          errorCount: Number(automation.errorCount ?? 0) + 1,
          lastRunAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(automations.id, automation.id));
    }
  }
}
