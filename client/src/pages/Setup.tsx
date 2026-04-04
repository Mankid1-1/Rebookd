import DashboardLayout from "@/components/layout/DashboardLayout";
import { safeLocalRedirect } from "@/utils/safeRedirect";
import { EncryptionBadge } from "@/components/ui/EncryptionBadge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/SmartInput";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Phone,
  Calendar,
  Zap,
  Link2,
  Unlink,
  Loader2,
  PhoneCall,
  Bell,
  UserPlus,
  AlertTriangle,
  Star,
  RotateCcw,
  CalendarCheck,
  RefreshCw,
  Save,
} from "lucide-react";
import { toast } from "sonner";

// Calendar providers
type Provider = "google" | "outlook" | "caldav" | "calendly" | "acuity";

const CALENDAR_PROVIDERS: Array<{
  id: Provider;
  name: string;
  icon: string;
  authType: "oauth" | "credentials";
}> = [
  { id: "google", name: "Google Calendar", icon: "📅", authType: "oauth" },
  { id: "outlook", name: "Outlook / 365", icon: "📧", authType: "oauth" },
  { id: "calendly", name: "Calendly", icon: "🗓️", authType: "oauth" },
  { id: "acuity", name: "Acuity", icon: "📋", authType: "credentials" },
  { id: "caldav", name: "Apple iCloud", icon: "🍎", authType: "credentials" },
];

// The 7 core automations shown in onboarding
const CORE_AUTOMATION_KEYS = [
  "missed_call_textback",
  "appointment_confirmation",
  "appointment_reminder_24h",
  "welcome_new_lead",
  "reduce_no_shows",
  "cancellation_same_day",
  "review_request",
];

const AUTOMATION_META: Record<string, { name: string; description: string; icon: React.ReactNode }> = {
  missed_call_textback: {
    name: "Missed Call Text-Back",
    description: "Instantly text anyone whose call you miss",
    icon: <PhoneCall className="h-4 w-4 text-destructive" />,
  },
  appointment_confirmation: {
    name: "Booking Confirmation",
    description: "Confirm appointments the moment they book",
    icon: <CalendarCheck className="h-4 w-4 text-info" />,
  },
  appointment_reminder_24h: {
    name: "24-Hour Reminder",
    description: "Reminder the day before their appointment",
    icon: <Bell className="h-4 w-4 text-warning" />,
  },
  welcome_new_lead: {
    name: "Welcome New Leads",
    description: "Instant welcome message with your booking link",
    icon: <UserPlus className="h-4 w-4 text-success" />,
  },
  reduce_no_shows: {
    name: "No-Show Recovery",
    description: "Follow up 15 min after a missed appointment",
    icon: <AlertTriangle className="h-4 w-4 text-warning" />,
  },
  cancellation_same_day: {
    name: "Cancellation Rescue",
    description: "Instant reschedule offer when someone cancels",
    icon: <RotateCcw className="h-4 w-4 text-destructive" />,
  },
  review_request: {
    name: "Review Request",
    description: "Ask for a review after a great appointment",
    icon: <Star className="h-4 w-4 text-warning" />,
  },
};

function SectionHeader({
  icon,
  title,
  complete,
  expanded,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  complete: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 p-4 text-left"
    >
      <div className="flex-shrink-0">{icon}</div>
      <span className="text-base font-semibold flex-1">{title}</span>
      {complete && (
        <Badge variant="secondary" className="gap-1 text-xs">
          <CheckCircle className="h-3 w-3 text-success" />
          Done
        </Badge>
      )}
      {expanded ? (
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

export default function Setup() {
  const [expandedSection, setExpandedSection] = useState<string | null>("phone");

  const utils = trpc.useUtils();

  // Fetch tenant data
  const { data: tenant } = trpc.tenant.get.useQuery();

  // Fetch calendar connections
  const { data: calendarConnections } = trpc.calendar.listConnections.useQuery();

  // Fetch enabled automations
  const { data: automations } = trpc.automations.list.useQuery();

  // Phone update
  const [phoneValue, setPhoneValue] = useState("");
  const [phoneEditing, setPhoneEditing] = useState(false);

  const updateTenant = trpc.tenant.update.useMutation({
    onSuccess: () => {
      toast.success("Phone number updated");
      setPhoneEditing(false);
      utils.tenant.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Calendar connect/disconnect
  const connectCalendar = trpc.calendar.initiateConnect.useMutation({
    onSuccess: (data) => {
      if (data.authUrl) {
        safeLocalRedirect(data.authUrl);
      } else {
        toast.success("Calendar connected!");
        utils.calendar.listConnections.invalidate();
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const disconnectCalendar = trpc.calendar.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Calendar disconnected");
      utils.calendar.listConnections.invalidate();
    },
  });

  // Automation toggle
  const toggleAutomation = trpc.automations.toggleByKey.useMutation({
    onSuccess: () => utils.automations.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const quickEnable = trpc.automations.quickEnable.useMutation({
    onSuccess: () => utils.automations.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  // Compute completion
  const hasPhone = !!tenant?.phone;
  const connectedCalendars = calendarConnections?.length ?? 0;
  const hasCalendar = connectedCalendars > 0;

  const automationMap = new Map(
    (automations || []).map((a: any) => [a.templateKey || a.key, a])
  );
  const enabledCoreCount = CORE_AUTOMATION_KEYS.filter(
    (key) => automationMap.get(key)?.enabled
  ).length;
  const hasAutomations = enabledCoreCount > 0;

  const completedSections = [hasPhone, hasCalendar, hasAutomations].filter(Boolean).length;

  const toggle = (section: string) =>
    setExpandedSection((prev) => (prev === section ? null : section));

  const handlePhoneSave = () => {
    if (!phoneValue.trim()) return toast.error("Enter a phone number");
    updateTenant.mutate({ phone: phoneValue.trim() });
  };

  const handleCalendarConnect = (provider: Provider) => {
    if (provider === "caldav" || provider === "acuity") {
      toast.info("Credential-based calendars can be configured in Calendar Integration settings.");
      return;
    }
    connectCalendar.mutate({ provider });
  };

  const handleAutomationToggle = (key: string, currentlyEnabled: boolean) => {
    const existing = automationMap.get(key);
    if (existing) {
      toggleAutomation.mutate({ key, enabled: !currentlyEnabled });
    } else {
      quickEnable.mutate({ key });
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Quick Setup</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {completedSections}/3 complete — finish these to start recovering revenue
          </p>
          {/* Progress bar */}
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(completedSections / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* ─── Section 1: Phone Number ─── */}
        <Card>
          <SectionHeader
            icon={<Phone className="h-5 w-5 text-primary" />}
            title="Business Phone"
            complete={hasPhone}
            expanded={expandedSection === "phone"}
            onToggle={() => toggle("phone")}
          />
          {expandedSection === "phone" && (
            <CardContent className="pt-0 pb-4 px-4">
              <p className="text-sm text-muted-foreground mb-3">
                This is where missed calls are detected and texts are sent from.
              </p>
              {hasPhone && !phoneEditing ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm">
                    <Phone className="h-4 w-4" />
                    {tenant?.phone}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPhoneValue(tenant?.phone || "");
                      setPhoneEditing(true);
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <PhoneInput
                      label=""
                      placeholder="Phone number"
                      name="phone"
                      onChange={(e) => setPhoneValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handlePhoneSave()}
                      autoFocus={phoneEditing}
                    />
                  </div>
                  <Button
                    onClick={handlePhoneSave}
                    disabled={updateTenant.isPending}
                    size="sm"
                    className="h-10"
                  >
                    {updateTenant.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                  {phoneEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPhoneEditing(false)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* ─── Section 2: Calendar ─── */}
        <Card>
          <SectionHeader
            icon={<Calendar className="h-5 w-5 text-primary" />}
            title="Calendar"
            complete={hasCalendar}
            expanded={expandedSection === "calendar"}
            onToggle={() => toggle("calendar")}
          />
          {expandedSection === "calendar" && (
            <CardContent className="pt-0 pb-4 px-4">
              <p className="text-sm text-muted-foreground mb-2">
                Connect your calendar so we can detect no-shows and send reminders.
              </p>
              <EncryptionBadge variant="badge" className="mb-3" />

              {/* Connected calendars */}
              {calendarConnections && calendarConnections.length > 0 && (
                <div className="space-y-2 mb-4">
                  {calendarConnections.map((conn: any) => (
                    <div
                      key={conn.id}
                      className="flex items-center gap-3 p-2 rounded-lg border bg-success/5 border-success/20"
                    >
                      <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                      <span className="text-sm flex-1">{conn.provider} — {conn.email || "Connected"}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => disconnectCalendar.mutate({ connectionId: conn.id })}
                        disabled={disconnectCalendar.isPending}
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add calendar */}
              <div className="space-y-2">
                {CALENDAR_PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => handleCalendarConnect(provider.id)}
                    disabled={connectCalendar.isPending}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <span className="text-lg">{provider.icon}</span>
                    <span className="text-sm font-medium flex-1 text-left">{provider.name}</span>
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        {/* ─── Section 3: Automations ─── */}
        <Card>
          <SectionHeader
            icon={<Zap className="h-5 w-5 text-primary" />}
            title="Automations"
            complete={hasAutomations}
            expanded={expandedSection === "automations"}
            onToggle={() => toggle("automations")}
          />
          {expandedSection === "automations" && (
            <CardContent className="pt-0 pb-4 px-4">
              <p className="text-sm text-muted-foreground mb-3">
                {enabledCoreCount} of {CORE_AUTOMATION_KEYS.length} core automations active.
                Toggle on/off below.
              </p>

              <div className="space-y-2">
                {CORE_AUTOMATION_KEYS.map((key) => {
                  const meta = AUTOMATION_META[key];
                  const existing = automationMap.get(key);
                  const isEnabled = !!existing?.enabled;

                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-shrink-0">{meta?.icon}</div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{meta?.name || key}</span>
                        <p className="text-xs text-muted-foreground">{meta?.description}</p>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => handleAutomationToggle(key, isEnabled)}
                        disabled={toggleAutomation.isPending || quickEnable.isPending}
                      />
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground text-center mt-3">
                Want more? Visit the full{" "}
                <a href="/automations" className="text-primary underline">
                  Automations page
                </a>{" "}
                for all {19} available workflows.
              </p>
            </CardContent>
          )}
        </Card>

        {/* All done message */}
        {completedSections === 3 && (
          <Card className="border-success/30 bg-success/5">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">You're all set!</p>
                <p className="text-xs text-muted-foreground">
                  Rebooked is working for you. Check your{" "}
                  <a href="/dashboard" className="text-primary underline">dashboard</a>{" "}
                  for results.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
