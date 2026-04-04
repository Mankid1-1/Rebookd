/**
 * Rebooked AI Chat Engine
 * Rule-based intent detection and response — zero external API tokens.
 * Adapts answer style and suggestions based on user skill level.
 */

import { KNOWLEDGE_BASE, type KBEntry } from "./chatKnowledgeBase";

export type SkillLevel = "basic" | "beginner" | "intermediate" | "advanced" | "expert";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatResponse {
  answer: string;
  confidence: number;
  category: string;
  suggestions: string[];
  matchedQuestion: string;
}

// Stop words to ignore during keyword matching
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "during",
  "before", "after", "above", "below", "between", "out", "off", "up",
  "down", "and", "but", "or", "nor", "not", "so", "yet", "both",
  "each", "few", "more", "most", "other", "some", "such", "no",
  "only", "own", "same", "than", "too", "very", "just", "because",
  "if", "when", "where", "how", "what", "which", "who", "whom",
  "this", "that", "these", "those", "i", "me", "my", "we", "our",
  "you", "your", "it", "its", "they", "them", "their",
]);

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

interface ScoredEntry {
  entry: KBEntry;
  score: number;
}

/** Categories that beginners are most likely to need help with */
const BEGINNER_PRIORITY_CATEGORIES = new Set(["getting-started", "automations", "leads", "troubleshooting"]);

/** Categories that advanced users are more likely to ask about */
const ADVANCED_PRIORITY_CATEGORIES = new Set(["analytics", "settings", "features", "templates", "messaging"]);

function scoreEntry(
  entry: KBEntry,
  queryWords: string[],
  rawQuery: string,
  contextCategory?: string,
  skillLevel?: SkillLevel,
): number {
  let score = 0;

  // Keyword matching: count how many entry keywords appear in query
  const matchedKeywords = entry.keywords.filter((kw) =>
    queryWords.some((qw) => qw.includes(kw) || kw.includes(qw))
  );
  if (entry.keywords.length > 0) {
    score += (matchedKeywords.length / entry.keywords.length) * 0.6;
  }

  // Pattern matching: regex boost
  for (const pattern of entry.patterns) {
    if (pattern.test(rawQuery)) {
      score += 0.35;
      break; // One pattern match is enough
    }
  }

  // Context bonus: if conversation is in same category
  if (contextCategory && entry.category === contextCategory) {
    score += 0.1;
  }

  // Priority bonus (normalized to 0-0.05)
  if (entry.priority) {
    score += (entry.priority / 200);
  }

  // Skill-level category boost — surface relevant content first
  if (skillLevel) {
    if ((skillLevel === "beginner" || skillLevel === "intermediate") && BEGINNER_PRIORITY_CATEGORIES.has(entry.category)) {
      score += 0.05;
    }
    if ((skillLevel === "advanced" || skillLevel === "expert") && ADVANCED_PRIORITY_CATEGORIES.has(entry.category)) {
      score += 0.05;
    }
    // Boost skill-tagged entries that match the user's level
    if (entry.skillLevels && entry.skillLevels.includes(skillLevel)) {
      score += 0.08;
    }
  }

  return score;
}

/**
 * Adapt the answer text to the user's skill level.
 * - Beginner: add a friendly tip, simplify jargon, add step-by-step guidance
 * - Advanced/Expert: strip hand-holding, keep it concise
 */
function adaptAnswer(answer: string, entry: KBEntry, skillLevel?: SkillLevel): string {
  if (!skillLevel) return answer;

  // If the entry has skill-specific answers, use those directly
  if (entry.answerBySkill?.[skillLevel]) {
    return entry.answerBySkill[skillLevel]!;
  }

  if (skillLevel === "beginner") {
    // Add a step-by-step nudge if the answer mentions navigation
    let adapted = answer;
    if (entry.beginnerTip) {
      adapted += "\n\n💡 **Tip:** " + entry.beginnerTip;
    }
    return adapted;
  }

  if (skillLevel === "advanced" || skillLevel === "expert") {
    // For advanced users, strip any "Tip:" lines that are beginner-oriented
    let adapted = answer;
    if (entry.advancedNote) {
      adapted += "\n\n" + entry.advancedNote;
    }
    return adapted;
  }

  return answer;
}

/**
 * Process a user query and return the best matching KB answer.
 */
export function processUserQuery(query: string, history?: ChatMessage[], skillLevel?: SkillLevel): ChatResponse {
  const queryWords = normalize(query);
  const rawQuery = query.trim();

  // Determine context category from recent conversation
  let contextCategory: string | undefined;
  if (history && history.length > 0) {
    const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
    if (lastAssistant) {
      for (const entry of KNOWLEDGE_BASE) {
        if (lastAssistant.content.includes(entry.answer.substring(0, 50))) {
          contextCategory = entry.category;
          break;
        }
      }
    }
  }

  // Score all entries
  const scored: ScoredEntry[] = KNOWLEDGE_BASE.map((entry) => ({
    entry,
    score: scoreEntry(entry, queryWords, rawQuery, contextCategory, skillLevel),
  }));

  scored.sort((a, b) => b.score - a.score);
  const topMatch = scored[0];

  // Low confidence fallback — adapted by skill level
  if (!topMatch || topMatch.score < 0.15) {
    const categories = [...new Set(KNOWLEDGE_BASE.map((e) => e.category))];
    const fallbackIntro = skillLevel === "beginner"
      ? "Hmm, I'm not sure about that yet! Here are topics I can help with — just pick one:\n\n"
      : skillLevel === "advanced" || skillLevel === "expert"
        ? "No match found. Available topics:\n\n"
        : "I'm not sure I understand your question. Here are some topics I can help with:\n\n";

    return {
      answer:
        fallbackIntro +
        categories.map((c) => `- **${c.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}**`).join("\n") +
        "\n\nTry asking about a specific feature, or pick a topic above!",
      confidence: topMatch?.score ?? 0,
      category: "general",
      suggestions: getTopQuestions(5, skillLevel),
      matchedQuestion: "",
    };
  }

  // Adapt the answer to skill level
  const answer = adaptAnswer(topMatch.entry.answer, topMatch.entry, skillLevel);

  // Get related suggestions
  const suggestions: string[] = [];
  if (topMatch.entry.relatedIds) {
    for (const relId of topMatch.entry.relatedIds) {
      const related = KNOWLEDGE_BASE.find((e) => e.id === relId);
      if (related) {
        suggestions.push(related.question);
      }
    }
  }

  // Fill remaining suggestion slots from next-best scored entries
  if (suggestions.length < 3) {
    for (let i = 1; i < scored.length && suggestions.length < 3; i++) {
      if (scored[i].score > 0.1 && !suggestions.includes(scored[i].entry.question)) {
        suggestions.push(scored[i].entry.question);
      }
    }
  }

  return {
    answer,
    confidence: Math.min(topMatch.score, 1),
    category: topMatch.entry.category,
    suggestions: suggestions.slice(0, 3),
    matchedQuestion: topMatch.entry.question,
  };
}

/**
 * Get suggested questions for a category (or top questions overall).
 * Adapts which questions surface first based on skill level.
 */
export function getSuggestedQuestions(category?: string, skillLevel?: SkillLevel): string[] {
  let pool = KNOWLEDGE_BASE;

  if (category) {
    pool = pool.filter((e) => e.category === category);
  }

  // Sort by priority, but boost entries tagged for the user's skill level
  const sorted = [...pool].sort((a, b) => {
    let aScore = a.priority ?? 0;
    let bScore = b.priority ?? 0;

    if (skillLevel && a.skillLevels?.includes(skillLevel)) aScore += 5;
    if (skillLevel && b.skillLevels?.includes(skillLevel)) bScore += 5;

    // Beginners: boost getting-started, automations
    if (skillLevel === "beginner") {
      if (BEGINNER_PRIORITY_CATEGORIES.has(a.category)) aScore += 3;
      if (BEGINNER_PRIORITY_CATEGORIES.has(b.category)) bScore += 3;
    }
    // Advanced: boost analytics, settings, features
    if (skillLevel === "advanced" || skillLevel === "expert") {
      if (ADVANCED_PRIORITY_CATEGORIES.has(a.category)) aScore += 3;
      if (ADVANCED_PRIORITY_CATEGORIES.has(b.category)) bScore += 3;
    }

    return bScore - aScore;
  });

  return sorted.slice(0, category ? 5 : 8).map((e) => e.question);
}

function getTopQuestions(count: number, skillLevel?: SkillLevel): string[] {
  return getSuggestedQuestions(undefined, skillLevel).slice(0, count);
}

// ─── Smart Context Chat (In-House Generative Engine) ─────────────────────────

import type { UserProfile } from "./chatActions";
import { generateMessage, generateMessageVariations } from "./messageGenerator";
import { rewriteInTone } from "./messageRewriter";
import type { Tone, MessageType } from "./messageTemplates";

/**
 * RebookedAI Generative Engine — fully in-house, zero external API.
 * Analyses user profile data and generates specific, actionable responses.
 */

// ── Topic classifiers (keyword → category) ──
const TOPIC_KEYWORDS: Record<string, string[]> = {
  revenue: ["revenue", "money", "earn", "income", "recover", "profit", "roi", "dollar", "payment", "billing"],
  leads: ["lead", "leads", "contact", "customer", "client", "prospect", "pipeline"],
  automations: ["automation", "automate", "workflow", "trigger", "sequence", "campaign"],
  messages: ["message", "sms", "text", "write", "draft", "compose", "send", "template", "copy", "copywriting"],
  calendar: ["calendar", "appointment", "schedule", "booking", "slot", "gap", "no-show", "noshow", "cancellation"],
  performance: ["performance", "stats", "metric", "analytics", "dashboard", "report", "data", "insight"],
  setup: ["setup", "onboard", "start", "connect", "configure", "install", "integrate", "setting"],
  help: ["help", "how", "what", "explain", "guide", "tutorial", "learn", "tip"],
  create: ["create", "build", "make", "generate", "design", "new", "add", "set up"],
};

function classifyTopic(message: string): string {
  const lower = message.toLowerCase();
  let bestTopic = "general";
  let bestCount = 0;
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const count = keywords.filter((kw) => lower.includes(kw)).length;
    if (count > bestCount) { bestCount = count; bestTopic = topic; }
  }
  return bestTopic;
}

// ── Smart message draft detection ──
const DRAFT_PATTERNS = [
  /(?:write|draft|compose|create|generate|make)\s+(?:a\s+)?(?:message|sms|text|copy)/i,
  /(?:write|draft|compose|create|generate|make)\s+(?:a\s+)?(?:reminder|follow[- ]?up|no[- ]?show|cancellation|welcome|rebooking|win[- ]?back|birthday|upsell)/i,
  /(?:write|draft)\s+(?:something|a text)\s+(?:for|to|about)/i,
];

const CAMPAIGN_PATTERNS = [
  /(?:create|build|launch|start|set up|make)\s+(?:a\s+)?(?:campaign|blast|bulk|batch|mass)\s/i,
  /(?:send|text|sms)\s+(?:all|every|my)\s+(?:leads?|contacts?|customers?|clients?)/i,
  /(?:re-?engage|win[- ]?back|reach out to)\s+(?:all|every|my|inactive|lost|old)/i,
];

const REPORT_PATTERNS = [
  /(?:create|generate|build|make|give|show)\s+(?:me\s+)?(?:a\s+)?(?:report|summary|overview|brief|snapshot|analysis|breakdown)/i,
  /(?:full|complete|comprehensive|detailed)\s+(?:report|summary|overview|breakdown)/i,
  /how\s+(?:am\s+I|are\s+things|is\s+(?:my|the)?\s*business)\s+(?:doing|going|performing)/i,
];

function detectDraftRequest(message: string): { type: MessageType; tone: Tone } | null {
  for (const p of DRAFT_PATTERNS) {
    if (p.test(message)) {
      const lower = message.toLowerCase();
      // Detect message type
      let type: MessageType = "generic";
      if (/reminder/i.test(lower)) type = "reminder";
      else if (/follow[- ]?up/i.test(lower)) type = "follow_up";
      else if (/no[- ]?show/i.test(lower)) type = "no_show";
      else if (/cancel/i.test(lower)) type = "cancellation";
      else if (/welcome/i.test(lower)) type = "lead_capture";
      else if (/rebook/i.test(lower)) type = "rebooking";
      else if (/win[- ]?back|re-?engage/i.test(lower)) type = "reactivation";
      else if (/birthday/i.test(lower)) type = "loyalty_reward";
      else if (/upsell/i.test(lower)) type = "follow_up";
      else if (/confirm/i.test(lower)) type = "confirmation";
      else if (/after[- ]?hours/i.test(lower)) type = "after_hours";
      else if (/deposit/i.test(lower)) type = "deposit_request";
      else if (/payment/i.test(lower)) type = "payment_reminder";
      else if (/gap|fill|slot/i.test(lower)) type = "gap_fill";
      else if (/off[- ]?peak/i.test(lower)) type = "off_peak_offer";
      else if (/reschedul/i.test(lower)) type = "reschedule";

      // Detect tone
      let tone: Tone = "friendly";
      if (/professional|formal/i.test(lower)) tone = "professional";
      else if (/casual|chill|relaxed/i.test(lower)) tone = "casual";
      else if (/urgent|asap|now/i.test(lower)) tone = "urgent";
      else if (/empathetic|caring|gentle|soft/i.test(lower)) tone = "empathetic";

      return { type, tone };
    }
  }
  return null;
}

/**
 * Generate a smart, data-driven response based on user profile and message topic.
 * Fully in-house — zero external API calls.
 */
export async function chatWithContext(
  message: string,
  profile: UserProfile,
  _history?: ChatMessage[],
): Promise<ChatResponse> {
  const topic = classifyTopic(message);
  const lk = profile.leakageMetrics ?? { unconfirmedAppointments: 0, qualifiedUnbooked: 0, cancellationsUnrecovered: 0, failedDeliveryRecovery: 0 };
  const ds = profile.deliveryStats ?? { total: 0, delivered: 0, failed: 0, rate: 100 };
  const avg = profile.avgRevenuePerBooking || 0;
  const active = profile.automations.filter((a) => a.enabled);
  const inactive = profile.automations.filter((a) => !a.enabled);
  const totalLeakage = lk.unconfirmedAppointments + lk.qualifiedUnbooked + lk.cancellationsUnrecovered + lk.failedDeliveryRecovery;

  // ── 1. Draft message requests ("write me a reminder SMS") ──
  const draft = detectDraftRequest(message);
  if (draft) {
    const variations = generateMessageVariations(
      { type: draft.type, tone: draft.tone, variables: { name: "{name}", business: profile.tenantName || "{business}" } },
      3,
    );
    const typeLabel = draft.type.replace(/_/g, " ");
    const lines = [
      `Here are **3 ${draft.tone} ${typeLabel} messages** I created for you:`,
      ``,
      ...variations.map((v, i) => `**Option ${i + 1}** (${v.length} chars):\n> ${v}`),
      ``,
      `Copy any of these into your templates. Want a different tone? Just say "rewrite in urgent tone" or "make it more casual".`,
    ];
    return { answer: lines.join("\n"), confidence: 0.9, category: "create", suggestions: ["Write a follow-up SMS", "Write a no-show message", "Show my templates"], matchedQuestion: message };
  }

  // ── 2. Campaign creation requests ──
  if (CAMPAIGN_PATTERNS.some((p) => p.test(message))) {
    const suggestions: string[] = [];
    if (lk.qualifiedUnbooked > 0) suggestions.push(`- **Qualified Lead Outreach**: ${lk.qualifiedUnbooked} qualified leads haven't booked yet. Enable the "Lead Follow-Up" automation to reach them automatically.`);
    if (lk.cancellationsUnrecovered > 0) suggestions.push(`- **Cancellation Recovery**: ${lk.cancellationsUnrecovered} cancellations haven't been recovered. Enable "Post-Cancellation Rebook" to win them back.`);
    if (profile.noShowCount > 0) suggestions.push(`- **No-Show Recovery**: ${profile.noShowCount} no-shows detected. Enable "No-Show Check-In" to re-engage.`);
    if (inactive.length > 0) suggestions.push(`- **Quick Win**: Enable these inactive automations: ${inactive.slice(0, 3).map((a) => `"${a.name}"`).join(", ")}`);

    if (suggestions.length === 0) {
      suggestions.push("- Your automations are already running. Consider creating a **win-back campaign** for leads inactive 30+ days.");
      suggestions.push("- Try a **gap-fill campaign** to fill empty calendar slots with targeted SMS offers.");
    }

    const exampleMsg = generateMessage({ type: "reactivation", tone: "friendly", variables: { name: "{name}", business: profile.tenantName || "{business}" } });
    const lines = [
      `Here's a campaign plan based on your data:`,
      ``,
      ...suggestions,
      ``,
      `**Example SMS for this campaign:**`,
      `> ${exampleMsg}`,
      ``,
      `To launch: go to [Automations](/automations) and enable the relevant workflows. I can draft specific messages — just ask!`,
    ];
    return { answer: lines.join("\n"), confidence: 0.85, category: "create", suggestions: ["Write a win-back SMS", "Show my automations", "Show revenue leakage"], matchedQuestion: message };
  }

  // ── 3. Report generation requests ──
  if (REPORT_PATTERNS.some((p) => p.test(message))) {
    const trend = profile.revenueTrend === "up" ? "trending up" : profile.revenueTrend === "down" ? "trending down" : "holding steady";
    const potentialRecovery = (profile.qualifiedLeadCount ?? 0) * avg * ((profile.overallRecoveryRate ?? 0) / 100);
    const convRate = profile.leadCount > 0 ? ((profile.bookedCount / profile.leadCount) * 100).toFixed(1) : "0";
    const lines = [
      `**${profile.tenantName || "Business"} Performance Report**`,
      ``,
      `**Revenue Recovery**`,
      `- Total recovered: **$${(profile.totalRecoveredRevenue ?? 0).toLocaleString()}** (${trend})`,
      `- Last 30 days: **$${(profile.recentRecoveredRevenue ?? 0).toLocaleString()}**`,
      `- Recovery rate: **${(profile.overallRecoveryRate ?? 0).toFixed(1)}%**`,
      `- Avg per booking: **$${avg.toLocaleString()}**`,
      ``,
      `**Lead Pipeline**`,
      `- ${profile.leadCount} total leads — ${profile.bookedCount} booked, ${profile.qualifiedLeadCount ?? 0} qualified, ${profile.lostLeadCount ?? 0} lost`,
      `- Conversion rate: **${convRate}%**`,
      `- No-shows: ${profile.noShowCount}`,
      ``,
      `**Messaging**`,
      `- ${ds.total} messages sent, **${ds.rate.toFixed(0)}% delivery rate**${ds.failed > 0 ? `, ${ds.failed} failed` : ""}`,
      ``,
      `**Automations**: ${active.length} active / ${profile.automations.length} total`,
      `**Calendars**: ${profile.connectedCalendars} connected, ${profile.todayAppointments} appointments today`,
    ];

    if (totalLeakage > 0) {
      lines.push(``, `**Revenue Leakage** (${totalLeakage} issues)`);
      if (lk.unconfirmedAppointments > 0) lines.push(`- ${lk.unconfirmedAppointments} unconfirmed appointments`);
      if (lk.qualifiedUnbooked > 0) lines.push(`- ${lk.qualifiedUnbooked} qualified leads unbooked (~$${Math.round(lk.qualifiedUnbooked * avg).toLocaleString()} potential)`);
      if (lk.cancellationsUnrecovered > 0) lines.push(`- ${lk.cancellationsUnrecovered} cancellations unrecovered`);
    }

    if (potentialRecovery > 0) {
      lines.push(``, `**Projected pipeline recovery: $${Math.round(potentialRecovery).toLocaleString()}**`);
    }

    return { answer: lines.join("\n"), confidence: 0.95, category: "create", suggestions: ["Show revenue leakage", "How can I improve?", "Create a campaign"], matchedQuestion: message };
  }

  // ── 4. Topic-based smart responses using real data ──
  switch (topic) {
    case "revenue": {
      const trend = profile.revenueTrend === "up" ? "growing" : profile.revenueTrend === "down" ? "declining" : "stable";
      const lines = [
        `Your revenue recovery is **${trend}**.`,
        `- Total recovered: **$${(profile.totalRecoveredRevenue ?? 0).toLocaleString()}**`,
        `- Last 30 days: **$${(profile.recentRecoveredRevenue ?? 0).toLocaleString()}**`,
        `- Recovery rate: **${(profile.overallRecoveryRate ?? 0).toFixed(1)}%**`,
      ];
      if (totalLeakage > 0) lines.push(``, `You have **${totalLeakage} leakage issues** — say "show leakage" for the breakdown.`);
      return { answer: lines.join("\n"), confidence: 0.8, category: "ai_context", suggestions: ["Show revenue leakage", "Generate a report", "How can I improve?"], matchedQuestion: message };
    }

    case "leads": {
      const lines = [
        `**Lead Pipeline**: ${profile.leadCount} total leads`,
        `- ${profile.bookedCount} booked, ${profile.qualifiedLeadCount ?? 0} qualified, ${profile.contactedLeadCount ?? 0} contacted, ${profile.lostLeadCount ?? 0} lost`,
        `- No-shows: ${profile.noShowCount}`,
      ];
      if (profile.recentLeads.length > 0) {
        lines.push(``, `**Recent leads:**`);
        profile.recentLeads.slice(0, 5).forEach((l) => lines.push(`- ${l.name || "Unnamed"} (${l.status})`));
      }
      return { answer: lines.join("\n"), confidence: 0.8, category: "ai_context", suggestions: ["Show my revenue", "Create a lead", "Show no-shows"], matchedQuestion: message };
    }

    case "automations": {
      const lines = [`**${active.length}** of **${profile.automations.length}** automations are active.`];
      if (inactive.length > 0) {
        lines.push(``, `**Inactive** (consider enabling):`);
        inactive.slice(0, 5).forEach((a) => lines.push(`- ${a.name}`));
        lines.push(``, `Say "enable [name]" to activate any automation.`);
      }
      return { answer: lines.join("\n"), confidence: 0.8, category: "ai_context", suggestions: ["Enable appointment reminder", "Show automation performance", "How can I improve?"], matchedQuestion: message };
    }

    case "messages": {
      // If they're asking about messages generically, offer to draft one
      const lines = [
        `**Messaging stats**: ${ds.total} sent, ${ds.rate.toFixed(0)}% delivery rate.`,
        ``,
        `I can **create messages** for you — just tell me what kind:`,
        `- "Write a reminder SMS"`,
        `- "Draft a no-show follow-up"`,
        `- "Create a win-back message"`,
        `- "Write a professional cancellation text"`,
        ``,
        `I'll generate multiple options you can copy right into your templates.`,
      ];
      return { answer: lines.join("\n"), confidence: 0.8, category: "ai_context", suggestions: ["Write a reminder SMS", "Write a follow-up", "Draft a win-back message"], matchedQuestion: message };
    }

    case "calendar": {
      const lines = [];
      if (profile.connectedCalendars === 0) {
        lines.push(`No calendar connected yet. Connect one at [Calendar & Booking](/calendar-integration) to unlock gap detection and auto-fill.`);
      } else {
        lines.push(`**${profile.connectedCalendars}** calendar(s) connected with **${profile.todayAppointments}** appointments today.`);
      }
      return { answer: lines.join("\n"), confidence: 0.8, category: "ai_context", suggestions: ["Show my stats", "Show scheduling gaps", "Connect a calendar"], matchedQuestion: message };
    }

    case "create": {
      const lines = [
        `I can **create** things for you — here's what I can do:`,
        ``,
        `**Draft Messages**: "Write a reminder SMS", "Draft a no-show text", "Create a professional follow-up"`,
        `**Plan Campaigns**: "Create a win-back campaign", "Re-engage inactive leads"`,
        `**Generate Reports**: "Generate a performance report", "Give me a business summary"`,
        `**Create Leads**: "Add a lead named John 555-1234"`,
        `**Build Automations**: "Enable the appointment reminder", "Set up no-show recovery"`,
        ``,
        `Just tell me what you need!`,
      ];
      return { answer: lines.join("\n"), confidence: 0.85, category: "ai_context", suggestions: ["Write a reminder SMS", "Create a campaign", "Generate a report"], matchedQuestion: message };
    }

    default: {
      // General catch-all — provide smart data-driven response
      const quickStats = [
        `Here's a quick snapshot of your ${profile.tenantName || "business"}:`,
        `- **${profile.leadCount}** leads, **${profile.bookedCount}** booked, **$${(profile.totalRecoveredRevenue ?? 0).toLocaleString()}** recovered`,
        `- **${active.length}/${profile.automations.length}** automations active, **${ds.total}** messages sent`,
      ];
      if (totalLeakage > 0) quickStats.push(`- **${totalLeakage}** revenue leakage issues detected`);
      quickStats.push(
        ``,
        `**I can help you:**`,
        `- **Do**: Enable automations, create leads, toggle settings`,
        `- **Make**: Draft SMS messages in any tone, plan campaigns`,
        `- **Create**: Generate reports, build outreach sequences, produce message variations`,
        ``,
        `Just ask me anything!`,
      );
      return { answer: quickStats.join("\n"), confidence: 0.6, category: "ai_context", suggestions: ["Show my stats", "Write a message", "Generate a report"], matchedQuestion: message };
    }
  }
}

// Keep buildContextPrompt exported for other services that may use it
export function buildContextPrompt(profile: UserProfile): string {
  const active = profile.automations.filter((a) => a.enabled);
  const inactive = profile.automations.filter((a) => !a.enabled);
  const lk = profile.leakageMetrics ?? { unconfirmedAppointments: 0, qualifiedUnbooked: 0, cancellationsUnrecovered: 0, failedDeliveryRecovery: 0 };
  const ds = profile.deliveryStats ?? { total: 0, delivered: 0, failed: 0, rate: 100 };
  const avg = profile.avgRevenuePerBooking || 0;
  return `Business: ${profile.tenantName}, Industry: ${profile.industry}, Revenue: $${(profile.totalRecoveredRevenue ?? 0).toLocaleString()}, Leads: ${profile.leadCount}, Booked: ${profile.bookedCount}, Automations: ${active.length}/${profile.automations.length}, Messages: ${ds.total}, Calendars: ${profile.connectedCalendars}`;
}
