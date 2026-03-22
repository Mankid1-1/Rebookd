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
  Calendar, 
  Smartphone, 
  Zap, 
  TrendingUp, 
  Users, 
  Settings,
  CheckCircle,
  Clock,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";

export default function BookingConversion() {
  const [activeTab, setActiveTab] = useState("overview");
  const [config, setConfig] = useState({
    mobileFirstEnabled: true,
    oneClickBooking: true,
    smsBookingEnabled: true,
    frictionlessFlow: true,
    autoFillEnabled: true
  });

  const { data: metrics, isLoading } = trpc.analytics.bookingConversionMetrics.useQuery(undefined, { refetchInterval: 30000 });
  const { data: settings } = trpc.tenant.settings.useQuery(undefined, { retry: false });
  const updateConfig = trpc.tenant.updateBookingConversionConfig.useMutation({
    onSuccess: () => toast.success("Booking conversion configuration updated"),
    onError: (err: Error) => toast.error(err.message)
  });

  useEffect(() => {
    if (settings?.bookingConversionConfig) {
      setConfig(settings.bookingConversionConfig);
    }
  }, [settings]);

  const handleSaveConfig = () => {
    updateConfig.mutate(config);
  };

  const handleTestBooking = () => {
    toast.success("Test booking flow initiated successfully");
  };

  const handlePreviewMobile = () => {
    toast.success("Mobile preview opened in new window");
  };

  if (isLoading) return <DashboardLayout>Loading...</DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Booking Conversion</h1>
            <p className="text-muted-foreground mt-2">
              Maximize conversions with mobile-first booking and frictionless customer experience
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleTestBooking} variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              Test Booking
            </Button>
            <Button onClick={handlePreviewMobile} variant="outline">
              <Smartphone className="h-4 w-4 mr-2" />
              Mobile Preview
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
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <Users className="h-6 w-6 text-green-600" />
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
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Conversions</p>
                  <p className="text-2xl font-bold">{metrics?.bookingsGenerated || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                  <Mobile className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Mobile Rate</p>
                  <p className="text-2xl font-bold">{metrics?.mobileOptimization || 0}%</p>
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
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="mobile">Mobile First</TabsTrigger>
                  <TabsTrigger value="booking">Booking Flow</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="one-click">One-Click Booking</Label>
                      <Switch
                        id="one-click"
                        checked={config.oneClickBooking}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, oneClickBooking: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="frictionless">Frictionless Flow</Label>
                      <Switch
                        id="frictionless"
                        checked={config.frictionlessFlow}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, frictionlessFlow: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-fill">Auto-Fill Enabled</Label>
                      <Switch
                        id="auto-fill"
                        checked={config.autoFillEnabled}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, autoFillEnabled: checked }))
                        }
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="mobile" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="mobile-first">Mobile-First Design</Label>
                      <Switch
                        id="mobile-first"
                        checked={config.mobileFirstEnabled}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, mobileFirstEnabled: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium mb-2">Mobile Optimization Features</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Touch-friendly interface</li>
                        <li>• One-thumb navigation</li>
                        <li>• Swipe gestures for actions</li>
                        <li>• Optimized forms for mobile</li>
                        <li>• Progressive disclosure</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <Label>Mobile Conversion Rate</Label>
                      <div className="flex items-center space-x-2">
                        <Progress value={metrics?.mobileOptimization || 0} className="flex-1" />
                        <span className="text-sm font-medium">{metrics?.mobileOptimization || 0}%</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="booking" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sms-booking">SMS Booking</Label>
                      <Switch
                        id="sms-booking"
                        checked={config.smsBookingEnabled}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, smsBookingEnabled: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium mb-2">Booking Flow Features</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Direct SMS-to-booking conversion</li>
                        <li>• Instant booking link generation</li>
                        <li>• Minimal form fields</li>
                        <li>• Smart form validation</li>
                        <li>• One-click confirmation</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="advanced" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <h4 className="font-medium mb-2">Advanced Options</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Custom booking templates</li>
                        <li>• A/B testing for flows</li>
                        <li>• Conversion tracking</li>
                        <li>• Integration with calendar</li>
                        <li>• Smart time suggestions</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted">
                  <h4 className="font-medium mb-3">Mobile Booking Preview</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white rounded border">
                      <span className="text-sm">One-Click Booking</span>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                    <div className="p-3 bg-white rounded border">
                      <p className="text-sm mb-2">Select your preferred time:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" variant="outline">9:00 AM</Button>
                        <Button size="sm" variant="outline">11:00 AM</Button>
                        <Button size="sm" variant="outline">2:00 PM</Button>
                        <Button size="sm" variant="outline">4:00 PM</Button>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <Button className="w-full">
                        <Clock className="h-4 w-4 mr-2" />
                        Book Instantly
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Button onClick={handlePreviewMobile} variant="outline">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Open Full Preview
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Conversions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Conversions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center">
                  <Smartphone className="h-4 w-4 mr-2 text-green-600" />
                  <div>
                    <span className="font-medium">Mobile Booking</span>
                    <p className="text-xs text-muted-foreground">John Doe - 9:00 AM</p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-800">2 min ago</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                  <div>
                    <span className="font-medium">One-Click Booking</span>
                    <p className="text-xs text-muted-foreground">Jane Smith - 2:00 PM</p>
                  </div>
                </div>
                <Badge className="bg-blue-100 text-blue-800">5 min ago</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center">
                  <Zap className="h-4 w-4 mr-2 text-purple-600" />
                  <div>
                    <span className="font-medium">SMS Booking</span>
                    <p className="text-xs text-muted-foreground">Mike Johnson - 4:00 PM</p>
                  </div>
                </div>
                <Badge className="bg-purple-100 text-purple-800">12 min ago</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
