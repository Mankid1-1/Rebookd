import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  BarChart3, Bot, MessageSquare, TrendingUp, Users, Zap,
  ArrowRight, Calendar, Plus, DollarSign, AlertTriangle,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RevenueDashboard } from "@/components/analytics/RevenueDashboard";
import { RevenueLeakageDashboard } from "@/components/analytics/RevenueLeakageDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SetupChecklist } from "@/components/SetupChecklist";

// Status colors for lead status pie chart
const STATUS_COLORS: Record<string, string> = {
  new: "#60a5fa",
  contacted: "#fbbf24",
  qualified: "#c084fc",
  booked: "#34d399",
  lost: "#f87171",
  unsubscribed: "#9ca3af",
};

// Type for recentMessages items returned by the dashboard query
interface RecentMessageItem {
  msg: {
    id: number;
    body: string | null;
    direction: string;
    createdAt: string | Date;
    fromNumber?: string | null;
    toNumber?: string | null;
  };
  lead: {
    id: number;
    name: string | null;
    phone: string;
  };
}

function SkeletonCard() {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            <div className="h-3 w-16 bg-muted rounded animate-pulse" />
          </div>
          <div className="w-10 h-10 rounded-xl bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonChart() {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="h-4 w-48 bg-muted rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-48 bg-muted/30 rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.analytics.dashboard.useQuery(undefined, {
    retry: false,
    refetchInterval: 30000,
  });
  const { data: tenant } = trpc.tenant.get.useQuery(undefined, { retry: false });
  const { data: leakageReport, isLoading: leakageLoading } = trpc.analytics.revenueLeakage.useQuery(
    { days: 90 },
    { retry: false, refetchInterval: 60000 },
  );
  const createRecoveryCampaign = trpc.analytics.createRecoveryCampaign.useMutation({
    onSuccess: () => {
      toast.success("Recovery campaign created successfully");
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const [showAddLead, setShowAddLead] = useState(false);
  const [newLead, setNewLead] = useState({ phone: "", name: "" });
  const [activeTab, setActiveTab] = useState("overview");

  // Redirect to onboarding if no tenant
  useEffect(() => {
    if (!isLoading && user && !tenant) setLocation("/onboarding");
  }, [isLoading, user, tenant, setLocation]);

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success("Lead added");
      setShowAddLead(false);
      setNewLead({ phone: "", name: "" });
      utils.analytics.dashboard.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const handleRecoveryAction = async (actionType: string, _leadIds: number[]) => {
    if (actionType === "bulk_recovery") {
      await createRecoveryCampaign.mutateAsync({
        leakageType: "no_show",
        priority: "high",
        discountAmount: 20,
      });
    } else if (actionType === "targeted_recovery") {
      await createRecoveryCampaign.mutateAsync({
        leakageType: "cancellation",
        priority: "medium",
      });
    }
  };

  const metrics = data?.metrics;
  const statusBreakdown = data?.statusBreakdown ?? [];
  const messageVolume = data?.messageVolume ?? [];
  const recentMessages = (data?.recentMessages ?? []) as RecentMessageItem[];
  const revenueMetrics = data?.revenueMetrics;
  const revenueTrends = data?.revenueTrends ?? [];

  const chartData = (() => {
    const map: Record<string, { date: string; outbound: number; inbound: number }> = {};
    for (const row of messageVolume) {
      const date = row.date as string;
      if (!map[date]) map[date] = { date, outbound: 0, inbound: 0 };
      if (row.direction === "outbound") map[date].outbound = Number(row.count);
      else map[date].inbound = Number(row.count);
    }
    return Object.values(map).slice(-14);
  })();

  const bookingRate = metrics?.leadCount
    ? Math.round(((metrics.bookedCount ?? 0) / metrics.leadCount) * 100)
    : 0;

  const statCards = [
    { title: "Total Leads", value: metrics?.leadCount ?? 0, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10", action: () => setLocation("/leads") },
    { title: "Messages Sent", value: metrics?.messageCount ?? 0, icon: MessageSquare, color: "text-purple-400", bg: "bg-purple-500/10", action: () => setLocation("/leads") },
    { title: "Active Automations", value: metrics?.automationCount ?? 0, icon: Bot, color: "text-cyan-400", bg: "bg-cyan-500/10", action: () => setLocation("/automations") },
    { title: "Booked", value: metrics?.bookedCount ?? 0, icon: Calendar, color: "text-green-400", bg: "bg-green-500/10", action: () => setLocation("/analytics") },
  ];

  // Format currency
  const fmtCurrency = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Setup Checklist */}
        <SetupChecklist />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {tenant?.name ? `${tenant.name}` : "Dashboard"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Overview of your re-engagement activity and revenue recovery
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddLead(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Lead
            </Button>
            <Button size="sm" onClick={() => setLocation("/automations")}>
              <Zap className="w-4 h-4 mr-1.5" /> Automations
            </Button>
          </div>
        </div>

        {/* Revenue Summary Row */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border bg-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-2">Total Recovered Revenue</p>
                    <p className="text-3xl font-bold text-emerald-400">
                      {fmtCurrency(revenueMetrics?.totalRecoveredRevenue ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {revenueMetrics?.bookedLeadsCount ?? 0} bookings all time
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-2">This Month Revenue</p>
                    <p className="text-3xl font-bold text-blue-400">
                      {fmtCurrency(revenueMetrics?.recentRecoveredRevenue ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {revenueMetrics?.recentBookingsCount ?? 0} bookings this month
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-2">Active Automations</p>
                    <p className="text-3xl font-bold text-cyan-400">
                      {metrics?.automationCount ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {revenueMetrics?.overallRecoveryRate != null
                        ? `${revenueMetrics.overallRecoveryRate.toFixed(1)}% recovery rate`
                        : "No data yet"}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-cyan-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="revenue" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Revenue Recovery
            </TabsTrigger>
            <TabsTrigger value="leakage" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Revenue Leakage
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stat Cards */}
            {isLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-tour="stats-cards">
                {statCards.map((stat) => (
                  <Card
                    key={stat.title}
                    className="border-border bg-card cursor-pointer hover:border-primary/20 transition-all"
                    onClick={stat.action}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground font-medium mb-2">{stat.title}</p>
                          <p className="text-3xl font-bold">{stat.value.toLocaleString()}</p>
                          {stat.title === "Booked" && metrics?.leadCount ? (
                            <p className="text-xs text-muted-foreground mt-1.5">{bookingRate}% conversion</p>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-1.5">All time</p>
                          )}
                        </div>
                        <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                          <stat.icon className={`w-5 h-5 ${stat.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Charts Row */}
            {isLoading ? (
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2"><SkeletonChart /></div>
                <SkeletonChart />
              </div>
            ) : (
              <div className="grid lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2 border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      Message Volume (Last 14 Days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartData.length === 0 ? (
                      <div className="h-48 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                        <MessageSquare className="w-8 h-8 opacity-30" />
                        <p className="text-sm">No messages yet — add a lead and start a conversation</p>
                        <Button size="sm" variant="outline" onClick={() => setShowAddLead(true)}>
                          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add your first lead
                        </Button>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="oklch(0.62 0.22 255)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="oklch(0.62 0.22 255)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="oklch(0.70 0.18 190)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="oklch(0.70 0.18 190)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 255)" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.03 255)" }} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.03 255)" }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ background: "oklch(0.16 0.025 255)", border: "1px solid oklch(0.25 0.03 255)", borderRadius: "8px", fontSize: "12px" }} labelStyle={{ color: "oklch(0.95 0.01 255)" }} />
                          <Area type="monotone" dataKey="outbound" stroke="oklch(0.62 0.22 255)" fill="url(#outboundGrad)" strokeWidth={2} name="Outbound" />
                          <Area type="monotone" dataKey="inbound" stroke="oklch(0.70 0.18 190)" fill="url(#inboundGrad)" strokeWidth={2} name="Inbound" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" /> Lead Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {statusBreakdown.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No leads yet</div>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={140}>
                          <PieChart>
                            <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="count" nameKey="status">
                              {statusBreakdown.map((entry) => (
                                <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#6b7280"} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ background: "oklch(0.16 0.025 255)", border: "1px solid oklch(0.25 0.03 255)", borderRadius: "8px", fontSize: "12px" }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-1.5 mt-2">
                          {statusBreakdown.map((item) => (
                            <div key={item.status} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[item.status] ?? "#6b7280" }} />
                                <span className="capitalize text-muted-foreground">{item.status}</span>
                              </div>
                              <span className="font-medium">{item.count}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Recent Messages / Activity Feed */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" /> Recent Messages
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setLocation("/leads")}>
                  View all <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="w-2 h-2 rounded-full mt-1.5 bg-muted animate-pulse" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                          <div className="h-3 w-full bg-muted rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentMessages.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No messages yet. Add a lead and send your first message.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentMessages.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setLocation(`/leads/${item.lead?.id}`)}
                      >
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.msg?.direction === "outbound" ? "bg-primary" : "bg-green-400"}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-medium">{item.lead?.name || item.lead?.phone}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.msg?.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{item.msg?.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Recovery Tab */}
          <TabsContent value="revenue" className="space-y-6">
            {revenueMetrics ? (
              <RevenueDashboard
                revenueMetrics={revenueMetrics}
                revenueTrends={revenueTrends}
                isLoading={isLoading}
              />
            ) : (
              <Card className="border-border bg-card">
                <CardContent className="p-8 text-center">
                  <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Revenue Analytics Coming Soon</h3>
                  <p className="text-muted-foreground">
                    Start converting leads to see detailed revenue recovery metrics.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Revenue Leakage Tab */}
          <TabsContent value="leakage" className="space-y-6">
            {leakageReport ? (
              <RevenueLeakageDashboard
                leakageReport={leakageReport as Parameters<typeof RevenueLeakageDashboard>[0]["leakageReport"]}
                isLoading={leakageLoading}
                onRecoveryAction={handleRecoveryAction}
              />
            ) : (
              <Card className="border-border bg-card">
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Revenue Leakage Detection</h3>
                  <p className="text-muted-foreground">
                    Analyzing your appointment data to identify revenue leakage opportunities...
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Add Lead Dialog */}
        <Dialog open={showAddLead} onOpenChange={setShowAddLead}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Phone number <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="+1 (555) 000-0000"
                  value={newLead.phone}
                  onChange={(e) => setNewLead((prev) => ({ ...prev, phone: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    placeholder="Jane Smith"
                    value={newLead.name}
                    onChange={(e) => setNewLead((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setShowAddLead(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={!newLead.phone || createLead.isPending}
                  onClick={() => createLead.mutate({ phone: newLead.phone, name: newLead.name || null })}
                >
                  {createLead.isPending ? "Adding..." : "Add Lead"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
