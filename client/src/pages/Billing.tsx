import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CheckCircle, CreditCard, MessageSquare, Star, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Billing() {
  const { data: plans = [] } = trpc.plans.list.useQuery();
  const { data: subscription } = trpc.tenant.subscription.useQuery(undefined, { retry: false });
  const { data: usage } = trpc.tenant.usage.useQuery(undefined, { retry: false });
  const { data: billingHistory } = trpc.billing.invoices.useQuery(undefined, { retry: false });

  const currentPlan = plans.find((p) => p.id === subscription?.sub?.planId);
  const { data: dashData } = trpc.analytics.dashboard.useQuery(undefined, { retry: false });
  const leadCount = dashData?.metrics?.leadCount ?? 0;

  const handleUpgrade = (planId: number) => {
    // Opens default email client with pre-filled upgrade request
    const plan = plans.find((p) => p.id === planId);
    const subject = encodeURIComponent(`Rebooked Plan Upgrade Request — ${plan?.name ?? "Plan"}`);
    const body = encodeURIComponent(`Hi,

I'd like to upgrade my Rebooked subscription to the ${plan?.name ?? ""} plan ($${((plan?.priceMonthly ?? 0) / 100).toFixed(0)}/month).

My account email: 

Please send me a payment link.

Thank you`);
    window.open(`mailto:support@rebooked.com?subject=${subject}&body=${body}`);
  };

  const checkout = trpc.billing.createCheckoutSession.useMutation();
  const changePlan = trpc.billing.changePlan.useMutation();
  const portal = trpc.billing.createCustomerPortal.useMutation();

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

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Billing</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your subscription and usage</p>
        </div>

        {/* Trial banner */}
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

        {/* Current Plan */}
        {subscription && currentPlan && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" /> Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      {currentPlan.name}
                    </h3>
                    <Badge className={
                      subscription.sub.status === "trialing" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                      subscription.sub.status === "past_due" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                      subscription.sub.status === "canceled" ? "bg-gray-500/20 text-gray-400 border-gray-500/30" :
                      "bg-primary/20 text-primary border-primary/30"
                    }>
                      {subscription.sub.status === "trialing" ? "Trial" :
                       subscription.sub.status === "past_due" ? "Past Due" :
                       subscription.sub.status === "canceled" ? "Canceled" : "Active"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm mt-1">
                    ${(currentPlan.priceMonthly / 100).toFixed(0)}/month
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {subscription.sub.status === "trialing" ? "Trial ends" : "Renews"}
                  </p>
                  <p className="text-sm font-medium">
                    {subscription.sub.status === "trialing" && subscription.sub.trialEndsAt
                      ? new Date(subscription.sub.trialEndsAt).toLocaleDateString()
                      : subscription.sub.currentPeriodEnd
                      ? new Date(subscription.sub.currentPeriodEnd).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="mt-4">
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
                  Manage subscription
                </Button>
              </div>

              {/* SMS Usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span>SMS Usage</span>
                  </div>
                  <span className="font-medium">
                    {smsUsed.toLocaleString()} / {smsLimit.toLocaleString()}
                  </span>
                </div>
                <Progress value={smsPercent} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {smsPercent}% used this billing period
                  {smsPercent >= 80 && (
                    <span className="text-yellow-400 ml-2">⚠ Approaching limit</span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plans */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Available Plans
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrentPlan = plan.id === subscription?.sub?.planId;
              // Dynamic popularity based on actual subscription data
              const isPopular = plan.name === "Professional" || (tenant?.popularPlanId === plan.id);
              const hasRevenueShare = plan.revenueSharePercent && plan.revenueSharePercent > 0;
              return (
                <Card
                  key={plan.id}
                  className={`relative border transition-all ${
                    isCurrentPlan
                      ? "border-primary bg-primary/5"
                      : isPopular
                      ? "border-primary/40 bg-card"
                      : "border-border bg-card"
                  }`}
                >
                  {isPopular && !isCurrentPlan && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1">
                      <Star className="w-3 h-3 mr-1" /> {tenant?.popularPlanId === plan.id ? "Recommended" : "Most popular"}
                    </Badge>
                  )}
                  {isCurrentPlan && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary">
                      <CheckCircle className="w-3 h-3 mr-1" /> Current plan
                    </Badge>
                  )}
                  <CardContent className="p-5">
                    <div className="mb-4">
                      <h3 className="font-bold text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{plan.name}</h3>
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
                          <div className="flex items-center gap-1">
                            <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded-full font-medium">
                              🎉 Limited Time Offer
                            </span>
                          </div>
                          <p className="text-xs text-green-400">
                            First {plan.promotionalSlots} clients: Free if total cost ≤ ${(plan.promotionalPriceLimit / 100).toFixed(0)}/month
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
                      {isCurrentPlan ? "Current plan" : (plan as any).stripePriceId ? "Upgrade" : "Request upgrade"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Usage Summary */}
        {usage && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Usage This Period
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{usage.messagesSent ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">SMS Sent</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">—</p>
                  <p className="text-xs text-muted-foreground mt-1">AI Rewrites</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{usage.automationsRun ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Automation Runs</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{leadCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Leads Added</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" /> Invoice History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            {(billingHistory?.invoices ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Invoices will appear here once Stripe posts them.</p>
            ) : (
              billingHistory?.invoices.map((invoice) => (
                <div key={invoice.stripeInvoiceId} className="flex flex-col gap-2 rounded-lg border border-border p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">{invoice.number || invoice.stripeInvoiceId}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(invoice.createdAt).toLocaleDateString()} · {(invoice.total / 100).toFixed(2)} {invoice.currency.toUpperCase()} · {invoice.status}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {invoice.hostedInvoiceUrl && (
                      <Button variant="outline" onClick={() => window.open(invoice.hostedInvoiceUrl!, "_blank")}>
                        View
                      </Button>
                    )}
                    {invoice.invoicePdfUrl && (
                      <Button onClick={() => window.open(invoice.invoicePdfUrl!, "_blank")}>
                        PDF
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
            {(billingHistory?.refunds ?? []).length > 0 && (
              <div className="pt-2">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Refunds</p>
                {billingHistory?.refunds.map((refund) => (
                  <div key={refund.stripeRefundId} className="text-sm text-muted-foreground">
                    {new Date(refund.createdAt).toLocaleDateString()} · {(refund.amount / 100).toFixed(2)} {refund.currency.toUpperCase()} refunded · {refund.status}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
