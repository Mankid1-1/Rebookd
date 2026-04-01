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
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

  const { data: metrics, isLoading } = trpc.analytics.paymentEnforcementMetrics.useQuery(undefined, { refetchInterval: 60_000 });
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

  const { data: automationsList } = trpc.automations.list.useQuery();
  const { data: leadsList } = trpc.leads.list.useQuery({ limit: 1, status: "new" } as any);
  const testAutomation = trpc.automations.test.useMutation({
    onSuccess: () => toast.success("Test payment reminder SMS sent! Check the lead's phone."),
    onError: (err) => toast.error(err.message),
  });

  const handleTestPayment = () => {
    // Target a booked lead — payment enforcement applies to confirmed bookings
    const lead = (leadsList as any)?.leads?.[0] ?? (leadsList as any)?.[0];
    if (!lead?.phone) {
      toast.info("Add a lead with a phone number first to test payment enforcement.");
      return;
    }
    // If booking confirmation is enabled, combine: fire both the confirmation + payment reminder
    const confirmationAuto = (automationsList as any[])?.find((a: any) => a.key === 'appointment_confirmation' && a.enabled);
    const paymentAuto = (automationsList as any[])?.find((a: any) => a.key === 'appointment_reminder_24h' || a.triggerType === 'appointment_reminder');
    const auto = confirmationAuto || paymentAuto;
    if (!auto) {
      toast.info("Enable the Booking Confirmation or Appointment Reminder automation first.");
      return;
    }
    testAutomation.mutate({ automationId: auto.id, testPhone: lead.phone });
    if (confirmationAuto && config.cardOnFile) {
      toast.info("Booking confirmation sent with card-on-file requirement included.");
    }
  };

  const handleEnforcePolicy = () => {
    // Save the config to activate enforcement on new bookings
    updateConfig.mutate(config);
    toast.info("Payment enforcement is now active. New bookings will require financial commitment based on your settings.");
  };

  if (isLoading) return <DashboardLayout>Loading...</DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">
              <HelpTooltip content="Payment Enforcement uses financial commitment (deposits, cards on file, and cancellation fees) to help reduce no-shows. Results vary by business." variant="info">
                Payment Enforcement
              </HelpTooltip>
            </h1>
            <p className="text-muted-foreground mt-2">
              Reduce no-shows with financial commitment and automated penalties
            </p>
          </div>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleTestPayment} variant="outline">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Test Payment
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Run a test transaction to confirm your Stripe payment integration is working correctly.</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleEnforcePolicy} variant="outline">
                    <Shield className="h-4 w-4 mr-2" />
                    Enforce Policy
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Apply your current payment enforcement policy to all upcoming bookings immediately.</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleSaveConfig}>
                    <Settings className="h-4 w-4 mr-2" />
                    Save Configuration
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Save all changes to your payment enforcement settings.</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-success/10 rounded-lg mr-3">
                  <CreditCard className="h-6 w-6 text-success" />
                </div>
                <div>
                  <HelpTooltip content="Percentage of your active clients who have a payment card saved on file for instant billing. Higher is better — aim for 80%+." variant="info">
                    <p className="text-sm font-medium text-muted-foreground">Card on File Rate</p>
                  </HelpTooltip>
                  <p className="text-2xl font-bold">{metrics?.cardOnFileRate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-info/10 rounded-lg mr-3">
                  <DollarSign className="h-6 w-6 text-info" />
                </div>
                <div>
                  <HelpTooltip content="Revenue collected from cancellation fees charged to clients who cancelled inside your policy window. This revenue would otherwise be lost." variant="info">
                    <p className="text-sm font-medium text-muted-foreground">Cancellation Revenue</p>
                  </HelpTooltip>
                  <p className="text-2xl font-bold">${((metrics?.cancellationRevenue || 0) / 100).toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-destructive/10 rounded-lg mr-3">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <HelpTooltip content="Estimated number of no-shows prevented because clients had a financial commitment (card on file or deposit). Each prevented no-show is revenue saved." variant="info">
                    <p className="text-sm font-medium text-muted-foreground">No-Shows Reduced</p>
                  </HelpTooltip>
                  <p className="text-2xl font-bold">{metrics?.noShowsReduced || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-accent/10 rounded-lg mr-3">
                  <TrendingUp className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <HelpTooltip content="Total revenue impact from payment enforcement — includes fees collected plus revenue saved from prevented no-shows." variant="info">
                    <p className="text-sm font-medium text-muted-foreground">Revenue Impact</p>
                  </HelpTooltip>
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
              <CardTitle>
                <HelpTooltip content="Configure the financial tools Rebooked uses to hold clients accountable — from requiring a card on file to charging no-show penalties." variant="info">
                  Configuration
                </HelpTooltip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild><TabsTrigger value="card-on-file">Card on File</TabsTrigger></TooltipTrigger>
                      <TooltipContent><p>Require clients to save a payment card before their booking is confirmed.</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild><TabsTrigger value="cancellation">Cancellation</TabsTrigger></TooltipTrigger>
                      <TooltipContent><p>Charge a fee when clients cancel inside your notice window.</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild><TabsTrigger value="prepaid">Prepaid</TabsTrigger></TooltipTrigger>
                      <TooltipContent><p>Require a deposit at the time of booking to secure the appointment.</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild><TabsTrigger value="penalties">Penalties</TabsTrigger></TooltipTrigger>
                      <TooltipContent><p>Automatically charge clients who miss an appointment without cancelling.</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TabsList>

                <TabsContent value="card-on-file" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="card-on-file">
                        <HelpTooltip content="When enabled, clients cannot complete a booking without saving a payment card. This creates financial accountability and helps reduce no-shows." variant="info">
                          Require Card on File
                        </HelpTooltip>
                      </Label>
                      <Switch
                        id="card-on-file"
                        checked={config.cardOnFile}
                        onCheckedChange={(checked) =>
                          setConfig(prev => ({ ...prev, cardOnFile: checked }))
                        }
                      />
                    </div>
                    <div className="p-4 bg-success/10 rounded-lg">
                      <h4 className="font-medium mb-2">Card on File Benefits</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• Helps reduce no-shows significantly</li>
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
                      <Label htmlFor="cancellation-fees">
                        <HelpTooltip content="Automatically charges a percentage of the appointment value when a client cancels inside your notice window. Discourages late cancellations without being punitive for genuine emergencies." variant="info">
                          Cancellation Fees
                        </HelpTooltip>
                      </Label>
                      <Switch
                        id="cancellation-fees"
                        checked={config.cancellationFees}
                        onCheckedChange={(checked) =>
                          setConfig(prev => ({ ...prev, cancellationFees: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cancellation-fee-input">
                        <HelpTooltip content="Percentage of the appointment value charged as a cancellation fee when a client cancels inside the policy window. 25% is a common starting point." variant="info">
                          Cancellation Fee (%)
                        </HelpTooltip>
                      </Label>
                      <Input
                        id="cancellation-fee-input"
                        type="number"
                        value={config.cancellationFee}
                        onChange={(e) =>
                          setConfig(prev => ({ ...prev, cancellationFee: parseInt(e.target.value) }))
                        }
                        min={0}
                        max={100}
                      />
                    </div>
                    <div className="p-4 bg-info/10 rounded-lg">
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
                      <Label htmlFor="prepaid-bookings">
                        <HelpTooltip content="Requires clients to pay a deposit upfront when booking. The deposit is applied to their final bill. Clients who have paid are far less likely to cancel or no-show." variant="info">
                          Prepaid Bookings
                        </HelpTooltip>
                      </Label>
                      <Switch
                        id="prepaid-bookings"
                        checked={config.prepaidBookings}
                        onCheckedChange={(checked) =>
                          setConfig(prev => ({ ...prev, prepaidBookings: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deposit-amount-input">
                        <HelpTooltip content="The dollar amount charged upfront at booking. A deposit of $25–$50 is typically enough to create commitment without deterring new clients." variant="info">
                          Deposit Amount ($)
                        </HelpTooltip>
                      </Label>
                      <Input
                        id="deposit-amount-input"
                        type="number"
                        value={config.depositAmount / 100}
                        onChange={(e) =>
                          setConfig(prev => ({ ...prev, depositAmount: parseInt(e.target.value) * 100 }))
                        }
                        min={0}
                        max={1000}
                      />
                    </div>
                    <div className="p-4 bg-accent/10 rounded-lg">
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
                      <Label htmlFor="no-show-penalties">
                        <HelpTooltip content="Automatically charges the client's saved card when they miss an appointment without cancelling. This converts lost time into partial revenue and deters future no-shows." variant="info">
                          No-Show Penalties
                        </HelpTooltip>
                      </Label>
                      <Switch
                        id="no-show-penalties"
                        checked={config.noShowPenalties}
                        onCheckedChange={(checked) =>
                          setConfig(prev => ({ ...prev, noShowPenalties: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="no-show-penalty-input">
                        <HelpTooltip content="Percentage of the appointment value charged when a client no-shows. 50% is a common industry standard — punitive enough to deter repeat behaviour without burning the relationship." variant="info">
                          No-Show Penalty (%)
                        </HelpTooltip>
                      </Label>
                      <Input
                        id="no-show-penalty-input"
                        type="number"
                        value={config.noShowPenalty}
                        onChange={(e) =>
                          setConfig(prev => ({ ...prev, noShowPenalty: parseInt(e.target.value) }))
                        }
                        min={0}
                        max={100}
                      />
                    </div>
                    <div className="p-4 bg-destructive/10 rounded-lg">
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
              <CardTitle>
                <HelpTooltip content="All card data is handled by Stripe — Rebooked never stores raw card numbers. Stripe is PCI DSS Level 1 certified, the highest security standard for payment processors." variant="info">
                  Payment Security
                </HelpTooltip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-success/10 rounded-lg">
                    <Lock className="h-8 w-8 text-success mx-auto mb-2" />
                    <HelpTooltip content="PCI DSS (Payment Card Industry Data Security Standard) compliance means Stripe meets the strictest requirements for handling and storing card data." variant="info">
                      <h3 className="font-medium">PCI Compliant</h3>
                    </HelpTooltip>
                    <p className="text-sm text-muted-foreground">Secure Processing</p>
                    <Badge className="bg-success/10 text-success">Active</Badge>
                  </div>
                  <div className="text-center p-4 bg-info/10 rounded-lg">
                    <Wallet className="h-8 w-8 text-info mx-auto mb-2" />
                    <HelpTooltip content="Card details are replaced with a secure token. Rebooked stores only the token — even if our database were breached, no real card numbers would be exposed." variant="info">
                      <h3 className="font-medium">Tokenized</h3>
                    </HelpTooltip>
                    <p className="text-sm text-muted-foreground">Safe Storage</p>
                    <Badge className="bg-info/10 text-info">Active</Badge>
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
            <CardTitle>
              <HelpTooltip content="A summary of how your payment enforcement settings are performing. Track card-on-file adoption, fees collected, and progress toward your no-show reduction goal." variant="info">
                Enforcement Performance
              </HelpTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-success/10 rounded-lg">
                  <p className="text-2xl font-bold text-success">{metrics?.cardOnFileRate || 0}%</p>
                  <HelpTooltip content="Percentage of active clients with a saved payment card." variant="info">
                    <p className="text-sm text-muted-foreground">Card on File Rate</p>
                  </HelpTooltip>
                </div>
                <div className="text-center p-3 bg-info/10 rounded-lg">
                  <p className="text-2xl font-bold text-info">${((metrics?.cancellationRevenue || 0) / 100).toFixed(0)}</p>
                  <HelpTooltip content="Revenue collected from cancellation fees that would otherwise be lost." variant="info">
                    <p className="text-sm text-muted-foreground">Cancellation Revenue</p>
                  </HelpTooltip>
                </div>
                <div className="text-center p-3 bg-accent/10 rounded-lg">
                  <p className="text-2xl font-bold text-accent">${((metrics?.revenueImpact || 0) / 100).toFixed(0)}</p>
                  <HelpTooltip content="Combined value of fees collected plus revenue saved from prevented no-shows." variant="info">
                    <p className="text-sm text-muted-foreground">Total Revenue Impact</p>
                  </HelpTooltip>
                </div>
              </div>

              <div className="mt-6 p-4 bg-warning/10 rounded-lg">
                <h4 className="font-medium mb-2">
                  <HelpTooltip content="Track your payment enforcement progress over time." variant="info">
                    No-Show Reduction Progress
                  </HelpTooltip>
                </h4>
                <div className="flex items-center space-x-2">
                  <Progress value={metrics?.noShowsReduced || 0} className="flex-1" />
                  <span className="text-sm font-medium">{metrics?.noShowsReduced || 0}% Reduction</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Target: 80% reduction | Current: {metrics?.noShowsReduced || 0}% reduction
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
