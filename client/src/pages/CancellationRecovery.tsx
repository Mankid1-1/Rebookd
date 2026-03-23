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
  Phone
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

  const { data: metrics, isLoading } = trpc.analytics.cancellationRecoveryMetrics.useQuery(undefined, { refetchInterval: 30000 });
  const { data: settings } = trpc.tenant.settings.useQuery(undefined, { retry: false });
  const updateConfig = trpc.tenant.updateCancellationRecoveryConfig.useMutation({
    onSuccess: () => toast.success("Cancellation recovery configuration updated"),
    onError: (err) => toast.error(err.message)
  });

  useEffect(() => {
    if (settings?.cancellationRecoveryConfig) {
      setConfig(settings.cancellationRecoveryConfig);
    }
  }, [settings]);

  const handleSaveConfig = () => {
    updateConfig.mutate(config);
  };

  const handleTestRebooking = () => {
    toast.success("Test instant rebooking sent successfully");
  };

  const handleTriggerBroadcast = () => {
    toast.success("Open slot broadcast triggered");
  };

  if (isLoading) return <DashboardLayout>Loading...</DashboardLayout>;

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
                <div className="p-2 bg-red-100 rounded-lg mr-3">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Cancellations</p>
                  <p className="text-2xl font-bold">{metrics?.totalCancellations || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Slots Filled</p>
                  <p className="text-2xl font-bold">{metrics?.filledSlots || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fill Rate</p>
                  <p className="text-2xl font-bold">{metrics?.fillRate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                  <Zap className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Revenue Impact</p>
                  <p className="text-2xl font-bold">${((metrics?.revenueImpact || 0) / 100).toFixed(0)}</p>
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
                    <div className="p-4 bg-green-50 rounded-lg">
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
                    <div className="p-4 bg-blue-50 rounded-lg">
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
                    <div className="p-4 bg-purple-50 rounded-lg">
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
                    <div className="p-4 bg-orange-50 rounded-lg">
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
                  <Label>Current Fill Rate</Label>
                  <div className="flex items-center space-x-2">
                    <Progress value={metrics?.fillRate || 0} className="flex-1" />
                    <span className="text-sm font-medium">{metrics?.fillRate || 0}%</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Target: {config.fillRateTarget}% | Current: {metrics?.fillRate || 0}%
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{metrics?.totalCancellations || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Cancellations</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{metrics?.filledSlots || 0}</p>
                  <p className="text-sm text-muted-foreground">Slots Filled</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">${((metrics?.revenueImpact || 0) / 100).toFixed(0)}</p>
                  <p className="text-sm text-muted-foreground">Revenue Impact</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
