// AI service — provides rewriteMessage + re-exports from ai.service.ts for logging
import { rewriteInTone } from "../_core/messageRewriter";
import type { Tone } from "../_core/messageTemplates";

export function rewriteMessage(message: string, tone?: string): string {
  return rewriteInTone(message, (tone ?? "friendly") as Tone);
}

// Re-export AI logging functions from the canonical service
export { getAiLogs, createAiLog } from "./ai.service";
