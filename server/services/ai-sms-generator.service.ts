/**
 * AI SMS Generator Service
 * Fully in-house template engine — generates personalised SMS messages
 * from 20 types x 5 tones with lead-specific variable substitution.
 * Zero external API dependency. Instant. Free.
 */

import { eq } from "drizzle-orm";
import { leads, tenants } from "../../drizzle/schema";
import { generateMessage } from "../_core/messageGenerator";
import { rewriteInTone } from "../_core/messageRewriter";
import type { MessageType, Tone } from "../_core/messageTemplates";
import { AppError } from "../_core/appErrors";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AiMessageResult {
  body: string;
  method: "template" | "llm" | "template_fallback";
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
}

export interface GenerateAiMessageVariables {
  bookingLink?: string;
  reviewLink?: string;
  businessName?: string;
  [key: string]: unknown;
}

// ─── Main Generator ─────────────────────────────────────────────────────────

export async function generateAiMessage(
  db: Db,
  tenantId: number,
  leadId: number,
  messageType: MessageType,
  tone: Tone,
  variables: GenerateAiMessageVariables = {},
): Promise<AiMessageResult> {
  const startMs = Date.now();

  // 1. Fetch lead context
  const [lead] = await db
    .select({
      name: leads.name,
      visitCount: leads.visitCount,
      loyaltyTier: leads.loyaltyTier,
      appointmentAt: leads.appointmentAt,
      status: leads.status,
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead) {
    throw new AppError("PHONE_INVALID", `Lead ${leadId} not found`, 404, false);
  }

  // 2. Fetch tenant context
  const [tenant] = await db
    .select({
      name: tenants.name,
      industry: tenants.industry,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new AppError("PHONE_INVALID", `Tenant ${tenantId} not found`, 404, false);
  }

  // 3. Generate message from in-house template engine
  const templateVars: Record<string, string> = {
    name: lead.name ?? "there",
    business: variables.businessName ?? tenant.name,
  };

  // Add loyalty-aware context
  if (lead.loyaltyTier) templateVars.tier = lead.loyaltyTier;
  if (lead.visitCount > 5) templateVars.visits = String(lead.visitCount);

  // Merge any extra variables (bookingLink, reviewLink, etc.)
  for (const [k, v] of Object.entries(variables)) {
    if (typeof v === "string") templateVars[k] = v;
  }

  let body = generateMessage({
    type: messageType,
    tone,
    variables: templateVars,
    maxChars: 160,
  });

  // 4. Apply tone rewriting for extra polish
  body = rewriteInTone(body, tone);

  // 5. Enforce 160-char SMS limit
  if (body.length > 160) {
    body = body.substring(0, 157).replace(/\s+\S*$/, "") + "...";
  }

  const latencyMs = Date.now() - startMs;

  logger.info("AI SMS generated via template engine", {
    tenantId,
    leadId,
    messageType,
    tone,
    latencyMs,
    chars: body.length,
  });

  return {
    body,
    method: "template",
    latencyMs,
  };
}
