import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { BUILD_VERSION } from "@shared/version";
import {
  Rocket,
  Server,
  Database,
  Cpu,
  HardDrive,
  Users,
  Building2,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Activity,
  Zap,
  GitBranch,
  TrendingUp,
  Timer,
  Shield,
  Wifi,
  Bug,
  Gauge,
  Flame,
  Award,
} from "lucide-react";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDuration(ms: number | null | undefined) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(date: string | Date) {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const STATUS_STYLES: Record<
  string,
  { color: string; icon: typeof CheckCircle }
> = {
  verified: { color: "text-success border-success/30", icon: CheckCircle },
  started: { color: "text-info border-info/30", icon: Zap },
  uploading: {
    color: "text-warning border-warning/30",
    icon: RefreshCw,
  },
  reloading: {
    color: "text-warning border-warning/30",
    icon: RefreshCw,
  },
  failed: { color: "text-destructive border-destructive/30", icon: XCircle },
  rolled_back: {
    color: "text-warning border-warning/30",
    icon: AlertTriangle,
  },
};

// ── Component ───────────────────────────────────────────────────────────────

export default function AdminDeployments() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [liveStatus, setLiveStatus] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/dashboard");
  }, [user, setLocation]);

  // ── Data sources ────────────────────────────────────────────────────────

  const { data: systemInfo } = trpc.admin.systemInfo.useQuery(undefined, {
    retry: false,
    refetchInterval: 15_000,
  });

  const { data: deploys = [], isLoading: deploysLoading } =
    trpc.admin.deployments.list.useQuery(
      { limit: 20 },
      { retry: false, refetchInterval: 30_000 },
    );

  const { data: liveStats } = trpc.admin.deployments.liveStats.useQuery(
    undefined,
    { retry: false, refetchInterval: 10_000 },
  );

  // Poll REST /api/system/status for raw process metrics
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/system/status", {
          credentials: "include",
        });
        if (res.ok) {
          setLiveStatus(await res.json());
          setLastRefresh(Date.now());
        }
      } catch {
        /* ignore */
      }
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 10_000);
    return () => clearInterval(interval);
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────

  const ds = liveStats?.deployStats;
  const memPressure =
    systemInfo?.memory?.heapPressure ?? liveStatus?.memory?.heapPressure ?? 0;
  const uptime = systemInfo?.uptime ?? liveStatus?.uptime ?? 0;
  const trafficLevel = liveStats?.traffic?.level ?? "normal";
  const eventLoopLag = liveStats?.traffic?.eventLoopLagMs ?? 0;
  const heapPercent = liveStats?.traffic?.heapPercent ?? 0;
  const dbLatency = liveStats?.database?.latency ?? 0;
  const dbStatus = liveStats?.database?.status ?? liveStatus?.database?.status ?? "unknown";
  const clientErrors5m = liveStats?.clientErrors?.last5min ?? 0;
  const clientErrorRate = liveStats?.clientErrors?.ratePerMin ?? 0;
  const sentinelStatus = liveStats?.sentinel?.status ?? "unknown";
  const sentinelActiveRepairs = liveStats?.sentinel?.activeRepairs ?? 0;
  const sentinelCycleCount = (liveStats?.sentinel as any)?.cycleCount ?? 0;
  const sentinelLastRepair = (liveStats?.sentinel as any)?.lastRepairAttemptAt ?? null;
  const sentinelLastHeartbeat = liveStats?.sentinel?.lastHeartbeat ?? null;
  const disabledFeatures: string[] = liveStats?.disabledFeatures ?? [];
  const circuitBreakers = liveStats?.circuitBreakers;
  const breakersOpen =
    circuitBreakers?.query === "open" || circuitBreakers?.general === "open";
  const smsBreaker = (circuitBreakers as any)?.sms ?? "closed";
  const latestDeploy = systemInfo?.latestDeploy ?? null;
  const liveMemUsed = (liveStats?.memory as any)?.used ?? null;
  const liveMemLimit = (liveStats?.memory as any)?.limit ?? null;
  const liveMemPercent = (liveStats?.memory as any)?.percent ?? null;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Rocket className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Deployments & System
            </h1>
            <p className="text-muted-foreground text-sm">
              Live metrics, deployment analytics, and infrastructure health
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground">
              Updated {timeAgo(new Date(lastRefresh))}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
              <Activity className="w-3 h-3 text-success animate-pulse" />
              Live
            </div>
          </div>
        </div>

        {/* ── Deploy Analytics Row ─────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Success Rate */}
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${(ds?.successRate ?? 0) >= 90 ? "bg-success/10" : (ds?.successRate ?? 0) >= 70 ? "bg-warning/10" : "bg-destructive/10"}`}
                >
                  <TrendingUp
                    className={`w-4 h-4 ${(ds?.successRate ?? 0) >= 90 ? "text-success" : (ds?.successRate ?? 0) >= 70 ? "text-warning" : "text-destructive"}`}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Success Rate
                  </p>
                  <p className="text-lg font-bold">{ds?.successRate ?? 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Avg Duration */}
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center">
                  <Timer className="w-4 h-4 text-info" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Avg Duration
                  </p>
                  <p className="text-lg font-bold">
                    {formatDuration(ds?.avgDurationMs)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Last 24h */}
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Rocket className="w-4 h-4 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Last 24h
                  </p>
                  <p className="text-lg font-bold">{ds?.last24h ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {ds?.last7d ?? 0} this week
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Streak */}
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${(ds?.streak ?? 0) >= 5 ? "bg-primary/10" : "bg-warning/10"}`}
                >
                  <Flame
                    className={`w-4 h-4 ${(ds?.streak ?? 0) >= 5 ? "text-primary" : "text-warning"}`}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Streak
                  </p>
                  <p className="text-lg font-bold">
                    {ds?.streak ?? 0} verified
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fastest / Slowest */}
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Award className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Best / Worst
                  </p>
                  <p className="text-sm font-bold">
                    {formatDuration(ds?.fastestMs)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    / {formatDuration(ds?.slowestMs)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total */}
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <GitBranch className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    All-Time
                  </p>
                  <p className="text-lg font-bold">{ds?.total ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {ds?.failed ?? 0} failed &middot; {ds?.rolledBack ?? 0}{" "}
                    rolled back
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Live Health Row ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Traffic Level */}
          <Card className="border-border bg-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Wifi
                  className={`w-4 h-4 ${trafficLevel === "normal" ? "text-success" : trafficLevel === "high" ? "text-warning" : "text-destructive"}`}
                />
                <div>
                  <p className="text-[10px] text-muted-foreground">Traffic</p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${trafficLevel === "normal" ? "text-success border-success/30" : trafficLevel === "high" ? "text-warning border-warning/30" : "text-destructive border-destructive/30"}`}
                  >
                    {trafficLevel}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Event Loop */}
          <Card className="border-border bg-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Gauge
                  className={`w-4 h-4 ${eventLoopLag < 50 ? "text-success" : eventLoopLag < 200 ? "text-warning" : "text-destructive"}`}
                />
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    Event Loop
                  </p>
                  <p className="text-sm font-bold font-mono">
                    {eventLoopLag}ms
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DB Latency */}
          <Card className="border-border bg-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Database
                  className={`w-4 h-4 ${dbLatency < 50 ? "text-success" : dbLatency < 200 ? "text-warning" : "text-destructive"}`}
                />
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    DB Latency
                  </p>
                  <p className="text-sm font-bold font-mono">{dbLatency}ms</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Errors */}
          <Card className="border-border bg-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Bug
                  className={`w-4 h-4 ${clientErrors5m === 0 ? "text-success" : clientErrors5m < 10 ? "text-warning" : "text-destructive"}`}
                />
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    Client Errors
                  </p>
                  <p className="text-sm font-bold">
                    {clientErrors5m}{" "}
                    <span className="text-[10px] text-muted-foreground font-normal">
                      ({clientErrorRate}/min)
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sentinel */}
          <Card className="border-border bg-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Shield
                  className={`w-4 h-4 ${sentinelStatus === "healthy" || sentinelStatus === "ok" ? "text-success" : sentinelStatus === "stale" ? "text-warning" : "text-destructive"}`}
                />
                <div>
                  <p className="text-[10px] text-muted-foreground">Sentinel</p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${sentinelStatus === "healthy" || sentinelStatus === "ok" ? "text-success border-success/30" : sentinelStatus === "stale" ? "text-warning border-warning/30" : "text-destructive border-destructive/30"}`}
                  >
                    {sentinelStatus}
                  </Badge>
                  {sentinelActiveRepairs > 0 && (
                    <span className="text-[10px] text-warning ml-1">{sentinelActiveRepairs} repairs</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Circuit Breakers */}
          <Card className="border-border bg-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Zap
                  className={`w-4 h-4 ${!breakersOpen && smsBreaker !== "open" && disabledFeatures.length === 0 ? "text-success" : "text-destructive"}`}
                />
                <div>
                  <p className="text-[10px] text-muted-foreground">Breakers</p>
                  {breakersOpen || smsBreaker === "open" || disabledFeatures.length > 0 ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 text-destructive border-destructive/30"
                    >
                      {disabledFeatures.length || (breakersOpen ? 1 : 0) + (smsBreaker === "open" ? 1 : 0)} tripped
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 text-success border-success/30"
                    >
                      all clear
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Sentinel & Breakers Detail + Latest Deploy ────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sentinel Detail */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Sentinel Detail
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sentinelStatus === "healthy" || sentinelStatus === "ok" ? "text-success border-success/30" : sentinelStatus === "stale" ? "text-warning border-warning/30" : "text-destructive border-destructive/30"}`}>
                  {sentinelStatus}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Active Repairs</span>
                <span className={`font-bold text-xs ${sentinelActiveRepairs > 0 ? "text-warning" : "text-success"}`}>{sentinelActiveRepairs}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cycle Count</span>
                <span className="font-mono text-xs">{sentinelCycleCount || "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Heartbeat</span>
                <span className="text-xs">{sentinelLastHeartbeat ? timeAgo(sentinelLastHeartbeat) : "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Repair</span>
                <span className="text-xs">{sentinelLastRepair ? timeAgo(sentinelLastRepair) : "none"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Circuit Breakers Detail */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-warning" /> Circuit Breakers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Query Breaker</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${circuitBreakers?.query === "open" ? "text-destructive border-destructive/30" : "text-success border-success/30"}`}>
                  {circuitBreakers?.query ?? "closed"}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">General Breaker</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${circuitBreakers?.general === "open" ? "text-destructive border-destructive/30" : "text-success border-success/30"}`}>
                  {circuitBreakers?.general ?? "closed"}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">SMS Breaker</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${smsBreaker === "open" ? "text-destructive border-destructive/30" : "text-success border-success/30"}`}>
                  {smsBreaker}
                </Badge>
              </div>
              {disabledFeatures.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <p className="text-[10px] text-muted-foreground mb-1">Disabled Features</p>
                  <div className="flex flex-wrap gap-1">
                    {disabledFeatures.map((f: string) => (
                      <Badge key={f} variant="outline" className="text-[10px] px-1.5 py-0 text-destructive border-destructive/30">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {disabledFeatures.length === 0 && (
                <p className="text-[10px] text-muted-foreground pt-1">No features disabled</p>
              )}
            </CardContent>
          </Card>

          {/* Latest Deploy */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Rocket className="w-4 h-4 text-success" /> Latest Deploy
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {latestDeploy ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Version</span>
                    <span className="font-mono text-xs">{latestDeploy.version?.slice(0, 16) ?? "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${latestDeploy.status === "verified" ? "text-success border-success/30" : latestDeploy.status === "failed" ? "text-destructive border-destructive/30" : "text-warning border-warning/30"}`}>
                      {latestDeploy.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deployed By</span>
                    <span className="text-xs">{latestDeploy.deployedBy || "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-mono text-xs">{formatDuration(latestDeploy.durationMs)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">When</span>
                    <span className="text-xs">{latestDeploy.createdAt ? timeAgo(latestDeploy.createdAt) : "—"}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No deployments recorded</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── System Status Grid ─────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Version & Uptime */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-primary" /> Version
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Build</span>
                <span className="font-mono text-xs">
                  {BUILD_VERSION === "dev"
                    ? "Development"
                    : BUILD_VERSION.slice(0, 12)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Uptime</span>
                <span className="font-bold text-xs">
                  {formatUptime(uptime)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Started</span>
                <span className="text-xs">
                  {liveStatus?.startedAt
                    ? timeAgo(liveStatus.startedAt)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Environment</span>
                <span className="font-mono text-xs">
                  {liveStatus?.environment ?? "—"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Server */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Server className="w-4 h-4 text-info" /> Server
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Node.js</span>
                <span className="font-mono text-xs">
                  {liveStatus?.nodeVersion ?? "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">PID</span>
                <span className="font-mono text-xs">
                  {liveStatus?.pid ?? "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">CPU (user)</span>
                <span className="font-mono text-xs">
                  {liveStatus?.cpu?.user ?? "—"}ms
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">CPU (system)</span>
                <span className="font-mono text-xs">
                  {liveStatus?.cpu?.system ?? "—"}ms
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Connections</span>
                <span className="font-mono text-xs">
                  {liveStats?.traffic?.connections ?? "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Heap Usage</span>
                <span className={`font-mono text-xs ${heapPercent > 85 ? "text-destructive" : heapPercent > 70 ? "text-warning" : ""}`}>
                  {heapPercent > 0 ? `${heapPercent}%` : "—"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Memory */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Cpu
                  className={`w-4 h-4 ${memPressure > 85 ? "text-destructive" : memPressure > 70 ? "text-warning" : "text-success"}`}
                />{" "}
                Memory
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Heap</span>
                <span className="font-bold text-xs">
                  {systemInfo?.memory?.heapUsed ?? "—"}MB /{" "}
                  {systemInfo?.memory?.heapTotal ?? "—"}MB
                </span>
              </div>
              <Progress value={memPressure} className="h-1.5" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pressure</span>
                <span
                  className={`font-bold text-xs ${memPressure > 85 ? "text-destructive" : memPressure > 70 ? "text-warning" : "text-success"}`}
                >
                  {memPressure}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">RSS</span>
                <span className="font-mono text-xs">
                  {systemInfo?.memory?.rss ?? liveStatus?.memory?.rss ?? "—"}MB
                </span>
              </div>
              {liveMemUsed !== null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Process Mem</span>
                  <span className="font-mono text-xs">
                    {liveMemUsed}MB / {liveMemLimit ?? "—"}MB ({liveMemPercent ?? 0}%)
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Database */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Database className="w-4 h-4 text-accent-foreground" /> Database
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant="outline"
                  className={
                    dbStatus === "connected" || dbStatus === "ok"
                      ? "text-success border-success/30"
                      : "text-destructive border-destructive/30"
                  }
                >
                  {dbStatus}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Latency</span>
                <span className={`font-mono text-xs ${dbLatency > 200 ? "text-destructive" : dbLatency > 50 ? "text-warning" : "text-success"}`}>
                  {dbLatency}ms
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Tenants
                </span>
                <span className="font-bold">
                  {systemInfo?.counts?.tenants ?? "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" /> Users
                </span>
                <span className="font-bold">
                  {systemInfo?.counts?.users ?? "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Target className="w-3 h-3" /> Leads
                </span>
                <span className="font-bold">
                  {systemInfo?.counts?.leads ?? "—"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Deploy History ──────────────────────────────────────── */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Rocket className="w-4 h-4 text-primary" /> Deployment
                History
              </CardTitle>
              {ds?.lastFailureAt && (
                <span className="text-[10px] text-muted-foreground">
                  Last failure: {timeAgo(ds.lastFailureAt)}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {deploysLoading ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Loading...
              </div>
            ) : deploys.length === 0 ? (
              <div className="p-8 text-center">
                <Rocket className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No deployments recorded yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Run{" "}
                  <code className="bg-muted px-1 rounded">
                    pnpm deploy:live
                  </code>{" "}
                  to deploy.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs">
                      Version
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs">
                      Status
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs">
                      Branch
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs">
                      Deployed By
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs">
                      Duration
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs">
                      Started
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs">
                      Completed
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs">
                      Changelog
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deploys.map((d: any) => {
                    const style =
                      STATUS_STYLES[d.status] || STATUS_STYLES.started;
                    const Icon = style.icon;
                    return (
                      <TableRow key={d.id} className="border-border">
                        <TableCell>
                          <span className="font-mono text-xs">
                            {d.version?.slice(0, 12)}
                          </span>
                          {d.gitHash && (
                            <span className="text-muted-foreground text-xs ml-1">
                              ({d.gitHash.slice(0, 7)})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${style.color}`}
                          >
                            <Icon className="w-3 h-3 mr-1" />
                            {d.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {d.gitBranch || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs">
                            {d.deployedBy || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono">
                            {formatDuration(d.durationMs)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {d.createdAt ? timeAgo(d.createdAt) : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {d.completedAt ? timeAgo(d.completedAt) : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {d.changelog ? (
                            <span className="text-xs text-muted-foreground max-w-[200px] truncate block" title={d.changelog}>
                              {d.changelog.length > 50 ? d.changelog.slice(0, 50) + "…" : d.changelog}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
