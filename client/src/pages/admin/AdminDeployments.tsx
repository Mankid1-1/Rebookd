import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
} from "lucide-react";

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

const STATUS_STYLES: Record<string, { color: string; icon: typeof CheckCircle }> = {
  verified: { color: "text-green-400 border-green-500/30", icon: CheckCircle },
  started: { color: "text-blue-400 border-blue-500/30", icon: Zap },
  uploading: { color: "text-yellow-400 border-yellow-500/30", icon: RefreshCw },
  reloading: { color: "text-yellow-400 border-yellow-500/30", icon: RefreshCw },
  failed: { color: "text-red-400 border-red-500/30", icon: XCircle },
  rolled_back: { color: "text-orange-400 border-orange-500/30", icon: AlertTriangle },
};

export default function AdminDeployments() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [liveStatus, setLiveStatus] = useState<any>(null);

  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/dashboard");
  }, [user, setLocation]);

  // Fetch system info via tRPC
  const { data: systemInfo, isLoading: sysLoading } = trpc.admin.systemInfo.useQuery(undefined, {
    retry: false,
    refetchInterval: 15000,
  });

  // Fetch deploy history
  const { data: deploys = [], isLoading: deploysLoading } = trpc.admin.deployments.list.useQuery(
    { limit: 15 },
    { retry: false, refetchInterval: 30000 },
  );

  // Poll live system status from REST endpoint
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/system/status", { credentials: "include" });
        if (res.ok) setLiveStatus(await res.json());
      } catch { /* ignore */ }
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const memPressure = systemInfo?.memory?.heapPressure ?? liveStatus?.memory?.heapPressure ?? 0;
  const uptime = systemInfo?.uptime ?? liveStatus?.uptime ?? 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00A896]/10 flex items-center justify-center">
            <Rocket className="w-4 h-4 text-[#00A896]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Deployments & System
            </h1>
            <p className="text-muted-foreground text-sm">
              Live update system, server health, and deployment history
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
              <Activity className="w-3 h-3 text-green-400 animate-pulse" />
              Live
            </div>
          </div>
        </div>

        {/* Top stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Current Version */}
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00A896]/10 flex items-center justify-center">
                  <GitBranch className="w-5 h-5 text-[#00A896]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Current Version</p>
                  <p className="text-sm font-bold font-mono truncate">
                    {BUILD_VERSION === "dev" ? "Development" : BUILD_VERSION.slice(0, 12)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Uptime */}
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Uptime</p>
                  <p className="text-sm font-bold">{formatUptime(uptime)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Memory */}
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${memPressure > 85 ? "bg-red-500/10" : memPressure > 70 ? "bg-yellow-500/10" : "bg-green-500/10"}`}>
                  <Cpu className={`w-5 h-5 ${memPressure > 85 ? "text-red-400" : memPressure > 70 ? "text-yellow-400" : "text-green-400"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Memory</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{systemInfo?.memory?.heapUsed ?? "—"}MB</p>
                    <span className="text-xs text-muted-foreground">/ {systemInfo?.memory?.heapTotal ?? "—"}MB</span>
                  </div>
                  <Progress value={memPressure} className="h-1 mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Deploys */}
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Deploys</p>
                  <p className="text-sm font-bold">{deploys.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Server Info */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Server className="w-4 h-4 text-[#00A896]" /> Server
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Node.js</span>
                <span className="font-mono text-xs">{liveStatus?.nodeVersion ?? "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">PID</span>
                <span className="font-mono text-xs">{liveStatus?.pid ?? "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cluster Worker</span>
                <span className="font-mono text-xs">#{liveStatus?.cluster?.workerId ?? "0"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Started</span>
                <span className="text-xs">{liveStatus?.startedAt ? timeAgo(liveStatus.startedAt) : "—"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Database */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" /> Database
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className={liveStatus?.database?.status === "connected" ? "text-green-400 border-green-500/30" : "text-red-400 border-red-500/30"}>
                  {liveStatus?.database?.status ?? "unknown"}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" /> Tenants</span>
                <span className="font-bold">{systemInfo?.counts?.tenants ?? "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Users</span>
                <span className="font-bold">{systemInfo?.counts?.users ?? "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" /> Leads</span>
                <span className="font-bold">{systemInfo?.counts?.leads ?? "—"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Worker */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-yellow-400" /> Worker
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className={
                  liveStatus?.worker?.status === "healthy" ? "text-green-400 border-green-500/30" :
                  liveStatus?.worker?.status === "stale" ? "text-yellow-400 border-yellow-500/30" :
                  "text-red-400 border-red-500/30"
                }>
                  {liveStatus?.worker?.status ?? "unknown"}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Heartbeat</span>
                <span className="text-xs">
                  {liveStatus?.worker?.lastHeartbeat ? timeAgo(liveStatus.worker.lastHeartbeat) : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">External Memory</span>
                <span className="font-mono text-xs">{liveStatus?.memory?.external ?? "—"}MB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">CPU (user)</span>
                <span className="font-mono text-xs">{liveStatus?.cpu?.user ?? "—"}ms</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Deploy History */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Rocket className="w-4 h-4 text-[#00A896]" /> Deployment History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {deploysLoading ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Loading...</div>
            ) : deploys.length === 0 ? (
              <div className="p-8 text-center">
                <Rocket className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No deployments recorded yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Run <code className="bg-muted px-1 rounded">pnpm deploy:live</code> to deploy.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs">Version</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Branch</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Deployed By</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Duration</TableHead>
                    <TableHead className="text-muted-foreground text-xs">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deploys.map((d: any) => {
                    const style = STATUS_STYLES[d.status] || STATUS_STYLES.started;
                    const Icon = style.icon;
                    return (
                      <TableRow key={d.id} className="border-border">
                        <TableCell>
                          <span className="font-mono text-xs">{d.version?.slice(0, 12)}</span>
                          {d.gitHash && (
                            <span className="text-muted-foreground text-xs ml-1">({d.gitHash.slice(0, 7)})</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${style.color}`}>
                            <Icon className="w-3 h-3 mr-1" />
                            {d.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{d.gitBranch || "—"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs">{d.deployedBy || "—"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono">{formatDuration(d.durationMs)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {d.createdAt ? timeAgo(d.createdAt) : "—"}
                          </span>
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
