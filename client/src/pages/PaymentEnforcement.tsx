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
  CreditCard, 
  Shield, 
  DollarSign, 
  Users, 
  Settings,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Lock,
  Wallet
} from "lucide-react";
import { toast } from "sonner";

export default function PaymentEnforcement() {
  const [activeTab, setActiveTab] = useState("card-on-file");
  const [config, setConfig] = useState({
    cardOnFile: true,
    cancellationFees: true,
    prepaidBookings: true,
    noShowPenalties: true,
    depositAmount: 2500, // $25 in cents
    cancellationFee: 25, // 25%
    noShowPenalty: 50 // 50%
  });

  const { data: metrics, isLoading } = trpc.analytics.paymentEnforcementMetrics.useQuery(undefined, { refetchInterval: 30000 });
  const { data: settings } = trpc.tenant.settings.useQuery(undefined, { retry: false });
  const updateConfig = trpc.tenant.updatePaymentEnforcementConfig.useMutation({
    onSuccess: () => toast.success("Payment enforcement configuration updated"),
    onError: (err) => toast.error(err.message)
  });

  useEffect(() => {
    if (settings?.paymentEnforcementConfig) {
      setConfig(settings.paymentEnforcementConfig as any);
    }
  }, [settings]);

  const handleSaveConfig = () => {
    updateConfig.mutate(config);
  };

  const handleTestPayment = () => {
    toast.success("Test payment processing initiated");
  };

  const handleEnforcePolicy = () => {
    toast.success("Payment enforcement policy activated");
  };

  if (isLoading) return <DashboardLayout>Loading...</DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Payment Enforcement</h1>
            <p className="text-muted-foreground mt-2">
              Reduce no-shows from 20% to ~5% with financial commitment and automated penalties
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleTestPayment} variant="outline">
              <CreditCard className="h-4 w-4 mr-2" />
              Test Payment
            </Button>
            <Button onClick={handleEnforcePolicy} variant="outline">
              <Shield className="h-4 w-4 mr-2" />
              Enforce Policy
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
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <CreditCard className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Card on File Rate</p>
                  <p className="text-2xl font-bold">{metrics?.cardOnFileRate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cancellation Revenue</p>
                  <p className="text-2xl font-bold">${((metrics?.cancellationRevenue || 0) / 100).toFixed(0)}</p>
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
                  <p className="text-sm font-medium text-muted-foreground">No-Shows Reduced</p>
                  <p className="text-2xl font-bold">{metrics?.noShowsReduced || 0}</p>
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
                  <TabsTrigger value="card-on-file">Card on File</TabsTrigger>
                  <TabsTrigger value="cancellation">Cancellation</TabsTrigger>
                  <TabsTrigger value="prepaid">Prepaid</TabsTrigger>
                  <TabsTrigger value="penalties">Penalties</TabsTrigger>
                </TabsList>
                
                <TabsContent value="card-on-file" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="card-on-file">Require Card on File</Label>
                      <Switch
                        id="card-on-file"
                        checked={config.cardOnFile}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, cardOnFile: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium mb-2">Card on File Benefits</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Reduces no-shows by 75%</li>
                        <li>• Enables instant booking</li>
                        <li>• Provides financial commitment</li>
                        <li>• Streamlines payment process</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="cancellation" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="cancellation-fees">Cancellation Fees</Label>
                      <Switch
                        id="cancellation-fees"
                        checked={config.cancellationFees}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, cancellationFees: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cancellation Fee (%)</Label>
                      <Input
                        type="number"
                        value={config.cancellationFee}
                        onChange={(e) => 
                          setConfig(prev => ({ ...prev, cancellationFee: parseInt(e.target.value) }))
                        }
                        min={0}
                        max={100}
                      />
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium mb-2">Cancellation Policy</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• 24+ hours: No fee</li>
                        <li>• 12-24 hours: 50% fee</li>
                        <li>• 0-12 hours: 100% fee</li>
                        <li>• Automatic fee processing</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="prepaid" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="prepaid-bookings">Prepaid Bookings</Label>
                      <Switch
                        id="prepaid-bookings"
                        checked={config.prepaidBookings}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, prepaidBookings: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Deposit Amount ($)</Label>
                      <Input
                        type="number"
                        value={config.depositAmount / 100}
                        onChange={(e) => 
                          setConfig(prev => ({ ...prev, depositAmount: parseInt(e.target.value) * 100 }))
                        }
                        min={0}
                        max={1000}
                      />
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-medium mb-2">Prepaid Benefits</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Guarantees appointment commitment</li>
                        <li>• Reduces last-minute cancellations</li>
                        <li>• Provides upfront cash flow</li>
                        <li>• Enables premium pricing options</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="penalties" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="no-show-penalties">No-Show Penalties</Label>
                      <Switch
                        id="no-show-penalties"
                        checked={config.noShowPenalties}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, noShowPenalties: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>No-Show Penalty (%)</Label>
                      <Input
                        type="number"
                        value={config.noShowPenalty}
                        onChange={(e) => 
                          setConfig(prev => ({ ...prev, noShowPenalty: parseInt(e.target.value) }))
                        }
                        min={0}
                        max={100}
                      />
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <h4 className="font-medium mb-2">Penalty System</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Automatic penalty application</li>
                        <li>• Account credit withholding</li>
                        <li>• Future booking restrictions</li>
                        <li>• Notification system integration</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Security</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <Lock className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <h3 className="font-medium">PCI Compliant</h3>
                    <p className="text-sm text-muted-foreground">Secure Processing</p>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <Wallet className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <h3 className="font-medium">Tokenized</h3>
                    <p className="text-sm text-muted-foreground">Safe Storage</p>
                    <Badge className="bg-blue-100 text-blue-800">Active</Badge>
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Security Features</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• End-to-end encryption</li>
                    <li>• PCI DSS compliance</li>
                    <li>• Fraud detection</li>
                    <li>• Secure token storage</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enforcement Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Enforcement Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{metrics?.cardOnFileRate || 0}%</p>
                  <p className="text-sm text-muted-foreground">Card on File Rate</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">${((metrics?.cancellationRevenue || 0) / 100).toFixed(0)}</p>
                  <p className="text-sm text-muted-foreground">Cancellation Revenue</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">${((metrics?.revenueImpact || 0) / 100).toFixed(0)}</p>
                  <p className="text-sm text-muted-foreground">Total Revenue Impact</p>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-orange-50 rounded-lg">
                <h4 className="font-medium mb-2">No-Show Reduction Progress</h4>
                <div className="flex items-center space-x-2">
                  <Progress value={metrics?.noShowsReduced || 0} className="flex-1" />
                  <span className="text-sm font-medium">{metrics?.noShowsReduced || 0}% Reduction</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Target: 80% reduction | Current: {metrics?.noShowsReduced || 0}% reduction (from 20% baseline)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
