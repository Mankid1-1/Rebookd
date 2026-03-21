import { runAutomationsForEvent } from "./automationRunner";
import type { EventPayload } from "../../shared/events";

const processedEvents = new Set<string>();

export async function emitEvent(event: EventPayload) {
  if (event.id && processedEvents.has(event.id)) {
    console.log("[EventBus] Duplicate event ignored:", event.id);
    return;
  }

  if (event.id) {
    processedEvents.add(event.id);
    setTimeout(() => processedEvents.delete(event.id!), 5 * 60 * 1000);
  }

  console.log("[EventBus] Event emitted:", event.type, "tenant", event.tenantId);
  await runAutomationsForEvent(event);
}
