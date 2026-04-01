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
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function SmartScheduling() {
  const [activeTab, setActiveTab] = useState("gaps");
  const [config, setConfig] = useState({
    gapDetection: true,
    autoFillCampaigns: true,
    offPeakOffers: true,
    utilizationTarget: 85, // 85% target utilization
    gapThreshold: 30 // 30 minutes minimum gap
  });

  const { data: metrics, isLoading } = trpc.analytics.smartSchedulingMetrics.useQuery(undefined, { refetchInterval: 60_000 });
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

  const [gaps, setGaps] = useState<any[]>([]);
  const [gapsLoading, setGapsLoading] = useState(false);
  const { data: calendarConnections } = trpc.calendar.listConnections.useQuery(undefined, { retry: false });
  const hasCalendar = (calendarConnections?.length ?? 0) > 0;

  const handleDetectGaps = async () => {
    if (!hasCalendar) {
      toast.error("Connect a calendar first to detect scheduling gaps");
      return;
    }
    setGapsLoading(true);
    try {
      const now = new Date();
      const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const result = await (trpc as any).calendar.getGaps.query({
        start: now.toISOString(),
        end: weekLater.toISOString(),
        gapThresholdMinutes: config.gapThreshold,
      });
      setGaps(result ?? []);
      toast.success(`Found ${result?.length ?? 0} scheduling gaps`);
    } catch {
      toast.error("Failed to detect gaps — check your calendar connection");
    } finally {
      setGapsLoading(false);
    }
  };

  const handleTriggerAutoFill = () => {
    if (gaps.length === 0) {
      toast.info("Run gap detection first to find open slots");
      return;
    }
    window.location.href = "/automations";
  };

  const handleTriggerOffPeak = () => {
    window.location.href = "/automations";
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
                <div className="p-2 bg-info/10 rounded-lg mr-3">
                  <Calendar className="h-6 w-6 text-info" />
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
                <div className="p-2 bg-success/10 rounded-lg mr-3">
                  <TrendingUp className="h-6 w-6 text-success" />
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
                <div className="p-2 bg-accent/10 rounded-lg mr-3">
                  <BarChart3 className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    <HelpTooltip content="Percentage of your available appointment slots that are filled. Aim for 80%+ for healthy revenue." variant="info">
                      Utilization Rate
                    </HelpTooltip>
                  </p>
                  <p className="text-2xl font-bold">{metrics?.utilizationRate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-warning/10 rounded-lg mr-3">
                  <Zap className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    <HelpTooltip content="Slots that were empty but filled by Rebooked's automated waitlist and gap-fill campaigns" variant="info">
                      Gaps Filled
                    </HelpTooltip>
                  </p>
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
                      <Label>
                        <HelpTooltip content="Appointment gaps shorter than this are considered too small to fill automatically" variant="info">
                          Gap Threshold (minutes)
                        </HelpTooltip>
                      </Label>
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
                    <div className="p-4 bg-info/10 rounded-lg">
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
                      <Label htmlFor="auto-fill-campaigns">
                        <HelpTooltip content="Automatically send SMS to your waitlist when a cancellation creates an opening" variant="info">
                          Auto-Fill Campaigns
                        </HelpTooltip>
                      </Label>
                      <Switch
                        id="auto-fill-campaigns"
                        checked={config.autoFillCampaigns}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, autoFillCampaigns: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-success/10 rounded-lg">
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
                      <Label htmlFor="off-peak-offers">
                        <HelpTooltip content="Send discount or special offers to clients during your slowest time slots to incentivize bookings" variant="info">
                          Off-Peak Offers
                        </HelpTooltip>
                      </Label>
                      <Switch
                        id="off-peak-offers"
                        checked={config.offPeakOffers}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, offPeakOffers: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-accent/10 rounded-lg">
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
                      <Label>
                        <HelpTooltip content="Your goal utilization rate. Rebooked alerts you when you fall below this." variant="info">
                          Utilization Target (%)
                        </HelpTooltip>
                      </Label>
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
                    <div className="p-4 bg-warning/10 rounded-lg">
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
                      <div className="w-full h-2 bg-muted rounded mt-1 relative">
                        <div 
                          className="h-2 bg-info rounded" 
                          style={{ width: `${Math.min(100, Math.max(0, (metrics?.utilizationRate || 60) + (index - 3) * 10))}%` }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-info/10 rounded-lg">
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
                    <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
                      <div>
                        <p className="font-medium">9:00 AM - 9:30 AM</p>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-sm text-muted-foreground cursor-help">High Priority</p>
                            </TooltipTrigger>
                            <TooltipContent><p>Priority based on slot value and time until the appointment</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Badge className="bg-destructive/10 text-destructive">30 min</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-warning/10 rounded-lg">
                      <div>
                        <p className="font-medium">11:30 AM - 12:15 PM</p>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-sm text-muted-foreground cursor-help">Medium Priority</p>
                            </TooltipTrigger>
                            <TooltipContent><p>Priority based on slot value and time until the appointment</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Badge className="bg-warning/10 text-warning-foreground">105 min</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-warning/10 rounded-lg">
                      <div>
                        <p className="font-medium">2:45 PM - 3:30 PM</p>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-sm text-muted-foreground cursor-help">Low Priority</p>
                            </TooltipTrigger>
                            <TooltipContent><p>Priority based on slot value and time until the appointment</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Badge className="bg-warning/10 text-warning-foreground">45 min</Badge>
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
                <div className="text-center p-3 bg-info/10 rounded-lg">
                  <PieChart className="h-8 w-8 text-info mx-auto mb-2" />
                  <p className="text-2xl font-bold text-info">{metrics?.utilizationRate || 0}%</p>
                  <p className="text-sm text-muted-foreground">
                    <HelpTooltip content="Percentage of your available appointment slots that are filled. Aim for 80%+ for healthy revenue." variant="info">
                      Utilization Rate
                    </HelpTooltip>
                  </p>
                </div>
                <div className="text-center p-3 bg-success/10 rounded-lg">
                  <Activity className="h-8 w-8 text-success mx-auto mb-2" />
                  <p className="text-2xl font-bold text-success">{metrics?.gapsFilled || 0}</p>
                  <p className="text-sm text-muted-foreground">
                    <HelpTooltip content="Slots that were empty but filled by Rebooked's automated waitlist and gap-fill campaigns" variant="info">
                      Gaps Filled
                    </HelpTooltip>
                  </p>
                </div>
                <div className="text-center p-3 bg-accent/10 rounded-lg">
                  <Zap className="h-8 w-8 text-accent mx-auto mb-2" />
                  <p className="text-2xl font-bold text-accent">${((metrics?.revenueImpact || 0) / 100).toFixed(0)}</p>
                  <p className="text-sm text-muted-foreground">
                    <HelpTooltip content="Estimated additional revenue if all current gaps were filled" variant="info">
                      Revenue Impact
                    </HelpTooltip>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
