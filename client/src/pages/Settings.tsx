import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Building2, Phone, Plus, Trash2, CheckCircle2, Circle, Clock, AlertTriangle, Download, Globe, Zap } from "lucide-react";
import { toast } from "sonner";
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

// ─── Constants ────────────────────────────────────────────────────────────────

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
  { value: "Australia/Sydney", label: "Sydney (AEDT)" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const DEFAULT_HOURS: Record<string, { open: string; close: string; closed: boolean }> = {
  Monday: { open: "09:00", close: "17:00", closed: false },
  Tuesday: { open: "09:00", close: "17:00", closed: false },
  Wednesday: { open: "09:00", close: "17:00", closed: false },
  Thursday: { open: "09:00", close: "17:00", closed: false },
  Friday: { open: "09:00", close: "17:00", closed: false },
  Saturday: { open: "10:00", close: "15:00", closed: false },
  Sunday: { open: "10:00", close: "15:00", closed: true },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <div className="h-4 w-32 bg-muted/50 rounded" />
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="h-4 w-48 bg-muted/40 rounded" />
            <div className="h-9 w-full bg-muted/30 rounded" />
            <div className="h-4 w-36 bg-muted/40 rounded" />
            <div className="h-9 w-full bg-muted/30 rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const utils = trpc.useUtils();
  const { data: tenant, isLoading: tenantLoading } = trpc.tenant.get.useQuery(undefined, { retry: false });
  const { data: phones = [], isLoading: phonesLoading } = trpc.tenant.phoneNumbers.useQuery(undefined, { retry: false });

  // Form state
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [businessHours, setBusinessHours] = useState(DEFAULT_HOURS);
  const [newPhone, setNewPhone] = useState("");
  const [nameError, setNameError] = useState("");

  // Populate from server
  useEffect(() => {
    if (tenant) {
      setName(tenant.name ?? "");
      setTimezone(tenant.timezone ?? "America/New_York");
      setIndustry(tenant.industry ?? "");
    }
  }, [tenant]);

  // Mutations
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
      toast.success("Default phone updated");
      utils.tenant.phoneNumbers.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  // Validate and save
  const handleSave = () => {
    setNameError("");
    if (!name.trim()) {
      setNameError("Business name is required");
      return;
    }
    if (name.trim().length < 2) {
      setNameError("Business name must be at least 2 characters");
      return;
    }
    updateTenant.mutate({
      name: name.trim(),
      timezone: timezone || undefined,
      industry: industry || undefined,
    });
  };

  const updateHours = (day: string, field: "open" | "close" | "closed", value: string | boolean) => {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  if (tenantLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-3xl mx-auto space-y-5">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Settings</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your workspace configuration</p>
          </div>
          <SettingsSkeleton />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your workspace configuration</p>
        </div>

        {/* Setup checklist */}
        {phones.length === 0 && (
          <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-xl p-4 space-y-2.5">
            <p className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" /> Quick setup checklist
            </p>
            {[
              { done: !!tenant?.name && tenant.name !== "My Business", label: "Set your business name" },
              { done: phones.length > 0, label: "Add your business phone number" },
              { done: !!industry, label: "Select your industry" },
            ].map(({ done, label }) => (
              <div key={label} className="flex items-center gap-2.5">
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

        {/* Section 1: Business Info */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Business Info
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Business name</Label>
              <Input
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(""); }}
                placeholder="Your business name"
                className={nameError ? "border-red-500/50 focus-visible:ring-red-500/30" : ""}
              />
              {nameError && <p className="text-xs text-red-400">{nameError}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Select value={industry || "other"} onValueChange={setIndustry}>
                  <SelectTrigger><SelectValue placeholder="Select your industry" /></SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
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
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourbusiness.com"
                  className="pl-9"
                />
              </div>
            </div>
            <Button
              disabled={updateTenant.isPending}
              onClick={handleSave}
            >
              {updateTenant.isPending ? "Saving..." : "Save changes"}
            </Button>
          </CardContent>
        </Card>

        {/* Section 2: Phone Numbers */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" /> Phone Numbers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              Add your business phone number so we can identify your account. Rebooked handles all SMS sending and receiving.
            </p>

            <div className="flex gap-2">
              <Input
                placeholder="+1 (555) 000-0000"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!newPhone.trim() || addPhone.isPending}
                onClick={() => addPhone.mutate({ number: newPhone })}
              >
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>

            <Separator className="bg-border" />

            {phonesLoading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-12 bg-muted/30 rounded-lg" />
                <div className="h-12 bg-muted/20 rounded-lg" />
              </div>
            ) : phones.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No phone numbers configured yet.</p>
            ) : (
              <div className="space-y-2">
                {phones.map((phone: any) => (
                  <div key={phone.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50">
                    <div>
                      <p className="text-sm font-medium">{phone.number}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {phone.isDefault && <span className="text-xs text-primary">Default</span>}
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
                            <AlertDialogDescription>This will remove {phone.number} from your account.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => removePhone.mutate({ phoneNumberId: phone.id })}>Remove</AlertDialogAction>
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

        {/* Section 3: Business Hours */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Business Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-4">
              Set your operating hours. Automations will respect these hours for message delivery.
            </p>
            <div className="space-y-2">
              {DAYS.map((day) => {
                const hours = businessHours[day];
                return (
                  <div key={day} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/10 border border-border/50">
                    <span className="text-sm font-medium w-24">{day}</span>
                    <Switch
                      checked={!hours.closed}
                      onCheckedChange={(checked) => updateHours(day, "closed", !checked)}
                    />
                    {hours.closed ? (
                      <span className="text-xs text-muted-foreground">Closed</span>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="time"
                          value={hours.open}
                          onChange={(e) => updateHours(day, "open", e.target.value)}
                          className="text-xs h-8 w-28"
                        />
                        <span className="text-xs text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={hours.close}
                          onChange={(e) => updateHours(day, "close", e.target.value)}
                          className="text-xs h-8 w-28"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Notification Preferences */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/10 border border-border/50">
              <div>
                <p className="text-sm font-medium">Email notifications</p>
                <p className="text-xs text-muted-foreground mt-0.5">Receive email alerts for new leads, messages, and automation activity</p>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/10 border border-border/50">
              <div>
                <p className="text-sm font-medium">Weekly summary</p>
                <p className="text-xs text-muted-foreground mt-0.5">Get a weekly digest of automation performance and revenue recovery</p>
              </div>
              <Switch checked={true} disabled />
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Danger Zone */}
        <Card className="border-red-500/20 bg-card">
          <CardHeader className="pb-3 border-b border-red-500/20">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-4 h-4" /> Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/10 border border-border/50">
              <div>
                <p className="text-sm font-medium">Export data</p>
                <p className="text-xs text-muted-foreground mt-0.5">Download all your leads, conversations, and automation data as a CSV file</p>
              </div>
              <Button variant="outline" size="sm">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export
              </Button>
            </div>
            <Separator className="bg-red-500/10" />
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <div>
                <p className="text-sm font-medium text-red-400">Deactivate account</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This will pause all automations and disable your account. Your data will be retained for 30 days.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400">
                    Deactivate
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deactivate account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will immediately pause all automations and disable your account. You can reactivate within 30 days by contacting support.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive hover:bg-destructive/90"
                      onClick={() => toast.info("Please contact support@rebooked.io to deactivate your account.")}
                    >
                      Yes, deactivate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
