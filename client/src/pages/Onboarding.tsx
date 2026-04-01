import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EncryptionBadge } from "@/components/ui/EncryptionBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/SmartInput";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { safeLocalRedirect } from "@/utils/safeRedirect";
import {
  ArrowRight,
  CheckCircle,
  Phone,
  Calendar,
  Zap,
  Link2,
  SkipForward,
  Loader2,
  PhoneCall,
  Bell,
  UserPlus,
  AlertTriangle,
  Star,
  RotateCcw,
  CalendarCheck,
} from "lucide-react";
import { RebookedLogo } from "@/components/RebookedLogo";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useLocale } from "@/contexts/LocaleContext";
import { Palette } from "lucide-react";
import { useTheme, THEME_META, type ThemeName } from "@/contexts/ThemeContext";
import { useSkillLevel } from "@/contexts/SkillLevelContext";

// Calendar providers for step 2
type Provider = "google" | "outlook" | "caldav" | "calendly" | "acuity";

const CALENDAR_PROVIDERS: Array<{
  id: Provider;
  name: string;
  icon: string;
  color: string;
  authType: "oauth" | "credentials";
}> = [
  { id: "google", name: "Google Calendar", icon: "📅", color: "border-destructive/20 bg-destructive/10", authType: "oauth" },
  { id: "outlook", name: "Outlook / 365", icon: "📧", color: "border-info/20 bg-info/10", authType: "oauth" },
  { id: "calendly", name: "Calendly", icon: "🗓️", color: "border-info/20 bg-info/10", authType: "oauth" },
  { id: "acuity", name: "Acuity", icon: "📋", color: "border-success/20 bg-success/10", authType: "credentials" },
  { id: "caldav", name: "Apple iCloud", icon: "🍎", color: "border-border bg-muted", authType: "credentials" },
];

// Default automations — the 7 highest-impact, pre-toggled ON
const DEFAULT_AUTOMATIONS = [
  {
    key: "missed_call_textback",
    name: "Missed Call Text-Back",
    description: "Instantly text anyone whose call you miss",
    icon: <PhoneCall className="h-4 w-4 text-destructive" />,
    impact: "highest",
  },
  {
    key: "appointment_confirmation",
    name: "Booking Confirmation",
    description: "Confirm appointments the moment they book",
    icon: <CalendarCheck className="h-4 w-4 text-info" />,
    impact: "high",
  },
  {
    key: "appointment_reminder_24h",
    name: "24-Hour Reminder",
    description: "Reminder the day before their appointment",
    icon: <Bell className="h-4 w-4 text-warning" />,
    impact: "high",
  },
  {
    key: "welcome_new_lead",
    name: "Welcome New Leads",
    description: "Instant welcome message with your booking link",
    icon: <UserPlus className="h-4 w-4 text-success" />,
    impact: "high",
  },
  {
    key: "noshow_recovery",
    name: "No-Show Recovery",
    description: "Follow up 15 min after a missed appointment",
    icon: <AlertTriangle className="h-4 w-4 text-warning" />,
    impact: "high",
  },
  {
    key: "cancellation_same_day",
    name: "Cancellation Rescue",
    description: "Instant reschedule offer when someone cancels",
    icon: <RotateCcw className="h-4 w-4 text-destructive" />,
    impact: "high",
  },
  {
    key: "review_request",
    name: "Review Request",
    description: "Ask for a review after a great appointment",
    icon: <Star className="h-4 w-4 text-warning" />,
    impact: "medium",
  },
];

const STEP_LABELS = ["Business", "Calendar", "Automations"];

const EXPERIENCE_LEVELS = [
  { value: "basic" as const, label: "Beginner", description: "New to business software — keep it simple" },
  { value: "intermediate" as const, label: "Comfortable", description: "I've used CRMs or marketing tools before" },
  { value: "advanced" as const, label: "Power User", description: "Show me everything — I want full control" },
];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { t } = useLocale();
  const { setSkillLevel } = useSkillLevel();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<"basic" | "intermediate" | "advanced">("basic");
  const [automationToggles, setAutomationToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(DEFAULT_AUTOMATIONS.map((a) => [a.key, true]))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenantCreated, setTenantCreated] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);

  const utils = trpc.useUtils();

  // Handle return from OAuth callback — resume at calendar step
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      setTenantCreated(true); // tenant must exist if OAuth succeeded
      setCalendarConnected(true);
      setStep(1); // stay on calendar step to show success
      toast.success("Calendar connected successfully!");
      window.history.replaceState({}, "", "/onboarding");
    } else if (params.get("error")) {
      setTenantCreated(true);
      setStep(1);
      const errorCode = params.get("error");
      const messages: Record<string, string> = {
        denied: "Calendar connection was cancelled. You can try again or skip for now.",
        expired: "The connection timed out. Please try again.",
        token_exchange_failed: "Could not connect to your calendar. Please try again.",
      };
      toast.error(messages[errorCode!] || "Calendar connection failed. Please try again.");
      window.history.replaceState({}, "", "/onboarding");
    }
  }, []);

  // Calendar connect
  const connectCalendar = trpc.calendar.initiateConnect.useMutation({
    onSuccess: (data) => {
      if (data.authUrl) {
        safeLocalRedirect(data.authUrl);
      } else {
        toast.success("Calendar connected!");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // Tenant creation
  const createTenant = trpc.onboarding.setup.useMutation();

  // Quick-enable automations
  const quickEnable = trpc.automations.quickEnable.useMutation();

  const handleNext = async () => {
    if (step === 0) {
      if (!name.trim()) return toast.error("Please enter your business name");

      // Create tenant NOW so calendar connect has a tenantId in step 1
      if (!tenantCreated) {
        setIsSubmitting(true);
        try {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          await createTenant.mutateAsync({
            businessName: name.trim(),
            phone: phone.trim() || undefined,
            timezone,
          });
          setTenantCreated(true);
          // Invalidate auth cache so subsequent tRPC calls pick up the new tenantId
          await utils.auth.me.invalidate();
        } catch (err: any) {
          toast.error(err?.message || "Failed to create your account. Please try again.");
          setIsSubmitting(false);
          return;
        }
        setIsSubmitting(false);
      }

      setStep(1);
    } else if (step === 1) {
      // Calendar step — proceed regardless (skip or already connected)
      setStep(2);
    }
  };

  const handleCalendarConnect = (provider: Provider) => {
    if (provider === "caldav" || provider === "acuity") {
      // Credentials-based providers — skip for onboarding, they can set up in Settings
      toast.info(`You can connect ${CALENDAR_PROVIDERS.find((p) => p.id === provider)?.name} from Settings after setup.`);
      return;
    }
    connectCalendar.mutate({ provider, returnTo: "/onboarding" });
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      // Tenant was already created in step 0 → step 1 transition.
      // If somehow it wasn't (e.g. user refreshed), create it now as fallback.
      if (!tenantCreated) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        await createTenant.mutateAsync({
          businessName: name.trim(),
          phone: phone.trim() || undefined,
          timezone,
        });
        setTenantCreated(true);
        await utils.auth.me.invalidate();
      }

      // Save the selected experience level
      await setSkillLevel(experienceLevel);

      // Enable selected automations
      const enabledKeys = Object.entries(automationToggles)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);

      // Fire all quickEnable calls in parallel
      await Promise.allSettled(
        enabledKeys.map((key) => quickEnable.mutateAsync({ key }))
      );

      // Invalidate caches and redirect
      await utils.tenant.get.invalidate();
      await utils.auth.me.invalidate();
      toast.success("You're all set! Welcome to Rebooked.");
      setLocation("/dashboard?welcome=true");
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAutomation = (key: string) => {
    setAutomationToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const enabledCount = Object.values(automationToggles).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center mb-10">
          <RebookedLogo size={36} />
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={`flex items-center gap-1.5 transition-all ${
                  i <= step ? "cursor-pointer hover:opacity-80" : "cursor-default"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span
                  className={`text-xs hidden sm:block ${
                    i === step ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </button>
              {i < STEP_LABELS.length - 1 && (
                <div className={`w-8 h-px ${i < step ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        <Card className="border-border bg-card">
          <CardContent className="p-7">
            {/* ─── Step 1: Business Name + Phone ─── */}
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">Let's get you set up</h2>
                  <p className="text-sm text-muted-foreground">
                    Two fields. Under 60 seconds. That's it.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Business name *</Label>
                  <Input
                    placeholder="e.g. Bloom Beauty Studio"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNext()}
                    autoFocus
                  />
                </div>
                <PhoneInput
                  label="Business phone number"
                  placeholder="Phone number"
                  helpText="This is where missed calls get detected and texts get sent from."
                  name="phone"
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleNext()}
                />

                <div className="space-y-1.5">
                  <Label>Tech experience level</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    This controls how much detail you see in the dashboard. You can change it later in Settings.
                  </p>
                  <div className="space-y-2">
                    {EXPERIENCE_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setExperienceLevel(level.value)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                          experienceLevel === level.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          experienceLevel === level.value ? "border-primary" : "border-muted-foreground"
                        }`}>
                          {experienceLevel === level.value && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-medium">{level.label}</span>
                          <p className="text-xs text-muted-foreground">{level.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Step 2: Connect Calendar ─── */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">Connect your calendar</h2>
                  <p className="text-sm text-muted-foreground">
                    So we can detect no-shows and send reminders. One click.
                  </p>
                </div>

                <EncryptionBadge variant="badge" />

                {calendarConnected && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <div>
                      <p className="text-sm font-medium text-success">Calendar connected!</p>
                      <p className="text-xs text-muted-foreground">Your appointments will sync automatically.</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {CALENDAR_PROVIDERS.map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => handleCalendarConnect(provider.id)}
                      disabled={connectCalendar.isPending}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-sm ${provider.color}`}
                    >
                      <span className="text-xl">{provider.icon}</span>
                      <span className="text-sm font-medium flex-1 text-left">
                        {provider.name}
                      </span>
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>

                {connectCalendar.isPending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </div>
                )}
              </div>
            )}

            {/* ─── Step 3: Pick Automations ─── */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">Your automations</h2>
                  <p className="text-sm text-muted-foreground">
                    These are pre-selected for maximum impact. Just hit confirm.
                  </p>
                </div>

                <div className="space-y-2">
                  {DEFAULT_AUTOMATIONS.map((automation) => (
                    <div
                      key={automation.key}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-shrink-0">{automation.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{automation.name}</span>
                          {automation.impact === "highest" && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0">
                              #1 ROI
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{automation.description}</p>
                      </div>
                      <Switch
                        checked={automationToggles[automation.key] ?? true}
                        onCheckedChange={() => toggleAutomation(automation.key)}
                      />
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  {enabledCount} of {DEFAULT_AUTOMATIONS.length} enabled — you can always change these later
                </p>
              </div>
            )}

            {/* ─── Navigation ─── */}
            <div className="flex gap-3 mt-6">
              {step > 0 && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </Button>
              )}

              {step === 0 && (
                <Button className="flex-1" onClick={handleNext} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : null}
                  <span>{isSubmitting ? "Setting up..." : "Next"}</span>
                  {!isSubmitting && <ArrowRight className="w-4 h-4 ml-1.5" />}
                </Button>
              )}

              {step === 1 && (
                <Button className="flex-1" onClick={handleNext}>
                  {calendarConnected ? (
                    <>
                      <ArrowRight className="w-4 h-4 mr-1.5" />
                      <span>Next</span>
                    </>
                  ) : (
                    <>
                      <SkipForward className="w-4 h-4 mr-1.5" />
                      <span>Skip for now</span>
                    </>
                  )}
                </Button>
              )}

              {step === 2 && (
                <Button
                  className="flex-1"
                  onClick={handleFinish}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      <span>Setting up...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-1.5" />
                      <span>Confirm & Go</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Floating theme picker */}
      <OnboardingThemePicker />
    </div>
  );
}

const THEME_DOTS: Record<ThemeName, string> = {
  abyss: "#d4a843", light: "#3b7cf5", corporate: "#d44030", pink: "#d44090", emerald: "#2a9060",
};

function OnboardingThemePicker() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="absolute bottom-10 right-0 bg-card border border-border rounded-lg shadow-lg p-2 flex gap-1.5">
          {(Object.keys(THEME_META) as ThemeName[]).map((key) => (
            <button
              key={key}
              onClick={() => { setTheme(key); setOpen(false); }}
              className={`h-7 w-7 rounded-full border-2 transition-all ${
                theme === key ? "border-primary scale-110" : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: THEME_DOTS[key] }}
              title={THEME_META[key].label}
            />
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="h-9 w-9 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-muted transition-colors"
        title="Change theme"
      >
        <Palette className="h-4 w-4 text-foreground" />
      </button>
    </div>
  );
}
