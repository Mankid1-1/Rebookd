import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  AlertCircle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Calendar,
  PieChart as PieChartIcon,
  BarChart3,
} from "lucide-react";

interface RevenueMetrics {
  totalRecoveredRevenue: number;
  recentRecoveredRevenue: number;
  potentialRevenue: number;
  lostRevenue: number;
  pipelineRevenue: number;
  overallRecoveryRate: number;
  recentRecoveryRate: number;
  avgRevenuePerBooking: number;
  totalLeadsCount: number;
  bookedLeadsCount: number;
  qualifiedLeadsCount: number;
  contactedLeadsCount: number;
  lostLeadsCount: number;
  recentBookingsCount: number;
  recoveredLeadsCount: number;
}

interface RevenueTrend {
  date: string;
  bookings: number;
  revenue: number;
  totalLeads: number;
  recoveryRate: number;
}

interface RevenueDashboardProps {
  revenueMetrics: RevenueMetrics;
  revenueTrends: RevenueTrend[];
  isLoading?: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const MetricCard = ({ 
  title, 
  value, 
  subtitle, 
  trend, 
  icon: Icon, 
  color, 
  bgColor,
  helpText,
  isLoading = false 
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  helpText?: string;
  isLoading?: boolean;
}) => (
  <Card className="border-border bg-card hover:border-primary/10 transition-colors">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {helpText && (
              <HelpTooltip content={helpText} variant="info">
                <span />
              </HelpTooltip>
            )}
          </div>
          <p className="text-2xl font-bold">
            {isLoading ? "—" : value}
          </p>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
          {trend && !isLoading && (
            <div className="flex items-center gap-1 mt-2">
              {trend.isPositive ? (
                <ArrowUp className="h-3 w-3 text-green-500" />
              ) : (
                <ArrowDown className="h-3 w-3 text-red-500" />
              )}
              <span className={`text-xs font-medium ${
                trend.isPositive ? "text-green-500" : "text-red-500"
              }`}>
                {Math.abs(trend.value)}%
              </span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center ml-4`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

export function RevenueDashboard({ revenueMetrics, revenueTrends, isLoading }: RevenueDashboardProps) {
  // Calculate trends (mock data for now, would compare with previous period)
  const recoveryTrend = { value: 12.5, isPositive: true };
  const bookingTrend = { value: 8.3, isPositive: true };
  const pipelineTrend = { value: -2.1, isPositive: false };

  // Dynamic colors based on user theme
const getDynamicChartColors = () => {
  const isDarkMode = document.documentElement.classList.contains('dark');
  return {
    totalLeads: isDarkMode ? "#64748b" : "#94a3b8",
    contacted: isDarkMode ? "#2563eb" : "#3b82f6", 
    qualified: isDarkMode ? "#7c3aed" : "#8b5cf6",
    booked: isDarkMode ? "#16a34a" : "#22c55e",
    lost: isDarkMode ? "#dc2626" : "#ef4444",
    revenueGradient: isDarkMode ? "#16a34a" : "#22c55e"
  };
};

// Revenue funnel data
  const chartColors = getDynamicChartColors();
  const funnelData = [
    { stage: "Total Leads", count: revenueMetrics.totalLeadsCount, value: 0, color: chartColors.totalLeads },
    { stage: "Contacted", count: revenueMetrics.contactedLeadsCount, value: revenueMetrics.pipelineRevenue, color: chartColors.contacted },
    { stage: "Qualified", count: revenueMetrics.qualifiedLeadsCount, value: revenueMetrics.potentialRevenue, color: chartColors.qualified },
    { stage: "Booked", count: revenueMetrics.bookedLeadsCount, value: revenueMetrics.totalRecoveredRevenue, color: chartColors.booked },
  ].filter(item => item.count > 0);

  // Status breakdown for pie chart
  const statusData = [
    { name: "Booked", value: revenueMetrics.bookedLeadsCount, color: chartColors.booked },
    { name: "Qualified", value: revenueMetrics.qualifiedLeadsCount, color: chartColors.qualified },
    { name: "Contacted", value: revenueMetrics.contactedLeadsCount, color: chartColors.contacted },
    { name: "Lost", value: revenueMetrics.lostLeadsCount, color: chartColors.lost },
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            Revenue Recovery Dashboard
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Track your recovered revenue and conversion metrics
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          Last 90 days
        </Badge>
      </div>

      {/* Key Revenue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Recovered"
          value={formatCurrency(revenueMetrics.totalRecoveredRevenue)}
          subtitle={`${revenueMetrics.bookedLeadsCount} bookings`}
          trend={recoveryTrend}
          icon={DollarSign}
          color="text-green-500"
          bgColor="bg-green-500/10"
          helpText="Total revenue from all booked appointments"
          isLoading={isLoading}
        />
        
        <MetricCard
          title="This Month"
          value={formatCurrency(revenueMetrics.recentRecoveredRevenue)}
          subtitle={`${revenueMetrics.recentBookingsCount} bookings`}
          trend={bookingTrend}
          icon={Calendar}
          color="text-blue-500"
          bgColor="bg-blue-500/10"
          helpText="Revenue recovered in the last 30 days"
          isLoading={isLoading}
        />
        
        <MetricCard
          title="Potential Revenue"
          value={formatCurrency(revenueMetrics.potentialRevenue)}
          subtitle={`${revenueMetrics.qualifiedLeadsCount} qualified leads`}
          icon={Target}
          color="text-purple-500"
          bgColor="bg-purple-500/10"
          helpText="Estimated revenue from qualified leads"
          isLoading={isLoading}
        />
        
        <MetricCard
          title="Pipeline Value"
          value={formatCurrency(revenueMetrics.pipelineRevenue)}
          subtitle={`${revenueMetrics.contactedLeadsCount} in pipeline`}
          trend={pipelineTrend}
          icon={Users}
          color="text-orange-500"
          bgColor="bg-orange-500/10"
          helpText="Estimated value of leads currently in your pipeline"
          isLoading={isLoading}
        />
      </div>

      {/* Recovery Rate & Lost Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Recovery Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold text-green-500">
                  {formatPercent(revenueMetrics.overallRecoveryRate)}
                </div>
                <div className="text-sm text-muted-foreground">Overall Rate</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {revenueMetrics.bookedLeadsCount} of {revenueMetrics.totalLeadsCount} leads
                </div>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold text-blue-500">
                  ${revenueMetrics.avgRevenuePerBooking}
                </div>
                <div className="text-sm text-muted-foreground">Avg per Booking</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Estimated average revenue
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  Lost Revenue
                </span>
              </div>
              <span className="text-lg font-bold text-red-600 dark:text-red-400">
                {formatCurrency(revenueMetrics.lostRevenue)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-primary" />
              Lead Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No lead data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value} leads`,
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-muted-foreground">{item.name}:</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trends Chart */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Revenue Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          {revenueTrends.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No revenue data available for the selected period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueTrends.slice(-30)}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.revenueGradient} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartColors.revenueGradient} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "revenue") return [formatCurrency(value), "Revenue"];
                    if (name === "bookings") return [value, "Bookings"];
                    if (name === "recoveryRate") return [formatPercent(value), "Recovery Rate"];
                    return [value, name];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={chartColors.revenueGradient}
                  strokeWidth={2}
                  fill="url(#revenueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Conversion Funnel */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {funnelData.map((stage, index) => {
              const widthPercent = revenueMetrics.totalLeadsCount > 0 
                ? (stage.count / revenueMetrics.totalLeadsCount) * 100 
                : 0;
              
              return (
                <div key={stage.stage} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{stage.stage}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{stage.count} leads</span>
                      {stage.value > 0 && (
                        <span className="font-semibold">{formatCurrency(stage.value)}</span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor: stage.color,
                      }}
                    >
                      {widthPercent > 10 && (
                        <span className="text-xs text-white font-medium">
                          {formatPercent(widthPercent)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
