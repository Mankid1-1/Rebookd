import DashboardLayout from "@/components/layout/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpTooltip, HelpIcon } from "@/components/ui/HelpTooltip";
import {
  Users,
  Clock,
  Bell,
  CheckCircle,
  AlertTriangle,
  Zap,
  Target,
  ListOrdered,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import "@/styles/components.css";

export default function WaitingList() {
  const [activeTab, setActiveTab] = useState("overview");
  const [config, setConfig] = useState({
    waitingListEnabled: true,
    maxWaitlistSize: 50,
    autoNotifyOnCancel: true,
    cancellationFlurryEnabled: true,
    flurryMessageLimit: 5,
    priorityByBookingHistory: true,
    expirationHours: 48,
    autoRemoveBooked: true,
  });

  const { data: metrics, isLoading } = trpc.analytics.waitingListMetrics.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const { data: settings } = trpc.tenant.settings.useQuery(undefined, { retry: false });
  const updateConfig = trpc.tenant.updateWaitingListConfig.useMutation({
    onSuccess: () => toast.success("Waiting list configuration updated"),
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (settings?.waitingListConfig) {
      setConfig(settings.waitingListConfig as any);
    }
  }, [settings]);

  const handleSaveConfig = () => {
    updateConfig.mutate(config);
  };

  if (isLoading) return <DashboardLayout>Loading...</DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">Waiting List</h1>
              <HelpIcon content={{ basic: "When someone cancels, people on this list get notified automatically", intermediate: "Waiting list management — automatically text waitlisted clients when slots open from cancellations", advanced: "Cancellation flurry automation: monitors calendar for cancellations, then sends batch SMS to waiting_list entries ordered by priority and created_at" }} />
            </div>
            <p className="text-muted-foreground mt-2">
              Manage your waiting lists and cancellation flurry notifications to fill last-minute openings
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveConfig}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
          </div>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-primary/10 rounded-lg mr-3">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Waitlist Size</p>
                  <p className="text-2xl font-bold">{metrics?.activeWaitlistSize || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-success/10 rounded-lg mr-3">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground"><HelpTooltip content="Number of appointment slots filled by clients pulled from your waiting list" variant="info">Filled from Waitlist</HelpTooltip></p>
                  <p className="text-2xl font-bold">{metrics?.filledFromWaitlist || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-accent/10 rounded-lg mr-3">
                  <Zap className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground"><HelpTooltip content="Times Rebooked sent a mass SMS to multiple waitlisted clients when a slot opened up" variant="info">Cancellation Flurries Sent</HelpTooltip></p>
                  <p className="text-2xl font-bold">{metrics?.cancellationFlurriesSent || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-warning/10 rounded-lg mr-3">
                  <Target className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground"><HelpTooltip content="Percentage of opened slots that were successfully filled from your waiting list" variant="info">Fill Rate</HelpTooltip></p>
                  <p className="text-2xl font-bold">{metrics?.fillRate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="flurry">Cancellation Flurry</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Active Waiting List Summary
                    <HelpIcon content={{ basic: "People waiting for an appointment opening", intermediate: "Prioritized queue — highest priority contacts are notified first when spots open", advanced: "Entries in waiting_list table ordered by priority DESC, created_at ASC. Auto-expires after configurable hours" }} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="waiting-list-enabled">Waiting List Enabled</Label>
                    <Switch
                      id="waiting-list-enabled"
                      checked={config.waitingListEnabled}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({ ...prev, waitingListEnabled: checked }))
                      }
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">Total on waitlist</span>
                      <Badge variant="secondary">{metrics?.activeWaitlistSize || 0} clients</Badge>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">Filled this week</span>
                      <Badge variant="secondary">{metrics?.filledThisWeek || 0} slots</Badge>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">Avg. wait time</span>
                      <Badge variant="secondary">{metrics?.avgWaitTimeHours || 0}h</Badge>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Capacity utilization</span>
                      <Badge variant="outline">
                        {metrics?.activeWaitlistSize || 0} / {config.maxWaitlistSize}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 bg-primary/5 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <ListOrdered className="h-4 w-4" />
                      How It Works
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>Clients are added when their preferred slot is unavailable</li>
                      <li>When a cancellation occurs, waitlisted clients are notified</li>
                      <li>Priority is determined by booking history and signup order</li>
                      <li>Clients are automatically removed once booked or expired</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Waitlist Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {metrics?.recentActivity && metrics.recentActivity.length > 0 ? (
                    metrics.recentActivity.map((activity: { id: string; clientName: string; action: string; time: string; status: string }, index: number) => (
                      <div
                        key={activity.id || index}
                        className="flex items-center justify-between py-3 border-b last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-1.5 rounded-full ${
                              activity.action === "filled"
                                ? "bg-success/10"
                                : activity.action === "added"
                                  ? "bg-primary/10"
                                  : activity.action === "expired"
                                    ? "bg-warning/10"
                                    : "bg-muted"
                            }`}
                          >
                            {activity.action === "filled" ? (
                              <CheckCircle className="h-4 w-4 text-success" />
                            ) : activity.action === "added" ? (
                              <Users className="h-4 w-4 text-primary" />
                            ) : activity.action === "expired" ? (
                              <AlertTriangle className="h-4 w-4 text-warning" />
                            ) : (
                              <RefreshCw className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{activity.clientName}</p>
                            <p className="text-xs text-muted-foreground capitalize">{activity.action}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{activity.time}</p>
                          <Badge
                            variant={
                              activity.status === "completed"
                                ? "default"
                                : activity.status === "pending"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-xs"
                          >
                            {activity.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">No recent waitlist activity</p>
                      <p className="text-xs mt-1">Activity will appear here as clients join and get booked</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Cancellation Flurry Tab */}
          <TabsContent value="flurry" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Cancellation Flurry Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="flurry-enabled"><HelpTooltip content="When enabled, Rebooked automatically texts multiple waitlisted clients the moment a cancellation comes in, racing to fill the slot" variant="info">Enable Cancellation Flurry</HelpTooltip></Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Automatically notify waitlisted clients when a slot opens up
                      </p>
                    </div>
                    <Switch
                      id="flurry-enabled"
                      checked={config.cancellationFlurryEnabled}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({ ...prev, cancellationFlurryEnabled: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto-notify"><HelpTooltip content="Sends an immediate notification to the top waitlisted client when a slot opens up" variant="info">Auto-Notify on Cancellation</HelpTooltip></Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Send SMS immediately when a cancellation is detected
                      </p>
                    </div>
                    <Switch
                      id="auto-notify"
                      checked={config.autoNotifyOnCancel}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({ ...prev, autoNotifyOnCancel: checked }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label><HelpTooltip content="Maximum number of clients to contact per cancellation. Prevents overwhelming clients with messages." variant="info">Message Limit per Cancellation</HelpTooltip></Label>
                    <p className="text-xs text-muted-foreground">
                      Maximum number of clients to notify per cancellation event
                    </p>
                    <Input
                      type="number"
                      value={config.flurryMessageLimit}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          flurryMessageLimit: parseInt(e.target.value) || 1,
                        }))
                      }
                      min={1}
                      max={20}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="priority-history"><HelpTooltip content="Clients with more past bookings move higher in the waitlist queue — rewards loyalty" variant="info">Priority by Booking History</HelpTooltip></Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Prioritize loyal clients with more past bookings
                      </p>
                    </div>
                    <Switch
                      id="priority-history"
                      checked={config.priorityByBookingHistory}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({ ...prev, priorityByBookingHistory: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Flurry Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">Flurries sent (30d)</span>
                      <Badge variant="secondary">{metrics?.cancellationFlurriesSent || 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">Slots filled via flurry</span>
                      <Badge variant="secondary">{metrics?.filledViaFlurry || 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground"><HelpTooltip content="Average time between sending a flurry and receiving a booking confirmation" variant="info">Avg. response time</HelpTooltip></span>
                      <Badge variant="secondary">{metrics?.avgResponseTimeMinutes || 0} min</Badge>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground"><HelpTooltip content="Percentage of cancellation flurry campaigns that resulted in a filled slot" variant="info">Flurry fill rate</HelpTooltip></span>
                      <Badge variant="outline">{metrics?.flurryFillRate || 0}%</Badge>
                    </div>
                  </div>

                  <div className="p-4 bg-accent/5 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Cancellation Flurry
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>A cancellation triggers an instant SMS blast to top waitlisted clients</li>
                      <li>First to respond gets the slot -- no manual intervention needed</li>
                      <li>AI personalizes each message based on client history and preferences</li>
                      <li>Respects quiet hours and client communication preferences</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ListOrdered className="h-5 w-5" />
                    Waitlist Limits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label><HelpTooltip content="Cap on how many clients can join the waiting list at once" variant="info">Maximum Waitlist Size</HelpTooltip></Label>
                    <p className="text-xs text-muted-foreground">
                      The maximum number of clients that can be on the waiting list at once
                    </p>
                    <Input
                      type="number"
                      value={config.maxWaitlistSize}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          maxWaitlistSize: parseInt(e.target.value) || 1,
                        }))
                      }
                      min={1}
                      max={500}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label><HelpTooltip content="How long a client stays on the waitlist before being automatically removed if they haven't responded" variant="info">Expiration Time (hours)</HelpTooltip></Label>
                    <p className="text-xs text-muted-foreground">
                      How long a client stays on the waitlist before being automatically removed
                    </p>
                    <Input
                      type="number"
                      value={config.expirationHours}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          expirationHours: parseInt(e.target.value) || 1,
                        }))
                      }
                      min={1}
                      max={720}
                    />
                  </div>

                  <div className="p-4 bg-warning/5 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Capacity Tips
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>Keep your waitlist size manageable for better fill rates</li>
                      <li>Shorter expiration times keep the list fresh and relevant</li>
                      <li>Consider your cancellation frequency when setting limits</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" />
                    Automation Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto-remove"><HelpTooltip content="Automatically removes clients from the waitlist once they successfully book an appointment" variant="info">Auto-Remove Booked Clients</HelpTooltip></Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Automatically remove clients from the waitlist once they book an appointment
                      </p>
                    </div>
                    <Switch
                      id="auto-remove"
                      checked={config.autoRemoveBooked}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({ ...prev, autoRemoveBooked: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="waiting-list-toggle">Waiting List Active</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Master toggle for the entire waiting list feature
                      </p>
                    </div>
                    <Switch
                      id="waiting-list-toggle"
                      checked={config.waitingListEnabled}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({ ...prev, waitingListEnabled: checked }))
                      }
                    />
                  </div>

                  <div className="p-4 bg-success/5 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Optimization Tips
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>Enable auto-remove to keep your waitlist accurate</li>
                      <li>Use priority by booking history to reward loyal clients</li>
                      <li>Set a reasonable message limit to avoid overwhelming clients</li>
                      <li>Monitor your fill rate to optimize flurry settings</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
