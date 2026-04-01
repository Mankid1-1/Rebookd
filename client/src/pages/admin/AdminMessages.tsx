import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Bot, MessageSquare, Shield, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

export default function AdminMessages() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState("sms");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/dashboard");
  }, [user, setLocation]);

  const { data: aiLogs = [], isLoading: aiLoading } = trpc.admin.aiLogs.list.useQuery({ limit: 100 }, { retry: false });

  // Filter AI logs
  const filteredLogs = search
    ? aiLogs.filter((l: any) =>
        l.original?.toLowerCase().includes(search.toLowerCase()) ||
        l.rewritten?.toLowerCase().includes(search.toLowerCase())
      )
    : aiLogs;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Message Logs</h1>
            <p className="text-muted-foreground text-sm">Platform-wide message activity</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="sms"><MessageSquare className="w-3.5 h-3.5 mr-1.5" />SMS Messages</TabsTrigger>
              <TabsTrigger value="ai"><Bot className="w-3.5 h-3.5 mr-1.5" />AI Rewrites</TabsTrigger>
            </TabsList>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-9 h-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {/* SMS Tab - placeholder note that this requires cross-tenant query */}
          <TabsContent value="sms">
            <Card className="border-border bg-card">
              <CardContent className="p-8 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium mb-1">Cross-tenant SMS log</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  SMS messages are stored per-tenant. To view all messages across tenants, use your
                  database directly — query the <code className="bg-muted px-1 rounded">messages</code> table
                  joined with <code className="bg-muted px-1 rounded">tenants</code>.
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  Inbound messages (including STOP/UNSUBSCRIBE) are logged automatically via the Twilio webhook at <code className="bg-muted px-1 rounded">/api/twilio/inbound</code>.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Rewrites Tab */}
          <TabsContent value="ai">
            <Card className="border-border bg-card">
              <CardContent className="p-0">
                {aiLoading ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
                ) : filteredLogs.length === 0 ? (
                  <div className="p-12 text-center">
                    <Bot className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No AI rewrite logs yet.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground text-xs">Time</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Tenant</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Tone</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Original</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Rewritten</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log: any) => (
                        <TableRow key={log.id} className="border-border">
                          <TableCell><span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span></TableCell>
                          <TableCell><span className="text-xs text-muted-foreground">#{log.tenantId}</span></TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">{log.tone}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${log.success ? "text-success border-success/30" : "text-destructive border-destructive/30"}`}>
                              {log.success ? "Success" : "Failed"}
                            </Badge>
                          </TableCell>
                          <TableCell><p className="text-xs text-muted-foreground max-w-[200px] truncate">{log.original}</p></TableCell>
                          <TableCell><p className="text-xs max-w-[200px] truncate">{log.rewritten || "—"}</p></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
