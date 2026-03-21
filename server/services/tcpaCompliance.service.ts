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

  // Additional business rules can be added here
  // For example: consent age limits, source validation, etc.

  return { allowed: true };
}

export function generateTcpaConsentText(businessName: string): string {
  return `By providing your phone number, you consent to receive marketing text messages from ${businessName}. Message and data rates may apply. Message frequency varies. Reply STOP to unsubscribe. Reply HELP for help. Consent is not a condition of purchase.`;
}
