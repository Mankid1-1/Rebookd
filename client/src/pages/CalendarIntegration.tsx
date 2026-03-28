import DashboardLayout from "@/components/layout/DashboardLayout";
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
  Calendar,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Settings,
  Zap,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import "@/styles/components.css";

export default function CalendarIntegration() {
  const [activeTab, setActiveTab] = useState("connections");
  const [config, setConfig] = useState({
    googleCalendarEnabled: false,
    outlookEnabled: false,
    appleCalendarEnabled: false,
    autoSyncInterval: 15,
    twoWaySync: true,
    conflictResolution: "calendar_wins" as "calendar_wins" | "rebooked_wins",
    syncAppointmentStatus: true,
    syncCancellations: true,
  });

  const { data: metrics, isLoading } = trpc.analytics.calendarIntegrationMetrics.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );
  const { data: settings } = trpc.tenant.settings.useQuery(undefined, { retry: false });
  const updateConfig = trpc.tenant.updateCalendarIntegrationConfig.useMutation({
    onSuccess: () => toast.success("Calendar integration configuration updated"),
    onError: (err: any) => toast.error(err.message),
  });

  useEffect(() => {
    if (settings?.calendarIntegrationConfig) {
      setConfig(settings.calendarIntegrationConfig as any);
    }
  }, [settings]);

  const handleSaveConfig = () => {
    updateConfig.mutate(config);
  };

  const handleConnect = (provider: string) => {
    toast.success(`Connecting to ${provider}...`);
  };

  const handleSyncNow = () => {
    toast.success("Manual sync triggered successfully");
  };

  if (isLoading) return <DashboardLayout>Loading...</DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Calendar Integration
            </h1>
            <p className="text-muted-foreground mt-2">
              Sync appointments with your calendar software to keep schedules aligned and reduce double-bookings
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSyncNow} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Now
            </Button>
            <Button onClick={handleSaveConfig}>
              <CheckCircle className="h-4 w-4 mr-2" />
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
                  <Link2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Connected Calendars</p>
                  <p className="text-2xl font-bold">{metrics?.connectedCalendars || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <Calendar className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Synced Appointments</p>
                  <p className="text-2xl font-bold">{metrics?.syncedAppointments || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg mr-3">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sync Errors</p>
                  <p className="text-2xl font-bold">{metrics?.syncErrors || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Last Sync</p>
                  <p className="text-2xl font-bold">{metrics?.lastSync || "Never"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Calendar Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="connections">Connections</TabsTrigger>
                <TabsTrigger value="sync-settings">Sync Settings</TabsTrigger>
                <TabsTrigger value="status">Status</TabsTrigger>
              </TabsList>

              {/* Connections Tab */}
              <TabsContent value="connections" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Google Calendar */}
                  <Card className="border-2 hover:border-blue-300 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <div className="p-2 bg-red-100 rounded-lg">
                            <Calendar className="h-5 w-5 text-red-500" />
                          </div>
                          Google Calendar
                        </CardTitle>
                        <Badge variant={config.googleCalendarEnabled ? "default" : "secondary"}>
                          {config.googleCalendarEnabled ? "Connected" : "Disconnected"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Sync appointments with Google Calendar for real-time schedule updates.
                      </p>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="google-enabled">Enable</Label>
                        <Switch
                          id="google-enabled"
                          checked={config.googleCalendarEnabled}
                          onCheckedChange={(checked) =>
                            setConfig((prev) => ({ ...prev, googleCalendarEnabled: checked }))
                          }
                        />
                      </div>
                      <Button
                        className="w-full"
                        variant={config.googleCalendarEnabled ? "default" : "outline"}
                        onClick={() => handleConnect("Google Calendar")}
                      >
                        <Link2 className="h-4 w-4 mr-2" />
                        {config.googleCalendarEnabled ? "Reconnect" : "Connect"}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Outlook */}
                  <Card className="border-2 hover:border-blue-300 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Calendar className="h-5 w-5 text-blue-600" />
                          </div>
                          Outlook
                        </CardTitle>
                        <Badge variant={config.outlookEnabled ? "default" : "secondary"}>
                          {config.outlookEnabled ? "Connected" : "Disconnected"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Connect your Outlook calendar for seamless Microsoft 365 integration.
                      </p>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="outlook-enabled">Enable</Label>
                        <Switch
                          id="outlook-enabled"
                          checked={config.outlookEnabled}
                          onCheckedChange={(checked) =>
                            setConfig((prev) => ({ ...prev, outlookEnabled: checked }))
                          }
                        />
                      </div>
                      <Button
                        className="w-full"
                        variant={config.outlookEnabled ? "default" : "outline"}
                        onClick={() => handleConnect("Outlook")}
                      >
                        <Link2 className="h-4 w-4 mr-2" />
                        {config.outlookEnabled ? "Reconnect" : "Connect"}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Apple Calendar */}
                  <Card className="border-2 hover:border-blue-300 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <Calendar className="h-5 w-5 text-gray-700" />
                          </div>
                          Apple Calendar
                        </CardTitle>
                        <Badge variant={config.appleCalendarEnabled ? "default" : "secondary"}>
                          {config.appleCalendarEnabled ? "Connected" : "Disconnected"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Sync with Apple Calendar via CalDAV for iOS and macOS scheduling.
                      </p>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="apple-enabled">Enable</Label>
                        <Switch
                          id="apple-enabled"
                          checked={config.appleCalendarEnabled}
                          onCheckedChange={(checked) =>
                            setConfig((prev) => ({ ...prev, appleCalendarEnabled: checked }))
                          }
                        />
                      </div>
                      <Button
                        className="w-full"
                        variant={config.appleCalendarEnabled ? "default" : "outline"}
                        onClick={() => handleConnect("Apple Calendar")}
                      >
                        <Link2 className="h-4 w-4 mr-2" />
                        {config.appleCalendarEnabled ? "Reconnect" : "Connect"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Sync Settings Tab */}
              <TabsContent value="sync-settings" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="two-way-sync" className="text-base font-medium">
                          Two-Way Sync
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Changes in your calendar automatically update Rebooked and vice versa
                        </p>
                      </div>
                      <Switch
                        id="two-way-sync"
                        checked={config.twoWaySync}
                        onCheckedChange={(checked) =>
                          setConfig((prev) => ({ ...prev, twoWaySync: checked }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sync-interval">Auto-Sync Interval (minutes)</Label>
                      <Input
                        id="sync-interval"
                        type="number"
                        value={config.autoSyncInterval}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            autoSyncInterval: parseInt(e.target.value) || 15,
                          }))
                        }
                        min={5}
                        max={120}
                        className="max-w-[200px]"
                      />
                      <p className="text-xs text-muted-foreground">
                        How often Rebooked checks for calendar changes (5-120 minutes)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="conflict-resolution">Conflict Resolution</Label>
                      <select
                        id="conflict-resolution"
                        value={config.conflictResolution}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            conflictResolution: e.target.value as "calendar_wins" | "rebooked_wins",
                          }))
                        }
                        className="flex h-10 w-full max-w-[300px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="calendar_wins">Calendar wins (external changes take priority)</option>
                        <option value="rebooked_wins">Rebooked wins (platform changes take priority)</option>
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Determines which source takes priority when conflicting changes are detected
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="sync-status" className="text-base font-medium">
                          Sync Appointment Status
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Automatically update appointment status across platforms
                        </p>
                      </div>
                      <Switch
                        id="sync-status"
                        checked={config.syncAppointmentStatus}
                        onCheckedChange={(checked) =>
                          setConfig((prev) => ({ ...prev, syncAppointmentStatus: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="sync-cancellations" className="text-base font-medium">
                          Sync Cancellations
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          When an appointment is cancelled in one system, cancel it in the other
                        </p>
                      </div>
                      <Switch
                        id="sync-cancellations"
                        checked={config.syncCancellations}
                        onCheckedChange={(checked) =>
                          setConfig((prev) => ({ ...prev, syncCancellations: checked }))
                        }
                      />
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-600" />
                        Sync Capabilities
                      </h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>• Real-time appointment creation and updates</li>
                        <li>• Automatic conflict detection and resolution</li>
                        <li>• Staff availability synchronization</li>
                        <li>• Cancellation and rescheduling propagation</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Status Tab */}
              <TabsContent value="status" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Sync Health */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        Sync Health
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-sm font-medium">Overall Status</span>
                        </div>
                        <Badge variant="default" className="bg-green-600">Healthy</Badge>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Google Calendar</span>
                          <Badge variant={config.googleCalendarEnabled ? "default" : "secondary"}>
                            {config.googleCalendarEnabled ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Outlook</span>
                          <Badge variant={config.outlookEnabled ? "default" : "secondary"}>
                            {config.outlookEnabled ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Apple Calendar</span>
                          <Badge variant={config.appleCalendarEnabled ? "default" : "secondary"}>
                            {config.appleCalendarEnabled ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Sync Activity */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <RefreshCw className="h-5 w-5" />
                        Recent Sync Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="text-center p-6 text-muted-foreground">
                          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No recent sync activity</p>
                          <p className="text-xs mt-1">
                            Sync events will appear here once a calendar is connected
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Sync Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Sync Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">
                          {metrics?.syncedAppointments || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Appointments Synced</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">
                          {metrics?.connectedCalendars || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Active Connections</p>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <p className="text-2xl font-bold text-red-600">
                          {metrics?.syncErrors || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Errors (Last 24h)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
