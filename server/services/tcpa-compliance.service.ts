import { eq, and } from "drizzle-orm";
import { leads } from "../../drizzle/schema";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";

export interface ConsentRecord {
  smsConsentAt?: Date;
  smsConsentSource?: string;
  tcpaConsentText?: string;
}

export async function recordSmsConsent(
  db: Db,
  tenantId: number,
  leadId: number,
  consent: ConsentRecord,
) {
  await db
    .update(leads)
    .set({
      smsConsentAt: consent.smsConsentAt || new Date(),
      smsConsentSource: consent.smsConsentSource,
      tcpaConsentText: consent.tcpaConsentText,
      updatedAt: new Date(),
    })
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));
  
  logger.info("SMS consent recorded", { tenantId, leadId, source: consent.smsConsentSource });
}

export async function hasSmsConsent(
  db: Db,
  tenantId: number,
  leadId: number,
): Promise<boolean> {
  const [lead] = await db
    .select({ smsConsentAt: leads.smsConsentAt, status: leads.status })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .limit(1);
    
  // Must have explicit consent and not be unsubscribed
  return !!(lead?.smsConsentAt && lead.status !== "unsubscribed");
}

export async function recordUnsubscribe(
  db: Db,
  tenantId: number,
  leadId: number,
  method: "sms_stop" | "manual" | "api" = "manual",
) {
  await db
    .update(leads)
    .set({
      status: "unsubscribed",
      unsubscribedAt: new Date(),
      unsubscribeMethod: method,
      updatedAt: new Date(),
    })
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));
    
  logger.info("Lead unsubscribed", { tenantId, leadId, method });
}

export async function canSendSms(
  db: Db,
  tenantId: number,
  leadId: number,
): Promise<{ allowed: boolean; reason?: string }> {
  const [lead] = await db
    .select({
      status: leads.status,
      smsConsentAt: leads.smsConsentAt,
      smsConsentSource: leads.smsConsentSource,
      unsubscribedAt: leads.unsubscribedAt,
    })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .limit(1);

  if (!lead) {
    return { allowed: false, reason: "Lead not found" };
  }

  if (lead.status === "unsubscribed") {
    return { allowed: false, reason: "Lead has unsubscribed" };
  }

  if (!lead.smsConsentAt) {
    return { allowed: false, reason: "No SMS consent on record" };
  }

  // ── TCPA Consent Age Limit (FCC 2-year recommendation) ──────────────
  // Consent older than 2 years should be treated as expired.
  // The business must re-obtain consent before continuing to message.
  const CONSENT_MAX_AGE_MS = 2 * 365.25 * 24 * 60 * 60 * 1000; // ~2 years
  const consentAge = Date.now() - new Date(lead.smsConsentAt).getTime();
  if (consentAge > CONSENT_MAX_AGE_MS) {
    const ageMonths = Math.round(consentAge / (30.44 * 24 * 60 * 60 * 1000));
    logger.warn("TCPA: SMS consent expired (older than 2 years)", {
      tenantId, leadId, consentAge: `${ageMonths} months`,
      smsConsentAt: lead.smsConsentAt,
    });
    return { allowed: false, reason: `SMS consent expired (${ageMonths} months old — re-consent required)` };
  }

  return { allowed: true };
}

export function generateTcpaConsentText(businessName: string): string {
  return `By providing your phone number, you consent to receive marketing text messages from ${businessName}. Message and data rates may apply. Message frequency varies. Reply STOP to unsubscribe. Reply HELP for help. Consent is not a condition of purchase.`;
}

// ─── FIX #6: Consent Text Validation ────────────────────────────────────────
// TCPA requires consent language to include STOP/HELP disclosures and frequency info.

const REQUIRED_CONSENT_KEYWORDS = ["stop", "help", "message"];

/**
 * Validate that consent text includes TCPA-required disclosures.
 * Returns { valid, missing } — missing lists the keywords not found.
 */
export function validateConsentText(text: string): { valid: boolean; missing: string[] } {
  const lower = text.toLowerCase();
  const missing = REQUIRED_CONSENT_KEYWORDS.filter((kw) => !lower.includes(kw));
  return { valid: missing.length === 0, missing };
}

/**
 * Enhanced consent recording with text validation.
 */
export async function recordSmsConsentValidated(
  db: Db,
  tenantId: number,
  leadId: number,
  consent: ConsentRecord,
): Promise<{ success: boolean; validationErrors?: string[] }> {
  if (consent.tcpaConsentText) {
    const { valid, missing } = validateConsentText(consent.tcpaConsentText);
    if (!valid) {
      logger.warn("TCPA consent text missing required disclosures", {
        tenantId, leadId, missing,
      });
      return { success: false, validationErrors: missing.map((kw) => `Missing required keyword: "${kw}"`) };
    }
  }

  await recordSmsConsent(db, tenantId, leadId, consent);
  return { success: true };
}
