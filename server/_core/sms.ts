/**
 * Provider-agnostic SMS layer.
 */

import { ENV } from "./env";
import { isAppError } from "./appErrors";
import { logger } from "./logger";
import { getDb } from "../db";
import { eq, and, isNull } from "drizzle-orm";
import { phoneNumbers } from "../../drizzle/schema";
import { assertSmsHourlyDailyLimits, assertSmsRateLimitAvailable } from "../services/rate-limit.service";
import { assertUsageCapAvailable } from "../services/usage.service";

const SMS_HTTP_TIMEOUT_MS = parseInt(process.env.SMS_HTTP_TIMEOUT_MS || "30000", 10);

// ─── SMS Circuit Breaker ─────────────────────────────────────────────────────
// Prevents hammering a down SMS provider. Opens after 5 consecutive failures,
// resets after 2 minutes of quiet time (half-open on first retry).
class SmsCircuitBreaker {
  private failures = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  private openedAt = 0;
  private readonly maxFailures: number;
  private readonly resetMs: number;

  constructor(maxFailures = 5, resetMs = 120_000) {
    this.maxFailures = maxFailures;
    this.resetMs = resetMs;
  }

  canSend(): boolean {
    if (this.state === "closed") return true;
    if (this.state === "open") {
      if (Date.now() - this.openedAt > this.resetMs) {
        this.state = "half-open";
        return true; // Allow one probe
      }
      return false;
    }
    // half-open: already allowed one probe
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.failures++;
    if (this.failures >= this.maxFailures) {
      this.state = "open";
      this.openedAt = Date.now();
      logger.error("SMS circuit breaker OPENED — provider appears down", {
        failures: this.failures,
        resetMs: this.resetMs,
      });
    }
  }

  getState(): string { return this.state; }
  getFailures(): number { return this.failures; }
}

export const smsCircuitBreaker = new SmsCircuitBreaker();
const textLinkSmsCircuitBreaker = new SmsCircuitBreaker();

async function fetchSmsProvider(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; data: unknown; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SMS_HTTP_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    return { ok: response.ok, status: response.status, data, text };
  } catch (error) {
    const msg = error instanceof Error && error.name === "AbortError" ? `SMS request timed out after ${SMS_HTTP_TIMEOUT_MS}ms` : String(error);
    logger.warn("SMS provider fetch failed", { url, error: msg });
    return { ok: false, status: 0, data: {}, text: msg };
  } finally {
    clearTimeout(timer);
  }
}

export interface SMSResult {
  success: boolean;
  sid?: string;
  error?: string;
  provider?: string;
  errorCode?: string;
  retryCount?: number;
}

async function guardOutboundSend(tenantId?: number): Promise<SMSResult | null> {
  if (!tenantId) return null;

  try {
    const db = await getDb();
    if (db) {
      await assertSmsRateLimitAvailable(db as any, tenantId);
      await assertSmsHourlyDailyLimits(db as any, tenantId);
      await assertUsageCapAvailable(db as any, tenantId);
    }
    return null;
  } catch (error) {
    if (isAppError(error)) {
      logger.warn("SMS blocked before provider call", { tenantId, code: error.code, message: error.message });
      return {
        success: false,
        error: error.message,
        errorCode: error.code,
      };
    }
    throw error;
  }
}

async function sendViaTextLinkSms(to: string, body: string): Promise<SMSResult> {
  const { ok, data, text } = await fetchSmsProvider("https://textlinksms.com/api/send-sms", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.textLinkSmsApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone_number: to, text: body }),
  });

  const d = data as { ok?: boolean; message?: string; queued?: boolean };
  if (!ok || !d?.ok) {
    const message = d?.message || text || "TextLinkSMS request failed";
    logger.warn("TextLinkSMS send failed", { to, error: message });
    return { success: false, error: message, provider: "textlinksms", errorCode: "TEXTLINKSMS_ERROR" };
  }

  if (d?.queued) {
    logger.info("TextLinkSMS queued (senders busy) — will deliver when available", { to });
  }

  return { success: true, provider: "textlinksms" };
}

async function sendViaPhoneservice(to: string, body: string, from: string, tenantId?: number): Promise<SMSResult> {
  const { ok, data, text } = await fetchSmsProvider(`${ENV.phoneserviceUrl}/api/sms/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.phoneserviceApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, body, from, tenantId }),
  });

  const d = data as { success?: boolean; messageId?: number; error?: string };
  if (!ok || !d?.success) {
    const message = d?.error || text || "Phoneservice request failed";
    logger.warn("Phoneservice send failed", { to, error: message });
    return { success: false, error: message, provider: "phoneservice", errorCode: "PHONESERVICE_ERROR" };
  }

  return { success: true, sid: d.messageId ? String(d.messageId) : undefined, provider: "phoneservice" };
}

async function sendViaTelnyx(to: string, body: string, from: string): Promise<SMSResult> {
  // Log when sending to international (non-US/Canada) numbers.
  // Telnyx may require different sender IDs or international messaging to be enabled on the number.
  if (!to.startsWith("+1")) {
    logger.info("Sending SMS to international number via Telnyx", { to: to.slice(0, 5) + "***", from });
  }

  const { ok, data, text } = await fetchSmsProvider("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.telnyxApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, text: body }),
  });

  const d = data as { errors?: { detail?: string }[]; message?: string; data?: { id?: string } };
  if (!ok) {
    const message = d?.errors?.[0]?.detail || d?.message || text || "Telnyx request failed";
    logger.warn("Telnyx send failed", { to, error: message });
    return { success: false, error: message, provider: "telnyx", errorCode: "TELNYX_ERROR" };
  }

  return { success: true, sid: d?.data?.id, provider: "telnyx" };
}

async function sendViaTwilio(to: string, body: string, from: string): Promise<SMSResult> {
  const auth = Buffer.from(`${ENV.twilioAccountSid}:${ENV.twilioAuthToken}`).toString("base64");
  const { ok, data, text } = await fetchSmsProvider(
    `https://api.twilio.com/2010-04-01/Accounts/${ENV.twilioAccountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
    },
  );

  const d = data as { message?: string; sid?: string };
  if (!ok) {
    const message = d?.message || text || "Twilio request failed";
    logger.warn("Twilio send failed", { to, error: message });
    return { success: false, error: message, provider: "twilio", errorCode: "TWILIO_ERROR" };
  }

  return { success: true, sid: d?.sid, provider: "twilio" };
}

export async function sendSMS(to: string, body: string, from?: string, tenantId?: number): Promise<SMSResult> {
  // Validate E.164 format before attempting to send
  if (!/^\+[1-9]\d{1,14}$/.test(to)) {
    logger.warn("SMS recipient not in E.164 format", { to });
    return { success: false, error: "Phone number must be in E.164 format (e.g. +1234567890)", provider: "none", errorCode: "INVALID_PHONE" };
  }

  // Circuit breaker check — fail fast if SMS provider is down
  if (!smsCircuitBreaker.canSend()) {
    logger.warn("SMS circuit breaker OPEN — blocking send", { to, provider: "all" });
    return { success: false, error: "SMS provider circuit breaker open — retrying later", provider: "none", errorCode: "CIRCUIT_OPEN" };
  }

  const guardResult = await guardOutboundSend(tenantId);
  if (guardResult) return guardResult;

  // TextLinkSMS — primary provider. Falls through to next provider on failure.
  if (ENV.textLinkSmsApiKey && textLinkSmsCircuitBreaker.canSend()) {
    const tlsResult = await sendViaTextLinkSms(to, body);
    if (tlsResult.success) {
      textLinkSmsCircuitBreaker.recordSuccess();
      smsCircuitBreaker.recordSuccess();
      return tlsResult;
    }
    textLinkSmsCircuitBreaker.recordFailure();
    logger.info("TextLinkSMS failed — falling through to next provider", { to });
  }

  // Phoneservice (self-hosted Android SMS gateway) — try first if configured
  if (ENV.phoneserviceUrl && ENV.phoneserviceApiKey) {
    let fromNumber = from;
    // Resolve per-tenant from number if not explicitly provided
    if (!fromNumber && tenantId) {
      try {
        const db = await getDb();
        if (db) {
          const [defaultNum] = await db
            .select({ number: phoneNumbers.number })
            .from(phoneNumbers)
            .where(
              and(
                eq(phoneNumbers.tenantId, tenantId),
                eq(phoneNumbers.isDefault, true),
                isNull(phoneNumbers.deletedAt),
              ),
            )
            .limit(1);
          if (defaultNum) fromNumber = defaultNum.number;
        }
      } catch (err) {
        logger.warn("Failed to resolve tenant from-number", { tenantId, error: String(err) });
      }
    }
    const phoneResult = await sendViaPhoneservice(to, body, fromNumber || ENV.telnyxFromNumber || ENV.twilioFromNumber || "", tenantId);
    phoneResult.success ? smsCircuitBreaker.recordSuccess() : smsCircuitBreaker.recordFailure();
    return phoneResult;
  }

  if (ENV.telnyxApiKey) {
    const fromNumber = from || ENV.telnyxFromNumber;
    if (!fromNumber) {
      logger.warn("TELNYX_FROM_NUMBER not set");
    } else {
      const telnyxResult = await sendViaTelnyx(to, body, fromNumber);
      telnyxResult.success ? smsCircuitBreaker.recordSuccess() : smsCircuitBreaker.recordFailure();
      return telnyxResult;
    }
  }

  if (ENV.twilioAccountSid && ENV.twilioAuthToken) {
    const fromNumber = from || ENV.twilioFromNumber;
    if (!fromNumber) {
      logger.warn("TWILIO_FROM_NUMBER not set");
    } else {
      const twilioResult = await sendViaTwilio(to, body, fromNumber);
      twilioResult.success ? smsCircuitBreaker.recordSuccess() : smsCircuitBreaker.recordFailure();
      return twilioResult;
    }
  }

  if (process.env.NODE_ENV === "production") {
    logger.error("No SMS provider configured in production", { to });
    return { success: false, error: "No SMS provider configured", provider: "none" };
  }

  logger.warn("No SMS provider configured — using dev fallback", { to });
  return { success: true, sid: `dev_${Date.now()}`, provider: "dev" };
}

export function resolveTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    return val != null ? String(val) : "";
  });
}
