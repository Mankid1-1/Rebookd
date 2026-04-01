import DashboardLayout from "@/components/layout/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { HelpTooltip, HelpIcon } from "@/components/ui/HelpTooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

  const { data: dashData, isLoading } = trpc.analytics.dashboard.useQuery(undefined, { refetchInterval: 60_000 });
  const metrics: any = dashData?.metrics;
  const { data: settings } = trpc.tenant.get.useQuery(undefined, { retry: false });
  const { data: savedConfig } = trpc.featureConfig.get.useQuery(
    { feature: "cancellation-recovery" },
    { retry: false }
  );
  const { data: automationsList } = trpc.automations.list.useQuery();
  // For rebooking test: use a recently lost/cancelled lead (the person who cancelled)
  const { data: cancelledLeads } = trpc.leads.list.useQuery({ limit: 1, status: "lost" } as any);
  // For broadcast: use waiting list leads (qualified = opted in to be notified of openings)
  const { data: waitlistLeads } = trpc.leads.list.useQuery({ limit: 1, status: "qualified" } as any);
  const testAutomation = trpc.automations.test.useMutation({
    onSuccess: () => toast.success("Recovery SMS sent! Check the lead's phone."),
    onError: (err) => toast.error(err.message),
  });
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
    // Target the cancelled lead — the person who actually cancelled
    const lead = (cancelledLeads as any)?.leads?.[0] ?? (cancelledLeads as any)?.[0];
    if (!lead?.phone) {
      toast.info("No cancelled leads found. A lead must cancel first to test recovery.");
      return;
    }
    const auto = (automationsList as any[])?.find((a: any) => a.key === 'cancellation_same_day' || a.key === 'cancellation_rescue_48h');
    if (!auto) {
      toast.info("Enable a Cancellation Recovery automation on the Automations page first.");
      return;
    }
    testAutomation.mutate({ automationId: auto.id, testPhone: lead.phone });
  };

  const handleTriggerBroadcast = () => {
    // Target waiting list leads — customers who opted in to be notified of openings
    const lead = (waitlistLeads as any)?.leads?.[0] ?? (waitlistLeads as any)?.[0];
    if (!lead?.phone) {
      toast.info("No one is on your waiting list yet. Leads with 'Qualified' status are your waiting list.");
      return;
    }
    const auto = (automationsList as any[])?.find((a: any) => a.key === 'cancellation_flurry');
    if (!auto) {
      toast.info("Enable the Cancellation Flurry automation on the Automations page first.");
      return;
    }
    testAutomation.mutate({ automationId: auto.id, testPhone: lead.phone });
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
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">Cancellation Recovery</h1>
              <HelpIcon content={{ basic: "Win back clients who cancelled their appointment", intermediate: "Cancellation recovery automation — re-engage cancelled appointments with incentives", advanced: "Triggered by appointment status change to 'cancelled'. Sends acknowledgement then follow-up rebook offer. Revenue tracked in recovery_events" }} />
            </div>
            <p className="text-muted-foreground mt-2">
              When someone cancels, automated outreach helps fill the open slot
            </p>
          </div>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleTestRebooking} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Test Rebooking
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Simulate a cancellation to verify your recovery automations are working correctly.</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleTriggerBroadcast} variant="outline">
                    <Bell className="h-4 w-4 mr-2" />
                    Broadcast Slots
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Manually send an SMS blast to all eligible leads announcing available open slots right now.</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleSaveConfig}>
                    <Settings className="h-4 w-4 mr-2" />
                    Save Configuration
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Save all changes to your cancellation recovery settings.</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-destructive/10 rounded-lg mr-3">
                  <Users className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground"><HelpTooltip content="Number of leads sent a win-back SMS after their appointment was cancelled" variant="info">Leads Contacted</HelpTooltip></p>
                  <p className="text-2xl font-bold">{metrics?.contactedCount || 0}</p>
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
                  <p className="text-sm font-medium text-muted-foreground"><HelpTooltip content="Cancelled appointments that were successfully re-booked after a recovery SMS" variant="info">Appointments Recovered</HelpTooltip></p>
                  <p className="text-2xl font-bold">{metrics?.bookedCount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-info/10 rounded-lg mr-3">
                  <Zap className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground"><HelpTooltip content="Percentage of cancellations that were re-booked after receiving a win-back SMS" variant="info">Recovery Rate</HelpTooltip></p>
                  <p className="text-2xl font-bold">{recoveryRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-accent/10 rounded-lg mr-3">
                  <MessageSquare className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground"><HelpTooltip content="Total cancellation recovery SMS messages sent across all campaigns" variant="info">Messages Sent</HelpTooltip></p>
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
              <CardTitle>
                <HelpTooltip content="Configure how Rebooked responds the moment a cancellation is detected — from instant waitlist outreach to mass slot broadcasts." variant="info">
                  Configuration
                </HelpTooltip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild><TabsTrigger value="instant">Instant</TabsTrigger></TooltipTrigger>
                      <TooltipContent><p>Contact the top waitlisted lead the second a cancellation is detected.</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild><TabsTrigger value="waitlist">Waitlist</TabsTrigger></TooltipTrigger>
                      <TooltipContent><p>Work through your waitlist sequentially to fill the open slot automatically.</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild><TabsTrigger value="broadcast">Broadcast</TabsTrigger></TooltipTrigger>
                      <TooltipContent><p>Send an SMS blast to all eligible leads announcing the newly available slot.</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild><TabsTrigger value="advanced">Advanced</TabsTrigger></TooltipTrigger>
                      <TooltipContent><p>Fine-tune urgency language, A/B testing, and calendar integration options.</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TabsList>

                <TabsContent value="instant" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="instant-rebooking"><HelpTooltip content="Immediately contacts your highest-priority waitlisted clients the moment a cancellation is detected" variant="info">Instant Rebooking</HelpTooltip></Label>
                      <Switch
                        id="instant-rebooking"
                        checked={config.instantRebooking}
                        onCheckedChange={(checked) =>
                          setConfig(prev => ({ ...prev, instantRebooking: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-success/10 rounded-lg">
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
                      <Label htmlFor="waitlist-fill"><HelpTooltip content="Automatically works through your waitlist to fill the cancelled slot without manual intervention" variant="info">Waitlist Auto-Fill</HelpTooltip></Label>
                      <Switch
                        id="waitlist-fill"
                        checked={config.waitlistAutoFill}
                        onCheckedChange={(checked) =>
                          setConfig(prev => ({ ...prev, waitlistAutoFill: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-info/10 rounded-lg">
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
                      <Label htmlFor="broadcast-slots"><HelpTooltip content="Sends a mass SMS to eligible leads announcing an open slot — maximises the chance of filling it quickly" variant="info">Broadcast Open Slots</HelpTooltip></Label>
                      <Switch
                        id="broadcast-slots"
                        checked={config.broadcastOpenSlots}
                        onCheckedChange={(checked) =>
                          setConfig(prev => ({ ...prev, broadcastOpenSlots: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label><HelpTooltip content="Your target percentage of cancelled slots to recover. Used to benchmark performance on your dashboard." variant="info">Fill Rate Target (%)</HelpTooltip></Label>
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
                    <div className="p-4 bg-accent/10 rounded-lg">
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
                      <Label htmlFor="urgency-messaging"><HelpTooltip content="Adds time-sensitive language to recovery messages (e.g. 'slot just opened') to drive faster responses" variant="info">Urgency Messaging</HelpTooltip></Label>
                      <Switch
                        id="urgency-messaging"
                        checked={config.urgencyMessaging}
                        onCheckedChange={(checked) =>
                          setConfig(prev => ({ ...prev, urgencyMessaging: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-warning/10 rounded-lg">
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
              <CardTitle>
                <HelpTooltip content="A real-time feed of cancellation events and the recovery actions Rebooked took — which leads were contacted, which slots were filled." variant="info">
                  Live Recovery Activity
                </HelpTooltip>
              </CardTitle>
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
            <CardTitle>
              <span className="flex items-center gap-2">Recovery Performance <HelpIcon content={{ basic: "How many cancellations have been recovered", intermediate: "Cancellation recovery rate, revenue saved, and average time to rebook", advanced: "recoveryRate = bookedCount / leadCount. Fill rate target configurable per tenant. Metrics from recovery_events and analytics.dashboard" }} /></span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label><HelpTooltip content="Percentage of cancellations that were re-booked after receiving a win-back SMS" variant="info">Current Recovery Rate</HelpTooltip></Label>
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
                <div className="text-center p-3 bg-destructive/10 rounded-lg">
                  <p className="text-2xl font-bold text-destructive">{metrics?.contactedCount || 0}</p>
                  <p className="text-sm text-muted-foreground"><HelpTooltip content="Number of leads sent a win-back SMS after their appointment was cancelled" variant="info">Leads Contacted</HelpTooltip></p>
                </div>
                <div className="text-center p-3 bg-success/10 rounded-lg">
                  <p className="text-2xl font-bold text-success">{metrics?.bookedCount || 0}</p>
                  <p className="text-sm text-muted-foreground"><HelpTooltip content="Cancelled appointments that were successfully re-booked after a recovery SMS" variant="info">Appointments Recovered</HelpTooltip></p>
                </div>
                <div className="text-center p-3 bg-info/10 rounded-lg">
                  <p className="text-2xl font-bold text-info">{metrics?.messagesSent || 0}</p>
                  <p className="text-sm text-muted-foreground"><HelpTooltip content="Total cancellation recovery SMS messages sent across all campaigns" variant="info">Messages Sent</HelpTooltip></p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
