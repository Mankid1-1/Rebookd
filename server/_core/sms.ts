/**
 * Provider-agnostic SMS layer.
 */

import { ENV } from "./env";
import { isAppError } from "./appErrors";
import { logger } from "./logger";
import { getDb } from "../db";
import { assertSmsHourlyDailyLimits, assertSmsRateLimitAvailable } from "../services/rateLimit.service";
import { assertUsageCapAvailable } from "../services/usage.service";

const SMS_HTTP_TIMEOUT_MS = parseInt(process.env.SMS_HTTP_TIMEOUT_MS || "30000", 10);

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

async function sendViaTelnyx(to: string, body: string, from: string): Promise<SMSResult> {
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
  const guardResult = await guardOutboundSend(tenantId);
  if (guardResult) return guardResult;

  if (ENV.telnyxApiKey) {
    const fromNumber = from || ENV.telnyxFromNumber;
    if (!fromNumber) {
      logger.warn("TELNYX_FROM_NUMBER not set");
    } else {
      return sendViaTelnyx(to, body, fromNumber);
    }
  }

  if (ENV.twilioAccountSid && ENV.twilioAuthToken) {
    const fromNumber = from || ENV.twilioFromNumber;
    if (!fromNumber) {
      logger.warn("TWILIO_FROM_NUMBER not set");
    } else {
      return sendViaTwilio(to, body, fromNumber);
    }
  }

  logger.warn("No SMS provider configured", { to });
  return { success: true, sid: `dev_${Date.now()}`, provider: "dev" };
}

export function resolveTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    return val != null ? String(val) : "";
  });
}
