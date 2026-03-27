import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Zap, ArrowRight, ArrowLeft, CheckCircle, Phone, Building2, MapPin, Bot, SkipForward } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const INDUSTRIES = [
  "Hair Salon", "Barbershop", "Nail Salon", "Day Spa", "Medical / Clinic",
  "Dental", "Chiropractic", "Physical Therapy", "Personal Training / Gym",
  "Massage Therapy", "Tattoo Studio", "Aesthetics / Med Spa", "Yoga / Pilates",
  "Pet Grooming", "Other",
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)" },
];

const RECOMMENDED_AUTOMATIONS = [
  {
    key: "appointment_confirmation_chase",
    name: "Confirmation Chase",
    description: "Send a confirmation request after a booking is made",
    category: "appointment",
  },
  {
    key: "inbound_response_sla",
    name: "Inbound Auto-Reply",
    description: "Instantly reply when a customer texts you",
    category: "follow_up",
  },
  {
    key: "qualified_followup_1d",
    name: "Qualified Lead Follow-Up (1 Day)",
    description: "Follow up with new leads after 24 hours",
    category: "follow_up",
  },
  {
    key: "cancellation_same_day",
    name: "Same-Day Cancellation Rescue",
    description: "Recover same-day cancellations with a rebook offer",
    category: "cancellation",
  },
  {
    key: "waitlist_fill",
    name: "Waitlist Fill",
    description: "Notify waitlisted customers when a spot opens up",
    category: "cancellation",
  },
];

const STEPS = [
  { label: "Business Info", icon: Building2 },
  { label: "Phone Setup", icon: Phone },
  { label: "Automations", icon: Bot },
];

export default function Onboarding() {
  const [, setLocation] = useLocation();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [businessPhone, setBusinessPhone] = useState("");
  const [enabledAutomations, setEnabledAutomations] = useState<Record<string, boolean>>({
    appointment_confirmation_chase: true,
    inbound_response_sla: true,
  });

  const utils = trpc.useUtils();
  const createTenant = trpc.onboarding.setup.useMutation({
    onSuccess: async () => {
      // Enable selected automations
      const keysToEnable = Object.entries(enabledAutomations)
        .filter(([, v]) => v)
        .map(([k]) => k);
      for (const key of keysToEnable) {
        try {
          await toggleAutomation.mutateAsync({ key, enabled: true });
        } catch {
          // Silently skip if automation toggle fails during onboarding
        }
      }
      toast.success("Business set up! Welcome to Rebooked.");
      await utils.tenant.get.invalidate();
      setLocation("/dashboard?welcome=true");
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const toggleAutomation = trpc.automations.toggleByKey.useMutation();

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!name.trim()) {
        toast.error("Please enter your business name");
        return false;
      }
      if (!industry) {
        toast.error("Please select your industry");
        return false;
      }
      return true;
    }
    // Steps 1 and 2 have no required fields
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSkip = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    if (!name.trim()) {
      toast.error("Please go back and enter your business name");
      return;
    }
    createTenant.mutate({
      businessName: name.trim(),
      industry,
      timezone,
      businessPhone: businessPhone.trim() || undefined,
    });
  };

  const toggleAutomationSelection = (key: string) => {
    setEnabledAutomations((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Check if the detected timezone is already in the list
  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzInList = TIMEZONES.some((tz) => tz.value === detectedTz);
  const allTimezones = tzInList
    ? TIMEZONES
    : [{ value: detectedTz, label: `${detectedTz.split("/").pop()?.replace("_", " ")} (Detected)` }, ...TIMEZONES];

  const progressPercent = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl">Rebooked</span>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-3 flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                        i < step
                          ? "bg-primary text-primary-foreground"
                          : i === step
                            ? "bg-primary/10 text-primary border border-primary/30"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i < step ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className={`text-xs hidden sm:block font-medium ${i === step ? "text-foreground" : "text-muted-foreground"}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-2 ${i < step ? "bg-primary" : "bg-border"}`} />}
                </div>
              );
            })}
          </div>
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Step {step + 1} of {STEPS.length}
          </p>
        </div>

        {/* Step Content */}
        <Card className="border-border bg-card">
          <CardContent className="p-7">
            {/* Step 1: Business Info */}
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">Tell us about your business</h2>
                  <p className="text-sm text-muted-foreground">
                    We will tailor your automations and message templates based on your industry.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Business name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. Bloom Beauty Studio"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNext()}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Industry <span className="text-destructive">*</span></Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your industry..." />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((ind) => (
                        <SelectItem key={ind} value={ind.toLowerCase().replace(/[\s/]+/g, "_")}>
                          {ind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Timezone <span className="text-destructive">*</span></Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allTimezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 2: Phone Setup */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">Set up your phone number</h2>
                  <p className="text-sm text-muted-foreground">
                    This is the number your customers know. We handle all SMS sending for you.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    Business Phone Number <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Input
                    placeholder="+1 (555) 000-0000"
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNext()}
                    autoFocus
                  />
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                  <p className="text-sm font-medium">How SMS works with Rebooked</p>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>No Twilio or other provider accounts needed</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>We handle sending, receiving, and delivery tracking</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>TCPA compliant with automatic opt-out handling</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>You can change this later in Settings</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 3: Automations */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">Enable your first automations</h2>
                  <p className="text-sm text-muted-foreground">
                    These are our most popular automations. Toggle on the ones you want active right away.
                  </p>
                </div>
                <div className="space-y-3">
                  {RECOMMENDED_AUTOMATIONS.map((auto) => (
                    <div
                      key={auto.key}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                        enabledAutomations[auto.key]
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-muted/20 hover:bg-muted/30"
                      }`}
                      onClick={() => toggleAutomationSelection(auto.key)}
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium">{auto.name}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                            {auto.category.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{auto.description}</p>
                      </div>
                      <Switch
                        checked={!!enabledAutomations[auto.key]}
                        onCheckedChange={() => toggleAutomationSelection(auto.key)}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  You can manage all 16+ automations from the Automations page after setup.
                </p>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center gap-3 mt-6">
              {step > 0 && (
                <Button variant="outline" onClick={handleBack} className="gap-1.5">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
              {step > 0 && step < STEPS.length - 1 && (
                <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground gap-1.5">
                  <SkipForward className="w-3.5 h-3.5" />
                  Skip
                </Button>
              )}
              <div className="flex-1" />
              <Button onClick={handleNext} disabled={createTenant.isPending} className="gap-1.5">
                {createTenant.isPending ? (
                  "Setting up..."
                ) : step < STEPS.length - 1 ? (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Launch Rebooked
                    <Zap className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
