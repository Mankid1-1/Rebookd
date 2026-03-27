import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Clock, Bell, MessageSquare, CheckCircle,
  Settings2, Zap, TrendingUp, ListChecks
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export default function WaitingList() {
  const [enabled, setEnabled] = useState(false);
  const [autoNotify, setAutoNotify] = useState(true);
  const [maxNotificationsPerSlot, setMaxNotificationsPerSlot] = useState("3");
  const [notifyWindow, setNotifyWindow] = useState("30");
  const [priorityOrder, setPriorityOrder] = useState("wait_time");
  const [notificationTemplate, setNotificationTemplate] = useState(
    "Great news, {{name}}! A spot just opened up at {{business}} on {{date}} at {{time}}. Reply YES to book it before someone else does!"
  );

  const { data: savedConfig, isLoading } = trpc.featureConfig.get.useQuery(
    { feature: "waiting_list" },
    { retry: false }
  );
  const saveConfig = trpc.featureConfig.save.useMutation({
    onSuccess: () => toast.success("Waiting list settings saved"),
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (savedConfig?.config) {
      const saved = savedConfig.config as Record<string, unknown>;
      if (saved.enabled !== undefined) setEnabled(saved.enabled as boolean);
      if (saved.autoNotify !== undefined) setAutoNotify(saved.autoNotify as boolean);
      if (saved.maxNotificationsPerSlot !== undefined) setMaxNotificationsPerSlot(saved.maxNotificationsPerSlot as string);
      if (saved.notifyWindow !== undefined) setNotifyWindow(saved.notifyWindow as string);
      if (saved.priorityOrder !== undefined) setPriorityOrder(saved.priorityOrder as string);
      if (saved.notificationTemplate !== undefined) setNotificationTemplate(saved.notificationTemplate as string);
    }
  }, [savedConfig]);

  const handleSaveConfig = () => {
    saveConfig.mutate({
      feature: "waiting_list",
      config: {
        enabled,
        autoNotify,
        maxNotificationsPerSlot,
        notifyWindow,
        priorityOrder,
        notificationTemplate,
      },
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
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
            <h1 className="text-3xl font-bold">Waiting List</h1>
            <p className="text-muted-foreground mt-1">
              Automatically fill cancelled slots by notifying interested clients
            </p>
          </div>
          <Button
            onClick={handleSaveConfig}
            disabled={saveConfig.isPending}
            className="gap-2"
          >
            <Settings2 className="h-4 w-4" />
            {saveConfig.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        {/* Stats Cards - all zeros since no backend data yet */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-500/10 rounded-lg mr-3">
                  <Users className="h-6 w-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm font-medium text-muted-foreground">Currently Waiting</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-500/10 rounded-lg mr-3">
                  <Bell className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm font-medium text-muted-foreground">Notified Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-500/10 rounded-lg mr-3">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm font-medium text-muted-foreground">Slots Filled</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Fill Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Empty State */}
        <Card>
          <CardContent className="p-12">
            <div className="text-center max-w-lg mx-auto">
              <div className="p-4 bg-blue-500/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <ListChecks className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No waiting list entries yet</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                When a client cancels, Rebooked automatically notifies people on your waiting list
                to fill the slot. Clients are added to the waiting list when they express interest
                in a time that is already booked. Configure the settings below to get started.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Feature Toggle */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Zap className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <CardTitle>Cancellation Flurry</CardTitle>
                  <CardDescription>
                    Automatically SMS waiting list customers when a cancellation occurs
                  </CardDescription>
                </div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </CardHeader>
          {enabled && (
            <CardContent className="space-y-6 border-t border-border pt-6">
              {/* Auto-Notify */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Auto-Notify on Cancellation</Label>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Immediately SMS waiting list customers when a spot opens up
                  </p>
                </div>
                <Switch checked={autoNotify} onCheckedChange={setAutoNotify} />
              </div>

              {/* Max Notifications Per Slot */}
              <div className="space-y-2">
                <Label>Max Notifications Per Slot</Label>
                <Select value={maxNotificationsPerSlot} onValueChange={setMaxNotificationsPerSlot}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 person</SelectItem>
                    <SelectItem value="3">3 people</SelectItem>
                    <SelectItem value="5">5 people</SelectItem>
                    <SelectItem value="10">10 people</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How many people to notify when a single slot opens up
                </p>
              </div>

              {/* Response Window */}
              <div className="space-y-2">
                <Label>Response Window</Label>
                <Select value={notifyWindow} onValueChange={setNotifyWindow}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Time customers have to respond before the next person on the list is notified
                </p>
              </div>

              {/* Priority Order */}
              <div className="space-y-2">
                <Label>Priority Order</Label>
                <Select value={priorityOrder} onValueChange={setPriorityOrder}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wait_time">Longest waiting first</SelectItem>
                    <SelectItem value="added_recent">Most recently added</SelectItem>
                    <SelectItem value="service_match">Best service match</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How to prioritize who gets notified first when a slot opens
                </p>
              </div>

              {/* Notification Template */}
              <div className="space-y-2">
                <Label>Notification Message Template</Label>
                <Textarea
                  value={notificationTemplate}
                  onChange={(e) => setNotificationTemplate(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Available variables: {"{{name}}"}, {"{{business}}"}, {"{{date}}"}, {"{{time}}"}, {"{{service}}"}
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <div className="p-3 bg-blue-500/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
                <h4 className="font-medium mb-1 text-sm">1. Clients Join Waitlist</h4>
                <p className="text-xs text-muted-foreground">
                  When a client wants a slot that is taken, they are added to your waiting list
                </p>
              </div>
              <div className="text-center p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <div className="p-3 bg-yellow-500/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="h-5 w-5 text-yellow-400" />
                </div>
                <h4 className="font-medium mb-1 text-sm">2. Cancellation Triggers SMS</h4>
                <p className="text-xs text-muted-foreground">
                  When someone cancels, waitlisted clients are automatically notified via SMS
                </p>
              </div>
              <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <div className="p-3 bg-green-500/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <h4 className="font-medium mb-1 text-sm">3. Slot Gets Filled</h4>
                <p className="text-xs text-muted-foreground">
                  First responder books the slot, recovering revenue that would have been lost
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
