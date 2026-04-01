import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Zap,
  Users,
  ArrowUpDown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

export default function N8nAnalytics() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedTenantId, setSelectedTenantId] = useState<number | undefined>();

  useEffect(() => {
    if (user && user.role !== "admin") navigate("/dashboard");
  }, [user]);

  const metricsQuery = trpc.n8nAdmin.getExecutionMetrics.useQuery(
    { tenantId: selectedTenantId },
    { refetchInterval: 30_000 },
  );

  const comparisonQuery = trpc.n8nAdmin.getComparison.useQuery(
    { tenantId: selectedTenantId ?? 0 },
    { enabled: !!selectedTenantId, refetchInterval: 60_000 },
  );

  const roiQuery = trpc.n8nAdmin.getWorkflowRoi.useQuery(
    { tenantId: selectedTenantId ?? 0 },
    { enabled: !!selectedTenantId, refetchInterval: 60_000 },
  );

  const metrics = metricsQuery.data as any;
  const comparison = comparisonQuery.data;
  const roi = roiQuery.data;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-teal-600" />
              n8n Analytics
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Workflow performance, ROI attribution, and engine comparison
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/n8n")}>
            Back to n8n Dashboard
          </Button>
        </div>

        {/* Platform-wide Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Executions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.totalExecutions ?? 0}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {metrics?.totalExecutions > 0
                  ? `${Math.round((metrics.successCount / metrics.totalExecutions) * 100)}%`
                  : "—"}
              </div>
              <p className="text-xs text-muted-foreground">{metrics?.successCount ?? 0} succeeded</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{metrics?.failedCount ?? 0}</div>
              <p className="text-xs text-muted-foreground">Require attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">TCPA Blocked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{(metrics as any)?.tcpaBlockedCount ?? 0}</div>
              <p className="text-xs text-muted-foreground">Compliance enforced</p>
            </CardContent>
          </Card>
        </div>

        {/* Per-Workflow Breakdown */}
        {metrics?.byWorkflow && metrics.byWorkflow.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Per-Workflow Performance</CardTitle>
              <CardDescription>Execution stats by individual workflow</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2 font-medium">Workflow</th>
                      <th className="text-right px-4 py-2 font-medium">Total</th>
                      <th className="text-right px-4 py-2 font-medium">Success</th>
                      <th className="text-right px-4 py-2 font-medium">Failed</th>
                      <th className="text-right px-4 py-2 font-medium">Success Rate</th>
                      <th className="text-right px-4 py-2 font-medium">Avg Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.byWorkflow.map((wf: any) => (
                      <tr key={wf.workflowKey} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">
                          {wf.workflowKey.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </td>
                        <td className="px-4 py-2 text-right">{wf.total}</td>
                        <td className="px-4 py-2 text-right text-green-600">{wf.success}</td>
                        <td className="px-4 py-2 text-right text-red-600">{wf.failed}</td>
                        <td className="px-4 py-2 text-right">
                          <Badge variant="outline" className={`text-xs ${
                            wf.total > 0 && (wf.success / wf.total) > 0.9 ? "text-green-600" :
                            wf.total > 0 && (wf.success / wf.total) > 0.7 ? "text-amber-600" :
                            "text-red-600"
                          }`}>
                            {wf.total > 0 ? `${Math.round((wf.success / wf.total) * 100)}%` : "—"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {wf.avgDurationMs ? `${Math.round(wf.avgDurationMs)}ms` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* n8n vs Built-in Comparison */}
        {comparison && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4" />
                n8n vs Built-in Engine Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-1">
                    <Zap className="w-4 h-4 text-teal-600" /> n8n Engine
                  </h4>
                  <div className="text-2xl font-bold">{comparison.n8n.total} executions</div>
                  <p className="text-sm text-muted-foreground">
                    {comparison.n8n.success} success, {comparison.n8n.failed} failed
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-1">
                    <Zap className="w-4 h-4 text-blue-600" /> Built-in Engine
                  </h4>
                  <div className="text-2xl font-bold">{comparison.builtIn.total} executions</div>
                  <p className="text-sm text-muted-foreground">
                    {comparison.builtIn.success} success, {comparison.builtIn.failed} failed
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ROI Attribution */}
        {roi && roi.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                Revenue Attribution by Workflow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2 font-medium">Workflow</th>
                      <th className="text-right px-4 py-2 font-medium">Leads Contacted</th>
                      <th className="text-right px-4 py-2 font-medium">Recovered</th>
                      <th className="text-right px-4 py-2 font-medium">Conversion</th>
                      <th className="text-right px-4 py-2 font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roi.map((r: any) => (
                      <tr key={r.workflowKey} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">
                          {r.workflowKey.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </td>
                        <td className="px-4 py-2 text-right">{r.leadsContacted}</td>
                        <td className="px-4 py-2 text-right text-green-600">{r.leadsRecovered}</td>
                        <td className="px-4 py-2 text-right">
                          {r.conversionRate > 0 ? `${Math.round(r.conversionRate * 100)}%` : "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          ${(r.realizedRevenue / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
