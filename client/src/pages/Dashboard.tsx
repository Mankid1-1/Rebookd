import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  Bot,
  MessageSquare,
  TrendingUp,
  Users,
  Zap,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Plus,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Send,
  Eye,
  Target,
  Sparkles,
  Clock,
  XCircle,
  ShieldAlert,
  UserX,
  CalendarX,
  Activity,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { RevenueDashboard } from "@/components/analytics/RevenueDashboard";
import { RevenueLeakageDashboard } from "@/components/analytics/RevenueLeakageDashboard";
import { useLocale } from "@/contexts/LocaleContext";

// ─── Helpers ────────────────────────────────────────────────────────────────

const SPACE_GROTESK: React.CSSProperties = { fontFamily: "'Space Grotesk', sans-serif" };

const fmt = (n: number) => n.toLocaleString("en-US");
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
const fmtPct = (n: number) => `${Math.round(n * 10) / 10}%`;

function TrendBadge({
  value,
  inverse = false,
  suffix = "%",
}: {
  value: number;
  inverse?: boolean;
  suffix?: string;
}) {
  if (value === 0) return null;
  const isPositive = inverse ? value <= 0 : value >= 0;
  const color = isPositive ? "text-emerald-500" : "text-red-500";
  const bg = isPositive ? "bg-emerald-500/10" : "bg-red-500/10";
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-md ${color} ${bg}`}
    >
      <Icon className="w-3 h-3" />
      {Math.abs(Math.round(value * 10) / 10)}
      {suffix}
    </span>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-muted/40 ${className}`}
    />
  );
}

function StatCardSkeleton() {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <Skeleton className="w-12 h-5 rounded-md" />
        </div>
        <Skeleton className="w-20 h-8 mb-2" />
        <Skeleton className="w-16 h-3" />
      </CardContent>
    </Card>
  );
}

function HeroSkeleton() {
  return (
    <Card className="border-border bg-gradient-to-br from-primary/5 via-background to-primary/5 overflow-hidden relative">
      <CardContent className="p-6 md:p-8">
        <Skeleton className="w-48 h-5 mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="w-24 h-3 mb-2" />
              <Skeleton className="w-32 h-10 mb-1" />
              <Skeleton className="w-16 h-4" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const getDynamicStatusColors = () => {
  const isDarkMode =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  return {
    new: isDarkMode ? "#60a5fa" : "#3b82f6",
    contacted: isDarkMode ? "#fbbf24" : "#eab308",
    qualified: isDarkMode ? "#c084fc" : "#a855f7",
    booked: isDarkMode ? "#34d399" : "#22c55e",
    lost: isDarkMode ? "#f87171" : "#ef4444",
    unsubscribed: isDarkMode ? "#9ca3af" : "#6b7280",
  } as Record<string, string>;
};

type TimePeriod = "today" | "7d" | "30d" | "90d";
const PERIOD_LABEL_KEYS: Record<TimePeriod, string> = {
  today: "dashboard.today",
  "7d": "dashboard.7days",
  "30d": "dashboard.30days",
  "90d": "dashboard.90days",
};
const PERIOD_DAYS: Record<TimePeriod, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { t, formatCurrency: fmtCurrencyLocale } = useLocale();

  // ── State ───────────────────────────────────────────────────────────────
  const [period, setPeriod] = useState<TimePeriod>("30d");
  const [activeTab, setActiveTab] = useState("overview");
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLead, setNewLead] = useState({ phone: "", name: "" });
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data, isLoading } = trpc.analytics.dashboard.useQuery(
    { days: PERIOD_DAYS[period] },
    { retry: false, refetchInterval: 30_000 }
  );
  const { data: tenant } = trpc.tenant.get.useQuery(undefined, {
    retry: false,
  });
  const { data: leakageReport, isLoading: leakageLoading } =
    trpc.analytics.revenueLeakage.useQuery(
      { days: 90 },
      { retry: false, refetchInterval: 60_000 }
    );

  // ── Mutations ───────────────────────────────────────────────────────────
  const createRecoveryCampaign = trpc.analytics.createRecoveryCampaign.useMutation({
    onSuccess: () => toast.success("Recovery campaign created successfully"),
    onError: (err: any) => toast.error(err.message),
  });
  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success("Lead added");
      setShowAddLead(false);
      setNewLead({ phone: "", name: "" });
      utils.analytics.dashboard.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ── Redirect if no tenant ──────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && user && !tenant) setLocation("/onboarding");
  }, [isLoading, user, tenant, setLocation]);

  // ── Derived metrics ─────────────────────────────────────────────────────
  const metrics = data?.metrics;
  const statusBreakdown = data?.statusBreakdown ?? [];
  const messageVolume = data?.messageVolume ?? [];
  const recentMessages = (data as any)?.recentMessages ?? [];
  const revenueMetrics = data?.revenueMetrics as any;
  const revenueTrends = data?.revenueTrends ?? [];
  const leakage = data?.leakage;

  const totalLeads = metrics?.leadCount ?? 0;
  const totalMessages = metrics?.messageCount ?? 0;
  const automationCount = metrics?.automationCount ?? 0;
  const bookedCount = metrics?.bookedCount ?? 0;

  const recoveredRevenue =
    revenueMetrics?.totalRecoveredRevenue ?? revenueMetrics?.totalRecovered ?? 0;
  const recentRecoveredRevenue = revenueMetrics?.recentRecoveredRevenue ?? 0;
  const recoveryRate =
    revenueMetrics?.overallRecoveryRate ??
    (bookedCount && totalLeads
      ? Math.round((bookedCount / totalLeads) * 100)
      : 0);
  const recentRecoveryRate = revenueMetrics?.recentRecoveryRate ?? 0;
  const activeCampaigns = revenueMetrics?.activeCampaigns ?? automationCount;
  const monthlyRecoveryEstimate =
    revenueMetrics?.monthlyEstimate ??
    revenueMetrics?.recentRecoveredRevenue ??
    0;

  const bookingRate =
    totalLeads > 0 ? Math.round((bookedCount / totalLeads) * 100) : 0;
  const noShowRate =
    revenueMetrics?.noShowRate ??
    (leakageReport as any)?.noShowRate ??
    0;

  // Compute trend: compare recent recovery rate to overall
  const recoveryTrendDelta =
    recentRecoveryRate && recoveryRate
      ? Math.round((recentRecoveryRate - recoveryRate) * 10) / 10
      : 0;

  // ── Chart data ──────────────────────────────────────────────────────────
  const statusColors = getDynamicStatusColors();

  const chartData = useMemo(() => {
    const map: Record<string, { date: string; outbound: number; inbound: number }> = {};
    for (const row of messageVolume) {
      const date = row.date as string;
      if (!map[date]) map[date] = { date, outbound: 0, inbound: 0 };
      if (row.direction === "outbound") map[date].outbound = Number(row.count);
      else map[date].inbound = Number(row.count);
    }
    return Object.values(map);
  }, [messageVolume]);

  const revenueChartData = useMemo(() => {
    if (!revenueTrends || revenueTrends.length === 0) return [];
    let cumulative = 0;
    return (revenueTrends as any[]).map((row) => {
      cumulative += Number(row.revenue ?? 0);
      return {
        date: row.date,
        revenue: Number(row.revenue ?? 0),
        cumulative,
        bookings: Number(row.bookings ?? 0),
      };
    });
  }, [revenueTrends]);

  // Pipeline funnel
  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of statusBreakdown) counts[item.status] = Number(item.count);
    return {
      new: counts["new"] ?? 0,
      contacted: counts["contacted"] ?? 0,
      qualified: counts["qualified"] ?? 0,
      booked: counts["booked"] ?? 0,
    };
  }, [statusBreakdown]);
  const pipelineTotal = pipelineCounts.new + pipelineCounts.contacted + pipelineCounts.qualified + pipelineCounts.booked;

  // ── Onboarding ──────────────────────────────────────────────────────────
  const showOnboarding = totalLeads < 3 && !onboardingDismissed && !isLoading;
  const onboardingSteps = [
    {
      label: t('dashboard.addFirstLead'),
      done: totalLeads > 0,
      action: () => setShowAddLead(true),
      cta: t('dashboard.addLead'),
    },
    {
      label: t('dashboard.sendFirstMessage'),
      done: totalMessages > 0,
      action: () => setLocation("/leads"),
      cta: t('dashboard.goToLeads'),
    },
    {
      label: t('dashboard.enableAutomation'),
      done: automationCount > 0,
      action: () => setLocation("/automations"),
      cta: t('dashboard.setUp'),
    },
    {
      label: t('dashboard.connectStripe'),
      done: !!(tenant as any)?.stripeConnected || recoveredRevenue > 0,
      action: () => setLocation("/settings"),
      cta: t('dashboard.connect'),
    },
  ];
  const onboardingProgress = Math.round(
    (onboardingSteps.filter((s) => s.done).length / onboardingSteps.length) * 100
  );

  // ── Leakage alerts ──────────────────────────────────────────────────────
  const leakageAlerts = useMemo(() => {
    if (!leakage) return [];
    const alerts: Array<{
      title: string;
      description: string;
      count: number;
      icon: typeof AlertTriangle;
      color: string;
      bg: string;
      action: () => void;
      actionLabel: string;
    }> = [];
    if (leakage.unconfirmedAppointments > 0) {
      alerts.push({
        title: t('dashboard.unconfirmedAppointments'),
        description: `${leakage.unconfirmedAppointments} upcoming appointments need confirmation`,
        count: leakage.unconfirmedAppointments,
        icon: CalendarX,
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        action: () => setLocation("/no-show-recovery"),
        actionLabel: t('dashboard.sendReminders'),
      });
    }
    if (leakage.qualifiedUnbooked > 0) {
      alerts.push({
        title: t('dashboard.qualifiedUnbooked'),
        description: `${leakage.qualifiedUnbooked} qualified leads haven't booked yet`,
        count: leakage.qualifiedUnbooked,
        icon: UserX,
        color: "text-purple-400",
        bg: "bg-purple-500/10",
        action: () => setLocation("/booking-conversion"),
        actionLabel: t('dashboard.followUp'),
      });
    }
    if (leakage.cancellationsUnrecovered > 0) {
      alerts.push({
        title: t('dashboard.unrecoveredCancellations'),
        description: `${leakage.cancellationsUnrecovered} cancellations could be re-engaged`,
        count: leakage.cancellationsUnrecovered,
        icon: ShieldAlert,
        color: "text-red-400",
        bg: "bg-red-500/10",
        action: () =>
          createRecoveryCampaign.mutate({
            leakageType: "cancellation",
            priority: "medium",
          }),
        actionLabel: t('dashboard.recover'),
      });
    }
    if (leakage.failedDeliveryRecovery > 0) {
      alerts.push({
        title: t('dashboard.failedDelivery'),
        description: `${leakage.failedDeliveryRecovery} leads with delivery failures this week`,
        count: leakage.failedDeliveryRecovery,
        icon: XCircle,
        color: "text-orange-400",
        bg: "bg-orange-500/10",
        action: () => setLocation("/leads"),
        actionLabel: t('dashboard.review'),
      });
    }
    return alerts;
  }, [leakage, setLocation, createRecoveryCampaign]);

  // ── Stat cards ──────────────────────────────────────────────────────────
  const statCards = [
    {
      title: t('dashboard.revenueRecovered'),
      value: fmtCurrency(recoveredRevenue),
      icon: DollarSign,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      trend: recentRecoveredRevenue > 0 && recoveredRevenue > recentRecoveredRevenue
        ? Math.round((recentRecoveredRevenue / Math.max(1, recoveredRevenue - recentRecoveredRevenue)) * 100)
        : undefined,
      sub: recoveredRevenue > 0 ? t('dashboard.lifetimeTotal') : t('dashboard.noRevenueYet'),
      action: () => setActiveTab("revenue"),
    },
    {
      title: t('dashboard.recoveryRate'),
      value: fmtPct(recoveryRate),
      icon: Target,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      trend: recoveryTrendDelta !== 0 ? recoveryTrendDelta : undefined,
      sub: recoveryRate > 0 ? t('dashboard.leadsToBookings') : t('dashboard.startConverting'),
      action: () => setActiveTab("revenue"),
    },
    {
      title: t('dashboard.appointmentsBooked'),
      value: fmt(bookedCount),
      icon: Calendar,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      trend: undefined,
      sub: totalLeads > 0 ? `${bookingRate}% ${t('dashboard.conversion')}` : t('dashboard.noLeadsYet'),
      action: () => setLocation("/analytics"),
    },
    {
      title: t('dashboard.noShowRate'),
      value: fmtPct(noShowRate),
      icon: AlertTriangle,
      color: noShowRate <= 15 ? "text-emerald-400" : "text-red-400",
      bg: noShowRate <= 15 ? "bg-emerald-500/10" : "bg-red-500/10",
      trend: undefined,
      trendInverse: true,
      sub: noShowRate === 0 ? t('dashboard.noData') : noShowRate <= 15 ? t('dashboard.lookingGood') : t('dashboard.needsAttention'),
      action: () => setActiveTab("leakage"),
    },
    {
      title: t('dashboard.messagesSent'),
      value: fmt(totalMessages),
      icon: MessageSquare,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      trend: undefined,
      sub: totalMessages > 0 ? t('dashboard.totalMessages') : t('dashboard.noneSent'),
      action: () => setLocation("/inbox"),
    },
    {
      title: t('dashboard.activeAutomations'),
      value: fmt(automationCount),
      icon: Bot,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      trend: undefined,
      sub: automationCount > 0 ? `${automationCount} ${t('dashboard.running')}` : t('dashboard.noneActive'),
      action: () => setLocation("/automations"),
    },
  ];

  // ── Quick actions ───────────────────────────────────────────────────────
  const quickActions = [
    {
      label: t('dashboard.addLead'),
      icon: Plus,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      action: () => setShowAddLead(true),
    },
    {
      label: t('dashboard.sendCampaign'),
      icon: Send,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      action: () => setLocation("/automations"),
    },
    {
      label: t('dashboard.createAutomation'),
      icon: Zap,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      action: () => setLocation("/automations"),
    },
    {
      label: t('dashboard.viewAnalytics'),
      icon: Eye,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      action: () => setActiveTab("revenue"),
    },
  ];

  // ── Recovery action handler ─────────────────────────────────────────────
  const handleRecoveryAction = useCallback(
    async (actionType: string, _leadIds: number[]) => {
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
    },
    [createRecoveryCampaign]
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        {/* ── Header + Period Selector ───────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight"
              style={SPACE_GROTESK}
            >
              {tenant?.name || t('dashboard.title')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t('dashboard.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted/50 rounded-lg p-0.5 backdrop-blur-sm border border-border/50">
              {(Object.keys(PERIOD_LABEL_KEYS) as TimePeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                    period === p
                      ? "bg-background text-foreground shadow-sm border border-border/50"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(PERIOD_LABEL_KEYS[p] as any)}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddLead(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" /> {t('dashboard.addLead')}
            </Button>
          </div>
        </div>

        {/* ── Revenue Recovery Hero Banner ────────────────────────────────── */}
        {isLoading ? (
          <HeroSkeleton />
        ) : (
          <Card className="border-border/50 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-emerald-500/5 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
            <CardContent className="p-6 md:p-8 relative">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center backdrop-blur-sm">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  {t('dashboard.revenueRecovery')}
                </h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">
                    {t('dashboard.totalRecovered')}
                  </p>
                  <p
                    className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent"
                    style={SPACE_GROTESK}
                  >
                    {fmtCurrency(recoveredRevenue)}
                  </p>
                  {recentRecoveredRevenue > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {fmtCurrency(recentRecoveredRevenue)} {t('dashboard.last30Days')}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">
                    {t('dashboard.recoveryRate')}
                  </p>
                  <p
                    className="text-3xl md:text-4xl font-bold tracking-tight"
                    style={SPACE_GROTESK}
                  >
                    {fmtPct(recoveryRate)}
                  </p>
                  {recoveryTrendDelta !== 0 && (
                    <TrendBadge value={recoveryTrendDelta} suffix="% vs prior" />
                  )}
                  {recoveryTrendDelta === 0 && recoveryRate > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{t('dashboard.leadToBooking')}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">
                    {t('dashboard.activeCampaigns')}
                  </p>
                  <p
                    className="text-3xl md:text-4xl font-bold tracking-tight"
                    style={SPACE_GROTESK}
                  >
                    {fmt(activeCampaigns)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activeCampaigns > 0 ? t('dashboard.runningNow') : t('dashboard.noneActive')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">
                    {t('dashboard.monthlyEstimate')}
                  </p>
                  <p
                    className="text-3xl md:text-4xl font-bold tracking-tight"
                    style={SPACE_GROTESK}
                  >
                    {fmtCurrency(monthlyRecoveryEstimate)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('dashboard.projectedRecurring')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Onboarding Checklist (dismissible, only for new users) ────── */}
        {showOnboarding && (
          <Card className="border-border/50 bg-card relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/3 to-transparent pointer-events-none" />
            <CardContent className="p-6 md:p-8 relative">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3
                      className="text-lg font-semibold"
                      style={SPACE_GROTESK}
                    >
                      {t('dashboard.getStarted')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t('dashboard.completeSteps')}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground h-7"
                  onClick={() => setOnboardingDismissed(true)}
                >
                  {t('dashboard.dismiss')}
                </Button>
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{t('dashboard.progress')}</span>
                  <span>{onboardingProgress}% {t('dashboard.complete')}</span>
                </div>
                <Progress value={onboardingProgress} className="h-2" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {onboardingSteps.map((step) => (
                  <div
                    key={step.label}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      step.done
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : "bg-muted/20 border-border/50 hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {step.done ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                      )}
                      <span
                        className={`text-sm font-medium ${
                          step.done
                            ? "line-through text-muted-foreground"
                            : ""
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {!step.done && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs shrink-0 ml-3"
                        onClick={step.action}
                      >
                        {step.cta}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── KPI Stat Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))
            : statCards.map((stat) => (
                <Card
                  key={stat.title}
                  className="border-border/50 bg-card/80 backdrop-blur-sm cursor-pointer hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group"
                  onClick={stat.action}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                      >
                        <stat.icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                      {stat.trend !== undefined && (
                        <TrendBadge
                          value={stat.trend}
                          inverse={(stat as any).trendInverse}
                        />
                      )}
                    </div>
                    <p
                      className="text-2xl font-bold tracking-tight"
                      style={SPACE_GROTESK}
                    >
                      {stat.value}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      {stat.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">
                      {stat.sub}
                    </p>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* ── Revenue Leakage Alerts ──────────────────────────────────────── */}
        {leakageAlerts.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {leakageAlerts.map((alert) => (
              <Card
                key={alert.title}
                className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden relative group hover:border-primary/20 transition-all duration-300"
              >
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div
                      className={`w-8 h-8 rounded-lg ${alert.bg} flex items-center justify-center`}
                    >
                      <alert.icon className={`w-4 h-4 ${alert.color}`} />
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-5 font-mono"
                    >
                      {alert.count}
                    </Badge>
                  </div>
                  <h4 className="text-xs font-semibold mb-1">{alert.title}</h4>
                  <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
                    {alert.description}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={alert.action}
                    disabled={createRecoveryCampaign.isPending}
                  >
                    {alert.actionLabel}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Tabbed Content ─────────────────────────────────────────────── */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex bg-muted/50 backdrop-blur-sm">
            <TabsTrigger
              value="overview"
              className="flex items-center gap-2 data-[state=active]:shadow-sm"
            >
              <BarChart3 className="w-4 h-4" />
              {t('dashboard.overview')}
            </TabsTrigger>
            <TabsTrigger
              value="revenue"
              className="flex items-center gap-2 data-[state=active]:shadow-sm"
            >
              <DollarSign className="w-4 h-4" />
              {t('dashboard.revenueAnalytics')}
            </TabsTrigger>
            <TabsTrigger
              value="leakage"
              className="flex items-center gap-2 data-[state=active]:shadow-sm"
            >
              <AlertTriangle className="w-4 h-4" />
              {t('dashboard.revenueLeakage')}
            </TabsTrigger>
          </TabsList>

          {/* ── Overview Tab ──────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-6">
            {/* Revenue Recovery Timeline + Lead Status */}
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Revenue Recovery Timeline Chart */}
              <Card className="lg:col-span-2 border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      {t('dashboard.revenueTimeline')}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary" />{" "}
                        {t('dashboard.daily')}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />{" "}
                        {t('dashboard.cumulative')}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="w-full h-56" />
                  ) : revenueChartData.length === 0 ? (
                    <div className="h-56 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      <DollarSign className="w-10 h-10 opacity-20" />
                      <p className="text-sm">
                        {t('dashboard.noRevenueData')}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAddLead(true)}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> {t('dashboard.addYourFirstLead')}
                      </Button>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={revenueChartData}>
                        <defs>
                          <linearGradient
                            id="revenueGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="hsl(var(--primary))"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="hsl(var(--primary))"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="cumulativeGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#34d399"
                              stopOpacity={0.2}
                            />
                            <stop
                              offset="95%"
                              stopColor="#34d399"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                          vertical={false}
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => {
                            const d = new Date(v);
                            return `${d.getMonth() + 1}/${d.getDate()}`;
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `$${v}`}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "10px",
                            fontSize: "12px",
                            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                          formatter={(value: number, name: string) => [
                            fmtCurrency(value),
                            name === "cumulative"
                              ? "Total"
                              : "Daily Revenue",
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="hsl(var(--primary))"
                          fill="url(#revenueGrad)"
                          strokeWidth={2}
                          name="revenue"
                          dot={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="cumulative"
                          stroke="#34d399"
                          fill="url(#cumulativeGrad)"
                          strokeWidth={2}
                          name="cumulative"
                          dot={false}
                          strokeDasharray="4 4"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Lead Status Breakdown */}
              <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" /> {t('dashboard.leadStatus')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="w-full h-[160px] rounded-full mx-auto" />
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="w-full h-5" />
                      ))}
                    </div>
                  ) : statusBreakdown.length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
                      {t('dashboard.noLeadsYetShort')}
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie
                            data={statusBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            dataKey="count"
                            nameKey="status"
                            paddingAngle={2}
                            strokeWidth={0}
                          >
                            {statusBreakdown.map((entry: any) => (
                              <Cell
                                key={entry.status}
                                fill={
                                  statusColors[entry.status] ?? "#6b7280"
                                }
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">
                        {statusBreakdown.map((item: any) => (
                          <div
                            key={item.status}
                            className="flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{
                                  background:
                                    statusColors[item.status] ?? "#6b7280",
                                }}
                              />
                              <span className="capitalize text-muted-foreground">
                                {item.status}
                              </span>
                            </div>
                            <span className="font-medium tabular-nums">
                              {item.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Message Volume Chart */}
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    {t('dashboard.messageVolume')}
                  </CardTitle>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary" />{" "}
                      {t('dashboard.outbound')}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />{" "}
                      {t('dashboard.inbound')}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="w-full h-48" />
                ) : chartData.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <MessageSquare className="w-10 h-10 opacity-20" />
                    <p className="text-sm">{t('dashboard.noMessagesYet')}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddLead(true)}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> {t('dashboard.addYourFirstLead')}
                    </Button>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient
                          id="outboundGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="inboundGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#34d399"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#34d399"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
                        opacity={0.5}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => {
                          const d = new Date(v);
                          return `${d.getMonth() + 1}/${d.getDate()}`;
                        }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "10px",
                          fontSize: "12px",
                          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="outbound"
                        stroke="hsl(var(--primary))"
                        fill="url(#outboundGrad)"
                        strokeWidth={2}
                        name="Outbound"
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="inbound"
                        stroke="#34d399"
                        fill="url(#inboundGrad)"
                        strokeWidth={2}
                        name="Inbound"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Lead Pipeline Funnel */}
            {totalLeads > 0 && (
              <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> {t('dashboard.pipeline')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-stretch gap-2 md:gap-3">
                    {(
                      ["new", "contacted", "qualified", "booked"] as const
                    ).map((stage, i) => {
                      const count = pipelineCounts[stage];
                      const pct =
                        pipelineTotal > 0
                          ? Math.round((count / pipelineTotal) * 100)
                          : 0;
                      const stageColors = {
                        new: {
                          bg: "bg-blue-500/10",
                          border: "border-blue-500/20",
                          text: "text-blue-400",
                          bar: "bg-blue-500/30",
                        },
                        contacted: {
                          bg: "bg-amber-500/10",
                          border: "border-amber-500/20",
                          text: "text-amber-400",
                          bar: "bg-amber-500/30",
                        },
                        qualified: {
                          bg: "bg-purple-500/10",
                          border: "border-purple-500/20",
                          text: "text-purple-400",
                          bar: "bg-purple-500/30",
                        },
                        booked: {
                          bg: "bg-emerald-500/10",
                          border: "border-emerald-500/20",
                          text: "text-emerald-400",
                          bar: "bg-emerald-500/30",
                        },
                      };
                      const c = stageColors[stage];
                      return (
                        <div
                          key={stage}
                          className="flex-1 flex flex-col items-center gap-1"
                        >
                          <div
                            className={`w-full rounded-xl border ${c.bg} ${c.border} p-3 md:p-4 text-center transition-all hover:scale-[1.02] relative overflow-hidden`}
                          >
                            <div
                              className={`absolute bottom-0 left-0 w-full ${c.bar} transition-all duration-500`}
                              style={{ height: `${Math.max(pct, 5)}%` }}
                            />
                            <div className="relative">
                              <p
                                className="text-2xl md:text-3xl font-bold"
                                style={SPACE_GROTESK}
                              >
                                {fmt(count)}
                              </p>
                              <p
                                className={`text-xs font-medium capitalize mt-1 ${c.text}`}
                              >
                                {stage}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {pct}%
                              </p>
                            </div>
                          </div>
                          {i < 3 && (
                            <ArrowRight className="w-4 h-4 text-muted-foreground/40 hidden md:block" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions + Recent Activity */}
            <div className="grid lg:grid-cols-5 gap-4">
              {/* Quick Actions */}
              <Card className="lg:col-span-2 border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" /> {t('dashboard.quickActions')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {quickActions.map((qa) => (
                      <button
                        key={qa.label}
                        onClick={qa.action}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/20 hover:bg-muted/40 border border-transparent hover:border-primary/20 transition-all duration-200 group"
                      >
                        <div
                          className={`w-10 h-10 rounded-xl ${qa.bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}
                        >
                          <qa.icon className={`w-5 h-5 ${qa.color}`} />
                        </div>
                        <span className="text-xs font-medium">{qa.label}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity Feed */}
              <Card className="lg:col-span-3 border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Recent Activity
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setLocation("/leads")}
                  >
                    View all <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="w-full h-14 rounded-lg" />
                      ))}
                    </div>
                  ) : recentMessages.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground text-sm">
                      <MessageSquare className="w-8 h-8 opacity-20 mx-auto mb-2" />
                      No activity yet. Add a lead and send your first message.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
                      {recentMessages
                        .slice(0, 5)
                        .map(
                          (
                            item: { msg: any; lead: any },
                            i: number
                          ) => (
                            <div
                              key={i}
                              className="flex items-start gap-3 p-3 rounded-lg bg-muted/10 hover:bg-muted/30 transition-colors cursor-pointer group border border-transparent hover:border-border/50"
                              onClick={() =>
                                setLocation(
                                  `/leads/${item.lead?.id}` as any
                                )
                              }
                            >
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                  item.msg?.direction === "outbound"
                                    ? "bg-primary/10"
                                    : "bg-emerald-500/10"
                                }`}
                              >
                                {item.msg?.direction === "outbound" ? (
                                  <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
                                ) : (
                                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-xs font-medium group-hover:text-primary transition-colors">
                                    {item.lead?.name || item.lead?.phone}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground tabular-nums">
                                    {item.msg?.createdAt
                                      ? new Date(
                                          item.msg.createdAt
                                        ).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          hour: "numeric",
                                          minute: "2-digit",
                                        })
                                      : ""}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                  {item.msg?.body}
                                </p>
                              </div>
                            </div>
                          )
                        )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Revenue Analytics Tab ──────────────────────────────────────── */}
          <TabsContent value="revenue" className="space-y-6">
            {revenueMetrics ? (
              <RevenueDashboard
                revenueMetrics={revenueMetrics}
                revenueTrends={revenueTrends as any}
                isLoading={isLoading}
              />
            ) : (
              <Card className="border-border/50 bg-card">
                <CardContent className="p-10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                    <DollarSign className="w-8 h-8 text-primary" />
                  </div>
                  <h3
                    className="text-lg font-semibold mb-2"
                    style={SPACE_GROTESK}
                  >
                    Revenue Analytics Coming Soon
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Start converting leads and booking appointments to see
                    detailed revenue recovery metrics and trends.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-5"
                    onClick={() => setShowAddLead(true)}
                  >
                    <Plus className="w-4 h-4 mr-1.5" /> Add your first lead
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Revenue Leakage Tab ───────────────────────────────────────── */}
          <TabsContent value="leakage" className="space-y-6">
            {leakageReport ? (
              <RevenueLeakageDashboard
                leakageReport={leakageReport as any}
                isLoading={leakageLoading}
                onRecoveryAction={handleRecoveryAction}
              />
            ) : (
              <Card className="border-border/50 bg-card">
                <CardContent className="p-10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-5">
                    <AlertTriangle className="w-8 h-8 text-amber-500" />
                  </div>
                  <h3
                    className="text-lg font-semibold mb-2"
                    style={SPACE_GROTESK}
                  >
                    Revenue Leakage Detection
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Analyzing your appointment data to identify revenue leakage
                    opportunities and recovery strategies.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Add Lead Dialog ────────────────────────────────────────────── */}
        <Dialog open={showAddLead} onOpenChange={setShowAddLead}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle style={SPACE_GROTESK}>{t('dashboard.addLead')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>
                  {t('dashboard.phone')}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="+1 (555) 000-0000"
                  value={newLead.phone}
                  onChange={(e) =>
                    setNewLead((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {t('dashboard.name')}{" "}
                </Label>
                <Input
                  placeholder="Jane Smith"
                  value={newLead.name}
                  onChange={(e) =>
                    setNewLead((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAddLead(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  className="flex-1"
                  disabled={!newLead.phone || createLead.isPending}
                  onClick={() =>
                    createLead.mutate({
                      phone: newLead.phone,
                      name: newLead.name || null,
                    })
                  }
                >
                  {createLead.isPending ? "..." : t('dashboard.addLead')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
