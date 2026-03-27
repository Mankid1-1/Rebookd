import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle,
  CreditCard,
  MessageSquare,
  Star,
  Zap,
  TrendingUp,
  ShieldCheck,
  Receipt,
  ArrowUpRight,
  FileText,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Billing() {
  const { data: plans = [], isLoading: plansLoading } = trpc.plans.list.useQuery();
  const { data: subscription, isLoading: subLoading } = trpc.tenant.subscription.useQuery(undefined, { retry: false });
  const { data: usage, isLoading: usageLoading } = trpc.tenant.usage.useQuery(undefined, { retry: false });
  const { data: billingHistory, isLoading: historyLoading } = trpc.billing.invoices.useQuery(undefined, { retry: false });
  const { data: tenant } = trpc.tenant.get.useQuery(undefined, { retry: false });
  const { data: dashData } = trpc.analytics.dashboard.useQuery(undefined, { retry: false });

  const currentPlan = plans.find((p) => p.id === subscription?.sub?.planId);
  const leadCount = dashData?.metrics?.leadCount ?? 0;
  const recoveredRevenue = (dashData?.metrics as any)?.recoveredRevenue ?? 0;
  const revenueSharePercent = currentPlan?.revenueSharePercent ?? 15;
  const revenueShareAmount = Math.round(recoveredRevenue * (revenueSharePercent / 100));

  const isPageLoading = plansLoading || subLoading;

  const checkout = trpc.billing.createCheckoutSession.useMutation();
  const changePlan = trpc.billing.changePlan.useMutation();
  const portal = trpc.billing.createCustomerPortal.useMutation();

  const handleUpgrade = (planId: number) => {
    const plan = plans.find((p) => p.id === planId);
    const subject = encodeURIComponent(`Rebooked Plan Upgrade Request — ${plan?.name ?? "Plan"}`);
    const body = encodeURIComponent(`Hi,

I'd like to upgrade my Rebooked subscription to the ${plan?.name ?? ""} plan ($${((plan?.priceMonthly ?? 0) / 100).toFixed(0)}/month).

My account email:

Please send me a payment link.

Thank you`);
    window.open(`mailto:support@rebooked.com?subject=${subject}&body=${body}`);
  };

  const handleCheckout = async (priceId?: string) => {
    if (!priceId) return toast.error("Payment not configured for this plan");
    try {
      const res = await checkout.mutateAsync({ priceId });
      if (res?.url) window.location.href = res.url;
      else toast.error("Failed to create checkout session");
    } catch (err) {
      console.error(err);
      toast.error("Error creating checkout session");
    }
  };

  const smsUsed = usage?.messagesSent ?? 0;
  const smsLimit = currentPlan?.maxMessages ?? 0;
  const smsPercent = smsLimit > 0 ? Math.min(100, Math.round((smsUsed / smsLimit) * 100)) : 0;

  const automationsEnabled = usage?.automationsRun ?? 0;
  const automationsLimit = currentPlan?.maxAutomations ?? 0;
  const automationsPercent = automationsLimit > 0 ? Math.min(100, Math.round((automationsEnabled / automationsLimit) * 100)) : 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Billing</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your subscription, usage, and invoices</p>
        </div>

        {/* Trial Banner */}
        {subscription?.sub?.status === "trialing" && subscription?.sub?.trialEndsAt && (() => {
          const daysLeft = Math.max(0, Math.ceil(
            (new Date(subscription.sub.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          ));
          return (
            <div className={`rounded-xl p-4 flex items-center gap-3 ${
              daysLeft <= 3 ? "bg-red-500/10 border border-red-500/20" : "bg-yellow-500/10 border border-yellow-500/20"
            }`}>
              <div className={`text-2xl font-bold ${daysLeft <= 3 ? "text-red-400" : "text-yellow-400"}`}>
                {daysLeft}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {daysLeft === 0 ? "Your trial ends today" : `Day${daysLeft !== 1 ? "s" : ""} left in your free trial`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {daysLeft <= 3
                    ? "Upgrade now to keep your automations running without interruption."
                    : "Upgrade anytime to continue after your trial ends."}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Current Plan Card */}
        {isPageLoading ? (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-7 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="space-y-2 text-right">
                  <Skeleton className="h-3 w-16 ml-auto" />
                  <Skeleton className="h-4 w-24 ml-auto" />
                </div>
              </div>
              <Skeleton className="h-9 w-40" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            </CardContent>
          </Card>
        ) : subscription && currentPlan ? (
          <Card className="border-primary/30 bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" /> Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      {currentPlan.name}
                    </h3>
                    <Badge className={
                      subscription.sub.status === "trialing" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" :
                      subscription.sub.status === "past_due" ? "bg-red-500/10 text-red-400 border-red-500/30" :
                      subscription.sub.status === "canceled" ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" :
                      "bg-green-500/10 text-green-400 border-green-500/30"
                    }>
                      {subscription.sub.status === "trialing" ? "Trial" :
                       subscription.sub.status === "past_due" ? "Past Due" :
                       subscription.sub.status === "canceled" ? "Canceled" : "Active"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm mt-1">
                    ${(currentPlan.priceMonthly / 100).toFixed(0)}/month
                    {currentPlan.revenueSharePercent > 0 && (
                      <span className="text-muted-foreground"> + {currentPlan.revenueSharePercent}% revenue share</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {subscription.sub.status === "trialing" ? "Trial ends" : "Next billing date"}
                  </p>
                  <p className="text-sm font-medium">
                    {subscription.sub.status === "trialing" && subscription.sub.trialEndsAt
                      ? new Date(subscription.sub.trialEndsAt).toLocaleDateString()
                      : subscription.sub.currentPeriodEnd
                      ? new Date(subscription.sub.currentPeriodEnd).toLocaleDateString()
                      : "--"}
                  </p>
                </div>
              </div>

              {/* Plan Features Summary */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {currentPlan.maxMessages.toLocaleString()} SMS/mo
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Zap className="h-3.5 w-3.5" />
                  {currentPlan.maxAutomations} automations
                </div>
              </div>

              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const res = await portal.mutateAsync({});
                    if (res?.url) window.location.href = res.url;
                    else toast.error("Could not open customer portal");
                  } catch (err) {
                    console.error(err);
                    toast.error("Error opening customer portal");
                  }
                }}
              >
                Manage Subscription
                <ArrowUpRight className="h-4 w-4 ml-1.5" />
              </Button>
            </CardContent>
          </Card>
        ) : !isPageLoading ? (
          <Card className="border-border bg-card">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <CreditCard className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">No active subscription</h3>
              <p className="text-sm text-muted-foreground mb-4">Choose a plan below to get started.</p>
            </CardContent>
          </Card>
        ) : null}

        {/* Usage Section */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* SMS Usage */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-400" /> SMS Usage
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {usageLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-2 w-full rounded-full" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Messages sent</span>
                    <span className="font-medium">
                      {smsUsed.toLocaleString()} / {smsLimit.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={smsPercent} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {smsPercent}% used this billing period
                    {smsPercent >= 90 && (
                      <span className="text-red-400 ml-2 font-medium">Near limit</span>
                    )}
                    {smsPercent >= 80 && smsPercent < 90 && (
                      <span className="text-yellow-400 ml-2">Approaching limit</span>
                    )}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Automations Usage */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" /> Automations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {usageLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-2 w-full rounded-full" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Runs this period</span>
                    <span className="font-medium">
                      {automationsEnabled.toLocaleString()} / {automationsLimit > 0 ? automationsLimit.toLocaleString() : "Unlimited"}
                    </span>
                  </div>
                  <Progress value={automationsPercent} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {automationsLimit > 0 ? `${automationsPercent}% used` : "Unlimited automation runs"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Revenue Share Tracking */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" /> Revenue Share Tracking
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Recovered Revenue</p>
                <p className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  ${(recoveredRevenue / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Revenue recovered via automations</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Revenue Share ({revenueSharePercent}%)</p>
                <p className="text-2xl font-bold text-green-400" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  ${(revenueShareAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Your share this billing period</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Net Savings</p>
                <p className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  ${((recoveredRevenue - revenueShareAmount) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Revenue you keep after share</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ROI Guarantee Status */}
        {currentPlan?.hasPromotion && (
          <Card className="border-green-500/20 bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-400" /> ROI Guarantee
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-green-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-1">You are covered by our ROI Guarantee</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    As one of our first {currentPlan.promotionalSlots} clients, your subscription is free
                    if total cost stays under ${(currentPlan.promotionalPriceCap / 100).toFixed(0)}/month.
                    If we don't deliver positive ROI, you pay nothing.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-green-500/10 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Revenue Recovered</p>
                      <p className="text-lg font-bold text-green-400">
                        ${(recoveredRevenue / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="rounded-lg bg-green-500/10 p-3">
                      <p className="text-xs text-muted-foreground mb-1">ROI Status</p>
                      <p className="text-lg font-bold text-green-400">
                        {recoveredRevenue > 0 ? "Positive" : "Pending"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Plans */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Available Plans
          </h2>
          {plansLoading ? (
            <div className="grid md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="border-border bg-card">
                  <CardContent className="p-5 space-y-4">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-9 w-20" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                    <Skeleton className="h-10 w-full rounded-md" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const isCurrentPlan = plan.id === subscription?.sub?.planId;
                const isPopular = plan.name === "Professional" || ((tenant as any)?.popularPlanId === plan.id);
                const hasRevenueShare = plan.revenueSharePercent && plan.revenueSharePercent > 0;
                return (
                  <Card
                    key={plan.id}
                    className={`relative border transition-all ${
                      isCurrentPlan
                        ? "border-primary/40 bg-card"
                        : isPopular
                        ? "border-primary/30 bg-card"
                        : "border-border bg-card"
                    }`}
                  >
                    {isPopular && !isCurrentPlan && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary/10 text-primary border-primary/30">
                        <Star className="w-3 h-3 mr-1" />
                        {(tenant as any)?.popularPlanId === plan.id ? "Recommended" : "Most Popular"}
                      </Badge>
                    )}
                    {isCurrentPlan && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500/10 text-green-400 border-green-500/30">
                        <CheckCircle className="w-3 h-3 mr-1" /> Current Plan
                      </Badge>
                    )}
                    <CardContent className="p-5">
                      <div className="mb-4">
                        <h3 className="font-bold text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                          {plan.name}
                        </h3>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-3xl font-bold">${(plan.priceMonthly / 100).toFixed(0)}</span>
                          <span className="text-muted-foreground text-sm">/mo</span>
                        </div>
                        {hasRevenueShare && (
                          <div className="mt-2">
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                              +{plan.revenueSharePercent}% of recovered revenue
                            </span>
                          </div>
                        )}
                        {plan.hasPromotion && plan.promotionalSlots > 0 && (
                          <div className="mt-2 space-y-1">
                            <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded-full font-medium">
                              Limited Time Offer
                            </span>
                            <p className="text-xs text-green-400 mt-1">
                              First {plan.promotionalSlots} clients: Free if total cost &le; ${(plan.promotionalPriceCap / 100).toFixed(0)}/month
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {plan.promotionalSlots} slots remaining
                            </p>
                          </div>
                        )}
                      </div>
                      <ul className="space-y-2 mb-5">
                        <li className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                          {plan.maxMessages.toLocaleString()} SMS/month
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                          {plan.maxAutomations} automations
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                          AI tone rewriting
                        </li>
                        {plan.name !== "Free" && (
                          <li className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                            Advanced analytics
                          </li>
                        )}
                        {hasRevenueShare && (
                          <li className="flex items-center gap-2 text-sm">
                            <Zap className="w-4 h-4 text-primary shrink-0" />
                            Revenue sharing model
                          </li>
                        )}
                      </ul>
                      <Button
                        className="w-full"
                        variant={isCurrentPlan ? "outline" : isPopular ? "default" : "outline"}
                        disabled={isCurrentPlan}
                        onClick={async () => {
                          if (isCurrentPlan) return;
                          if (!(plan as any).stripePriceId) {
                            handleUpgrade(plan.id);
                            return;
                          }
                          if (subscription?.sub?.stripeId) {
                            try {
                              await changePlan.mutateAsync({
                                priceId: (plan as any).stripePriceId,
                                prorateImmediately: true,
                              });
                              toast.success("Plan changed successfully");
                              window.location.reload();
                            } catch (err) {
                              console.error(err);
                              toast.error("Could not change the plan right now");
                            }
                          } else {
                            handleCheckout((plan as any).stripePriceId);
                          }
                        }}
                      >
                        {isCurrentPlan ? "Current Plan" : (plan as any).stripePriceId ? "Upgrade" : "Request Upgrade"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Usage Summary */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Usage This Period
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {usageLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="text-center space-y-2">
                    <Skeleton className="h-8 w-12 mx-auto" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{usage?.messagesSent ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">SMS Sent</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">--</p>
                  <p className="text-xs text-muted-foreground mt-1">AI Rewrites</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{usage?.automationsRun ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Automation Runs</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{leadCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Leads Added</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice History */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" /> Invoice History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            {historyLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-9 w-16 rounded-md" />
                      <Skeleton className="h-9 w-14 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (billingHistory?.invoices ?? []).length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No invoices yet. They will appear here once Stripe processes them.</p>
              </div>
            ) : (
              <>
                {billingHistory?.invoices.map((invoice) => (
                  <div key={invoice.stripeInvoiceId} className="flex flex-col gap-2 rounded-lg border border-border p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{invoice.number || invoice.stripeInvoiceId}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(invoice.createdAt).toLocaleDateString()} · ${(invoice.total / 100).toFixed(2)} {invoice.currency.toUpperCase()} ·{" "}
                        <Badge variant="outline" className={`text-xs ml-1 ${
                          invoice.status === "paid" ? "text-green-400 border-green-500/30" :
                          invoice.status === "open" ? "text-yellow-400 border-yellow-500/30" :
                          "text-muted-foreground"
                        }`}>
                          {invoice.status}
                        </Badge>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {invoice.hostedInvoiceUrl && (
                        <Button variant="outline" size="sm" onClick={() => window.open(invoice.hostedInvoiceUrl!, "_blank")}>
                          View
                        </Button>
                      )}
                      {invoice.invoicePdfUrl && (
                        <Button size="sm" onClick={() => window.open(invoice.invoicePdfUrl!, "_blank")}>
                          PDF
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {(billingHistory?.refunds ?? []).length > 0 && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Refunds</p>
                    {billingHistory?.refunds.map((refund) => (
                      <div key={refund.stripeRefundId} className="text-sm text-muted-foreground py-1">
                        {new Date(refund.createdAt).toLocaleDateString()} · ${(refund.amount / 100).toFixed(2)} {refund.currency.toUpperCase()} refunded · {refund.status}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
