import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useMemo, useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import {
  Search,
  Send,
  MessageSquare,
  Phone,
  Check,
  CheckCheck,
  AlertCircle,
  Clock,
  ArrowLeft,
  Inbox as InboxIcon,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDayHeader(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - messageDay.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)
    return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatMessageTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

const statusColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  contacted: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  qualified: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  booked: "bg-green-500/20 text-green-400 border-green-500/30",
  lost: "bg-red-500/20 text-red-400 border-red-500/30",
  unsubscribed: "bg-muted text-muted-foreground border-muted",
};

// ── Message Status Icon ─────────────────────────────────────────────────────

function MessageStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "delivered":
      return <CheckCheck className="h-3 w-3 text-blue-400" />;
    case "sent":
      return <Check className="h-3 w-3 text-muted-foreground" />;
    case "failed":
      return <AlertCircle className="h-3 w-3 text-red-400" />;
    case "queued":
      return <Clock className="h-3 w-3 text-muted-foreground/60" />;
    default:
      return null;
  }
}

// ── Skeleton Components ─────────────────────────────────────────────────────

function ConversationListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg p-3 animate-pulse">
          <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex justify-between">
              <div className="h-4 bg-muted rounded w-24" />
              <div className="h-3 bg-muted rounded w-8" />
            </div>
            <div className="h-3 bg-muted rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="flex-1 p-4 space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
        >
          <div className="animate-pulse space-y-1">
            <div
              className={`h-10 rounded-2xl bg-muted ${
                i % 2 === 0 ? "w-56 rounded-bl-sm" : "w-44 rounded-br-sm"
              }`}
            />
            <div
              className={`h-3 bg-muted/60 rounded w-12 ${
                i % 2 === 0 ? "" : "ml-auto"
              }`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function Inbox() {
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileShowConversation, setMobileShowConversation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  // ── Data Fetching ───────────────────────────────────────────────────────

  const { data: leadsData, isLoading: leadsLoading } = trpc.leads.list.useQuery(
    { page: 1, limit: 100 },
    { refetchInterval: 15000 }
  );

  const { data: messagesData, isLoading: messagesLoading } =
    trpc.leads.messages.useQuery(
      { leadId: activeLeadId ?? 0 },
      { enabled: !!activeLeadId, refetchInterval: 5000 }
    );

  const sendMessageMutation = trpc.leads.sendMessage.useMutation();

  // Normalize leads - handle both array and { leads: [...] } shapes
  const allLeads = useMemo(() => {
    if (!leadsData) return [];
    if (Array.isArray(leadsData)) return leadsData;
    if (Array.isArray((leadsData as any).leads)) return (leadsData as any).leads;
    return [];
  }, [leadsData]);

  // Normalize messages
  const allMessages = useMemo(() => {
    if (!messagesData) return [];
    if (Array.isArray(messagesData)) return messagesData;
    return [];
  }, [messagesData]);

  // Filter and sort leads
  const filteredLeads = useMemo(() => {
    let result = [...allLeads];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (lead: any) =>
          (lead.name && lead.name.toLowerCase().includes(q)) ||
          (lead.phone && lead.phone.toLowerCase().includes(q)) ||
          (lead.email && lead.email.toLowerCase().includes(q))
      );
    }

    // Sort by updatedAt descending (most recent activity first)
    result.sort((a: any, b: any) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });

    return result;
  }, [allLeads, searchQuery]);

  const activeLead = useMemo(
    () => allLeads.find((x: any) => x.id === activeLeadId),
    [allLeads, activeLeadId]
  );

  // Group messages by day
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: any[] }[] = [];
    let currentDate = "";

    for (const msg of allMessages) {
      const day = new Date(msg.createdAt).toDateString();
      if (day !== currentDate) {
        currentDate = day;
        groups.push({ date: msg.createdAt, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    }

    return groups;
  }, [allMessages]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages]);

  // ── Auto-resize textarea ────────────────────────────────────────────────

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [draft]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleSelectLead = useCallback((leadId: number) => {
    setActiveLeadId(leadId);
    setDraft("");
    setMobileShowConversation(true);
  }, []);

  const handleBack = useCallback(() => {
    setMobileShowConversation(false);
  }, []);

  const handleSend = useCallback(() => {
    if (!activeLeadId || !draft.trim() || sendMessageMutation.isPending) return;

    const key = crypto.randomUUID();
    sendMessageMutation.mutate(
      { leadId: activeLeadId, body: draft.trim(), idempotencyKey: key },
      {
        onSuccess: () => {
          setDraft("");
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
          }
          utils.leads.messages.invalidate({ leadId: activeLeadId });
          utils.leads.list.invalidate();
        },
        onError: (error) => {
          console.error("Failed to send message:", error);
        },
      }
    );
  }, [activeLeadId, draft, sendMessageMutation, utils]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // ── Conversation List (Left Sidebar) ────────────────────────────────────

  const conversationList = (
    <div className="flex flex-col h-full border-r border-border bg-card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold mb-3">Messages</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="pl-9 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Conversation items */}
      <div className="flex-1 overflow-y-auto">
        {leadsLoading ? (
          <ConversationListSkeleton />
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "No conversations match your search" : "No conversations yet"}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filteredLeads.map((lead: any) => {
              const isActive = lead.id === activeLeadId;
              const displayName = lead.name || lead.phone || "Unknown";
              const hasMessages = lead.messageCount > 0;

              return (
                <button
                  key={lead.id}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                    isActive ? "bg-muted" : ""
                  }`}
                  onClick={() => handleSelectLead(lead.id)}
                >
                  {/* Avatar */}
                  <div
                    className={`h-10 w-10 rounded-full shrink-0 flex items-center justify-center text-sm font-medium ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {displayName}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {formatRelativeTime(lead.updatedAt || lead.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground truncate">
                        {lead.phone || "No phone"}
                      </span>
                      {hasMessages && (
                        <span className="text-[10px] text-muted-foreground bg-muted-foreground/10 rounded-full px-1.5 py-0.5 shrink-0">
                          {lead.messageCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ── Conversation View (Right Panel) ─────────────────────────────────────

  const emptyState = (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <InboxIcon className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h2 className="text-lg font-medium mb-1">Your Inbox</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Select a conversation from the list to view and reply to messages.
      </p>
    </div>
  );

  const conversationView = activeLead ? (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Conversation Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 bg-card">
        {/* Back button (mobile only) */}
        <button
          className="md:hidden shrink-0 p-1 rounded hover:bg-muted transition-colors"
          onClick={handleBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Avatar */}
        <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium shrink-0">
          {(activeLead.name || activeLead.phone || "?").charAt(0).toUpperCase()}
        </div>

        {/* Lead Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">
              {activeLead.name || "Unknown"}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${
                statusColors[activeLead.status] || ""
              }`}
            >
              {activeLead.status}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span>{activeLead.phone || "No phone"}</span>
            {activeLead.email && (
              <>
                <span className="mx-1">-</span>
                <span className="truncate">{activeLead.email}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messagesLoading ? (
          <MessagesSkeleton />
        ) : allMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              No messages yet. Send the first message below.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {groupedMessages.map((group, gi) => (
              <div key={gi}>
                {/* Day separator */}
                <div className="flex items-center justify-center my-4">
                  <div className="bg-muted text-muted-foreground text-[11px] font-medium px-3 py-1 rounded-full">
                    {formatDayHeader(group.date)}
                  </div>
                </div>

                {/* Messages in group */}
                {group.messages.map((msg: any, mi: number) => {
                  const isOutbound = msg.direction === "outbound";
                  const showTimestamp =
                    mi === group.messages.length - 1 ||
                    group.messages[mi + 1]?.direction !== msg.direction ||
                    new Date(group.messages[mi + 1]?.createdAt).getTime() -
                      new Date(msg.createdAt).getTime() >
                      300000; // 5 min gap

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${
                        isOutbound ? "justify-end" : "justify-start"
                      } ${showTimestamp ? "mb-2" : "mb-0.5"}`}
                    >
                      <div
                        className={`max-w-[75%] sm:max-w-[65%] ${
                          isOutbound ? "items-end" : "items-start"
                        }`}
                      >
                        {/* Bubble */}
                        <div
                          className={`px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                            isOutbound
                              ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                              : "bg-muted text-foreground rounded-2xl rounded-bl-sm"
                          }`}
                        >
                          {msg.body}
                        </div>

                        {/* Timestamp + Status */}
                        {showTimestamp && (
                          <div
                            className={`flex items-center gap-1 mt-1 px-1 ${
                              isOutbound ? "justify-end" : "justify-start"
                            }`}
                          >
                            <span className="text-[10px] text-muted-foreground">
                              {formatMessageTime(msg.createdAt)}
                            </span>
                            {isOutbound && <MessageStatusIcon status={msg.status} />}
                            {msg.status === "failed" && (
                              <span className="text-[10px] text-red-400">
                                Failed
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Compose Bar */}
      <div className="px-4 py-3 border-t border-border bg-card shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent placeholder:text-muted-foreground transition-colors"
            style={{ maxHeight: 120 }}
          />
          <Button
            size="icon"
            className="h-10 w-10 rounded-full shrink-0"
            onClick={handleSend}
            disabled={!draft.trim() || sendMessageMutation.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
          Press Enter to send, Shift+Enter for a new line
        </p>
      </div>
    </div>
  ) : (
    emptyState
  );

  // ── Layout ──────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex rounded-lg border border-border overflow-hidden">
        {/* Left sidebar - hidden on mobile when viewing conversation */}
        <div
          className={`w-full md:w-80 lg:w-96 shrink-0 ${
            mobileShowConversation ? "hidden md:flex md:flex-col" : "flex flex-col"
          }`}
        >
          {conversationList}
        </div>

        {/* Right panel - hidden on mobile when viewing list */}
        <div
          className={`flex-1 flex flex-col min-w-0 ${
            mobileShowConversation ? "flex" : "hidden md:flex"
          }`}
        >
          {conversationView}
        </div>
      </div>
    </DashboardLayout>
  );
}
