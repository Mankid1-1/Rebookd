import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Zap, ArrowRight, CheckCircle, Info, Bell, MessageSquare, UserPlus, Calendar, RotateCcw, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useProgressiveDisclosureContext } from "@/components/ui/ProgressiveDisclosure";

// Dynamic industries based on user location and preferences
const getDynamicIndustries = () => {
  const userLocation = navigator.language || 'en-US';
  const isUS = userLocation.includes('en-US');
  
  if (isUS) {
    return [
      "Hair Salon", "Barbershop", "Nail Salon", "Day Spa", "Medical / Clinic",
      "Dental", "Chiropractic", "Physical Therapy", "Personal Training / Gym",
      "Massage Therapy", "Tattoo Studio", "Aesthetics / Med Spa", "Yoga / Pilates",
      "Pet Grooming", "Other",
    ];
  } else {
    return [
      "Hair Salon", "Barbershop", "Beauty Salon", "Day Spa", "Medical / Clinic",
      "Dental", "Chiropractic", "Physical Therapy", "Fitness Centre", "Massage Therapy",
      "Tattoo Studio", "Aesthetics", "Yoga Studio", "Pet Grooming", "Other",
    ];
  }
};

// Dynamic timezones based on user's detected timezone
const getDynamicTimezones = () => {
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isUS = userTimezone.includes('America/') || userTimezone.includes('US/');
  
  const baseTimezones = [
    { value: userTimezone, label: `${userTimezone.split('/').pop()?.replace('_', ' ')} (Local)` },
  ];
  
  if (isUS) {
    baseTimezones.push(
      { value: "America/New_York", label: "Eastern (ET)" },
      { value: "America/Chicago", label: "Central (CT)" },
      { value: "America/Denver", label: "Mountain (MT)" },
      { value: "America/Los_Angeles", label: "Pacific (PT)" },
      { value: "America/Phoenix", label: "Arizona (no DST)" },
      { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
      { value: "America/Anchorage", label: "Alaska (AKT)" }
    );
  } else {
    baseTimezones.push(
      { value: "Europe/London", label: "London (GMT/BST)" },
      { value: "Europe/Dublin", label: "Dublin (IST)" },
      { value: "Europe/Paris", label: "Paris (CET/CEST)" },
      { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
      { value: "Australia/Sydney", label: "Sydney (AEDT)" }
    );
  }
  
  return baseTimezones;
};

// Dynamic steps based on user skill level
const getDynamicSteps = (userSkill?: any) => {
  // All steps available at every skill level
  return ["Business", "Location", "Industry", "Automations"];
};

// Icons for essential automation categories
const AUTOMATION_ICONS: Record<string, React.ReactNode> = {
  appointment_confirmation_chase: <Calendar className="h-4 w-4 text-blue-500" />,
  inbound_response_sla: <MessageSquare className="h-4 w-4 text-green-500" />,
  welcome_new_lead: <UserPlus className="h-4 w-4 text-purple-500" />,
  reduce_no_shows: <Bell className="h-4 w-4 text-orange-500" />,
  qualified_followup_1d: <Clock className="h-4 w-4 text-cyan-500" />,
  cancellation_same_day: <RotateCcw className="h-4 w-4 text-rose-500" />,
};

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { context } = useProgressiveDisclosureContext();
  
  // Get dynamic data
  const industries = getDynamicIndustries();
  const timezones = getDynamicTimezones();
  const steps = getDynamicSteps(context.userSkill);
  
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [industry, setIndustry] = useState("");
  const [essentialAutomations, setEssentialAutomations] = useState<Array<{
    key: string; name: string; description: string; category: string;
    enabled: boolean; autoEnabled: boolean; tier: string;
  }>>([]);

  const skillLevel = context.userSkill?.level || "beginner";
  const hasAutoEnables = skillLevel === "beginner" || skillLevel === "intermediate";

  const utils = trpc.useUtils();
  const createTenant = trpc.onboarding.setup.useMutation({
    onSuccess: async (data) => {
      await utils.tenant.get.invalidate();
      if (hasAutoEnables && data.essentialAutomations?.length > 0) {
        // Show the automations step with disclaimer
        setEssentialAutomations(data.essentialAutomations);
        setStep(3);
      } else {
        toast.success("Business set up! Welcome to Rebooked.");
        setLocation("/dashboard");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleAutomation = trpc.onboarding.toggleEssentialAutomation.useMutation({
    onSuccess: (data) => {
      setEssentialAutomations(prev =>
        prev.map(a => a.key === data.key ? { ...a, enabled: data.enabled } : a)
      );
    },
    onError: (err) => toast.error(err.message),
  });

  const handleNext = () => {
    if (step === 0 && !name.trim()) return toast.error("Please enter your business name");
    if (step === 2 && !industry) return toast.error("Please select your industry");
    if (step < 2) {
      setStep(step + 1);
    } else if (step === 2) {
      createTenant.mutate({
        businessName: name.trim(), industry, timezone,
        city: city.trim() || undefined, skillLevel,
      });
    } else if (step === 3) {
      // Done — go to dashboard
      toast.success("You're all set! Welcome to Rebooked.");
      setLocation("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl">Rebooked</span>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {steps.filter(s => s !== "Automations" || hasAutoEnables).map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                  i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary/10 text-primary border border-primary/30" : "bg-muted text-muted-foreground"
                }`}>
                  {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
              </div>
              {i < steps.filter(s2 => s2 !== "Automations" || hasAutoEnables).length - 1 && <div className={`w-8 h-px ${i < step ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <Card className="border-border bg-card">
          <CardContent className="p-7">
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">Welcome! Let's set up your business</h2>
                  <p className="text-sm text-muted-foreground">This takes about 2 minutes.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Business name *</Label>
                  <Input placeholder="e.g. Bloom Beauty Studio" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleNext()} autoFocus />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">Where are you based?</h2>
                  <p className="text-sm text-muted-foreground">Used for scheduling automations in your local time.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>City <span className="text-muted-foreground">(optional)</span></Label>
                  <Input placeholder="e.g. Minneapolis, MN" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Timezone *</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">What type of business?</h2>
                  <p className="text-sm text-muted-foreground">We'll tailor your automations and message templates.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Industry *</Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger><SelectValue placeholder="Select your industry..." /></SelectTrigger>
                    <SelectContent>
                      {industries.map((ind) => <SelectItem key={ind} value={ind.toLowerCase().replace(/[\s/]+/g, "_")}>{ind}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="bg-muted/30 rounded-xl p-4 text-xs text-muted-foreground leading-relaxed">
                  <p className="font-medium text-foreground mb-1">You're almost in!</p>
                  <p>After setup, we'll show you which automations to enable first based on your industry.</p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">Automations Enabled For You</h2>
                  <p className="text-sm text-muted-foreground">
                    Based on your experience level, we've turned on these automations so they
                    run in the background automatically. You can disable any of them now or
                    change them later in Settings.
                  </p>
                </div>

                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex gap-2">
                  <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {skillLevel === "beginner"
                      ? "As a new user, all essential automations are enabled so Rebooked works for you right away. Toggle off anything you'd rather handle manually."
                      : "Core automations are enabled to keep things running smoothly. Advanced automations are available but not auto-enabled — turn them on if you'd like."}
                  </p>
                </div>

                <div className="space-y-2">
                  {essentialAutomations.map((automation) => (
                    <div
                      key={automation.key}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="mt-0.5">
                        {AUTOMATION_ICONS[automation.key] || <Zap className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{automation.name}</span>
                          {automation.autoEnabled && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Auto</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{automation.description}</p>
                      </div>
                      <Switch
                        checked={automation.enabled}
                        onCheckedChange={(checked) =>
                          toggleAutomation.mutate({ key: automation.key, enabled: checked })
                        }
                        disabled={toggleAutomation.isPending}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              {step > 0 && step < 3 && <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>Back</Button>}
              <Button className="flex-1" onClick={handleNext} disabled={createTenant.isPending}>
                {createTenant.isPending
                  ? "Setting up..."
                  : step < 2
                    ? <><span>Next</span><ArrowRight className="w-4 h-4 ml-1.5" /></>
                    : step === 2
                      ? <><span>Set Up Rebooked</span><Zap className="w-4 h-4 ml-1.5" /></>
                      : <><span>Go to Dashboard</span><ArrowRight className="w-4 h-4 ml-1.5" /></>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
