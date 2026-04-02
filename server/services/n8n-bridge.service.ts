/**
 * n8n Bridge Service — Production-Grade
 *
 * Dispatches Rebooked events to n8n webhook workflows with:
 * - Circuit breaker (CLOSED/OPEN/HALF_OPEN) for fast failure detection
 * - Retry with exponential backoff + jitter for transient failures
 * - Dead letter queue for events that exhaust retries
 * - HMAC-SHA256 signature on outbound payloads
 * - Graceful fallback to built-in engine on any failure path
 *
 * n8n NEVER sends SMS directly — it calls back to /api/trpc/n8n.sendSms
 * which enforces TCPA + rate limiting before any message is sent.
 */

import { createHmac } from "crypto";
import { ENV } from "../_core/env";
import { logger } from "../_core/logger";
import type { EventPayload } from "../../shared/events";

// ─── Circuit Breaker ─────────────────────────────────────────────────────────

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

class N8nCircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureAt = 0;
  private openedAt = 0;
  private readonly threshold: number;
  private readonly timeoutMs: number;
  private readonly failureWindowMs = 60_000; // Count failures within 60s

  constructor(threshold: number, timeoutMs: number) {
    this.threshold = threshold;
    this.timeoutMs = timeoutMs;
  }

  isOpen(): boolean {
    if (this.state === "CLOSED") return false;

    if (this.state === "OPEN") {
      // Check if timeout has elapsed → transition to HALF_OPEN
      if (Date.now() - this.openedAt >= this.timeoutMs) {
        this.state = "HALF_OPEN";
        logger.info("[n8n] Circuit breaker → HALF_OPEN (probing)");
        return false; // Allow one probe request
      }
      return true; // Still open
    }

    // HALF_OPEN: allow the probe through
    return false;
  }

  recordSuccess(): void {
    if (this.state === "HALF_OPEN") {
      logger.info("[n8n] Circuit breaker → CLOSED (probe succeeded)");
    }
    this.state = "CLOSED";
    this.failureCount = 0;
  }

  recordFailure(): void {
    const now = Date.now();

    // Reset counter if failures are outside the window
    if (now - this.lastFailureAt > this.failureWindowMs) {
      this.failureCount = 0;
    }

    this.failureCount++;
    this.lastFailureAt = now;

    if (this.state === "HALF_OPEN") {
      // Probe failed → re-open
      this.state = "OPEN";
      this.openedAt = now;
      logger.warn("[n8n] Circuit breaker → OPEN (probe failed)");
      return;
    }

    if (this.failureCount >= this.threshold) {
      this.state = "OPEN";
      this.openedAt = now;
      logger.warn("[n8n] Circuit breaker → OPEN", {
        failures: this.failureCount,
        threshold: this.threshold,
      });
    }
  }

  getState(): { state: CircuitState; failureCount: number; openedAt: number | null } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      openedAt: this.state === "OPEN" ? this.openedAt : null,
    };
  }
}

const circuitBreaker = new N8nCircuitBreaker(
  ENV.n8nCircuitBreakerThreshold,
  ENV.n8nCircuitBreakerTimeoutMs,
);

// ─── HMAC Signature ──────────────────────────────────────────────────────────

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify an HMAC-SHA256 signature from n8n callbacks.
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = signPayload(payload, secret);
  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

// ─── Event → webhook path mapping ───────────────────────────────────────────

const EVENT_WEBHOOK_MAP: Record<string, string> = {
  // Call tracking events (5 workflows)
  "call.missed": "missed-call-textback",
  "call.missed_followup": "missed-call-followup",
  "call.missed_final": "missed-call-final-offer",
  "call.completed": "call-completed",
  "call.voicemail": "call-voicemail",
  // Appointment (4 workflows)
  "appointment.booked": "appointment-confirmation",
  "appointment.confirmation_chase": "confirmation-chase",
  "appointment.reminder_24h": "appointment-reminder-24h",
  "appointment.reminder_2h": "appointment-reminder-2h",
  // No-show (2 workflows)
  "appointment.no_show": "noshow-recovery",
  "appointment.no_show_rebook": "noshow-rebook-offer",
  // Cancellation (4 workflows)
  "appointment.cancelled": "cancellation-recovery",
  "appointment.cancellation_rescue_7d": "cancellation-rescue-7d",
  "waitlist.slot_opened": "cancellation-flurry",
  "appointment.rescheduled": "rescheduling-offer",
  // Follow-up (5 workflows)
  "lead.feedback_due": "post-visit-feedback",
  "lead.upsell_due": "post-visit-upsell",
  "lead.next_visit_due": "next-visit-prompt",
  "lead.followup_due": "lead-followup-sequence",
  "lead.qualified": "qualified-followup",
  // Re-engagement (4 workflows)
  "lead.win_back_30d": "win-back-30d",
  "lead.win_back_due": "win-back-90d",
  "lead.vip_winback_45d": "vip-winback-45d",
  "lead.vip_winback_90d": "vip-winback-90d",
  // Welcome & loyalty (3 workflows)
  "lead.created": "welcome-new-lead",
  "lead.birthday": "birthday-promo",
  "lead.loyalty_milestone": "loyalty-milestone",
  // Inbound & delivery (2 workflows)
  "message.received": "inbound-auto-reply",
  "message.delivery_failed": "delivery-failure-recovery",
  // Review (1 workflow)
  "review.requested": "review-request",
  // Smart review routing events
  "review.rating_received": "review-rating-received",
  "review.positive_routed": "review-positive-routed",
  "review.negative_captured": "review-negative-captured",
  "review.feedback_submitted": "review-feedback-submitted",
  // AI SMS events
  "ai.sms_generated": "ai-sms-generated",
  "ai.sms_fallback": "ai-sms-fallback",
  // Booking page events
  "booking.page_viewed": "booking-page-viewed",
  "booking.slot_selected": "booking-slot-selected",
  "booking.created": "booking-created",
  "booking.cancelled": "booking-cancelled",
  // Waitlist auto-fill events
  "waitlist.offer_sent": "waitlist-offer-sent",
  "waitlist.offer_accepted": "waitlist-offer-accepted",
  "waitlist.offer_declined": "waitlist-offer-declined",
  "waitlist.offer_expired": "waitlist-offer-expired",
  "waitlist.slot_filled": "waitlist-slot-filled",
};

function getWebhookPath(eventType: string): string {
  return EVENT_WEBHOOK_MAP[eventType] || eventType.replace(/\./g, "-");
}

// ─── Retry with exponential backoff ─────────────────────────────────────────

const N8N_DISPATCH_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function jitter(baseMs: number): number {
  return baseMs + Math.floor(Math.random() * baseMs * 0.3);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dispatchWithRetry(
  url: string,
  body: string,
  headers: Record<string, string>,
  maxAttempts: number,
): Promise<{ ok: boolean; status?: number; isRetryable: boolean }> {
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers,
        body,
      }, N8N_DISPATCH_TIMEOUT_MS);

      if (res.ok) {
        return { ok: true, status: res.status, isRetryable: false };
      }

      // 4xx = client error, don't retry (workflow misconfigured)
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, status: res.status, isRetryable: false };
      }

      // 5xx = server error, retryable
      if (attempt < maxAttempts) {
        const delayMs = jitter(1000 * Math.pow(2, attempt)); // 1s, 2s with jitter
        logger.debug("[n8n] Retrying dispatch", { attempt: attempt + 1, delayMs, status: res.status });
        await sleep(delayMs);
        continue;
      }

      return { ok: false, status: res.status, isRetryable: true };
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      const isNetworkError = err instanceof Error && (
        err.message.includes("ECONNREFUSED") ||
        err.message.includes("ECONNRESET") ||
        err.message.includes("ETIMEDOUT")
      );

      if ((isTimeout || isNetworkError) && attempt < maxAttempts) {
        const delayMs = jitter(1000 * Math.pow(2, attempt));
        logger.debug("[n8n] Retrying dispatch after error", { attempt: attempt + 1, delayMs, reason: isTimeout ? "timeout" : String(err) });
        await sleep(delayMs);
        continue;
      }

      return { ok: false, isRetryable: true };
    }
  }

  return { ok: false, isRetryable: true };
}

// ─── Dead Letter Queue ──────────────────────────────────────────────────────

/**
 * Enqueue a failed event to the dead letter queue.
 * Fire-and-forget — errors are swallowed to avoid blocking the event bus.
 */
export async function enqueueDeadLetter(event: EventPayload, error: string): Promise<void> {
  try {
    const { getDb } = await import("../db");
    const { n8nDeadLetterQueue } = await import("../../drizzle/schema");
    const db = await getDb();
    if (!db) return;

    await (db as any).insert(n8nDeadLetterQueue).values({
      tenantId: event.tenantId,
      eventId: event.id ?? null,
      eventType: event.type,
      payload: event as any,
      errorMessage: error,
      attempts: 0,
      maxAttempts: 5,
      status: "pending",
      createdAt: new Date(),
    });

    logger.info("[n8n] Event enqueued to DLQ", { eventType: event.type, tenantId: event.tenantId });
  } catch (err) {
    logger.error("[n8n] Failed to enqueue DLQ entry", { error: String(err) });
  }
}

/**
 * Reprocess pending DLQ entries by attempting to dispatch them again.
 * Called periodically by the worker.
 */
export async function reprocessDeadLetterQueue(db: any, limit: number = 10): Promise<number> {
  const { n8nDeadLetterQueue } = await import("../../drizzle/schema");
  const { eq, and, lt } = await import("drizzle-orm");

  if (!ENV.n8nEnabled || circuitBreaker.isOpen()) return 0;

  try {
    // Fetch pending DLQ entries
    const entries = await db
      .select()
      .from(n8nDeadLetterQueue)
      .where(eq(n8nDeadLetterQueue.status, "pending"))
      .orderBy(n8nDeadLetterQueue.createdAt)
      .limit(limit);

    let processed = 0;

    for (const entry of entries) {
      // Mark as reprocessing
      await db
        .update(n8nDeadLetterQueue)
        .set({ status: "reprocessing", lastAttemptAt: new Date() })
        .where(eq(n8nDeadLetterQueue.id, entry.id));

      try {
        const event = entry.payload as EventPayload;
        const handled = await dispatchToN8n(event, true); // skipDlq = true to avoid re-enqueue

        if (handled) {
          await db
            .update(n8nDeadLetterQueue)
            .set({ status: "succeeded", attempts: entry.attempts + 1 })
            .where(eq(n8nDeadLetterQueue.id, entry.id));
          processed++;
        } else {
          const newAttempts = entry.attempts + 1;
          const exhausted = newAttempts >= entry.maxAttempts;
          await db
            .update(n8nDeadLetterQueue)
            .set({
              status: exhausted ? "exhausted" : "pending",
              attempts: newAttempts,
              lastAttemptAt: new Date(),
            })
            .where(eq(n8nDeadLetterQueue.id, entry.id));
        }
      } catch (err) {
        // Revert to pending on unexpected errors
        const newAttempts = entry.attempts + 1;
        await db
          .update(n8nDeadLetterQueue)
          .set({
            status: newAttempts >= entry.maxAttempts ? "exhausted" : "pending",
            attempts: newAttempts,
            errorMessage: String(err),
            lastAttemptAt: new Date(),
          })
          .where(eq(n8nDeadLetterQueue.id, entry.id));
      }
    }

    if (processed > 0) {
      logger.info("[n8n] DLQ reprocessed", { processed, total: entries.length });
    }

    return processed;
  } catch (err) {
    logger.error("[n8n] DLQ reprocessing failed", { error: String(err) });
    return 0;
  }
}

// ─── Main dispatch function ─────────────────────────────────────────────────

/**
 * Dispatch an event to n8n. Returns true if n8n handled it.
 * @param skipDlq - When true, don't enqueue to DLQ on failure (used by DLQ reprocessing)
 */
export async function dispatchToN8n(event: EventPayload, skipDlq: boolean = false): Promise<boolean> {
  if (!ENV.n8nEnabled || !ENV.n8nBaseUrl) return false;

  // Circuit breaker check
  if (circuitBreaker.isOpen()) {
    logger.debug("[n8n] Circuit breaker OPEN — skipping dispatch", { eventType: event.type });
    if (!skipDlq) {
      await enqueueDeadLetter(event, "Circuit breaker open");
    }
    return false;
  }

  const path = getWebhookPath(event.type);
  const url = `${ENV.n8nBaseUrl}/webhook/${path}`;

  const body = JSON.stringify({
    eventId: event.id,
    eventType: event.type,
    tenantId: event.tenantId,
    leadId: (event as any).leadId,
    data: event,
    timestamp: new Date().toISOString(),
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (ENV.n8nApiKey) {
    headers["X-Rebooked-Key"] = ENV.n8nApiKey;
    headers["X-Rebooked-Signature"] = signPayload(body, ENV.n8nApiKey);
  }

  const result = await dispatchWithRetry(url, body, headers, ENV.n8nRetryMaxAttempts);

  if (result.ok) {
    circuitBreaker.recordSuccess();
    logger.debug("[n8n] Event dispatched successfully", { eventType: event.type, path });
    return true;
  }

  // Dispatch failed
  circuitBreaker.recordFailure();

  const errorMsg = result.status
    ? `Webhook returned ${result.status}`
    : "Dispatch failed after retries";

  logger.warn("[n8n] Dispatch failed — falling back to built-in engine", {
    eventType: event.type,
    status: result.status,
    retryable: result.isRetryable,
  });

  // Only DLQ retryable failures (5xx, timeouts). 4xx are config errors — don't DLQ.
  if (result.isRetryable && !skipDlq) {
    await enqueueDeadLetter(event, errorMsg);
  }

  return false;
}

// ─── Status & monitoring ────────────────────────────────────────────────────

export async function getN8nStatus(): Promise<{
  enabled: boolean;
  healthy: boolean;
  baseUrl: string;
  circuitBreaker: { state: CircuitState; failureCount: number; openedAt: number | null };
}> {
  const enabled = ENV.n8nEnabled;
  let healthy = false;

  if (enabled && !circuitBreaker.isOpen()) {
    try {
      const res = await fetchWithTimeout(`${ENV.n8nBaseUrl}/healthz`, { method: "GET" }, 3000);
      healthy = res.ok;
    } catch {
      healthy = false;
    }
  }

  return {
    enabled,
    healthy,
    baseUrl: ENV.n8nBaseUrl,
    circuitBreaker: circuitBreaker.getState(),
  };
}

export function getCircuitBreakerState() {
  return circuitBreaker.getState();
}

/**
 * Get the supported event-to-webhook mapping for admin UI.
 */
export function getEventWebhookMap(): Record<string, string> {
  return { ...EVENT_WEBHOOK_MAP };
}
