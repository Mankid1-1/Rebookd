import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Building2, Key, Phone, Plus, Trash2, Bell, Shield, Clock,
  Upload, Copy, Eye, EyeOff, Globe, Monitor, LogOut, Download,
  AlertTriangle, CheckCircle2, Circle, Loader2, Link2,
  Mail, MessageSquare, Users, UserPlus, CreditCard, Calendar,
  Lock, FileText, Heart, Zap, TrendingUp, Settings as SettingsIcon,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useLocale } from "@/contexts/LocaleContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const min = i % 2 === 0 ? "00" : "30";
  const display = `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:${min} ${hour < 12 ? "AM" : "PM"}`;
  const value = `${String(hour).padStart(2, "0")}:${min}`;
  return { display, value };
});

type BusinessHours = Record<string, { enabled: boolean; open: string; close: string }>;

const DEFAULT_HOURS: BusinessHours = Object.fromEntries(
  DAYS_OF_WEEK.map(({ key }) => [
    key,
    { enabled: key !== "sun", open: "09:00", close: "17:00" },
  ])
);

const getDynamicIndustries = () => {
  const userLocation = navigator.language || "en-US";
  const isUS = userLocation.includes("en-US");
  if (isUS) {
    return [
      "Hair Salon", "Barbershop", "Nail Salon", "Day Spa", "Medical / Clinic",
      "Dental", "Chiropractic", "Physical Therapy", "Personal Training / Gym",
      "Massage Therapy", "Tattoo Studio", "Aesthetics / Med Spa", "Yoga / Pilates",
      "Pet Grooming", "Other",
    ];
  }
  return [
    "Hair Salon", "Barbershop", "Beauty Salon", "Day Spa", "Medical Clinic",
    "Dental Practice", "Wellness Center", "Fitness Studio", "Therapy Center",
    "Massage Therapy", "Tattoo Studio", "Aesthetic Clinic", "Yoga Studio",
    "Pet Services", "Other",
  ];
};

const getDynamicTimezones = () => {
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isUS = userTimezone.includes("America/") || userTimezone.includes("Pacific/");
  if (isUS) {
    return [
      { value: userTimezone, label: `${userTimezone.split("/").pop()} (Local)` },
      { value: "America/New_York", label: "Eastern (ET)" },
      { value: "America/Chicago", label: "Central (CT)" },
      { value: "America/Denver", label: "Mountain (MT)" },
      { value: "America/Los_Angeles", label: "Pacific (PT)" },
      { value: "America/Phoenix", label: "Arizona (no DST)" },
      { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
      { value: "America/Anchorage", label: "Alaska (AKT)" },
    ];
  }
  return [
    { value: userTimezone, label: `${userTimezone.split("/").pop()} (Local)` },
    { value: "Europe/London", label: "London (GMT/BST)" },
    { value: "Europe/Dublin", label: "Dublin (IST)" },
    { value: "Europe/Paris", label: "Paris (CET/CEST)" },
    { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
    { value: "Australia/Sydney", label: "Sydney (AEDT)" },
    { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  ];
};

const HEALTHCARE_INDUSTRIES = ["medical_/_clinic", "dental", "chiropractic", "physical_therapy"];

// ─── Heading helper ──────────────────────────────────────────────────────────

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h3
    className="text-base font-semibold tracking-tight"
    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
  >
    {children}
  </h3>
);

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Settings() {
  const { t } = useLocale();
  const utils = trpc.useUtils();
  const { data: tenant } = trpc.tenant.get.useQuery(undefined, { retry: false });
  const { data: phones = [] } = trpc.tenant.phoneNumbers.useQuery(undefined, { retry: false });
  const { data: apiKeys = [] } = trpc.apiKeys.list.useQuery(undefined, { retry: false });

  const industries = getDynamicIndustries();
  const timezones = getDynamicTimezones();

  // ── Business Profile state ──
  const [name, setName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [timezone, setTimezone] = useState("");
  const [industry, setIndustry] = useState("");
  const [businessErrors, setBusinessErrors] = useState<Record<string, string>>({});

  // ── Business Hours state ──
  const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_HOURS);
  const [closedDates, setClosedDates] = useState<string[]>([]);
  const [newClosedDate, setNewClosedDate] = useState("");
  const [afterHoursAutoReply, setAfterHoursAutoReply] = useState(true);
  const [afterHoursMessage, setAfterHoursMessage] = useState(
    "Thanks for reaching out! We're currently closed. We'll get back to you during business hours."
  );

  // ── Messaging & Compliance state ──
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
  const [quietStart, setQuietStart] = useState("21:00");
  const [quietEnd, setQuietEnd] = useState("08:00");
  const [optInConsentTracking, setOptInConsentTracking] = useState(true);
  const [autoHandleKeywords, setAutoHandleKeywords] = useState(true);
  const [autoStopReply, setAutoStopReply] = useState(
    "You have been unsubscribed and will no longer receive messages from us. Reply START to re-subscribe."
  );
  const [autoHelpReply, setAutoHelpReply] = useState(
    "For support, contact us at support@yourbusiness.com or call during business hours. Reply STOP to unsubscribe."
  );
  const [optInMessage, setOptInMessage] = useState(
    "By replying YES, you consent to receive appointment reminders and promotional messages. Msg & data rates may apply. Reply STOP to cancel."
  );
  const [phiRedaction, setPhiRedaction] = useState(false);
  const [baaStatus, setBaaStatus] = useState<"not_started" | "pending" | "signed">("not_started");
  const [encryptionAtRest, setEncryptionAtRest] = useState(true);
  const [defaultSenderName, setDefaultSenderName] = useState("");
  const [messageFooter, setMessageFooter] = useState("Reply STOP to opt out.");
  const [aiTone, setAiTone] = useState<"friendly" | "professional" | "urgent">("friendly");

  // ── Notification state ──
  const [emailNotifs, setEmailNotifs] = useState({
    newLead: true,
    messageReceived: true,
    newBooking: true,
    dailySummary: true,
    weeklyAnalytics: false,
    paymentReceived: true,
    noShowAlerts: true,
  });
  const [digestFrequency, setDigestFrequency] = useState<"daily" | "weekly" | "both">("daily");
  const [revenueMilestoneAlerts, setRevenueMilestoneAlerts] = useState(true);
  const [noShowThreshold, setNoShowThreshold] = useState("15");

  // ── Integrations state ──
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [webhookSecret] = useState("whsec_" + "x".repeat(32));
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [newPhone, setNewPhone] = useState("");

  // ── Security state ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // ── Team state ──
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);

  // ── Team data from API ──
  const { data: teamMembers = [], refetch: refetchTeam } = trpc.tenant.team.list.useQuery(undefined, { retry: false });
  const { data: pendingInvitations = [], refetch: refetchPending } = trpc.tenant.team.pending.useQuery(undefined, { retry: false });
  const inviteMutation = trpc.tenant.team.invite.useMutation({
    onSuccess: () => {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      refetchPending();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setInviteSending(false),
  });
  const removeMutation = trpc.tenant.team.remove.useMutation({
    onSuccess: () => {
      toast.success("Team member removed");
      refetchTeam();
    },
    onError: (err) => toast.error(err.message),
  });
  const cancelInviteMutation = trpc.tenant.team.cancelInvite.useMutation({
    onSuccess: () => {
      toast.success("Invitation cancelled");
      refetchPending();
    },
    onError: (err) => toast.error(err.message),
  });
  const resendInviteMutation = trpc.tenant.team.resendInvite.useMutation({
    onSuccess: () => toast.success("Invitation resent"),
    onError: (err) => toast.error(err.message),
  });

  // ── Populate from tenant ──
  useEffect(() => {
    if (tenant) {
      setName(tenant.name ?? "");
      setTimezone(tenant.timezone ?? "");
      setIndustry(tenant.industry ?? "");
      setCity((tenant as any).city ?? "");
      setBusinessEmail((tenant as any).email ?? "");
      setBusinessPhone((tenant as any).phone ?? "");
      setWebsite((tenant as any).website ?? "");
      setDefaultSenderName(tenant.name ?? "");
    }
  }, [tenant]);

  // ── Mutations ──
  const updateTenant = trpc.tenant.update.useMutation({
    onSuccess: () => {
      toast.success("Settings saved");
      utils.tenant.get.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const addPhone = trpc.tenant.addPhoneNumber.useMutation({
    onSuccess: () => {
      toast.success("Phone number added");
      setNewPhone("");
      utils.tenant.phoneNumbers.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const removePhone = trpc.tenant.removePhoneNumber.useMutation({
    onSuccess: () => {
      toast.success("Phone number removed");
      utils.tenant.phoneNumbers.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const setDefault = trpc.tenant.setDefaultPhoneNumber.useMutation({
    onSuccess: () => {
      toast.success("Default number updated");
      utils.tenant.phoneNumbers.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const createApiKey = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      toast.success(`API key created! Copy it now: ${data.key}`, { duration: 15000 });
      setNewKeyLabel("");
      utils.apiKeys.list.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const revokeApiKey = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => {
      toast.success("API key revoked");
      utils.apiKeys.list.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  // ── Handlers ──
  const validateAndSaveProfile = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Business name is required";
    if (businessEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail)) {
      errors.email = "Invalid email format";
    }
    if (website && !/^https?:\/\//.test(website) && website.trim()) {
      errors.website = "URL must start with http:// or https://";
    }
    setBusinessErrors(errors);
    if (Object.keys(errors).length > 0) return;

    updateTenant.mutate({
      name: name.trim(),
      timezone: timezone || undefined,
      industry: industry || undefined,
    });
  }, [name, timezone, industry, businessEmail, website, updateTenant]);

  const handlePasswordChange = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!currentPassword) errors.current = "Current password is required";
    if (!newPassword) errors.new = "New password is required";
    else if (newPassword.length < 8) errors.new = "Must be at least 8 characters";
    else if (!/[A-Z]/.test(newPassword)) errors.new = "Must contain an uppercase letter";
    else if (!/[0-9]/.test(newPassword)) errors.new = "Must contain a number";
    if (newPassword !== confirmPassword) errors.confirm = "Passwords do not match";

    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    toast.success("Password updated successfully");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, [currentPassword, newPassword, confirmPassword]);

  const updateBusinessHour = (day: string, field: "enabled" | "open" | "close", value: boolean | string) => {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const addClosedDate = () => {
    if (newClosedDate && !closedDates.includes(newClosedDate)) {
      setClosedDates((prev) => [...prev, newClosedDate].sort());
      setNewClosedDate("");
      toast.success("Closed date added");
    }
  };

  const removeClosedDate = (date: string) => {
    setClosedDates((prev) => prev.filter((d) => d !== date));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const isHealthcareIndustry = HEALTHCARE_INDUSTRIES.includes(industry);

  // ── Mock data ──
  const activeSessions = [
    { id: 1, device: "Chrome on Windows", ip: "192.168.1.1", location: "New York, US", current: true, lastActive: "Now" },
    { id: 2, device: "Safari on iPhone", ip: "192.168.1.42", location: "New York, US", current: false, lastActive: "2 hours ago" },
  ];

  const stripeConnected = false;

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t('settings.title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('settings.subtitle')}
          </p>
        </div>

        {/* Setup checklist */}
        {phones.length === 0 && (
          <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-xl p-4 space-y-2.5">
            <p className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" /> Quick setup checklist
            </p>
            {[
              { done: !!tenant?.name && tenant.name !== "My Business", label: "Set your business name" },
              { done: phones.length > 0, label: "Add a phone number for SMS" },
              { done: apiKeys.length > 0, label: "Create an API key (optional)" },
            ].map(({ done, label }) => (
              <div key={label} className="flex items-center gap-2.5 w-full text-left">
                {done
                  ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                <span className={`text-sm ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════ TABS ═══════════════════════ */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="profile" className="gap-1.5 text-xs sm:text-sm flex-shrink-0">
              <Building2 className="w-3.5 h-3.5 hidden sm:inline" /> Profile
            </TabsTrigger>
            <TabsTrigger value="hours" className="gap-1.5 text-xs sm:text-sm flex-shrink-0">
              <Clock className="w-3.5 h-3.5 hidden sm:inline" /> Hours
            </TabsTrigger>
            <TabsTrigger value="compliance" className="gap-1.5 text-xs sm:text-sm flex-shrink-0">
              <Shield className="w-3.5 h-3.5 hidden sm:inline" /> Compliance
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5 text-xs sm:text-sm flex-shrink-0">
              <Bell className="w-3.5 h-3.5 hidden sm:inline" /> Alerts
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-1.5 text-xs sm:text-sm flex-shrink-0">
              <Link2 className="w-3.5 h-3.5 hidden sm:inline" /> Integrations
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 text-xs sm:text-sm flex-shrink-0">
              <Lock className="w-3.5 h-3.5 hidden sm:inline" /> Security
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-1.5 text-xs sm:text-sm flex-shrink-0">
              <Users className="w-3.5 h-3.5 hidden sm:inline" /> Team
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════ BUSINESS PROFILE TAB ═══════════════════════ */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Building2 className="w-4 h-4 text-primary" /> Business Information
                </CardTitle>
                <CardDescription>Your public-facing business details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Logo upload */}
                <div className="space-y-1.5">
                  <Label>Business logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/30">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <Button variant="outline" size="sm">
                        <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload logo
                      </Button>
                      <p className="text-xs text-muted-foreground">PNG, JPG or SVG. Max 2MB.</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-name">Business name <span className="text-destructive">*</span></Label>
                    <Input
                      id="biz-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your business name"
                      className={businessErrors.name ? "border-destructive" : ""}
                    />
                    {businessErrors.name && (
                      <p className="text-xs text-destructive">{businessErrors.name}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-phone">Phone number</Label>
                    <Input
                      id="biz-phone"
                      type="tel"
                      value={businessPhone}
                      onChange={(e) => setBusinessPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-email">Email</Label>
                    <Input
                      id="biz-email"
                      type="email"
                      value={businessEmail}
                      onChange={(e) => setBusinessEmail(e.target.value)}
                      placeholder="hello@yourbusiness.com"
                      className={businessErrors.email ? "border-destructive" : ""}
                    />
                    {businessErrors.email && (
                      <p className="text-xs text-destructive">{businessErrors.email}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-website">Website</Label>
                    <Input
                      id="biz-website"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://yourbusiness.com"
                      className={businessErrors.website ? "border-destructive" : ""}
                    />
                    {businessErrors.website && (
                      <p className="text-xs text-destructive">{businessErrors.website}</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="biz-address">Street address</Label>
                    <Input
                      id="biz-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="123 Main St, Suite 100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-city">City</Label>
                    <Input
                      id="biz-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. New York"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="biz-state">State / Region</Label>
                      <Input
                        id="biz-state"
                        value={stateRegion}
                        onChange={(e) => setStateRegion(e.target.value)}
                        placeholder="NY"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="biz-zip">ZIP / Postal code</Label>
                      <Input
                        id="biz-zip"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        placeholder="10001"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Industry</Label>
                    <Select value={industry || "other"} onValueChange={setIndustry}>
                      <SelectTrigger><SelectValue placeholder="Select your industry" /></SelectTrigger>
                      <SelectContent>
                        {industries.map((ind) => (
                          <SelectItem key={ind} value={ind.toLowerCase().replace(/[\s/]+/g, "_")}>{ind}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Timezone</Label>
                    <Select value={timezone || "America/New_York"} onValueChange={setTimezone}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {timezones.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={validateAndSaveProfile}
                disabled={updateTenant.isPending}
                className="min-w-[140px]"
              >
                {updateTenant.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  "Save profile"
                )}
              </Button>
            </div>
          </TabsContent>

          {/* ═══════════════════════ BUSINESS HOURS TAB ═══════════════════════ */}
          <TabsContent value="hours" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Clock className="w-4 h-4 text-primary" /> Weekly Schedule
                </CardTitle>
                <CardDescription>Set your operating hours for each day of the week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {DAYS_OF_WEEK.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3 py-2">
                      <div className="w-28 flex items-center gap-2">
                        <Switch
                          checked={businessHours[key]?.enabled ?? false}
                          onCheckedChange={(v) => updateBusinessHour(key, "enabled", v)}
                        />
                        <span className={`text-sm font-medium ${!businessHours[key]?.enabled ? "text-muted-foreground" : ""}`}>
                          {label}
                        </span>
                      </div>
                      {businessHours[key]?.enabled ? (
                        <div className="flex items-center gap-2 flex-1 flex-wrap">
                          <Select
                            value={businessHours[key].open}
                            onValueChange={(v) => updateBusinessHour(key, "open", v)}
                          >
                            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.display}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-muted-foreground text-sm">to</span>
                          <Select
                            value={businessHours[key].close}
                            onValueChange={(v) => updateBusinessHour(key, "close", v)}
                          >
                            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.display}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Closed</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Holidays / Closed Dates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Calendar className="w-4 h-4 text-primary" /> Holidays & Closed Dates
                </CardTitle>
                <CardDescription>Add specific dates when your business will be closed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={newClosedDate}
                    onChange={(e) => setNewClosedDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                  <Button
                    size="sm"
                    onClick={addClosedDate}
                    disabled={!newClosedDate}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>

                {closedDates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No closed dates scheduled.</p>
                ) : (
                  <div className="space-y-2">
                    {closedDates.map((date) => (
                      <div key={date} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <span className="text-sm font-medium">
                          {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeClosedDate(date)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* After Hours Auto-Reply */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <MessageSquare className="w-4 h-4 text-primary" /> After-Hours Auto-Reply
                </CardTitle>
                <CardDescription>Automatically respond to messages received outside business hours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable auto-reply</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Send an automatic response when messages arrive outside your business hours
                    </p>
                  </div>
                  <Switch
                    checked={afterHoursAutoReply}
                    onCheckedChange={setAfterHoursAutoReply}
                  />
                </div>
                {afterHoursAutoReply && (
                  <div className="space-y-1.5">
                    <Label>Auto-reply message</Label>
                    <Textarea
                      value={afterHoursMessage}
                      onChange={(e) => setAfterHoursMessage(e.target.value)}
                      rows={3}
                      placeholder="Message sent when you're closed..."
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => toast.success("Business hours saved")} className="min-w-[140px]">
                Save hours
              </Button>
            </div>
          </TabsContent>

          {/* ═══════════════════════ MESSAGING & COMPLIANCE TAB ═══════════════════════ */}
          <TabsContent value="compliance" className="space-y-6">
            {/* TCPA Compliance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Shield className="w-4 h-4 text-primary" /> TCPA Compliance
                </CardTitle>
                <CardDescription>
                  Telephone Consumer Protection Act compliance settings. These controls help ensure your messaging practices meet federal regulations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Quiet Hours */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="flex items-center gap-2">
                        Quiet hours enforcement
                        <Badge variant="secondary" className="text-[10px] h-5">Required</Badge>
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        No messages before 8 AM or after 9 PM in the recipient's timezone
                      </p>
                    </div>
                    <Switch
                      checked={quietHoursEnabled}
                      onCheckedChange={setQuietHoursEnabled}
                    />
                  </div>
                  {quietHoursEnabled && (
                    <div className="flex items-center gap-3 pl-1 flex-wrap">
                      <Label className="text-sm text-muted-foreground whitespace-nowrap">No messages between</Label>
                      <Select value={quietStart} onValueChange={setQuietStart}>
                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.display}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground text-sm">and</span>
                      <Select value={quietEnd} onValueChange={setQuietEnd}>
                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.display}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Opt-in consent tracking */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Opt-in consent tracking</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Track and store consent records for every contact before messaging
                    </p>
                  </div>
                  <Switch
                    checked={optInConsentTracking}
                    onCheckedChange={setOptInConsentTracking}
                  />
                </div>

                <Separator />

                {/* Auto-handle STOP/HELP */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="flex items-center gap-2">
                      Auto-handle STOP / HELP keywords
                      <Badge variant="secondary" className="text-[10px] h-5">Required</Badge>
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Automatically process STOP, UNSUBSCRIBE, CANCEL, HELP, and INFO keywords
                    </p>
                  </div>
                  <Switch
                    checked={autoHandleKeywords}
                    onCheckedChange={setAutoHandleKeywords}
                  />
                </div>

                {autoHandleKeywords && (
                  <div className="space-y-4 pl-1">
                    <div className="space-y-1.5">
                      <Label>STOP reply message</Label>
                      <Textarea
                        value={autoStopReply}
                        onChange={(e) => setAutoStopReply(e.target.value)}
                        rows={2}
                        placeholder="Message sent when a contact replies STOP"
                      />
                      <p className="text-xs text-muted-foreground">
                        Sent automatically when a contact texts STOP, UNSUBSCRIBE, or CANCEL
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>HELP reply message</Label>
                      <Textarea
                        value={autoHelpReply}
                        onChange={(e) => setAutoHelpReply(e.target.value)}
                        rows={2}
                        placeholder="Message sent when a contact replies HELP"
                      />
                      <p className="text-xs text-muted-foreground">
                        Sent automatically when a contact texts HELP or INFO
                      </p>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Opt-in language template */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2">
                    Required opt-in language
                    <Badge variant="secondary" className="text-[10px] h-5">Required</Badge>
                  </Label>
                  <Textarea
                    value={optInMessage}
                    onChange={(e) => setOptInMessage(e.target.value)}
                    rows={3}
                    placeholder="Consent message sent to new contacts"
                  />
                  <p className="text-xs text-muted-foreground">
                    This message is sent to new contacts to confirm messaging consent. Must include opt-out instructions and data rate notice.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* HIPAA Compliance - only shown for healthcare industries */}
            {isHealthcareIndustry && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    <Heart className="w-4 h-4 text-primary" /> HIPAA Compliance
                  </CardTitle>
                  <CardDescription>
                    Healthcare-specific privacy and security controls for Protected Health Information (PHI)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>PHI redaction in messages</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Automatically detect and redact Protected Health Information in outbound messages
                      </p>
                    </div>
                    <Switch
                      checked={phiRedaction}
                      onCheckedChange={setPhiRedaction}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Business Associate Agreement (BAA)</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        A BAA is required before processing any PHI through Rebooked
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {baaStatus === "signed" ? (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Signed
                        </Badge>
                      ) : baaStatus === "pending" ? (
                        <Badge variant="secondary">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Pending
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setBaaStatus("pending");
                            toast.success("BAA request submitted. Our team will contact you.");
                          }}
                        >
                          <FileText className="w-3.5 h-3.5 mr-1.5" /> Request BAA
                        </Button>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Encryption at rest</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        All stored data is encrypted using AES-256 encryption at rest
                      </p>
                    </div>
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Message Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <MessageSquare className="w-4 h-4 text-primary" /> Message Settings
                </CardTitle>
                <CardDescription>Configure how your outbound messages appear</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="sender-name">Default sender name</Label>
                    <Input
                      id="sender-name"
                      value={defaultSenderName}
                      onChange={(e) => setDefaultSenderName(e.target.value)}
                      placeholder="Your Business Name"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used as the sender identifier in outbound messages
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>AI tone preference</Label>
                    <Select value={aiTone} onValueChange={(v) => setAiTone(v as typeof aiTone)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="friendly">Friendly - warm and approachable</SelectItem>
                        <SelectItem value="professional">Professional - formal and concise</SelectItem>
                        <SelectItem value="urgent">Urgent - action-oriented and direct</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Controls the tone AI uses when generating messages
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="msg-footer">Message footer (opt-out instructions)</Label>
                  <Textarea
                    id="msg-footer"
                    value={messageFooter}
                    onChange={(e) => setMessageFooter(e.target.value)}
                    rows={2}
                    placeholder="Reply STOP to opt out."
                  />
                  <p className="text-xs text-muted-foreground">
                    Appended to every outbound message. Must contain opt-out instructions per TCPA requirements.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => toast.success("Compliance settings saved")} className="min-w-[140px]">
                Save compliance settings
              </Button>
            </div>
          </TabsContent>

          {/* ═══════════════════════ NOTIFICATIONS TAB ═══════════════════════ */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Mail className="w-4 h-4 text-primary" /> Email Notifications
                </CardTitle>
                <CardDescription>Choose which emails you want to receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {([
                  { key: "newLead" as const, label: "New lead notifications", desc: "Get notified when a new lead is captured" },
                  { key: "messageReceived" as const, label: "Message received", desc: "Alert when a customer replies to a message" },
                  { key: "newBooking" as const, label: "New booking", desc: "Get notified when a customer books an appointment" },
                  { key: "paymentReceived" as const, label: "Payment received", desc: "Get notified when a payment is processed" },
                  { key: "noShowAlerts" as const, label: "No-show alerts", desc: "Alert when a customer misses their appointment" },
                ]).map(({ key, label, desc }) => (
                  <div key={key} className="flex items-start gap-3 py-2">
                    <Checkbox
                      id={`email-${key}`}
                      checked={emailNotifs[key]}
                      onCheckedChange={(v) =>
                        setEmailNotifs((prev) => ({ ...prev, [key]: v === true }))
                      }
                    />
                    <div className="space-y-0.5">
                      <Label htmlFor={`email-${key}`} className="text-sm font-medium cursor-pointer">
                        {label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Digest */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <FileText className="w-4 h-4 text-primary" /> Digest Reports
                </CardTitle>
                <CardDescription>Summary reports delivered to your inbox</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Daily summary</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      A daily digest of appointments, leads, and activity
                    </p>
                  </div>
                  <Checkbox
                    checked={emailNotifs.dailySummary}
                    onCheckedChange={(v) =>
                      setEmailNotifs((prev) => ({ ...prev, dailySummary: v === true }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Weekly analytics report</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Performance metrics and trends delivered every Monday
                    </p>
                  </div>
                  <Checkbox
                    checked={emailNotifs.weeklyAnalytics}
                    onCheckedChange={(v) =>
                      setEmailNotifs((prev) => ({ ...prev, weeklyAnalytics: v === true }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Digest frequency</Label>
                  <Select value={digestFrequency} onValueChange={(v) => setDigestFrequency(v as typeof digestFrequency)}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily only</SelectItem>
                      <SelectItem value="weekly">Weekly only</SelectItem>
                      <SelectItem value="both">Both daily and weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Alert Thresholds */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <TrendingUp className="w-4 h-4 text-primary" /> Alert Thresholds
                </CardTitle>
                <CardDescription>Get alerted when key metrics hit certain levels</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Revenue milestone alerts</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Get notified when you hit revenue milestones ($1K, $5K, $10K, etc.)
                    </p>
                  </div>
                  <Switch
                    checked={revenueMilestoneAlerts}
                    onCheckedChange={setRevenueMilestoneAlerts}
                  />
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label htmlFor="noshow-threshold">No-show rate alert threshold (%)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="noshow-threshold"
                      type="number"
                      min="1"
                      max="100"
                      value={noShowThreshold}
                      onChange={(e) => setNoShowThreshold(e.target.value)}
                      className="w-[100px]"
                    />
                    <p className="text-sm text-muted-foreground">
                      Alert when no-show rate exceeds {noShowThreshold}%
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You will receive an email when your weekly no-show rate crosses this threshold
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => toast.success("Notification preferences saved")} className="min-w-[140px]">
                Save preferences
              </Button>
            </div>
          </TabsContent>

          {/* ═══════════════════════ INTEGRATIONS TAB ═══════════════════════ */}
          <TabsContent value="integrations" className="space-y-6">
            {/* Stripe Connect */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <CreditCard className="w-4 h-4 text-primary" /> Stripe Connect
                </CardTitle>
                <CardDescription>Accept payments through Stripe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${stripeConnected ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                    <div>
                      <p className="text-sm font-medium">
                        {stripeConnected ? "Stripe account connected" : "Stripe not connected"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {stripeConnected
                          ? "Payments are being processed through your Stripe account"
                          : "Connect your Stripe account to accept payments from customers"}
                      </p>
                    </div>
                  </div>
                  {stripeConnected ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive border-destructive/20">
                          Disconnect
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect Stripe?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will disconnect your Stripe account. You will no longer be able to process payments until reconnected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive hover:bg-destructive/90">
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button size="sm" onClick={() => window.location.href = "/stripe-connect"}>
                      <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Connect Stripe
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Calendar Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Calendar className="w-4 h-4 text-primary" /> Calendar Integration
                </CardTitle>
                <CardDescription>Sync appointments with your calendar</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-muted-foreground/40" />
                    <div>
                      <p className="text-sm font-medium">Calendar not connected</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Connect Google Calendar or Outlook to sync appointments
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    <Calendar className="w-3.5 h-3.5 mr-1.5" /> Coming soon
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Phone Numbers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Phone className="w-4 h-4 text-primary" /> SMS Phone Numbers
                </CardTitle>
                <CardDescription>Manage your outbound SMS numbers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Setup steps</p>
                  <p>1. Buy a number in your <a href="https://console.twilio.com" target="_blank" rel="noopener" className="text-primary underline">Twilio Console</a> or <a href="https://portal.telnyx.com" target="_blank" rel="noopener" className="text-primary underline">Telnyx Portal</a></p>
                  <p>2. Add your number below</p>
                  <p>3. Set the inbound webhook URL to:</p>
                  <code className="block bg-muted rounded px-2 py-1 mt-1 select-all font-mono text-[11px]">
                    {typeof window !== "undefined" ? window.location.origin : "https://yourdomain.com"}/api/twilio/inbound
                  </code>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="+15550000000"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={!newPhone.trim() || addPhone.isPending}
                    onClick={() => addPhone.mutate({ number: newPhone })}
                  >
                    {addPhone.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                    Add
                  </Button>
                </div>

                <Separator />

                {phones.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No phone numbers configured yet.</p>
                ) : (
                  <div className="space-y-2">
                    {phones.map((phone: any) => (
                      <div key={phone.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div>
                          <p className="text-sm font-medium">{phone.number}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {phone.isDefault && <Badge variant="secondary" className="text-[10px] h-5">Default</Badge>}
                            {phone.label && <span className="text-xs text-muted-foreground">{phone.label}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!phone.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setDefault.mutate({ phoneNumberId: phone.id })}
                            >
                              Set default
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove phone number?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove {phone.number} from your account. Existing conversations using this number will no longer be able to send messages.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => removePhone.mutate({ phoneNumberId: phone.id })}
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Webhooks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Link2 className="w-4 h-4 text-primary" /> Webhook Configuration
                </CardTitle>
                <CardDescription>Receive real-time event notifications via HTTP POST</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-server.com/webhooks/rebooked"
                  />
                  <p className="text-xs text-muted-foreground">
                    We will POST events (new leads, messages, bookings, payments) to this endpoint
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Webhook signing secret</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      type={showWebhookSecret ? "text" : "password"}
                      value={webhookSecret}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 shrink-0"
                      onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                    >
                      {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 shrink-0"
                      onClick={() => copyToClipboard(webhookSecret)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use this secret to verify that webhook payloads originate from Rebooked
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* API Keys */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Key className="w-4 h-4 text-primary" /> API Keys
                </CardTitle>
                <CardDescription>Create and manage API keys for external integrations. Keys are only shown once at creation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Key label (e.g. My CRM)"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={createApiKey.isPending}
                    onClick={() => createApiKey.mutate({ label: newKeyLabel || undefined })}
                  >
                    {createApiKey.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                    Create
                  </Button>
                </div>

                <Separator />

                {apiKeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No API keys yet. Create one to get started.</p>
                ) : (
                  <div className="space-y-2">
                    {apiKeys.map((key: any) => (
                      <div key={key.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{key.label || "Unnamed key"}</p>
                            {key.lastUsedAt && (
                              <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                                Last used: {new Date(key.lastUsedAt).toLocaleDateString()}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-muted-foreground font-mono">
                              {showApiKey === key.id ? key.prefix + "x".repeat(24) : key.prefix + "*".repeat(24)}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => setShowApiKey(showApiKey === key.id ? null : key.id)}
                            >
                              {showApiKey === key.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              Created {new Date(key.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-3">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently revoke &quot;{key.label || "Unnamed key"}&quot;. Any integrations using this key will immediately stop working.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => revokeApiKey.mutate({ keyId: key.id })}
                                >
                                  Revoke
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => toast.success("Integration settings saved")} className="min-w-[140px]">
                Save integrations
              </Button>
            </div>
          </TabsContent>

          {/* ═══════════════════════ SECURITY TAB ═══════════════════════ */}
          <TabsContent value="security" className="space-y-6">
            {/* Change password */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Lock className="w-4 h-4 text-primary" /> Change Password
                </CardTitle>
                <CardDescription>Update your account password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-md">
                <div className="space-y-1.5">
                  <Label htmlFor="current-pw">Current password</Label>
                  <Input
                    id="current-pw"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className={passwordErrors.current ? "border-destructive" : ""}
                  />
                  {passwordErrors.current && (
                    <p className="text-xs text-destructive">{passwordErrors.current}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-pw">New password</Label>
                  <Input
                    id="new-pw"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className={passwordErrors.new ? "border-destructive" : ""}
                  />
                  {passwordErrors.new && (
                    <p className="text-xs text-destructive">{passwordErrors.new}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Must be at least 8 characters with an uppercase letter and a number
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-pw">Confirm new password</Label>
                  <Input
                    id="confirm-pw"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className={passwordErrors.confirm ? "border-destructive" : ""}
                  />
                  {passwordErrors.confirm && (
                    <p className="text-xs text-destructive">{passwordErrors.confirm}</p>
                  )}
                </div>
                <Button onClick={handlePasswordChange}>Update password</Button>
              </CardContent>
            </Card>

            {/* Two-factor auth */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Shield className="w-4 h-4 text-primary" /> Two-Factor Authentication
                </CardTitle>
                <CardDescription>Add an extra layer of security to your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {twoFactorEnabled ? "2FA is enabled" : "2FA is disabled"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {twoFactorEnabled
                        ? "Your account is protected with an authenticator app"
                        : "Enable to require a code from your authenticator app at login"}
                    </p>
                  </div>
                  <Switch
                    checked={twoFactorEnabled}
                    onCheckedChange={(v) => {
                      setTwoFactorEnabled(v);
                      toast.success(v ? "2FA enabled" : "2FA disabled");
                    }}
                  />
                </div>
                {twoFactorEnabled && (
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                    <p className="text-sm font-medium">Scan this QR code with your authenticator app</p>
                    <div className="w-40 h-40 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-white dark:bg-muted/30 mx-auto">
                      <span className="text-xs text-muted-foreground">QR Code</span>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Use Google Authenticator, Authy, or any compatible TOTP app
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active sessions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Monitor className="w-4 h-4 text-primary" /> Active Sessions
                </CardTitle>
                <CardDescription>Devices currently logged in to your account</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeSessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{session.device}</p>
                            {session.current && (
                              <Badge variant="secondary" className="text-[10px] h-5">Current</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {session.ip} &middot; {session.location} &middot; {session.lastActive}
                          </p>
                        </div>
                      </div>
                      {!session.current && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive h-7 text-xs"
                          onClick={() => toast.success("Session revoked")}
                        >
                          <LogOut className="w-3.5 h-3.5 mr-1" /> Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Data & Privacy */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Download className="w-4 h-4 text-primary" /> Data & Privacy
                </CardTitle>
                <CardDescription>Manage your data and account (GDPR compliance)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Export your data</p>
                    <p className="text-xs text-muted-foreground">
                      Download a copy of all your data (GDPR/CCPA compliance)
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => toast.success("Export started. You will receive an email when ready.")}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Export
                  </Button>
                </div>

                <Separator />

                <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                  <div>
                    <p className="text-sm font-medium text-destructive">Delete account</p>
                    <p className="text-xs text-muted-foreground">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        Delete account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                          <span className="block">
                            This will permanently delete your account, all contacts, conversations, campaigns, and data.
                            This action cannot be undone.
                          </span>
                          <span className="block">
                            Type <strong>DELETE</strong> to confirm:
                          </span>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <Input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="Type DELETE to confirm"
                        className="mt-2"
                      />
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive hover:bg-destructive/90"
                          disabled={deleteConfirmText !== "DELETE"}
                          onClick={() => {
                            toast.success("Account deletion request submitted. Check your email to confirm.");
                            setDeleteConfirmText("");
                          }}
                        >
                          Yes, delete my account
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════════ TEAM TAB ═══════════════════════ */}
          <TabsContent value="team" className="space-y-6">
            {/* Invite */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <UserPlus className="w-4 h-4 text-primary" /> Invite Employee
                </CardTitle>
                <CardDescription>Add employees to your account so they can customize automations for their own clients</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="invite-email">Email address</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="employee@business.com"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      disabled={!inviteEmail.trim() || inviteSending}
                      onClick={() => {
                        setInviteSending(true);
                        inviteMutation.mutate({ email: inviteEmail });
                      }}
                    >
                      {inviteSending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1.5" />}
                      Send invite
                    </Button>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
                  <p><strong>Owner</strong> - Full access including settings, billing, team management, and all automations</p>
                  <p className="mt-1"><strong>Employee</strong> - Can view leads, inbox, and customize automations for their own clients</p>
                </div>
              </CardContent>
            </Card>

            {/* Team Members List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Users className="w-4 h-4 text-primary" /> Team Members
                </CardTitle>
                <CardDescription>Manage your team and their roles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teamMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No team members yet. Invite employees above.</p>
                  )}
                  {teamMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                          {(member.name ?? member.email ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{member.name ?? member.email}</p>
                            <Badge
                              variant={member.tenantRole === "owner" ? "default" : "secondary"}
                              className="text-[10px] h-5"
                            >
                              {member.tenantRole === "owner" ? "Owner" : "Employee"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {member.email} &middot; Joined {new Date(member.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {member.tenantRole === "employee" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove {member.name ?? member.email} from your team. They will lose access to all workspace data immediately.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => removeMutation.mutate({ userId: member.id })}
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Pending Invitations */}
            {pendingInvitations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    <Mail className="w-4 h-4 text-primary" /> Pending Invitations
                  </CardTitle>
                  <CardDescription>Invitations that haven't been accepted yet</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingInvitations.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-600 font-semibold text-sm">
                            {inv.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{inv.email}</p>
                              <Badge variant="outline" className="text-[10px] h-5 text-yellow-500 border-yellow-500/20">
                                Pending
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Invited {new Date(inv.createdAt).toLocaleDateString()} &middot; Expires {new Date(inv.expiresAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => resendInviteMutation.mutate({ invitationId: inv.id })}
                            disabled={resendInviteMutation.isPending}
                          >
                            <Mail className="w-3.5 h-3.5 mr-1" /> Resend
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => cancelInviteMutation.mutate({ invitationId: inv.id })}
                            disabled={cancelInviteMutation.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
