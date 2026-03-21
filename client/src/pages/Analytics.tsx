import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { BarChart3, MessageSquare, TrendingUp, Users, Bot, Zap } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  new: "#3b82f6",
  contacted: "#eab308",
  qualified: "#a855f7",
  booked: "#22c55e",
  lost: "#ef4444",
  unsubscribed: "#6b7280",
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "oklch(0.16 0.025 255)",
    border: "1px solid oklch(0.25 0.03 255)",
    borderRadius: "8px",
    fontSize: "12px",
  },
  labelStyle: { color: "oklch(0.95 0.01 255)" },
};

export default function Analytics() {
  const { data, isLoading } = trpc.analytics.dashboard.useQuery(undefined, { retry: false });

  const metrics = data?.metrics;
  const statusBreakdown = data?.statusBreakdown ?? [];
  const messageVolume = data?.messageVolume ?? [];
  const automationStats = (data as any)?.automationStats;

  // Build message volume chart data
  const chartData = (() => {
    const map: Record<string, { date: string; outbound: number; inbound: number }> = {};
    for (const row of messageVolume) {
      const date = row.date as string;
      if (!map[date]) map[date] = { date, outbound: 0, inbound: 0 };
      if (row.direction === "outbound") map[date].outbound = Number(row.count);
      else map[date].inbound = Number(row.count);
    }
    return Object.values(map).slice(-30);
  })();

  const bookingRate = metrics?.leadCount
    ? Math.round(((metrics.bookedCount ?? 0) / metrics.leadCount) * 100)
    : 0;

  const contactRate = metrics?.leadCount
    ? Math.round((statusBreakdown.filter(s => ["contacted","qualified","booked"].includes(s.status)).reduce((sum, s) => sum + s.count, 0) / metrics.leadCount) * 100)
    : 0;

  const statCards = [
    { title: "Total Leads", value: metrics?.leadCount ?? 0, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { title: "Messages Sent", value: metrics?.messageCount ?? 0, icon: MessageSquare, color: "text-purple-400", bg: "bg-purple-500/10" },
    { title: "Booked", value: metrics?.bookedCount ?? 0, icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/10" },
    { title: "Active Automations", value: metrics?.automationCount ?? 0, icon: Bot, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your re-engagement performance</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="border-border bg-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-2">{stat.title}</p>
                    <p className="text-3xl font-bold">{isLoading ? "—" : stat.value.toLocaleString()}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Conversion Rates */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Booking Rate */}
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-1">Booking Conversion Rate</p>
              <p className="text-4xl font-bold mt-1">{bookingRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics?.bookedCount ?? 0} booked / {metrics?.leadCount ?? 0} leads
              </p>
              <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${bookingRate}%` }} />
              </div>
            </CardContent>
          </Card>

          {/* Contact Rate */}
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-1">Contact Rate</p>
              <p className="text-4xl font-bold mt-1">{contactRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                Leads that progressed past "new"
              </p>
              <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${contactRate}%` }} />
              </div>
            </CardContent>
          </Card>

          {/* Automation Performance */}
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-1">Automation Runs</p>
              <p className="text-4xl font-bold mt-1">{automationStats?.totalRuns?.toLocaleString() ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {automationStats?.totalEnabled ?? 0} automations active
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs text-muted-foreground">
                  {automationStats?.totalEnabled > 0 ? "Automations running" : "No automations enabled yet"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Message Volume Chart */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Message Volume (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                No message data yet — send your first message to a lead
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
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
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Area type="monotone" dataKey="outbound" stroke="oklch(0.62 0.22 255)" fill="url(#outboundGrad)" strokeWidth={2} name="Outbound" />
                  <Area type="monotone" dataKey="inbound" stroke="oklch(0.70 0.18 190)" fill="url(#inboundGrad)" strokeWidth={2} name="Inbound" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Lead Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusBreakdown.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No leads yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={statusBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 255)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "oklch(0.60 0.03 255)" }} tickLine={false} axisLine={false} />
                    <YAxis dataKey="status" type="category" tick={{ fontSize: 11, fill: "oklch(0.60 0.03 255)" }} tickLine={false} width={80} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {statusBreakdown.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#6b7280"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusBreakdown.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No leads yet</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={statusBreakdown}
                        cx="50%"
                        cy="50%"
                        outerRadius={65}
                        dataKey="count"
                        nameKey="status"
                        label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                        labelLine={false}
                      >
                        {statusBreakdown.map((entry) => (
                          <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#6b7280"} />
                        ))}
                      </Pie>
                      <Tooltip {...TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {statusBreakdown.map((item) => (
                      <div key={item.status} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[item.status] ?? "#6b7280" }} />
                        <span className="capitalize text-muted-foreground">{item.status}</span>
                        <span className="font-medium ml-auto">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
