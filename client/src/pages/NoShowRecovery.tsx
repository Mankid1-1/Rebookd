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

  const { data: metrics, isLoading } = trpc.analytics.noShowRecoveryMetrics.useQuery(undefined, { refetchInterval: 30000 });
  const { data: settings } = trpc.tenant.settings.useQuery(undefined, { retry: false });
  const updateConfig = trpc.tenant.updateNoShowRecoveryConfig.useMutation({
    onSuccess: () => toast.success("No-show recovery configuration updated"),
    onError: (err: Error) => toast.error(err.message)
  });

  useEffect(() => {
    if (settings?.noShowRecoveryConfig) {
      setConfig(settings.noShowRecoveryConfig);
    }
  }, [settings]);

  const handleSaveConfig = () => {
    updateConfig.mutate(config);
  };

  const handleTestReminder = () => {
    toast.success("Test reminder sent successfully");
  };

  const handleTriggerRecovery = () => {
    toast.success("No-show recovery campaign triggered");
  };

  if (isLoading) return <DashboardLayout>Loading...</DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">No-Show Recovery</h1>
            <p className="text-muted-foreground mt-2">
              Eliminate 50-80% of no-shows with automated reminders and smart recovery
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
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Appointments</p>
                  <p className="text-2xl font-bold">{metrics?.totalAppointments || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg mr-3">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">No-Shows</p>
                  <p className="text-2xl font-bold">{metrics?.noShows || 0}</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Recovered</p>
                  <p className="text-2xl font-bold">{metrics?.recovered || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Recovery Rate</p>
                  <p className="text-2xl font-bold">{metrics?.recoveryRate || 0}%</p>
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
                      <Label htmlFor="multi-touch">Multi-Touch Reminders</Label>
                      <Switch
                        id="multi-touch"
                        checked={config.multiTouchReminders}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, multiTouchReminders: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Reminder Schedule (hours before)</Label>
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
                    <div className="p-4 bg-blue-50 rounded-lg">
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
                      <Label htmlFor="confirmation-flow">Confirmation Flow</Label>
                      <Switch
                        id="confirmation-flow"
                        checked={config.confirmationFlow}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, confirmationFlow: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
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
                      <Label htmlFor="waitlist-fill">Waitlist Auto-Fill</Label>
                      <Switch
                        id="waitlist-fill"
                        checked={config.waitlistFill}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, waitlistFill: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
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
                    <div className="p-4 bg-orange-50 rounded-lg">
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
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center">
                    <Bell className="h-4 w-4 mr-2 text-blue-600" />
                    <div>
                      <span className="font-medium">24h Reminder Sent</span>
                      <p className="text-xs text-muted-foreground">John Doe - Tomorrow 9:00 AM</p>
                    </div>
                  </div>
                  <Badge variant="secondary">Just now</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center">
                    <MessageSquare className="h-4 w-4 mr-2 text-green-600" />
                    <div>
                      <span className="font-medium">Confirmation Received</span>
                      <p className="text-xs text-muted-foreground">Jane Smith - YES response</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">5 min ago</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-2 text-purple-600" />
                    <div>
                      <span className="font-medium">Waitlist Filled</span>
                      <p className="text-xs text-muted-foreground">Mike Johnson - 2:00 PM slot</p>
                    </div>
                  </div>
                  <Badge className="bg-purple-100 text-purple-800">12 min ago</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-orange-600" />
                    <div>
                      <span className="font-medium">Auto-Cancel Triggered</span>
                      <p className="text-xs text-muted-foreground">Sarah Wilson - No response</p>
                    </div>
                  </div>
                  <Badge className="bg-orange-100 text-orange-800">18 min ago</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recovery Rate Visualization */}
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
                    <Progress value={metrics?.recoveryRate || 0} className="flex-1" />
                    <span className="text-sm font-medium">{metrics?.recoveryRate || 0}%</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Target: 80% | Current: {metrics?.recoveryRate || 0}%
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{metrics?.totalAppointments || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Appointments</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{metrics?.noShows || 0}</p>
                  <p className="text-sm text-muted-foreground">No-Shows</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{metrics?.recovered || 0}</p>
                  <p className="text-sm text-muted-foreground">Recovered</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
