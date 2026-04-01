import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Shield,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

// ─── Status Header ─────────────────────────────────────────────────────────

function SentinelStatusHeader() {
  const { data: health } = trpc.admin.repairs.sentinelHealth.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const { data: stats } = trpc.admin.repairs.stats.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const sentinel = health?.sentinel;
  const disabledCount = health?.disabledFeatures?.length ?? 0;
  const repairStats = stats?.repairStats ?? {};

  const statusColor = sentinel?.status === "healthy"
    ? "bg-green-500"
    : sentinel?.status === "stale"
      ? "bg-yellow-500"
      : "bg-gray-400";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Eye className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sentinel Dashboard</h1>
          <p className="text-sm text-muted-foreground">Autonomous error detection, repair, and recovery</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${statusColor} ${sentinel?.status === "healthy" ? "animate-pulse" : ""}`} />
          <span className="text-sm font-medium capitalize">{sentinel?.status ?? "unknown"}</span>
          {sentinel?.cycleCount != null && (
            <span className="text-xs text-muted-foreground">Cycle #{sentinel.cycleCount}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Active Repairs"
          value={repairStats.detected ?? 0 + (repairStats.diagnosing ?? 0) + (repairStats.patching ?? 0) + (repairStats.testing ?? 0) + (repairStats.verifying ?? 0)}
          variant="default"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Deployed Fixes"
          value={repairStats.deployed ?? 0}
          variant="success"
        />
        <StatCard
          icon={<XCircle className="h-4 w-4" />}
          label="Failed"
          value={repairStats.failed ?? 0}
          variant="destructive"
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Escalated"
          value={repairStats.escalated ?? 0}
          variant="warning"
        />
        <StatCard
          icon={<Shield className="h-4 w-4" />}
          label="Disabled Features"
          value={disabledCount}
          variant={disabledCount > 0 ? "destructive" : "default"}
        />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, variant }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  variant: "default" | "success" | "destructive" | "warning";
}) {
  const colors = {
    default: "text-muted-foreground",
    success: "text-green-600",
    destructive: "text-red-600",
    warning: "text-yellow-600",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {icon}
          {label}
        </div>
        <div className={`text-2xl font-bold ${colors[variant]}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

// ─── Repair Effectiveness ──────────────────────────────────────────────────

function RepairEffectivenessSection() {
  const [days, setDays] = useState(14);
  const { data } = trpc.admin.sentinel.repairEffectiveness.useQuery(
    { days },
    { refetchInterval: 60_000 },
  );

  if (!data) return <Card><CardContent className="p-6 text-center text-muted-foreground">Loading...</CardContent></Card>;

  const total = data.statusDistribution.reduce((sum, r) => sum + r.cnt, 0);
  const deployed = data.statusDistribution.find(s => s.status === "deployed")?.cnt ?? 0;
  const successRate = total > 0 ? Math.round((deployed / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Repair Effectiveness</CardTitle>
            <CardDescription>Success rate and phase durations over {days} days</CardDescription>
          </div>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Success rate */}
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold text-green-600">{successRate}%</div>
          <div className="text-sm text-muted-foreground">success rate ({deployed}/{total} repairs deployed)</div>
        </div>

        {/* Status distribution */}
        <div className="flex gap-2 flex-wrap">
          {data.statusDistribution.map((s) => (
            <Badge key={s.status} variant={s.status === "deployed" ? "default" : s.status === "failed" ? "destructive" : "secondary"}>
              {s.status}: {s.cnt}
            </Badge>
          ))}
        </div>

        {/* By error type */}
        {data.byErrorType.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">By Error Type</h4>
            <div className="space-y-1">
              {data.byErrorType.map((t) => {
                const rate = t.total > 0 ? Math.round(((t.deployed ?? 0) / t.total) * 100) : 0;
                return (
                  <div key={t.errorType} className="flex items-center gap-2 text-sm">
                    <span className="w-24 font-mono text-xs">{t.errorType}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${rate}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      {t.deployed ?? 0}/{t.total} ({rate}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Phase durations */}
        {data.phaseDurations && (
          <div>
            <h4 className="text-sm font-medium mb-2">Avg Phase Duration (deployed repairs)</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { label: "Diagnosis", value: data.phaseDurations.avgDiagnosis },
                { label: "Patch", value: data.phaseDurations.avgPatch },
                { label: "Test", value: data.phaseDurations.avgTest },
                { label: "Verify", value: data.phaseDurations.avgVerify },
                { label: "Total", value: data.phaseDurations.avgTotal },
              ].map((p) => (
                <div key={p.label} className="text-center p-2 bg-muted/50 rounded">
                  <div className="text-xs text-muted-foreground">{p.label}</div>
                  <div className="font-mono text-sm">{p.value != null ? `${Math.round(p.value)}s` : "N/A"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily trend */}
        {data.dailyTrend.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Daily Trend</h4>
            <div className="flex gap-1 items-end h-16">
              {data.dailyTrend.map((d) => {
                const maxVal = Math.max(...data.dailyTrend.map(r => r.total), 1);
                const height = (d.total / maxVal) * 100;
                const deployedPct = d.total > 0 ? ((d.deployed ?? 0) / d.total) * 100 : 0;
                return (
                  <div
                    key={d.day}
                    className="flex-1 rounded-t relative group"
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`${d.day}: ${d.total} total, ${d.deployed ?? 0} deployed`}
                  >
                    <div className="absolute inset-0 bg-red-300 rounded-t" />
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-green-500 rounded-t"
                      style={{ height: `${deployedPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{data.dailyTrend[0]?.day}</span>
              <span>{data.dailyTrend[data.dailyTrend.length - 1]?.day}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Analyzer Violations ───────────────────────────────────────────────────

function AnalyzerViolationsSection() {
  const { data } = trpc.admin.sentinel.analyzerViolations.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  if (!data) return <Card><CardContent className="p-6 text-center text-muted-foreground">Loading...</CardContent></Card>;

  const tabs = [
    { key: "pipeline", label: "Pipeline", icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { key: "automation", label: "Automations", icon: <Zap className="h-3.5 w-3.5" /> },
    { key: "data", label: "Data", icon: <Activity className="h-3.5 w-3.5" /> },
    { key: "plan", label: "Plan", icon: <Shield className="h-3.5 w-3.5" /> },
    { key: "correlation", label: "Correlations", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Analyzer Violations (24h)</CardTitle>
        <CardDescription>Automated checks across pipeline, data, automations, and plan consistency</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pipeline">
          <TabsList className="mb-3">
            {tabs.map((t) => {
              const count = (data as any)[t.key]?.length ?? 0;
              return (
                <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                  {t.icon}
                  {t.label}
                  {count > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{count}</Badge>}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {tabs.map((t) => {
            const violations = (data as any)[t.key] ?? [];
            return (
              <TabsContent key={t.key} value={t.key}>
                {violations.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No violations in the last 24 hours</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {violations.map((v: any) => (
                      <div key={v.id} className="flex items-start gap-3 p-2 rounded bg-muted/50 text-sm">
                        <Badge variant={v.severity === "critical" ? "destructive" : v.severity === "high" ? "destructive" : "secondary"} className="shrink-0 text-[10px]">
                          {v.severity}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{v.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Tenant #{v.tenantId} &middot; {new Date(v.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─── Feature Disable Timeline ──────────────────────────────────────────────

function FeatureDisableTimeline() {
  const { data } = trpc.admin.sentinel.featureDisableHistory.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Circuit Breaker History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No circuit breaker events recorded</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Circuit Breaker History</CardTitle>
        <CardDescription>Feature disable/recovery timeline with auto-recovery status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((entry) => {
            const isRecovered = entry.enabled;
            const duration = entry.disabledAt && entry.recoveredAt
              ? Math.round((new Date(entry.recoveredAt).getTime() - new Date(entry.disabledAt).getTime()) / 60_000)
              : null;
            return (
              <div key={entry.id} className="flex items-start gap-3 p-3 rounded border">
                <div className={`mt-0.5 h-3 w-3 rounded-full shrink-0 ${isRecovered ? "bg-green-500" : "bg-red-500"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{entry.feature}</span>
                    <Badge variant={isRecovered ? "default" : "destructive"} className="text-[10px]">
                      {isRecovered ? "Recovered" : "Disabled"}
                    </Badge>
                    {entry.tenantId && entry.tenantId !== 0 && (
                      <Badge variant="outline" className="text-[10px]">Tenant #{entry.tenantId}</Badge>
                    )}
                    {entry.tenantId === 0 && (
                      <Badge variant="outline" className="text-[10px]">Platform-wide</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                    {entry.disabledAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Disabled: {new Date(entry.disabledAt).toLocaleString()}
                      </span>
                    )}
                    {entry.recoveredAt && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Recovered: {new Date(entry.recoveredAt).toLocaleString()}
                      </span>
                    )}
                    {duration != null && (
                      <span>Duration: {duration}min</span>
                    )}
                    {entry.recoveryAttempts != null && entry.recoveryAttempts > 0 && (
                      <span>{entry.recoveryAttempts} recovery check(s)</span>
                    )}
                  </div>
                  {entry.reason && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">Reason: {entry.reason}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Metrics Time Series ───────────────────────────────────────────────────

function MetricsTimeSeriesSection() {
  const { data: categories } = trpc.admin.sentinel.metricsCategories.useQuery();
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [hours, setHours] = useState(24);

  const { data } = trpc.admin.sentinel.metricsTimeseries.useQuery(
    { metric: selectedMetric ?? undefined, hours },
    { enabled: !!selectedMetric, refetchInterval: 60_000 },
  );

  const uniqueMetrics = categories ? [...new Set(categories.map(c => c.metric))] : [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Adaptive Metrics</CardTitle>
            <CardDescription>Performance metrics with p50/p95 baseline overlays</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={selectedMetric ?? ""} onValueChange={(v) => setSelectedMetric(v || null)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select metric..." />
              </SelectTrigger>
              <SelectContent>
                {uniqueMetrics.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6h</SelectItem>
                <SelectItem value="24">24h</SelectItem>
                <SelectItem value="72">3d</SelectItem>
                <SelectItem value="168">7d</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedMetric ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Select a metric to view time series data</p>
        ) : !data || data.metrics.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No data for the selected metric and time range</p>
        ) : (
          <div>
            {/* Simple text-based metric display (chart library would enhance this) */}
            <div className="flex gap-4 mb-3">
              {data.baselines.map((b) => (
                <div key={`${b.tenantId}-${b.metric}`} className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">p50: {Number(b.p50).toFixed(1)}</Badge>
                  <Badge variant="outline" className="text-[10px]">p95: {Number(b.p95).toFixed(1)}</Badge>
                  <span className="text-[10px] text-muted-foreground">({b.sampleCount} samples)</span>
                </div>
              ))}
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {data.metrics.slice(-50).map((m: any) => (
                <div key={m.id} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-36 shrink-0">
                    {new Date(m.measuredAt).toLocaleString()}
                  </span>
                  <span className="font-mono">{Number(m.value).toFixed(2)}</span>
                  {m.category && <Badge variant="outline" className="text-[9px]">{m.category}</Badge>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────

export default function AdminSentinelDashboard() {
  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <SentinelStatusHeader />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RepairEffectivenessSection />
        <FeatureDisableTimeline />
      </div>

      <AnalyzerViolationsSection />

      <MetricsTimeSeriesSection />
    </div>
  );
}
