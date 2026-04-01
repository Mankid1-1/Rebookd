import DashboardLayout from "@/components/layout/DashboardLayout";
import { useLocale } from "@/contexts/LocaleContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  Gift,
  Copy,
  Mail,
  MessageSquare,
  DollarSign,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Share2,
  Sparkles,
  CreditCard,
  AlertCircle,
  Trophy,
  ArrowRight,
  TrendingUp,
  Calendar,
  Hash,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ─── Constants ──────────────────────────────────────────────────────────────

const FONT_HEADING: React.CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
};

const PAYOUT_PER_MONTH = 50;
const PAYOUT_MONTHS = 6;
const TOTAL_PER_REFERRAL = PAYOUT_PER_MONTH * PAYOUT_MONTHS;

// ─── Helpers ────────────────────────────────────────────────────────────────

// fmtCurrency is provided by useLocale() inside the component

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// ─── Types ──────────────────────────────────────────────────────────────────

type ReferralStatus = "active" | "churned" | "expired";

interface ReferralItem {
  id: string;
  code: string;
  referredAt: string;
  status: ReferralStatus;
  monthsActive: number;
  totalEarned: number;
  nextPayoutDate: string | null;
}

interface PayoutEvent {
  referralId: string;
  referralCode: string;
  month: number;
  amount: number;
  date: string;
  status: "paid" | "upcoming" | "forfeited";
}

interface LeaderboardEntry {
  rank: number;
  label: string;
  referrals: number;
  earned: number;
  isYou: boolean;
}

// ─── Status Badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReferralStatus }) {
  const config: Record<
    ReferralStatus,
    { label: string; className: string }
  > = {
    active: {
      label: "Active",
      className: "bg-success/15 text-success border-success/30",
    },
    churned: {
      label: "Churned",
      className: "bg-destructive/15 text-destructive border-destructive/30",
    },
    expired: {
      label: "Completed",
      className: "bg-muted text-muted-foreground border-border",
    },
  };
  const { label, className } = config[status] ?? config.expired;
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

// ─── Payout Status Badge ────────────────────────────────────────────────────

function PayoutStatusBadge({
  status,
}: {
  status: "paid" | "upcoming" | "forfeited";
}) {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    paid: {
      label: "Paid",
      className: "bg-success/15 text-success border-success/30",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    upcoming: {
      label: "Upcoming",
      className: "bg-warning/15 text-warning border-warning/30",
      icon: <Clock className="w-3 h-3" />,
    },
    forfeited: {
      label: "Forfeited",
      className: "bg-destructive/15 text-destructive border-destructive/30",
      icon: <XCircle className="w-3 h-3" />,
    },
  };
  const { label, className, icon } = config[status] ?? config.upcoming;
  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      {icon}
      {label}
    </Badge>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Referral() {
  const { formatCurrency: fmtCurrency } = useLocale();
  const [termsOpen, setTermsOpen] = useState(false);
  const [showAllPayouts, setShowAllPayouts] = useState(false);

  // ─── Queries ────────────────────────────────────────────────────────────
  const { data: codeData } = trpc.referral.getCode.useQuery(undefined, {
    retry: false,
  });

  const { data: statsData } = trpc.referral.stats.useQuery(undefined, {
    retry: false,
  });

  const { data: referralList } = trpc.referral.list.useQuery(undefined, {
    retry: false,
  });

  const { data: leaderboardData } = trpc.referral.leaderboard.useQuery(
    undefined,
    { retry: false }
  );

  // ─── Derived values ────────────────────────────────────────────────────

  const referralCode = codeData?.code ?? "LOADING...";
  const referralLink = `${window.location.origin}/signup?ref=${referralCode}`;

  const stats = {
    totalEarned: statsData?.totalEarned ?? 0,
    pendingPayouts: statsData?.pendingPayout ?? 0,
    lifetimeEarnings: statsData?.lifetimeEarnings ?? statsData?.totalEarned ?? 0,
    activeReferrals: statsData?.completedReferrals ?? 0,
    totalReferrals: statsData?.totalReferrals ?? 0,
    nextPayoutDate: null as string | null,
  };

  const referrals: ReferralItem[] = (referralList ?? []).map((r: any) => ({
    id: String(r.id),
    code: r.referralCode,
    referredAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    status: r.status === "completed" ? "active" as const : r.status === "expired" ? "expired" as const : "churned" as const,
    monthsActive: r.completedAt
      ? Math.min(6, Math.floor((Date.now() - new Date(r.completedAt).getTime()) / (30 * 24 * 60 * 60 * 1000)) + 1)
      : 0,
    totalEarned: r.completedAt
      ? Math.min(6, Math.floor((Date.now() - new Date(r.completedAt).getTime()) / (30 * 24 * 60 * 60 * 1000)) + 1) * 50
      : 0,
    nextPayoutDate: r.payoutScheduledAt ? new Date(r.payoutScheduledAt).toISOString() : null,
  }));

  const leaderboard: LeaderboardEntry[] = (leaderboardData ?? []).map((entry: any) => ({
    rank: entry.rank,
    label: entry.isYou ? "You" : `Referrer #${entry.rank}`,
    referrals: entry.referralCount ?? 0,
    earned: entry.totalEarned ?? 0,
    isYou: entry.isYou ?? false,
  }));

  // Build payout schedule from referrals
  const payoutEvents: PayoutEvent[] = referrals.flatMap((ref) => {
    const startDate = new Date(ref.referredAt);
    return Array.from({ length: PAYOUT_MONTHS }, (_, i) => {
      const payoutDate = new Date(startDate);
      payoutDate.setMonth(payoutDate.getMonth() + i + 1);
      let status: "paid" | "upcoming" | "forfeited" = "upcoming";
      if (i < ref.monthsActive && ref.status !== "churned") {
        status = payoutDate < new Date() ? "paid" : "upcoming";
      }
      if (ref.status === "churned" && i >= ref.monthsActive) {
        status = "forfeited";
      }
      if (ref.status === "expired") {
        status = i < ref.monthsActive ? "paid" : "forfeited";
      }
      return {
        referralId: ref.id,
        referralCode: ref.code,
        month: i + 1,
        amount: PAYOUT_PER_MONTH,
        date: payoutDate.toISOString(),
        status,
      };
    });
  });

  const sortedPayouts = [...payoutEvents].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const paidPayouts = sortedPayouts.filter((p) => p.status === "paid");
  const upcomingPayouts = sortedPayouts.filter((p) => p.status === "upcoming");
  const visiblePayouts = showAllPayouts
    ? sortedPayouts
    : sortedPayouts.slice(0, 12);

  // ─── Actions ──────────────────────────────────────────────────────────

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast.success("Referral code copied to clipboard!");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied to clipboard!");
  };

  const shareEmail = () => {
    const subject = encodeURIComponent(
      "Try Rebooked - Get AI-powered SMS re-engagement"
    );
    const body = encodeURIComponent(
      `Hey!\n\nI've been using Rebooked to re-engage lost leads with AI-powered SMS, and it's been a game changer for my business.\n\nSign up using my referral link and we both benefit:\n${referralLink}\n\nRebooked automates follow-ups, recovers no-shows, and wins back cancellations — all with AI-crafted messages. It practically runs itself.\n\nBest regards`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const shareSMS = () => {
    const body = encodeURIComponent(
      `Hey! I've been using Rebooked for AI-powered SMS re-engagement and it's been amazing for recovering lost revenue. Check it out with my link and we both get rewarded: ${referralLink}`
    );
    window.open(`sms:?body=${body}`);
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
        {/* ================================================================
            1. HERO CARD
            ================================================================ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-success/20 via-primary/15 to-accent/10 border border-success/20 p-8 md:p-12">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-success/5 via-transparent to-transparent" />
          <div className="absolute -top-10 -right-10 opacity-[0.07]">
            <Gift className="w-56 h-56" />
          </div>
          <div className="absolute bottom-4 right-8 opacity-[0.04]">
            <DollarSign className="w-40 h-40" />
          </div>

          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-success" />
              <span className="text-sm font-semibold text-success uppercase tracking-wider">
                Referral Program
              </span>
            </div>
            <div className="flex items-start gap-2 mb-3">
              <h1
                className="text-3xl md:text-5xl font-bold tracking-tight"
                style={FONT_HEADING}
              >
                Earn{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-success to-success/70">
                  {fmtCurrency(TOTAL_PER_REFERRAL)}
                </span>{" "}
                per referral
              </h1>
              <HelpTooltip content="Earn $50/month for 6 months for every business you refer that stays active on Rebooked." variant="info"><span /></HelpTooltip>
            </div>
            <p className="text-muted-foreground text-lg leading-relaxed mb-8 max-w-xl">
              Refer a friend to Rebooked and earn{" "}
              <span className="text-foreground font-semibold">
                {fmtCurrency(PAYOUT_PER_MONTH)}/month for {PAYOUT_MONTHS}{" "}
                months
              </span>{" "}
              as long as they stay subscribed. No cap on referrals.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={copyLink}
                className="gap-2 bg-success hover:bg-success/90 text-success-foreground shadow-lg shadow-success/20"
              >
                <Share2 className="w-4 h-4" />
                Copy Referral Link
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={shareEmail}
                className="gap-2"
              >
                <Mail className="w-4 h-4" />
                Email
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={shareSMS}
                className="gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                SMS
              </Button>
            </div>
          </div>
        </div>

        {/* ================================================================
            2. EARNINGS SUMMARY
            ================================================================ */}
        <div>
          <h2 className="text-xl font-bold tracking-tight mb-4" style={FONT_HEADING}>
            Earnings Overview
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      <HelpTooltip content="Your cumulative referral earnings. Paid out on the 1st of each month." variant="info">
                        Total Earned
                      </HelpTooltip>
                    </p>
                    <p
                      className="text-2xl font-bold tracking-tight text-success"
                      style={FONT_HEADING}
                    >
                      {fmtCurrency(stats.totalEarned)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Pending Payouts
                    </p>
                    <p
                      className="text-2xl font-bold tracking-tight"
                      style={FONT_HEADING}
                    >
                      {fmtCurrency(stats.pendingPayouts)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Lifetime Earnings
                    </p>
                    <p
                      className="text-2xl font-bold tracking-tight"
                      style={FONT_HEADING}
                    >
                      {fmtCurrency(stats.lifetimeEarnings)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-info" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      <HelpTooltip content="Referral commissions are paid on the 1st of the following month after 30 days of active subscription" variant="info">
                        Next Payout
                      </HelpTooltip>
                    </p>
                    <p
                      className="text-2xl font-bold tracking-tight"
                      style={FONT_HEADING}
                    >
                      {stats.nextPayoutDate
                        ? fmtDate(stats.nextPayoutDate)
                        : upcomingPayouts.length > 0
                          ? fmtDate(upcomingPayouts[0].date)
                          : "---"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ================================================================
            3. REFERRAL CODE & LINK
            ================================================================ */}
        <Card>
          <CardHeader>
            <CardTitle
              className="flex items-center gap-2"
              style={FONT_HEADING}
            >
              <Gift className="w-5 h-5 text-primary" />
              <HelpTooltip content="Share this link or code with other appointment businesses. You earn $50/month for each active referral." variant="info">
                Your Referral Code
              </HelpTooltip>
            </CardTitle>
            <CardDescription>
              Share your unique code or link with friends and colleagues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Large code display */}
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-muted/50 border-2 border-dashed border-primary/30 rounded-xl px-6 py-5 font-mono text-2xl md:text-3xl font-bold tracking-[0.25em] text-center select-all">
                {referralCode}
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyCode}
                      className="h-14 w-14 shrink-0 rounded-xl"
                    >
                      <Copy className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Copy referral link to clipboard</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <Separator />

            {/* Shareable link */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                Shareable Link
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted/50 border rounded-lg px-4 py-3 text-sm text-muted-foreground truncate select-all">
                  {referralLink}
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={copyLink}
                        className="h-12 w-12 shrink-0"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Copy referral link to clipboard</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Share options */}
            <div className="flex flex-wrap gap-3 pt-1">
              <Button variant="outline" onClick={shareEmail} className="gap-2">
                <Mail className="w-4 h-4" />
                Share via Email
              </Button>
              <Button variant="outline" onClick={shareSMS} className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Share via SMS
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const text = encodeURIComponent(
                    `I've been using @RebookedAI for AI-powered SMS re-engagement and it's incredible. Sign up with my link: ${referralLink}`
                  );
                  window.open(
                    `https://twitter.com/intent/tweet?text=${text}`,
                    "_blank"
                  );
                }}
                className="gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share on X
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ================================================================
            4. ACTIVE REFERRALS TABLE
            ================================================================ */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle
                  className="flex items-center gap-2"
                  style={FONT_HEADING}
                >
                  <Users className="w-5 h-5 text-primary" />
                  <HelpTooltip content="Referrals who are still subscribed and paying. Each earns you $50/month for up to 6 months." variant="info">
                    Active Referrals
                  </HelpTooltip>
                </CardTitle>
                <CardDescription className="mt-1">
                  Track the status and earnings of each person you referred
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Users className="w-3 h-3" />
                  {stats.activeReferrals} active
                </Badge>
                <Badge variant="outline" className="gap-1">
                  {stats.totalReferrals} total
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-semibold text-foreground mb-1">
                  No referrals yet
                </p>
                <p className="text-sm max-w-sm mx-auto">
                  Share your referral code with friends and colleagues to start
                  earning {fmtCurrency(TOTAL_PER_REFERRAL)} per referral.
                </p>
                <Button
                  variant="outline"
                  onClick={copyLink}
                  className="mt-4 gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy your referral link
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referral Code</TableHead>
                      <TableHead>Date Referred</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead className="text-right">Earned</TableHead>
                      <TableHead className="text-right">Next Payout</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.map((ref) => (
                      <TableRow key={ref.id}>
                        <TableCell className="font-mono font-semibold">
                          {ref.code}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {fmtDate(ref.referredAt)}
                        </TableCell>
                        <TableCell>
                          {ref.status === "churned" ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <StatusBadge status={ref.status} />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent><p>This referral has cancelled their subscription. Earnings from them have ended.</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <StatusBadge status={ref.status} />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5 min-w-[120px]">
                            <div className="flex-1 max-w-[100px] bg-muted rounded-full h-2.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  ref.status === "active"
                                    ? "bg-success"
                                    : ref.status === "churned"
                                      ? "bg-destructive"
                                      : "bg-muted-foreground"
                                }`}
                                style={{
                                  width: `${(ref.monthsActive / PAYOUT_MONTHS) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                              {ref.monthsActive}/{PAYOUT_MONTHS} mo
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-success">
                          {fmtCurrency(ref.totalEarned)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {ref.nextPayoutDate ? fmtDate(ref.nextPayoutDate) : "---"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ================================================================
            5. PAYOUT HISTORY
            ================================================================ */}
        <Card>
          <CardHeader>
            <CardTitle
              className="flex items-center gap-2"
              style={FONT_HEADING}
            >
              <CreditCard className="w-5 h-5 text-primary" />
              Payout History
            </CardTitle>
            <CardDescription>
              Complete log of all {fmtCurrency(PAYOUT_PER_MONTH)} monthly
              payouts across your referrals
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sortedPayouts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-semibold text-foreground mb-1">
                  No payouts yet
                </p>
                <p className="text-sm">
                  Payouts will appear here once your referrals start generating
                  earnings
                </p>
              </div>
            ) : (
              <>
                {/* Summary row */}
                <div className="flex flex-wrap gap-6 mb-5 pb-5 border-b border-border">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      Paid
                    </p>
                    <p className="text-lg font-bold text-success" style={FONT_HEADING}>
                      {fmtCurrency(paidPayouts.length * PAYOUT_PER_MONTH)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {paidPayouts.length} payment{paidPayouts.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      Upcoming
                    </p>
                    <p className="text-lg font-bold text-warning" style={FONT_HEADING}>
                      {fmtCurrency(upcomingPayouts.length * PAYOUT_PER_MONTH)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {upcomingPayouts.length} pending
                    </p>
                  </div>
                </div>

                {/* Payout table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Referral</TableHead>
                        <TableHead className="text-center">Month</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">Status</span>
                              </TooltipTrigger>
                              <TooltipContent><p>Paid = transferred to your account; Upcoming = scheduled for next payout date; Forfeited = referral cancelled before payout</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visiblePayouts.map((payout, i) => (
                        <TableRow key={`${payout.referralId}-${payout.month}`}>
                          <TableCell className="text-muted-foreground">
                            {fmtDate(payout.date)}
                          </TableCell>
                          <TableCell className="font-mono font-medium">
                            {payout.referralCode}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="gap-1 font-mono">
                              <Hash className="w-3 h-3" />
                              {payout.month}/{PAYOUT_MONTHS}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold ${
                              payout.status === "paid"
                                ? "text-success"
                                : payout.status === "forfeited"
                                  ? "text-destructive line-through"
                                  : "text-foreground"
                            }`}
                          >
                            {fmtCurrency(payout.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <PayoutStatusBadge status={payout.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {sortedPayouts.length > 12 && (
                  <div className="text-center pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllPayouts(!showAllPayouts)}
                      className="gap-1.5 text-muted-foreground"
                    >
                      {showAllPayouts
                        ? "Show less"
                        : `Show all ${sortedPayouts.length} payouts`}
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          showAllPayouts ? "rotate-180" : ""
                        }`}
                      />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ================================================================
            6. HOW IT WORKS
            ================================================================ */}
        <div>
          <h2
            className="text-xl font-bold tracking-tight mb-4"
            style={FONT_HEADING}
          >
            How It Works
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                step: 1,
                icon: Share2,
                title: "Share your link",
                desc: "Send your unique referral code or link to friends and colleagues via email, SMS, or social media.",
                accent: "from-info/20 to-info/5",
              },
              {
                step: 2,
                icon: Users,
                title: "They sign up & subscribe",
                desc: "Your friend creates a Rebooked account using your link and subscribes to a paid plan.",
                accent: "from-accent/20 to-accent/5",
              },
              {
                step: 3,
                icon: DollarSign,
                title: `You earn ${fmtCurrency(PAYOUT_PER_MONTH)}/mo for ${PAYOUT_MONTHS} months`,
                desc: `You receive ${fmtCurrency(PAYOUT_PER_MONTH)} every month your referral stays subscribed, up to ${fmtCurrency(TOTAL_PER_REFERRAL)} total per referral.`,
                accent: "from-success/20 to-success/5",
              },
            ].map((item, idx) => (
              <div key={item.step} className="relative">
                <Card
                  className={`relative overflow-hidden h-full bg-gradient-to-b ${item.accent}`}
                >
                  <div
                    className="absolute top-3 right-4 text-5xl font-black text-muted-foreground/10"
                    style={FONT_HEADING}
                  >
                    {item.step}
                  </div>
                  <CardContent className="pt-6 pb-6">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2" style={FONT_HEADING}>
                      {item.step === 3 ? (
                        <HelpTooltip content="$50/month per referral for 6 months, starting 30 days after their subscription begins" variant="tip">
                          {item.title}
                        </HelpTooltip>
                      ) : (
                        item.title
                      )}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.desc}
                    </p>
                  </CardContent>
                </Card>

                {/* Arrow between cards */}
                {idx < 2 && (
                  <div className="hidden sm:flex absolute top-1/2 -right-5 z-10 -translate-y-1/2">
                    <ArrowRight className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ================================================================
            7. SHARE OPTIONS (Pre-written templates)
            ================================================================ */}
        <Card>
          <CardHeader>
            <CardTitle
              className="flex items-center gap-2"
              style={FONT_HEADING}
            >
              <Mail className="w-5 h-5 text-primary" />
              Pre-written Share Templates
            </CardTitle>
            <CardDescription>
              Use these ready-to-send messages to share Rebooked with your
              network
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* SMS Template */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">SMS Message</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Hey! I've been using Rebooked for AI-powered SMS re-engagement and it's been amazing for recovering lost revenue. Check it out with my link and we both get rewarded: ${referralLink}`
                    );
                    toast.success("SMS message copied!");
                  }}
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </Button>
              </div>
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3 leading-relaxed">
                Hey! I've been using Rebooked for AI-powered SMS re-engagement
                and it's been amazing for recovering lost revenue. Check it out
                with my link and we both get rewarded:{" "}
                <span className="text-primary font-medium">[your link]</span>
              </p>
            </div>

            {/* Email Template */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Email Template</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Hey!\n\nI've been using Rebooked to re-engage lost leads with AI-powered SMS, and it's been a game changer for my business.\n\nRebooked automates follow-ups, recovers no-shows, and wins back cancellations — all with AI-crafted messages. It practically runs itself.\n\nSign up using my referral link and we both benefit:\n${referralLink}\n\nBest regards`
                    );
                    toast.success("Email template copied!");
                  }}
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </Button>
              </div>
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3 leading-relaxed space-y-2">
                <p>Hey!</p>
                <p>
                  I've been using Rebooked to re-engage lost leads with
                  AI-powered SMS, and it's been a game changer for my business.
                </p>
                <p>
                  Rebooked automates follow-ups, recovers no-shows, and wins
                  back cancellations — all with AI-crafted messages. It
                  practically runs itself.
                </p>
                <p>
                  Sign up using my referral link and we both benefit:{" "}
                  <span className="text-primary font-medium">[your link]</span>
                </p>
                <p>Best regards</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ================================================================
            8. LEADERBOARD
            ================================================================ */}
        {leaderboard.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle
                className="flex items-center gap-2"
                style={FONT_HEADING}
              >
                <Trophy className="w-5 h-5 text-warning" />
                Referral Leaderboard
              </CardTitle>
              <CardDescription>
                See how you stack up against other Rebooked referrers this month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.rank}
                    className={`flex items-center gap-4 rounded-lg px-4 py-3 transition-colors ${
                      entry.isYou
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {/* Rank */}
                    <div className="shrink-0 w-8 text-center">
                      {entry.rank <= 3 ? (
                        <span
                          className={`text-lg font-bold ${
                            entry.rank === 1
                              ? "text-warning"
                              : entry.rank === 2
                                ? "text-muted-foreground"
                                : "text-warning/60"
                          }`}
                          style={FONT_HEADING}
                        >
                          {entry.rank === 1
                            ? "\u{1F947}"
                            : entry.rank === 2
                              ? "\u{1F948}"
                              : "\u{1F949}"}
                        </span>
                      ) : (
                        <span
                          className="text-sm font-bold text-muted-foreground"
                          style={FONT_HEADING}
                        >
                          #{entry.rank}
                        </span>
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {entry.label}
                        {entry.isYou && (
                          <Badge
                            variant="secondary"
                            className="ml-2 text-xs"
                          >
                            You
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.referrals} referral
                        {entry.referrals !== 1 ? "s" : ""}
                      </p>
                    </div>

                    {/* Earnings */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-success">
                        {fmtCurrency(entry.earned)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ================================================================
            9. TERMS & CONDITIONS
            ================================================================ */}
        <Collapsible open={termsOpen} onOpenChange={setTermsOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <button className="w-full text-left">
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <CardTitle
                      className="flex items-center gap-2 text-base"
                      style={FONT_HEADING}
                    >
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
                      Referral Program Terms & Conditions
                    </CardTitle>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                        termsOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CardHeader>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>
                      <span className="font-medium text-foreground">
                        {fmtCurrency(PAYOUT_PER_MONTH)}/month for{" "}
                        {PAYOUT_MONTHS} months:
                      </span>{" "}
                      You earn {fmtCurrency(PAYOUT_PER_MONTH)} per month for
                      each active referral, up to{" "}
                      {fmtCurrency(TOTAL_PER_REFERRAL)} total over{" "}
                      {PAYOUT_MONTHS} months.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>
                      <span className="font-medium text-foreground">
                        Active subscription required:
                      </span>{" "}
                      The referred user must maintain an active paid subscription
                      for you to receive each monthly payout. If they cancel,
                      remaining payouts are forfeited.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>
                      <span className="font-medium text-foreground">
                        Monthly processing:
                      </span>{" "}
                      Payouts are processed on the 1st of each month for the
                      previous month's qualifying referrals. No delay on first
                      payout.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>
                      <span className="font-medium text-foreground">
                        No self-referrals:
                      </span>{" "}
                      You cannot refer yourself or accounts associated with the
                      same business entity. Self-referrals will be voided.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>
                      <span className="font-medium text-foreground">
                        Unlimited referrals:
                      </span>{" "}
                      There is no cap on the number of people you can refer. The
                      more you share, the more you earn.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>
                      <span className="font-medium text-foreground">
                        Fraud review:
                      </span>{" "}
                      All referrals are subject to fraud review. Rebooked
                      reserves the right to withhold payouts for suspicious
                      activity and may terminate referral privileges at any time.
                    </span>
                  </li>
                </ul>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </DashboardLayout>
  );
}
