/**
 * In-house message generator for Rebooked AI.
 * Drop-in replacement for invokeLLM — zero external API tokens.
 */

import { resolveTemplate } from "./sms";
import { MESSAGE_TEMPLATES, type MessageType, type Tone } from "./messageTemplates";

export type { MessageType, Tone } from "./messageTemplates";

export interface GenerateMessageParams {
  type: MessageType;
  tone: Tone;
  variables: Record<string, unknown>;
  maxChars?: number;
}

/** Lookup index built once at import time */
const templateIndex = new Map<string, string[]>();
for (const entry of MESSAGE_TEMPLATES) {
  templateIndex.set(`${entry.type}:${entry.tone}`, entry.templates);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a message from the in-house template pool.
 * Synchronous — no API calls, no tokens, no cost.
 */
export function generateMessage(params: GenerateMessageParams): string {
  const { type, tone, variables, maxChars = 160 } = params;

  // Try exact match first, then fall back to friendly, then generic
  let templates =
    templateIndex.get(`${type}:${tone}`) ??
    templateIndex.get(`${type}:friendly`) ??
    templateIndex.get(`generic:${tone}`) ??
    templateIndex.get(`generic:friendly`);

  if (!templates || templates.length === 0) {
    // Absolute fallback
    const name = variables.name ?? variables.first_name ?? "there";
    return `Hi ${name}, thanks for choosing us! Reply for more info.`;
  }

  const template = pickRandom(templates);
  let resolved = resolveTemplate(template, variables);

  // Enforce character limit
  if (resolved.length > maxChars) {
    resolved = resolved.substring(0, maxChars - 3).replace(/\s+\S*$/, "") + "...";
  }

  return resolved;
}

/**
 * Generate multiple variations for the same params (useful for UI previews).
 */
export function generateMessageVariations(
  params: GenerateMessageParams,
  count: number = 3
): string[] {
  const results = new Set<string>();
  let attempts = 0;
  while (results.size < count && attempts < count * 3) {
    results.add(generateMessage(params));
    attempts++;
  }
  return Array.from(results);
}
