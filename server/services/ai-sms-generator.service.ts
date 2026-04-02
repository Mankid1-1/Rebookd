/**
 * AI SMS Generator Service
 * Uses LLM (Gemini 2.5 Flash via Forge) to generate personalised SMS messages,
 * with automatic fallback to in-house templates when the LLM is unavailable.
 */

import { eq } from "drizzle-orm";
import { leads, tenants } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { generateMessage } from "../_core/messageGenerator";
import type { MessageType, Tone } from "../_core/messageTemplates";
import { AppError, isAppError } from "../_core/appErrors";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AiMessageResult {
  body: string;
  method: "llm" | "template_fallback";
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildSystemPrompt(
  tenantName: string,
  industry: string | null,
  messageType: MessageType,
  tone: Tone,
  leadName: string | null,
  visitCount: number,
  loyaltyTier: string | null,
  variables: GenerateAiMessageVariables,
): string {
  const lines: string[] = [
    `You are an SMS copywriter for ${tenantName}${industry ? ` (${industry.replace("_", " ")})` : ""}.`,
    `Generate a ${tone} ${messageType.replace("_", " ")} message.`,
    "",
    "Lead context:",
    `- Name: ${leadName ?? "Customer"}`,
    `- Visit count: ${visitCount}`,
    ...(loyaltyTier ? [`- Loyalty tier: ${loyaltyTier}`] : []),
    "",
    "Rules:",
    "- Maximum 160 characters.",
    "- Include a clear call-to-action.",
    "- No emojis.",
    "- Professional but warm tone.",
    "- Return ONLY the SMS text, nothing else.",
  ];

  if (variables.bookingLink) {
    lines.push(`- Include this booking link: ${variables.bookingLink}`);
  }
  if (variables.reviewLink) {
    lines.push(`- Include this review link: ${variables.reviewLink}`);
  }

  return lines.join("\n");
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

  // 3. Build the LLM prompt
  const systemPrompt = buildSystemPrompt(
    variables.businessName ?? tenant.name,
    tenant.industry,
    messageType,
    tone,
    lead.name,
    lead.visitCount,
    lead.loyaltyTier,
    variables,
  );

  // 4. Attempt LLM generation
  const startMs = Date.now();

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Write a ${tone} ${messageType.replace("_", " ")} SMS for ${lead.name ?? "the customer"}.`,
        },
      ],
      maxTokens: 256,
    });

    const latencyMs = Date.now() - startMs;

    // 5. Extract the message text
    const choice = result.choices?.[0];
    let body: string;

    if (typeof choice?.message?.content === "string") {
      body = choice.message.content.trim();
    } else if (Array.isArray(choice?.message?.content)) {
      const textPart = choice.message.content.find((p) => p.type === "text");
      body = textPart && "text" in textPart ? textPart.text.trim() : "";
    } else {
      body = "";
    }

    // Strip surrounding quotes if the LLM wrapped the response
    if (body.startsWith('"') && body.endsWith('"')) {
      body = body.slice(1, -1);
    }

    // Enforce 160-char limit
    if (body.length > 160) {
      body = body.substring(0, 157).replace(/\s+\S*$/, "") + "...";
    }

    if (!body) {
      // Empty response — fall through to template fallback
      throw new AppError("LLM_UPSTREAM_ERROR", "LLM returned empty content", 502, true);
    }

    logger.info("AI SMS generated via LLM", {
      tenantId,
      leadId,
      messageType,
      latencyMs,
      chars: body.length,
    });

    return {
      body,
      method: "llm",
      promptTokens: result.usage?.prompt_tokens,
      completionTokens: result.usage?.completion_tokens,
      latencyMs,
    };
  } catch (error: unknown) {
    // 6. Fallback to template generator on LLM errors
    const isLlmError =
      isAppError(error) &&
      (error.code === "LLM_CIRCUIT_OPEN" ||
        error.code === "LLM_TIMEOUT" ||
        error.code === "LLM_UPSTREAM_ERROR");

    if (!isLlmError) {
      throw error; // Re-throw non-LLM errors
    }

    logger.warn("AI SMS falling back to template", {
      tenantId,
      leadId,
      messageType,
      reason: isAppError(error) ? error.code : "unknown",
    });

    const fallbackBody = generateMessage({
      type: messageType,
      tone,
      variables: {
        name: lead.name ?? "there",
        business: variables.businessName ?? tenant.name,
        ...variables,
      },
      maxChars: 160,
    });

    return {
      body: fallbackBody,
      method: "template_fallback",
      latencyMs: Date.now() - startMs,
    };
  }
}
