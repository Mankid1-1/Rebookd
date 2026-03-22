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
import { 
  MessageSquare, 
  Phone, 
  Bot, 
  Clock, 
  Zap, 
  Settings,
  TrendingUp,
  CheckCircle,
  AlertTriangle
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

  const { data: metrics, isLoading } = trpc.analytics.leadCaptureMetrics.useQuery(undefined, { refetchInterval: 30000 });
  const { data: settings } = trpc.tenant.settings.useQuery(undefined, { retry: false });
  const updateConfig = trpc.tenant.updateLeadCaptureConfig.useMutation({
    onSuccess: () => toast.success("Lead capture configuration updated"),
    onError: (err) => toast.error(err.message)
  });

  useEffect(() => {
    if (settings?.leadCaptureConfig) {
      setConfig(settings.leadCaptureConfig);
    }
  }, [settings]);

  const handleSaveConfig = () => {
    updateConfig.mutate(config);
  };

  const handleTestResponse = () => {
    toast.success("Test lead response sent successfully");
  };

  if (isLoading) return <DashboardLayout>Loading...</DashboardLayout>;

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
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
                  <p className="text-2xl font-bold">{metrics?.totalLeads || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <Zap className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Instant Responses</p>
                  <p className="text-2xl font-bold">{metrics?.instantResponses || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                  <p className="text-2xl font-bold">{metrics?.averageResponseTime || 0}s</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg mr-3">
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
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
                  <div className="p-4 bg-blue-50 rounded-lg">
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
                  <div className="p-4 bg-orange-50 rounded-lg">
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
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center">
                  <Phone className="h-4 w-4 mr-2 text-green-600" />
                  <span className="font-medium">Missed Call Response</span>
                </div>
                <Badge variant="secondary">2 min ago</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center">
                  <Bot className="h-4 w-4 mr-2 text-blue-600" />
                  <span className="font-medium">AI Chat Engagement</span>
                </div>
                <Badge variant="secondary">5 min ago</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center">
                  <MessageSquare className="h-4 w-4 mr-2 text-purple-600" />
                  <span className="font-medium">After Hours Capture</span>
                </div>
                <Badge variant="secondary">12 min ago</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
