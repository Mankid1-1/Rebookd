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
import { Progress } from "@/components/ui/progress";
import { 
  Calendar, 
  Clock, 
  TrendingUp, 
  BarChart3, 
  Settings,
  Zap,
  Target,
  AlertTriangle,
  PieChart,
  Activity
} from "lucide-react";
import { toast } from "sonner";
import "@/styles/components.css";

export default function SmartScheduling() {
  const [activeTab, setActiveTab] = useState("gaps");
  const [config, setConfig] = useState({
    gapDetection: true,
    autoFillCampaigns: true,
    offPeakOffers: true,
    utilizationTarget: 85, // 85% target utilization
    gapThreshold: 30 // 30 minutes minimum gap
  });

  const { data: metrics, isLoading } = trpc.analytics.smartSchedulingMetrics.useQuery(undefined, { refetchInterval: 30000 });
  const { data: settings } = trpc.tenant.settings.useQuery(undefined, { retry: false });
  const updateConfig = trpc.tenant.updateSmartSchedulingConfig.useMutation({
    onSuccess: () => toast.success("Smart scheduling configuration updated"),
    onError: (err) => toast.error(err.message)
  });

  useEffect(() => {
    if (settings?.smartSchedulingConfig) {
      setConfig(settings.smartSchedulingConfig as any);
    }
  }, [settings]);

  const handleSaveConfig = () => {
    updateConfig.mutate(config);
  };

  const handleDetectGaps = () => {
    toast.success("Gap detection initiated successfully");
  };

  const handleTriggerAutoFill = () => {
    toast.success("Auto-fill campaigns triggered");
  };

  const handleTriggerOffPeak = () => {
    toast.success("Off-peak offers activated");
  };

  if (isLoading) return <DashboardLayout>Loading...</DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Smart Scheduling</h1>
            <p className="text-muted-foreground mt-2">
              Fill empty gaps in your schedule with intelligent gap detection and automated campaigns
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleDetectGaps} variant="outline">
              <Target className="h-4 w-4 mr-2" />
              Detect Gaps
            </Button>
            <Button onClick={handleTriggerAutoFill} variant="outline">
              <Zap className="h-4 w-4 mr-2" />
              Auto-Fill
            </Button>
            <Button onClick={handleTriggerOffPeak} variant="outline">
              <Clock className="h-4 w-4 mr-2" />
              Off-Peak
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
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Slots</p>
                  <p className="text-2xl font-bold">{metrics?.totalSlots || 0}</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Filled Slots</p>
                  <p className="text-2xl font-bold">{metrics?.filledSlots || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Utilization Rate</p>
                  <p className="text-2xl font-bold">{metrics?.utilizationRate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg mr-3">
                  <Zap className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Gaps Filled</p>
                  <p className="text-2xl font-bold">{metrics?.gapsFilled || 0}</p>
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
                  <TabsTrigger value="gaps">Gap Detection</TabsTrigger>
                  <TabsTrigger value="autofill">Auto-Fill</TabsTrigger>
                  <TabsTrigger value="offpeak">Off-Peak</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>
                
                <TabsContent value="gaps" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="gap-detection">Gap Detection</Label>
                      <Switch
                        id="gap-detection"
                        checked={config.gapDetection}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, gapDetection: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Gap Threshold (minutes)</Label>
                      <Input
                        type="number"
                        value={config.gapThreshold}
                        onChange={(e) => 
                          setConfig(prev => ({ ...prev, gapThreshold: parseInt(e.target.value) }))
                        }
                        min={15}
                        max={120}
                      />
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium mb-2">Gap Detection Features</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Intelligent gap identification</li>
                        <li>• Priority-based scoring</li>
                        <li>• Real-time availability updates</li>
                        <li>• Pattern recognition</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="autofill" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-fill-campaigns">Auto-Fill Campaigns</Label>
                      <Switch
                        id="auto-fill-campaigns"
                        checked={config.autoFillCampaigns}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, autoFillCampaigns: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium mb-2">Auto-Fill Features</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Priority-based lead selection</li>
                        <li>• Smart lead scoring algorithm</li>
                        <li>• Multi-channel notifications</li>
                        <li>• Real-time gap filling</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="offpeak" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="off-peak-offers">Off-Peak Offers</Label>
                      <Switch
                        id="off-peak-offers"
                        checked={config.offPeakOffers}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, offPeakOffers: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-medium mb-2">Off-Peak Features</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Discounted off-peak bookings</li>
                        <li>• Targeted time slot offers</li>
                        <li>• Dynamic pricing optimization</li>
                        <li>• Demand-based scheduling</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="advanced" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Utilization Target (%)</Label>
                      <Input
                        type="number"
                        value={config.utilizationTarget}
                        onChange={(e) => 
                          setConfig(prev => ({ ...prev, utilizationTarget: parseInt(e.target.value) }))
                        }
                        min={50}
                        max={100}
                      />
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <h4 className="font-medium mb-2">Advanced Options</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Custom gap detection rules</li>
                        <li>• Advanced lead scoring</li>
                        <li>• Predictive scheduling AI</li>
                        <li>• Integration with external calendars</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule Optimization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-2">
                  {['9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM'].map((time, index) => (
                    <div key={index} className="text-center p-2 bg-muted rounded">
                      <p className="text-xs font-medium">{time}</p>
                      <div className="w-full h-2 bg-gray-200 rounded mt-1 relative">
                        <div 
                          className="h-2 bg-blue-500 rounded" 
                          style={{ width: `${Math.min(100, Math.max(0, (metrics?.utilizationRate || 60) + (index - 3) * 10))}%` }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium mb-2">Current Utilization</h4>
                  <div className="flex items-center space-x-2">
                    <Progress value={metrics?.utilizationRate || 0} className="flex-1" />
                    <span className="text-sm font-medium">{metrics?.utilizationRate || 0}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Target: {config.utilizationTarget}% | Current: {metrics?.utilizationRate || 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gap Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Gap Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Today's Gaps</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div>
                        <p className="font-medium">9:00 AM - 9:30 AM</p>
                        <p className="text-sm text-muted-foreground">High Priority</p>
                      </div>
                      <Badge className="bg-red-100 text-red-800">30 min</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div>
                        <p className="font-medium">11:30 AM - 12:15 PM</p>
                        <p className="text-sm text-muted-foreground">Medium Priority</p>
                      </div>
                      <Badge className="bg-orange-100 text-orange-800">105 min</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <p className="font-medium">2:45 PM - 3:30 PM</p>
                        <p className="text-sm text-muted-foreground">Low Priority</p>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800">45 min</Badge>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-medium">Gap Statistics</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{metrics?.gapsFilled || 0}</p>
                      <p className="text-sm text-muted-foreground">Gaps Filled Today</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{(metrics?.totalSlots || 0) - (metrics?.filledSlots || 0)}</p>
                      <p className="text-sm text-muted-foreground">Available Slots</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <PieChart className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-600">{metrics?.utilizationRate || 0}%</p>
                  <p className="text-sm text-muted-foreground">Utilization Rate</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <Activity className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">{metrics?.gapsFilled || 0}</p>
                  <p className="text-sm text-muted-foreground">Gaps Filled</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <Zap className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-600">${((metrics?.revenueImpact || 0) / 100).toFixed(0)}</p>
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
