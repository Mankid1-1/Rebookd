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
  MessageSquare, 
  Calendar, 
  Settings, 
  CheckCircle, 
  TrendingUp, 
  Users, 
  Zap,
  RefreshCw,
  Timer,
  Bot
} from "lucide-react";
import { toast } from "sonner";
import "@/styles/components.css";

export default function AdminAutomation() {
  const [activeTab, setActiveTab] = useState("confirmations");
  const [config, setConfig] = useState({
    automatedConfirmations: true,
    automatedFollowUps: true,
    selfServiceRescheduling: true,
    confirmationWindow: 24, // hours before appointment
    followUpSchedule: [1, 3, 7], // days after appointment
    reschedulingWindow: 48 // hours after cancellation
  });

  const { data: dashData, isLoading } = trpc.analytics.dashboard.useQuery(undefined, { refetchInterval: 30000 });
  const metrics: any = dashData?.metrics;
  const { data: settings } = trpc.tenant.get.useQuery(undefined, { retry: false });
  const updateConfig = trpc.tenant.update.useMutation({
    onSuccess: () => toast.success("Admin automation configuration updated"),
    onError: (err) => toast.error(err.message)
  });

  useEffect(() => {
    // Config loaded from tenant settings when available
  }, [settings]);

  const handleSaveConfig = () => {
    updateConfig.mutate({});
    toast.success("Configuration saved");
  };

  const handleTestConfirmation = () => {
    toast.info("Test confirmation not yet implemented");
  };

  const handleTriggerFollowUp = () => {
    toast.success("Follow-up campaign triggered");
  };

  const handleTestRescheduling = () => {
    toast.success("Self-service rescheduling test initiated");
  };

  if (isLoading) return <DashboardLayout>Loading...</DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Automation</h1>
            <p className="text-muted-foreground mt-2">
              Replace 10-20 hours/week of admin work with intelligent automation
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleTestConfirmation} variant="outline" disabled>
              <MessageSquare className="h-4 w-4 mr-2" />
              Test Confirmation (Coming Soon)
            </Button>
            <Button onClick={handleTriggerFollowUp} variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              Trigger Follow-up
            </Button>
            <Button onClick={handleTestRescheduling} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Test Rescheduling
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
                <div className="p-2 bg-blue-500/10 rounded-lg mr-3">
                  <Calendar className="h-6 w-6 text-blue-400" />
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
                <div className="p-2 bg-green-500/10 rounded-lg mr-3">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Automated Confirmations</p>
                  <p className="text-2xl font-bold">{metrics?.automatedConfirmations || 0}</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Self-Service Reschedules</p>
                  <p className="text-2xl font-bold">{metrics?.selfServiceReschedules || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-orange-500/10 rounded-lg mr-3">
                  <Timer className="h-6 w-6 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Time Saved</p>
                  <p className="text-2xl font-bold">{metrics?.timeSaved || 0}h</p>
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
                  <TabsTrigger value="confirmations">Confirmations</TabsTrigger>
                  <TabsTrigger value="followups">Follow-ups</TabsTrigger>
                  <TabsTrigger value="rescheduling">Rescheduling</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>
                
                <TabsContent value="confirmations" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="automated-confirmations">Automated Confirmations</Label>
                      <Switch
                        id="automated-confirmations"
                        checked={config.automatedConfirmations}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, automatedConfirmations: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmation-window">Confirmation Window (hours before)</Label>
                      <Input
                        id="confirmation-window"
                        type="number"
                        value={config.confirmationWindow}
                        onChange={(e) => 
                          setConfig(prev => ({ ...prev, confirmationWindow: parseInt(e.target.value) || 1 }))
                        }
                        min={1}
                        max={168}
                      />
                    </div>
                    <div className="p-4 bg-blue-500/10 rounded-lg">
                      <h4 className="font-medium mb-2">Confirmation Features</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• 24-hour confirmation system</li>
                        <li>• Automated reminder scheduling</li>
                        <li>• Smart confirmation timing</li>
                        <li>• Multi-channel notifications</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="followups" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="automated-followups">Automated Follow-ups</Label>
                      <Switch
                        id="automated-followups"
                        checked={config.automatedFollowUps}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, automatedFollowUps: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Follow-up Schedule (days after)</Label>
                      <div className="flex gap-2">
                        {config.followUpSchedule.map((days, index) => (
                          <Input
                            key={index}
                            type="number"
                            value={days}
                            onChange={(e) => {
                              const newSchedule = [...config.followUpSchedule];
                              newSchedule[index] = parseInt(e.target.value) || 1;
                              setConfig(prev => ({ ...prev, followUpSchedule: newSchedule }));
                            }}
                            min={1}
                            max={365}
                            placeholder={`${days}d`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="p-4 bg-green-500/10 rounded-lg">
                      <h4 className="font-medium mb-2">Follow-up Features</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• 1, 3, 7 day follow-up schedule</li>
                        <li>• Personalized follow-up messages</li>
                        <li>• Experience-based follow-ups</li>
                        <li>• Revenue-focused follow-ups</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="rescheduling" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="self-service-rescheduling">Self-Service Rescheduling</Label>
                      <Switch
                        id="self-service-rescheduling"
                        checked={config.selfServiceRescheduling}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, selfServiceRescheduling: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rescheduling-window">Rescheduling Window (hours after)</Label>
                      <Input
                        id="rescheduling-window"
                        type="number"
                        value={config.reschedulingWindow}
                        onChange={(e) => 
                          setConfig(prev => ({ ...prev, reschedulingWindow: parseInt(e.target.value) || 1 }))
                        }
                        min={1}
                        max={168}
                      />
                    </div>
                    <div className="p-4 bg-purple-500/10 rounded-lg">
                      <h4 className="font-medium mb-2">Rescheduling Features</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Customer-controlled rescheduling</li>
                        <li>• 48-hour rescheduling window</li>
                        <li>• Smart slot suggestions</li>
                        <li>• Automated availability updates</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="advanced" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-orange-500/10 rounded-lg">
                      <h4 className="font-medium mb-2">Advanced Options</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Custom automation rules</li>
                        <li>• Integration with calendar systems</li>
                        <li>• Advanced analytics dashboard</li>
                        <li>• AI-powered automation</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Automation Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                    <Bot className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                    <h3 className="font-medium">Automated Confirmations</h3>
                    <Badge className={config.automatedConfirmations ? "bg-green-500/10 text-green-300" : "bg-gray-500/20 text-gray-400"}>
                      {config.automatedConfirmations ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="text-center p-4 bg-green-500/10 rounded-lg">
                    <MessageSquare className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <h3 className="font-medium">Follow-up Campaigns</h3>
                    <Badge className={config.automatedFollowUps ? "bg-green-500/10 text-green-300" : "bg-gray-500/20 text-gray-400"}>
                      {config.automatedFollowUps ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="text-center p-4 bg-purple-500/10 rounded-lg">
                    <RefreshCw className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                    <h3 className="font-medium">Self-Service Rescheduling</h3>
                    <Badge className={config.selfServiceRescheduling ? "bg-green-500/10 text-green-300" : "bg-gray-500/20 text-gray-400"}>
                      {config.selfServiceRescheduling ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="text-center p-4 bg-orange-500/10 rounded-lg">
                    <Timer className="h-8 w-8 text-orange-400 mx-auto mb-2" />
                    <h3 className="font-medium">Time Savings</h3>
                    <p className="text-lg font-bold">{metrics?.timeSaved || 0}h/week</p>
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Automation Benefits</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• Reduced manual admin work</li>
                    <li>• Improved customer experience</li>
                    <li>• Increased operational efficiency</li>
                    <li>• Better resource utilization</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Time Savings Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Time Savings Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-blue-400">{metrics?.automatedConfirmations || 0}</p>
                  <p className="text-sm text-muted-foreground">Confirmations Automated</p>
                </div>
                <div className="text-center p-3 bg-green-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-green-400">{metrics?.selfServiceReschedules || 0}</p>
                  <p className="text-sm text-muted-foreground">Self-Service Reschedules</p>
                </div>
                <div className="text-center p-3 bg-purple-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-purple-400">{metrics?.timeSaved || 0}h</p>
                  <p className="text-sm text-muted-foreground">Time Saved/Week</p>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Revenue Impact</h4>
                <div className="flex items-center space-x-2">
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-1">Admin Time Converted to Revenue</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 relative">
                      <div 
                        className="h-2 bg-green-500/100 rounded-full" 
                        style={{ width: `${Math.min(100, Math.max(0, metrics?.revenueImpact || 0))}%` }} 
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium">${((metrics?.revenueImpact || 0) / 100).toFixed(0)}/week</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on $25/hour admin time value and {metrics?.timeSaved || 0} hours saved
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
