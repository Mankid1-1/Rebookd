import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import {
  Zap,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Scissors,
  Stethoscope,
  Smile,
  Dumbbell,
  Heart,
  Sparkles,
  Palette,
  PawPrint,
  Activity,
  Building2,
  Globe,
  DollarSign,
  Rocket,
  Check,
  PartyPopper,
  Shield,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useLocale } from "@/contexts/LocaleContext";
import type { LucideIcon } from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────────

const STEP_LABELS = [
  "Business",
  "Experience",
  "Location",
  "Industry",
  "Details",
  "Launch",
] as const;

const TOTAL_STEPS = STEP_LABELS.length;

interface IndustryOption {
  label: string;
  value: string;
  icon: LucideIcon;
}

const INDUSTRIES: IndustryOption[] = [
  { label: "Hair Salon", value: "hair_salon", icon: Scissors },
  { label: "Barbershop", value: "barbershop", icon: Scissors },
  { label: "Dental", value: "dental", icon: Smile },
  { label: "Medical Clinic", value: "medical_clinic", icon: Stethoscope },
  { label: "Day Spa", value: "day_spa", icon: Sparkles },
  { label: "Fitness / Gym", value: "fitness_gym", icon: Dumbbell },
  { label: "Massage Therapy", value: "massage_therapy", icon: Heart },
  { label: "Physical Therapy", value: "physical_therapy", icon: Activity },
  { label: "Chiropractic", value: "chiropractic", icon: Activity },
  { label: "Aesthetics / Med Spa", value: "aesthetics_med_spa", icon: Sparkles },
  { label: "Tattoo Studio", value: "tattoo_studio", icon: Palette },
  { label: "Pet Grooming", value: "pet_grooming", icon: PawPrint },
  { label: "Yoga / Pilates", value: "yoga_pilates", icon: Heart },
  { label: "Other", value: "other", icon: Building2 },
];

const TIMEZONES = (() => {
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isUS =
    userTimezone.includes("America/") || userTimezone.includes("US/");

  const list = [
    {
      value: userTimezone,
      label: `${userTimezone.split("/").pop()?.replace(/_/g, " ")} (Detected)`,
    },
  ];

  if (isUS) {
    list.push(
      { value: "America/New_York", label: "Eastern (ET)" },
      { value: "America/Chicago", label: "Central (CT)" },
      { value: "America/Denver", label: "Mountain (MT)" },
      { value: "America/Los_Angeles", label: "Pacific (PT)" },
      { value: "America/Phoenix", label: "Arizona (no DST)" },
      { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
      { value: "America/Anchorage", label: "Alaska (AKT)" }
    );
  } else {
    list.push(
      { value: "Europe/London", label: "London (GMT/BST)" },
      { value: "Europe/Dublin", label: "Dublin (IST)" },
      { value: "Europe/Paris", label: "Paris (CET/CEST)" },
      { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
      { value: "Australia/Sydney", label: "Sydney (AEDT)" }
    );
  }

  // Deduplicate in case detected TZ matches a named one
  const seen = new Set<string>();
  return list.filter((tz) => {
    if (seen.has(tz.value)) return false;
    seen.add(tz.value);
    return true;
  });
})();

const COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Australia",
  "Germany",
  "France",
  "Ireland",
  "New Zealand",
  "Other",
];

const REFERRAL_SOURCES = [
  "Google Search",
  "Referral from a friend",
  "Social Media",
  "Blog / Article",
  "Other",
];

interface AutomationRec {
  title: string;
  description: string;
}

const AUTOMATION_RECOMMENDATIONS: Record<string, AutomationRec[]> = {
  hair_salon: [
    { title: "Appointment Reminders", description: "Reduce no-shows with SMS reminders 24h before" },
    { title: "Rebooking Nudges", description: "Remind clients to rebook 4-6 weeks after their last cut" },
    { title: "Birthday Offers", description: "Send a special discount on client birthdays" },
    { title: "Review Requests", description: "Ask happy clients for a Google review after their visit" },
  ],
  dental: [
    { title: "Appointment Reminders", description: "Reduce no-shows with SMS reminders 48h before" },
    { title: "6-Month Checkup Recalls", description: "Automated recall for bi-annual cleanings" },
    { title: "Treatment Follow-ups", description: "Check in after procedures to monitor recovery" },
    { title: "Review Requests", description: "Request reviews from satisfied patients" },
  ],
  default: [
    { title: "Appointment Reminders", description: "Reduce no-shows with timely SMS and email reminders" },
    { title: "Rebooking Campaigns", description: "Win back clients who haven't visited recently" },
    { title: "No-Show Follow-ups", description: "Automatically reach out after a missed appointment" },
    { title: "Review Requests", description: "Build your reputation with automated review requests" },
  ],
};

function getRecommendations(industry: string): AutomationRec[] {
  return AUTOMATION_RECOMMENDATIONS[industry] || AUTOMATION_RECOMMENDATIONS.default;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Onboarding() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();

  // Step state
  const [step, setStep] = useState(0);

  // Step 1 - Business
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [referralSource, setReferralSource] = useState("");

  // Step 2 - Experience Level
  const [skillLevel, setSkillLevel] = useState<"basic" | "intermediate" | "advanced">("basic");

  // Step 3 - Location
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  // Step 4 - Industry
  const [industry, setIndustry] = useState("");

  // Step 5 - Business Details
  const [avgAppointmentValue, setAvgAppointmentValue] = useState(75);
  const [monthlyNoShows, setMonthlyNoShows] = useState(8);
  const [monthlyCancellations, setMonthlyCancellations] = useState(12);
  const [monthlyAppointments, setMonthlyAppointments] = useState(150);

  // Step 6 - Launch
  const [showConfetti, setShowConfetti] = useState(false);

  // tRPC
  const utils = trpc.useUtils();
  const setSkillLevelMutation = trpc.auth.setSkillLevel.useMutation();
  const createTenant = trpc.onboarding.setup.useMutation({
    onSuccess: async () => {
      // Save the chosen skill level alongside tenant creation
      try {
        await setSkillLevelMutation.mutateAsync({ level: skillLevel });
      } catch {
        // Non-critical — proceed regardless
      }
      setShowConfetti(true);
      toast.success("Welcome to Rebooked! Your business is live.");
      await utils.tenant.get.invalidate();
      setTimeout(() => setLocation("/dashboard"), 2200);
    },
    onError: (err) => toast.error(err.message),
  });

  // Computed ROI
  const estimatedRecovery = useMemo(() => {
    const recoveredNoShows = Math.round(monthlyNoShows * 0.4);
    const recoveredCancellations = Math.round(monthlyCancellations * 0.3);
    return (recoveredNoShows + recoveredCancellations) * avgAppointmentValue;
  }, [monthlyNoShows, monthlyCancellations, avgAppointmentValue]);

  // Progress percentage
  const progressPercent = ((step + 1) / TOTAL_STEPS) * 100;

  // Industry label for display
  const selectedIndustry = INDUSTRIES.find((i) => i.value === industry);

  // Validation + navigation
  const validateStep = useCallback((): boolean => {
    switch (step) {
      case 0:
        if (!name.trim()) {
          toast.error("Please enter your business name.");
          return false;
        }
        return true;
      case 1:
        return true; // Skill level always has a default
      case 2:
        return true; // Location all optional
      case 3:
        if (!industry) {
          toast.error("Please select your industry.");
          return false;
        }
        return true;
      case 4:
        return true; // All have defaults
      case 5:
        return true;
      default:
        return true;
    }
  }, [step, name, industry]);

  const handleNext = useCallback(() => {
    if (!validateStep()) return;

    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    }
  }, [step, validateStep]);

  const handleBack = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  const handleLaunch = useCallback(() => {
    createTenant.mutate({
      businessName: name.trim(),
      website: website.trim() || undefined,
      referralSource: referralSource || undefined,
      city: city.trim() || undefined,
      country: country || undefined,
      timezone,
      industry,
      avgAppointmentValue,
      monthlyNoShows,
      monthlyCancellations,
      monthlyAppointments,
    });
  }, [
    createTenant,
    name,
    website,
    referralSource,
    city,
    country,
    timezone,
    industry,
    avgAppointmentValue,
    monthlyNoShows,
    monthlyCancellations,
    monthlyAppointments,
  ]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && step < TOTAL_STEPS - 1) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNext, step]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-2xl tracking-tight">Rebooked</span>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-between mb-8 px-1">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                  i < step
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : i === step
                    ? "bg-primary/15 text-primary ring-2 ring-primary/40"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  i <= step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Card */}
        <Card className="border-border bg-card shadow-lg">
          <CardContent className="p-7">
            {/* ── Step 1: Business Setup ── */}
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">
                    {t('onboarding.subtitle')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Tell us a little about your business to get started.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="biz-name">Business name *</Label>
                  <Input
                    id="biz-name"
                    placeholder="e.g. Bloom Beauty Studio"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="biz-website">
                    Website{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="biz-website"
                    placeholder="https://www.example.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>How did you hear about us?</Label>
                  <Select value={referralSource} onValueChange={setReferralSource}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select one..." />
                    </SelectTrigger>
                    <SelectContent>
                      {REFERRAL_SOURCES.map((src) => (
                        <SelectItem key={src} value={src}>
                          {src}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* ── Step 2: Experience Level ── */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">
                    What's your experience level?
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    We'll tailor the interface to match your comfort with business software.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {([
                    {
                      value: "basic" as const,
                      icon: Shield,
                      title: "Basic",
                      description: "I'm new to business software. Show me step-by-step guidance.",
                    },
                    {
                      value: "intermediate" as const,
                      icon: Zap,
                      title: "Intermediate",
                      description: "I've used similar tools before. Show me the essentials.",
                    },
                    {
                      value: "advanced" as const,
                      icon: Rocket,
                      title: "Advanced",
                      description: "I'm tech-savvy. Give me full access to everything.",
                    },
                  ] as const).map((option) => {
                    const Icon = option.icon;
                    const isSelected = skillLevel === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSkillLevel(option.value)}
                        aria-pressed={isSelected}
                        aria-label={`Select ${option.title} experience level`}
                        className={`group relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border bg-card"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <Check className="w-3.5 h-3.5 text-primary" />
                          </div>
                        )}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                          isSelected ? "bg-primary/20" : "bg-muted group-hover:bg-primary/10"
                        }`}>
                          <Icon className={`w-5 h-5 transition-colors ${
                            isSelected ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                          }`} />
                        </div>
                        <span className={`text-sm font-semibold ${
                          isSelected ? "text-primary" : "text-foreground"
                        }`}>
                          {option.title}
                        </span>
                        <span className="text-xs text-muted-foreground leading-snug">
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  You can change this anytime in Settings.
                </p>
              </div>
            )}

            {/* ── Step 3: Location ── */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">
                    Where are you located?
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    We use this to schedule automations in your local time.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="city-input">
                    City{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="city-input"
                    placeholder="e.g. Minneapolis, MN"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select country..." />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    Timezone
                  </Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Auto-detected from your browser. Change if needed.
                  </p>
                </div>
              </div>
            )}

            {/* ── Step 4: Industry ── */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">
                    What type of business do you run?
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    We'll tailor automations and templates to your industry.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {INDUSTRIES.map((ind) => {
                    const Icon = ind.icon;
                    const isSelected = industry === ind.value;
                    return (
                      <button
                        key={ind.value}
                        type="button"
                        onClick={() => setIndustry(ind.value)}
                        className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border bg-card"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-1 right-1">
                            <Check className="w-3.5 h-3.5 text-primary" />
                          </div>
                        )}
                        <Icon
                          className={`w-5 h-5 transition-colors ${
                            isSelected
                              ? "text-primary"
                              : "text-muted-foreground group-hover:text-foreground"
                          }`}
                        />
                        <span
                          className={`text-[11px] font-medium leading-tight ${
                            isSelected
                              ? "text-primary"
                              : "text-muted-foreground group-hover:text-foreground"
                          }`}
                        >
                          {ind.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Step 5: Business Details ── */}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">
                    Your numbers
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Help us estimate the revenue Rebooked can recover for you.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Avg appointment value */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Average appointment value</Label>
                      <span className="text-sm font-semibold text-foreground">
                        ${avgAppointmentValue}
                      </span>
                    </div>
                    <Slider
                      value={[avgAppointmentValue]}
                      onValueChange={([v]) => setAvgAppointmentValue(v)}
                      min={10}
                      max={500}
                      step={5}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>$10</span>
                      <span>$500</span>
                    </div>
                  </div>

                  {/* Monthly appointments */}
                  <div className="space-y-1.5">
                    <Label htmlFor="monthly-appts">
                      Current monthly appointments
                    </Label>
                    <Input
                      id="monthly-appts"
                      type="number"
                      min={0}
                      value={monthlyAppointments}
                      onChange={(e) =>
                        setMonthlyAppointments(
                          Math.max(0, parseInt(e.target.value) || 0)
                        )
                      }
                    />
                  </div>

                  {/* Monthly no-shows */}
                  <div className="space-y-1.5">
                    <Label htmlFor="monthly-noshows">
                      Estimated monthly no-shows
                    </Label>
                    <Input
                      id="monthly-noshows"
                      type="number"
                      min={0}
                      value={monthlyNoShows}
                      onChange={(e) =>
                        setMonthlyNoShows(
                          Math.max(0, parseInt(e.target.value) || 0)
                        )
                      }
                    />
                  </div>

                  {/* Monthly cancellations */}
                  <div className="space-y-1.5">
                    <Label htmlFor="monthly-cancellations">
                      Estimated monthly cancellations
                    </Label>
                    <Input
                      id="monthly-cancellations"
                      type="number"
                      min={0}
                      value={monthlyCancellations}
                      onChange={(e) =>
                        setMonthlyCancellations(
                          Math.max(0, parseInt(e.target.value) || 0)
                        )
                      }
                    />
                  </div>
                </div>

                {/* ROI preview */}
                {estimatedRecovery > 0 && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <DollarSign className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Estimated monthly recovery
                        </p>
                        <p className="text-2xl font-bold text-primary mt-0.5">
                          ${estimatedRecovery.toLocaleString()}
                          <span className="text-sm font-normal text-muted-foreground">
                            /month
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Based on recovering ~40% of no-shows and ~30% of
                          cancellations through automated outreach.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 6: Launch ── */}
            {step === 5 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">
                    Ready to launch
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Review your setup and start your 14-day free trial.
                  </p>
                </div>

                {/* Summary */}
                <div className="rounded-xl border bg-muted/30 p-4 space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Business</span>
                    <span className="font-medium text-foreground">
                      {name}
                    </span>
                  </div>
                  {city && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location</span>
                      <span className="font-medium text-foreground">
                        {city}
                        {country ? `, ${country}` : ""}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Timezone</span>
                    <span className="font-medium text-foreground">
                      {timezone.split("/").pop()?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Industry</span>
                    <span className="font-medium text-foreground">
                      {selectedIndustry?.label || industry}
                    </span>
                  </div>
                  {estimatedRecovery > 0 && (
                    <div className="flex justify-between pt-1 border-t">
                      <span className="text-muted-foreground">
                        Est. recovery
                      </span>
                      <span className="font-bold text-primary">
                        ${estimatedRecovery.toLocaleString()}/mo
                      </span>
                    </div>
                  )}
                </div>

                {/* Recommended automations */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Recommended automations for you
                  </h3>
                  <div className="space-y-2">
                    {getRecommendations(industry).map((rec) => (
                      <div
                        key={rec.title}
                        className="flex items-start gap-3 rounded-lg border p-3"
                      >
                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{rec.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {rec.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* TCPA compliance acknowledgement */}
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-teal-500/10 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-teal-500" />
                    </div>
                    <p className="text-sm font-medium">TCPA Compliance Built-In</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-8">
                    Rebooked automatically enforces quiet hours (8am-9pm recipient timezone),
                    handles STOP/HELP keywords, tracks opt-in consent, and includes required
                    opt-out language in every message. Your account starts fully compliant.
                  </p>
                </div>

                {/* Trial note */}
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                  <Badge variant="secondary" className="text-[10px]">
                    14-DAY TRIAL
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Full access to all features. No credit card required.
                  </span>
                </div>

                {/* Confetti overlay */}
                {showConfetti && (
                  <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
                    <div className="animate-bounce">
                      <PartyPopper className="w-16 h-16 text-primary opacity-80" />
                    </div>
                    {/* Simple confetti dots */}
                    {Array.from({ length: 30 }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute rounded-full animate-ping"
                        style={{
                          width: `${6 + Math.random() * 8}px`,
                          height: `${6 + Math.random() * 8}px`,
                          backgroundColor: [
                            "hsl(var(--primary))",
                            "#f59e0b",
                            "#10b981",
                            "#8b5cf6",
                            "#ec4899",
                            "#06b6d4",
                          ][i % 6],
                          top: `${10 + Math.random() * 80}%`,
                          left: `${5 + Math.random() * 90}%`,
                          animationDuration: `${0.8 + Math.random() * 1.2}s`,
                          animationDelay: `${Math.random() * 0.5}s`,
                          opacity: 0.7,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Navigation ── */}
            <div className="flex gap-3 mt-7">
              {step > 0 && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={createTenant.isPending}
                  className="gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
              <Button
                className="flex-1 gap-1.5"
                onClick={step === TOTAL_STEPS - 1 ? handleLaunch : handleNext}
                disabled={createTenant.isPending}
              >
                {createTenant.isPending ? (
                  "Setting up..."
                ) : step === TOTAL_STEPS - 1 ? (
                  <>
                    <Rocket className="w-4 h-4" />
                    Launch Rebooked
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Step {step + 1} of {TOTAL_STEPS}
        </p>
      </div>
    </div>
  );
}
