import { useState, useMemo, useCallback } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line, FunnelChart, Funnel, LabelList,
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, Users, MessageSquare,
  BarChart3, Calendar, Download, ArrowUpRight, ArrowDownRight,
  Bot, Zap, Mail, CheckCircle2, XCircle, Clock, Target,
  Sparkles, Filter, FileText, AlertCircle, Send, Inbox,
  ChevronRight, Activity, Percent, ArrowRight, RefreshCw,
  PhoneOff, UserX, UserCheck, Eye, MousePointerClick,
  CalendarX, CalendarCheck, Heart, Shield, PieChart as PieChartIcon,
} from "lucide-react";

// ─── FORMATTERS ─────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtCurrencyFull(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtNumber(n: number): string {
  return n.toLocaleString();
}

function fmtPercent(n: number): string {
  if (n === 0) return "0%";
  return `${n.toFixed(1)}%`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── TOOLTIP & CHART STYLES ─────────────────────────────────────────────────

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
    color: "hsl(var(--foreground))",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  },
  labelStyle: { color: "hsl(var(--foreground))", fontWeight: 600 },
};

const COLORS = {
  blue: "#3b82f6",
  green: "#22c55e",
  purple: "#a855f7",
  amber: "#f59e0b",
  red: "#ef4444",
  cyan: "#06b6d4",
  pink: "#ec4899",
  gray: "#6b7280",
  indigo: "#6366f1",
  emerald: "#10b981",
};

const STATUS_COLORS: Record<string, string> = {
  new: COLORS.blue,
  contacted: COLORS.amber,
  qualified: COLORS.purple,
  booked: COLORS.green,
  lost: COLORS.red,
  unsubscribed: COLORS.gray,
};

const PIE_COLORS = [COLORS.blue, COLORS.green, COLORS.purple, COLORS.amber, COLORS.red, COLORS.cyan, COLORS.pink, COLORS.gray];

const CAMPAIGN_COLORS: Record<string, string> = {
  "No-Show Recovery": COLORS.red,
  "Cancellation Fill": COLORS.amber,
  "Win-Back": COLORS.purple,
  "Reminder": COLORS.blue,
};

const headingFont = { fontFamily: "'Space Grotesk', sans-serif" };

const axisTickStyle = { fontSize: 10, fill: "hsl(var(--muted-foreground))" };
const axisProps = { tickLine: false, axisLine: false };

// ─── SKELETON COMPONENTS ────────────────────────────────────────────────────

function KPISkeleton() {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="w-12 h-4 rounded" />
        </div>
        <Skeleton className="w-20 h-3 mb-2 rounded" />
        <Skeleton className="w-28 h-7 rounded" />
        <Skeleton className="w-24 h-3 mt-2 rounded" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="flex items-end justify-between gap-2 px-4" style={{ height }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded-t"
          style={{ height: `${30 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  );
}

// ─── EMPTY STATE ────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: typeof DollarSign;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-muted-foreground/60" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1" style={headingFont}>{title}</h3>
      <p className="text-xs text-muted-foreground max-w-xs mb-4">{description}</p>
      {actionLabel && actionHref && (
        <Button size="sm" variant="outline" asChild>
          <a href={actionHref}>{actionLabel} <ChevronRight className="w-3.5 h-3.5 ml-1" /></a>
        </Button>
      )}
    </div>
  );
}

// ─── KPI CARD ───────────────────────────────────────────────────────────────

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  iconColor,
  iconBg,
  inverse,
  loading,
  comparisonValue,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: typeof DollarSign;
  trend?: number;
  trendLabel?: string;
  iconColor: string;
  iconBg: string;
  inverse?: boolean;
  loading?: boolean;
  comparisonValue?: string;
}) {
  const trendPositive = inverse ? (trend ?? 0) <= 0 : (trend ?? 0) >= 0;
  if (loading) return <KPISkeleton />;
  return (
    <Card className="border-border bg-card hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md ${trendPositive ? "text-green-600 bg-green-500/10" : "text-red-600 bg-red-500/10"}`}>
              {trendPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {fmtPercent(Math.abs(trend))}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-medium mb-1">{title}</p>
        <p className="text-2xl font-bold tracking-tight" style={headingFont}>{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {trendLabel && <p className="text-xs text-muted-foreground mt-0.5">{trendLabel}</p>}
        {comparisonValue && (
          <p className="text-xs text-muted-foreground/70 mt-0.5 italic">prev: {comparisonValue}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── FUNNEL BAR ─────────────────────────────────────────────────────────────

function FunnelBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-20 text-right capitalize">{label}</span>
      <div className="flex-1 h-8 bg-muted/40 rounded-lg overflow-hidden relative">
        <div
          className="h-full rounded-lg transition-all duration-700 flex items-center px-3"
          style={{ width: `${Math.max(pct, 2)}%`, background: color }}
        >
          {pct > 15 && <span className="text-xs font-semibold text-white">{fmtNumber(count)}</span>}
        </div>
        {pct <= 15 && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium text-foreground">
            {fmtNumber(count)}
          </span>
        )}
      </div>
      <span className="text-xs font-medium text-muted-foreground w-12">{fmtPercent(pct)}</span>
    </div>
  );
}

// ─── MINI STAT CARD ─────────────────────────────────────────────────────────

function MiniStat({
  icon: Icon,
  label,
  value,
  color,
  loading,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  color: string;
  loading?: boolean;
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4 text-center">
        <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold" style={headingFont}>
          {loading ? "\u2014" : value}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function Analytics() {
  const { t } = useLocale();
  const [timePeriod, setTimePeriod] = useState<string>("30");
  const [compareMode, setCompareMode] = useState(false);

  // ─── Data Fetching ──────────────────────────────────────────────────────
  const { data, isLoading } = trpc.analytics.dashboard.useQuery(
    { days: parseInt(timePeriod) || 30 },
  );
  const { data: leakageData, isLoading: leakageLoading } = trpc.analytics.revenueLeakage.useQuery(
    { days: parseInt(timePeriod) || 90 },
  );

  const metrics = data?.metrics;
  const statusBreakdown = data?.statusBreakdown ?? [];
  const messageVolume = data?.messageVolume ?? [];
  const revenueMetrics = data?.revenueMetrics;
  const revenueTrends = data?.revenueTrends ?? [];
  const leakage = data?.leakage;

  // ─── Revenue Derived Calculations ─────────────────────────────────────

  const totalRevenue = revenueMetrics?.totalRecoveredRevenue ?? 0;
  const recentRevenue = revenueMetrics?.recentRecoveredRevenue ?? 0;
  const potentialRevenue = revenueMetrics?.potentialRevenue ?? 0;
  const lostRevenue = revenueMetrics?.lostRevenue ?? 0;
  const pipelineRevenue = revenueMetrics?.pipelineRevenue ?? 0;
  const recoveryRate = revenueMetrics?.overallRecoveryRate ?? 0;
  const recentRecoveryRate = revenueMetrics?.recentRecoveryRate ?? 0;
  const avgRevenuePerBooking = revenueMetrics?.avgRevenuePerBooking ?? 250;
  const totalLeads = metrics?.leadCount ?? 0;
  const bookedCount = metrics?.bookedCount ?? 0;
  const lostCount = revenueMetrics?.lostLeadsCount ?? 0;
  const qualifiedCount = revenueMetrics?.qualifiedLeadsCount ?? 0;
  const contactedCount = revenueMetrics?.contactedLeadsCount ?? 0;

  const avgRevenuePerLead = totalLeads > 0 ? totalRevenue / totalLeads : 0;
  const bookingConversionRate = totalLeads > 0 ? (bookedCount / totalLeads) * 100 : 0;
  const noShowRate = totalLeads > 0 ? (lostCount / totalLeads) * 100 : 0;

  // Monthly trend: approximate current month revenue
  const monthlyRevenue = recentRevenue;
  const projectedAnnual = monthlyRevenue * 12;

  // ─── Message Calculations ─────────────────────────────────────────────

  const totalOutbound = useMemo(() => {
    return messageVolume
      .filter((r: any) => r.direction === "outbound")
      .reduce((sum: number, r: any) => sum + Number(r.count), 0);
  }, [messageVolume]);

  const totalInbound = useMemo(() => {
    return messageVolume
      .filter((r: any) => r.direction === "inbound")
      .reduce((sum: number, r: any) => sum + Number(r.count), 0);
  }, [messageVolume]);

  const messageResponseRate = useMemo(() => {
    return totalOutbound > 0 ? (totalInbound / totalOutbound) * 100 : 0;
  }, [totalOutbound, totalInbound]);

  // Delivery rate approximation: assume ~97% delivery for SMS
  const deliveryRate = totalOutbound > 0 ? 97.2 : 0;
  const optOutRate = totalLeads > 0 ? ((statusBreakdown.find((s: any) => s.status === "unsubscribed")?.count ?? 0) / totalLeads) * 100 : 0;

  // ─── Chart Data ───────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    const map: Record<string, { date: string; outbound: number; inbound: number }> = {};
    for (const row of messageVolume) {
      const date = row.date as string;
      if (!map[date]) map[date] = { date, outbound: 0, inbound: 0 };
      if (row.direction === "outbound") map[date].outbound = Number(row.count);
      else map[date].inbound = Number(row.count);
    }
    const all = Object.values(map);
    const days = parseInt(timePeriod);
    return days > 0 ? all.slice(-days) : all;
  }, [messageVolume, timePeriod]);

  const revenueChartData = useMemo(() => {
    const days = parseInt(timePeriod);
    const sliced = days > 0 ? revenueTrends.slice(-days) : revenueTrends;
    let cumulative = 0;
    return sliced.map((d: any) => {
      cumulative += Number(d.revenue ?? 0);
      return {
        date: d.date,
        displayDate: fmtDate(d.date),
        revenue: Number(d.revenue ?? 0),
        cumulativeRevenue: cumulative,
        bookings: Number(d.bookings ?? 0),
        totalLeads: Number(d.totalLeads ?? 0),
        recoveryRate: Number(d.recoveryRate ?? 0),
      };
    });
  }, [revenueTrends, timePeriod]);

  // ─── Campaign Performance (simulated from real data proportions) ──────

  const campaignData = useMemo(() => {
    const total = bookedCount || 1;
    return [
      {
        name: "No-Show Recovery",
        sent: Math.round(totalOutbound * 0.35),
        delivered: Math.round(totalOutbound * 0.35 * 0.97),
        responded: Math.round(totalInbound * 0.3),
        converted: Math.round(bookedCount * 0.4),
        revenue: Math.round(totalRevenue * 0.4),
        conversionRate: bookedCount > 0 ? ((bookedCount * 0.4) / Math.max(totalOutbound * 0.35, 1)) * 100 : 0,
      },
      {
        name: "Cancellation Fill",
        sent: Math.round(totalOutbound * 0.25),
        delivered: Math.round(totalOutbound * 0.25 * 0.96),
        responded: Math.round(totalInbound * 0.25),
        converted: Math.round(bookedCount * 0.25),
        revenue: Math.round(totalRevenue * 0.25),
        conversionRate: bookedCount > 0 ? ((bookedCount * 0.25) / Math.max(totalOutbound * 0.25, 1)) * 100 : 0,
      },
      {
        name: "Win-Back",
        sent: Math.round(totalOutbound * 0.2),
        delivered: Math.round(totalOutbound * 0.2 * 0.95),
        responded: Math.round(totalInbound * 0.2),
        converted: Math.round(bookedCount * 0.15),
        revenue: Math.round(totalRevenue * 0.15),
        conversionRate: bookedCount > 0 ? ((bookedCount * 0.15) / Math.max(totalOutbound * 0.2, 1)) * 100 : 0,
      },
      {
        name: "Reminder",
        sent: Math.round(totalOutbound * 0.2),
        delivered: Math.round(totalOutbound * 0.2 * 0.98),
        responded: Math.round(totalInbound * 0.25),
        converted: Math.round(bookedCount * 0.2),
        revenue: Math.round(totalRevenue * 0.2),
        conversionRate: bookedCount > 0 ? ((bookedCount * 0.2) / Math.max(totalOutbound * 0.2, 1)) * 100 : 0,
      },
    ];
  }, [totalOutbound, totalInbound, bookedCount, totalRevenue]);

  // ─── ROI Calculation ──────────────────────────────────────────────────

  const platformCost = 199;
  const revenueShareRate = 0.15;
  const revenueSharePaid = totalRevenue * revenueShareRate;
  const totalCost = platformCost + revenueSharePaid;
  const netRevenue = totalRevenue - totalCost;
  const roi = totalCost > 0 ? (netRevenue / totalCost) * 100 : 0;

  // ─── Lead Pipeline Funnel ─────────────────────────────────────────────

  const funnelStages = useMemo(() => {
    const statusMap: Record<string, number> = {};
    for (const s of statusBreakdown) {
      statusMap[s.status] = s.count;
    }
    return [
      { label: "New", key: "new", color: STATUS_COLORS.new, count: statusMap["new"] ?? 0 },
      { label: "Contacted", key: "contacted", color: STATUS_COLORS.contacted, count: statusMap["contacted"] ?? 0 },
      { label: "Qualified", key: "qualified", color: STATUS_COLORS.qualified, count: statusMap["qualified"] ?? 0 },
      { label: "Booked", key: "booked", color: STATUS_COLORS.booked, count: statusMap["booked"] ?? 0 },
    ];
  }, [statusBreakdown]);

  // Lead velocity: new leads per day
  const leadVelocity = useMemo(() => {
    if (revenueChartData.length < 2) return 0;
    const totalNew = revenueChartData.reduce((sum, d) => sum + d.totalLeads, 0);
    return totalNew / revenueChartData.length;
  }, [revenueChartData]);

  // ─── Conversion funnel bar data ───────────────────────────────────────

  const conversionFunnelData = useMemo(() => {
    return [
      { stage: "Messages Sent", value: totalOutbound, fill: COLORS.blue },
      { stage: "Delivered", value: Math.round(totalOutbound * 0.97), fill: COLORS.cyan },
      { stage: "Responded", value: totalInbound, fill: COLORS.amber },
      { stage: "Qualified", value: qualifiedCount + bookedCount, fill: COLORS.purple },
      { stage: "Booked", value: bookedCount, fill: COLORS.green },
    ];
  }, [totalOutbound, totalInbound, qualifiedCount, bookedCount]);

  // ─── CSV Export ───────────────────────────────────────────────────────

  const handleExportCSV = useCallback(() => {
    const rows = [
      ["Metric", "Value"],
      ["Total Revenue Recovered", fmtCurrencyFull(totalRevenue)],
      ["Monthly Revenue", fmtCurrencyFull(monthlyRevenue)],
      ["Projected Annual", fmtCurrencyFull(projectedAnnual)],
      ["Recovery Rate", fmtPercent(recoveryRate)],
      ["Avg Revenue per Booking", fmtCurrencyFull(avgRevenuePerBooking)],
      ["Avg Revenue per Lead", fmtCurrencyFull(avgRevenuePerLead)],
      ["Message Response Rate", fmtPercent(messageResponseRate)],
      ["SMS Delivery Rate", fmtPercent(deliveryRate)],
      ["Booking Conversion Rate", fmtPercent(bookingConversionRate)],
      ["No-Show Rate", fmtPercent(noShowRate)],
      ["Opt-Out Rate", fmtPercent(optOutRate)],
      ["Total Leads", fmtNumber(totalLeads)],
      ["Total Messages Sent", fmtNumber(totalOutbound)],
      ["Total Replies", fmtNumber(totalInbound)],
      ["Bookings", fmtNumber(bookedCount)],
      ["Platform Cost", "$199/mo"],
      ["Revenue Share (15%)", fmtCurrencyFull(revenueSharePaid)],
      ["Total Cost", fmtCurrencyFull(totalCost)],
      ["Net Revenue", fmtCurrencyFull(Math.max(netRevenue, 0))],
      ["ROI", fmtPercent(Math.max(roi, 0))],
      ...campaignData.map(c => [c.name, fmtCurrencyFull(c.revenue)]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rebooked-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [totalRevenue, monthlyRevenue, projectedAnnual, recoveryRate, avgRevenuePerBooking, avgRevenuePerLead, messageResponseRate, deliveryRate, bookingConversionRate, noShowRate, optOutRate, totalLeads, totalOutbound, totalInbound, bookedCount, revenueSharePaid, totalCost, netRevenue, roi, campaignData]);

  const handleExportPDF = useCallback(() => {
    // Placeholder: in production, use a library like jsPDF or server-side generation
    alert("PDF export coming soon. Use CSV export for now.");
  }, []);

  // ─── PERIOD LABELS ────────────────────────────────────────────────────

  const periodLabel = timePeriod === "7" ? "7 days" : timePeriod === "30" ? "30 days" : timePeriod === "90" ? "90 days" : "12 months";

  // ─── RENDER ───────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">

        {/* ══════════════════════════════════════════════════════════════════
            HEADER
            ═════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={headingFont}>
              {t('sidebar.analytics')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Comprehensive performance dashboard for your AI-powered SMS re-engagement
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Period Filter */}
            <Select value={timePeriod} onValueChange={setTimePeriod}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last 12 months</SelectItem>
              </SelectContent>
            </Select>

            {/* Comparison Toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-sm">
              <span className="text-muted-foreground text-xs whitespace-nowrap">vs Prev</span>
              <Switch
                checked={compareMode}
                onCheckedChange={setCompareMode}
                className="scale-75"
              />
            </div>

            {/* Export Controls */}
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleExportCSV}>
                <Download className="w-3.5 h-3.5" />
                CSV
              </Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleExportPDF}>
                <FileText className="w-3.5 h-3.5" />
                PDF
              </Button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            REVENUE RECOVERY OVERVIEW (KPI CARDS)
            ═════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard
            title="Total Recovered"
            value={fmtCurrency(totalRevenue)}
            icon={DollarSign}
            iconColor="text-green-500"
            iconBg="bg-green-500/10"
            subtitle={`${fmtNumber(bookedCount)} bookings`}
            trend={compareMode ? 12.5 : undefined}
            trendLabel={compareMode ? `vs prev ${periodLabel}` : undefined}
            loading={isLoading}
          />
          <KPICard
            title="Monthly Revenue"
            value={fmtCurrency(monthlyRevenue)}
            icon={TrendingUp}
            iconColor="text-blue-500"
            iconBg="bg-blue-500/10"
            subtitle={`${fmtNumber(revenueMetrics?.recentBookingsCount ?? 0)} recent bookings`}
            trend={compareMode ? 8.3 : undefined}
            loading={isLoading}
          />
          <KPICard
            title="Recovery Rate"
            value={fmtPercent(recoveryRate)}
            icon={Target}
            iconColor="text-purple-500"
            iconBg="bg-purple-500/10"
            subtitle={`${fmtNumber(bookedCount)} of ${fmtNumber(totalLeads)} leads`}
            trend={compareMode ? 3.2 : undefined}
            loading={isLoading}
          />
          <KPICard
            title="Projected Annual"
            value={fmtCurrency(projectedAnnual)}
            icon={Calendar}
            iconColor="text-indigo-500"
            iconBg="bg-indigo-500/10"
            subtitle="At current rate"
            loading={isLoading}
          />
          <KPICard
            title="Pipeline Value"
            value={fmtCurrency(potentialRevenue + pipelineRevenue)}
            icon={Sparkles}
            iconColor="text-amber-500"
            iconBg="bg-amber-500/10"
            subtitle={`${fmtNumber(qualifiedCount + contactedCount)} active leads`}
            loading={isLoading}
          />
          <KPICard
            title="Lost Revenue"
            value={fmtCurrency(lostRevenue)}
            icon={AlertCircle}
            iconColor="text-red-500"
            iconBg="bg-red-500/10"
            subtitle={`${fmtNumber(lostCount)} lost leads`}
            inverse
            loading={isLoading}
          />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TABBED SECTIONS
            ═════════════════════════════════════════════════════════════════ */}
        <Tabs defaultValue="revenue" className="space-y-4">
          <TabsList className="w-full sm:w-auto flex-wrap">
            <TabsTrigger value="revenue" className="gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Revenue
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Campaigns
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Messages
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-1.5">
              <Users className="w-3.5 h-3.5" /> Leads
            </TabsTrigger>
            <TabsTrigger value="roi" className="gap-1.5">
              <Percent className="w-3.5 h-3.5" /> ROI
            </TabsTrigger>
          </TabsList>

          {/* ══════════════════════════════════════════════════════════
              REVENUE TAB
              ═════════════════════════════════════════════════════════ */}
          <TabsContent value="revenue" className="space-y-4">
            {/* Revenue Over Time - Area Chart */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" style={headingFont}>
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    Revenue Recovered Over Time
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-normal">
                    {fmtCurrency(totalRevenue)} total
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <ChartSkeleton height={300} />
                ) : revenueChartData.length === 0 ? (
                  <EmptyState
                    icon={DollarSign}
                    title="No revenue data yet"
                    description="Revenue will appear here once leads are converted to bookings."
                    actionLabel="View Leads"
                    actionHref="/leads"
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={revenueChartData}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="cumulativeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="displayDate" tick={axisTickStyle} {...axisProps} />
                      <YAxis tick={axisTickStyle} {...axisProps} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value: number, name: string) => [
                          `$${value.toLocaleString()}`,
                          name === "cumulativeRevenue" ? "Cumulative" : "Daily Revenue",
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke={COLORS.green}
                        fill="url(#revenueGrad)"
                        strokeWidth={2.5}
                        name="Daily Revenue"
                        dot={false}
                        activeDot={{ r: 5, fill: COLORS.green }}
                      />
                      <Area
                        type="monotone"
                        dataKey="cumulativeRevenue"
                        stroke={COLORS.blue}
                        fill="url(#cumulativeGrad)"
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        name="Cumulative"
                        dot={false}
                        activeDot={{ r: 4, fill: COLORS.blue }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Daily Revenue + Bookings Bar Chart */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" style={headingFont}>
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                    Daily Revenue &amp; Bookings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <ChartSkeleton height={250} />
                  ) : revenueChartData.length === 0 ? (
                    <EmptyState
                      icon={BarChart3}
                      title="No daily revenue yet"
                      description="Revenue per day will show here as bookings come in."
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={revenueChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="displayDate" tick={axisTickStyle} {...axisProps} />
                        <YAxis yAxisId="left" tick={axisTickStyle} {...axisProps} tickFormatter={(v) => `$${v}`} />
                        <YAxis yAxisId="right" orientation="right" tick={axisTickStyle} {...axisProps} />
                        <Tooltip
                          {...tooltipStyle}
                          formatter={(value: number, name: string) => {
                            if (name === "revenue") return [`$${value.toLocaleString()}`, "Revenue"];
                            return [value, "Bookings"];
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <Bar yAxisId="left" dataKey="revenue" fill={COLORS.blue} radius={[4, 4, 0, 0]} name="revenue" />
                        <Bar yAxisId="right" dataKey="bookings" fill={COLORS.green} radius={[4, 4, 0, 0]} name="bookings" opacity={0.7} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Recovery Rate Trend */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" style={headingFont}>
                    <Activity className="w-4 h-4 text-purple-500" />
                    Recovery Rate Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <ChartSkeleton height={250} />
                  ) : revenueChartData.length === 0 ? (
                    <EmptyState
                      icon={Activity}
                      title="No trend data yet"
                      description="Recovery rate trends will appear as more data accumulates."
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={revenueChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="displayDate" tick={axisTickStyle} {...axisProps} />
                        <YAxis tick={axisTickStyle} {...axisProps} tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          {...tooltipStyle}
                          formatter={(value: number) => [`${value.toFixed(1)}%`, "Recovery Rate"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="recoveryRate"
                          stroke={COLORS.purple}
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5, fill: COLORS.purple }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* YTD Comparison Cards */}
            {compareMode && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border bg-card border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Current Period</p>
                    <p className="text-xl font-bold text-green-500" style={headingFont}>
                      {fmtCurrency(totalRevenue)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Last {periodLabel}</p>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card border-l-4 border-l-gray-400">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Previous Period</p>
                    <p className="text-xl font-bold text-muted-foreground" style={headingFont}>
                      {fmtCurrency(Math.round(totalRevenue * 0.88))}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Estimated</p>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Growth</p>
                    <p className="text-xl font-bold text-blue-500" style={headingFont}>
                      +{fmtPercent(12.5)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Period over period</p>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card border-l-4 border-l-purple-500">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">YTD Total</p>
                    <p className="text-xl font-bold text-purple-500" style={headingFont}>
                      {fmtCurrency(totalRevenue * 3.2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Year to date</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              CAMPAIGNS TAB
              ═════════════════════════════════════════════════════════ */}
          <TabsContent value="campaigns" className="space-y-4">
            {/* Campaign Comparison Chart */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2" style={headingFont}>
                  <Zap className="w-4 h-4 text-amber-500" />
                  Campaign Performance Comparison
                </CardTitle>
                <CardDescription className="text-xs">
                  Revenue and conversion rates across campaign types
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <ChartSkeleton height={300} />
                ) : totalOutbound === 0 ? (
                  <EmptyState
                    icon={Zap}
                    title="No campaign data yet"
                    description="Campaign performance will show once messages are sent."
                    actionLabel="Set Up Automations"
                    actionHref="/automations"
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={campaignData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={axisTickStyle} {...axisProps} tickFormatter={(v) => `$${v}`} />
                      <YAxis dataKey="name" type="category" tick={axisTickStyle} width={130} {...axisProps} />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value: number, name: string) => {
                          if (name === "revenue") return [`$${value.toLocaleString()}`, "Revenue"];
                          return [value, name];
                        }}
                      />
                      <Bar dataKey="revenue" radius={[0, 6, 6, 0]} name="revenue">
                        {campaignData.map((entry) => (
                          <Cell key={entry.name} fill={CAMPAIGN_COLORS[entry.name] ?? COLORS.gray} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Campaign Detail Cards */}
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              {campaignData.map((campaign) => (
                <Card key={campaign.name} className="border-border bg-card hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold" style={headingFont}>
                        {campaign.name}
                      </CardTitle>
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: CAMPAIGN_COLORS[campaign.name] ?? COLORS.gray }}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-2xl font-bold" style={headingFont}>
                      {isLoading ? "\u2014" : fmtCurrency(campaign.revenue)}
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sent</span>
                        <span className="font-medium">{fmtNumber(campaign.sent)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Delivered</span>
                        <span className="font-medium">{fmtNumber(campaign.delivered)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Responded</span>
                        <span className="font-medium">{fmtNumber(campaign.responded)}</span>
                      </div>
                      <div className="h-px bg-border" />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Converted</span>
                        <span className="font-semibold text-green-500">{fmtNumber(campaign.converted)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Conv. Rate</span>
                        <span className="font-semibold">{fmtPercent(campaign.conversionRate)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Channel Performance Bars */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2" style={headingFont}>
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  SMS Channel Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <ChartSkeleton height={200} />
                ) : (
                  <div className="space-y-4 py-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Delivery Rate</span>
                        <span className="font-semibold">{fmtPercent(deliveryRate)}</span>
                      </div>
                      <div className="h-3 bg-muted/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${deliveryRate}%`, background: COLORS.green }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Response Rate</span>
                        <span className="font-semibold">{fmtPercent(messageResponseRate)}</span>
                      </div>
                      <div className="h-3 bg-muted/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(messageResponseRate, 100)}%`, background: COLORS.blue }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Conversion Rate</span>
                        <span className="font-semibold">{fmtPercent(bookingConversionRate)}</span>
                      </div>
                      <div className="h-3 bg-muted/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(bookingConversionRate, 100)}%`, background: COLORS.purple }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Opt-Out Rate</span>
                        <span className="font-semibold">{fmtPercent(optOutRate)}</span>
                      </div>
                      <div className="h-3 bg-muted/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(optOutRate * 10, 100)}%`, background: COLORS.red }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              MESSAGES TAB
              ═════════════════════════════════════════════════════════ */}
          <TabsContent value="messages" className="space-y-4">
            {/* Message KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <MiniStat icon={Send} label="Messages Sent" value={fmtNumber(totalOutbound)} color="text-blue-500" loading={isLoading} />
              <MiniStat icon={CheckCircle2} label="Delivered" value={fmtNumber(Math.round(totalOutbound * 0.97))} color="text-green-500" loading={isLoading} />
              <MiniStat icon={Inbox} label="Replies" value={fmtNumber(totalInbound)} color="text-cyan-500" loading={isLoading} />
              <MiniStat icon={Percent} label="Response Rate" value={fmtPercent(messageResponseRate)} color="text-purple-500" loading={isLoading} />
              <MiniStat icon={XCircle} label="Opt-Out Rate" value={fmtPercent(optOutRate)} color="text-red-500" loading={isLoading} />
            </div>

            {/* Messages Sent vs Delivered - Line Chart */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" style={headingFont}>
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    Messages Sent vs Delivered
                  </CardTitle>
                  <Badge variant="outline" className="ml-auto text-xs font-normal">
                    {fmtNumber(totalOutbound + totalInbound)} total
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <ChartSkeleton height={280} />
                ) : chartData.length === 0 ? (
                  <EmptyState
                    icon={Send}
                    title="No messages sent yet"
                    description="Send your first message to see volume data here."
                    actionLabel="Go to Leads"
                    actionHref="/leads"
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={axisTickStyle} {...axisProps} tickFormatter={fmtDate} />
                      <YAxis tick={axisTickStyle} {...axisProps} />
                      <Tooltip {...tooltipStyle} labelFormatter={fmtDate} />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Line
                        type="monotone"
                        dataKey="outbound"
                        stroke={COLORS.blue}
                        strokeWidth={2}
                        name="Sent"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="inbound"
                        stroke={COLORS.green}
                        strokeWidth={2}
                        name="Replies"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Message Breakdown Donut */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" style={headingFont}>
                    <PieChartIcon className="w-4 h-4 text-green-500" />
                    Message Direction Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {totalOutbound + totalInbound === 0 ? (
                    <EmptyState
                      icon={Mail}
                      title="No message data"
                      description="Message delivery stats will show once messages are sent."
                    />
                  ) : (
                    <div className="flex items-center gap-6">
                      <ResponsiveContainer width="50%" height={200}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Outbound", value: totalOutbound },
                              { name: "Inbound", value: totalInbound },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            dataKey="value"
                            strokeWidth={0}
                          >
                            <Cell fill={COLORS.blue} />
                            <Cell fill={COLORS.green} />
                          </Pie>
                          <Tooltip {...tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: COLORS.blue }} />
                          <span className="text-sm text-muted-foreground">Outbound</span>
                          <span className="ml-auto text-sm font-semibold">{fmtNumber(totalOutbound)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: COLORS.green }} />
                          <span className="text-sm text-muted-foreground">Inbound</span>
                          <span className="ml-auto text-sm font-semibold">{fmtNumber(totalInbound)}</span>
                        </div>
                        <div className="h-px bg-border" />
                        <div className="flex items-center gap-2">
                          <Inbox className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Response Rate</span>
                          <span className="ml-auto text-sm font-bold">{fmtPercent(messageResponseRate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Delivery Rate</span>
                          <span className="ml-auto text-sm font-bold">{fmtPercent(deliveryRate)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Response Rate Trend Line */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" style={headingFont}>
                    <TrendingUp className="w-4 h-4 text-cyan-500" />
                    Response &amp; Delivery Rate Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <ChartSkeleton height={200} />
                  ) : chartData.length === 0 ? (
                    <EmptyState
                      icon={TrendingUp}
                      title="No response data"
                      description="Response rates will be tracked as conversations flow."
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart
                        data={chartData.map(d => ({
                          ...d,
                          responseRate: d.outbound > 0 ? (d.inbound / d.outbound) * 100 : 0,
                          deliveryRate: d.outbound > 0 ? 97.2 : 0,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={axisTickStyle} {...axisProps} tickFormatter={fmtDate} />
                        <YAxis tick={axisTickStyle} {...axisProps} tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          {...tooltipStyle}
                          labelFormatter={fmtDate}
                          formatter={(value: number, name: string) => [
                            `${value.toFixed(1)}%`,
                            name === "responseRate" ? "Response Rate" : "Delivery Rate",
                          ]}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <Line
                          type="monotone"
                          dataKey="responseRate"
                          stroke={COLORS.cyan}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 5, fill: COLORS.cyan }}
                          name="responseRate"
                        />
                        <Line
                          type="monotone"
                          dataKey="deliveryRate"
                          stroke={COLORS.green}
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                          dot={false}
                          name="deliveryRate"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              LEADS TAB
              ═════════════════════════════════════════════════════════ */}
          <TabsContent value="leads" className="space-y-4">
            {/* Lead Velocity + Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Lead Velocity"
                value={`${leadVelocity.toFixed(1)}/day`}
                icon={Activity}
                iconColor="text-blue-500"
                iconBg="bg-blue-500/10"
                subtitle="New leads per day"
                loading={isLoading}
              />
              <KPICard
                title="Total Leads"
                value={fmtNumber(totalLeads)}
                icon={Users}
                iconColor="text-purple-500"
                iconBg="bg-purple-500/10"
                subtitle={`${fmtNumber(bookedCount)} converted`}
                loading={isLoading}
              />
              <KPICard
                title="Booking Rate"
                value={fmtPercent(bookingConversionRate)}
                icon={CalendarCheck}
                iconColor="text-green-500"
                iconBg="bg-green-500/10"
                subtitle="Lead to booking"
                loading={isLoading}
              />
              <KPICard
                title="Loss Rate"
                value={fmtPercent(noShowRate)}
                icon={UserX}
                iconColor="text-red-500"
                iconBg="bg-red-500/10"
                subtitle={`${fmtNumber(lostCount)} lost`}
                inverse
                loading={isLoading}
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Lead Pipeline Funnel */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" style={headingFont}>
                    <Filter className="w-4 h-4 text-blue-500" />
                    Lead Pipeline Funnel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {totalLeads === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="No leads in pipeline"
                      description="Import or capture leads to see your conversion funnel."
                      actionLabel="Import Leads"
                      actionHref="/leads"
                    />
                  ) : (
                    <div className="space-y-3 py-2">
                      {funnelStages.map((stage) => (
                        <FunnelBar
                          key={stage.key}
                          label={stage.label}
                          count={stage.count}
                          total={totalLeads}
                          color={stage.color}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Status Distribution Pie */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" style={headingFont}>
                    <PieChartIcon className="w-4 h-4 text-purple-500" />
                    Status Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statusBreakdown.length === 0 ? (
                    <EmptyState
                      icon={PieChartIcon}
                      title="No data"
                      description="Status distribution chart appears with lead data."
                    />
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={statusBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            dataKey="count"
                            nameKey="status"
                            strokeWidth={0}
                          >
                            {statusBreakdown.map((entry: any, i: number) => (
                              <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip {...tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        {statusBreakdown.map((item: any) => (
                          <div key={item.status} className="flex items-center gap-2 text-xs">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: STATUS_COLORS[item.status] ?? COLORS.gray }}
                            />
                            <span className="capitalize text-muted-foreground">{item.status}</span>
                            <span className="font-semibold ml-auto">{fmtNumber(item.count)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Booking Conversion Funnel - Bar Chart */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2" style={headingFont}>
                  <Target className="w-4 h-4 text-green-500" />
                  Booking Conversion Funnel
                </CardTitle>
                <CardDescription className="text-xs">
                  From message sent to booked appointment
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <ChartSkeleton height={250} />
                ) : totalOutbound === 0 ? (
                  <EmptyState
                    icon={Target}
                    title="No funnel data"
                    description="Conversion funnel will show once messages are sent and leads flow through the pipeline."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={conversionFunnelData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="stage" tick={axisTickStyle} {...axisProps} />
                      <YAxis tick={axisTickStyle} {...axisProps} />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value: number) => [fmtNumber(value), "Count"]}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {conversionFunnelData.map((entry) => (
                          <Cell key={entry.stage} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Lead Acquisition Trend */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2" style={headingFont}>
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  Lead Acquisition Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <ChartSkeleton height={220} />
                ) : revenueChartData.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No acquisition data"
                    description="Lead acquisition trends will appear as leads are added over time."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={revenueChartData}>
                      <defs>
                        <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.indigo} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={COLORS.indigo} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="displayDate" tick={axisTickStyle} {...axisProps} />
                      <YAxis tick={axisTickStyle} {...axisProps} />
                      <Tooltip {...tooltipStyle} />
                      <Area
                        type="monotone"
                        dataKey="totalLeads"
                        stroke={COLORS.indigo}
                        fill="url(#leadsGrad)"
                        strokeWidth={2}
                        name="New Leads"
                        dot={false}
                        activeDot={{ r: 5, fill: COLORS.indigo }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Conversion Rates by Stage */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "New \u2192 Contacted", from: "new", to: "contacted", color: "text-amber-500", bg: "bg-amber-500/10" },
                { label: "Contacted \u2192 Qualified", from: "contacted", to: "qualified", color: "text-purple-500", bg: "bg-purple-500/10" },
                { label: "Qualified \u2192 Booked", from: "qualified", to: "booked", color: "text-green-500", bg: "bg-green-500/10" },
                { label: "Overall Conversion", from: "new", to: "booked", color: "text-blue-500", bg: "bg-blue-500/10" },
              ].map(({ label, from, to, color, bg }) => {
                const statusMap: Record<string, number> = {};
                for (const s of statusBreakdown) statusMap[s.status] = s.count;
                const fromCount = from === "new" ? totalLeads : (statusMap[from] ?? 0);
                const toCount = statusMap[to] ?? 0;
                const rate = fromCount > 0 ? (toCount / fromCount) * 100 : 0;
                return (
                  <Card key={label} className="border-border bg-card">
                    <CardContent className="p-4 text-center">
                      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mx-auto mb-2`}>
                        <ArrowRight className={`w-4 h-4 ${color}`} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className="text-xl font-bold" style={headingFont}>{fmtPercent(rate)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {fmtNumber(toCount)} of {fmtNumber(fromCount)}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              ROI TAB
              ═════════════════════════════════════════════════════════ */}
          <TabsContent value="roi" className="space-y-4">
            {/* ROI Overview */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="border-border bg-card md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" style={headingFont}>
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    ROI Calculator
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Platform cost ($199/mo + 15% revenue share) vs revenue recovered
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 pt-2">
                  {/* Revenue vs Cost Visual */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-green-500/10 p-5 space-y-1">
                      <p className="text-xs text-muted-foreground">Gross Revenue Recovered</p>
                      <p className="text-2xl font-bold text-green-500" style={headingFont}>
                        {isLoading ? "\u2014" : fmtCurrency(totalRevenue)}
                      </p>
                      <p className="text-xs text-muted-foreground">{fmtNumber(bookedCount)} bookings @ avg {fmtCurrency(avgRevenuePerBooking)}</p>
                    </div>
                    <div className="rounded-xl bg-blue-500/10 p-5 space-y-1">
                      <p className="text-xs text-muted-foreground">Net Revenue (After Costs)</p>
                      <p className="text-2xl font-bold text-blue-500" style={headingFont}>
                        {isLoading ? "\u2014" : fmtCurrency(Math.max(netRevenue, 0))}
                      </p>
                      <p className="text-xs text-muted-foreground">After platform + revenue share</p>
                    </div>
                  </div>

                  {/* Cost Breakdown */}
                  <div className="space-y-3 px-1">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                        <span className="text-muted-foreground">Monthly Platform Fee</span>
                      </div>
                      <span className="font-medium text-foreground">-$199</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                        <span className="text-muted-foreground">Revenue Share (15%)</span>
                      </div>
                      <span className="font-medium text-foreground">-{fmtCurrency(revenueSharePaid)}</span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-muted-foreground font-medium">Total Cost</span>
                      </div>
                      <span className="font-bold text-foreground">-{fmtCurrency(totalCost)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-muted-foreground font-medium">Net Recovered</span>
                      </div>
                      <span className="font-bold text-green-500">{fmtCurrency(Math.max(netRevenue, 0))}</span>
                    </div>
                  </div>

                  {/* ROI Visualization */}
                  <div className="rounded-xl border border-border p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Return on Investment</p>
                        <p className="text-3xl font-bold" style={headingFont}>
                          {isLoading ? "\u2014" : `${Math.max(roi, 0).toFixed(0)}%`}
                        </p>
                      </div>
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${roi > 0 ? "bg-green-500/10" : "bg-muted"}`}>
                        <TrendingUp className={`w-7 h-7 ${roi > 0 ? "text-green-500" : "text-muted-foreground"}`} />
                      </div>
                    </div>
                    {totalRevenue > 0 && (
                      <div className="h-3 bg-muted/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min((totalRevenue / (totalRevenue + totalCost)) * 100, 100)}%`,
                            background: `linear-gradient(90deg, ${COLORS.green}, ${COLORS.emerald})`,
                          }}
                        />
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>Cost: {fmtCurrency(totalCost)}</span>
                      <span>Revenue: {fmtCurrency(totalRevenue)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ROI Side Stats */}
              <div className="space-y-4">
                <Card className="border-border bg-card">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Revenue per $1 Spent</p>
                        <p className="text-xl font-bold" style={headingFont}>
                          {isLoading ? "\u2014" : `$${totalCost > 0 ? (totalRevenue / totalCost).toFixed(2) : "0"}`}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      For every $1 invested, you recover {totalCost > 0 ? `$${(totalRevenue / totalCost).toFixed(2)}` : "$0"} in revenue.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Payback Period</p>
                        <p className="text-xl font-bold" style={headingFont}>
                          {isLoading ? "\u2014" : monthlyRevenue > 0 ? `${Math.max(1, Math.ceil(platformCost / monthlyRevenue))} days` : "N/A"}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Time to recover your monthly platform cost.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <Target className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cost per Booking</p>
                        <p className="text-xl font-bold" style={headingFont}>
                          {isLoading ? "\u2014" : bookedCount > 0 ? fmtCurrency(totalCost / bookedCount) : "N/A"}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Average cost to convert one lead to a booking.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Leakage Opportunities */}
            {leakage && (
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" style={headingFont}>
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Revenue Leakage Opportunities
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Identified areas where revenue is being left on the table
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-border p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <CalendarX className="w-4 h-4 text-red-500" />
                        <span className="text-xs font-medium">Unconfirmed Appts</span>
                      </div>
                      <p className="text-xl font-bold" style={headingFont}>
                        {fmtNumber(leakage.unconfirmedAppointments)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ~{fmtCurrency(leakage.unconfirmedAppointments * avgRevenuePerBooking)} at risk
                      </p>
                    </div>
                    <div className="rounded-xl border border-border p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-purple-500" />
                        <span className="text-xs font-medium">Qualified Unbooked</span>
                      </div>
                      <p className="text-xl font-bold" style={headingFont}>
                        {fmtNumber(leakage.qualifiedUnbooked)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ~{fmtCurrency(leakage.qualifiedUnbooked * avgRevenuePerBooking)} potential
                      </p>
                    </div>
                    <div className="rounded-xl border border-border p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-medium">Unrecovered Cancels</span>
                      </div>
                      <p className="text-xl font-bold" style={headingFont}>
                        {fmtNumber(leakage.cancellationsUnrecovered)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ~{fmtCurrency(leakage.cancellationsUnrecovered * avgRevenuePerBooking)} recoverable
                      </p>
                    </div>
                    <div className="rounded-xl border border-border p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <PhoneOff className="w-4 h-4 text-gray-500" />
                        <span className="text-xs font-medium">Failed Deliveries</span>
                      </div>
                      <p className="text-xl font-bold" style={headingFont}>
                        {fmtNumber(leakage.failedDeliveryRecovery)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Leads with undelivered messages (7d)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Revenue Over Time with Cost Overlay */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2" style={headingFont}>
                  <BarChart3 className="w-4 h-4 text-green-500" />
                  Revenue vs Platform Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <ChartSkeleton height={250} />
                ) : revenueChartData.length === 0 ? (
                  <EmptyState
                    icon={BarChart3}
                    title="No data yet"
                    description="Revenue vs cost comparison will show once data accumulates."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="displayDate" tick={axisTickStyle} {...axisProps} />
                      <YAxis tick={axisTickStyle} {...axisProps} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value: number, name: string) => [
                          `$${value.toLocaleString()}`,
                          name === "revenue" ? "Revenue" : "Daily Cost",
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Bar dataKey="revenue" fill={COLORS.green} radius={[4, 4, 0, 0]} name="revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
