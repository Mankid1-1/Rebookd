import DashboardLayout from "@/components/layout/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { HelpTooltip, HelpIcon } from "@/components/ui/HelpTooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  Bell,
  Users,
  CheckCircle,
  AlertTriangle,
  Calendar,
  TrendingUp,
  Settings,
  Phone,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";

export default function NoShowRecovery() {
  const [activeTab, setActiveTab] = useState("reminders");
  const [config, setConfig] = useState({
    multiTouchReminders: true,
    confirmationFlow: true,
    autoCancel: true,
    waitlistFill: true,
    reminderSchedule: [24, 4, 2] // hours before appointment
  });

  const { data: dashData, isLoading } = trpc.analytics.dashboard.useQuery(undefined, { refetchInterval: 60_000 });
  const metrics: any = dashData?.metrics;
  const { data: settings } = trpc.tenant.get.useQuery(undefined, { retry: false });
  const { data: savedConfig } = trpc.featureConfig.get.useQuery(
    { feature: "no-show-recovery" },
    { retry: false }
  );
  const { data: automationsList } = trpc.automations.list.useQuery();
  const { data: leadsList } = trpc.leads.list.useQuery({ limit: 1, status: "new" } as any);
  const testAutomation = trpc.automations.test.useMutation({
    onSuccess: () => toast.success("Test SMS sent! Check the lead's phone for the message."),
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
    saveConfig.mutate({ feature: "no-show-recovery", config: config as any });
  };

  const handleTestReminder = () => {
    const firstLead = (leadsList as any)?.leads?.[0] ?? (leadsList as any)?.[0];
    if (!firstLead?.phone) {
      toast.info("Add a lead with a phone number first to test reminders.");
      return;
    }
    const auto = (automationsList as any[])?.find((a: any) => a.key === 'appointment_reminder_24h' || a.triggerType === 'appointment_reminder');
    if (!auto) {
      toast.info("Enable the Appointment Reminder automation on the Automations page first.");
      return;
    }
    testAutomation.mutate({ automationId: auto.id, testPhone: firstLead.phone });
  };

  const handleTriggerRecovery = () => {
    const firstLead = (leadsList as any)?.leads?.[0] ?? (leadsList as any)?.[0];
    if (!firstLead?.phone) {
      toast.info("Add a lead with a phone number first to trigger recovery.");
      return;
    }
    const auto = (automationsList as any[])?.find((a: any) => a.key === 'noshow_recovery' || a.key === 'missed_call_textback');
    if (!auto) {
      toast.info("Enable the No-Show Recovery automation on the Automations page first.");
      return;
    }
    testAutomation.mutate({ automationId: auto.id, testPhone: firstLead.phone });
  };

  const responseRate = metrics?.messagesSent > 0
    ? Math.round((metrics.messagesReceived / metrics.messagesSent) * 100)
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
              <h1 className="text-3xl font-bold">No-Show Recovery</h1>
              <HelpIcon content={{ basic: "Win back clients who missed their appointment", intermediate: "No-show recovery sends follow-up texts to rebook missed appointments", advanced: "Triggered by calendar event status 'no_show'. Two-step sequence: check-in message, then rebook offer with configurable delays" }} />
            </div>
            <p className="text-muted-foreground mt-2">
              Reduce no-shows with automated reminders and smart recovery
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleTestReminder} variant="outline">
              <Bell className="h-4 w-4 mr-2" />
              Test Reminder
            </Button>
            <Button onClick={handleTriggerRecovery} variant="outline">
              <TrendingUp className="h-4 w-4 mr-2" />
              Trigger Recovery
            </Button>
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
                <div className="p-2 bg-info/10 rounded-lg mr-3">
                  <Users className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground"><HelpTooltip content="Total number of leads being monitored for no-show patterns and follow-up sequences" variant="info">Leads Tracked</HelpTooltip></p>
                  <p className="text-2xl font-bold">{metrics?.leadCount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-destructive/10 rounded-lg mr-3">
                  <MessageSquare className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground"><HelpTooltip content="Number of recovery SMS messages sent to clients who missed their appointment" variant="info">Follow-Ups Sent</HelpTooltip></p>
                  <p className="text-2xl font-bold">{metrics?.messagesSent || 0}</p>
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
                  <p className="text-sm font-medium text-muted-foreground"><HelpTooltip content="How many no-shows were re-booked after receiving a follow-up SMS" variant="info">Recovered</HelpTooltip></p>
                  <p className="text-2xl font-bold">{metrics?.bookedCount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-accent/10 rounded-lg mr-3">
                  <Phone className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground"><HelpTooltip content="Percentage of no-show follow-up messages that received a reply from the client" variant="info">Response Rate</HelpTooltip></p>
                  <p className="text-2xl font-bold">{responseRate}%</p>
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
                  <TabsTrigger value="reminders">Reminders</TabsTrigger>
                  <TabsTrigger value="confirmation">Confirmation</TabsTrigger>
                  <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>

                <TabsContent value="reminders" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="multi-touch"><HelpTooltip content="Sends reminders at multiple intervals before the appointment — reduces no-shows by keeping clients engaged" variant="info">Multi-Touch Reminders</HelpTooltip></Label>
                      <Switch
                        id="multi-touch"
                        checked={config.multiTouchReminders}
                        onCheckedChange={(checked) =>
                          setConfig(prev => ({ ...prev, multiTouchReminders: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label><HelpTooltip content="How many hours before the appointment each reminder is sent. Multiple touch points dramatically cut no-show rates." variant="info">Reminder Schedule (hours before)</HelpTooltip></Label>
                      <div className="flex gap-2">
                        {config.reminderSchedule.map((hours, index) => (
                          <Input
                            key={index}
                            type="number"
                            value={hours}
                            onChange={(e) => {
                              const newSchedule = [...config.reminderSchedule];
                              newSchedule[index] = parseInt(e.target.value);
                              setConfig(prev => ({ ...prev, reminderSchedule: newSchedule }));
                            }}
                            min={1}
                            max={168}
                            placeholder={`${hours}h`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="p-4 bg-info/10 rounded-lg">
                      <h4 className="font-medium mb-2">Reminder Features</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• 24h, 4h, 2h before appointment</li>
                        <li>• Interactive confirmation flows</li>
                        <li>• Automatic cancellation of unconfirmed</li>
                        <li>• Card on file enforcement</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="confirmation" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="confirmation-flow"><HelpTooltip content="Asks clients to confirm their appointment, which dramatically reduces no-shows. Unconfirmed appointments can be auto-cancelled." variant="info">Confirmation Flow</HelpTooltip></Label>
                      <Switch
                        id="confirmation-flow"
                        checked={config.confirmationFlow}
                        onCheckedChange={(checked) =>
                          setConfig(prev => ({ ...prev, confirmationFlow: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-success/10 rounded-lg">
                      <h4 className="font-medium mb-2">Confirmation Features</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• "YES" confirmation responses</li>
                        <li>• One-tap confirmation</li>
                        <li>• Smart confirmation timing</li>
                        <li>• Follow-up for non-responders</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="waitlist" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="waitlist-fill"><HelpTooltip content="When a no-show creates an open slot, automatically notifies waitlisted clients to fill the gap instantly" variant="info">Waitlist Auto-Fill</HelpTooltip></Label>
                      <Switch
                        id="waitlist-fill"
                        checked={config.waitlistFill}
                        onCheckedChange={(checked) =>
                          setConfig(prev => ({ ...prev, waitlistFill: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-accent/10 rounded-lg">
                      <h4 className="font-medium mb-2">Waitlist Features</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Instant gap filling</li>
                        <li>• Priority-based lead scoring</li>
                        <li>• Automated waitlist notifications</li>
                        <li>• Smart slot matching</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-warning/10 rounded-lg">
                      <h4 className="font-medium mb-2">Advanced Options</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Custom reminder templates</li>
                        <li>• A/B testing for reminder timing</li>
                        <li>• Integration with calendar systems</li>
                        <li>• Advanced analytics and reporting</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center p-4 text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent activity</p>
                  <p className="text-xs">No-show recovery activity will appear here</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recovery Rate Visualization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Recovery Performance <HelpIcon content={{ basic: "How many no-shows have been recovered", intermediate: "Recovery rate and revenue recovered from no-show re-engagement campaigns", advanced: "Metrics derived from recovery_events table. Response rate = messagesReceived / messagesSent. Recovery rate = bookedCount / leadCount" }} /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label><HelpTooltip content={{ basic: "How often people reply to your follow-ups", intermediate: "Percentage of no-show follow-up messages that received a reply from the client", advanced: "messagesReceived / messagesSent as a percentage" }} variant="info">Current Response Rate</HelpTooltip></Label>
                  <div className="flex items-center space-x-2">
                    <Progress value={responseRate} className="flex-1" />
                    <span className="text-sm font-medium">{responseRate}%</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Target: 80% | Current: {responseRate}%
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-info/10 rounded-lg">
                  <p className="text-2xl font-bold text-info">{metrics?.leadCount || 0}</p>
                  <p className="text-sm text-muted-foreground"><HelpTooltip content="Total number of leads being monitored for no-show patterns and follow-up sequences" variant="info">Leads Tracked</HelpTooltip></p>
                </div>
                <div className="text-center p-3 bg-destructive/10 rounded-lg">
                  <p className="text-2xl font-bold text-destructive">{metrics?.messagesSent || 0}</p>
                  <p className="text-sm text-muted-foreground"><HelpTooltip content="Number of recovery SMS messages sent to clients who missed their appointment" variant="info">Follow-Ups Sent</HelpTooltip></p>
                </div>
                <div className="text-center p-3 bg-success/10 rounded-lg">
                  <p className="text-2xl font-bold text-success">{metrics?.bookedCount || 0}</p>
                  <p className="text-sm text-muted-foreground"><HelpTooltip content="How many no-shows were re-booked after receiving a follow-up SMS" variant="info">Recovered</HelpTooltip></p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
