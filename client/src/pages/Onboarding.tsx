import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Zap, ArrowRight, CheckCircle } from "lucide-react";
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
  { value: "Europe/Dublin", label: "Dublin (IST)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)" },
];

const STEPS = ["Business", "Location", "Industry"];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [industry, setIndustry] = useState("");

  const utils = trpc.useUtils();
  const createTenant = trpc.onboarding.setup.useMutation({
    onSuccess: async () => {
      toast.success("Business set up! Welcome to Rebooked.");
      await utils.tenant.get.invalidate();
      setLocation("/dashboard");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleNext = () => {
    if (step === 0 && !name.trim()) return toast.error("Please enter your business name");
    if (step === 2 && !industry) return toast.error("Please select your industry");
    if (step < 2) {
      setStep(step + 1);
    } else {
      createTenant.mutate({ businessName: name.trim(), industry, timezone, city: city.trim() || undefined });
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
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                  i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary/10 text-primary border border-primary/30" : "bg-muted text-muted-foreground"
                }`}>
                  {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`w-8 h-px ${i < step ? "bg-primary" : "bg-border"}`} />}
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
                      {TIMEZONES.map((tz) => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
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
                      {INDUSTRIES.map((ind) => <SelectItem key={ind} value={ind.toLowerCase().replace(/[\s/]+/g, "_")}>{ind}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="bg-muted/30 rounded-xl p-4 text-xs text-muted-foreground leading-relaxed">
                  <p className="font-medium text-foreground mb-1">You're almost in!</p>
                  <p>After setup, we'll show you which automations to enable first based on your industry.</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              {step > 0 && <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>Back</Button>}
              <Button className="flex-1" onClick={handleNext} disabled={createTenant.isPending}>
                {createTenant.isPending ? "Setting up..." : step < 2 ? <><span>Next</span><ArrowRight className="w-4 h-4 ml-1.5" /></> : <><span>Launch Rebooked</span><Zap className="w-4 h-4 ml-1.5" /></>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
