import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  XCircle,
  Workflow,
  Zap,
  AlertTriangle,
  Clock,
  Database,
  BarChart3,
  Shield,
  Trash2,
  RotateCcw,
  Play,
  Pause,
  ArrowUpDown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

const CATEGORY_COLORS: Record<string, string> = {
  "Lead Recovery": "bg-blue-500/10 text-blue-600 border-blue-200",
  "Appointment": "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  "Recovery": "bg-amber-500/10 text-amber-600 border-amber-200",
  "Onboarding": "bg-violet-500/10 text-violet-600 border-violet-200",
  "Re-Engagement": "bg-orange-500/10 text-orange-600 border-orange-200",
  "Reviews": "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  "Messaging": "bg-cyan-500/10 text-cyan-600 border-cyan-200",
  "Leads": "bg-indigo-500/10 text-indigo-600 border-indigo-200",
  "Loyalty": "bg-pink-500/10 text-pink-600 border-pink-200",
  "Scheduling": "bg-teal-500/10 text-teal-600 border-teal-200",
  "Engagement": "bg-rose-500/10 text-rose-600 border-rose-200",
  "Revenue": "bg-green-500/10 text-green-600 border-green-200",
};

const STATUS_BADGES: Record<string, { label: string; variant: string; icon: any }> = {
  completed: { label: "Success", variant: "bg-green-500/10 text-green-700", icon: CheckCircle },
  success: { label: "Success", variant: "bg-green-500/10 text-green-700", icon: CheckCircle },
  failed: { label: "Failed", variant: "bg-red-500/10 text-red-700", icon: XCircle },
  skipped: { label: "Skipped", variant: "bg-gray-500/10 text-gray-700", icon: ArrowUpDown },
  tcpa_blocked: { label: "TCPA Blocked", variant: "bg-amber-500/10 text-amber-700", icon: Shield },
  started: { label: "Running", variant: "bg-blue-500/10 text-blue-700", icon: Activity },
};

export default function N8nStatus() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [execStatusFilter, setExecStatusFilter] = useState<string | undefined>();

  useEffect(() => {
    if (user && user.role !== "admin") navigate("/dashboard");
  }, [user]);

  // ─── Queries ───────────────────────────────────────────────────────────────
  const statusQuery = trpc.n8n.status.useQuery(undefined, { refetchInterval: 30_000 });
  const healthQuery = trpc.n8nAdmin.getHealth.useQuery(undefined, { refetchInterval: 15_000 });
  const workflowsQuery = trpc.n8nAdmin.listWorkflows.useQuery(undefined, { refetchInterval: 60_000 });
  const executionsQuery = trpc.n8nAdmin.getExecutionHistory.useQuery(
    { status: execStatusFilter as any, limit: 30 },
    { refetchInterval: 10_000 },
  );
  const metricsQuery = trpc.n8nAdmin.getExecutionMetrics.useQuery(
    {},
    { refetchInterval: 30_000 },
  );
  const dlqQuery = trpc.n8nAdmin.getDlqEntries.useQuery(
    { status: "pending", limit: 20 },
    { refetchInterval: 15_000 },
  );

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const syncAllMutation = trpc.n8nAdmin.syncAll.useMutation({
    onSuccess: () => workflowsQuery.refetch(),
  });
  const retryDlqMutation = trpc.n8nAdmin.retryDlqEntry.useMutation({
    onSuccess: () => dlqQuery.refetch(),
  });
  const discardDlqMutation = trpc.n8nAdmin.discardDlqEntry.useMutation({
    onSuccess: () => dlqQuery.refetch(),
  });
  const reprocessDlqMutation = trpc.n8nAdmin.reprocessDlq.useMutation({
    onSuccess: () => dlqQuery.refetch(),
  });
  const activateMutation = trpc.n8nAdmin.activateWorkflow.useMutation({
    onSuccess: () => workflowsQuery.refetch(),
  });
  const deactivateMutation = trpc.n8nAdmin.deactivateWorkflow.useMutation({
    onSuccess: () => workflowsQuery.refetch(),
  });

  const status = statusQuery.data;
  const health = healthQuery.data;
  const metrics = metricsQuery.data;

  const circuitState = health?.circuitBreaker?.state ?? "CLOSED";
  const dlqPending = health?.dlqPendingCount ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Workflow className="w-6 h-6 text-teal-600" />
              n8n Workflow Engine
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage, monitor, and optimize n8n workflow automations
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status?.enabled && status?.baseUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={status.baseUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-1" /> Open n8n
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                statusQuery.refetch();
                healthQuery.refetch();
                metricsQuery.refetch();
              }}
            >
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="executions">Executions</TabsTrigger>
            <TabsTrigger value="dlq">
              DLQ {dlqPending > 0 && <Badge variant="destructive" className="ml-1 text-xs">{dlqPending}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
          </TabsList>

          {/* ─── Overview Tab ──────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Connection Status */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Connection</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {status?.healthy ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="text-lg font-semibold">
                      {!status?.enabled ? "Disabled" : status?.healthy ? "Connected" : "Offline"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Circuit Breaker */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Circuit Breaker</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      circuitState === "CLOSED" ? "bg-green-500" :
                      circuitState === "HALF_OPEN" ? "bg-yellow-500" : "bg-red-500"
                    }`} />
                    <span className="text-lg font-semibold">{circuitState}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Executions Today */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Executions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.totalExecutions ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Last 30 days</p>
                </CardContent>
              </Card>

              {/* Success Rate */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metrics && metrics.totalExecutions > 0
                      ? `${Math.round(((metrics as any).successRate ?? (metrics.successCount / metrics.totalExecutions)) * 100)}%`
                      : "—"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.failedCount ?? 0} failed
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Reference</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>Architecture:</strong> n8n orchestrates workflows, Rebooked enforces TCPA compliance. n8n never sends SMS directly.</p>
                <p><strong>Fallback:</strong> If n8n is unavailable, the built-in automation engine handles all events automatically.</p>
                <p><strong>DLQ:</strong> Failed dispatches are saved to the dead letter queue and retried every 5 minutes.</p>
                <div className="mt-3 p-3 bg-muted rounded-md font-mono text-xs space-y-1">
                  <div>REBOOKED_URL={status?.baseUrl ? `${window.location.origin}` : "..."}</div>
                  <div>N8N_REBOOKED_KEY=your-shared-secret</div>
                  <div>N8N_ADMIN_API_KEY=your-n8n-api-key</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Workflows Tab ─────────────────────────────────────────────── */}
          <TabsContent value="workflows" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {workflowsQuery.data?.length ?? 0} workflows tracked
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncAllMutation.mutate()}
                disabled={syncAllMutation.isPending}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${syncAllMutation.isPending ? "animate-spin" : ""}`} />
                Sync All
              </Button>
            </div>

            <div className="grid gap-2">
              {workflowsQuery.data?.map((wf: any) => (
                <Card key={wf.workflowKey} className="hover:shadow-sm transition-shadow">
                  <CardContent className="flex items-center justify-between py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${wf.n8nActive ? "bg-green-500" : "bg-gray-400"}`} />
                      <div>
                        <div className="font-medium text-sm">{wf.workflowKey.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</div>
                        <div className="text-xs text-muted-foreground">
                          {wf.n8nWorkflowId ? `ID: ${wf.n8nWorkflowId}` : "Not linked to n8n"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${
                        wf.syncStatus === "synced" ? "text-green-600 border-green-300" :
                        wf.syncStatus === "missing_in_n8n" ? "text-amber-600 border-amber-300" :
                        wf.syncStatus === "drift_detected" ? "text-red-600 border-red-300" :
                        "text-gray-600 border-gray-300"
                      }`}>
                        {wf.syncStatus === "synced" ? "Synced" :
                         wf.syncStatus === "missing_in_n8n" ? "Missing in n8n" :
                         wf.syncStatus === "drift_detected" ? "Drift" : wf.syncStatus}
                      </Badge>
                      {wf.n8nWorkflowId && (
                        <>
                          {wf.n8nActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => deactivateMutation.mutate({ n8nWorkflowId: wf.n8nWorkflowId })}
                              disabled={deactivateMutation.isPending}
                            >
                              <Pause className="w-3 h-3 mr-1" /> Deactivate
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => activateMutation.mutate({ n8nWorkflowId: wf.n8nWorkflowId })}
                              disabled={activateMutation.isPending}
                            >
                              <Play className="w-3 h-3 mr-1" /> Activate
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {workflowsQuery.data?.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No workflow sync data. Click "Sync All" to sync with n8n.
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ─── Executions Tab ─────────────────────────────────────────────── */}
          <TabsContent value="executions" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter:</span>
              {["all", "completed", "failed", "tcpa_blocked", "skipped"].map((s) => (
                <Button
                  key={s}
                  variant={execStatusFilter === (s === "all" ? undefined : s) || (!execStatusFilter && s === "all") ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setExecStatusFilter(s === "all" ? undefined : s)}
                >
                  {s === "all" ? "All" : s.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </Button>
              ))}
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-2 font-medium">Workflow</th>
                        <th className="text-left px-4 py-2 font-medium">Event</th>
                        <th className="text-left px-4 py-2 font-medium">Status</th>
                        <th className="text-left px-4 py-2 font-medium">Duration</th>
                        <th className="text-left px-4 py-2 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {executionsQuery.data?.executions?.map((exec: any) => {
                        const statusInfo = STATUS_BADGES[exec.status] ?? STATUS_BADGES.started;
                        const StatusIcon = statusInfo.icon;
                        return (
                          <tr key={exec.id} className="border-b hover:bg-muted/30">
                            <td className="px-4 py-2 font-medium">{exec.workflowKey}</td>
                            <td className="px-4 py-2 text-muted-foreground">{exec.eventType}</td>
                            <td className="px-4 py-2">
                              <Badge variant="outline" className={`text-xs ${statusInfo.variant}`}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusInfo.label}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {exec.durationMs ? `${exec.durationMs}ms` : "—"}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground text-xs">
                              {exec.createdAt ? new Date(exec.createdAt).toLocaleString() : "—"}
                            </td>
                          </tr>
                        );
                      })}
                      {(!executionsQuery.data?.executions || executionsQuery.data.executions.length === 0) && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                            No executions found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground text-right">
              Auto-refreshes every 10 seconds | Total: {executionsQuery.data?.total ?? 0}
            </p>
          </TabsContent>

          {/* ─── DLQ Tab ───────────────────────────────────────────────────── */}
          <TabsContent value="dlq" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Dead Letter Queue</h3>
                <p className="text-sm text-muted-foreground">
                  Events that failed all retry attempts. Reprocessed automatically every 5 minutes.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => reprocessDlqMutation.mutate()}
                disabled={reprocessDlqMutation.isPending}
              >
                <RotateCcw className={`w-4 h-4 mr-1 ${reprocessDlqMutation.isPending ? "animate-spin" : ""}`} />
                Reprocess Now
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-2 font-medium">Event Type</th>
                        <th className="text-left px-4 py-2 font-medium">Tenant</th>
                        <th className="text-left px-4 py-2 font-medium">Error</th>
                        <th className="text-left px-4 py-2 font-medium">Attempts</th>
                        <th className="text-left px-4 py-2 font-medium">Created</th>
                        <th className="text-left px-4 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dlqQuery.data?.entries?.map((entry: any) => (
                        <tr key={entry.id} className="border-b hover:bg-muted/30">
                          <td className="px-4 py-2 font-medium">{entry.eventType}</td>
                          <td className="px-4 py-2 text-muted-foreground">{entry.tenantId}</td>
                          <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate" title={entry.errorMessage}>
                            {entry.errorMessage || "—"}
                          </td>
                          <td className="px-4 py-2">{entry.attempts}/{entry.maxAttempts}</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => retryDlqMutation.mutate({ id: entry.id })}
                                disabled={retryDlqMutation.isPending}
                              >
                                <RotateCcw className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-red-600"
                                onClick={() => discardDlqMutation.mutate({ id: entry.id })}
                                disabled={discardDlqMutation.isPending}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(!dlqQuery.data?.entries || dlqQuery.data.entries.length === 0) && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                            No pending DLQ entries
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Health Tab ─────────────────────────────────────────────────── */}
          <TabsContent value="health" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Circuit Breaker</CardTitle>
                  <CardDescription>Protects against n8n outages</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${
                      circuitState === "CLOSED" ? "bg-green-500" :
                      circuitState === "HALF_OPEN" ? "bg-yellow-500" : "bg-red-500"
                    }`} />
                    <span className="font-semibold">{circuitState}</span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Failure count: {health?.circuitBreaker?.failureCount ?? 0}</p>
                    {health?.circuitBreaker?.openedAt && (
                      <p>Opened at: {new Date(health.circuitBreaker.openedAt).toLocaleString()}</p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    <p>CLOSED: Normal operation — events dispatched to n8n</p>
                    <p>OPEN: n8n unreachable — using built-in engine, events queued in DLQ</p>
                    <p>HALF_OPEN: Probing — one request allowed to test recovery</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">System Status</CardTitle>
                  <CardDescription>Integration health checks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">n8n Health</span>
                    <Badge variant="outline" className={status?.healthy ? "text-green-600" : "text-red-600"}>
                      {status?.healthy ? "Healthy" : "Unhealthy"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Admin API</span>
                    <Badge variant="outline" className={health?.adminApiAccessible ? "text-green-600" : "text-amber-600"}>
                      {health?.adminApiAccessible ? "Connected" : "Not Configured"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">DLQ Pending</span>
                    <Badge variant="outline" className={dlqPending > 0 ? "text-amber-600" : "text-green-600"}>
                      {dlqPending}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Base URL</span>
                    <span className="text-xs text-muted-foreground font-mono">{status?.baseUrl ?? "—"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Event Webhook Mapping */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Event → Webhook Mapping</CardTitle>
                <CardDescription>How Rebooked events map to n8n webhook paths</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-sm font-mono">
                  {health?.eventWebhookMap && Object.entries(health.eventWebhookMap).map(([event, path]) => (
                    <div key={event} className="flex items-center gap-2 py-1">
                      <span className="text-muted-foreground">{event}</span>
                      <span className="text-xs">→</span>
                      <span className="text-teal-600">/webhook/{path as string}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
