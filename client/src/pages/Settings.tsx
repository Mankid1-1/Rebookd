import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Building2, Key, Phone, Plus, Trash2, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
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

export default function Settings() {
  const utils = trpc.useUtils();
  const { data: tenant } = trpc.tenant.get.useQuery(undefined, { retry: false });
  const { data: phones = [] } = trpc.tenant.phoneNumbers.useQuery(undefined, { retry: false });
  const { data: apiKeys = [] } = trpc.apiKeys.list.useQuery(undefined, { retry: false });

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [industry, setIndustry] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newKeyLabel, setNewKeyLabel] = useState("");

  useEffect(() => {
    if (tenant) {
      setName(tenant.name ?? "");
      setTimezone(tenant.timezone ?? "");
      setIndustry(tenant.industry ?? "");
    }
  }, [tenant]);

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
    onSuccess: () => utils.tenant.phoneNumbers.invalidate(),
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

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your workspace configuration</p>
        </div>

        {/* Setup checklist */}
        {phones.length === 0 && (
          <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-xl p-4 space-y-2.5">
            <p className="text-sm font-medium flex items-center gap-2">
              <span>⚡</span> Quick setup checklist
            </p>
            {[
              { done: !!tenant?.name && tenant.name !== "My Business", label: "Set your business name", tab: "general" },
              { done: phones.length > 0, label: "Add a Twilio phone number", tab: "phones" },
              { done: apiKeys.length > 0, label: "Create an API key (optional — for integrations)", tab: "api" },
            ].map(({ done, label, tab }) => (
              <button
                key={label}
                className="flex items-center gap-2.5 w-full text-left group"
              >
                {done
                  ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                <span className={`text-sm ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        )}

        <Tabs defaultValue="general">
          <TabsList className="mb-5">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="phones">Phone Numbers</TabsTrigger>
            <TabsTrigger value="api">API Keys</TabsTrigger>
          </TabsList>

          {/* General */}
          <TabsContent value="general">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" /> Business Info
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label>Business name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your business name" />
                </div>
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
                <Button
                  disabled={updateTenant.isPending}
                  onClick={() => { if (!name.trim()) return toast.error("Business name cannot be empty"); updateTenant.mutate({ name: name.trim(), timezone: timezone || undefined, industry: industry || undefined }); }}
                >
                  {updateTenant.isPending ? "Saving..." : "Save changes"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Phone Numbers */}
          <TabsContent value="phones">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" /> Phone Numbers
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Add your Twilio phone numbers here. Messages will be sent from these numbers.
                </p>
                <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Setup steps</p>
                  <p>1. Buy a number in your <a href="https://console.twilio.com" target="_blank" rel="noopener" className="text-primary underline">Twilio Console</a></p>
                  <p>2. Add your number below</p>
                  <p>3. In Twilio Console → Phone Numbers → your number → Messaging, set the inbound webhook URL to:</p>
                  <code className="block bg-muted rounded px-2 py-1 mt-1 select-all font-mono text-[11px]">{typeof window !== "undefined" ? window.location.origin : "https://yourdomain.com"}/api/twilio/inbound</code>
                  <p className="mt-1">This enables two-way conversations and automatic STOP/UNSUBSCRIBE compliance.</p>
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
                    <Plus className="w-4 h-4 mr-1" /> Add
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
          </TabsContent>

          {/* API Keys */}
          <TabsContent value="api">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary" /> API Keys
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Create API keys to integrate Rebooked with your other tools. Keys are only shown once.
                </p>

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
                    <Plus className="w-4 h-4 mr-1" /> Create
                  </Button>
                </div>

                <Separator />

                {apiKeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No API keys yet.</p>
                ) : (
                  <div className="space-y-2">
                    {apiKeys.map((key: any) => (
                      <div key={key.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div>
                          <p className="text-sm font-medium">{key.label || "Unnamed key"}</p>
                          <p className="text-xs text-muted-foreground font-mono">{key.prefix}••••••••</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(key.createdAt).toLocaleDateString()}
                          </span>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently revoke this key. Any integrations using it will stop working.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => revokeApiKey.mutate({ keyId: key.id })}>Revoke</AlertDialogAction>
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
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
