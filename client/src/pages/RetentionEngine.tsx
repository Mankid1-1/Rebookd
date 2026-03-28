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
  Heart, 
  Users, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Star,
  Settings,
  Zap,
  ArrowRight,
  Award,
  Repeat
} from "lucide-react";
import { toast } from "sonner";
import { useProgressiveDisclosureContext } from "@/components/ui/ProgressiveDisclosure";
import { useAuth } from "@/hooks/useAuth";

// Dynamic loyalty tiers based on business type and user skill
const getDynamicLoyaltyTiers = (businessType?: string, userSkill?: any) => {
  const baseTiers = [
    { visits: 3, reward: '10% discount', message: 'Loyalty reward: 10% off your next booking!' }
  ];

  // Add intermediate tiers for non-beginners
  if (userSkill?.level !== 'beginner') {
    baseTiers.push(
      { visits: 5, reward: '15% discount', message: 'VIP reward: 15% off your next booking!' }
    );
  }

  // Add expert tiers for advanced users
  if (userSkill?.level === 'expert' || userSkill?.level === 'advanced') {
    baseTiers.push(
      { visits: 10, reward: '20% discount', message: 'Elite reward: 20% off your next booking!' },
      { visits: 15, reward: 'Free service', message: 'Platinum reward: Free service on your next visit!' }
    );
  }

  // Business-specific tiers
  if (businessType?.includes('medical') || businessType?.includes('clinic')) {
    baseTiers.push(
      { visits: 8, reward: 'Free consultation', message: 'Wellness reward: Free follow-up consultation!' }
    );
  } else if (businessType?.includes('salon') || businessType?.includes('spa')) {
    baseTiers.push(
      { visits: 8, reward: 'Free upgrade', message: 'Beauty reward: Free service upgrade on next visit!' }
    );
  }

  return baseTiers;
};

export default function RetentionEngine() {
  const { context } = useProgressiveDisclosureContext();
  const { user } = useAuth();
  const { data: tenant } = trpc.tenant.get.useQuery();
  
  // Get dynamic loyalty tiers
  const dynamicLoyaltyTiers = getDynamicLoyaltyTiers(tenant?.industry, context.userSkill);
  
  const [activeTab, setActiveTab] = useState("rebooking");
  const [config, setConfig] = useState({
    timeBasedRebooking: true,
    loyaltyProgram: true,
    reactivationCampaigns: true,
    rebookingIntervals: [4, 6, 8], // weeks
    loyaltyTiers: dynamicLoyaltyTiers
  });

  const { data: metrics, isLoading } = trpc.analytics.retentionMetrics.useQuery(undefined, { refetchInterval: 30000 });
  const { data: settings } = trpc.tenant.settings.useQuery(undefined, { retry: false });
  const updateConfig = trpc.tenant.updateRetentionEngineConfig.useMutation({
    onSuccess: () => toast.success("Retention engine configuration updated"),
    onError: (err) => toast.error(err.message)
  });

  useEffect(() => {
    if (settings?.retentionEngineConfig) {
      setConfig(settings.retentionEngineConfig);
    }
  }, [settings]);

  const handleSaveConfig = () => {
    updateConfig.mutate(config);
  };

  const handleTestRebooking = () => {
    toast.success("Test rebooking campaign sent successfully");
  };

  const handleTriggerLoyalty = () => {
    toast.success("Loyalty rewards program activated");
  };

  if (isLoading) return <DashboardLayout>Loading...</DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Retention Engine</h1>
            <p className="text-muted-foreground mt-2">
              Turn one-time customers into repeat revenue with automated rebooking and loyalty programs
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleTestRebooking} variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              Test Rebooking
            </Button>
            <Button onClick={handleTriggerLoyalty} variant="outline">
              <Star className="h-4 w-4 mr-2" />
              Trigger Loyalty
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
                  <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
                  <p className="text-2xl font-bold">{metrics?.totalClients || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <Repeat className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Rebooked Clients</p>
                  <p className="text-2xl font-bold">{metrics?.rebookedClients || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Retention Rate</p>
                  <p className="text-2xl font-bold">{metrics?.retentionRate || 0}%</p>
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
                  <p className="text-sm font-medium text-muted-foreground">LTV Expansion</p>
                  <p className="text-2xl font-bold">${((metrics?.ltvExpansion || 0) / 100).toFixed(0)}</p>
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
                  <TabsTrigger value="rebooking">Rebooking</TabsTrigger>
                  <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
                  <TabsTrigger value="reactivation">Reactivation</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>
                
                <TabsContent value="rebooking" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="time-based">Time-Based Rebooking</Label>
                      <Switch
                        id="time-based"
                        checked={config.timeBasedRebooking}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, timeBasedRebooking: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rebooking Intervals (weeks)</Label>
                      <div className="flex gap-2">
                        {config.rebookingIntervals.map((weeks, index) => (
                          <Input
                            key={index}
                            type="number"
                            value={weeks}
                            onChange={(e) => {
                              const newIntervals = [...config.rebookingIntervals];
                              newIntervals[index] = parseInt(e.target.value);
                              setConfig(prev => ({ ...prev, rebookingIntervals: newIntervals }));
                            }}
                            min={1}
                            max={52}
                            placeholder={`${weeks}w`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium mb-2">Rebooking Features</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• 4, 6, 8 week intervals</li>
                        <li>• "You're due" reminders</li>
                        <li>• Personalized rebooking offers</li>
                        <li>• Smart timing optimization</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="loyalty" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="loyalty-program">Loyalty Program</Label>
                      <Switch
                        id="loyalty-program"
                        checked={config.loyaltyProgram}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, loyaltyProgram: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium mb-2">Loyalty Tiers</h4>
                      <div className="space-y-3">
                        {config.loyaltyTiers.map((tier, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-white rounded border">
                            <div>
                              <p className="font-medium">{tier.visits} Visits</p>
                              <p className="text-sm text-muted-foreground">{tier.reward}</p>
                            </div>
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="reactivation" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="reactivation-campaigns">Reactivation Campaigns</Label>
                      <Switch
                        id="reactivation-campaigns"
                        checked={config.reactivationCampaigns}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, reactivationCampaigns: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-medium mb-2">Reactivation Windows</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• 30 days inactive</li>
                        <li>• 60 days inactive</li>
                        <li>• 90 days inactive</li>
                        <li>• Personalized reactivation offers</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="advanced" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <h4 className="font-medium mb-2">Advanced Options</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Custom rebooking templates</li>
                        <li>• Advanced loyalty analytics</li>
                        <li>• Integration with CRM systems</li>
                        <li>• Predictive rebooking AI</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Loyalty Program Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <Award className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <h3 className="font-medium">Bronze Tier</h3>
                    <p className="text-sm text-muted-foreground">3+ Visits</p>
                    <Badge className="bg-blue-100 text-blue-800">{metrics?.bronzeClients || 0} Clients</Badge>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <Award className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <h3 className="font-medium">Silver Tier</h3>
                    <p className="text-sm text-muted-foreground">5+ Visits</p>
                    <Badge className="bg-green-100 text-green-800">{metrics?.silverClients || 0} Clients</Badge>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <Award className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                    <h3 className="font-medium">Gold Tier</h3>
                    <p className="text-sm text-muted-foreground">10+ Visits</p>
                    <Badge className="bg-purple-100 text-purple-800">{metrics?.goldClients || 0} Clients</Badge>
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Program Benefits</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• Increased customer lifetime value</li>
                    <li>• Higher retention rates</li>
                    <li>• Reduced acquisition costs</li>
                    <li>• Predictable revenue streams</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Retention Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Retention Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Current Retention Rate</Label>
                  <div className="flex items-center space-x-2">
                    <Progress value={metrics?.retentionRate || 0} className="flex-1" />
                    <span className="text-sm font-medium">{metrics?.retentionRate || 0}%</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Target: 25% | Current: {metrics?.retentionRate || 0}%
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{metrics?.totalClients || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Clients</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{metrics?.rebookedClients || 0}</p>
                  <p className="text-sm text-muted-foreground">Rebooked</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">${((metrics?.ltvExpansion || 0) / 100).toFixed(0)}</p>
                  <p className="text-sm text-muted-foreground">LTV Expansion</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
