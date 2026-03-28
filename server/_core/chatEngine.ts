/**
 * Rebooked AI Chat Engine
 * Rule-based intent detection and response — zero external API tokens.
 * Adapts answer style and suggestions based on user skill level.
 */

import { KNOWLEDGE_BASE, type KBEntry } from "./chatKnowledgeBase";

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

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
