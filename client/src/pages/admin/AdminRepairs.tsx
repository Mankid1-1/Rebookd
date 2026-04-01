import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  Bot, CheckCircle, AlertTriangle, XCircle, Clock, RotateCcw, ArrowUpCircle, Shield,
  Activity, BarChart2, Monitor, Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Bot; label: string }> = {
  detected: { color: "bg-info/10 text-info", icon: Clock, label: "Detected" },
  diagnosing: { color: "bg-accent/10 text-accent-foreground", icon: Bot, label: "Diagnosing" },
  patching: { color: "bg-warning/10 text-warning", icon: Bot, label: "Patching" },
  testing: { color: "bg-warning/10 text-warning", icon: RotateCcw, label: "Testing" },
  verifying: { color: "bg-primary/10 text-primary", icon: Shield, label: "Verifying" },
  deployed: { color: "bg-success/10 text-success", icon: CheckCircle, label: "Deployed" },
  failed: { color: "bg-destructive/10 text-destructive", icon: XCircle, label: "Failed" },
  escalated: { color: "bg-warning/10 text-warning", icon: AlertTriangle, label: "Escalated" },
};

const SEVERITY_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: "bg-destructive/20 text-destructive border-destructive/30", label: "Critical" },
  high: { color: "bg-warning/20 text-warning border-warning/30", label: "High" },
  medium: { color: "bg-warning/20 text-warning border-warning/30", label: "Medium" },
  low: { color: "bg-muted text-muted-foreground border-border", label: "Low" },
};

const CATEGORY_CONFIG: Record<string, { color: string; label: string }> = {
  runtime: { color: "bg-destructive/10 text-destructive", label: "Runtime" },
  rendering: { color: "bg-warning/10 text-warning", label: "Rendering" },
  graphical: { color: "bg-accent/10 text-accent-foreground", label: "Graphical" },
  performance: { color: "bg-warning/10 text-warning", label: "Performance" },
  network: { color: "bg-info/10 text-info", label: "Network" },
};

// Phase timeline configuration
const PHASES = [
  { key: "detectedAt", label: "Detected" },
  { key: "diagnosisStartedAt", label: "Diagnosing" },
  { key: "patchStartedAt", label: "Patching" },
  { key: "testStartedAt", label: "Testing" },
  { key: "verifyStartedAt", label: "Verifying" },
  { key: "completedAt", label: "Completed" },
] as const;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function PhaseTimeline({ job }: { job: any }) {
  const timestamps = PHASES.map(p => ({
    label: p.label,
    ts: job[p.key] ? new Date(job[p.key]) : null,
  }));

  return (
    <div>
      <p className="text-muted-foreground text-sm mb-3">Repair Timeline</p>
      <div className="flex items-start gap-0">
        {timestamps.map((phase, i) => {
          const reached = phase.ts !== null;
          const prev = i > 0 ? timestamps[i - 1].ts : null;
          const duration = reached && prev ? phase.ts!.getTime() - prev.getTime() : null;

          return (
            <div key={phase.label} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-3 h-3 rounded-full border-2 transition-colors ${
                  reached
                    ? "bg-success border-success"
                    : "bg-transparent border-muted-foreground/30"
                }`} />
                <p className="text-[10px] text-center mt-1 leading-tight text-muted-foreground whitespace-nowrap">
                  {phase.label}
                </p>
                {reached && (
                  <p className="text-[9px] text-center text-muted-foreground/60 whitespace-nowrap">
                    {phase.ts!.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
                {duration !== null && (
                  <p className="text-[9px] text-success/70 whitespace-nowrap">+{formatDuration(duration)}</p>
                )}
              </div>
              {i < timestamps.length - 1 && (
                <div className={`flex-1 h-px mx-1 mt-[-16px] ${
                  reached && timestamps[i + 1].ts ? "bg-success/50" : "bg-muted-foreground/20"
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminRepairs() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/dashboard");
  }, [user, setLocation]);

  const { data: listData, isLoading, refetch } = trpc.admin.repairs.list.useQuery(
    statusFilter === "all" ? {} : { status: statusFilter as any },
    { retry: false, refetchInterval: 15000 },
  );

  const { data: stats } = trpc.admin.repairs.stats.useQuery(undefined, {
    retry: false, refetchInterval: 30000,
  });

  const { data: graphicalProfile } = trpc.admin.repairs.graphicalProfile.useQuery(undefined, {
    retry: false, refetchInterval: 30000,
  });

  const { data: sentinelHealthData } = trpc.admin.repairs.sentinelHealth.useQuery(undefined, {
    retry: false, refetchInterval: 30000,
  });

  const { data: selectedJob } = trpc.admin.repairs.getById.useQuery(
    { id: selectedJobId! },
    { enabled: selectedJobId !== null, retry: false },
  );

  const retryMutation = trpc.admin.repairs.retry.useMutation({
    onSuccess: () => {
      toast.success("Repair job re-queued for retry");
      refetch();
    },
  });

  const escalateMutation = trpc.admin.repairs.escalate.useMutation({
    onSuccess: () => {
      toast.info("Repair job escalated for manual review");
      refetch();
    },
  });

  const repairs = listData?.repairs ?? [];
  const repairStats = stats?.repairStats ?? {};

  const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
  const now = Date.now();
  const activeJobs = repairs.filter((j: any) =>
    ["detected", "diagnosing", "patching", "testing", "verifying"].includes(j.status)
  );
  const activeCount = (repairStats.detected ?? 0) + (repairStats.diagnosing ?? 0) +
    (repairStats.patching ?? 0) + (repairStats.testing ?? 0) + (repairStats.verifying ?? 0);
  const stuckCount = repairs.filter((j: any) =>
    j.status === "detected" && j.createdAt && (now - new Date(j.createdAt).getTime()) > STUCK_THRESHOLD_MS
  ).length;
  const deployedCount = repairStats.deployed ?? 0;
  const failedCount = (repairStats.failed ?? 0) + (repairStats.escalated ?? 0);

  // Graphical-only escalations (no code patch)
  const graphicalEscalations = (graphicalProfile?.recentEscalations ?? []);
  const graphicalByPage = graphicalProfile?.byPage ?? [];
  const graphicalByCategory = graphicalProfile?.byCategory ?? [];
  const maxPageCount = graphicalByPage[0]?.count ?? 1;

  // Sentinel health
  const sentinel = sentinelHealthData?.sentinel;
  const disabledFeatures: string[] = sentinelHealthData?.disabledFeatures ?? [];
  const sentinelStatus = sentinel?.status ?? "unknown";
  const sentinelDotColor =
    sentinelStatus === "healthy" ? "bg-success" :
    sentinelStatus === "stale" ? "bg-warning" : "bg-destructive";

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-success" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Autopilot Repairs
              </h1>
              <p className="text-muted-foreground text-sm">
                Automated self-healing engine status and history
              </p>
            </div>
          </div>

          {/* Sentinel Health Chip */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm">
            <div className={`w-2 h-2 rounded-full ${sentinelDotColor} ${sentinelStatus === "healthy" ? "animate-pulse" : ""}`} />
            <span className="text-muted-foreground">Sentinel:</span>
            <span className="font-medium capitalize">{sentinelStatus}</span>
            {sentinel?.lastHeartbeat && (
              <span className="text-xs text-muted-foreground ml-1">
                · {new Date(sentinel.lastHeartbeat).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {sentinel?.cycleCount !== undefined && (
              <span className="text-xs text-muted-foreground">
                · cycle #{sentinel.cycleCount}
              </span>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-info" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Repairs</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{activeCount}</p>
                    {stuckCount > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs px-1.5">
                              {stuckCount} stuck
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{stuckCount} job(s) in "detected" state for over 10 minutes</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Deployed Fixes</p>
                  <p className="text-2xl font-bold">{deployedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Failed / Escalated</p>
                  <p className="text-2xl font-bold">{failedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Graphical Issues (24h)</p>
                  <p className="text-2xl font-bold">{graphicalEscalations.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Circuit Breaker Card */}
          <Card className={`border-border bg-card ${disabledFeatures.length > 0 ? "border-destructive/30" : ""}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  disabledFeatures.length > 0 ? "bg-destructive/10" : "bg-success/10"
                }`}>
                  <Shield className={`w-5 h-5 ${disabledFeatures.length > 0 ? "text-destructive" : "text-success"}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Circuit Breakers</p>
                  <p className={`text-2xl font-bold ${disabledFeatures.length > 0 ? "text-destructive" : ""}`}>
                    {disabledFeatures.length}
                  </p>
                  {disabledFeatures.length > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-xs text-destructive/80 truncate cursor-help">
                            {disabledFeatures.join(", ")}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Disabled features: {disabledFeatures.join(", ")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="repairs">
          <TabsList>
            <TabsTrigger value="repairs" className="gap-1.5">
              <Bot className="w-3.5 h-3.5" /> Code Repairs
            </TabsTrigger>
            <TabsTrigger value="graphical" className="gap-1.5">
              <Monitor className="w-3.5 h-3.5" /> Graphical Issues
            </TabsTrigger>
          </TabsList>

          {/* ── Code Repairs Tab ── */}
          <TabsContent value="repairs" className="mt-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Repair Jobs</CardTitle>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">Loading repair jobs...</p>
                ) : repairs.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">
                    No repair jobs found. The autopilot is standing by.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>
                          <HelpTooltip content="Automated fix attempts generated by the Sentinel monitoring engine" variant="info">Status</HelpTooltip>
                        </TableHead>
                        <TableHead>Error Type</TableHead>
                        <TableHead>
                          <HelpTooltip content="Error severity as classified by the Sentinel at detection time" variant="info">Severity</HelpTooltip>
                        </TableHead>
                        <TableHead>Affected File</TableHead>
                        <TableHead>
                          <HelpTooltip content="Prevents repeated repair attempts on issues that can't be auto-fixed. Trips after 3 failures." variant="info">Attempts</HelpTooltip>
                        </TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repairs.map((job: any) => {
                        const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.detected;
                        const Icon = cfg.icon;
                        const sevCfg = job.errorSeverity ? SEVERITY_CONFIG[job.errorSeverity] : null;
                        return (
                          <TableRow
                            key={job.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedJobId(job.id)}
                          >
                            <TableCell className="font-mono text-xs">#{job.id}</TableCell>
                            <TableCell>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className={cfg.color}>
                                      <Icon className="w-3 h-3 mr-1" />
                                      {cfg.label}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Automated fix attempt generated by the Sentinel monitoring engine</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="capitalize">{job.errorType}</TableCell>
                            <TableCell>
                              {sevCfg ? (
                                <Badge variant="outline" className={`text-xs ${sevCfg.color}`}>
                                  {sevCfg.label}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs max-w-[200px] truncate">
                              {job.affectedFile ?? "—"}
                            </TableCell>
                            <TableCell>{job.attemptCount}/{job.maxAttempts}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {job.createdAt ? new Date(job.createdAt).toLocaleString() : "—"}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1">
                                {(job.status === "failed" || job.status === "escalated") && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs"
                                          onClick={() => retryMutation.mutate({ id: job.id })}
                                          disabled={retryMutation.isPending}
                                        >
                                          <RotateCcw className="w-3 h-3 mr-1" />
                                          Retry
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>Re-attempts the automated repair for this error</p></TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                {job.status === "failed" && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs"
                                          onClick={() => escalateMutation.mutate({ id: job.id })}
                                          disabled={escalateMutation.isPending}
                                        >
                                          <ArrowUpCircle className="w-3 h-3 mr-1" />
                                          Escalate
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>Manually marks this error as resolved without an automated fix</p></TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Graphical Issues Tab ── */}
          <TabsContent value="graphical" className="mt-4 space-y-4">
            {/* Page Hotspots + Category Breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-accent-foreground" />
                    Page Hotspots (last 24h)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {graphicalByPage.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No graphical issues detected</p>
                  ) : graphicalByPage.map((item) => (
                    <div key={item.page} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-mono truncate max-w-[200px]">{item.page}</span>
                        <span className="text-muted-foreground ml-2">{item.count}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="bg-accent h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (item.count / maxPageCount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-warning" />
                    Error Category Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {graphicalByCategory.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No data yet</p>
                  ) : graphicalByCategory.map((item) => {
                    const catCfg = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.runtime;
                    return (
                      <div key={item.category} className="flex items-center justify-between">
                        <Badge variant="outline" className={`text-xs ${catCfg.color}`}>
                          {catCfg.label}
                        </Badge>
                        <span className="text-sm font-medium">{item.count}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Graphical Escalations Table */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-accent-foreground" />
                  Graphical Escalations
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    — no code patch applied, admin review needed
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {graphicalEscalations.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">
                    No graphical escalations in the last 24 hours. UI looks clean.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Error Message</TableHead>
                        <TableHead>Page / File</TableHead>
                        <TableHead>Detected</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {graphicalEscalations.map((job: any) => {
                        const page = job.affectedFile || "—";
                        const msg = (job.errorMessage || "").replace(/^\[CLIENT\]\s*/, "").slice(0, 100);
                        return (
                          <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedJobId(job.id)}>
                            <TableCell className="font-mono text-xs">#{job.id}</TableCell>
                            <TableCell className="text-xs max-w-[340px] truncate">{msg || "—"}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground max-w-[180px] truncate">{page}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {job.createdAt ? new Date(job.createdAt).toLocaleString() : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Detail Dialog (shared between both tabs) */}
        <Dialog open={selectedJobId !== null} onOpenChange={() => setSelectedJobId(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Repair Job #{selectedJob?.id}</DialogTitle>
            </DialogHeader>
            {selectedJob && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant="outline" className={STATUS_CONFIG[selectedJob.status]?.color}>
                      {STATUS_CONFIG[selectedJob.status]?.label ?? selectedJob.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Error Type</p>
                    <p className="capitalize">{selectedJob.errorType}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Branch</p>
                    <p className="font-mono text-xs">{selectedJob.branchName ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Attempts</p>
                    <p>{selectedJob.attemptCount}/{selectedJob.maxAttempts}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Affected File</p>
                    <p className="font-mono text-xs">{selectedJob.affectedFile ?? "—"}</p>
                  </div>
                </div>

                {/* Phase Timeline */}
                <div className="border border-border rounded-lg p-4 bg-muted/20">
                  <PhaseTimeline job={selectedJob} />
                </div>

                {selectedJob.errorMessage && (
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">Error Message</p>
                    <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto max-h-32">
                      {selectedJob.errorMessage}
                    </pre>
                  </div>
                )}

                {selectedJob.claudeOutput && (
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">Claude Output</p>
                    <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto max-h-48">
                      {selectedJob.claudeOutput}
                    </pre>
                  </div>
                )}

                {selectedJob.diffPatch && (
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">Diff Patch</p>
                    <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto max-h-48 font-mono">
                      {selectedJob.diffPatch}
                    </pre>
                  </div>
                )}

                {selectedJob.testResults && (
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">Test Results</p>
                    <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto max-h-32">
                      {selectedJob.testResults}
                    </pre>
                  </div>
                )}

                {selectedJob.failureReason && (
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">Failure Reason</p>
                    <pre className={`p-3 rounded text-xs overflow-x-auto ${selectedJob.failureReason.includes("graphical-only") ? "bg-accent/10 text-accent-foreground" : "bg-destructive/10 text-destructive"}`}>
                      {selectedJob.failureReason}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
