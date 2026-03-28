/**
 * In-house message tone rewriter for Rebooked AI.
 * Applies rule-based transformations — zero external API tokens.
 */

import type { Tone } from "./messageTemplates";

interface ToneRules {
  greetings: string[];
  closers: string[];
  replacements: [RegExp, string][];
}

const TONE_RULES: Record<Tone, ToneRules> = {
  friendly: {
    greetings: ["Hi", "Hey", "Hi there"],
    closers: ["See you soon!", "Can't wait!", "Talk soon!"],
    replacements: [
      [/\bDear\b/gi, "Hi"],
      [/\bplease\b/gi, ""],
      [/\bregarding\b/gi, "about"],
      [/\binquiry\b/gi, "question"],
      [/\bschedule\b/gi, "book"],
      [/\bappointment\b/gi, "appt"],
      [/\bimmediately\b/gi, "soon"],
      [/\bURGENT:?\s*/gi, ""],
      [/\bACTION REQUIRED:?\s*/gi, ""],
    ],
  },
  professional: {
    greetings: ["Dear", "Hello"],
    closers: ["Thank you.", "Best regards.", "We appreciate your time."],
    replacements: [
      [/\bHey\b/g, "Hello"],
      [/\bHi\b/g, "Hello"],
      [/\bappt\b/gi, "appointment"],
      [/\bgrab\b/gi, "secure"],
      [/\bawesome\b/gi, "excellent"],
      [/\bswing by\b/gi, "visit"],
      [/\bhit us up\b/gi, "contact us"],
      [/\bno biggie\b/gi, "no issue"],
      [/!+/g, "."],
    ],
  },
  casual: {
    greetings: ["Hey", "Yo", "Hey there"],
    closers: ["Later!", "Catch ya!", "Peace!"],
    replacements: [
      [/\bDear\b/g, "Hey"],
      [/\bHello\b/g, "Hey"],
      [/\bappointment\b/gi, "appt"],
      [/\bschedule\b/gi, "book"],
      [/\bplease\b/gi, ""],
      [/\bwe would be pleased\b/gi, "we'd love"],
      [/\bThank you\b/gi, "Thanks"],
      [/\bpatronage\b/gi, "support"],
      [/\bURGENT:?\s*/gi, ""],
    ],
  },
  urgent: {
    greetings: ["IMPORTANT:", "URGENT:", "ACTION NEEDED:"],
    closers: ["Act now!", "Don't delay!", "Respond ASAP!"],
    replacements: [
      [/\bwhenever you're ready\b/gi, "now"],
      [/\btake your time\b/gi, "act quickly"],
      [/\bno rush\b/gi, "time-sensitive"],
      [/\bno pressure\b/gi, "please respond soon"],
      [/\bat your convenience\b/gi, "as soon as possible"],
      [/\bwhen you can\b/gi, "immediately"],
    ],
  },
  empathetic: {
    greetings: ["Hi", "We understand", "We hear you"],
    closers: ["We're here for you.", "No pressure at all.", "Take your time."],
    replacements: [
      [/\bURGENT:?\s*/gi, ""],
      [/\bACTION REQUIRED:?\s*/gi, ""],
      [/\bimmediately\b/gi, "when you're ready"],
      [/\bnow\b/gi, "whenever works"],
      [/\bASAP\b/gi, "at your pace"],
      [/\bDon't delay\b/gi, "Take your time"],
      [/\bAct fast\b/gi, "No rush"],
      [/\bmust\b/gi, "can"],
      [/\brequired\b/gi, "helpful"],
    ],
  },
};

/**
 * Detect if a message already starts with a greeting.
 */
function startsWithGreeting(msg: string): boolean {
  const greetingPatterns = /^(Hi|Hey|Hello|Dear|Yo|IMPORTANT:|URGENT:|ACTION|We understand|We hear)/i;
  return greetingPatterns.test(msg.trim());
}

/**
 * Rewrite a message in the specified tone using rule-based transformations.
 * Synchronous — no API calls, no tokens, no cost.
 */
export function rewriteInTone(message: string, tone: Tone): string {
  const rules = TONE_RULES[tone];
  if (!rules) return message;

  let result = message;

  // Apply word/phrase replacements
  for (const [pattern, replacement] of rules.replacements) {
    result = result.replace(pattern, replacement);
  }

  // Clean up double spaces from replacements
  result = result.replace(/\s{2,}/g, " ").trim();

  // Add tone-appropriate greeting if none present
  if (!startsWithGreeting(result)) {
    const greeting = rules.greetings[Math.floor(Math.random() * rules.greetings.length)];
    result = `${greeting}, ${result.charAt(0).toLowerCase()}${result.slice(1)}`;
  }

  // Enforce 160 char SMS limit
  if (result.length > 160) {
    result = result.substring(0, 157).replace(/\s+\S*$/, "") + "...";
  }

  return result;
}
