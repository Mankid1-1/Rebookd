import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { reportAIChatQuality } from "@/lib/aiChatMonitor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  MessageCircle,
  Send,
  Sparkles,
  HelpCircle,
  Wand2,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Bot,
  Settings,
  ToggleRight,
  User,
  Zap,
  AlertTriangle,
  Lightbulb,
  Trophy,
  ArrowUpRight,
  X,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface ProactiveInsightInfo {
  type: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionIntent?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  suggestions?: string[];
  action?: ActionInfo;
  proactiveInsight?: ProactiveInsightInfo;
}

interface ActionInfo {
  pending: boolean;
  executed: boolean;
  pendingAction?: { type: string; params: Record<string, unknown> };
  description: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MESSAGE_TYPES = [
  { value: "confirmation", label: "Appointment Confirmation" },
  { value: "reminder", label: "Appointment Reminder" },
  { value: "follow_up", label: "Follow-Up" },
  { value: "no_show", label: "No-Show Recovery" },
  { value: "cancellation", label: "Cancellation" },
  { value: "rebooking", label: "Rebooking Offer" },
  { value: "lead_capture", label: "Lead Capture" },
  { value: "after_hours", label: "After-Hours" },
  { value: "retention_rebooking", label: "Retention Rebooking" },
  { value: "loyalty_reward", label: "Loyalty Reward" },
  { value: "reactivation", label: "Reactivation" },
  { value: "card_on_file", label: "Card on File Request" },
  { value: "deposit_request", label: "Deposit Request" },
  { value: "payment_reminder", label: "Payment Reminder" },
  { value: "gap_fill", label: "Gap Fill / Last Minute" },
  { value: "off_peak_offer", label: "Off-Peak Offer" },
  { value: "reschedule", label: "Reschedule" },
];

const BEGINNER_MESSAGE_TYPES = [
  { value: "confirmation", label: "Appointment Confirmation" },
  { value: "reminder", label: "Appointment Reminder" },
  { value: "follow_up", label: "Follow-Up" },
  { value: "no_show", label: "No-Show Recovery" },
  { value: "cancellation", label: "Cancellation" },
  { value: "rebooking", label: "Rebooking Offer" },
  { value: "lead_capture", label: "New Lead Welcome" },
];

const TONES = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "urgent", label: "Urgent" },
  { value: "empathetic", label: "Empathetic" },
];

const BEGINNER_TONES = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWelcomeMessage(skillLevel: string): string {
  switch (skillLevel) {
    case "beginner":
    case "basic":
      return (
        "Hi! I'm **Rebooked AI** — your personal assistant with full access to your account, data, and automations.\n\n" +
        "I can **do things** for you, like:\n" +
        '- "Show my revenue" — see real recovery data\n' +
        '- "Enable the appointment reminder"\n' +
        '- "Where am I losing money?" — find revenue leakage\n' +
        '- "How can I improve?" — get AI recommendations\n\n' +
        "Or ask me anything about Rebooked!"
      );
    case "intermediate":
      return (
        "Hi! I'm **Rebooked AI**, your data-driven assistant.\n\n" +
        "I can **analyse your account** and take action:\n" +
        "- Show real revenue recovery data & predictions\n" +
        "- Detect revenue leakage & suggest fixes\n" +
        "- Toggle automations, update settings\n" +
        "- Create leads, send messages, generate reports\n" +
        "- Explain how any automation works\n\n" +
        "Just tell me what you need!"
      );
    case "advanced":
    case "expert":
      return (
        "**Rebooked AI** — data-driven, full-access assistant.\n\n" +
        "**Analytics:** Revenue recovery, leakage detection, predictions, delivery stats.\n" +
        "**Actions:** Toggle automations, create leads, send SMS, run campaigns.\n" +
        "**Intelligence:** AI optimization tips, automation explanations, full reports.\n" +
        "**Generator:** 17 types × 5 tones.\n\n" +
        "Ask anything or use the suggestions below."
      );
    default:
      return (
        "Hi! I'm **Rebooked AI**, your intelligent assistant with full access to your account data.\n\n" +
        "I can:\n" +
        "- **Show real revenue data** — recovery amounts, rates, and trends\n" +
        "- **Detect revenue leakage** — find where you're losing money\n" +
        "- **Predict & optimise** — forecast revenue and get AI recommendations\n" +
        "- **Take action** — toggle automations, create leads, send messages\n" +
        "- **Generate reports** — comprehensive performance summaries\n\n" +
        "Try asking \"show my revenue\" or \"how can I improve?\"!"
      );
  }
}

/** Renders bold markdown and newlines safely (no XSS — only ** and \n) */
function renderMarkdown(text: string) {
  const parts: React.ReactNode[] = [];
  const lines = text.split("\n");
  lines.forEach((line, li) => {
    const chunks = line.split(/(\*\*[^*]+\*\*)/g);
    chunks.forEach((chunk, ci) => {
      if (chunk.startsWith("**") && chunk.endsWith("**")) {
        parts.push(<strong key={`${li}-${ci}`}>{chunk.slice(2, -2)}</strong>);
      } else {
        parts.push(<span key={`${li}-${ci}`}>{chunk}</span>);
      }
    });
    if (li < lines.length - 1) parts.push(<br key={`br-${li}`} />);
  });
  return parts;
}

/** Three-dot typing indicator */
function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="flex items-end gap-2 max-w-[80%]">
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
          <div className="flex items-center gap-1 h-4">
            <span
              className="block h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
              style={{ animationDelay: "0ms", animationDuration: "800ms" }}
            />
            <span
              className="block h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
              style={{ animationDelay: "150ms", animationDuration: "800ms" }}
            />
            <span
              className="block h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
              style={{ animationDelay: "300ms", animationDuration: "800ms" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Badge shown when an action was detected */
function ActionBadge({ action }: { action: ActionInfo }) {
  if (action.executed) {
    return (
      <Badge className="text-[10px] px-1.5 py-0 h-4 bg-success/10 text-success border-success/30 gap-1">
        <Check className="h-2.5 w-2.5" /> Done
      </Badge>
    );
  }
  if (action.pending) {
    return (
      <Badge className="text-[10px] px-1.5 py-0 h-4 bg-warning/10 text-warning border-warning/30 gap-1">
        <Zap className="h-2.5 w-2.5" /> Confirm?
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-1">
      <Settings className="h-2.5 w-2.5" /> Info
    </Badge>
  );
}

/** Proactive insight card shown above chat input */
function InsightCard({
  insight,
  onAction,
  onDismiss,
}: {
  insight: ProactiveInsightInfo;
  onAction: (intent: string) => void;
  onDismiss: () => void;
}) {
  const iconMap: Record<string, React.ReactNode> = {
    warning: <AlertTriangle className="h-3.5 w-3.5 text-warning" />,
    opportunity: <Lightbulb className="h-3.5 w-3.5 text-info" />,
    achievement: <Trophy className="h-3.5 w-3.5 text-success" />,
    recommendation: <ArrowUpRight className="h-3.5 w-3.5 text-accent-foreground" />,
  };
  const borderMap: Record<string, string> = {
    warning: "border-warning/30 bg-warning/5",
    opportunity: "border-info/30 bg-info/5",
    achievement: "border-success/30 bg-success/5",
    recommendation: "border-accent/30 bg-accent/5",
  };

  return (
    <div className={`mx-3 mb-2 rounded-lg border px-3 py-2.5 text-xs ${borderMap[insight.type] || "border-border bg-muted/50"}`} style={{ animation: "fadeSlideIn 0.3s ease-out" }}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">{iconMap[insight.type] || <Lightbulb className="h-3.5 w-3.5" />}</div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground leading-tight">{insight.title}</p>
          <p className="text-muted-foreground mt-0.5 leading-snug">{insight.message}</p>
          {insight.actionLabel && insight.actionIntent && (
            <button
              onClick={() => onAction(insight.actionIntent!)}
              className="mt-1.5 text-primary hover:underline font-medium"
            >
              {insight.actionLabel} →
            </button>
          )}
        </div>
        <button onClick={onDismiss} className="shrink-0 p-0.5 hover:bg-background rounded">
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function RebookedAIChat() {
  // Get skill level from tRPC directly (reliable — doesn't depend on context provider)
  const { data: skillData } = trpc.auth.getSkillLevel.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const skillLevel = (skillData as any)?.level || (skillData as any)?.skillLevel || skillData || "beginner";
  const effectiveSkill = typeof skillLevel === "string" ? skillLevel : "beginner";

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string; params: Record<string, unknown> } | null>(null);
  const [activeInsight, setActiveInsight] = useState<ProactiveInsightInfo | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Message generator state
  const [genType, setGenType] = useState("confirmation");
  const [genTone, setGenTone] = useState("friendly");
  const [genName, setGenName] = useState("");
  const [genBusiness, setGenBusiness] = useState("");
  const [genDate, setGenDate] = useState("");
  const [genTime, setGenTime] = useState("");
  const [genLink, setGenLink] = useState("");
  const [genAmount, setGenAmount] = useState("");
  const [generatedMessages, setGeneratedMessages] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [genCollapsed, setGenCollapsed] = useState(false);

  const { data: tenant } = trpc.tenant.get.useQuery();
  useEffect(() => {
    if (tenant?.name && !genBusiness) setGenBusiness(tenant.name || "");
  }, [tenant?.name]);

  const chatMutation = trpc.ai.chat.useMutation();
  const generateMutation = trpc.ai.generateVariations.useMutation();
  const { data: suggestedQuestions } = trpc.ai.suggestions.useQuery(
    { category: undefined, skillLevel: effectiveSkill as any },
    { retry: false, refetchOnWindowFocus: false }
  );
  const { data: calConnections } = trpc.calendar.listConnections.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const connectedCals = calConnections?.length ?? 0;

  const utils = trpc.useUtils();

  // Scroll to bottom whenever messages or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Add welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: getWelcomeMessage(effectiveSkill),
          timestamp: Date.now(),
          suggestions: suggestedQuestions?.slice(0, effectiveSkill === "beginner" || effectiveSkill === "basic" ? 3 : 4),
        },
      ]);
    }
  }, [isOpen, suggestedQuestions]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, activeTab]);

  /** Invalidate relevant caches after an action executes */
  const invalidateAfterAction = useCallback(() => {
    utils.tenant.get.invalidate();
    utils.ai.suggestions.invalidate();
    try { utils.auth.getSkillLevel.invalidate(); } catch {}
  }, [utils]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const result = await chatMutation.mutateAsync({
        message: trimmed,
        history: messages.map((m) => ({ role: m.role, content: m.content, timestamp: m.timestamp })),
        skillLevel: effectiveSkill as any,
        pendingAction: pendingAction,
      });

      // If the action executed, clear pending and invalidate caches
      if (result.action?.executed) {
        setPendingAction(null);
        invalidateAfterAction();
      }

      // If the action needs confirmation, store the pending action
      if (result.action?.pending && result.action.pendingAction) {
        setPendingAction(result.action.pendingAction);
      }

      // If user said "no" / cancelled, clear pending
      if (!result.action?.pending && !result.action?.executed && pendingAction) {
        setPendingAction(null);
      }

      // Report quality signals to sentinel for continuous improvement
      reportAIChatQuality({
        userMessage: trimmed,
        answer: result.answer,
        confidence: result.confidence,
        category: result.category,
        hadAction: !!result.action,
        actionExecuted: result.action?.executed ?? false,
        actionFailed: result.action?.pending === false && result.action?.executed === false && !!result.action?.description,
      });

      // Surface proactive insight from the response
      if ((result as any).proactiveInsight && !activeInsight) {
        setActiveInsight((result as any).proactiveInsight);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: result.answer,
          timestamp: Date.now(),
          suggestions: result.suggestions,
          action: result.action || undefined,
        },
      ]);
    } catch (err: any) {
      console.error("[RebookedAI] chat error:", err);

      // Report chat errors to sentinel
      reportAIChatQuality({
        userMessage: trimmed,
        answer: "",
        confidence: 0,
        category: "error",
        hadAction: false,
        actionExecuted: false,
        actionFailed: false,
        errorMessage: err?.message || "Unknown error",
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Sorry, something went wrong. Please try again!",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, isLoading, messages, chatMutation, effectiveSkill, pendingAction, invalidateAfterAction]);

  const handleSend = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleSuggestionClick = useCallback((question: string) => {
    sendMessage(question);
  }, [sendMessage]);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    try {
      const variables: Record<string, string> = {};
      if (genName) variables.name = genName;
      if (genBusiness) variables.business = genBusiness;
      if (genDate) variables.date = genDate;
      if (genTime) variables.time = genTime;
      if (genLink) variables.link = genLink;
      if (genAmount) variables.amount = genAmount;

      const result = await generateMutation.mutateAsync({
        type: genType,
        tone: genTone as any,
        variables,
        count: 3,
      });
      setGeneratedMessages(result.variations);
      setGenCollapsed(true);
    } catch (err: any) {
      console.error("[RebookedAI] generate error:", err);
      setGeneratedMessages(["Failed to generate messages. Please try again."]);
    } finally {
      setIsLoading(false);
    }
  }, [genType, genTone, genName, genBusiness, genDate, genTime, genLink, genAmount, generateMutation]);

  const handleCopy = useCallback((text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  const messageTypes = effectiveSkill === "beginner" || effectiveSkill === "basic" ? BEGINNER_MESSAGE_TYPES : MESSAGE_TYPES;
  const tones = effectiveSkill === "beginner" || effectiveSkill === "basic" ? BEGINNER_TONES : TONES;
  const showExtraFields = effectiveSkill === "advanced" || effectiveSkill === "expert" || showAdvancedFields;

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl hover:bg-primary/90 transition-all duration-200 hover:scale-110 active:scale-95"
          aria-label="Open Rebooked AI"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Chat Panel */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-full sm:w-[440px] p-0 flex flex-col overflow-hidden"
          style={{ height: "100dvh" }}
        >
          {/* Header */}
          <SheetHeader className="shrink-0 px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-primary/10">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-sm font-semibold leading-none flex items-center gap-1.5">
                  Rebooked AI
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                  </span>
                </SheetTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">
                  Live {connectedCals > 0 ? `· ${connectedCals} cal` : ""} · Data-driven · Full-access
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  In-House
                </Badge>
                {(effectiveSkill === "beginner" || effectiveSkill === "basic") && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-success/10 text-success border-success/30">
                    Guided
                  </Badge>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <TabsList className="shrink-0 mx-4 mt-3 mb-1 grid w-auto grid-cols-2 h-9">
              <TabsTrigger value="chat" className="gap-1.5 text-xs h-7">
                <HelpCircle className="h-3.5 w-3.5" />
                {effectiveSkill === "beginner" || effectiveSkill === "basic" ? "Ask a Question" : "Help Chat"}
              </TabsTrigger>
              <TabsTrigger value="generator" className="gap-1.5 text-xs h-7">
                <Wand2 className="h-3.5 w-3.5" />
                {effectiveSkill === "beginner" || effectiveSkill === "basic" ? "Create Message" : "Message Generator"}
              </TabsTrigger>
            </TabsList>

            {/* ── Help Chat Tab ─────────────────────────────────────────── */}
            <TabsContent
              value="chat"
              className="flex flex-col flex-1 min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden"
            >
              {/* Scrollable messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 scroll-smooth" style={{ overscrollBehavior: "contain" }}>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex mb-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    style={{ animation: "fadeSlideIn 0.2s ease-out" }}
                  >
                    {msg.role === "assistant" && (
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 max-w-[82%]">
                      {/* Action badge above the bubble */}
                      {msg.action && (
                        <div className="flex items-center gap-1.5">
                          <ActionBadge action={msg.action} />
                          {msg.action.description && (
                            <span className="text-[10px] text-muted-foreground truncate">{msg.action.description}</span>
                          )}
                        </div>
                      )}

                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : msg.action?.executed
                              ? "bg-success/5 border border-success/20 text-foreground rounded-tl-sm"
                              : msg.action?.pending
                                ? "bg-warning/5 border border-warning/20 text-foreground rounded-tl-sm"
                                : "bg-muted text-foreground rounded-tl-sm"
                        }`}
                      >
                        {renderMarkdown(msg.content)}
                      </div>

                      {/* Suggestion chips — below the bubble */}
                      {msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {msg.suggestions.map((s, j) => (
                            <button
                              key={j}
                              onClick={() => handleSuggestionClick(s)}
                              disabled={isLoading}
                              className={`text-[11px] rounded-full px-2.5 py-1 transition-all duration-150 text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                                s === "Yes, go ahead"
                                  ? "bg-success/10 border border-success/30 text-success hover:bg-success/20 font-medium"
                                  : s === "No, cancel"
                                    ? "bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20"
                                    : "bg-background border border-border hover:bg-accent hover:border-primary/40"
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && <TypingIndicator />}

                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
              </div>

              {/* Proactive Insight Card */}
              {activeInsight && (
                <InsightCard
                  insight={activeInsight}
                  onAction={(intent) => {
                    setActiveInsight(null);
                    sendMessage(intent);
                  }}
                  onDismiss={() => setActiveInsight(null)}
                />
              )}

              {/* Input bar */}
              <div className="shrink-0 border-t bg-background px-3 py-3">
                <div className="flex items-end gap-2 rounded-xl border bg-muted/40 px-3 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0 transition-all">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      pendingAction
                        ? 'Say "yes" to confirm or "no" to cancel...'
                        : effectiveSkill === "beginner" || effectiveSkill === "basic"
                          ? "Ask a question or tell me what to change..."
                          : "Ask anything or give me an action..."
                    }
                    disabled={isLoading}
                    rows={1}
                    className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 leading-relaxed max-h-[120px] overflow-y-auto"
                    style={{ height: "24px" }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 active:scale-95 transition-all duration-150"
                    aria-label="Send message"
                  >
                    {isLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
                  {pendingAction ? "Waiting for your confirmation..." : "Shift+Enter for new line · Enter to send"}
                </p>
              </div>
            </TabsContent>

            {/* ── Message Generator Tab ─────────────────────────────────── */}
            <TabsContent
              value="generator"
              className="flex flex-col flex-1 min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden"
            >
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {/* Collapsible form */}
                {generatedMessages.length > 0 && genCollapsed ? (
                  <button
                    onClick={() => setGenCollapsed(false)}
                    className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground border rounded-lg p-2.5 transition-colors"
                  >
                    <span className="font-medium">Change options & regenerate</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <>
                    {(effectiveSkill === "beginner" || effectiveSkill === "basic") && (
                      <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
                        Pick a message type and tone, enter a client name, then tap <strong>Generate</strong>. You'll get ready-to-send texts instantly!
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Message Type</label>
                      <Select value={genType} onValueChange={setGenType}>
                        <SelectTrigger className="text-sm h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {messageTypes.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Tone</label>
                      {effectiveSkill === "beginner" || effectiveSkill === "basic" ? (
                        <div className="flex gap-1.5 flex-wrap">
                          {tones.map((t) => (
                            <button
                              key={t.value}
                              onClick={() => setGenTone(t.value)}
                              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                                genTone === t.value
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-transparent text-muted-foreground border-border hover:border-primary/40"
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Select value={genTone} onValueChange={setGenTone}>
                          <SelectTrigger className="text-sm h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {tones.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Client Name</label>
                        <Input
                          value={genName}
                          onChange={(e) => setGenName(e.target.value)}
                          placeholder="Jane"
                          className="text-sm h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Business</label>
                        <Input
                          value={genBusiness}
                          onChange={(e) => setGenBusiness(e.target.value)}
                          placeholder="Glow Salon"
                          className="text-sm h-9"
                        />
                      </div>
                    </div>

                    {effectiveSkill !== "beginner" && effectiveSkill !== "basic" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Date</label>
                          <Input
                            value={genDate}
                            onChange={(e) => setGenDate(e.target.value)}
                            placeholder="March 30"
                            className="text-sm h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Time</label>
                          <Input
                            value={genTime}
                            onChange={(e) => setGenTime(e.target.value)}
                            placeholder="2:00 PM"
                            className="text-sm h-9"
                          />
                        </div>
                      </div>
                    )}

                    {(effectiveSkill === "beginner" || effectiveSkill === "basic") && (
                      <button
                        onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showAdvancedFields ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {showAdvancedFields ? "Hide extra fields" : "More options (date, time, link...)"}
                      </button>
                    )}

                    {effectiveSkill === "intermediate" && !showExtraFields && (
                      <button
                        onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showAdvancedFields ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {showAdvancedFields ? "Hide extra fields" : "More options (link, amount...)"}
                      </button>
                    )}

                    {showExtraFields && (
                      <div className="space-y-2">
                        {(effectiveSkill === "beginner" || effectiveSkill === "basic") && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium">Date</label>
                              <Input
                                value={genDate}
                                onChange={(e) => setGenDate(e.target.value)}
                                placeholder="March 30"
                                className="text-sm h-9"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium">Time</label>
                              <Input
                                value={genTime}
                                onChange={(e) => setGenTime(e.target.value)}
                                placeholder="2:00 PM"
                                className="text-sm h-9"
                              />
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium">Booking Link</label>
                            <Input
                              value={genLink}
                              onChange={(e) => setGenLink(e.target.value)}
                              placeholder="https://..."
                              className="text-sm h-9"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium">Amount</label>
                            <Input
                              value={genAmount}
                              onChange={(e) => setGenAmount(e.target.value)}
                              placeholder="$50"
                              className="text-sm h-9"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <Button onClick={handleGenerate} disabled={isLoading} className="w-full gap-2 mt-1">
                      {isLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                      {effectiveSkill === "beginner" || effectiveSkill === "basic" ? "Generate Messages" : "Generate Variations"}
                    </Button>
                  </>
                )}

                {generatedMessages.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {effectiveSkill === "beginner" || effectiveSkill === "basic"
                        ? `Here are ${generatedMessages.length} messages — copy your favourite!`
                        : `${generatedMessages.length} variations generated:`}
                    </p>
                    {generatedMessages.map((msg, i) => (
                      <div
                        key={i}
                        className="rounded-xl border p-3 text-sm hover:border-primary/50 transition-colors bg-muted/30"
                        style={{ animation: "fadeSlideIn 0.2s ease-out" }}
                      >
                        <p className="leading-relaxed text-foreground">{msg}</p>
                        <div className="mt-2.5 flex items-center justify-between">
                          <span className={`text-xs ${msg.length > 160 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            {msg.length} chars{msg.length > 160 ? " — over limit!" : ""}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs px-2"
                            onClick={() => handleCopy(msg, i)}
                          >
                            {copiedIdx === i ? (
                              <><Check className="h-3 w-3 text-success" /> Copied!</>
                            ) : (
                              <><Copy className="h-3 w-3" /> Copy</>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => { setGenCollapsed(false); handleGenerate(); }}
                      disabled={isLoading}
                      className="w-full gap-2 text-sm"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                      Regenerate
                    </Button>
                  </div>
                )}

                {/* Bottom padding */}
                <div className="h-4" />
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Keyframe animation injected once */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
