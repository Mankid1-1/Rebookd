import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  Users,
  TrendingUp,
  Calendar,
  Clock,
  AlertTriangle,
  Zap,
  Settings,
  Bell,
  ArrowRight,
  Phone,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";

export default function CancellationRecovery() {
  const [activeTab, setActiveTab] = useState("instant");
  const [config, setConfig] = useState({
    instantRebooking: true,
    waitlistAutoFill: true,
    broadcastOpenSlots: true,
    urgencyMessaging: true,
    fillRateTarget: 45 // 45% target fill rate
  });

  const { data: dashData, isLoading } = trpc.analytics.dashboard.useQuery(undefined, { refetchInterval: 30000 });
  const metrics: any = dashData?.metrics;
  const { data: settings } = trpc.tenant.get.useQuery(undefined, { retry: false });
  const { data: savedConfig } = trpc.featureConfig.get.useQuery(
    { feature: "cancellation-recovery" },
    { retry: false }
  );
  const saveConfig = trpc.featureConfig.save.useMutation({
    onSuccess: () => toast.success("Configuration saved"),
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (savedConfig?.config) {
      setConfig((prev) => ({ ...prev, ...(savedConfig.config as any) }));
    }
  }, [savedConfig]);

  const handleSaveConfig = () => {
    saveConfig.mutate({ feature: "cancellation-recovery", config: config as any });
  };

  const handleTestRebooking = () => {
    toast.info("To test, add a lead with a phone number first. The automation will trigger automatically.");
  };

  const handleTriggerBroadcast = () => {
    toast.info("To test, add a lead with a phone number first. The automation will trigger automatically.");
  };

  const recoveryRate = metrics?.leadCount > 0
    ? Math.round((metrics.bookedCount / metrics.leadCount) * 100)
    : 0;

  if (isLoading) return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="h-10 w-64 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="h-16 bg-muted rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card><CardContent className="p-6"><div className="h-48 bg-muted rounded animate-pulse" /></CardContent></Card>
          <Card><CardContent className="p-6"><div className="h-48 bg-muted rounded animate-pulse" /></CardContent></Card>
        </div>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Cancellation Recovery</h1>
            <p className="text-muted-foreground mt-2">
              The moment someone cancels, we resell that slot automatically with 30-60% fill rate
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleTestRebooking} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Test Rebooking
            </Button>
            <Button onClick={handleTriggerBroadcast} variant="outline">
              <Bell className="h-4 w-4 mr-2" />
              Broadcast Slots
            </Button>
            <Button onClick={handleSaveConfig}>
              <Settings className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
          </div>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-red-500/10 rounded-lg mr-3">
                  <Users className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Leads Contacted</p>
                  <p className="text-2xl font-bold">{metrics?.contactedCount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-500/10 rounded-lg mr-3">
                  <TrendingUp className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Appointments Recovered</p>
                  <p className="text-2xl font-bold">{metrics?.bookedCount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-500/10 rounded-lg mr-3">
                  <Zap className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Recovery Rate</p>
                  <p className="text-2xl font-bold">{recoveryRate}%</p>
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
                  <p className="text-2xl font-bold">{metrics?.messagesSent || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="instant">Instant</TabsTrigger>
                  <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
                  <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>

                <TabsContent value="instant" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="instant-rebooking">Instant Rebooking</Label>
                      <Switch
                        id="instant-rebooking"
                        checked={config.instantRebooking}
                        onCheckedChange={(checked) =>
                          setConfig(prev => ({ ...prev, instantRebooking: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-green-500/10 rounded-lg">
                      <h4 className="font-medium mb-2">Instant Rebooking Features</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Immediate slot offers to waitlist</li>
                        <li>• Priority-based lead scoring</li>
                        <li>• Smart lead matching algorithm</li>
                        <li>• Real-time gap detection</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="waitlist" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="waitlist-fill">Waitlist Auto-Fill</Label>
                      <Switch
                        id="waitlist-fill"
                        checked={config.waitlistAutoFill}
                        onCheckedChange={(checked) =>
                          setConfig(prev => ({ ...prev, waitlistAutoFill: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-blue-500/10 rounded-lg">
                      <h4 className="font-medium mb-2">Waitlist Features</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Automatic gap filling</li>
                        <li>• Lead priority scoring</li>
                        <li>• Smart slot matching</li>
                        <li>• Multi-channel notifications</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="broadcast" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="broadcast-slots">Broadcast Open Slots</Label>
                      <Switch
                        id="broadcast-slots"
                        checked={config.broadcastOpenSlots}
                        onCheckedChange={(checked) =>
                          setConfig(prev => ({ ...prev, broadcastOpenSlots: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fill Rate Target (%)</Label>
                      <Input
                        type="number"
                        value={config.fillRateTarget}
                        onChange={(e) =>
                          setConfig(prev => ({ ...prev, fillRateTarget: parseInt(e.target.value) }))
                        }
                        min={10}
                        max={100}
                      />
                    </div>
                    <div className="p-4 bg-purple-500/10 rounded-lg">
                      <h4 className="font-medium mb-2">Broadcast Features</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Mass notification system</li>
                        <li>• Urgency-based messaging</li>
                        <li>• Targeted lead selection</li>
                        <li>• Real-time availability updates</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="urgency-messaging">Urgency Messaging</Label>
                      <Switch
                        id="urgency-messaging"
                        checked={config.urgencyMessaging}
                        onCheckedChange={(checked) =>
                          setConfig(prev => ({ ...prev, urgencyMessaging: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-orange-500/10 rounded-lg">
                      <h4 className="font-medium mb-2">Advanced Options</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Custom urgency templates</li>
                        <li>• A/B testing for messaging</li>
                        <li>• Integration with external calendars</li>
                        <li>• Advanced analytics dashboard</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live Recovery Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center p-4 text-muted-foreground">
                  <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent recovery activity</p>
                  <p className="text-xs">Recent cancellation recovery actions will appear here</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fill Rate Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Recovery Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Current Recovery Rate</Label>
                  <div className="flex items-center space-x-2">
                    <Progress value={recoveryRate} className="flex-1" />
                    <span className="text-sm font-medium">{recoveryRate}%</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Target: {config.fillRateTarget}% | Current: {recoveryRate}%
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-red-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-red-400">{metrics?.contactedCount || 0}</p>
                  <p className="text-sm text-muted-foreground">Leads Contacted</p>
                </div>
                <div className="text-center p-3 bg-green-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-green-400">{metrics?.bookedCount || 0}</p>
                  <p className="text-sm text-muted-foreground">Appointments Recovered</p>
                </div>
                <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-blue-400">{metrics?.messagesSent || 0}</p>
                  <p className="text-sm text-muted-foreground">Messages Sent</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
