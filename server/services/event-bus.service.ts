import { runAutomationsForEvent } from "./automation-runner.service";
import { dispatchToN8n } from "./n8n-bridge.service";
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

  // Try n8n first — if it handles the event, skip the built-in engine.
  // Falls back automatically if n8n is down (timeout), unhealthy, or disabled.
  const handledByN8n = await dispatchToN8n(event);
  if (!handledByN8n) {
    await runAutomationsForEvent(event);
  }
}
