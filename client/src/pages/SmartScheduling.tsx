import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  Clock,
  TrendingUp,
  BarChart3,
  Settings,
  Zap,
  Target,
  Users,
  MessageSquare,
  CalendarCheck,
} from "lucide-react";
import { toast } from "sonner";

function MetricSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center">
          <Skeleton className="h-10 w-10 rounded-lg mr-3" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SmartScheduling() {
  const [config, setConfig] = useState({
    enabled: true,
    autoFill: true,
    gapDetectionSensitivity: "medium" as "low" | "medium" | "high",
    preferredTimeSlots: "9:00-17:00",
    gapThreshold: 30,
    utilizationTarget: 85,
  });

  const { data: dashData, isLoading } = trpc.analytics.dashboard.useQuery(undefined, { refetchInterval: 30000 });
  const metrics = dashData?.metrics;

  const { data: savedConfig } = trpc.featureConfig.get.useQuery(
    { feature: "smart_scheduling" },
    { retry: false }
  );
  const saveConfig = trpc.featureConfig.save.useMutation({
    onSuccess: () => toast.success("Smart scheduling configuration saved"),
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (savedConfig?.config) {
      setConfig((prev) => ({ ...prev, ...(savedConfig.config as any) }));
    }
  }, [savedConfig]);

  const handleSaveConfig = () => {
    saveConfig.mutate({ feature: "smart_scheduling", config: config as any });
  };

  const conversionRate = metrics?.leadCount
    ? Math.round((metrics.bookedCount / metrics.leadCount) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Smart Scheduling</h1>
            <p className="text-muted-foreground mt-1">
              Fill empty gaps in your schedule with intelligent detection and automated outreach
            </p>
          </div>
          <Button onClick={handleSaveConfig} disabled={saveConfig.isPending}>
            <Settings className="h-4 w-4 mr-2" />
            {saveConfig.isPending ? "Saving..." : "Save Configuration"}
          </Button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            <>
              <MetricSkeleton />
              <MetricSkeleton />
              <MetricSkeleton />
              <MetricSkeleton />
            </>
          ) : (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-500/10 rounded-lg mr-3">
                      <Users className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
                      <p className="text-2xl font-bold">{metrics?.leadCount ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-500/10 rounded-lg mr-3">
                      <MessageSquare className="h-6 w-6 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Messages Sent</p>
                      <p className="text-2xl font-bold">{metrics?.messageCount ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-500/10 rounded-lg mr-3">
                      <CalendarCheck className="h-6 w-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Booked</p>
                      <p className="text-2xl font-bold">{metrics?.bookedCount ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-orange-500/10 rounded-lg mr-3">
                      <TrendingUp className="h-6 w-6 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Optimization Rate</p>
                      <p className="text-2xl font-bold">{conversionRate}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Configuration + Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-muted-foreground" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="scheduling-enabled">Smart Scheduling</Label>
                  <p className="text-xs text-muted-foreground">Enable intelligent gap detection and auto-fill</p>
                </div>
                <Switch
                  id="scheduling-enabled"
                  checked={config.enabled}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, enabled: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-fill">Auto-Fill Gaps</Label>
                  <p className="text-xs text-muted-foreground">Automatically send offers to fill detected gaps</p>
                </div>
                <Switch
                  id="auto-fill"
                  checked={config.autoFill}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, autoFill: checked }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Preferred Time Slots</Label>
                <Input
                  value={config.preferredTimeSlots}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, preferredTimeSlots: e.target.value }))
                  }
                  placeholder="e.g. 9:00-12:00, 13:00-17:00"
                />
                <p className="text-xs text-muted-foreground">Comma-separated time ranges to prioritize</p>
              </div>

              <div className="space-y-2">
                <Label>Gap Detection Sensitivity</Label>
                <div className="flex gap-2">
                  {(["low", "medium", "high"] as const).map((level) => (
                    <Button
                      key={level}
                      variant={config.gapDetectionSensitivity === level ? "default" : "outline"}
                      size="sm"
                      className="flex-1 capitalize"
                      onClick={() =>
                        setConfig((prev) => ({ ...prev, gapDetectionSensitivity: level }))
                      }
                    >
                      {level}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Higher sensitivity detects smaller gaps
                </p>
              </div>

              <div className="space-y-2">
                <Label>Minimum Gap Threshold (minutes)</Label>
                <Input
                  type="number"
                  value={config.gapThreshold}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, gapThreshold: parseInt(e.target.value) || 30 }))
                  }
                  min={15}
                  max={120}
                />
              </div>

              <div className="space-y-2">
                <Label>Utilization Target (%)</Label>
                <Input
                  type="number"
                  value={config.utilizationTarget}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      utilizationTarget: parseInt(e.target.value) || 85,
                    }))
                  }
                  min={50}
                  max={100}
                />
              </div>
            </CardContent>
          </Card>

          {/* Schedule Visualization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                Schedule Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-7 gap-2">
                {["9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM"].map((time, index) => (
                  <div key={index} className="text-center p-2 bg-muted rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground">{time}</p>
                    <div className="w-full h-2 bg-muted-foreground/20 rounded mt-1.5 relative">
                      <div
                        className="h-2 bg-blue-500 rounded"
                        style={{
                          width: `${Math.min(100, Math.max(10, conversionRate + (index - 3) * 10))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-3">
                <h4 className="text-sm font-medium">Current Utilization</h4>
                <div className="flex items-center gap-3">
                  <Progress value={conversionRate} className="flex-1" />
                  <span className="text-sm font-semibold tabular-nums">{conversionRate}%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Target: {config.utilizationTarget}%
                </p>
              </div>

              {/* Gap Analysis - Empty State */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Detected Gaps</h4>
                {metrics?.leadCount === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="p-3 bg-muted rounded-full mb-3">
                      <Target className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No gaps detected</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Connect your calendar to start detecting schedule gaps
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="p-3 bg-green-500/10 rounded-full mb-3">
                      <CalendarCheck className="h-6 w-6 text-green-400" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {metrics?.bookedCount ?? 0} slots filled from {metrics?.leadCount ?? 0} leads
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {metrics?.messageCount ?? 0} messages sent to fill gaps
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                <Calendar className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-400">{metrics?.leadCount ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total Leads</p>
              </div>
              <div className="text-center p-4 bg-green-500/10 rounded-lg">
                <Zap className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-400">{metrics?.bookedCount ?? 0}</p>
                <p className="text-sm text-muted-foreground">Booked</p>
              </div>
              <div className="text-center p-4 bg-purple-500/10 rounded-lg">
                <TrendingUp className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-purple-400">{conversionRate}%</p>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
