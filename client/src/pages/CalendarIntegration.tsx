import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  Calendar, Copy, Check, Settings2, Clock, Link2, ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

const CALENDAR_PROVIDERS = [
  {
    id: "google",
    name: "Google Calendar",
    description: "Sync appointments with Google Calendar. Supports two-way sync and automatic event creation.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="2" />
        <path d="M3 9h18" stroke="#4285F4" strokeWidth="2" />
        <path d="M9 3v18" stroke="#4285F4" strokeWidth="2" />
        <rect x="11" y="11" width="4" height="4" rx="0.5" fill="#4285F4" />
      </svg>
    ),
    color: "bg-blue-500/10 border-blue-500/30",
  },
  {
    id: "outlook",
    name: "Outlook / Microsoft 365",
    description: "Integrate with Outlook Calendar and Microsoft 365 for seamless scheduling.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="#0078D4" strokeWidth="2" />
        <path d="M3 9h18" stroke="#0078D4" strokeWidth="2" />
        <path d="M9 3v18" stroke="#0078D4" strokeWidth="2" />
        <circle cx="15" cy="15" r="2.5" fill="#0078D4" />
      </svg>
    ),
    color: "bg-indigo-500/10 border-indigo-500/30",
  },
  {
    id: "calendly",
    name: "Calendly",
    description: "Connect Calendly to auto-import bookings and trigger SMS automations on new events.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#006BFF" strokeWidth="2" />
        <path d="M12 7v5l3 3" stroke="#006BFF" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    color: "bg-cyan-500/10 border-cyan-500/30",
  },
] as const;

const DURATION_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "60 minutes" },
  { value: "90", label: "90 minutes" },
  { value: "120", label: "120 minutes" },
];

const SYNC_INTERVAL_OPTIONS = [
  { value: "5", label: "Every 5 minutes" },
  { value: "15", label: "Every 15 minutes" },
  { value: "30", label: "Every 30 minutes" },
  { value: "60", label: "Every hour" },
];

const SYNC_DIRECTION_OPTIONS = [
  { value: "one-way", label: "One-way (Calendar to Rebooked)" },
  { value: "two-way", label: "Two-way sync" },
];

export default function CalendarIntegration() {
  const [defaultDuration, setDefaultDuration] = useState("30");
  const [syncInterval, setSyncInterval] = useState("15");
  const [syncDirection, setSyncDirection] = useState("one-way");
  const [copied, setCopied] = useState(false);

  const { data: savedConfig, isLoading } = trpc.featureConfig.get.useQuery(
    { feature: "calendar_integration" },
    { retry: false }
  );

  const saveConfig = trpc.featureConfig.save.useMutation({
    onSuccess: () => toast.success("Calendar settings saved"),
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (savedConfig?.config) {
      const saved = savedConfig.config as Record<string, unknown>;
      if (typeof saved.defaultDuration === "string") setDefaultDuration(saved.defaultDuration);
      if (typeof saved.syncInterval === "string") setSyncInterval(saved.syncInterval);
      if (typeof saved.syncDirection === "string") setSyncDirection(saved.syncDirection);
    }
  }, [savedConfig]);

  const handleSave = () => {
    saveConfig.mutate({
      feature: "calendar_integration",
      config: { defaultDuration, syncInterval, syncDirection },
    });
  };

  const webhookUrl = `${window.location.origin}/api/webhooks/calendar`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("Webhook URL copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Calendar Integration</h1>
          <p className="text-zinc-400 mt-1">
            Connect your calendar to sync appointments and trigger SMS automations automatically.
          </p>
        </div>

        {/* Calendar Providers */}
        <div>
          <h2 className="text-lg font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-zinc-400" />
            Connect Your Calendar
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CALENDAR_PROVIDERS.map((provider) => (
              <Card
                key={provider.id}
                className={`border ${provider.color} bg-zinc-900/50`}
              >
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                        {provider.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-100">{provider.name}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10 text-xs">
                      Coming Soon
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {provider.description}
                  </p>
                  <Button
                    variant="outline"
                    className="w-full border-zinc-700 text-zinc-400 hover:text-zinc-200"
                    disabled
                  >
                    Connect
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Manual Webhook Integration */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Link2 className="h-5 w-5 text-zinc-400" />
              Manual Integration
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Use this webhook URL to connect your calendar or scheduling software manually.
              Send appointment events to this endpoint to trigger Rebooked automations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Label className="text-zinc-300">Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  value={webhookUrl}
                  readOnly
                  className="flex-1 bg-zinc-800/50 border-zinc-700 text-zinc-300 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  className="border-zinc-700 gap-2 shrink-0"
                  onClick={handleCopyWebhook}
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
              <p className="text-xs text-zinc-500">
                POST JSON payloads with appointment data to this URL. See documentation for payload format.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Settings2 className="h-5 w-5 text-zinc-400" />
              Calendar Settings
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Configure how Rebooked handles calendar events and appointment syncing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Default Duration */}
            <div className="space-y-2">
              <Label className="text-zinc-300 flex items-center gap-2">
                <Clock className="h-4 w-4 text-zinc-500" />
                Default Appointment Duration
              </Label>
              <Select value={defaultDuration} onValueChange={setDefaultDuration}>
                <SelectTrigger className="w-64 bg-zinc-800/50 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500">
                Used when appointment duration is not specified by the calendar source.
              </p>
            </div>

            {/* Sync Interval */}
            <div className="space-y-2">
              <Label className="text-zinc-300 flex items-center gap-2">
                <Clock className="h-4 w-4 text-zinc-500" />
                Auto-Sync Interval
              </Label>
              <Select value={syncInterval} onValueChange={setSyncInterval}>
                <SelectTrigger className="w-64 bg-zinc-800/50 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYNC_INTERVAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500">
                How often Rebooked checks for new or updated calendar events.
              </p>
            </div>

            {/* Sync Direction */}
            <div className="space-y-2">
              <Label className="text-zinc-300 flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-zinc-500" />
                Sync Direction
              </Label>
              <Select value={syncDirection} onValueChange={setSyncDirection}>
                <SelectTrigger className="w-64 bg-zinc-800/50 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYNC_DIRECTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500">
                One-way imports events into Rebooked. Two-way also pushes Rebooked changes back to your calendar.
              </p>
            </div>

            {/* Save */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={saveConfig.isPending}
                className="gap-2"
              >
                <Settings2 className="h-4 w-4" />
                {saveConfig.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
