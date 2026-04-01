import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  RefreshCw, Calendar, Clock, CheckCircle, AlertTriangle,
  Settings, Zap, ArrowRight, MessageSquare, Phone,
} from "lucide-react";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { toast } from "sonner";
import "@/styles/components.css";

// ─── Constants ──────────────────────────────────────────────────────────────

const FONT_HEADING: React.CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtNumber = (n: number) => n.toLocaleString();

const fmtPercent = (n: number) => (n === 0 ? "0%" : `${n.toFixed(1)}%`);

const fmtDuration = (mins: number) => {
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

// ─── Status Badge ───────────────────────────────────────────────────────────

function RescheduleBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    completed: {
      label: "Completed",
      className: "bg-success/15 text-success border-success/30",
    },
    pending: {
      label: "Pending",
      className: "bg-warning/15 text-warning border-warning/30",
    },
    failed: {
      label: "Failed",
      className: "bg-destructive/15 text-destructive border-destructive/30",
    },
    cancelled: {
      label: "Cancelled",
      className: "bg-muted text-muted-foreground border-border",
    },
  };
  const { label, className } = config[status] ?? config.pending;
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Rescheduling() {
  const utils = trpc.useUtils();
  const { data: metrics, isLoading: metricsLoading } = trpc.analytics.reschedulingMetrics.useQuery(
    undefined,
    { retry: false }
  );
  const { data: settings, isLoading: settingsLoading } = trpc.tenant.settings.useQuery(
    undefined,
    { retry: false }
  );

  const updateConfig = trpc.tenant.updateReschedulingConfig.useMutation({
    onSuccess: () => {
      toast.success("Rescheduling configuration saved");
      utils.tenant.settings.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  // ── Config state ──
  const [config, setConfig] = useState({
    selfServiceEnabled: true,
    smsReschedulingEnabled: true,
    maxReschedules: 3,
    rescheduleWindowHours: 24,
    autoSuggestTimes: true,
    suggestedTimeSlots: 3,
    requireConfirmation: true,
    notifyProviderOnReschedule: true,
    preventSameDayReschedule: false,
  });

  // ── Load saved config ──
  useEffect(() => {
    if (settings?.reschedulingConfig) {
      setConfig((prev) => ({ ...prev, ...(settings.reschedulingConfig as any) }));
    }
  }, [settings]);

  const handleSave = () => {
    updateConfig.mutate(config);
  };

  // ── Mock recent activity data ──
  const recentActivity = [
    { id: "1", client: "Sarah M.", original: "Mar 22, 10:00 AM", newTime: "Mar 24, 2:00 PM", method: "sms", status: "completed" },
    { id: "2", client: "James K.", original: "Mar 23, 3:30 PM", newTime: "Mar 25, 11:00 AM", method: "sms", status: "completed" },
    { id: "3", client: "Emily R.", original: "Mar 24, 9:00 AM", newTime: "Mar 26, 4:00 PM", method: "self-service", status: "pending" },
    { id: "4", client: "Michael D.", original: "Mar 21, 1:00 PM", newTime: "—", method: "sms", status: "failed" },
    { id: "5", client: "Lisa T.", original: "Mar 24, 11:30 AM", newTime: "Mar 25, 9:30 AM", method: "self-service", status: "completed" },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        {/* ═══════════════════════ HEADER ═══════════════════════ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={FONT_HEADING}>
              Rescheduling
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Automated appointment rescheduling through SMS to recover revenue and prevent no-shows
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={updateConfig.isPending}
            className="gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {updateConfig.isPending ? "Saving..." : "Save Configuration"}
          </Button>
        </div>

        {/* ═══════════════════════ METRICS ═══════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Total Reschedules",
              tooltip: "Total number of rescheduling offers sent to clients via SMS or self-service portal.",
              value: metrics?.totalReschedules ?? 0,
              format: fmtNumber,
              icon: RefreshCw,
              color: "text-info",
              bg: "bg-info/10",
            },
            {
              title: "Successful Rebooks",
              tooltip: "Clients who accepted a reschedule offer and confirmed a new appointment time.",
              value: metrics?.successfulRebooks ?? 0,
              format: fmtNumber,
              icon: CheckCircle,
              color: "text-success",
              bg: "bg-success/10",
            },
            {
              title: "Prevented No-Shows",
              tooltip: "Appointments that would have been missed but were rescheduled before the original time.",
              value: metrics?.preventedNoShows ?? 0,
              format: fmtNumber,
              icon: AlertTriangle,
              color: "text-warning",
              bg: "bg-warning/10",
            },
            {
              title: "Avg Reschedule Time",
              tooltip: "Average time between a reschedule offer being sent and the client confirming a new slot.",
              value: metrics?.avgRescheduleTime ?? 0,
              format: fmtDuration,
              icon: Clock,
              color: "text-accent-foreground",
              bg: "bg-accent/10",
            },
          ].map(({ title, tooltip, value, format, icon: Icon, color, bg }) => (
            <Card key={title}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <HelpTooltip content={tooltip} variant="info">
                      <p className="text-xs text-muted-foreground font-medium">{title}</p>
                    </HelpTooltip>
                    <p className="text-2xl font-bold mt-1" style={FONT_HEADING}>
                      {metricsLoading ? "—" : format(value)}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ═══════════════════════ TABS ═══════════════════════ */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm flex-shrink-0">
              <Calendar className="w-3.5 h-3.5 hidden sm:inline" /> Overview
            </TabsTrigger>
            <TabsTrigger value="self-service" className="gap-1.5 text-xs sm:text-sm flex-shrink-0">
              <MessageSquare className="w-3.5 h-3.5 hidden sm:inline" /> Self-Service
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm flex-shrink-0">
              <Settings className="w-3.5 h-3.5 hidden sm:inline" /> Settings
            </TabsTrigger>
          </TabsList>

          {/* ─── OVERVIEW TAB ─── */}
          <TabsContent value="overview" className="space-y-6">
            {/* Success Rate */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base" style={FONT_HEADING}>
                  Rescheduling Success Rate
                </CardTitle>
                <CardDescription>
                  How effectively your automated rescheduling converts cancellations into rebooked appointments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Offered</p>
                    <p className="text-3xl font-bold" style={FONT_HEADING}>
                      {metricsLoading ? "—" : fmtNumber(metrics?.totalReschedules ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">reschedule opportunities</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Accepted</p>
                    <p className="text-3xl font-bold text-success" style={FONT_HEADING}>
                      {metricsLoading ? "—" : fmtNumber(metrics?.successfulRebooks ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">successfully rebooked</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Conversion Rate</p>
                    <p className="text-3xl font-bold text-info" style={FONT_HEADING}>
                      {metricsLoading
                        ? "—"
                        : fmtPercent(
                            (metrics?.totalReschedules ?? 0) > 0
                              ? ((metrics?.successfulRebooks ?? 0) / (metrics?.totalReschedules ?? 1)) * 100
                              : 0
                          )}
                    </p>
                    <p className="text-xs text-muted-foreground">of offers accepted</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base" style={FONT_HEADING}>
                  Recent Rescheduling Activity
                </CardTitle>
                <CardDescription>Latest appointment rescheduling events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivity.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          {item.method === "sms" ? (
                            <Phone className="w-4 h-4 text-primary" />
                          ) : (
                            <MessageSquare className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.client}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {item.original}
                            {item.newTime !== "—" && (
                              <>
                                <ArrowRight className="w-3 h-3" />
                                {item.newTime}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs capitalize">
                          {item.method === "sms" ? "SMS" : "Self-service"}
                        </Badge>
                        <RescheduleBadge status={item.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── SELF-SERVICE TAB ─── */}
          <TabsContent value="self-service" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base" style={FONT_HEADING}>
                  SMS Rescheduling
                </CardTitle>
                <CardDescription>
                  Allow clients to reschedule appointments via SMS text messages
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <HelpTooltip content="When a client can't make their appointment, Rebooked automatically offers them new available slots via SMS." variant="info">
                    <Label className="text-sm font-medium">Enable SMS Rescheduling</Label>
                  </HelpTooltip>
                    <p className="text-xs text-muted-foreground">
                      Clients can reply to SMS to reschedule their appointment
                    </p>
                  </div>
                  <Switch
                    checked={config.smsReschedulingEnabled}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, smsReschedulingEnabled: v }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Self-Service Portal</Label>
                    <p className="text-xs text-muted-foreground">
                      Provide a link for clients to reschedule on their own
                    </p>
                  </div>
                  <Switch
                    checked={config.selfServiceEnabled}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, selfServiceEnabled: v }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base" style={FONT_HEADING}>
                  Smart Suggestions
                </CardTitle>
                <CardDescription>
                  Automatically suggest alternative time slots when a client needs to reschedule
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <HelpTooltip content="AI picks the best available slots to offer clients based on their history and your schedule." variant="info">
                    <Label className="text-sm font-medium">Auto-Suggest Times</Label>
                  </HelpTooltip>
                    <p className="text-xs text-muted-foreground">
                      AI picks the best available slots based on client and provider history
                    </p>
                  </div>
                  <Switch
                    checked={config.autoSuggestTimes}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, autoSuggestTimes: v }))}
                  />
                </div>

                {config.autoSuggestTimes && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Number of Alternatives</Label>
                    <p className="text-xs text-muted-foreground">
                      How many time slots to suggest to the client
                    </p>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={config.suggestedTimeSlots}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, suggestedTimeSlots: parseInt(e.target.value) || 3 }))
                      }
                      className="w-24"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <HelpTooltip content="Minimum hours before an appointment that a client is allowed to request a reschedule." variant="info">
                    <Label className="text-sm font-medium">Reschedule Window</Label>
                  </HelpTooltip>
                  <p className="text-xs text-muted-foreground">
                    Minimum hours before the appointment that a client can reschedule
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={168}
                      value={config.rescheduleWindowHours}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, rescheduleWindowHours: parseInt(e.target.value) || 24 }))
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">hours before appointment</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── SETTINGS TAB ─── */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base" style={FONT_HEADING}>
                  Reschedule Limits
                </CardTitle>
                <CardDescription>
                  Control how many times an appointment can be rescheduled
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Max Reschedules per Appointment</Label>
                  <p className="text-xs text-muted-foreground">
                    The maximum number of times a single appointment can be rescheduled
                  </p>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={config.maxReschedules}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, maxReschedules: parseInt(e.target.value) || 3 }))
                    }
                    className="w-24"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base" style={FONT_HEADING}>
                  Confirmations & Notifications
                </CardTitle>
                <CardDescription>
                  Configure how reschedules are confirmed and who gets notified
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Require Confirmation</Label>
                    <p className="text-xs text-muted-foreground">
                      Ask clients to confirm their new time before finalizing the reschedule
                    </p>
                  </div>
                  <Switch
                    checked={config.requireConfirmation}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, requireConfirmation: v }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Notify Provider on Reschedule</Label>
                    <p className="text-xs text-muted-foreground">
                      Send a notification to the service provider when an appointment is rescheduled
                    </p>
                  </div>
                  <Switch
                    checked={config.notifyProviderOnReschedule}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, notifyProviderOnReschedule: v }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base" style={FONT_HEADING}>
                  Restrictions
                </CardTitle>
                <CardDescription>
                  Additional rules to control rescheduling behavior
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Prevent Same-Day Reschedule</Label>
                    <p className="text-xs text-muted-foreground">
                      Block rescheduling to a different time on the same day as the original appointment
                    </p>
                  </div>
                  <Switch
                    checked={config.preventSameDayReschedule}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, preventSameDayReschedule: v }))}
                  />
                </div>

                {config.preventSameDayReschedule && (
                  <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Clients will not be able to reschedule to another time slot on the same day.
                      This can reduce last-minute schedule shuffling but may lower reschedule acceptance rates.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
