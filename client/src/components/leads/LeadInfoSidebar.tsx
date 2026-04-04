import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, User, Mail, Calendar, MessageSquare, CalendarCheck, Clock, Activity, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { Lead } from "../../../../shared/interfaces";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const tierConfig = {
  cold: { label: "Cold", color: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  warm: { label: "Warm", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  hot: { label: "Hot", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  vip: { label: "VIP", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
} as const;

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 76 ? "#a855f7" : score >= 51 ? "#f97316" : score >= 26 ? "#eab308" : "#6b7280";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/30" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{score}</span>
    </div>
  );
}

interface LeadInfoSidebarProps {
  lead: Lead;
  outboundCount: number;
  inboundCount: number;
}

export function LeadInfoSidebar({ lead, outboundCount, inboundCount }: LeadInfoSidebarProps) {
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    name: lead.name ?? "",
    email: lead.email ?? "",
    notes: lead.notes ?? "",
    appointmentAt: lead.appointmentAt
      ? new Date(lead.appointmentAt).toISOString().slice(0, 16)
      : "",
  });

  const utils = trpc.useUtils();
  const updateLead = trpc.leads.update.useMutation({
    onSuccess: () => {
      toast.success("Saved ✓");
      setEditMode(false);
      utils.leads.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
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
                    leadId: lead.id,
                    name: editData.name || undefined,
                    email: editData.email || undefined,
                    notes: editData.notes || undefined,
                    appointmentAt: editData.appointmentAt
                      ? new Date(editData.appointmentAt)
                      : null,
                  })
                }
              >
                {updateLead.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                className="flex items-center gap-2.5 w-full text-left group"
                onClick={() => {
                  navigator.clipboard.writeText(lead.phone);
                  toast.success("Phone copied");
                }}
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
                  onClick={() => {
                    navigator.clipboard.writeText(lead.email!);
                    toast.success("Email copied");
                  }}
                  title="Click to copy"
                >
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate group-hover:text-primary transition-colors">{lead.email}</span>
                </button>
              )}
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  {lead.appointmentAt ? (
                    <>
                      <p className="text-sm">
                        {new Date(lead.appointmentAt).toLocaleDateString([], {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(lead.appointmentAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No appointment set</span>
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
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {lead.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
              value: new Date(lead.createdAt).toLocaleDateString([], {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
          {lead.status === "unsubscribed" && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground bg-destructive/10 text-destructive rounded p-2 leading-relaxed">
                This contact replied STOP and has been unsubscribed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <LeadScoreCard leadId={lead.id} />
      <StatusHistoryCard leadId={lead.id} />
    </div>
  );
}

function LeadScoreCard({ leadId }: { leadId: number }) {
  const { data: score, isLoading } = trpc.leads.getScore.useQuery({ leadId });

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-semibold">Lead Score</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
              <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!score) return null;

  const tier = tierConfig[score.tier];
  const signals = [
    { label: "Response rate", value: `${score.signals.responseRate}%`, icon: <MessageSquare className="w-3 h-3" /> },
    { label: "Bookings", value: score.signals.bookingCount, icon: <CalendarCheck className="w-3 h-3" /> },
    { label: "Days since last msg", value: score.signals.daysSinceLastMessage >= 999 ? "N/A" : score.signals.daysSinceLastMessage, icon: <Clock className="w-3 h-3" /> },
    { label: "Total messages", value: score.signals.totalMessages, icon: <Activity className="w-3 h-3" /> },
  ];

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-sm font-semibold">Lead Score</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-center gap-4 mb-3">
          <ScoreRing score={score.score} />
          <div>
            <Badge variant="outline" className={`text-xs ${tier.color}`}>
              {tier.label}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">{score.score}/100 engagement</p>
          </div>
        </div>
        <div className="space-y-2 pt-2 border-t border-border">
          {signals.map(({ label, value, icon }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                {icon}
                {label}
              </span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_NAMES: Record<string, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified",
  booked: "Booked", lost: "Lost", unsubscribed: "Unsubscribed",
};
const TRIGGER_LABELS: Record<string, string> = {
  outbound_sms: "Outbound SMS", inbound_sms: "Inbound reply",
  stop_keyword: "STOP keyword", start_keyword: "START keyword",
  worker_stale: "Stale detected", manual: "Manual",
  manual_no_show: "No-show", manual_booked: "Booked",
  manual_cancelled: "Cancelled",
};

function StatusHistoryCard({ leadId }: { leadId: number }) {
  const [open, setOpen] = useState(false);
  const { data: history = [], isLoading } = trpc.leads.statusHistory.useQuery(
    { leadId, limit: 5 },
    { enabled: !!leadId },
  );

  if (isLoading || history.length === 0) return null;

  function timeAgo(date: string | Date) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <Card className="border-border bg-card">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 border-b border-border cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" /> Status History
              </CardTitle>
              {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-4">
            <div className="space-y-2.5">
              {history.map((entry) => {
                const isAuto = !entry.triggeredBy?.startsWith("user:");
                return (
                  <div key={entry.id} className="flex items-start gap-2 text-xs">
                    <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${isAuto ? "bg-amber-500" : "bg-muted-foreground"}`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{STATUS_NAMES[entry.toStatus] ?? entry.toStatus}</span>
                      <span className="text-muted-foreground"> from {STATUS_NAMES[entry.fromStatus] ?? entry.fromStatus}</span>
                      <div className="text-muted-foreground mt-0.5">
                        {TRIGGER_LABELS[entry.trigger] ?? entry.trigger} &middot; {timeAgo(entry.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
