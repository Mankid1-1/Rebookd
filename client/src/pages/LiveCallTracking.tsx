/**
 * 📞 LIVE CALL TRACKING DASHBOARD
 * Voice call tracking for Twilio, Telnyx, Google Voice (manual), and generic webhooks.
 * Shows KPI stats, call volume charts, hourly distribution, and live call feed.
 */

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useChartColors } from "@/hooks/useChartColors";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle,
  XCircle,
  Voicemail,
  AlertCircle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { toast } from "sonner";

const HEADING_FONT = { fontFamily: "'Space Grotesk', sans-serif" };

const PERIOD_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
] as const;

function formatDuration(seconds: number): string {
  if (seconds === 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  completed: { label: "Completed", color: "bg-success/15 text-success border-success/30", icon: CheckCircle },
  missed: { label: "Missed", color: "bg-destructive/15 text-destructive border-destructive/30", icon: PhoneMissed },
  no_answer: { label: "No Answer", color: "bg-warning/15 text-warning border-warning/30", icon: XCircle },
  busy: { label: "Busy", color: "bg-warning/15 text-warning border-warning/30", icon: AlertCircle },
  voicemail: { label: "Voicemail", color: "bg-info/15 text-info border-info/30", icon: Voicemail },
  ringing: { label: "Ringing", color: "bg-info/15 text-info border-info/30", icon: Phone },
  in_progress: { label: "In Progress", color: "bg-primary/15 text-primary border-primary/30", icon: Phone },
  failed: { label: "Failed", color: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
};

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ title, value, subtitle, icon: Icon, loading }: {
  title: string; value: string; subtitle?: string; icon: typeof Phone; loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        {loading ? (
          <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-16" /></div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">{title}</p>
              <p className="text-2xl font-bold" style={HEADING_FONT}>{value}</p>
              {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Manual Call Log Dialog ─────────────────────────────────────────────────

function LogCallDialog() {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"inbound" | "outbound">("inbound");
  const [callerNumber, setCallerNumber] = useState("");
  const [calledNumber, setCalledNumber] = useState("");
  const [status, setStatus] = useState<"completed" | "missed" | "voicemail" | "no_answer">("completed");
  const [durationMin, setDurationMin] = useState("");
  const [notes, setNotes] = useState("");

  const utils = trpc.useUtils();
  const logCall = trpc.callTracking.logManualCall.useMutation({
    onSuccess: () => {
      toast.success("Call logged successfully");
      utils.callTracking.invalidate();
      setOpen(false);
      setCallerNumber("");
      setCalledNumber("");
      setNotes("");
      setDurationMin("");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Log Call
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={HEADING_FONT}>Log a Call</DialogTitle>
          <p className="text-xs text-muted-foreground">Manually log a call from Google Voice or another provider.</p>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                  <SelectItem value="voicemail">Voicemail</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Caller Number</Label>
            <Input placeholder="+15551234567" value={callerNumber} onChange={(e) => setCallerNumber(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Called Number</Label>
            <Input placeholder="+15559876543" value={calledNumber} onChange={(e) => setCalledNumber(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Duration (minutes)</Label>
            <Input type="number" placeholder="0" min={0} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea placeholder="Optional notes about this call..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <Button
            className="w-full"
            disabled={!callerNumber || !calledNumber || logCall.isPending}
            onClick={() => logCall.mutate({
              direction,
              callerNumber,
              calledNumber,
              status,
              duration: Math.round((parseFloat(durationMin) || 0) * 60),
              notes: notes || undefined,
            })}
          >
            {logCall.isPending ? "Logging..." : "Log Call"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tracking Number Setup ──────────────────────────────────────────────────

function TrackingNumberSetup() {
  const [areaCode, setAreaCode] = useState("");
  const [forwardTo, setForwardTo] = useState("");
  const [selectedNumber, setSelectedNumber] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: trackingNum, isLoading: numLoading } = trpc.callTracking.getTrackingNumber.useQuery();
  const { data: availableNumbers, isLoading: searchLoading } = trpc.callTracking.searchAvailableNumbers.useQuery(
    { areaCode: areaCode || undefined },
    { enabled: searchOpen }
  );

  const provision = trpc.callTracking.provisionNumber.useMutation({
    onSuccess: () => {
      toast.success("Tracking number provisioned! All calls will now be tracked automatically.");
      utils.callTracking.getTrackingNumber.invalidate();
      setSearchOpen(false);
      setSelectedNumber("");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateFwd = trpc.callTracking.updateForwardTo.useMutation({
    onSuccess: () => {
      toast.success("Forward-to number updated");
      utils.callTracking.getTrackingNumber.invalidate();
    },
  });

  const release = trpc.callTracking.releaseNumber.useMutation({
    onSuccess: () => {
      toast.success("Number released");
      utils.callTracking.getTrackingNumber.invalidate();
    },
  });

  if (numLoading) return <Card><CardContent className="py-8"><Skeleton className="h-16 w-full" /></CardContent></Card>;

  // Already have a tracking number — show status
  if (trackingNum) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold" style={HEADING_FONT}>Tracking Number</CardTitle>
          <CardDescription className="text-xs">All calls through this number are tracked automatically</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
              <span className="text-lg font-bold font-mono">{trackingNum.number}</span>
              <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">Active</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Forwards to: <span className="font-mono font-medium text-foreground">{trackingNum.forwardTo || "Not set"}</span>
            </div>
            <div className="ml-auto flex gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">Change Forward</Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle style={HEADING_FONT}>Update Forwarding</DialogTitle></DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Forward calls to</Label>
                      <Input
                        placeholder="+15551234567"
                        value={forwardTo}
                        onChange={(e) => setForwardTo(e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground">Your business phone or employee's phone number</p>
                    </div>
                    <Button
                      className="w-full"
                      size="sm"
                      disabled={!forwardTo || updateFwd.isPending}
                      onClick={() => updateFwd.mutate({ phoneId: trackingNum.id, forwardTo })}
                    >
                      {updateFwd.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">
              <strong>How it works:</strong> Give this number to your clients. When they call it, the call is logged automatically and forwarded to your business phone.
              For outbound calls, use the <strong>Call</strong> button next to any lead — it connects your employee to the lead through this number, tracking everything.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No tracking number yet — show setup
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold" style={HEADING_FONT}>Set Up Automatic Call Tracking</CardTitle>
        <CardDescription className="text-xs">Get a tracking number — all calls are logged automatically. No manual work.</CardDescription>
      </CardHeader>
      <CardContent>
        {!searchOpen ? (
          <div className="text-center py-6">
            <Phone className="w-10 h-10 mx-auto mb-3 text-primary/40" />
            <p className="text-sm font-medium mb-1">No tracking number yet</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
              Get a dedicated phone number that automatically tracks every inbound and outbound call — duration, status, caller ID, the lot. Give it to clients or use it for outbound calls.
            </p>
            <Button onClick={() => setSearchOpen(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Get a Tracking Number
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Area Code (optional)</Label>
                <Input placeholder="e.g. 212, 415" value={areaCode} onChange={(e) => setAreaCode(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Forward calls to (your business phone)</Label>
                <Input placeholder="+15551234567" value={forwardTo} onChange={(e) => setForwardTo(e.target.value)} />
              </div>
            </div>

            {searchLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {(availableNumbers ?? []).map((n) => (
                  <button
                    key={n.number}
                    onClick={() => setSelectedNumber(n.number)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-colors ${
                      selectedNumber === n.number
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    <div>
                      <span className="font-mono font-medium">{n.number}</span>
                      {n.locality && <span className="text-muted-foreground ml-2">{n.locality}, {n.region}</span>}
                    </div>
                    <span className="text-muted-foreground">~$1.50/mo</span>
                  </button>
                ))}
                {availableNumbers?.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No numbers available for this area code. Try a different one.</p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSearchOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={!selectedNumber || !forwardTo || provision.isPending}
                onClick={() => provision.mutate({ phoneNumber: selectedNumber, forwardTo })}
              >
                {provision.isPending ? "Provisioning..." : `Get ${selectedNumber || "number"}`}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function LiveCallTracking() {
  const [days, setDays] = useState(30);
  const [dirFilter, setDirFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const colors = useChartColors();
  const pollOpts = { refetchInterval: 15_000, staleTime: 15_000 };

  const { data: stats, isLoading: statsLoading } = trpc.callTracking.stats.useQuery({ days }, pollOpts);
  const { data: dailyData, isLoading: dailyLoading } = trpc.callTracking.callsByDay.useQuery({ days }, pollOpts);
  const { data: hourlyData, isLoading: hourlyLoading } = trpc.callTracking.callsByHour.useQuery({ days }, pollOpts);
  const { data: recentCalls } = trpc.callTracking.recentActivity.useQuery({ limit: 20 }, pollOpts);
  const { data: callList, isLoading: listLoading } = trpc.callTracking.list.useQuery({
    direction: dirFilter !== "all" ? dirFilter as any : undefined,
    status: statusFilter !== "all" ? statusFilter as any : undefined,
    search: search || undefined,
    page,
    limit: 25,
  }, pollOpts);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold" style={HEADING_FONT}>Live Call Tracking</h1>
            <p className="text-muted-foreground text-sm">Track inbound and outbound calls across all your voice providers.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(days)} onValueChange={(v) => { setDays(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <LogCallDialog />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Calls" value={String(stats?.totalCalls ?? 0)} subtitle={`${stats?.totalCompleted ?? 0} completed`} icon={Phone} loading={statsLoading} />
          <StatCard title="Avg Duration" value={formatDuration(stats?.avgDuration ?? 0)} subtitle="Completed calls only" icon={Clock} loading={statsLoading} />
          <StatCard title="Missed Rate" value={`${stats?.missedRate ?? 0}%`} subtitle={`${stats?.totalMissed ?? 0} missed of ${stats?.totalInbound ?? 0} inbound`} icon={PhoneMissed} loading={statsLoading} />
          <StatCard title="Inbound / Outbound" value={`${stats?.totalInbound ?? 0} / ${stats?.totalOutbound ?? 0}`} subtitle="Call direction breakdown" icon={PhoneIncoming} loading={statsLoading} />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Volume Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold" style={HEADING_FONT}>Call Volume</CardTitle>
              <CardDescription className="text-xs">Inbound vs outbound calls per day</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (dailyData?.length ?? 0) === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
                  <div className="text-center"><Phone className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No call data yet</p></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.muted }} tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                    <YAxis tick={{ fontSize: 10, fill: colors.muted }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11, background: "var(--card)", border: "1px solid var(--border)" }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="inbound" name="Inbound" stackId="1" stroke={colors.success} fill={colors.success} fillOpacity={0.3} />
                    <Area type="monotone" dataKey="outbound" name="Outbound" stackId="1" stroke={colors.info} fill={colors.info} fillOpacity={0.3} />
                    <Area type="monotone" dataKey="missed" name="Missed" stroke={colors.danger} fill={colors.danger} fillOpacity={0.15} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Hourly Distribution Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold" style={HEADING_FONT}>Hourly Distribution</CardTitle>
              <CardDescription className="text-xs">When calls happen (by hour of day)</CardDescription>
            </CardHeader>
            <CardContent>
              {hourlyLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: colors.muted }} tickFormatter={(v) => `${v}:00`} />
                    <YAxis tick={{ fontSize: 10, fill: colors.muted }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11, background: "var(--card)", border: "1px solid var(--border)" }} labelFormatter={(v) => `${v}:00 - ${v}:59`} />
                    <Bar dataKey="count" name="Calls" fill={colors.primary} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Call Log Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-sm font-semibold" style={HEADING_FONT}>Call Log</CardTitle>
                <CardDescription className="text-xs">{callList?.total ?? 0} total calls</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search phone..."
                    className="pl-8 h-8 w-[160px] text-xs"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
                <Select value={dirFilter} onValueChange={(v) => { setDirFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Directions</SelectItem>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="missed">Missed</SelectItem>
                    <SelectItem value="no_answer">No Answer</SelectItem>
                    <SelectItem value="voicemail">Voicemail</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {listLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (callList?.calls.length ?? 0) === 0 ? (
              <div className="py-12 text-center">
                <Phone className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No calls found</p>
                <p className="text-xs text-muted-foreground mt-1">Calls will appear here when they come in via Twilio, Telnyx, or manual logging.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Direction</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Contact</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Duration</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Provider</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {callList?.calls.map((call) => {
                        const cfg = STATUS_CONFIG[call.status] ?? STATUS_CONFIG.failed;
                        const StatusIcon = cfg.icon;
                        return (
                          <tr key={call.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-2">
                              {call.direction === "inbound" ? (
                                <span className="flex items-center gap-1 text-success"><ArrowDownLeft className="w-3.5 h-3.5" /> In</span>
                              ) : (
                                <span className="flex items-center gap-1 text-info"><ArrowUpRight className="w-3.5 h-3.5" /> Out</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2">
                              <div>
                                <span className="font-medium">{call.leadName || (call.direction === "inbound" ? call.callerNumber : call.calledNumber)}</span>
                                {call.leadName && <span className="text-muted-foreground ml-1">({call.direction === "inbound" ? call.callerNumber : call.calledNumber})</span>}
                              </div>
                            </td>
                            <td className="py-2.5 px-2">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 gap-1 ${cfg.color}`}>
                                <StatusIcon className="w-2.5 h-2.5" /> {cfg.label}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-2 font-mono">{formatDuration(call.duration)}</td>
                            <td className="py-2.5 px-2 capitalize text-muted-foreground">{call.provider}</td>
                            <td className="py-2.5 px-2 text-right text-muted-foreground">{formatTime(call.startedAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {(callList?.totalPages ?? 1) > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-3">
                    <p className="text-xs text-muted-foreground">
                      Page {callList?.page} of {callList?.totalPages} ({callList?.total} calls)
                    </p>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= (callList?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Tracking Number Setup */}
        <TrackingNumberSetup />
      </div>
    </DashboardLayout>
  );
}
