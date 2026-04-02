import DashboardLayout from "@/components/layout/DashboardLayout";
import { HelpTooltip, HelpIcon } from "@/components/ui/HelpTooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  Bot,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  HelpCircle,
  MessageSquare,
  Pause,
  PieChart,
  RefreshCw,
  Shield,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_REVENUE_SHARE_PERCENT = 15;

const FONT_HEADING: React.CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function usageMeterColor(percent: number) {
  if (percent >= 80) return "text-destructive";
  if (percent >= 50) return "text-warning";
  return "text-success";
}

function progressBarClass(percent: number) {
  if (percent >= 80) return "[&>div]:bg-destructive";
  if (percent >= 50) return "[&>div]:bg-warning";
  return "[&>div]:bg-success";
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "paid":
    case "active":
      return "bg-success/15 text-success border-success/30";
    case "open":
    case "pending":
    case "trialing":
      return "bg-warning/15 text-warning border-warning/30";
    case "failed":
    case "uncollectible":
    case "past_due":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "canceled":
      return "bg-muted/15 text-muted-foreground border-muted-foreground/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    active: "Active",
    trialing: "Trial",
    past_due: "Past Due",
    canceled: "Canceled",
    paid: "Paid",
    open: "Pending",
    failed: "Failed",
    uncollectible: "Uncollectible",
  };
  return map[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d: string | Date, style: "short" | "long" = "short") =>
  new Date(d).toLocaleDateString("en-US", {
    month: style === "long" ? "long" : "short",
    day: "numeric",
    year: "numeric",
  });

// ─── Component ──────────────────────────────────────────────────────────────

export default function Billing() {
  const { t } = useLocale();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: plans = [] } = trpc.plans.list.useQuery();
  const { data: subscription } = trpc.tenant.subscription.useQuery(undefined, {
    retry: false,
  });
  const { data: usage } = trpc.tenant.usage.useQuery(undefined, {
    retry: false,
  });
  const { data: billingHistory } = trpc.billing.invoices.useQuery(undefined, {
    retry: false,
  });
  const { data: dashData } = trpc.analytics.dashboard.useQuery(undefined, {
    retry: false,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const checkout = trpc.billing.createCheckoutSession.useMutation();
  const changePlan = trpc.billing.changePlan.useMutation();
  const portal = trpc.billing.createCustomerPortal.useMutation();

  // ── Derived state ─────────────────────────────────────────────────────────
  const hasSub = !!subscription?.sub;
  const currentPlan = plans.find((p) => p.id === subscription?.sub?.planId);
  const subStatus = subscription?.sub?.status;
  const leadCount = dashData?.metrics?.leadCount ?? 0;
  const hasStripe = !!subscription?.sub?.stripeId;

  // Usage metrics
  const smsUsed = usage?.messagesSent ?? 0;
  const smsLimit = currentPlan?.maxMessages ?? 0;
  const smsPercent =
    smsLimit > 0 ? Math.min(100, Math.round((smsUsed / smsLimit) * 100)) : 0;
  const automationsRun = usage?.automationsRun ?? 0;
  const aiRewrites = (usage as any)?.aiRewrites ?? 0;

  // Revenue calculations — sourced from server-side billing.revenueShare procedure
  const { data: revenueShareData } = (trpc.billing as any).revenueShare.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  }) as { data: { recoveredRevenue: number; revenueSharePercent: number; revenueShareOwed: number; monthlyFee: number; totalCost: number; netSavings: number; billingType: string } | undefined };
  const revenueRecovered = revenueShareData?.recoveredRevenue ?? 0;
  const revenueSharePercent = revenueShareData?.revenueSharePercent ?? currentPlan?.revenueSharePercent ?? DEFAULT_REVENUE_SHARE_PERCENT;
  const revenueShareOwed = revenueShareData?.revenueShareOwed ?? 0;
  const monthlyFee = revenueShareData?.monthlyFee ?? ((hasSub && currentPlan) ? currentPlan.priceMonthly / 100 : 0);
  const totalCost = revenueShareData?.totalCost ?? (monthlyFee + revenueShareOwed);
  const netSavings = revenueShareData?.netSavings ?? (revenueRecovered - totalCost);
  const roiPercent =
    totalCost > 0 ? Math.round((netSavings / totalCost) * 100) : 0;

  // Trial
  const trialEndsAt = subscription?.sub?.trialEndsAt;
  const trialMs = trialEndsAt
    ? new Date(trialEndsAt).getTime() - Date.now()
    : 0;
  const trialDays = Math.max(0, Math.ceil(trialMs / (1000 * 60 * 60 * 24)));
  const trialHours = Math.max(
    0,
    Math.ceil(trialMs / (1000 * 60 * 60)) - trialDays * 24
  );

  // Invoices
  const invoices = billingHistory?.invoices ?? [];
  const refunds = billingHistory?.refunds ?? [];
  let runningTotal = 0;

  // Early adopter
  const earlyAdopterPlan = plans.find(
    (p) => p.hasPromotion && p.promotionalSlots > 0
  );
  const isEarlyAdopter =
    earlyAdopterPlan && (subscription as any)?.sub?.isEarlyAdopter;

  // Revenue share breakdown (recovered appointments)
  const recoveredAppointments =
    (dashData as any)?.recoveredAppointments ?? [];

  // Payment method info
  const cardLast4 = (subscription?.sub as any)?.cardLast4;
  const cardBrand = (subscription?.sub as any)?.cardBrand;
  const cardExpMonth = (subscription?.sub as any)?.cardExpMonth;
  const cardExpYear = (subscription?.sub as any)?.cardExpYear;

  // ── Handlers ──────────────────────────────────────────────────────────────

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

  const openPortal = async () => {
    try {
      const res = await portal.mutateAsync({});
      if (res?.url) window.location.href = res.url;
      else toast.error("Could not open customer portal");
    } catch (err) {
      console.error(err);
      toast.error("Error opening customer portal");
    }
  };

  const handlePlanAction = async (plan: (typeof plans)[0]) => {
    if (!(plan as any).stripePriceId) {
      const subject = encodeURIComponent(
        `Rebooked Plan Upgrade Request - ${plan.name}`
      );
      const body = encodeURIComponent(
        `Hi,\n\nI'd like to upgrade my Rebooked subscription to the ${plan.name} plan ($${((plan.priceMonthly ?? 0) / 100).toFixed(0)}/month).\n\nMy account email: \n\nPlease send me a payment link.\n\nThank you`
      );
      window.open(
        `mailto:rebooked@rebooked.org?subject=${subject}&body=${body}`
      );
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
  };

  const handleCancel = async () => {
    try {
      await openPortal();
    } catch {
      toast.error("Could not process cancellation");
    } finally {
      setCancelDialogOpen(false);
    }
  };

  const handlePause = async () => {
    try {
      await openPortal();
    } catch {
      toast.error("Could not pause subscription");
    } finally {
      setPauseDialogOpen(false);
    }
  };

  const activatePlan = () => {
    const plan = plans.find((p) => (p as any).stripePriceId);
    if (plan) handlePlanAction(plan);
    else openPortal();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          {/* ────────────────────────────────────────────────────────────────
              Page Header
              ──────────────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold" style={FONT_HEADING}>
                  {t('billing.title')}
                </h1>
                <HelpIcon content={{ basic: "Your plan, payments, and usage information", intermediate: "Subscription management, usage tracking, and payment history via Stripe", advanced: "Stripe subscription + usage-based billing. Revenue share computed from recovery_events and billed via Stripe metered billing" }} />
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                {t('billing.subtitle')}
              </p>
            </div>
            {hasStripe && (
              <Button variant="outline" size="sm" onClick={openPortal}>
                <ExternalLink className="w-4 h-4 mr-1.5" />
                Stripe Portal
              </Button>
            )}
          </div>

          {/* ────────────────────────────────────────────────────────────────
              Status Banners
              ──────────────────────────────────────────────────────────── */}
          {subStatus === "trialing" && trialEndsAt && (
            <div
              className={`rounded-xl p-5 flex items-start gap-4 ${
                trialDays <= 3
                  ? "bg-destructive/10 border border-destructive/30"
                  : "bg-warning/10 border border-warning/30"
              }`}
            >
              <Clock
                className={`w-6 h-6 shrink-0 mt-0.5 ${trialDays <= 3 ? "text-destructive" : "text-warning"}`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span
                    className={`text-2xl font-bold ${trialDays <= 3 ? "text-destructive" : "text-warning"}`}
                  >
                    {trialDays === 0
                      ? `${Math.max(0, Math.ceil(trialMs / (1000 * 60 * 60)))}h`
                      : `${trialDays}d${trialHours > 0 ? ` ${trialHours}h` : ""}`}
                  </span>
                  <span className="text-sm font-medium">
                    remaining in trial
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {trialDays <= 1
                    ? "Your trial ends very soon. Automations, SMS, and AI features will stop working when it expires. Upgrade now to avoid disruption."
                    : trialDays <= 3
                      ? "Your trial is ending soon. Add a payment method to keep your automations running without interruption."
                      : "You have full access to all features during your trial. Add a payment method anytime to continue after it ends."}
                </p>
                {trialDays <= 3 && (
                  <Button size="sm" className="mt-3" onClick={activatePlan}>
                    Upgrade now
                  </Button>
                )}
              </div>
            </div>
          )}

          {subStatus === "active" && (
            <div className="rounded-xl p-4 flex items-center gap-3 bg-success/10 border border-success/30">
              <CheckCircle className="w-5 h-5 text-success shrink-0" />
              <div>
                <p className="text-sm font-medium text-success">
                  All systems running
                </p>
                <p className="text-xs text-muted-foreground">
                  Your subscription is active and all features are available.
                </p>
              </div>
            </div>
          )}

          {subStatus === "past_due" && (
            <div className="rounded-xl p-5 flex items-start gap-4 bg-destructive/15 border border-destructive/40">
              <AlertTriangle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-destructive">
                  Payment past due
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your last payment failed. Update your payment method to avoid
                  service interruption. Automations will be paused if payment is
                  not received.
                </p>
                <Button
                  size="sm"
                  variant="destructive"
                  className="mt-3"
                  onClick={openPortal}
                >
                  Update payment method
                </Button>
              </div>
            </div>
          )}

          {subStatus === "canceled" && (
            <div className="rounded-xl p-5 flex items-start gap-4 bg-muted/50 border border-border">
              <RefreshCw className="w-6 h-6 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold">
                  Subscription canceled
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your subscription has been canceled. Re-activate to regain
                  access to automations, SMS, and AI features.
                </p>
                <Button size="sm" className="mt-3" onClick={activatePlan}>
                  Re-activate subscription
                </Button>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────
              1. Current Plan Card
              ──────────────────────────────────────────────────────────── */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                Current Plan
                <HelpIcon content={{ basic: "Your current plan — $199/month with a 35-day money-back guarantee", intermediate: "$199/month base + 15% revenue share on recovered appointments. ROI guarantee: free if no positive return in 35 days", advanced: "Stripe subscription with price_id lookup. Revenue share calculated from sum of realized_revenue * 0.15, invoiced monthly" }} />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold" style={FONT_HEADING}>
                      {currentPlan ? currentPlan.name : (hasSub ? "Rebooked" : "No Active Plan")}
                    </h3>
                    {subStatus && (
                      <Badge className={statusBadgeVariant(subStatus)}>
                        {statusLabel(subStatus)}
                      </Badge>
                    )}
                    {isEarlyAdopter && (
                      <Badge className="bg-warning/15 text-warning border-warning/30">
                        <Award className="w-3 h-3 mr-1" />
                        Early Adopter
                      </Badge>
                    )}
                  </div>
                  {hasSub ? (
                    <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                      <span className="text-3xl font-bold" style={FONT_HEADING}>
                        ${monthlyFee > 0 ? monthlyFee.toFixed(0) : "0"}
                      </span>
                      <span className="text-muted-foreground text-sm">/month</span>
                      {monthlyFee > 0 && (
                        <>
                          <span className="text-muted-foreground text-sm">+</span>
                          <span className="text-sm font-medium text-primary">
                            {revenueSharePercent}% revenue share
                          </span>
                        </>
                      )}
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>
                            {monthlyFee > 0
                              ? `You pay $${monthlyFee.toFixed(0)}/mo plus ${revenueSharePercent}% of recovered revenue.`
                              : `Flex plan: free for 35 days, then $199/mo + ${revenueSharePercent}% of recovered revenue if positive ROI.`}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">
                      You don't have an active subscription yet. Choose a plan to get started.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {hasSub ? "Full access to all features." : "Select a plan below to activate your account."}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    {subStatus === "trialing"
                      ? "Trial ends"
                      : "Next billing date"}
                  </p>
                  <p className="text-sm font-semibold mt-0.5">
                    {subStatus === "trialing" && trialEndsAt
                      ? fmtDate(trialEndsAt, "long")
                      : subscription?.sub?.currentPeriodEnd
                        ? fmtDate(subscription.sub.currentPeriodEnd, "long")
                        : "\u2014"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-5">
                {hasStripe ? (
                  <>
                    <Button variant="outline" size="sm" onClick={openPortal}>
                      <CreditCard className="w-4 h-4 mr-1.5" />
                      Manage subscription
                    </Button>
                    <Button variant="ghost" size="sm" onClick={openPortal}>
                      <ExternalLink className="w-4 h-4 mr-1.5" />
                      Customer portal
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={activatePlan}>
                    <CreditCard className="w-4 h-4 mr-1.5" />
                    Activate subscription
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ────────────────────────────────────────────────────────────────
              2. Revenue Share Summary
              ──────────────────────────────────────────────────────────── */}
          {hasSub && <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Revenue Share Summary
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  This billing period
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {/* Recovered Revenue */}
                <div className="rounded-lg border border-border p-4 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
                    Revenue Recovered
                    <HelpTooltip content="Total revenue from bookings attributed to Rebooked SMS outreach" variant="info"><span /></HelpTooltip>
                  </p>
                  <p
                    className="text-2xl font-bold text-success"
                    style={FONT_HEADING}
                  >
                    ${fmtUSD(revenueRecovered)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    From automated re-engagement
                  </p>
                </div>

                {/* Revenue Share (15%) */}
                <div className="rounded-lg border border-border p-4 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
                    {revenueSharePercent}% Revenue Share
                    <HelpTooltip content="Rebooked charges 15% of the revenue recovered through the platform. This is only billed when you recover revenue." variant="info"><span /></HelpTooltip>
                  </p>
                  <p className="text-2xl font-bold" style={FONT_HEADING}>
                    ${fmtUSD(revenueShareOwed)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Owed to Rebooked this period
                  </p>
                </div>

                {/* Net Savings */}
                <div className="rounded-lg border border-success/20 bg-success/5 p-4 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    Your Net Savings
                  </p>
                  <p
                    className={`text-2xl font-bold ${netSavings >= 0 ? "text-success" : "text-destructive"}`}
                    style={FONT_HEADING}
                  >
                    {netSavings >= 0 ? "+" : ""}${fmtUSD(netSavings)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    After subscription + revenue share
                  </p>
                </div>
              </div>

              {/* Split Bar Visualization */}
              {revenueRecovered > 0 && (
                <div className="mt-5 rounded-lg bg-muted/30 border border-border p-4">
                  <div className="flex items-center gap-2 text-sm mb-3">
                    <ArrowUpRight className="w-4 h-4 text-success" />
                    <span className="font-medium">
                      You keep {100 - revenueSharePercent}% of recovered
                      revenue
                    </span>
                  </div>
                  <div className="flex h-3 w-full rounded-full overflow-hidden">
                    <div
                      className="bg-success transition-all"
                      style={{
                        width: `${100 - revenueSharePercent}%`,
                      }}
                    />
                    <div
                      className="bg-primary/40 transition-all"
                      style={{ width: `${revenueSharePercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                    <span>
                      Your share: $
                      {fmtUSD(
                        revenueRecovered *
                          ((100 - revenueSharePercent) / 100)
                      )}
                    </span>
                    <span>Rebooked: ${fmtUSD(revenueShareOwed)}</span>
                  </div>
                </div>
              )}

              {/* Cost Breakdown Table */}
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Cost Breakdown
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Monthly subscription</span>
                      <span className="font-medium">${monthlyFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>
                        Revenue share ({revenueSharePercent}% of $
                        {fmtUSD(revenueRecovered)})
                      </span>
                      <span className="font-medium">
                        ${revenueShareOwed.toFixed(2)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Total cost this period</span>
                      <span>${totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Your ROI
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Revenue recovered</span>
                      <span className="font-medium text-success">
                        +${fmtUSD(revenueRecovered)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Rebooked cost</span>
                      <span className="font-medium text-destructive">
                        -${totalCost.toFixed(2)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Net profit</span>
                      <span
                        className={
                          netSavings >= 0 ? "text-success" : "text-destructive"
                        }
                      >
                        {netSavings >= 0 ? "+" : ""}${fmtUSD(netSavings)}
                        {totalCost > 0 && (
                          <span className="text-xs font-normal text-muted-foreground ml-1.5">
                            ({roiPercent}% ROI)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>}

          {/* ────────────────────────────────────────────────────────────────
              3. Usage Metrics
              ──────────────────────────────────────────────────────────── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Usage Metrics
                <HelpIcon content={{ basic: "How many messages and automations you've used this month", intermediate: "Monthly usage: SMS messages sent, active automations, leads managed, and recovered revenue", advanced: "Usage counters from messages (count), automations (enabled count), leads (total count). Metered billing reported to Stripe usage records" }} />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Messages Sent */}
                <div className="space-y-2 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      Messages Sent
                      <HelpTooltip content="SMS messages consumed this billing period. Resets monthly." variant="info"><span /></HelpTooltip>
                    </div>
                    <span
                      className={`text-xs font-semibold ${usageMeterColor(smsPercent)}`}
                    >
                      {smsPercent}%
                    </span>
                  </div>
                  <Progress
                    value={smsPercent}
                    className={`h-2.5 ${progressBarClass(smsPercent)}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {smsUsed.toLocaleString()} / {smsLimit.toLocaleString()}{" "}
                    sent this period
                    {smsPercent >= 80 && (
                      <span className="text-destructive font-medium ml-1">
                        - Approaching limit
                      </span>
                    )}
                  </p>
                </div>

                {/* Automations Active */}
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Bot className="w-4 h-4 text-muted-foreground" />
                    Automations Active
                  </div>
                  <p className="text-2xl font-bold" style={FONT_HEADING}>
                    {automationsRun.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    runs this billing period
                  </p>
                </div>

                {/* Leads Managed */}
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    Leads Managed
                  </div>
                  <p className="text-2xl font-bold" style={FONT_HEADING}>
                    {leadCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    total active leads
                  </p>
                </div>

                {/* AI Rewrites */}
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Zap className="w-4 h-4 text-muted-foreground" />
                    AI Rewrites
                  </div>
                  <p className="text-2xl font-bold" style={FONT_HEADING}>
                    {aiRewrites > 0 ? aiRewrites.toLocaleString() : "\u2014"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    this billing period
                  </p>
                </div>

                {/* Revenue Recovered */}
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    Revenue Recovered
                  </div>
                  <p
                    className="text-2xl font-bold text-success"
                    style={FONT_HEADING}
                  >
                    ${fmtUSD(revenueRecovered)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    this billing period
                  </p>
                </div>

                {/* Revenue Share Owed */}
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <PieChart className="w-4 h-4 text-muted-foreground" />
                    Revenue Share Owed
                    <HelpTooltip content="Rebooked charges 15% of the revenue recovered through the platform. This is only billed when you recover revenue." variant="info"><span /></HelpTooltip>
                  </div>
                  <p className="text-2xl font-bold" style={FONT_HEADING}>
                    ${fmtUSD(revenueShareOwed)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {revenueSharePercent}% of recovered revenue
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ────────────────────────────────────────────────────────────────
              4. Billing History
              ──────────────────────────────────────────────────────────── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Billing History
                <HelpIcon content={{ basic: "Your past payments and invoices", intermediate: "Stripe-powered invoice history with downloadable receipts", advanced: "Fetched from Stripe API via billing.invoices procedure. Includes subscription charges and revenue share line items" }} />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Invoices will appear here once Stripe posts them.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>
                          <span className="flex items-center gap-1">
                            Status
                            <HelpTooltip content="Paid = processed, Open = due, Void = cancelled" variant="info"><span /></HelpTooltip>
                          </span>
                        </TableHead>
                        <TableHead className="text-right">
                          Running Total
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => {
                        const amount = invoice.total / 100;
                        if (invoice.status === "paid") {
                          runningTotal += amount;
                        }
                        return (
                          <TableRow key={invoice.stripeInvoiceId}>
                            <TableCell className="font-medium text-xs">
                              {invoice.number || invoice.stripeInvoiceId}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {fmtDate(invoice.createdAt)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${amount.toFixed(2)}{" "}
                              <span className="text-xs text-muted-foreground">
                                {invoice.currency.toUpperCase()}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={statusBadgeVariant(invoice.status)}
                              >
                                {statusLabel(invoice.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              ${runningTotal.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {invoice.hostedInvoiceUrl && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          window.open(
                                            invoice.hostedInvoiceUrl!,
                                            "_blank"
                                          )
                                        }
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View invoice</TooltipContent>
                                  </Tooltip>
                                )}
                                {invoice.invoicePdfUrl && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          window.open(
                                            invoice.invoicePdfUrl!,
                                            "_blank"
                                          )
                                        }
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Download PDF
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Refunds */}
              {refunds.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-semibold">
                    Refunds
                  </p>
                  <div className="space-y-2">
                    {refunds.map((refund) => (
                      <div
                        key={refund.stripeRefundId}
                        className="flex items-center justify-between text-sm rounded-lg border border-border p-3"
                      >
                        <div>
                          <p className="font-medium">
                            {fmtDate(refund.createdAt)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {refund.stripeRefundId}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            ${(refund.amount / 100).toFixed(2)}{" "}
                            {refund.currency.toUpperCase()}
                          </p>
                          <Badge
                            variant="outline"
                            className={statusBadgeVariant(refund.status)}
                          >
                            {refund.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ────────────────────────────────────────────────────────────────
              5. Payment Method
              ──────────────────────────────────────────────────────────── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 rounded-md bg-muted flex items-center justify-center border border-border">
                    <CreditCard className="w-5 h-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    {cardLast4 ? (
                      <>
                        <p className="text-sm font-medium">
                          {cardBrand
                            ? cardBrand.charAt(0).toUpperCase() +
                              cardBrand.slice(1)
                            : "Card"}{" "}
                          ending in {cardLast4}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {cardExpMonth && cardExpYear
                            ? `Expires ${String(cardExpMonth).padStart(2, "0")}/${cardExpYear}`
                            : "Managed via Stripe"}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">
                          No payment method on file
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Add a card through the Stripe customer portal
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={openPortal}>
                  {cardLast4 ? "Update" : "Add payment method"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ────────────────────────────────────────────────────────────────
              6. Early Adopter Badge
              ──────────────────────────────────────────────────────────── */}
          {earlyAdopterPlan && (
            <Card className="border-warning/30 bg-gradient-to-br from-warning/5 to-success/5">
              <CardHeader className="pb-3 border-b border-warning/20">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Award className="w-4 h-4 text-warning" />
                  Early Adopter Program
                  <Badge className="bg-warning/15 text-warning border-warning/30 ml-2">
                    Limited
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className="text-2xl font-bold text-warning"
                        style={FONT_HEADING}
                      >
                        {earlyAdopterPlan.promotionalSlots}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        of {earlyAdopterPlan.earlyAdopterSlots ?? 20} slots remaining
                      </span>
                    </div>
                    <Progress
                      value={
                        (((earlyAdopterPlan.earlyAdopterSlots ?? 20) - earlyAdopterPlan.promotionalSlots) / (earlyAdopterPlan.earlyAdopterSlots ?? 20)) * 100
                      }
                      className="h-2 mb-3 [&>div]:bg-warning"
                    />
                    <p className="text-sm text-muted-foreground">
                      The first {earlyAdopterPlan.earlyAdopterSlots ?? 20} clients are protected by my ROI guarantee.{" "}
                      <span className="text-warning font-medium">
                        If Rebooked doesn't generate positive ROI, you don't
                        pay.
                      </span>
                    </p>
                    {isEarlyAdopter && (
                      <div className="mt-3 rounded-lg bg-success/10 border border-success/20 p-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success shrink-0" />
                        <p className="text-sm text-success font-medium">
                          You are an Early Adopter. Your ROI guarantee is
                          active.
                        </p>
                      </div>
                    )}
                    {earlyAdopterPlan.promotionalPriceCap > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Guarantee applies when total cost is under $
                        {(earlyAdopterPlan.promotionalPriceCap / 100).toFixed(
                          0
                        )}
                        /month. Limited to the first 20 clients.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ────────────────────────────────────────────────────────────────
              7. ROI Guarantee Section
              ──────────────────────────────────────────────────────────── */}
          <Card className="border-success/30 bg-success/5">
            <CardHeader className="pb-3 border-b border-success/20">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-success" />
                ROI Guarantee
                <HelpIcon content={{ basic: "If Rebooked doesn't make you money within 35 days, it's free!", intermediate: "ROI guarantee: positive return within 35 days or your subscription is fully refunded. Tracked automatically", advanced: "Guarantee cohort tracked in subscriptions.guarantee_cohort. ROI computed as recovered_revenue - subscription_cost over guarantee_period_days" }} />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-3">
                  <h3
                    className="text-lg font-bold leading-snug"
                    style={FONT_HEADING}
                  >
                    If Rebooked doesn't make you more than it costs, you don't
                    pay.
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    I stand behind Rebooked. If your total cost
                    (subscription + revenue share) exceeds the revenue Rebooked
                    recovers for you in any billing period, I'll credit you the
                    difference. Early Adopter clients get it completely free
                    during negative-ROI months.
                  </p>
                </div>
                <div className="md:w-64 shrink-0">
                  <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      Your Real-Time ROI
                    </p>
                    <div className="text-center">
                      <p
                        className={`text-3xl font-bold ${netSavings >= 0 ? "text-success" : "text-destructive"}`}
                        style={FONT_HEADING}
                      >
                        {netSavings >= 0 ? "+" : ""}${fmtUSD(netSavings)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        net profit this period
                      </p>
                    </div>
                    <Separator />
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Recovered</span>
                        <span className="text-success font-medium">
                          +${fmtUSD(revenueRecovered)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Rebooked cost
                        </span>
                        <span className="text-destructive font-medium">
                          -${fmtUSD(totalCost)}
                        </span>
                      </div>
                    </div>
                    {netSavings >= 0 ? (
                      <div className="rounded bg-success/10 border border-success/20 p-2 text-center">
                        <p className="text-xs text-success font-medium">
                          <CheckCircle className="w-3 h-3 inline mr-1" />
                          ROI positive - {roiPercent}% return
                        </p>
                      </div>
                    ) : (
                      <div className="rounded bg-warning/10 border border-warning/20 p-2 text-center">
                        <p className="text-xs text-warning font-medium">
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          ROI guarantee may apply
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ────────────────────────────────────────────────────────────────
              8. Manage Subscription
              ──────────────────────────────────────────────────────────── */}
          {subscription?.sub && subStatus !== "canceled" && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Manage Subscription
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Pause */}
                  <AlertDialog
                    open={pauseDialogOpen}
                    onOpenChange={setPauseDialogOpen}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Pause className="w-4 h-4 mr-1.5" />
                            Pause subscription
                          </Button>
                        </AlertDialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Temporarily suspends billing and automations. Can be resumed at any time.</p>
                      </TooltipContent>
                    </Tooltip>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Pause your subscription?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Pausing will temporarily suspend your subscription.
                          During the pause, automations will stop running, SMS
                          messages will not be sent, and revenue recovery will
                          be inactive. You can resume at any time.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep active</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePause}>
                          Pause subscription
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* Cancel */}
                  <AlertDialog
                    open={cancelDialogOpen}
                    onOpenChange={setCancelDialogOpen}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                          >
                            <XCircle className="w-4 h-4 mr-1.5" />
                            Cancel subscription
                          </Button>
                        </AlertDialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Cancels at end of current billing period. You'll keep access until then.</p>
                      </TooltipContent>
                    </Tooltip>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Cancel your subscription?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                          <span className="block">
                            Are you sure you want to cancel? Here's what you'll
                            lose:
                          </span>
                          <span className="block text-sm space-y-1">
                            <span className="flex items-center gap-2">
                              <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                              Automated SMS re-engagement
                            </span>
                            <span className="flex items-center gap-2">
                              <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                              AI-powered message rewrites
                            </span>
                            <span className="flex items-center gap-2">
                              <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                              Revenue recovery automations
                            </span>
                            <span className="flex items-center gap-2">
                              <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                              No-show and cancellation recovery
                            </span>
                          </span>
                          {revenueRecovered > 0 && (
                            <span className="block text-sm font-medium text-warning">
                              You've recovered ${fmtUSD(revenueRecovered)} this
                              period. Canceling means leaving that revenue on
                              the table.
                            </span>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep subscription</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleCancel}
                          className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                          Cancel subscription
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* Portal link */}
                  <Button variant="ghost" size="sm" onClick={openPortal}>
                    <ExternalLink className="w-4 h-4 mr-1.5" />
                    Full billing portal
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  Changes take effect at the end of your current billing period.
                  You can manage all billing details through the Stripe customer
                  portal.
                </p>
              </CardContent>
            </Card>
          )}

          {/* ────────────────────────────────────────────────────────────────
              9. Revenue Share Breakdown
              ──────────────────────────────────────────────────────────── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Revenue Share Breakdown
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Each recovered appointment contributes to the{" "}
                      {revenueSharePercent}% revenue share. This table shows a
                      detailed breakdown of every recovered appointment and
                      its share amount.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {recoveredAppointments.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No recovered appointments this billing period yet.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    When Rebooked recovers revenue from re-engaged clients, the
                    breakdown will appear here.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead className="text-right">
                            Appointment Value
                          </TableHead>
                          <TableHead className="text-right">
                            {revenueSharePercent}% Share
                          </TableHead>
                          <TableHead className="text-right">
                            You Keep
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recoveredAppointments.map(
                          (appt: any, idx: number) => {
                            const value = appt.value ?? 0;
                            const share =
                              Math.round(
                                value * (revenueSharePercent / 100) * 100
                              ) / 100;
                            const kept = value - share;
                            return (
                              <TableRow key={appt.id ?? idx}>
                                <TableCell className="text-muted-foreground">
                                  {appt.date ? fmtDate(appt.date) : "\u2014"}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {appt.clientName ?? "Unknown"}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {appt.service ?? "\u2014"}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  ${fmtUSD(value)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  ${fmtUSD(share)}
                                </TableCell>
                                <TableCell className="text-right text-success font-medium">
                                  ${fmtUSD(kept)}
                                </TableCell>
                              </TableRow>
                            );
                          }
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Summary row */}
                  <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      {recoveredAppointments.length} recovered appointment
                      {recoveredAppointments.length !== 1 ? "s" : ""} this period
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Total share:{" "}
                        <span className="font-medium text-foreground">
                          ${fmtUSD(revenueShareOwed)}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        You keep:{" "}
                        <span className="font-medium text-success">
                          $
                          {fmtUSD(
                            revenueRecovered *
                              ((100 - revenueSharePercent) / 100)
                          )}
                        </span>
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}
