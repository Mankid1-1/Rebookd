import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageCircle,
  Send,
  X,
  Sparkles,
  HelpCircle,
  Wand2,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useProgressiveDisclosureContext } from "@/components/ui/ProgressiveDisclosure";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  suggestions?: string[];
}

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

// Beginner sees fewer, most common types
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

// Beginner sees fewer tones
const BEGINNER_TONES = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
];

function getWelcomeMessage(skillLevel: string): string {
  switch (skillLevel) {
    case "beginner":
      return (
        "Hi! I'm **Rebooked AI**, here to help you every step of the way.\n\n" +
        "You can ask me things like:\n" +
        "- \"How do I add a lead?\"\n" +
        "- \"Which automations are on?\"\n" +
        "- \"How do I send a text?\"\n\n" +
        "Or switch to the **Message Generator** tab to create SMS messages. Try a question below!"
      );
    case "intermediate":
      return (
        "Hi! I'm **Rebooked AI**, your in-house assistant.\n\n" +
        "I can help with:\n" +
        "- Features and automations\n" +
        "- Troubleshooting issues\n" +
        "- Generating SMS messages\n\n" +
        "Ask me anything or try a suggested question!"
      );
    case "advanced":
    case "expert":
      return (
        "**Rebooked AI** — in-house assistant (zero API cost).\n\n" +
        "Help Chat: KB-backed Q&A across all features.\n" +
        "Message Generator: 17 types × 5 tones, template-based.\n\n" +
        "Ask anything or use the suggestions below."
      );
    default:
      return (
        "Hi! I'm **Rebooked AI**, your in-house assistant. I can help you with:\n\n" +
        "- Understanding features and automations\n" +
        "- Troubleshooting issues\n" +
        "- Generating SMS messages\n\n" +
        "Ask me anything or try a suggested question below!"
      );
  }
}

export function RebookedAIChat() {
  const { context } = useProgressiveDisclosureContext();
  const skillLevel = context.userSkill?.level || "beginner";

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Pre-fill business name from tenant data
  const { data: tenant } = trpc.tenant.get.useQuery();
  useEffect(() => {
    if (tenant?.name && !genBusiness) {
      setGenBusiness(tenant.name || "");
    }
  }, [tenant?.name]);

  const chatMutation = trpc.ai.chat.useMutation();
  const generateMutation = trpc.ai.generateVariations.useMutation();
  const { data: suggestedQuestions } = trpc.ai.suggestions.useQuery({ category: undefined, skillLevel: skillLevel as any });

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Add welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: getWelcomeMessage(skillLevel),
          timestamp: Date.now(),
          suggestions: suggestedQuestions?.slice(0, skillLevel === "beginner" ? 3 : 4),
        },
      ]);
    }
  }, [isOpen, suggestedQuestions]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
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
        history: messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        skillLevel: skillLevel as any,
      });

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.answer,
        timestamp: Date.now(),
        suggestions: result.suggestions,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again!",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, chatMutation, skillLevel]);

  const handleSuggestionClick = useCallback(
    (question: string) => {
      setInput(question);
      const userMsg: ChatMessage = { role: "user", content: question, timestamp: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      chatMutation
        .mutateAsync({
          message: question,
          history: messages.map((m) => ({ role: m.role, content: m.content, timestamp: m.timestamp })),
          skillLevel: skillLevel as any,
        })
        .then((result) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: result.answer, timestamp: Date.now(), suggestions: result.suggestions },
          ]);
        })
        .catch(() => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Sorry, something went wrong.", timestamp: Date.now() },
          ]);
        })
        .finally(() => {
          setIsLoading(false);
          setInput("");
        });
    },
    [messages, chatMutation, skillLevel]
  );

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
    } catch {
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

  // Pick lists based on skill level
  const messageTypes = skillLevel === "beginner" ? BEGINNER_MESSAGE_TYPES : MESSAGE_TYPES;
  const tones = skillLevel === "beginner" ? BEGINNER_TONES : TONES;
  // Show advanced variable fields expanded by default for advanced/expert
  const showExtraFields = skillLevel === "advanced" || skillLevel === "expert" || showAdvancedFields;

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
          aria-label="Open Rebooked AI"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Chat Panel */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-full sm:w-[420px] p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <SheetTitle className="text-base">Rebooked AI</SheetTitle>
                <Badge variant="secondary" className="text-xs">In-House</Badge>
                {skillLevel === "beginner" && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-500 border-green-500/30">Guided</Badge>
                )}
              </div>
            </div>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-4 mt-2 grid w-auto grid-cols-2">
              <TabsTrigger value="chat" className="gap-1.5 text-xs">
                <HelpCircle className="h-3.5 w-3.5" />
                {skillLevel === "beginner" ? "Ask a Question" : "Help Chat"}
              </TabsTrigger>
              <TabsTrigger value="generator" className="gap-1.5 text-xs">
                <Wand2 className="h-3.5 w-3.5" />
                {skillLevel === "beginner" ? "Create Message" : "Message Generator"}
              </TabsTrigger>
            </TabsList>

            {/* Help Chat Tab */}
            <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 mt-0 px-0">
              <ScrollArea className="flex-1 px-4" ref={scrollRef}>
                <div className="space-y-4 py-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
                          __html: msg.content
                            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                            .replace(/\n/g, "<br/>")
                        }} />
                        {msg.suggestions && msg.suggestions.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {msg.suggestions.map((s, j) => (
                              <button
                                key={j}
                                onClick={() => handleSuggestionClick(s)}
                                className="text-xs bg-background border rounded-full px-2.5 py-1 hover:bg-accent transition-colors text-left"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                        <span className="inline-flex gap-1">
                          <span className="animate-bounce">.</span>
                          <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>.</span>
                          <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="border-t p-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      skillLevel === "beginner"
                        ? "Type a question..."
                        : "Ask anything about Rebooked..."
                    }
                    className="text-sm"
                    disabled={isLoading}
                  />
                  <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </TabsContent>

            {/* Message Generator Tab */}
            <TabsContent value="generator" className="flex-1 flex flex-col min-h-0 mt-0 px-0">
              <ScrollArea className="flex-1 px-4">
                <div className="space-y-3 py-4">
                  {skillLevel === "beginner" && (
                    <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 text-xs text-muted-foreground">
                      Pick a message type and tone, enter a client name, and hit **Generate**. You'll get ready-to-use texts instantly!
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-medium">Message Type</label>
                    <Select value={genType} onValueChange={setGenType}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {messageTypes.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium">Tone</label>
                    {skillLevel === "beginner" ? (
                      // Beginner: simple toggle buttons instead of dropdown
                      <div className="flex gap-2 flex-wrap">
                        {tones.map((t) => (
                          <button
                            key={t.value}
                            onClick={() => setGenTone(t.value)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                              genTone === t.value
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-transparent text-muted-foreground border-border hover:border-primary/30"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <Select value={genTone} onValueChange={setGenTone}>
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {tones.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Core fields — always visible */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Client Name</label>
                      <Input
                        value={genName}
                        onChange={(e) => setGenName(e.target.value)}
                        placeholder="Jane"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Business</label>
                      <Input
                        value={genBusiness}
                        onChange={(e) => setGenBusiness(e.target.value)}
                        placeholder="Glow Salon"
                        className="text-sm"
                      />
                    </div>
                  </div>

                  {/* Intermediate: date/time visible, link/amount behind toggle */}
                  {/* Beginner: date/time behind toggle, link/amount hidden */}
                  {/* Advanced: everything visible */}
                  {(skillLevel !== "beginner") && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Date</label>
                        <Input
                          value={genDate}
                          onChange={(e) => setGenDate(e.target.value)}
                          placeholder="March 30"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Time</label>
                        <Input
                          value={genTime}
                          onChange={(e) => setGenTime(e.target.value)}
                          placeholder="2:00 PM"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Extra fields — toggle for beginner/intermediate, always visible for advanced */}
                  {skillLevel === "beginner" && (
                    <button
                      onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showAdvancedFields ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {showAdvancedFields ? "Hide extra fields" : "More options (date, time, link...)"}
                    </button>
                  )}
                  {skillLevel === "intermediate" && !showExtraFields && (
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
                      {skillLevel === "beginner" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Date</label>
                            <Input
                              value={genDate}
                              onChange={(e) => setGenDate(e.target.value)}
                              placeholder="March 30"
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Time</label>
                            <Input
                              value={genTime}
                              onChange={(e) => setGenTime(e.target.value)}
                              placeholder="2:00 PM"
                              className="text-sm"
                            />
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Booking Link</label>
                          <Input
                            value={genLink}
                            onChange={(e) => setGenLink(e.target.value)}
                            placeholder="https://..."
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Amount</label>
                          <Input
                            value={genAmount}
                            onChange={(e) => setGenAmount(e.target.value)}
                            placeholder="$50"
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <Button onClick={handleGenerate} disabled={isLoading} className="w-full gap-2">
                    {isLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    {skillLevel === "beginner" ? "Generate Messages" : "Generate Variations"}
                  </Button>

                  {generatedMessages.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {skillLevel === "beginner"
                          ? `Here are ${generatedMessages.length} messages — copy your favorite!`
                          : `Generated ${generatedMessages.length} variations:`}
                      </p>
                      {generatedMessages.map((msg, i) => (
                        <div
                          key={i}
                          className="group relative rounded-lg border p-3 text-sm hover:border-primary/50 transition-colors"
                        >
                          <p>{msg}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {msg.length} chars
                              {msg.length > 160 && (
                                <span className="text-destructive ml-1">(over limit!)</span>
                              )}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => handleCopy(msg, i)}
                            >
                              {copiedIdx === i ? (
                                <>
                                  <Check className="h-3 w-3" /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" /> Copy
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        onClick={handleGenerate}
                        disabled={isLoading}
                        className="w-full gap-2 text-sm"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Regenerate
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
