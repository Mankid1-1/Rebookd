import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Activity, AlertCircle, CheckCircle, Shield, XCircle } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

export default function AdminSystemHealth() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/dashboard");
  }, [user, setLocation]);

  const { data: errors = [], isLoading: errorsLoading } = trpc.admin.systemHealth.errors.useQuery({ limit: 50 }, { retry: false });
  const { data: webhookLogs = [], isLoading: logsLoading } = trpc.admin.webhookLogs.list.useQuery({ limit: 50 }, { retry: false });

  const errorCount = errors.length;
  const successLogs = webhookLogs.filter((l: any) => l.statusCode >= 200 && l.statusCode < 300).length;
  const failLogs = webhookLogs.filter((l: any) => l.statusCode >= 400).length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>System Health</h1>
            <p className="text-muted-foreground text-sm">Monitor errors and webhook activity</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recent Errors</p>
                  <p className="text-2xl font-bold">{errorCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Webhook Success</p>
                  <p className="text-2xl font-bold">{successLogs}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Webhook Failures</p>
                  <p className="text-2xl font-bold">{failLogs}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Logs */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" /> Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {errorsLoading ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Loading...</div>
            ) : errors.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No errors recorded. System is healthy.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Time</TableHead>
                    <TableHead className="text-muted-foreground">Type</TableHead>
                    <TableHead className="text-muted-foreground">Message</TableHead>
                    <TableHead className="text-muted-foreground">Tenant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.map((err: any) => (
                    <TableRow key={err.id} className="border-border">
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {new Date(err.createdAt).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-xs">{err.type || "error"}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-red-300 line-clamp-1">{err.message}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">#{err.tenantId || "—"}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Webhook Logs */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Webhook Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {logsLoading ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Loading...</div>
            ) : webhookLogs.length === 0 ? (
              <div className="p-8 text-center">
                <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No webhook logs yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs">Time</TableHead>
                    <TableHead className="text-muted-foreground text-xs">URL</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Attempts</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Resolved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhookLogs.map((log: any) => (
                    <TableRow key={log.id} className="border-border">
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px] block">{log.url?.replace("https://", "") || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            log.statusCode >= 200 && log.statusCode < 300
                              ? "text-green-400 border-green-500/30"
                              : log.statusCode
                              ? "text-red-400 border-red-500/30"
                              : "text-muted-foreground border-border"
                          }
                        >
                          {log.statusCode || "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{log.attempts ?? 0}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={log.resolved ? "text-green-400 border-green-500/30" : "text-yellow-400 border-yellow-500/30"}>
                          {log.resolved ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
