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
import { HelpTooltip } from "@/components/ui/HelpTooltip";

export default function BookingConversion() {
  const [activeTab, setActiveTab] = useState("overview");
  const [config, setConfig] = useState({
    mobileFirstEnabled: true,
    oneClickBooking: true,
    smsBookingEnabled: true,
    frictionlessFlow: true,
    autoFillEnabled: true
  });

  const { data: metrics, isLoading, error: metricsError } = trpc.analytics.bookingConversionMetrics.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: 2,
    retryDelay: 3000,
  });
  const { data: settings } = trpc.tenant.settings.useQuery(undefined, { retry: false });
  const updateConfig = trpc.tenant.updateBookingConversionConfig.useMutation({
    onSuccess: () => toast.success("Booking conversion configuration updated"),
    onError: (err: any) => toast.error(err.message)
  });

  useEffect(() => {
    if (settings?.bookingConversionConfig) {
      setConfig(settings.bookingConversionConfig as any);
    }
  }, [settings]);

  const handleSaveConfig = () => {
    updateConfig.mutate(config);
  };

  if (isLoading && !metricsError) return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">Loading booking conversion data...</div></div></DashboardLayout>;
  if (metricsError) return <DashboardLayout><div className="flex flex-col items-center justify-center h-64 gap-4"><p className="text-muted-foreground">Unable to load booking metrics right now.</p><Button variant="outline" onClick={() => window.location.reload()}>Retry</Button></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">Booking Conversion</h1>
              <HelpTooltip content="Tracks how many of your leads convert into actual booked appointments and helps improve that rate." variant="info"><span /></HelpTooltip>
            </div>
            <p className="text-muted-foreground mt-2">
              Maximize conversions with mobile-first booking and frictionless customer experience
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button onClick={handleSaveConfig} className="whitespace-nowrap">
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
                <div className="p-2 bg-success/10 rounded-lg mr-3">
                  <Users className="h-6 w-6 text-success" />
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
                <div className="p-2 bg-info/10 rounded-lg mr-3">
                  <TrendingUp className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    <HelpTooltip content="Leads who completed a booking after clicking a Rebooked booking link" variant="info">
                      Conversions
                    </HelpTooltip>
                  </p>
                  <p className="text-2xl font-bold">{metrics?.bookingsGenerated || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-accent/10 rounded-lg mr-3">
                  <Smartphone className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    <HelpTooltip content="Percentage of bookings completed on a mobile device. High mobile rate = friction-free flow is critical." variant="info">
                      Mobile Rate
                    </HelpTooltip>
                  </p>
                  <p className="text-2xl font-bold">{metrics?.mobileOptimization || 0}%</p>
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
                    <HelpTooltip content="Estimated monthly revenue increase from reducing booking friction" variant="info">
                      Revenue Impact
                    </HelpTooltip>
                  </p>
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
                      <Label htmlFor="one-click">
                        <HelpTooltip content="Lets clients book with a single tap — no account creation or form filling required" variant="info">
                          One-Click Booking
                        </HelpTooltip>
                      </Label>
                      <Switch
                        id="one-click"
                        checked={config.oneClickBooking}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, oneClickBooking: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="frictionless">
                        <HelpTooltip content="Removes extra confirmation steps from the booking process to reduce drop-off" variant="info">
                          Frictionless Flow
                        </HelpTooltip>
                      </Label>
                      <Switch
                        id="frictionless"
                        checked={config.frictionlessFlow}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, frictionlessFlow: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-fill">
                        <HelpTooltip content="Pre-fills client details from their SMS conversation so they don't have to retype them" variant="info">
                          Auto-Fill Enabled
                        </HelpTooltip>
                      </Label>
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
                      <Label htmlFor="mobile-first">
                        <HelpTooltip content="Optimizes the booking page layout specifically for small screens" variant="info">
                          Mobile-First Design
                        </HelpTooltip>
                      </Label>
                      <Switch
                        id="mobile-first"
                        checked={config.mobileFirstEnabled}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, mobileFirstEnabled: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-info/10 rounded-lg">
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
                      <Label htmlFor="sms-booking">
                        <HelpTooltip content="Allows clients to book directly by replying to an SMS with a keyword like YES or BOOK" variant="info">
                          SMS Booking
                        </HelpTooltip>
                      </Label>
                      <Switch
                        id="sms-booking"
                        checked={config.smsBookingEnabled}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, smsBookingEnabled: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-success/10 rounded-lg">
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
                    <div className="p-4 bg-warning/10 rounded-lg">
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
                      <Badge className="bg-success/10 text-success">Active</Badge>
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
                  <p className="text-xs text-muted-foreground">Preview of your booking experience</p>
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
              <div className="text-center p-4 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent conversions</p>
                <p className="text-xs">Recent booking conversions will appear here</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
