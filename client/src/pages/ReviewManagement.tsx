import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Star,
  MessageSquare,
  ThumbsUp,
  AlertTriangle,
  Clock,
  Settings,
  Zap,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import "@/styles/components.css";

// ─── Rating Distribution Helper ─────────────────────────────────────────────

function RatingBar({ stars, count, total }: { stars: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium w-12">{stars} star</span>
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-yellow-400 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm text-muted-foreground w-10 text-right">{count}</span>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReviewManagement() {
  const [activeTab, setActiveTab] = useState("overview");
  const [config, setConfig] = useState({
    autoRequestEnabled: true,
    requestDelayHours: 2,
    googleReviewEnabled: true,
    yelpEnabled: false,
    minimumRatingThreshold: 4,
    negativeReviewRedirect: true,
    followUpEnabled: true,
    followUpDelayDays: 3,
    maxRequestsPerClient: 1,
  });
  const [googleLink, setGoogleLink] = useState("");
  const [yelpLink, setYelpLink] = useState("");

  const { data: metrics, isLoading } = trpc.analytics.reviewManagementMetrics.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const { data: settings } = trpc.tenant.settings.useQuery(undefined, { retry: false });
  const updateConfig = trpc.tenant.updateReviewManagementConfig.useMutation({
    onSuccess: () => toast.success("Review management configuration updated"),
    onError: (err: any) => toast.error(err.message),
  });

  useEffect(() => {
    if (settings?.reviewManagementConfig) {
      setConfig(settings.reviewManagementConfig);
    }
  }, [settings]);

  const handleSaveConfig = () => {
    updateConfig.mutate({ ...config, googleLink, yelpLink });
  };

  if (isLoading) return <DashboardLayout>Loading...</DashboardLayout>;

  const distribution = metrics?.ratingDistribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const totalRatings = Object.values(distribution).reduce((a: number, b: number) => a + b, 0);
  const recentActivity = metrics?.recentActivity || [];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Review Management</h1>
            <p className="text-muted-foreground mt-2">
              Automate review requests after appointments to build your online reputation
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveConfig} disabled={updateConfig.isPending}>
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
                  <MessageSquare className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reviews Requested</p>
                  <p className="text-2xl font-bold">{metrics?.reviewsRequested || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <ThumbsUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reviews Received</p>
                  <p className="text-2xl font-bold">{metrics?.reviewsReceived || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg mr-3">
                  <Star className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Average Rating</p>
                  <p className="text-2xl font-bold">{metrics?.averageRating?.toFixed(1) || "0.0"}</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Response Rate</p>
                  <p className="text-2xl font-bold">{metrics?.responseRate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="request-settings">Request Settings</TabsTrigger>
            <TabsTrigger value="platforms">Platforms</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Review Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recentActivity.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No recent review activity</p>
                  ) : (
                    recentActivity.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0">
                        <div>
                          <p className="font-medium text-sm">{item.clientName}</p>
                          <p className="text-xs text-muted-foreground">{item.date}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {Array.from({ length: 5 }).map((_, s) => (
                              <Star
                                key={s}
                                className={`h-4 w-4 ${s < item.rating ? "text-yellow-400 fill-yellow-400" : "text-muted"}`}
                              />
                            ))}
                          </div>
                          <Badge variant={item.platform === "google" ? "default" : "secondary"}>
                            {item.platform}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Rating Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Rating Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[5, 4, 3, 2, 1].map((stars) => (
                    <RatingBar
                      key={stars}
                      stars={stars}
                      count={(distribution as any)[stars] || 0}
                      total={totalRatings}
                    />
                  ))}
                  <div className="pt-3 border-t mt-4">
                    <p className="text-sm text-muted-foreground">
                      Total ratings: <span className="font-medium text-foreground">{totalRatings}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Request Settings Tab */}
          <TabsContent value="request-settings" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Auto-Request Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Automatic Review Requests
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Auto-Request Reviews</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Automatically send review requests after completed appointments
                      </p>
                    </div>
                    <Switch
                      checked={config.autoRequestEnabled}
                      onCheckedChange={(v) => setConfig({ ...config, autoRequestEnabled: v })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Delay After Appointment (hours)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={72}
                      value={config.requestDelayHours}
                      onChange={(e) => setConfig({ ...config, requestDelayHours: Number(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      How long to wait after an appointment before sending the review request
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Minimum Rating Threshold</Label>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={config.minimumRatingThreshold}
                      onChange={(e) => setConfig({ ...config, minimumRatingThreshold: Number(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Only prompt for public review if client rates at or above this threshold
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Max Requests Per Client (monthly)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={config.maxRequestsPerClient}
                      onChange={(e) => setConfig({ ...config, maxRequestsPerClient: Number(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum number of review requests to send per client per month
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Follow-up & Redirect Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Follow-up & Feedback Routing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Negative Review Redirect</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Redirect low ratings to private feedback instead of public review
                      </p>
                    </div>
                    <Switch
                      checked={config.negativeReviewRedirect}
                      onCheckedChange={(v) => setConfig({ ...config, negativeReviewRedirect: v })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Follow-up Reminders</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Send a follow-up if no review is received
                      </p>
                    </div>
                    <Switch
                      checked={config.followUpEnabled}
                      onCheckedChange={(v) => setConfig({ ...config, followUpEnabled: v })}
                    />
                  </div>

                  {config.followUpEnabled && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Follow-up Delay (days)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={14}
                        value={config.followUpDelayDays}
                        onChange={(e) => setConfig({ ...config, followUpDelayDays: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Days to wait before sending a follow-up reminder
                      </p>
                    </div>
                  )}

                  <div className="rounded-lg border p-4 bg-muted/30">
                    <h4 className="text-sm font-medium mb-2">How it works</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">1.</span>
                        Client completes appointment
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">2.</span>
                        SMS sent asking to rate experience (1-5 stars)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">3.</span>
                        High ratings directed to public review platform
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-500 mt-0.5">4.</span>
                        Low ratings redirected to private feedback form
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Platforms Tab */}
          <TabsContent value="platforms" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Google Reviews */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5" />
                    Google Reviews
                    {config.googleReviewEnabled && (
                      <Badge variant="default" className="ml-2">Active</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Enable Google Reviews</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Direct satisfied clients to leave a Google review
                      </p>
                    </div>
                    <Switch
                      checked={config.googleReviewEnabled}
                      onCheckedChange={(v) => setConfig({ ...config, googleReviewEnabled: v })}
                    />
                  </div>

                  {config.googleReviewEnabled && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Google Review Link</Label>
                      <Input
                        placeholder="https://g.page/r/your-business/review"
                        value={googleLink}
                        onChange={(e) => setGoogleLink(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Paste your Google Business review link here
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Yelp */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5" />
                    Yelp
                    {config.yelpEnabled && (
                      <Badge variant="default" className="ml-2">Active</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Enable Yelp Reviews</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Direct satisfied clients to leave a Yelp review
                      </p>
                    </div>
                    <Switch
                      checked={config.yelpEnabled}
                      onCheckedChange={(v) => setConfig({ ...config, yelpEnabled: v })}
                    />
                  </div>

                  {config.yelpEnabled && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Yelp Business Link</Label>
                      <Input
                        placeholder="https://www.yelp.com/biz/your-business"
                        value={yelpLink}
                        onChange={(e) => setYelpLink(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Paste your Yelp business page link here
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Platform Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Best Practices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <h4 className="text-sm font-medium">Timing Matters</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Send review requests 1-2 hours after the appointment when the experience is still fresh.
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ThumbsUp className="h-4 w-4 text-green-500" />
                      <h4 className="text-sm font-medium">Filter Feedback</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use the rating threshold to route unhappy clients to private feedback, protecting your public score.
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-purple-500" />
                      <h4 className="text-sm font-medium">Stay Consistent</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Consistent review volume signals trust to search engines. Keep auto-requests enabled for best results.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
