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
import {
  MessageSquare,
  Phone,
  Bot,
  Clock,
  Zap,
  Settings,
  TrendingUp,
  CheckCircle,
  Users
} from "lucide-react";
import { toast } from "sonner";

export default function LeadCapture() {
  const [activeTab, setActiveTab] = useState("response");
  const [config, setConfig] = useState({
    instantResponseEnabled: true,
    aiChatEnabled: true,
    afterHoursEnabled: true,
    responseTimeLimit: 60,
    bookingLinkExpiry: 24
  });

  const { data: dashData, isLoading } = trpc.analytics.dashboard.useQuery(undefined, { refetchInterval: 30000 });
  const metrics: any = dashData?.metrics;
  const { data: settings } = trpc.tenant.get.useQuery(undefined, { retry: false });
  const { data: savedConfig } = trpc.featureConfig.get.useQuery(
    { feature: "lead-capture" },
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
    saveConfig.mutate({ feature: "lead-capture", config: config as any });
  };

  const handleTestResponse = () => {
    toast.info("To test, add a lead with a phone number first. The automation will trigger automatically.");
  };

  if (isLoading) return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="h-10 w-64 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="h-16 bg-muted rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-6"><div className="h-48 bg-muted rounded animate-pulse" /></CardContent></Card>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Lead Capture & Response</h1>
            <p className="text-muted-foreground mt-2">
              Convert every lead into a booked appointment with instant responses and AI automation
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleTestResponse} variant="outline">
              <MessageSquare className="h-4 w-4 mr-2" />
              Test Response
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
                <div className="p-2 bg-blue-500/10 rounded-lg mr-3">
                  <Zap className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">New Leads Today</p>
                  <p className="text-2xl font-bold">{metrics?.todayLeads || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-500/10 rounded-lg mr-3">
                  <Users className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
                  <p className="text-2xl font-bold">{metrics?.leadCount || 0}</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Responses Sent</p>
                  <p className="text-2xl font-bold">{metrics?.messagesSent || 0}</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
                  <p className="text-2xl font-bold">{metrics?.conversionRate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="response">Response Settings</TabsTrigger>
                <TabsTrigger value="ai">AI Chat</TabsTrigger>
                <TabsTrigger value="after-hours">After Hours</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="response" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="instant-response">Instant Response</Label>
                    <Switch
                      id="instant-response"
                      checked={config.instantResponseEnabled}
                      onCheckedChange={(checked) =>
                        setConfig(prev => ({ ...prev, instantResponseEnabled: checked }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="response-time">Response Time Limit (seconds)</Label>
                    <Input
                      id="response-time"
                      type="number"
                      value={config.responseTimeLimit}
                      onChange={(e) =>
                        setConfig(prev => ({ ...prev, responseTimeLimit: parseInt(e.target.value) }))
                      }
                      min={30}
                      max={300}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="booking-expiry">Booking Link Expiry (hours)</Label>
                    <Input
                      id="booking-expiry"
                      type="number"
                      value={config.bookingLinkExpiry}
                      onChange={(e) =>
                        setConfig(prev => ({ ...prev, bookingLinkExpiry: parseInt(e.target.value) }))
                      }
                      min={1}
                      max={168}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="ai" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ai-chat">AI Chat Enabled</Label>
                    <Switch
                      id="ai-chat"
                      checked={config.aiChatEnabled}
                      onCheckedChange={(checked) =>
                        setConfig(prev => ({ ...prev, aiChatEnabled: checked }))
                      }
                    />
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">AI Chat Features</h4>
                    <ul className="space-y-2 text-sm">
                      <li>• Conversational AI engagement</li>
                      <li>• Intelligent booking assistance</li>
                      <li>• Natural language processing</li>
                      <li>• Context-aware responses</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="after-hours" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="after-hours">After Hours Response</Label>
                    <Switch
                      id="after-hours"
                      checked={config.afterHoursEnabled}
                      onCheckedChange={(checked) =>
                        setConfig(prev => ({ ...prev, afterHoursEnabled: checked }))
                      }
                    />
                  </div>
                  <div className="p-4 bg-blue-500/10 rounded-lg">
                    <h4 className="font-medium mb-2">After Hours Features</h4>
                    <ul className="space-y-2 text-sm">
                      <li>• 24/7 lead capture</li>
                      <li>• Instant booking links</li>
                      <li>• Business hours detection</li>
                      <li>• Queue management</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="p-4 bg-orange-500/10 rounded-lg">
                    <h4 className="font-medium mb-2">Advanced Options</h4>
                    <ul className="space-y-2 text-sm">
                      <li>• Custom response templates</li>
                      <li>• Multi-language support</li>
                      <li>• Integration with CRM</li>
                      <li>• Analytics and reporting</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Lead Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-4 text-muted-foreground">
                <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent lead activity</p>
                <p className="text-xs">Lead capture activity will appear here as leads come in</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
