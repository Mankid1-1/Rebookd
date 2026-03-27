/**
 * 📊 DASHBOARD STATS COMPONENTS
 * Mobile-responsive dashboard statistics cards
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
}

export function StatCard({ title, value, subtitle, icon, trend, loading }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
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
                  <ArrowUp className="h-3 w-3 text-green-500 mr-1" />
                ) : (
                  <ArrowDown className="h-3 w-3 text-red-500 mr-1" />
                )}
                <span className={trend.direction === 'up' ? 'text-green-500' : 'text-red-500'}>
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
        value={loading ? "..." : formatCurrency(stats.totalRevenue)}
        subtitle={!loading && `${formatCurrency(stats.recoveredRevenue)} recovered`}
        icon={<DollarSign className="h-4 w-4" />}
        loading={loading}
      />
      
      <StatCard
        title="Messages"
        value={loading ? "..." : stats.totalMessages.toLocaleString()}
        subtitle={!loading && `${stats.messagesDelivered} delivered`}
        icon={<MessageSquare className="h-4 w-4" />}
        loading={loading}
      />
      
      <StatCard
        title="Conversion Rate"
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
    <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-transparent">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-900">Live Activity</span>
            <Badge variant="secondary" className="text-xs">
              Real-time
            </Badge>
          </div>
          
          {loading ? (
            <div className="flex items-center gap-6 text-sm">
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
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
        value={loading ? "..." : `${metrics.avgResponseTime}m`}
        subtitle="Time to first response"
        icon={<Clock className="h-4 w-4" />}
        loading={loading}
      />
      
      <StatCard
        title="Booking Rate"
        value={loading ? "..." : `${metrics.bookingRate}%`}
        subtitle="Of qualified leads"
        icon={<Target className="h-4 w-4" />}
        loading={loading}
      />
      
      <StatCard
        title="Revenue per Lead"
        value={loading ? "..." : formatCurrency(metrics.revenuePerLead)}
        subtitle="Average value"
        icon={<DollarSign className="h-4 w-4" />}
        loading={loading}
      />
      
      <StatCard
        title="Satisfaction"
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
            className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-muted/30 transition-colors"
          >
            <Users className="h-6 w-6 text-blue-500 mb-2" />
            <span className="text-sm font-medium">Add Lead</span>
          </button>

          <button
            onClick={onSendMessage}
            className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-muted/30 transition-colors"
          >
            <MessageSquare className="h-6 w-6 text-green-500 mb-2" />
            <span className="text-sm font-medium">Send SMS</span>
          </button>

          <button
            onClick={onViewAnalytics}
            className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-muted/30 transition-colors"
          >
            <TrendingUp className="h-6 w-6 text-purple-500 mb-2" />
            <span className="text-sm font-medium">Analytics</span>
          </button>

          <button
            onClick={onSettings}
            className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-muted/30 transition-colors"
          >
            <Zap className="h-6 w-6 text-orange-500 mb-2" />
            <span className="text-sm font-medium">Settings</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
