import * as React from "react";
import { useChartColors } from "@/hooks/useChartColors";
import { useLocale } from "@/contexts/LocaleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  AlertTriangle,
  TrendingDown,
  DollarSign,
  Target,
  Clock,
  Users,
  Calendar,
  Zap,
  ChevronRight,
  Play,
  Pause,
  Settings,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { 
  useDynamicLeakageDetection, 
  useDynamicRecoveryStrategies,
  useDynamicRecoveryProbability,
  useDynamicActionPrioritization,
  useDynamicRevenueImpact
} from "@/hooks/useDynamicRevenueRecovery";

interface LeakageDetection {
  id: string;
  type: "no_show" | "cancellation" | "last_minute" | "double_booking" | "underbooking" | "followup_missed";
  severity: "low" | "medium" | "high" | "critical";
  estimatedRevenue: number;
  recoveryProbability: number;
  description: string;
  affectedLeads: number;
  timeWindow: string;
  recoveryActions: string[];
}

interface RevenueLeakageReport {
  totalLeakage: number;
  recoverableRevenue: number;
  leakageByType: Record<string, number>;
  leakageByMonth: Array<{ month: string; leakage: number; recovered: number }>;
  topLeakageSources: LeakageDetection[];
  recoveryOpportunities: Array<{
    leadId: number;
    leadName: string;
    leadPhone: string;
    leakageType: string;
    estimatedRevenue: number;
    recoveryActions: string[];
    lastActivity: Date;
  }>;
  recommendations: Array<{
    category: "process" | "automation" | "staffing" | "technology";
    priority: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    expectedImpact: number;
    implementationEffort: "low" | "medium" | "high";
  }>;
}

interface RevenueLeakageDashboardProps {
  leakageReport: RevenueLeakageReport;
  isLoading?: boolean;
  onRecoveryAction?: (actionType: string, leadIds: number[]) => void;
}

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

// Colors are now derived from CSS custom properties via useChartColors() inside the component.

export function RevenueLeakageDashboard({
  leakageReport,
  isLoading = false,
  onRecoveryAction
}: RevenueLeakageDashboardProps) {
  const { formatCurrency } = useLocale();
  const cc = useChartColors();
  const colors = {
    leakage: {
      no_show: cc.chart5,
      cancellation: cc.chart4,
      last_minute: cc.danger,
      double_booking: cc.chart3,
      underbooking: cc.chart1,
      followup_missed: cc.info,
    } as Record<string, string>,
    severity: {
      low: cc.success,
      medium: cc.warning,
      high: cc.chart5,
      critical: cc.danger,
    } as Record<string, string>,
  };
  const LEAKAGE_COLORS = colors.leakage;
  const SEVERITY_COLORS = colors.severity;
  const [selectedLeakageType, setSelectedLeakageType] = React.useState<string | null>(null);
  const [expandedRecommendations, setExpandedRecommendations] = React.useState(false);
  
  // Dynamic hooks for user-adaptive revenue recovery
  const dynamicLeakageTypes = useDynamicLeakageDetection();
  const dynamicStrategies = useDynamicRecoveryStrategies();
  const getRecoveryProbability = useDynamicRecoveryProbability();
  const prioritizeActions = useDynamicActionPrioritization();
  const getRevenueImpact = useDynamicRevenueImpact();

  const recoveryRate = leakageReport.totalLeakage > 0 
    ? (leakageReport.recoverableRevenue / leakageReport.totalLeakage) * 100 
    : 0;

  const getSeverityIcon = (severity: string) => {
    const color = colors.severity[severity as keyof typeof colors.severity] || colors.severity.medium;
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-4 w-4" style={{ color }} />;
      case "high":
        return <AlertTriangle className="h-4 w-4" style={{ color }} />;
      case "medium":
        return <Clock className="h-4 w-4" style={{ color }} />;
      case "low":
        return <CheckCircle className="h-4 w-4" style={{ color }} />;
      default:
        return <AlertCircle className="h-4 w-4" style={{ color }} />;
    }
  };

  const getLeakageTypeLabel = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Revenue Leakage Detection
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Identify and recover lost revenue from appointment-based operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-1.5" />
            Export
          </Button>
          <Button size="sm" onClick={() => onRecoveryAction?.("bulk_recovery", [])}>
            <Zap className="w-4 h-4 mr-1.5" />
            Start Recovery
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Total Leakage</p>
                <p className="text-3xl font-bold text-destructive">
                  {isLoading ? "—" : formatCurrency(leakageReport.totalLeakage)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {leakageReport.topLeakageSources.length} sources detected
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Recoverable Revenue</p>
                <p className="text-3xl font-bold text-success">
                  {isLoading ? "—" : formatCurrency(leakageReport.recoverableRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPercent(recoveryRate)} recovery rate
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Affected Leads</p>
                <p className="text-3xl font-bold">
                  {isLoading ? "—" : leakageReport.recoveryOpportunities.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Recovery opportunities
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Top Issue</p>
                <p className="text-lg font-bold">
                  {isLoading ? "—" : getLeakageTypeLabel(leakageReport.topLeakageSources[0]?.type || "unknown")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {leakageReport.topLeakageSources[0]?.affectedLeads || 0} leads affected
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                {getSeverityIcon(leakageReport.topLeakageSources[0]?.severity || "medium")}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leakage Breakdown */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <PieChart className="w-5 h-5 text-primary" />
              Leakage by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(leakageReport.leakageByType).map(([type, value]) => ({
                      name: getLeakageTypeLabel(type),
                      value,
                      type
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {Object.entries(leakageReport.leakageByType).map(([type]) => (
                      <Cell key={type} fill={LEAKAGE_COLORS[type] || cc.muted} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {Object.entries(leakageReport.leakageByType)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([type, value]) => (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: LEAKAGE_COLORS[type] || cc.muted }} 
                      />
                      <span className="capitalize">{getLeakageTypeLabel(type)}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(value)}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <LineChart className="w-5 h-5 text-primary" />
              Monthly Leakage Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={leakageReport.leakageByMonth}>
                  <defs>
                    <linearGradient id="leakageGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={cc.danger} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={cc.danger} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="recoveredGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={cc.success} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={cc.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="leakage"
                    stroke={cc.danger}
                    fill="url(#leakageGrad)"
                    strokeWidth={2}
                    name="Leakage"
                  />
                  <Area
                    type="monotone"
                    dataKey="recovered"
                    stroke={cc.success}
                    fill="url(#recoveredGrad)"
                    strokeWidth={2}
                    name="Recovered"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Leakage Sources */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            Top Leakage Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {leakageReport.topLeakageSources.slice(0, 5).map((source, index) => (
              <div key={source.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{getLeakageTypeLabel(source.type)}</h4>
                      <Badge variant="outline" className={SEVERITY_COLORS[source.severity]}>
                        {source.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{source.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{source.affectedLeads} leads affected</span>
                      <span>{source.timeWindow}</span>
                      <span>Recovery: {formatPercent(source.recoveryProbability)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-destructive">{formatCurrency(source.estimatedRevenue)}</p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-2"
                    onClick={() => onRecoveryAction?.("targeted_recovery", [source.id.toString()])}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Recover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recovery Opportunities */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Recovery Opportunities
          </CardTitle>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onRecoveryAction?.("bulk_recovery", leakageReport.recoveryOpportunities.map(o => o.leadId))}
          >
            <Zap className="w-3 h-3 mr-1" />
            Recover All
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {leakageReport.recoveryOpportunities.slice(0, 10).map((opportunity) => (
              <div key={opportunity.leadId} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Users className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="font-medium">{opportunity.leadName}</h4>
                    <p className="text-sm text-muted-foreground">{opportunity.leadPhone}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{getLeakageTypeLabel(opportunity.leakageType)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Last activity: {new Date(opportunity.lastActivity).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-success">{formatCurrency(opportunity.estimatedRevenue)}</p>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onRecoveryAction?.("individual_recovery", [opportunity.leadId])}
                  >
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Recommendations
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setExpandedRecommendations(!expandedRecommendations)}
            >
              {expandedRecommendations ? "Show Less" : "Show All"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {leakageReport.recommendations
              .slice(0, expandedRecommendations ? undefined : 3)
              .map((rec, index) => (
                <div key={index} className="flex items-start gap-3 p-4 border border-border rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-xs font-medium">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{rec.title}</h4>
                      <Badge variant="outline" className={SEVERITY_COLORS[rec.priority]}>
                        {rec.priority.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">
                        {rec.category.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Impact: {formatCurrency(rec.expectedImpact)}</span>
                      <span>Effort: {rec.implementationEffort}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
