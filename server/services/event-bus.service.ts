import { runAutomationsForEvent } from "./automation-runner.service";
import { dispatchToN8n } from "./n8n-bridge.service";
import type { EventPayload } from "../../shared/events";
import { logger } from "../_core/logger";

// Bounded dedup map: prevents unbounded memory growth under high throughput.
// Stores eventId → timestamp, evicts oldest when MAX_SIZE is exceeded.
const MAX_PROCESSED_EVENTS = 10_000;
const processedEvents = new Map<string, number>();

function addProcessedEvent(id: string): void {
  if (processedEvents.size >= MAX_PROCESSED_EVENTS) {
    // Evict oldest entry
    const oldestKey = processedEvents.keys().next().value;
    if (oldestKey) processedEvents.delete(oldestKey);
  }
  processedEvents.set(id, Date.now());
}

// Prune entries older than 5 minutes every 60 seconds
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [key, ts] of processedEvents) {
    if (ts < cutoff) processedEvents.delete(key);
  }
}, 60_000).unref();

export async function emitEvent(event: EventPayload) {
  if (event.id && processedEvents.has(event.id)) {
    logger.debug("EventBus: duplicate event ignored", { eventId: event.id });
    return;
  }

  if (event.id) {
    addProcessedEvent(event.id);
  }

  logger.info("EventBus: event emitted", { type: event.type, tenantId: event.tenantId });

  // Try n8n first — if it handles the event, skip the built-in engine.
  // Falls back automatically if n8n is down (timeout), unhealthy, or disabled.
  const handledByN8n = await dispatchToN8n(event);
  if (!handledByN8n) {
    await runAutomationsForEvent(event);
  }
}
