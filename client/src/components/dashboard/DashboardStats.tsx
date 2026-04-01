/**
 * 📊 DASHBOARD STATS COMPONENTS
 * Mobile-responsive dashboard statistics cards
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import {
  Users,
  DollarSign,
  MessageSquare,
  Target,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Activity,
  Clock,
  Phone,
  Zap,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  loading?: boolean;
  titleTooltip?: string;
}

export function StatCard({ title, value, subtitle, icon, trend, loading, titleTooltip }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {titleTooltip ? (
            <HelpTooltip content={titleTooltip} variant="info">{title}</HelpTooltip>
          ) : title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 bg-muted rounded animate-pulse"></div>
            <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center mt-2 text-xs">
                {trend.direction === 'up' ? (
                  <ArrowUp className="h-3 w-3 text-success mr-1" />
                ) : (
                  <ArrowDown className="h-3 w-3 text-destructive mr-1" />
                )}
                <span className={trend.direction === 'up' ? 'text-success' : 'text-destructive'}>
                  {Math.abs(trend.value)}%
                </span>
                <span className="text-muted-foreground ml-1">vs last period</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface QuickStatsProps {
  stats: {
    totalLeads: number;
    bookedLeads: number;
    totalRevenue: number;
    recoveredRevenue: number;
    totalMessages: number;
    messagesDelivered: number;
    conversionRate: number;
    todayLeads: number;
    todayMessages: number;
  };
  loading?: boolean;
}

export function QuickStats({ stats, loading }: QuickStatsProps) {
  const calculatePercentage = (value: number, total: number) => {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Leads"
        value={loading ? "..." : stats.totalLeads.toLocaleString()}
        subtitle={!loading && `${stats.bookedLeads} booked (${calculatePercentage(stats.bookedLeads, stats.totalLeads)}%)`}
        icon={<Users className="h-4 w-4" />}
        loading={loading}
      />

      <StatCard
        title="Revenue"
        titleTooltip="Total revenue tracked plus recovered revenue from automated SMS follow-ups"
        value={loading ? "..." : formatCurrency(stats.totalRevenue)}
        subtitle={!loading && `${formatCurrency(stats.recoveredRevenue)} recovered`}
        icon={<DollarSign className="h-4 w-4" />}
        loading={loading}
      />

      <StatCard
        title="Messages"
        titleTooltip="Total SMS messages sent. Delivered count excludes failed or undelivered messages."
        value={loading ? "..." : stats.totalMessages.toLocaleString()}
        subtitle={!loading && `${stats.messagesDelivered} delivered`}
        icon={<MessageSquare className="h-4 w-4" />}
        loading={loading}
      />

      <StatCard
        title="Conversion Rate"
        titleTooltip="Percentage of leads that converted to a confirmed booking"
        value={loading ? "..." : `${stats.conversionRate}%`}
        subtitle="Lead to booking conversion"
        icon={<Target className="h-4 w-4" />}
        loading={loading}
      />
    </div>
  );
}

interface RealTimeStatsProps {
  stats: {
    leadsToday: number;
    messagesToday: number;
  };
  lastUpdated: Date;
  loading?: boolean;
}

export function RealTimeStats({ stats, lastUpdated, loading }: RealTimeStatsProps) {
  return (
    <Card className="border-l-4 border-l-info bg-gradient-to-r from-info/10 to-transparent">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-info" />
            <span className="text-sm font-medium text-foreground">Live Activity</span>
            <Badge variant="secondary" className="text-xs">
              Real-time
            </Badge>
          </div>
          
          {loading ? (
            <div className="flex items-center gap-6 text-sm">
              <div className="h-4 w-16 bg-muted rounded animate-pulse"></div>
              <div className="h-4 w-16 bg-muted rounded animate-pulse"></div>
              <div className="h-4 w-20 bg-muted rounded animate-pulse"></div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{stats.leadsToday}</span>
                <span className="text-muted-foreground">leads today</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{stats.messagesToday}</span>
                <span className="text-muted-foreground">messages today</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface PerformanceMetricsProps {
  metrics: {
    avgResponseTime: number;
    bookingRate: number;
    revenuePerLead: number;
    satisfactionScore: number;
  };
  loading?: boolean;
}

export function PerformanceMetrics({ metrics, loading }: PerformanceMetricsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Avg Response Time"
        titleTooltip="Average minutes between a lead contacting you and the first automated SMS reply going out"
        value={loading ? "..." : `${metrics.avgResponseTime}m`}
        subtitle="Time to first response"
        icon={<Clock className="h-4 w-4" />}
        loading={loading}
      />

      <StatCard
        title="Booking Rate"
        titleTooltip="Percentage of qualified leads that completed a booking after receiving an automated message"
        value={loading ? "..." : `${metrics.bookingRate}%`}
        subtitle="Of qualified leads"
        icon={<Target className="h-4 w-4" />}
        loading={loading}
      />

      <StatCard
        title="Revenue per Lead"
        titleTooltip="Average recovered revenue generated per lead contact, including bookings and re-engagements"
        value={loading ? "..." : formatCurrency(metrics.revenuePerLead)}
        subtitle="Average value"
        icon={<DollarSign className="h-4 w-4" />}
        loading={loading}
      />

      <StatCard
        title="Satisfaction"
        titleTooltip="Average customer satisfaction score collected via post-visit review request automations"
        value={loading ? "..." : `${metrics.satisfactionScore}/5`}
        subtitle="Customer rating"
        icon={<TrendingUp className="h-4 w-4" />}
        loading={loading}
      />
    </div>
  );
}

interface MobileQuickActionsProps {
  onAddLead: () => void;
  onSendMessage: () => void;
  onViewAnalytics: () => void;
  onSettings: () => void;
}

export function MobileQuickActions({ onAddLead, onSendMessage, onViewAnalytics, onSettings }: MobileQuickActionsProps) {
  return (
    <Card className="md:hidden">
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onAddLead}
            className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Users className="h-6 w-6 text-info mb-2" />
            <span className="text-sm font-medium">Add Lead</span>
          </button>

          <button
            onClick={onSendMessage}
            className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <MessageSquare className="h-6 w-6 text-success mb-2" />
            <span className="text-sm font-medium">Send SMS</span>
          </button>

          <button
            onClick={onViewAnalytics}
            className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <TrendingUp className="h-6 w-6 text-accent-foreground mb-2" />
            <span className="text-sm font-medium">Analytics</span>
          </button>

          <button
            onClick={onSettings}
            className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Zap className="h-6 w-6 text-warning mb-2" />
            <span className="text-sm font-medium">Settings</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
