import { rewriteInTone } from "../_core/messageRewriter";
import type { Tone } from "../_core/messageTemplates";

export function rewriteMessage(message: string, tone?: string): string {
  return rewriteInTone(message, (tone ?? "friendly") as Tone);
}
