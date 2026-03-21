import { ENV } from "./env";

export interface SMSResult {
  success: boolean;
  sid?: string;
  error?: string;
}

/**
 * Sends an SMS via Twilio. Returns success/failure without throwing.
 * If Twilio is not configured, logs a warning and returns a simulated success
 * so the app remains functional in development.
 */
type RateLimitEntry = { count: number; resetAt: number };
const rateLimitMap: Record<number, RateLimitEntry> = {};
const RATE_LIMIT_MAX = parseInt(process.env.SMS_RATE_LIMIT || "60", 10); // per TENANT, per minute

export async function sendSMS(to: string, body: string, from?: string, tenantId?: number): Promise<SMSResult> {
  const fromNumber = from || ENV.twilioFromNumber;

  if (tenantId) {
    const now = Date.now();
    const entry = rateLimitMap[tenantId];
    if (!entry || entry.resetAt < now) {
      rateLimitMap[tenantId] = { count: 1, resetAt: now + 60_000 };
    } else {
      if (entry.count >= RATE_LIMIT_MAX) {
        const err = `Rate limit exceeded (${RATE_LIMIT_MAX} SMS/min)`;
        console.warn(`[SMS] ${err} for tenant ${tenantId}`);
        return { success: false, error: err };
      }
      entry.count += 1;
    }
  }

  if (!ENV.twilioAccountSid || !ENV.twilioAuthToken || !fromNumber) {
    console.warn(
      `[SMS] Twilio not configured — message to ${to} not sent. ` +
      `Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in .env to enable real SMS.`
    );
    // Return success so the app works in dev without Twilio
    return { success: true, sid: `dev_${Date.now()}` };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${ENV.twilioAccountSid}/Messages.json`;
    const auth = Buffer.from(`${ENV.twilioAccountSid}:${ENV.twilioAuthToken}`).toString("base64");

    const smsParams = new URLSearchParams({
      From: fromNumber,
      To: to,
      Body: body,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: smsParams.toString(),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      console.error(`[SMS] Twilio error ${response.status}:`, data);
      return { success: false, error: data.message || `HTTP ${response.status}` };
    }

    console.log(`[SMS] Sent to ${to}, SID: ${data.sid}`);
    return { success: true, sid: data.sid };
  } catch (error) {
    console.error("[SMS] Failed to send:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Resolves template variables in a message body.
 * e.g. {{name}} => "Jane", {{business}} => "Bloom Beauty"
 */
export function resolveTemplate(
  template: string,
  vars: Record<string, string | undefined>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}
