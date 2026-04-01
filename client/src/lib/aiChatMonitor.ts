/**
 * AI Chat Quality Monitor — feeds sentinel data to continuously improve RebookedAI.
 *
 * Tracks quality signals from every AI chat interaction:
 *  - Low confidence responses (AI unsure)
 *  - Error/fallback responses
 *  - Failed actions (intent detected but execution failed)
 *  - Generic non-answers ("I don't know", "I can't help with that")
 *  - Repeated questions (user asking same thing = AI didn't answer well)
 *
 * Reports to sentinel via /api/system/client-error with [AI_CHAT_QUALITY] prefix.
 * Sentinel can then create repair jobs to improve the knowledge base,
 * intent detection, or action handlers.
 */

// ── Config ───────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.35; // Below this = AI is guessing
const MAX_REPORTS_PER_SESSION = 15;
const DEDUP_COOLDOWN_MS = 120_000; // 2 min cooldown per similar issue

// ── State ────────────────────────────────────────────────────────────────────

let reportCount = 0;
const reportedIssues = new Map<string, number>(); // issue key → last report ts
const recentQuestions: string[] = []; // Track last N questions for repeat detection

// ── Generic response detection ───────────────────────────────────────────────

const GENERIC_PATTERNS = [
  /i('m| am) not sure/i,
  /i don('t|'t) know/i,
  /i can('t|'t) help with that/i,
  /i('m| am) unable to/i,
  /sorry.*(couldn't|can't|cannot)/i,
  /i don('t|'t) have (enough )?information/i,
  /please (contact|reach out to) support/i,
  /something went wrong/i,
];

function isGenericResponse(answer: string): boolean {
  return GENERIC_PATTERNS.some((p) => p.test(answer));
}

// ── Repeat question detection ────────────────────────────────────────────────

function normalizeQuestion(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function isRepeatQuestion(question: string): boolean {
  const normalized = normalizeQuestion(question);
  if (normalized.length < 8) return false;

  const isRepeat = recentQuestions.some((prev) => {
    const prevNorm = normalizeQuestion(prev);
    if (prevNorm === normalized) return true;
    // Require >60% word overlap for substring match (not just containment)
    const shorter = prevNorm.length < normalized.length ? prevNorm : normalized;
    const longer = prevNorm.length < normalized.length ? normalized : prevNorm;
    if (shorter.length < 10) return false;
    return longer.includes(shorter) && shorter.length / longer.length > 0.6;
  });

  recentQuestions.push(question);
  if (recentQuestions.length > 10) recentQuestions.shift();

  return isRepeat;
}

// ── Quality Issue Classification ─────────────────────────────────────────────

type QualityIssue =
  | "low_confidence"
  | "error_response"
  | "generic_answer"
  | "action_failed"
  | "repeat_question"
  | "empty_response";

const ISSUE_LABELS: Record<QualityIssue, string> = {
  low_confidence: "Low confidence response — AI unsure how to answer",
  error_response: "Chat returned an error",
  generic_answer: "Generic non-answer — AI couldn't provide useful info",
  action_failed: "Intent detected but action failed to execute",
  repeat_question: "User repeated question — previous answer was unhelpful",
  empty_response: "Empty or missing response",
};

// ── Reporting ────────────────────────────────────────────────────────────────

function report(
  issue: QualityIssue,
  details: Record<string, unknown>,
) {
  if (reportCount >= MAX_REPORTS_PER_SESSION) return;

  const key = `${issue}:${String(details.userMessage || "").slice(0, 50)}`;
  const now = Date.now();
  const lastReport = reportedIssues.get(key) || 0;
  if (now - lastReport < DEDUP_COOLDOWN_MS) return;

  reportedIssues.set(key, now);
  reportCount++;

  const label = ISSUE_LABELS[issue];
  const message = `[AI_CHAT_QUALITY] ${label}: "${String(details.userMessage || "").slice(0, 80)}"`;

  fetch("/api/system/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      message,
      stack: JSON.stringify(
        {
          qualityIssue: issue,
          label,
          ...details,
          page: window.location.pathname,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
  }).catch(() => {});
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface AIChatQualitySignal {
  userMessage: string;
  answer: string;
  confidence: number;
  category: string;
  hadAction: boolean;
  actionExecuted: boolean;
  actionFailed: boolean;
  errorMessage?: string;
}

export function reportAIChatQuality(signal: AIChatQualitySignal): void {
  // Only report in production
  if (process.env.NODE_ENV === "development") return;
  if (reportCount >= MAX_REPORTS_PER_SESSION) return;

  const baseDetails = {
    userMessage: signal.userMessage.slice(0, 200),
    answer: signal.answer.slice(0, 300),
    confidence: signal.confidence,
    category: signal.category,
  };

  // Priority 1: Hard errors
  if (signal.errorMessage || signal.category === "error") {
    report("error_response", {
      ...baseDetails,
      errorMessage: signal.errorMessage?.slice(0, 200),
    });
    return;
  }

  // Priority 2: Empty response
  if (!signal.answer || signal.answer.trim().length < 5) {
    report("empty_response", baseDetails);
    return;
  }

  // Priority 3: Action failed
  if (signal.actionFailed) {
    report("action_failed", {
      ...baseDetails,
      hadAction: signal.hadAction,
    });
    return;
  }

  // Priority 4: Repeat question (user unsatisfied with previous answer)
  if (isRepeatQuestion(signal.userMessage)) {
    report("repeat_question", baseDetails);
    return;
  }

  // Priority 5: Generic non-answer
  if (isGenericResponse(signal.answer)) {
    report("generic_answer", baseDetails);
    return;
  }

  // Priority 6: Low confidence
  if (signal.confidence < CONFIDENCE_THRESHOLD && signal.confidence > 0) {
    report("low_confidence", baseDetails);
    return;
  }
}
