import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Star, MessageSquare, TrendingUp, Settings2, Send,
  ExternalLink, BarChart3
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

export default function ReviewManagement() {
  const [enabled, setEnabled] = useState(false);
  const [delayHours, setDelayHours] = useState("2");
  const [platforms, setPlatforms] = useState<string[]>(["google"]);
  const [reviewLink, setReviewLink] = useState("");
  const [smsTemplate, setSmsTemplate] = useState(
    "Thanks for visiting {{business}}, {{name}}! We'd love your feedback. Leave us a quick review here: {{review_link}}"
  );

  const { data: savedConfig, isLoading } = trpc.featureConfig.get.useQuery(
    { feature: "review_management" },
    { retry: false }
  );
  const saveConfig = trpc.featureConfig.save.useMutation({
    onSuccess: () => toast.success("Review settings saved"),
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (savedConfig?.config) {
      const saved = savedConfig.config as Record<string, unknown>;
      if (saved.enabled !== undefined) setEnabled(saved.enabled as boolean);
      if (saved.delayHours !== undefined) setDelayHours(saved.delayHours as string);
      if (saved.platforms !== undefined) setPlatforms(saved.platforms as string[]);
      if (saved.reviewLink !== undefined) setReviewLink(saved.reviewLink as string);
      if (saved.smsTemplate !== undefined) setSmsTemplate(saved.smsTemplate as string);
    }
  }, [savedConfig]);

  const handleSaveSettings = () => {
    saveConfig.mutate({
      feature: "review_management",
      config: { enabled, delayHours, platforms, reviewLink, smsTemplate },
    });
  };

  const togglePlatform = (platform: string) => {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
          <div>
            <Skeleton className="h-8 w-56 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Review Management</h1>
            <p className="text-muted-foreground mt-1">
              Automatically request reviews from clients after successful appointments
            </p>
          </div>
          <Button
            onClick={handleSaveSettings}
            disabled={saveConfig.isPending}
            className="gap-2"
          >
            <Settings2 className="h-4 w-4" />
            {saveConfig.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        {/* Stats Cards - zeros that populate as system runs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-500/10 rounded-lg mr-3">
                  <Send className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm font-medium text-muted-foreground">Requests Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-500/10 rounded-lg mr-3">
                  <MessageSquare className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm font-medium text-muted-foreground">Reviews Received</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-500/10 rounded-lg mr-3">
                  <Star className="h-6 w-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">--</p>
                  <p className="text-sm font-medium text-muted-foreground">Average Rating</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-purple-500/10 rounded-lg mr-3">
                  <TrendingUp className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">0%</p>
                  <p className="text-sm font-medium text-muted-foreground">Response Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Empty State */}
        <Card>
          <CardContent className="p-12">
            <div className="text-center max-w-lg mx-auto">
              <div className="p-4 bg-yellow-500/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-yellow-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No reviews collected yet</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Automatically request reviews from clients after successful appointments.
                Once enabled, Rebooked will send a personalized SMS after each completed visit,
                driving more 5-star reviews to your preferred platform.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Feature Toggle & Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <CardTitle>Review Request Automation</CardTitle>
                  <CardDescription>
                    Configure when and how review requests are sent after appointments
                  </CardDescription>
                </div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </CardHeader>
          {enabled && (
            <CardContent className="space-y-6 border-t border-border pt-6">
              {/* Delay After Appointment */}
              <div className="space-y-2">
                <Label>Delay After Appointment</Label>
                <Select value={delayHours} onValueChange={setDelayHours}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="2">2 hours</SelectItem>
                    <SelectItem value="4">4 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="48">48 hours</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How long to wait after a completed appointment before sending the review request
                </p>
              </div>

              {/* Review Platforms */}
              <div className="space-y-3">
                <Label>Review Platforms</Label>
                <div className="space-y-2">
                  {[
                    { id: "google", label: "Google Business Profile" },
                    { id: "yelp", label: "Yelp" },
                    { id: "facebook", label: "Facebook" },
                  ].map((platform) => (
                    <div key={platform.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={platform.id}
                        checked={platforms.includes(platform.id)}
                        onCheckedChange={() => togglePlatform(platform.id)}
                      />
                      <label
                        htmlFor={platform.id}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {platform.label}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Select which platforms you want to drive reviews to
                </p>
              </div>

              {/* Review Link */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Review Link URL
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </Label>
                <Input
                  placeholder="https://g.page/r/your-business/review"
                  value={reviewLink}
                  onChange={(e) => setReviewLink(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The direct link to your review page on your primary platform
                </p>
              </div>

              {/* SMS Template */}
              <div className="space-y-2">
                <Label>SMS Template</Label>
                <Textarea
                  value={smsTemplate}
                  onChange={(e) => setSmsTemplate(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Available variables: {"{{business}}"}, {"{{name}}"}, {"{{review_link}}"}, {"{{service}}"}
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              How Review Requests Work
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <div className="p-3 bg-blue-500/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <Send className="h-5 w-5 text-blue-400" />
                </div>
                <h4 className="font-medium mb-1 text-sm">1. Appointment Completes</h4>
                <p className="text-xs text-muted-foreground">
                  After a client finishes their appointment, a timer starts based on your configured delay
                </p>
              </div>
              <div className="text-center p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <div className="p-3 bg-yellow-500/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="h-5 w-5 text-yellow-400" />
                </div>
                <h4 className="font-medium mb-1 text-sm">2. SMS Sent Automatically</h4>
                <p className="text-xs text-muted-foreground">
                  A personalized review request is sent via SMS with your review link
                </p>
              </div>
              <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <div className="p-3 bg-green-500/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <Star className="h-5 w-5 text-green-400" />
                </div>
                <h4 className="font-medium mb-1 text-sm">3. Reviews Roll In</h4>
                <p className="text-xs text-muted-foreground">
                  Happy clients leave reviews, boosting your online reputation and attracting new customers
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
