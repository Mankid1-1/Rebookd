/**
 * 📊 ANALYTICS CHARTS COMPONENTS
 * Mobile-responsive analytics charts and visualizations
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  LineChart, Line, Legend,
} from "recharts";
import { format, subDays } from "date-fns";
import { TrendingUp, TrendingDown, DollarSign, Users, MessageSquare } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// Dynamic colors based on user theme
const getDynamicChartColors = () => {
  const isDarkMode = document.documentElement.classList.contains('dark');
  return {
    status: {
      new: isDarkMode ? "#60a5fa" : "#3b82f6",
      contacted: isDarkMode ? "#fbbf24" : "#eab308",
      qualified: isDarkMode ? "#c084fc" : "#a855f7",
      booked: isDarkMode ? "#34d399" : "#22c55e",
      lost: isDarkMode ? "#f87171" : "#ef4444",
      pending: isDarkMode ? "#9ca3af" : "#6b7280",
    },
    chart: [isDarkMode ? "#60a5fa" : "#3b82f6", isDarkMode ? "#fbbf24" : "#eab308", isDarkMode ? "#34d399" : "#22c55e", isDarkMode ? "#f87171" : "#ef4444", isDarkMode ? "#c084fc" : "#a855f7", isDarkMode ? "#9ca3af" : "#6b7280"]
  };
};

interface RevenueChartProps {
  data: Array<{
    date: string;
    revenue: number;
    bookings: number;
  }>;
  loading?: boolean;
}

export function RevenueChart({ data, loading }: RevenueChartProps) {
  const colors = getDynamicChartColors();
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No revenue data available</p>
              <p className="text-sm mt-2">Start generating bookings to see revenue trends</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate trend
  const recentRevenue = data.slice(-7).reduce((sum, item) => sum + item.revenue, 0);
  const previousRevenue = data.slice(-14, -7).reduce((sum, item) => sum + item.revenue, 0);
  const trend = previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Revenue Trend</CardTitle>
          <div className="flex items-center mt-1">
            {trend > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            )}
            <span className={`text-sm ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {Math.abs(trend).toFixed(1)}% vs last week
            </span>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          {data.length} days
        </Badge>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => format(new Date(value), 'MMM dd')}
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              tickFormatter={(value) => `$${value}`}
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              labelFormatter={(value) => format(new Date(value as string), 'MMM dd, yyyy')}
              formatter={(value, name) => [
                name === 'revenue' ? formatCurrency(value as number) : value,
                name === 'revenue' ? 'Revenue' : 'Bookings'
              ]}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
              }}
            />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="#3b82f6" 
              fill="#3b82f6" 
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface LeadStatusChartProps {
  data: Array<{
    status: string;
    count: number;
  }>;
  loading?: boolean;
}

export function LeadStatusChart({ data, loading }: LeadStatusChartProps) {
  const colors = getDynamicChartColors();
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lead Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lead Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No lead data available</p>
              <p className="text-sm mt-2">Leads will appear here as they are generated</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Lead Status Distribution</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Total: {total.toLocaleString()} leads
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {data.length} statuses
        </Badge>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors.status[entry.status as keyof typeof colors.status] || colors.chart[index % colors.chart.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value) => [`${value} leads`, 'Count']}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          {data.map((item, index) => (
            <div key={item.status} className="flex items-center gap-2 text-xs">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: colors.status[item.status as keyof typeof colors.status] || colors.chart[index % colors.chart.length] }}
              ></div>
              <span className="capitalize">{item.status} ({item.count})</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface MessageVolumeChartProps {
  data: Array<{
    date: string;
    sent: number;
    received: number;
    delivered: number;
  }>;
  loading?: boolean;
}

export function MessageVolumeChart({ data, loading }: MessageVolumeChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Message Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Message Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No message data available</p>
              <p className="text-sm mt-2">Start sending messages to see volume trends</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Message Volume</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => format(new Date(value), 'MMM dd')}
              tick={{ fontSize: 12 }}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              labelFormatter={(value) => format(new Date(value as string), 'MMM dd, yyyy')}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
              }}
            />
            <Legend />
            <Bar dataKey="sent" fill="#3b82f6" name="Sent" />
            <Bar dataKey="received" fill="#22c55e" name="Received" />
            <Bar dataKey="delivered" fill="#eab308" name="Delivered" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface ConversionFunnelProps {
  data: Array<{
    stage: string;
    count: number;
    conversionRate: number;
  }>;
  loading?: boolean;
}

export function ConversionFunnel({ data, loading }: ConversionFunnelProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No conversion data available</p>
              <p className="text-sm mt-2">Lead conversion will appear here</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((stage, index) => {
            const maxCount = Math.max(...data.map(d => d.count));
            const widthPercentage = (stage.count / maxCount) * 100;
            
            return (
              <div key={stage.stage} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium capitalize">{stage.stage}</span>
                  <div className="text-right">
                    <span className="text-sm font-bold">{stage.count}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({stage.conversionRate.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${widthPercentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface MobileChartContainerProps {
  title: string;
  children: React.ReactNode;
  badge?: string;
  action?: React.ReactNode;
}

export function MobileChartContainer({ title, children, badge, action }: MobileChartContainerProps) {
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          {badge && <Badge variant="outline" className="text-xs">{badge}</Badge>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        <div className="px-6 pb-6 sm:px-0">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
