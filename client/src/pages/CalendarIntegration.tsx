import DashboardLayout from "@/components/layout/DashboardLayout";
import { safeLocalRedirect } from "@/utils/safeRedirect";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpTooltip, HelpIcon } from "@/components/ui/HelpTooltip";
import {
  Calendar,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Link2,
  Unlink,
  Loader2,
  CalendarDays,
  AlertTriangle,
  Key,
} from "lucide-react";
import { toast } from "sonner";
import { EncryptionBadge } from "@/components/ui/EncryptionBadge";

type Provider = "google" | "outlook" | "caldav" | "calendly" | "acuity";

const PROVIDER_INFO: Record<Provider, { name: string; color: string; description: string; authType: "oauth" | "credentials"; comingSoon?: boolean; comingSoonReason?: string }> = {
  google: { name: "Google Calendar", color: "text-destructive bg-destructive/10", description: "Sync with Google Calendar via OAuth", authType: "oauth" },
  outlook: { name: "Outlook / Microsoft 365", color: "text-primary bg-primary/10", description: "Connect your Outlook calendar", authType: "oauth", comingSoon: true, comingSoonReason: "Requires Microsoft Azure developer registration. Funding is limited — this integration is coming soon." },
  caldav: { name: "Apple Calendar (iCloud)", color: "text-muted-foreground bg-muted", description: "Sync via CalDAV with app-specific password", authType: "credentials", comingSoon: true, comingSoonReason: "Requires Apple developer setup and testing. Funding is limited — this integration is coming soon." },
  calendly: { name: "Calendly", color: "text-info bg-info/10", description: "Import events from Calendly", authType: "oauth" },
  acuity: { name: "Acuity Scheduling", color: "text-success bg-success/10", description: "Sync appointments from Acuity", authType: "credentials", comingSoon: true, comingSoonReason: "Requires Acuity Powerhouse plan for API access. Funding is limited — this integration is coming soon." },
};

export default function CalendarIntegration() {
  const [activeTab, setActiveTab] = useState("connections");
  const [credentialsModal, setCredentialsModal] = useState<Provider | null>(null);
  const [credentials, setCredentials] = useState({ username: "", appPassword: "", userId: "", apiKey: "" });

  const utils = trpc.useUtils();
  const { data: connections, isLoading } = trpc.calendar.listConnections.useQuery();
  const connectMutation = trpc.calendar.initiateConnect.useMutation({
    onSuccess: (data) => {
      if (data.authUrl) {
        safeLocalRedirect(data.authUrl);
      } else {
        toast.success("Calendar connected successfully!");
        utils.calendar.listConnections.invalidate();
        setCredentialsModal(null);
      }
    },
    onError: (err) => toast.error(err.message),
  });
  const disconnectMutation = trpc.calendar.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Calendar disconnected");
      utils.calendar.listConnections.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const syncMutation = trpc.calendar.syncNow.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Synced ${data.eventsProcessed} events`);
      } else {
        toast.error(data.error || "Sync failed");
      }
      utils.calendar.listConnections.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Check URL for OAuth callback
  useState(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (code && state) {
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
      // Handle callback via mutation
      // This is handled server-side via the calendar router
    }
  });

  const handleConnect = (provider: Provider) => {
    const info = PROVIDER_INFO[provider];
    if (info.authType === "credentials") {
      setCredentialsModal(provider);
      return;
    }
    connectMutation.mutate({ provider });
  };

  const handleCredentialSubmit = () => {
    if (!credentialsModal) return;
    connectMutation.mutate({
      provider: credentialsModal,
      credentials: credentialsModal === "caldav"
        ? { username: credentials.username, appPassword: credentials.appPassword }
        : { userId: credentials.userId, apiKey: credentials.apiKey },
    });
  };

  const connectedProviders = new Set(connections?.map((c) => c.provider) || []);

  // Calendar events view
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { data: events } = trpc.calendar.getEvents.useQuery(
    { start: now.toISOString(), end: weekAhead.toISOString() },
    { enabled: (connections?.length ?? 0) > 0 }
  );

  // Gaps view
  const { data: gaps } = trpc.calendar.getGaps.useQuery(
    { start: now.toISOString(), end: weekAhead.toISOString(), gapThresholdMinutes: 30 },
    { enabled: (connections?.length ?? 0) > 0 }
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Calendar Integration</h1>
              <HelpIcon content={{ basic: "Connect your calendar so Rebooked knows about your appointments", intermediate: "Sync appointments from Google Calendar, Outlook, Calendly, or Acuity for automated reminders and no-show detection", advanced: "OAuth2 integration with calendar providers. Sync runs every 5 minutes via calendar-sync.service.ts cron job" }} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your calendars to detect gaps, auto-fill slots, and trigger cancellation recovery
            </p>
          </div>
        </div>

        {/* Encryption & Privacy Disclaimer */}
        <EncryptionBadge variant="card" />

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <HelpTooltip content={{ basic: "Your connected calendar accounts", intermediate: "Manage connected calendars — disconnect, re-sync, or switch providers" }} variant="info">
                  <p className="text-xs text-muted-foreground">Connected</p>
                </HelpTooltip>
                <p className="text-xl font-bold">{connections?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <CalendarDays className="h-5 w-5 text-success" />
              </div>
              <div>
                <HelpTooltip content="Appointments and events pulled from your connected calendars in the next 7 days." variant="info">
                  <p className="text-xs text-muted-foreground">Upcoming Events</p>
                </HelpTooltip>
                <p className="text-xl font-bold">{events?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <HelpTooltip content="Empty slots of 30 minutes or more where you could fit another appointment." variant="info">
                  <p className="text-xs text-muted-foreground">Open Gaps</p>
                </HelpTooltip>
                <p className="text-xl font-bold">{gaps?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <HelpTooltip content="Appointments marked as cancelled in your connected calendars within the next 7 days." variant="info">
                  <p className="text-xs text-muted-foreground">Cancellations</p>
                </HelpTooltip>
                <p className="text-xl font-bold">
                  {events?.filter((e: any) => e.status === "cancelled").length || 0}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="gaps">Scheduling Gaps</TabsTrigger>
          </TabsList>

          {/* Connections */}
          <TabsContent value="connections" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(Object.entries(PROVIDER_INFO) as [Provider, typeof PROVIDER_INFO[Provider]][]).map(
                ([key, info]) => {
                  const conn = connections?.find((c) => c.provider === key);
                  const isConnected = !!conn;
                  const isSoon = info.comingSoon;
                  return (
                    <Card key={key} className={`border transition-colors ${isConnected ? "border-success/30" : isSoon ? "opacity-75" : "hover:border-muted-foreground/30"}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${info.color.split(" ")[1]}`}>
                              <Calendar className={`h-4 w-4 ${info.color.split(" ")[0]}`} />
                            </div>
                            {info.name}
                            <HelpIcon content={{ basic: "Pick which calendar app you use", intermediate: "Supported providers: Google Calendar, Microsoft Outlook/365, Calendly, Acuity Scheduling, Apple iCloud", advanced: "OAuth2 flow via calendar.router.ts initiateConnect. State stored in oauthStates map with 10-minute expiry" }} />
                          </CardTitle>
                          {isSoon ? (
                            <Badge variant="outline" className="text-[10px] border-warning/50 text-warning">Coming Soon</Badge>
                          ) : isConnected ? (
                            <Badge className="bg-success text-success-foreground text-[10px]">Connected</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Not Connected</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground">{info.description}</p>
                        {isSoon && (
                          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/5 border border-warning/20">
                            <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground">{info.comingSoonReason}</p>
                          </div>
                        )}
                        {isConnected && conn && (
                          <div className="text-xs space-y-1">
                            <p className="text-muted-foreground">
                              Label: <span className="text-foreground">{conn.label}</span>
                            </p>
                            <p className="text-muted-foreground">
                              <HelpTooltip content={{ basic: "Shows if your calendar is properly connected and up to date", intermediate: "Sync status: connected, syncing, or error. Last sync time and event count displayed", advanced: "calendar_connections table tracks provider, sync_enabled, last_sync_at. Sync fetches events via provider-specific API and upserts into appointments table" }} variant="info">
                                Last sync:
                              </HelpTooltip>{" "}
                              <span className="text-foreground">
                                {conn.lastSyncAt
                                  ? new Date(conn.lastSyncAt).toLocaleString()
                                  : "Never"}
                              </span>
                            </p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          {isSoon ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              disabled
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              Coming Soon
                            </Button>
                          ) : isConnected ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => conn && syncMutation.mutate({ connectionId: conn.id })}
                                disabled={syncMutation.isPending}
                              >
                                {syncMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                )}
                                Sync
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => conn && disconnectMutation.mutate({ connectionId: conn.id })}
                                disabled={disconnectMutation.isPending}
                              >
                                <Unlink className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => handleConnect(key)}
                              disabled={connectMutation.isPending}
                            >
                              {connectMutation.isPending ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Link2 className="h-3 w-3 mr-1" />
                              )}
                              Connect
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
              )}
            </div>
          </TabsContent>

          {/* Events */}
          <TabsContent value="events" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upcoming Events (Next 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {!events || events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No upcoming events</p>
                    <p className="text-xs mt-1">Connect a calendar to see your appointments here</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {events.map((event: any) => (
                      <div
                        key={event.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          event.status === "cancelled" ? "bg-destructive/5 border-destructive/20" : "bg-card"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {event.status === "cancelled" ? (
                            <XCircle className="h-4 w-4 text-destructive shrink-0" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-success shrink-0" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{event.title || "Untitled Event"}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(event.startTime).toLocaleDateString()} {" "}
                              {new Date(event.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              {" — "}
                              {new Date(event.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            {event.attendeeName && (
                              <p className="text-xs text-muted-foreground mt-0.5">{event.attendeeName}</p>
                            )}
                          </div>
                        </div>
                        <Badge variant={event.status === "cancelled" ? "destructive" : "secondary"} className="text-[10px]">
                          {event.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gaps */}
          <TabsContent value="gaps" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Scheduling Gaps (30+ min)</CardTitle>
                  <Badge variant="outline">{gaps?.length || 0} gaps found</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {!gaps || gaps.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-40 text-success" />
                    <p className="text-sm">No scheduling gaps detected</p>
                    <p className="text-xs mt-1">Your calendar is well-utilized</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {gaps.map((gap: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-warning/5 border-warning/20">
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-warning shrink-0" />
                          <div>
                            <p className="text-sm font-medium">
                              {new Date(gap.startTime).toLocaleDateString()}{" "}
                              {new Date(gap.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              {" — "}
                              {new Date(gap.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            <p className="text-xs text-muted-foreground">{Math.round(gap.duration)} min gap</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-warning border-warning/30 text-[10px]">
                          {gap.duration >= 60 ? "Large Gap" : "Open Slot"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Credentials Modal */}
        {credentialsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Connect {PROVIDER_INFO[credentialsModal].name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {credentialsModal === "caldav" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="caldav-username">Apple ID Email</Label>
                      <Input
                        id="caldav-username"
                        value={credentials.username}
                        onChange={(e) => setCredentials((p) => ({ ...p, username: e.target.value }))}
                        placeholder="you@icloud.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <HelpTooltip content="Generate an app-specific password at appleid.apple.com — this is different from your main Apple ID password." variant="help">
                        <Label htmlFor="caldav-password">App-Specific Password</Label>
                      </HelpTooltip>
                      <Input
                        id="caldav-password"
                        type="password"
                        value={credentials.appPassword}
                        onChange={(e) => setCredentials((p) => ({ ...p, appPassword: e.target.value }))}
                        placeholder="xxxx-xxxx-xxxx-xxxx"
                      />
                      <p className="text-xs text-muted-foreground">
                        Generate at appleid.apple.com → Sign-In and Security → App-Specific Passwords
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="acuity-userid">Acuity User ID</Label>
                      <Input
                        id="acuity-userid"
                        value={credentials.userId}
                        onChange={(e) => setCredentials((p) => ({ ...p, userId: e.target.value }))}
                        placeholder="12345678"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="acuity-apikey">API Key</Label>
                      <Input
                        id="acuity-apikey"
                        type="password"
                        value={credentials.apiKey}
                        onChange={(e) => setCredentials((p) => ({ ...p, apiKey: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Found in Acuity → Integrations → API Credentials
                      </p>
                    </div>
                  </>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setCredentialsModal(null)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleCredentialSubmit}
                    disabled={connectMutation.isPending}
                  >
                    {connectMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Connect
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
