/**
 * 📞 TRACKING NUMBER SERVICE
 * Provisions Twilio/Telnyx phone numbers for automatic call tracking.
 * All calls route through the tracking number → get auto-logged → forwarded to business phone.
 *
 * Flow:
 * 1. Business gets a tracking number (Twilio/Telnyx)
 * 2. Inbound: Caller → Tracking Number → auto-logged → forwarded to business phone
 * 3. Outbound: Employee clicks "Call" → Twilio connects employee phone to lead → auto-logged
 */

import type { Db } from "../_core/context";
import { phoneNumbers, tenants } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { stripe } from "../_core/stripe";
import { ENV } from "../_core/env";
import { logger } from "../_core/logger";

// Lazy-import Twilio to avoid crash if not configured
let twilioClient: any = null;
function getTwilioClient() {
  if (twilioClient) return twilioClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  try {
    const Twilio = require("twilio");
    twilioClient = new Twilio(sid, token);
    return twilioClient;
  } catch {
    return null;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AvailableNumber {
  number: string;
  friendlyName: string;
  locality?: string;
  region?: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
  monthlyFee: number; // cents
}

export interface ProvisionedNumber {
  id: number;
  number: string;
  forwardTo: string | null;
  twilioSid: string;
  provider: string;
  status: string;
}

// ─── Search Available Numbers ────────────────────────────────────────────────

/**
 * Search for available Twilio phone numbers in a given area code or region.
 */
export async function searchAvailableNumbers(
  areaCode?: string,
  country: string = "US",
  limit: number = 10
): Promise<AvailableNumber[]> {
  const twilio = getTwilioClient();
  if (!twilio) {
    throw new Error("Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
  }

  try {
    const search: any = { voiceEnabled: true, limit };
    if (areaCode) search.areaCode = areaCode;

    const numbers = await twilio.availablePhoneNumbers(country).local.list(search);

    return numbers.map((n: any) => ({
      number: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality,
      region: n.region,
      capabilities: {
        voice: n.capabilities?.voice ?? true,
        sms: n.capabilities?.sms ?? false,
        mms: n.capabilities?.mms ?? false,
      },
      monthlyFee: 150, // ~$1.50/mo for Twilio local numbers (in cents)
    }));
  } catch (error: any) {
    logger.error("[TrackingNumber] Failed to search available numbers:", { error: error.message });
    throw new Error("Failed to search available numbers");
  }
}

// ─── Provision a Tracking Number ─────────────────────────────────────────────

/**
 * Buy a Twilio number and configure it as a tracking number for a tenant.
 * Sets voice webhook URL to our call tracking endpoint.
 */
export async function provisionTrackingNumber(
  db: Db,
  tenantId: number,
  phoneNumber: string,
  forwardTo: string,
  label?: string
): Promise<ProvisionedNumber> {
  const twilio = getTwilioClient();
  if (!twilio) {
    throw new Error("Twilio is not configured");
  }

  // Build webhook URLs
  const baseUrl = ENV.backendUrl || process.env.APP_URL || "https://rebooked.org";
  const voiceWebhookUrl = `${baseUrl}/api/webhooks/voice/twilio`;
  const statusCallbackUrl = `${baseUrl}/api/webhooks/voice/twilio`;

  try {
    // Purchase the number from Twilio
    const purchased = await twilio.incomingPhoneNumbers.create({
      phoneNumber,
      voiceUrl: voiceWebhookUrl,
      voiceMethod: "POST",
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: "POST",
      friendlyName: `Rebooked Tracking - ${label || "Main"}`,
    });

    // Save to our database
    const [result] = await db.insert(phoneNumbers).values({
      tenantId,
      number: purchased.phoneNumber,
      label: label || "Tracking Number",
      isDefault: true,
      isInbound: true,
      forwardTo,
      type: "tracking",
      provider: "twilio",
      capabilities: {
        voice: purchased.capabilities?.voice ?? true,
        sms: purchased.capabilities?.sms ?? false,
        mms: purchased.capabilities?.mms ?? false,
      },
      monthlyFee: 150,
      status: "active",
      twilioSid: purchased.sid,
    });

    const insertId = (result as any).insertId as number;

    logger.info("[TrackingNumber] Provisioned tracking number", {
      tenantId,
      number: purchased.phoneNumber,
      forwardTo,
      sid: purchased.sid,
    });

    return {
      id: insertId,
      number: purchased.phoneNumber,
      forwardTo,
      twilioSid: purchased.sid,
      provider: "twilio",
      status: "active",
    };
  } catch (error: any) {
    logger.error("[TrackingNumber] Failed to provision:", { error: error.message, phoneNumber, tenantId });
    throw new Error(`Failed to provision number: ${error.message}`);
  }
}

// ─── Get Tenant's Tracking Number ────────────────────────────────────────────

/**
 * Get the active tracking number for a tenant.
 */
export async function getTrackingNumber(db: Db, tenantId: number) {
  const [row] = await db
    .select()
    .from(phoneNumbers)
    .where(and(
      eq(phoneNumbers.tenantId, tenantId),
      eq(phoneNumbers.type, "tracking"),
      eq(phoneNumbers.status, "active"),
    ))
    .limit(1);

  return row ?? null;
}

/**
 * Get all phone numbers for a tenant.
 */
export async function getTenantNumbers(db: Db, tenantId: number) {
  return db
    .select()
    .from(phoneNumbers)
    .where(and(eq(phoneNumbers.tenantId, tenantId), eq(phoneNumbers.status, "active")));
}

// ─── Update Forward-To Number ────────────────────────────────────────────────

export async function updateForwardTo(db: Db, tenantId: number, phoneId: number, forwardTo: string) {
  await db
    .update(phoneNumbers)
    .set({ forwardTo })
    .where(and(eq(phoneNumbers.id, phoneId), eq(phoneNumbers.tenantId, tenantId)));
}

// ─── Release a Tracking Number ───────────────────────────────────────────────

export async function releaseTrackingNumber(db: Db, tenantId: number, phoneId: number) {
  const [row] = await db
    .select()
    .from(phoneNumbers)
    .where(and(eq(phoneNumbers.id, phoneId), eq(phoneNumbers.tenantId, tenantId)))
    .limit(1);

  if (!row || !row.twilioSid) return;

  const twilio = getTwilioClient();
  if (twilio && row.twilioSid) {
    try {
      await twilio.incomingPhoneNumbers(row.twilioSid).remove();
    } catch (err: any) {
      logger.warn("[TrackingNumber] Failed to release from Twilio:", { error: err.message });
    }
  }

  await db
    .update(phoneNumbers)
    .set({ status: "released", deletedAt: new Date() })
    .where(eq(phoneNumbers.id, phoneId));
}

// ─── Initiate Outbound Call ──────────────────────────────────────────────────

/**
 * Connect an employee to a lead via Twilio.
 * Twilio calls the employee first, then bridges to the lead.
 * Both legs are logged automatically via the voice webhook.
 */
export async function initiateOutboundCall(
  db: Db,
  tenantId: number,
  employeePhone: string,
  leadPhone: string
): Promise<{ callSid: string }> {
  const twilio = getTwilioClient();
  if (!twilio) throw new Error("Twilio is not configured");

  // Get tenant's tracking number as the caller ID
  const trackingNum = await getTrackingNumber(db, tenantId);
  if (!trackingNum) {
    throw new Error("No tracking number provisioned. Set up a tracking number first.");
  }

  const baseUrl = ENV.backendUrl || process.env.APP_URL || "https://rebooked.org";

  try {
    // Twilio calls the employee first, then TwiML connects to the lead
    const call = await twilio.calls.create({
      to: employeePhone,
      from: trackingNum.number,
      url: `${baseUrl}/api/webhooks/voice/twilio/connect?to=${encodeURIComponent(leadPhone)}&tenantId=${tenantId}`,
      statusCallback: `${baseUrl}/api/webhooks/voice/twilio`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
    });

    logger.info("[TrackingNumber] Outbound call initiated", {
      tenantId,
      from: trackingNum.number,
      employee: employeePhone,
      lead: leadPhone,
      callSid: call.sid,
    });

    return { callSid: call.sid };
  } catch (error: any) {
    logger.error("[TrackingNumber] Outbound call failed:", { error: error.message });
    throw new Error(`Failed to initiate call: ${error.message}`);
  }
}
