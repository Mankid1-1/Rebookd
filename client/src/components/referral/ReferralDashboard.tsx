/**
 * 🎯 REFERRAL DASHBOARD
 * Complete referral system dashboard with stats, earnings, and referral links
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Share2, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Copy, 
  CheckCircle, 
  Clock, 
  Gift,
  Trophy,
  Download,
  ExternalLink
} from 'lucide-react';

// Simple toast implementation for now
const useToast = () => ({
  toast: ({ title, description, variant }: any) => {
    console.log(`${variant}: ${title} - ${description}`);
  }
});

interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalEarned: number;
  availableForPayout: number;
  lifetimeEarnings: number;
}

interface Referral {
  id: string;
  referredUserId: string;
  referralCode: string;
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
  rewardAmount: number;
  createdAt: string;
  completedAt?: string;
  expiresAt: string;
  payoutScheduledAt?: string;
  payoutProcessedAt?: string;
  daysUntilPayout?: number;
}

interface ReferralPayout {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  method: 'paypal' | 'stripe' | 'bank_transfer';
  createdAt: string;
  processedAt?: string;
  transactionId?: string;
}

interface LeaderboardEntry {
  userId: string;
  totalReferrals: number;
  totalEarned: number;
  rank: number;
}

export function ReferralDashboard() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [payouts, setPayouts] = useState<ReferralPayout[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralLink, setReferralLink] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      setLoading(true);
      
      // Load referral stats
      const statsResponse = await fetch('/api/referral/getReferralStats');
      const statsData = await statsResponse.json();
      
      if (statsData.success) {
        setStats(statsData.stats);
        setReferralCode(statsData.referralCode || '');
        setReferralLink(`${window.location.origin}/signup?ref=${statsData.referralCode || ''}`);
      }

      // Load referrals
      const referralsResponse = await fetch('/api/referral/getUserReferrals');
      const referralsData = await referralsResponse.json();
      
      if (referralsData.success) {
        setReferrals(referralsData.referrals);
      }

      // Load payouts
      const payoutsResponse = await fetch('/api/referral/getUserPayouts');
      const payoutsData = await payoutsResponse.json();
      
      if (payoutsData.success) {
        setPayouts(payoutsData.payouts);
      }

      // Load leaderboard
      const leaderboardResponse = await fetch('/api/referral/getLeaderboard');
      const leaderboardData = await leaderboardResponse.json();
      
      if (leaderboardData.success) {
        setLeaderboard(leaderboardData.leaderboard);
      }
    } catch (error) {
      console.error('Failed to load referral data:', error);
      toast({
        title: "Error",
        description: "Failed to load referral data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateReferralCode = async () => {
    try {
      const response = await fetch('/api/referral/generateReferralCode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setReferralCode(data.referralCode);
        setReferralLink(`${window.location.origin}/signup?ref=${data.referralCode}`);
        toast({
          title: "Success!",
          description: "Referral code generated successfully"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate referral code",
        variant: "destructive"
      });
    }
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied!",
      description: "Referral link copied to clipboard"
    });
  };

  const requestPayout = async (method: 'paypal' | 'stripe' | 'bank_transfer') => {
    try {
      const response = await fetch('/api/referral/requestPayout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Payout Requested!",
          description: `Your payout request has been submitted via ${method}`
        });
        loadReferralData(); // Refresh data
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to request payout",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      pending: 'secondary',
      completed: 'default',
      expired: 'outline',
      cancelled: 'outline'
    };
    
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Referral Program</h1>
          <p className="text-muted-foreground">Earn $50 for every company that subscribes for 6+ months</p>
        </div>
        <Button onClick={generateReferralCode} className="flex items-center gap-2">
          <Gift className="w-4 h-4" />
          Generate Referral Code
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalReferrals || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.completedReferrals || 0} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lifetime Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.totalEarned || 0}</div>
            <p className="text-xs text-muted-foreground">
              From {stats?.completedReferrals || 0} referrals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available for Payout</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.availableForPayout || 0}</div>
            <p className="text-xs text-muted-foreground">
              Ready to withdraw
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Referrals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingReferrals || 0}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting subscription
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Referral Link */}
      {referralCode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Your Referral Link
            </CardTitle>
            <CardDescription>
              Share this link with companies to earn $50 when they subscribe for 6+ months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input 
                value={referralLink} 
                readOnly 
                className="flex-1"
              />
              <Button 
                onClick={copyReferralLink}
                variant="outline"
                className="flex items-center gap-2"
              >
                {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                Share on LinkedIn
              </Button>
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                Share on Twitter
              </Button>
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <Download className="w-3 h-3" />
                Email Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="referrals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals">
          <Card>
            <CardHeader>
              <CardTitle>Your Referrals</CardTitle>
              <CardDescription>
                Track the status of your referred companies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {referrals.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No referrals yet. Start sharing your referral link!
                  </p>
                ) : (
                  referrals.map((referral) => (
                    <div key={referral.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">Referral Code: {referral.referralCode}</p>
                          <p className="text-sm text-muted-foreground">
                            Created: {new Date(referral.createdAt).toLocaleDateString()}
                          </p>
                          {referral.completedAt && (
                            <p className="text-sm text-success">
                              Completed: {new Date(referral.completedAt).toLocaleDateString()}
                            </p>
                          )}
                          {referral.payoutScheduledAt && !referral.payoutProcessedAt && (
                            <p className="text-sm text-info">
                              💰 Payout in {referral.daysUntilPayout || 'calculating...'} days
                            </p>
                          )}
                          {referral.payoutProcessedAt && (
                            <p className="text-sm text-success">
                              ✅ Paid: {new Date(referral.payoutProcessedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(referral.status)}
                        <span className="font-medium">${referral.rewardAmount}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Payout History</span>
                {stats?.availableForPayout && stats.availableForPayout > 0 && (
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => requestPayout('paypal')}
                      size="sm"
                    >
                      Request PayPal Payout
                    </Button>
                    <Button 
                      onClick={() => requestPayout('stripe')}
                      size="sm"
                      variant="outline"
                    >
                      Request Stripe Payout
                    </Button>
                  </div>
                )}
              </CardTitle>
              <CardDescription>
                Your earnings and payout history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payouts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No payouts yet. Complete referrals to start earning!
                  </p>
                ) : (
                  payouts.map((payout) => (
                    <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">${payout.amount} via {payout.method}</p>
                        <p className="text-sm text-muted-foreground">
                          Requested: {new Date(payout.createdAt).toLocaleDateString()}
                        </p>
                        {payout.processedAt && (
                          <p className="text-sm text-success">
                            Processed: {new Date(payout.processedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {getStatusBadge(payout.status)}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Referral Leaderboard
              </CardTitle>
              <CardDescription>
                Top referrers this month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leaderboard.map((entry, index) => (
                  <div key={entry.userId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        index === 0 ? 'bg-warning/10 text-warning' :
                        index === 1 ? 'bg-muted text-muted-foreground' :
                        index === 2 ? 'bg-warning/10 text-warning' :
                        'bg-muted/50 text-muted-foreground'
                      }`}>
                        {entry.rank}
                      </div>
                      <div>
                        <p className="font-medium">User #{entry.userId}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.totalReferrals} referrals
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${entry.totalEarned}</p>
                      <p className="text-sm text-muted-foreground">earned</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Program Info */}
      <Alert>
        <Gift className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> Share your referral link with companies. When they sign up and subscribe 
          for 6+ months, you earn $50. Payouts are available via PayPal, Stripe, or bank transfer.
        </AlertDescription>
      </Alert>
    </div>
  );
}
