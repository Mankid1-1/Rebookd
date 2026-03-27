import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock,
  Moon,
  Sun,
  MessageSquare,
  Users,
  Settings,
  CalendarCheck,
  TrendingUp,
  Link2,
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

export default function AfterHours() {
  const [config, setConfig] = useState({
    enabled: true,
    autoReplyTemplate:
      "Hi! Thanks for reaching out. We're currently closed but will get back to you first thing in the morning. In the meantime, you can book online:",
    bookingLink: "",
    businessHours: {
      start: "08:00",
      end: "18:00",
      timezone: "America/New_York",
    },
  });

  const { data: dashData, isLoading } = trpc.analytics.dashboard.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const metrics = dashData?.metrics;

  const { data: savedConfig } = trpc.featureConfig.get.useQuery(
    { feature: "after_hours" },
    { retry: false }
  );
  const saveConfig = trpc.featureConfig.save.useMutation({
    onSuccess: () => toast.success("After-hours configuration saved"),
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (savedConfig?.config) {
      setConfig((prev) => ({ ...prev, ...(savedConfig.config as any) }));
    }
  }, [savedConfig]);

  const handleSaveConfig = () => {
    saveConfig.mutate({ feature: "after_hours", config: config as any });
  };

  const conversionRate = metrics?.leadCount
    ? Math.round((metrics.bookedCount / metrics.leadCount) * 100)
    : 0;

  const isAfterHours = () => {
    const now = new Date();
    const { start, end, timezone } = config.businessHours;
    const [startHour, startMinute] = start.split(":").map(Number);
    const [endHour, endMinute] = end.split(":").map(Number);

    const currentTimeInTimezone = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);

    const [currentHour, currentMinute] = currentTimeInTimezone.split(":").map(Number);

    const currentDayInTimezone = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    }).format(now);

    const isWeekend = currentDayInTimezone === "Sat" || currentDayInTimezone === "Sun";
    const isBeforeStart =
      currentHour < startHour || (currentHour === startHour && currentMinute < startMinute);
    const isAfterEnd =
      currentHour >= endHour || (currentHour === endHour && currentMinute >= endMinute);

    return isWeekend || isBeforeStart || isAfterEnd;
  };

  const afterHoursActive = isAfterHours();

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">After-Hours Management</h1>
            <p className="text-muted-foreground mt-1">
              Capture leads 24/7 with instant auto-replies when your business is closed
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                afterHoursActive ? "bg-red-500/10" : "bg-green-500/10"
              }`}
            >
              {afterHoursActive ? (
                <Moon className="h-4 w-4 text-red-400" />
              ) : (
                <Sun className="h-4 w-4 text-green-400" />
              )}
              <span className="text-sm font-medium">
                {afterHoursActive ? "After Hours" : "Business Hours"}
              </span>
            </div>
            <Button onClick={handleSaveConfig} disabled={saveConfig.isPending}>
              <Settings className="h-4 w-4 mr-2" />
              {saveConfig.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
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
                      <p className="text-sm font-medium text-muted-foreground">After-Hours Leads</p>
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
                      <p className="text-sm font-medium text-muted-foreground">Auto-Replies Sent</p>
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
                      <p className="text-sm font-medium text-muted-foreground">Converted</p>
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
                      <p className="text-sm font-medium text-muted-foreground">Response Rate</p>
                      <p className="text-2xl font-bold">{conversionRate}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Configuration + Status */}
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
                  <Label htmlFor="after-hours-enabled">After-Hours Auto-Reply</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically respond to leads outside business hours
                  </p>
                </div>
                <Switch
                  id="after-hours-enabled"
                  checked={config.enabled}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, enabled: checked }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Auto-Reply Message Template</Label>
                <Textarea
                  value={config.autoReplyTemplate}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, autoReplyTemplate: e.target.value }))
                  }
                  rows={4}
                  placeholder="Enter the message to send when you're closed..."
                />
                <p className="text-xs text-muted-foreground">
                  This message is sent automatically to leads who contact you after hours
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  Booking Link
                </Label>
                <Input
                  value={config.bookingLink}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, bookingLink: e.target.value }))
                  }
                  placeholder="https://calendly.com/your-business"
                />
                <p className="text-xs text-muted-foreground">
                  Include in auto-replies so leads can self-book
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-start">Opens At</Label>
                  <Input
                    id="business-start"
                    type="time"
                    value={config.businessHours.start}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        businessHours: { ...prev.businessHours, start: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-end">Closes At</Label>
                  <Input
                    id="business-end"
                    type="time"
                    value={config.businessHours.end}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        businessHours: { ...prev.businessHours, end: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={config.businessHours.timezone}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      businessHours: { ...prev.businessHours, timezone: e.target.value },
                    }))
                  }
                  placeholder="America/New_York"
                />
              </div>
            </CardContent>
          </Card>

          {/* Status Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Current Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Live status indicator */}
              <div
                className={`p-4 rounded-lg text-center ${
                  afterHoursActive ? "bg-red-500/10" : "bg-green-500/10"
                }`}
              >
                {afterHoursActive ? (
                  <Moon className="h-10 w-10 text-red-400 mx-auto mb-2" />
                ) : (
                  <Sun className="h-10 w-10 text-green-400 mx-auto mb-2" />
                )}
                <p className="text-lg font-semibold">
                  {afterHoursActive ? "Currently Closed" : "Currently Open"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Business hours: {config.businessHours.start} - {config.businessHours.end}
                </p>
                <p className="text-xs text-muted-foreground">
                  {config.businessHours.timezone}
                </p>
              </div>

              {/* Business hours summary */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="text-sm font-medium">Schedule</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Monday - Friday: {config.businessHours.start} - {config.businessHours.end}</p>
                  <p>Saturday - Sunday: Closed</p>
                </div>
              </div>

              {/* Activity empty state or summary */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">After-Hours Activity</h4>
                {!metrics?.messageCount ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="p-3 bg-muted rounded-full mb-3">
                      <MessageSquare className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No activity yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-replies will appear here once leads contact you after hours
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{metrics.messageCount}</p>
                      <p className="text-xs text-muted-foreground">Messages Sent</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{metrics.bookedCount}</p>
                      <p className="text-xs text-muted-foreground">Converted</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Capture Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                <Users className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-400">{metrics?.leadCount ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total Leads</p>
              </div>
              <div className="text-center p-4 bg-purple-500/10 rounded-lg">
                <MessageSquare className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-purple-400">{metrics?.messageCount ?? 0}</p>
                <p className="text-sm text-muted-foreground">Auto-Replies</p>
              </div>
              <div className="text-center p-4 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-400">{conversionRate}%</p>
                <p className="text-sm text-muted-foreground">Response Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
