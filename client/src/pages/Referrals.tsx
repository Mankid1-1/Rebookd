import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  Copy, Check, Users, DollarSign, Clock, Gift, Share2, ArrowRight, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function Referrals() {
  const [copied, setCopied] = useState(false);

  const statsQuery = trpc.referral.getReferralStats.useQuery(undefined, { retry: false });
  const referralsQuery = trpc.referral.getUserReferrals.useQuery(undefined, { retry: false });
  const generateCode = trpc.referral.generateReferralCode.useMutation({
    onSuccess: (data) => {
      toast.success("Referral code generated!");
      statsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const stats = statsQuery.data?.stats;
  const referrals = referralsQuery.data?.referrals ?? [];
  const isLoading = statsQuery.isLoading;

  // Build referral link from stats data
  const referralCode = (stats as any)?.referralCode || "";
  const referralLink = referralCode
    ? `${window.location.origin}/signup?ref=${referralCode}`
    : "";

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = () => {
    generateCode.mutate();
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  const statCards = [
    {
      label: "Total Referrals",
      value: (stats as any)?.totalReferrals ?? 0,
      icon: Users,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
    },
    {
      label: "Active Referrals",
      value: (stats as any)?.completedReferrals ?? 0,
      icon: TrendingUp,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/30",
    },
    {
      label: "Total Earned",
      value: `$${(stats as any)?.totalEarned ?? 0}`,
      icon: DollarSign,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
    },
    {
      label: "Pending Payouts",
      value: `$${(stats as any)?.availableForPayout ?? 0}`,
      icon: Clock,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
    },
  ];

  const steps = [
    { step: "1", title: "Share your link", description: "Send your unique referral link to other businesses" },
    { step: "2", title: "They sign up", description: "When they subscribe to Rebooked using your link" },
    { step: "3", title: "Earn $50/month", description: "You earn $50/month for 6 months per active referral" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Referral Program</h1>
            <p className="text-zinc-400 mt-1">
              Earn $50/month for 6 months for every business you refer to Rebooked.
            </p>
          </div>
          {!referralCode && (
            <Button
              onClick={handleGenerate}
              disabled={generateCode.isPending}
              className="gap-2"
            >
              <Gift className="h-4 w-4" />
              {generateCode.isPending ? "Generating..." : "Generate Referral Code"}
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Card key={card.label} className={`border ${card.borderColor} ${card.bgColor} bg-zinc-900/50`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-zinc-400">{card.label}</span>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <p className="text-2xl font-bold text-zinc-100">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Referral Link */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Share2 className="h-5 w-5 text-zinc-400" />
              Your Referral Link
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Share this link with businesses to start earning referral commissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {referralLink ? (
              <div className="flex gap-2">
                <Input
                  value={referralLink}
                  readOnly
                  className="flex-1 bg-zinc-800/50 border-zinc-700 text-zinc-300 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  className="border-zinc-700 gap-2 shrink-0"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-green-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <Gift className="h-10 w-10 mx-auto mb-3 text-zinc-600" />
                <p className="text-zinc-400 text-sm">
                  Generate a referral code to get your unique link.
                </p>
                <Button
                  onClick={handleGenerate}
                  disabled={generateCode.isPending}
                  className="mt-3 gap-2"
                  size="sm"
                >
                  <Gift className="h-4 w-4" />
                  {generateCode.isPending ? "Generating..." : "Generate Code"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-zinc-100">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {steps.map((s, i) => (
                <div
                  key={s.step}
                  className="relative flex items-start gap-4 p-4 rounded-lg border border-zinc-800 bg-zinc-800/30"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-sm">
                    {s.step}
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-200">{s.title}</p>
                    <p className="text-sm text-zinc-400 mt-1">{s.description}</p>
                  </div>
                  {i < steps.length - 1 && (
                    <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-600 z-10" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Referral List */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-zinc-100">Your Referrals</CardTitle>
            <CardDescription className="text-zinc-400">
              Track the status of businesses you have referred.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <div className="text-center py-10">
                <Users className="h-10 w-10 mx-auto mb-3 text-zinc-600" />
                <p className="text-zinc-400 font-medium">No referrals yet</p>
                <p className="text-sm text-zinc-500 mt-1">
                  Share your referral link with other businesses to start earning commissions.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map((referral: any) => (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-zinc-800 bg-zinc-800/30"
                  >
                    <div>
                      <p className="font-medium text-zinc-200">
                        Referral #{referral.id}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {new Date(referral.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-zinc-300">
                        ${referral.rewardAmount ?? 50}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          referral.status === "completed"
                            ? "border-green-500/30 text-green-400 bg-green-500/10"
                            : referral.status === "pending"
                            ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                            : "border-zinc-600 text-zinc-400 bg-zinc-500/10"
                        }
                      >
                        {referral.status}
                      </Badge>
                    </div>
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
