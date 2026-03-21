import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Bot, Calendar, Mail, MessageSquare, Phone, Send, User, Copy, Clock } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  contacted: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  qualified: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  booked: "bg-green-500/20 text-green-300 border-green-500/30",
  lost: "bg-red-500/20 text-red-300 border-red-500/30",
  unsubscribed: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  booked: "Booked ✓",
  lost: "Lost",
  unsubscribed: "Unsubscribed",
};

// Quick reply suggestions based on context
const QUICK_REPLIES = [
  "Hi {{name}}, just checking in — still interested in booking?",
  "Hi {{name}}, we have great availability this week. Would you like to book?",
  "Hey {{name}}, just a friendly reminder about your upcoming appointment!",
  "Hi {{name}}, thanks for getting back to us! We'd love to help.",
];

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const leadId = parseInt(id ?? "0");
  const [, setLocation] = useLocation();
  const [messageBody, setMessageBody] = useState("");
  const [tone, setTone] = useState<"friendly" | "professional" | "casual" | "urgent">("friendly");
  const [useAI, setUseAI] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ name: "", email: "", notes: "", appointmentAt: "" });
  const [charCount, setCharCount] = useState(0);

  const utils = trpc.useUtils();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setCharCount(messageBody.length);
  }, [messageBody]);

  const { data: lead, isLoading } = trpc.leads.get.useQuery({ leadId }, { enabled: !!leadId });
  const { data: messages = [] } = trpc.leads.messages.useQuery(
    { leadId },
    { enabled: !!leadId, refetchInterval: 5000 }
  );

  const sendMessage = trpc.leads.sendMessage.useMutation({
    onSuccess: (data) => {
      if ((data as any).smsWarning) {
        toast.warning("Message saved — SMS delivery failed. Check Twilio config in Settings.");
      } else {
        toast.success(data.aiRewritten ? "Sent with AI rewrite ✓" : "Message sent ✓");
      }
      setMessageBody("");
      setCharCount(0);
      utils.leads.messages.invalidate({ leadId });
      utils.leads.get.invalidate({ leadId });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateLead = trpc.leads.update.useMutation({
    onSuccess: () => {
      toast.success("Saved ✓");
      setEditMode(false);
      utils.leads.get.invalidate({ leadId });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStatus = trpc.leads.updateStatus.useMutation({
    onSuccess: () => {
      utils.leads.get.invalidate({ leadId });
      utils.leads.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const doSend = () => {
    if (!messageBody.trim() || sendMessage.isPending) return;
    sendMessage.mutate({ leadId, body: messageBody, tone, useAI });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
            <p className="text-muted-foreground text-sm">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Lead not found.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setLocation("/leads")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Leads
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const outboundCount = messages.filter((m) => m.direction === "outbound").length;
  const inboundCount = messages.filter((m) => m.direction === "inbound").length;
  const smsLimit = 160;
  const smsSegments = Math.ceil(charCount / smsLimit) || 1;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/leads")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {lead.name || lead.phone}
              </h1>
              {lead.name && (
                <span className="text-sm text-muted-foreground">{lead.phone}</span>
              )}
            </div>
          </div>
          {/* Status selector with colour */}
          <Select
            value={lead.status}
            onValueChange={(v) => updateStatus.mutate({ leadId, status: v as any })}
          >
            <SelectTrigger className={`w-36 h-8 text-xs border ${STATUS_STYLES[lead.status] ?? ""}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Conversation panel */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            {/* Messages */}
            <Card className="border-border bg-card flex flex-col" style={{ height: "460px" }}>
              <CardHeader className="pb-3 border-b border-border shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Conversation
                    {messages.length > 0 && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                        {messages.length}
                      </Badge>
                    )}
                  </CardTitle>
                  {outboundCount + inboundCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {outboundCount} sent · {inboundCount} received
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                    <MessageSquare className="w-8 h-8 text-muted-foreground opacity-40" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Type a message below to start the conversation</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, i) => {
                      const isOutbound = msg.direction === "outbound";
                      // Group by day
                      const msgDate = new Date(msg.createdAt).toDateString();
                      const prevDate = i > 0 ? new Date(messages[i - 1].createdAt).toDateString() : null;
                      const showDateSep = msgDate !== prevDate;
                      return (
                        <div key={msg.id}>
                          {showDateSep && (
                            <div className="flex items-center gap-2 my-2">
                              <div className="flex-1 h-px bg-border" />
                              <span className="text-[10px] text-muted-foreground px-2">
                                {new Date(msg.createdAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                              </span>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          )}
                          <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                            <div className={`group max-w-[75%] relative`}>
                              <div
                                className={`px-4 py-2.5 rounded-2xl text-sm ${
                                  isOutbound
                                    ? "bg-primary text-primary-foreground rounded-br-sm"
                                    : "bg-muted text-foreground rounded-bl-sm"
                                }`}
                              >
                                <p className="leading-relaxed">{msg.body}</p>
                              </div>
                              <div className={`flex items-center gap-1.5 mt-1 px-1 ${isOutbound ? "justify-end" : "justify-start"}`}>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                {msg.aiRewritten && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <Bot className="w-2.5 h-2.5" /> AI
                                  </span>
                                )}
                                {/* Copy button on hover */}
                                <button
                                  className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => { navigator.clipboard.writeText(msg.body); toast.success("Copied"); }}
                                  title="Copy message"
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Composer */}
            <Card className="border-border bg-card">
              <CardContent className="p-4 space-y-3">
                {/* Quick replies */}
                {messages.length === 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Quick start</p>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_REPLIES.slice(0, 2).map((qr) => (
                        <button
                          key={qr}
                          className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/30 transition-all text-muted-foreground hover:text-foreground text-left"
                          onClick={() => setMessageBody(qr.replace("{{name}}", lead.name || "there"))}
                        >
                          {qr.replace("{{name}}", lead.name || "there").slice(0, 50)}…
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="relative">
                  <Textarea
                    placeholder="Type your message… (Ctrl+Enter to send)"
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    className="resize-none min-h-[80px] pr-16 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) doSend();
                    }}
                  />
                  {/* Character / SMS segment counter */}
                  <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground tabular-nums">
                    {charCount > 0 && (
                      <span className={charCount > 160 ? "text-yellow-400" : ""}>
                        {charCount}/{smsLimit} · {smsSegments} SMS
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Switch id="useAI" checked={useAI} onCheckedChange={setUseAI} />
                      <Label htmlFor="useAI" className="text-xs flex items-center gap-1 cursor-pointer">
                        <Bot className="w-3.5 h-3.5 text-primary" /> AI rewrite
                      </Label>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={!messageBody.trim() || sendMessage.isPending}
                    onClick={doSend}
                    className="shrink-0"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    {sendMessage.isPending ? "Sending…" : "Send"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Lead Info */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Lead Info</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    if (!editMode) {
                      setEditData({
                        name: lead.name ?? "",
                        email: lead.email ?? "",
                        notes: lead.notes ?? "",
                        appointmentAt: lead.appointmentAt
                          ? new Date(lead.appointmentAt).toISOString().slice(0, 16)
                          : "",
                      });
                    }
                    setEditMode(!editMode);
                  }}
                >
                  {editMode ? "Cancel" : "Edit"}
                </Button>
              </CardHeader>
              <CardContent className="p-4">
                {editMode ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Client name"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input
                        value={editData.email}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="email@example.com"
                        type="email"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Appointment</Label>
                      <Input
                        type="datetime-local"
                        value={editData.appointmentAt}
                        onChange={(e) => setEditData({ ...editData, appointmentAt: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Textarea
                        value={editData.notes}
                        onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                        className="text-sm min-h-[70px] resize-none"
                        placeholder="Internal notes…"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={updateLead.isPending}
                      onClick={() =>
                        updateLead.mutate({
                          leadId,
                          name: editData.name || undefined,
                          email: editData.email || undefined,
                          notes: editData.notes || undefined,
                          appointmentAt: editData.appointmentAt
                            ? new Date(editData.appointmentAt).getTime()
                            : null,
                        })
                      }
                    >
                      {updateLead.isPending ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Phone — always shown, clickable to copy */}
                    <button
                      className="flex items-center gap-2.5 w-full text-left group"
                      onClick={() => { navigator.clipboard.writeText(lead.phone); toast.success("Phone copied"); }}
                      title="Click to copy"
                    >
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm group-hover:text-primary transition-colors">{lead.phone}</span>
                    </button>
                    {lead.name && (
                      <div className="flex items-center gap-2.5">
                        <User className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{lead.name}</span>
                      </div>
                    )}
                    {lead.email && (
                      <button
                        className="flex items-center gap-2.5 w-full text-left group"
                        onClick={() => { navigator.clipboard.writeText(lead.email!); toast.success("Email copied"); }}
                        title="Click to copy"
                      >
                        <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate group-hover:text-primary transition-colors">{lead.email}</span>
                      </button>
                    )}
                    {/* Appointment */}
                    <div className="flex items-start gap-2.5">
                      <Calendar className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        {lead.appointmentAt ? (
                          <>
                            <p className="text-sm">
                              {new Date(lead.appointmentAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(lead.appointmentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No appointment set — click Edit to add one</span>
                        )}
                      </div>
                    </div>
                    {lead.source && (
                      <div className="flex items-center gap-2.5">
                        <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        </div>
                        <span className="text-xs text-muted-foreground">Source: {lead.source}</span>
                      </div>
                    )}
                    {lead.notes && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1 font-medium">Notes</p>
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{lead.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Activity */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold">Activity</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2.5">
                {[
                  { label: "Messages sent", value: outboundCount },
                  { label: "Replies received", value: inboundCount },
                  {
                    label: "Last activity",
                    value: lead.lastMessageAt
                      ? new Date(lead.lastMessageAt).toLocaleDateString([], { month: "short", day: "numeric" })
                      : "Never",
                  },
                  {
                    label: "Added",
                    value: new Date(lead.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
                {lead.status === "unsubscribed" && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground bg-red-500/10 text-red-400 rounded p-2 leading-relaxed">
                      ⛔ This contact replied STOP and has been unsubscribed. Do not send further messages.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
