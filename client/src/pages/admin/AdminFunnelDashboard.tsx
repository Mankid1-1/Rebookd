import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Filter, TrendingDown, Users, Mail, Globe, Loader2 } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface FunnelStep {
  eventName: string;
  count: number | string;
}

interface TrafficSource {
  source: string;
  medium: string;
  count: number | string;
}

interface EmailStat {
  source: string;
  status: string;
  count: number | string;
}

interface DailyTrendPoint {
  date: string;
  count: number | string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FUNNEL_ORDER = [
  "page_view_landing",
  "cta_click_hero",
  "signup_started",
  "signup_completed",
  "onboarding_completed",
  "first_automation_enabled",
  "first_recovery_sent",
] as const;

const FUNNEL_LABELS: Record<string, string> = {
  page_view_landing: "Landing Page View",
  cta_click_hero: "Hero CTA Click",
  signup_started: "Signup Started",
  signup_completed: "Signup Completed",
  onboarding_completed: "Onboarding Completed",
  first_automation_enabled: "First Automation Enabled",
  first_recovery_sent: "First Recovery Sent",
};

const PERIOD_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

// ─── Funnel Visualization ───────────────────────────────────────────────────

function FunnelVisualization({ steps }: { steps: FunnelStep[] }) {
  const countMap = new Map<string, number>();
  for (const step of steps) {
    countMap.set(String(step.eventName), Number(step.count));
  }

  const orderedSteps = FUNNEL_ORDER.map((key) => ({
    key,
    label: FUNNEL_LABELS[key] ?? key,
    count: countMap.get(key) ?? 0,
  }));

  const maxCount = Math.max(...orderedSteps.map((s) => s.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Conversion Funnel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {orderedSteps.map((step, i) => {
            const widthPct = Math.max((step.count / maxCount) * 100, 4);
            const prevCount = i > 0 ? orderedSteps[i - 1].count : null;
            const conversionRate =
              prevCount != null && prevCount > 0
                ? ((step.count / prevCount) * 100).toFixed(1)
                : null;

            return (
              <div key={step.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{step.label}</span>
                  <div className="flex items-center gap-3">
                    {conversionRate !== null && (
                      <span className="text-xs text-muted-foreground">
                        {conversionRate}% from prev
                      </span>
                    )}
                    <span className="font-semibold tabular-nums">{step.count.toLocaleString()}</span>
                  </div>
                </div>
                <div className="h-8 w-full rounded bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded bg-primary transition-all duration-500"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                {i < orderedSteps.length - 1 && (
                  <div className="flex justify-center">
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Overall conversion */}
        {orderedSteps[0].count > 0 && (
          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground">Overall Conversion</p>
            <p className="text-2xl font-bold text-primary">
              {((orderedSteps[orderedSteps.length - 1].count / orderedSteps[0].count) * 100).toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground">
              {orderedSteps[0].count.toLocaleString()} visitors &rarr;{" "}
              {orderedSteps[orderedSteps.length - 1].count.toLocaleString()} recoveries
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Traffic Sources Table ──────────────────────────────────────────────────

function TrafficSourcesTable({ sources }: { sources: TrafficSource[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Traffic Sources
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No traffic data yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-muted-foreground">Source</th>
                  <th className="pb-2 font-medium text-muted-foreground">Medium</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 font-medium">{String(s.source)}</td>
                    <td className="py-2 text-muted-foreground">{String(s.medium)}</td>
                    <td className="py-2 text-right tabular-nums font-semibold">
                      {Number(s.count).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Email Capture Stats ────────────────────────────────────────────────────

function EmailCaptureStats({ stats }: { stats: EmailStat[] }) {
  const total = stats.reduce((sum, s) => sum + Number(s.count), 0);

  // Group by source
  const bySource = new Map<string, number>();
  for (const s of stats) {
    const src = String(s.source ?? "unknown");
    bySource.set(src, (bySource.get(src) ?? 0) + Number(s.count));
  }

  // Group by status
  const byStatus = new Map<string, number>();
  for (const s of stats) {
    const st = String(s.status ?? "unknown");
    byStatus.set(st, (byStatus.get(st) ?? 0) + Number(s.count));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Capture
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center mb-4">
          <p className="text-3xl font-bold">{total.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">Total Subscribers</p>
        </div>

        {stats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No email data yet</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">By Source</p>
              <div className="space-y-1">
                {Array.from(bySource.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([src, count]) => (
                    <div key={src} className="flex justify-between text-sm">
                      <span>{src}</span>
                      <span className="font-semibold tabular-nums">{count.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">By Status</p>
              <div className="space-y-1">
                {Array.from(byStatus.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <div key={status} className="flex justify-between text-sm">
                      <span className="capitalize">{status}</span>
                      <span className="font-semibold tabular-nums">{count.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Daily Events Trend ─────────────────────────────────────────────────────

function DailyEventsTrend({ data }: { data: DailyTrendPoint[] }) {
  const chartData = data.map((d) => ({
    date: String(d.date).slice(5), // MM-DD
    count: Number(d.count),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Daily Funnel Events
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No event data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="funnelGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "13px",
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#funnelGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Period Selector ────────────────────────────────────────────────────────

function PeriodSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.days}
          onClick={() => onChange(opt.days)}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            value === opt.days
              ? "bg-primary text-primary-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export default function AdminFunnelDashboard() {
  const [days, setDays] = useState(30);

  const { data, isLoading, error } = trpc.admin.funnel.overview.useQuery(
    { days },
    { refetchInterval: 60_000 },
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Funnel Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Track visitor-to-recovery conversion across the entire funnel
            </p>
          </div>
          <PeriodSelector value={days} onChange={setDays} />
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-destructive font-medium">Failed to load funnel data</p>
              <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
            </CardContent>
          </Card>
        )}

        {/* Data */}
        {data && !isLoading && (
          <>
            {/* Top row: Funnel + Email stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <FunnelVisualization steps={data.funnelSteps as FunnelStep[]} />
              </div>
              <div>
                <EmailCaptureStats stats={data.emailStats as EmailStat[]} />
              </div>
            </div>

            {/* Bottom row: Trend chart + Traffic sources */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DailyEventsTrend data={data.dailyTrend as DailyTrendPoint[]} />
              <TrafficSourcesTable sources={data.sources as TrafficSource[]} />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
