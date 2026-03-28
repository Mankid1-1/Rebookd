import DashboardLayout from "@/components/layout/DashboardLayout";
import { FeatureConfigPage } from "@/components/layout/FeatureConfigPage";
import { trpc } from "@/lib/trpc";
import { useFeatureConfig } from "@/hooks/useFeatureConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, 
  Moon, 
  Sun, 
  MessageSquare, 
  Users, 
  Settings,
  Bell,
  CheckCircle,
  TrendingUp,
  Activity,
  Calendar,
  Phone,
  Target,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import "@/styles/components.css";

export default function AfterHours() {
  const [activeTab, setActiveTab] = useState("response");
  const [config, setConfig] = useState({
    afterHoursEnabled: true,
    instantResponse: true,
    bookingLinkExpiry: 24,
    businessHours: {
      start: "08:00",
      end: "18:00",
      timezone: "America/New_York"
    },
    responseDelay: 5 // 5 minutes
  });

  const { data: metrics, isLoading } = trpc.analytics.afterHoursMetrics.useQuery(undefined, { refetchInterval: 30000 });
  const { data: settings } = trpc.tenant.settings.useQuery(undefined, { retry: false });
  const updateConfig = trpc.tenant.updateAfterHoursConfig.useMutation({
    onSuccess: () => toast.success("After-hours configuration updated"),
    onError: (err) => toast.error(err.message)
  });

  useEffect(() => {
    if (settings?.afterHoursConfig) {
      setConfig(settings.afterHoursConfig);
    }
  }, [settings]);

  const handleSaveConfig = () => {
    updateConfig.mutate(config);
  };

  const handleTestResponse = () => {
    toast.info("Test response not yet implemented");
  };

  const handleProcessQueue = () => {
    toast.info("Queue processing not yet implemented");
  };

  if (isLoading) return <DashboardLayout>Loading...</DashboardLayout>;

  const isAfterHours = () => {
    const now = new Date();
    const businessHours = config.businessHours;
    const [startHour, startMinute] = businessHours.start.split(':').map(Number);
    const [endHour, endMinute] = businessHours.end.split(':').map(Number);
    
    // Get current time in the configured timezone
    const currentTimeInTimezone = new Intl.DateTimeFormat('en-US', {
      timeZone: businessHours.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    
    const [currentHour, currentMinute] = currentTimeInTimezone.split(':').map(Number);
    
    // Get current day in the configured timezone
    const currentDayInTimezone = new Intl.DateTimeFormat('en-US', {
      timeZone: businessHours.timezone,
      weekday: 'numeric',
    }).format(now);
    
    // Convert to 0-6 format (Sunday = 0)
    const currentDay = currentDayInTimezone === '7' ? 0 : parseInt(currentDayInTimezone);
    
    // Check if weekend
    const isWeekend = currentDay === 0 || currentDay === 6; // Sunday or Saturday
    
    // Check if outside business hours
    const isBeforeStart = currentHour < startHour || (currentHour === startHour && currentMinute < startMinute);
    const isAfterEnd = currentHour >= endHour || (currentHour === endHour && currentMinute >= endMinute);
    
    return isWeekend || isBeforeStart || isAfterEnd;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">After-Hours Management</h1>
            <p className="text-muted-foreground mt-2">
              Capture leads 24/7 with instant responses and booking links when business is closed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${isAfterHours() ? 'bg-red-100' : 'bg-green-100'}`}>
              {isAfterHours() ? <Moon className="h-4 w-4 text-red-600" /> : <Sun className="h-4 w-4 text-green-600" />}
              <span className="text-sm font-medium">
                {isAfterHours() ? 'After Hours' : 'Business Hours'}
              </span>
            </div>
            <Button onClick={handleTestResponse} variant="outline" disabled>
              <MessageSquare className="h-4 w-4 mr-2" />
              Test Response (Coming Soon)
            </Button>
            <Button onClick={handleProcessQueue} variant="outline" disabled>
              <Bell className="h-4 w-4 mr-2" />
              Process Queue (Coming Soon)
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
                  <Users className="h-6 w-6 text-blue-600" />
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
                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                  <Moon className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">After-Hours Leads</p>
                  <p className="text-2xl font-bold">{metrics?.afterHoursLeads || 0}</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Captured Leads</p>
                  <p className="text-2xl font-bold">{metrics?.capturedLeads || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg mr-3">
                  <Calendar className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Capture Rate</p>
                  <p className="text-2xl font-bold">{metrics?.captureRate || 0}%</p>
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
                  <TabsTrigger value="response">Response</TabsTrigger>
                  <TabsTrigger value="business">Business Hours</TabsTrigger>
                  <TabsTrigger value="queue">Queue</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>
                
                <TabsContent value="response" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="after-hours-enabled">After-Hours Response</Label>
                      <Switch
                        id="after-hours-enabled"
                        checked={config.afterHoursEnabled}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, afterHoursEnabled: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instant-response">Instant Response</Label>
                      <Switch
                        id="instant-response"
                        checked={config.instantResponse}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, instantResponse: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="response-delay">Response Delay (minutes)</Label>
                      <Input
                        id="response-delay"
                        type="number"
                        value={config.responseDelay}
                        onChange={(e) => 
                          setConfig(prev => ({ ...prev, responseDelay: parseInt(e.target.value) || 5 }))
                        }
                        min={1}
                        max={60}
                      />
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium mb-2">Response Features</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• 24/7 lead capture</li>
                        <li>• Instant booking links</li>
                        <li>• Business hours detection</li>
                        <li>• Queue management</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="business" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="business-start">Business Hours Start</Label>
                      <Input
                        id="business-start"
                        type="time"
                        value={config.businessHours.start}
                        onChange={(e) => 
                          setConfig(prev => ({ 
                            ...prev, 
                            businessHours: { ...prev.businessHours, start: e.target.value }
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="business-end">Business Hours End</Label>
                      <Input
                        id="business-end"
                        type="time"
                        value={config.businessHours.end}
                        onChange={(e) => 
                          setConfig(prev => ({ 
                            ...prev, 
                            businessHours: { ...prev.businessHours, end: e.target.value }
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Input
                        id="timezone"
                        value={config.businessHours.timezone}
                        onChange={(e) => 
                          setConfig(prev => ({ 
                            ...prev, 
                            businessHours: { ...prev.businessHours, timezone: e.target.value }
                          }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium mb-2">Business Hours</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Monday - Friday: {config.businessHours.start} - {config.businessHours.end}</li>
                        <li>• Saturday - Sunday: Closed</li>
                        <li>• Automatic timezone detection</li>
                        <li>• Holiday configuration</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="queue" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="booking-link-expiry">Booking Link Expiry (hours)</Label>
                      <Input
                        id="booking-link-expiry"
                        type="number"
                        value={config.bookingLinkExpiry}
                        onChange={(e) => 
                          setConfig(prev => ({ ...prev, bookingLinkExpiry: parseInt(e.target.value) || 24 }))
                        }
                        min={1}
                        max={168}
                      />
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-medium mb-2">Queue Management</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Automatic queue processing</li>
                        <li>• Priority-based ordering</li>
                        <li>• Batch notification sending</li>
                        <li>• Real-time queue monitoring</li>
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
                        <li>• Advanced analytics</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Queue Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{metrics?.queueSize || 0}</p>
                    <p className="text-sm text-muted-foreground">Queue Size</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{metrics?.processedLeads || 0}</p>
                    <p className="text-sm text-muted-foreground">Processed Leads</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-medium mb-2">Recent Queue Activity</h4>
                  <div className="text-center p-4 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent activity</p>
                    <p className="text-xs">Activity will appear here when leads are processed</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Capture Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Capture Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{metrics?.totalLeads || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Leads</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{metrics?.afterHoursLeads || 0}</p>
                  <p className="text-sm text-muted-foreground">After-Hours Leads</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{metrics?.captureRate || 0}%</p>
                  <p className="text-sm text-muted-foreground">Capture Rate</p>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">24/7 Performance</h4>
                <div className="flex items-center space-x-2">
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-1">After-Hours Coverage</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 relative">
                      <div 
                        className="h-2 bg-green-500 rounded-full" 
                        style={{ width: `${Math.min(100, Math.max(0, metrics?.captureRate || 0))}%` }} 
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium">{metrics?.captureRate || 0}%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Target: 30% coverage | Current: {metrics?.captureRate || 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
