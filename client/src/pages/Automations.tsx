import React, { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Bot, Zap, Settings2, ChevronDown, ChevronUp, Clock, MessageSquare,
  CalendarCheck, UserX, XCircle, RotateCcw, Bell, Star, AlertTriangle,
  ThumbsUp, Gift, RefreshCw, Search, Activity, ToggleRight, Send,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type AutomationKey =
  | "appointment_reminder_24h" | "appointment_reminder_2h" | "appointment_confirmation"
  | "appointment_confirmation_chase"
  | "no_show_follow_up" | "no_show_rebooking"
  | "cancellation_same_day" | "cancellation_rebooking" | "cancellation_rebooking_48h" | "cancellation_rebooking_7d"
  | "post_appointment_feedback" | "post_appointment_upsell" | "next_visit_prompt"
  | "win_back_30d" | "win_back_90d" | "vip_winback_45d" | "vip_winback_90d"
  | "new_lead_welcome" | "lead_follow_up_3d" | "lead_follow_up_7d" | "qualified_followup_1d" | "qualified_followup_3d" | "inbound_response_sla" | "delivery_failure_retry" | "waitlist_fill"
  | "birthday_promo" | "loyalty_milestone";

type AutomationCategory = "appointment" | "no_show" | "cancellation" | "follow_up" | "reactivation" | "welcome" | "loyalty";

interface ConfigField {
  key: string;
  label: string;
  type: "number" | "text" | "textarea" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
  unit?: string;
  defaultValue: string | number;
}

interface AutomationTemplate {
  key: AutomationKey;
  name: string;
  category: AutomationCategory;
  icon: React.ElementType;
  description: string;
  defaultMessage: string;
  configFields: ConfigField[];
  planRequired: "starter" | "growth" | "scale";
  recommended?: boolean;
}

// ─── Catalogue (all 19 automations) ───────────────────────────────────────────

const CATALOGUE: AutomationTemplate[] = [
  {
    key: "appointment_reminder_24h",
    name: "24-Hour Reminder",
    category: "appointment",
    icon: Bell,
    description: "Sends an automatic reminder 24 hours before a scheduled appointment to reduce no-shows.",
    defaultMessage: "Hi {{name}}, just a reminder that your appointment at {{business}} is tomorrow at {{time}}. Reply CONFIRM to confirm or CANCEL to cancel. See you soon!",
    configFields: [
      { key: "delayHours", label: "Send before appointment", type: "number", unit: "hours", placeholder: "24", defaultValue: 24 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Hi {{name}}, just a reminder that your appointment at {{business}} is tomorrow at {{time}}. Reply CONFIRM to confirm or CANCEL to cancel." },
    ],
    planRequired: "starter",
    recommended: true,
  },
  {
    key: "appointment_reminder_2h",
    name: "2-Hour Reminder",
    category: "appointment",
    icon: Clock,
    description: "Last-chance reminder 2 hours before the appointment. Pairs well with the 24-hour reminder.",
    defaultMessage: "Hey {{name}}! Your appointment at {{business}} is in 2 hours ({{time}}). See you soon! Reply CANCEL if you need to reschedule.",
    configFields: [
      { key: "delayHours", label: "Send before appointment", type: "number", unit: "hours", placeholder: "2", defaultValue: 2 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Hey {{name}}! Your appointment at {{business}} is in 2 hours ({{time}}). See you soon!" },
    ],
    planRequired: "starter",
  },
  {
    key: "appointment_confirmation",
    name: "Booking Confirmation",
    category: "appointment",
    icon: CalendarCheck,
    description: "Immediately confirms a new booking with the appointment details.",
    defaultMessage: "Hi {{name}}, your appointment at {{business}} is confirmed for {{date}} at {{time}}. Reply CANCEL to cancel.",
    configFields: [
      { key: "message", label: "Message", type: "textarea", defaultValue: "Hi {{name}}, your appointment at {{business}} is confirmed for {{date}} at {{time}}. Reply CANCEL to cancel." },
    ],
    planRequired: "starter",
    recommended: true,
  },
  {
    key: "appointment_confirmation_chase",
    name: "Confirmation Chase",
    category: "appointment",
    icon: AlertTriangle,
    description: "Follows up with booked clients who still have not confirmed and gives them a fast way to confirm or reschedule.",
    defaultMessage: "Hi {{name}}, just checking that you're still good for {{date}} at {{time}}. Reply CONFIRM or RESCHEDULE.",
    configFields: [
      { key: "delayHours", label: "Send before appointment", type: "number", unit: "hours", placeholder: "12", defaultValue: 12 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Hi {{name}}, just checking that you're still good for {{date}} at {{time}}. Reply CONFIRM or RESCHEDULE." },
    ],
    planRequired: "starter",
    recommended: true,
  },
  {
    key: "no_show_follow_up",
    name: "No-Show Check-In",
    category: "no_show",
    icon: UserX,
    description: "Sends a caring follow-up when a client misses their appointment.",
    defaultMessage: "Hi {{name}}, we noticed you weren't able to make your appointment today. Everything okay? We'd love to get you rebooked — reply YES to see availability.",
    configFields: [
      { key: "delayMinutes", label: "Send after no-show", type: "number", unit: "minutes", placeholder: "60", defaultValue: 60 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Hi {{name}}, we noticed you weren't able to make your appointment today. We'd love to rebook you — reply YES to see availability." },
    ],
    planRequired: "starter",
    recommended: true,
  },
  {
    key: "no_show_rebooking",
    name: "No-Show Rebook Offer",
    category: "no_show",
    icon: RefreshCw,
    description: "A second touchpoint 3 days after a no-show with a gentle rebook offer.",
    defaultMessage: "Hi {{name}}, we still have availability if you'd like to reschedule your missed appointment. We have spots open this week — reply to book or call us at {{phone}}.",
    configFields: [
      { key: "delayDays", label: "Send after no-show", type: "number", unit: "days", placeholder: "3", defaultValue: 3 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Hi {{name}}, we still have availability if you'd like to reschedule. We have spots open this week — reply to book." },
    ],
    planRequired: "growth",
  },
  {
    key: "cancellation_same_day",
    name: "Cancellation Acknowledgement",
    category: "cancellation",
    icon: XCircle,
    description: "Confirms a cancellation and immediately offers to rebook while intent is fresh.",
    defaultMessage: "Hi {{name}}, we've cancelled your appointment. We'd love to find another time — reply REBOOK to see our availability, or call us at {{phone}}.",
    configFields: [
      { key: "message", label: "Message", type: "textarea", defaultValue: "We've cancelled your appointment for {{date}}. Reply REBOOK to find another time that works for you." },
    ],
    planRequired: "starter",
    recommended: true,
  },
  {
    key: "cancellation_rebooking",
    name: "Post-Cancellation Rebook",
    category: "cancellation",
    icon: RotateCcw,
    description: "Follows up 48 hours after a cancellation with a rebook nudge.",
    defaultMessage: "Hi {{name}}, we noticed you had to cancel recently. We'd love to have you back! Great availability this week. Reply YES to book or visit our site.",
    configFields: [
      { key: "delayHours", label: "Send after cancellation", type: "number", unit: "hours", placeholder: "48", defaultValue: 48 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Hi {{name}}, we noticed you had to cancel recently. We'd love to have you back — reply YES to see availability." },
    ],
    planRequired: "growth",
  },
  {
    key: "cancellation_rebooking_48h",
    name: "Cancellation Rescue (48h)",
    category: "cancellation",
    icon: RotateCcw,
    description: "Second rebooking attempt 48 hours after a cancellation.",
    defaultMessage: "We still have a few spots open this week if you'd like to rebook. Reply YES and we'll send options.",
    configFields: [
      { key: "delayHours", label: "Send after cancellation", type: "number", unit: "hours", placeholder: "48", defaultValue: 48 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "We still have a few spots open this week if you'd like to rebook. Reply YES and we'll send options." },
    ],
    planRequired: "growth",
  },
  {
    key: "cancellation_rebooking_7d",
    name: "Cancellation Rescue (7 Days)",
    category: "cancellation",
    icon: RefreshCw,
    description: "Final rebooking attempt one week after a cancellation.",
    defaultMessage: "Last check-in from {{business}}. We'd still love to get you back on the calendar whenever you're ready.",
    configFields: [
      { key: "delayDays", label: "Send after cancellation", type: "number", unit: "days", placeholder: "7", defaultValue: 7 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Last check-in from {{business}}. We'd still love to get you back on the calendar whenever you're ready." },
    ],
    planRequired: "growth",
  },
  {
    key: "waitlist_fill",
    name: "Waitlist Fill",
    category: "cancellation",
    icon: Zap,
    description: "When a cancellation opens a slot, text nearby active leads to fill it fast.",
    defaultMessage: "An appointment opening just came up at {{business}}. Want it? Reply YES and we'll hold it for you.",
    configFields: [
      { key: "candidateWindowDays", label: "Look back window", type: "number", unit: "days", placeholder: "30", defaultValue: 30 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "An appointment opening just came up at {{business}}. Want it? Reply YES and we'll hold it for you." },
    ],
    planRequired: "growth",
    recommended: true,
  },
  {
    key: "post_appointment_feedback",
    name: "Post-Visit Feedback",
    category: "follow_up",
    icon: ThumbsUp,
    description: "Requests a review shortly after an appointment to build social proof.",
    defaultMessage: "Hi {{name}}, thanks for visiting {{business}} today! We hope you loved your experience. We'd really appreciate a quick review — it takes less than a minute: {{review_link}}",
    configFields: [
      { key: "delayHours", label: "Send after appointment", type: "number", unit: "hours", placeholder: "2", defaultValue: 2 },
      { key: "reviewLink", label: "Review link URL", type: "text", placeholder: "https://g.page/...", defaultValue: "" },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Thanks for visiting {{business}} today! We'd love a quick review: {{review_link}}" },
    ],
    planRequired: "growth",
    recommended: true,
  },
  {
    key: "post_appointment_upsell",
    name: "Post-Visit Upsell",
    category: "follow_up",
    icon: Star,
    description: "Promotes a related service or next booking after a completed appointment.",
    defaultMessage: "Hi {{name}}, great seeing you today! As a valued client, you're eligible for our {{offer}}. Ready to book your next visit? Reply YES.",
    configFields: [
      { key: "delayDays", label: "Send after appointment", type: "number", unit: "days", placeholder: "1", defaultValue: 1 },
      { key: "offerText", label: "Offer description", type: "text", placeholder: "e.g. 10% off your next visit", defaultValue: "10% off your next visit" },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Great seeing you today! As a valued client you're eligible for {{offer}}. Reply YES to book your next appointment." },
    ],
    planRequired: "growth",
  },
  {
    key: "new_lead_welcome",
    name: "New Lead Welcome",
    category: "welcome",
    icon: MessageSquare,
    description: "Immediately welcomes new leads and invites them to book their first appointment.",
    defaultMessage: "Hi {{name}}, thanks for your interest in {{business}}! We'd love to help you. Reply to book an appointment or call us at {{phone}}.",
    configFields: [
      { key: "message", label: "Message", type: "textarea", defaultValue: "Hi {{name}}, thanks for your interest in {{business}}! We'd love to help. Reply to book an appointment." },
    ],
    planRequired: "starter",
    recommended: true,
  },
  {
    key: "lead_follow_up_3d",
    name: "Lead Follow-Up (3 Days)",
    category: "follow_up",
    icon: Clock,
    description: "Follows up with new leads who haven't booked within 3 days.",
    defaultMessage: "Hi {{name}}, just checking in from {{business}}! Have you had a chance to think about booking? We have great availability this week. Reply YES to see times.",
    configFields: [
      { key: "delayDays", label: "Days after lead added", type: "number", unit: "days", placeholder: "3", defaultValue: 3 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Hi {{name}}, just checking in! Have you had a chance to book? We have great availability this week." },
    ],
    planRequired: "starter",
  },
  {
    key: "lead_follow_up_7d",
    name: "Lead Follow-Up (7 Days)",
    category: "follow_up",
    icon: RefreshCw,
    description: "Final follow-up for leads who still haven't booked after 7 days.",
    defaultMessage: "Hey {{name}}, last check-in from {{business}}! We'd still love to help you. If now isn't the right time, no worries — reply whenever you're ready.",
    configFields: [
      { key: "delayDays", label: "Days after lead added", type: "number", unit: "days", placeholder: "7", defaultValue: 7 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Hey {{name}}, last check-in from {{business}}! We'd still love to help. Reply whenever you're ready." },
    ],
    planRequired: "starter",
  },
  {
    key: "win_back_30d",
    name: "30-Day Win-Back",
    category: "reactivation",
    icon: RotateCcw,
    description: "Re-engages clients who haven't visited in 30 days with a gentle check-in.",
    defaultMessage: "Hey {{name}}, it's been a little while since we've seen you at {{business}}! We'd love to have you back. Great availability this week — reply to book.",
    configFields: [
      { key: "delayDays", label: "Days since last visit", type: "number", unit: "days", placeholder: "30", defaultValue: 30 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Hey {{name}}, it's been a little while! We'd love to have you back. Reply to book or call us." },
    ],
    planRequired: "growth",
  },
  {
    key: "win_back_90d",
    name: "90-Day Re-engagement",
    category: "reactivation",
    icon: Gift,
    description: "Wins back lapsed clients who haven't visited in 90 days with a special offer.",
    defaultMessage: "Hi {{name}}, we miss you! It's been a while since your last visit to {{business}}. We'd love to welcome you back with a special offer — reply YES to claim it!",
    configFields: [
      { key: "delayDays", label: "Days since last visit", type: "number", unit: "days", placeholder: "90", defaultValue: 90 },
      { key: "offerText", label: "Comeback offer", type: "text", placeholder: "e.g. 15% off", defaultValue: "15% off your next visit" },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Hi {{name}}, we miss you! It's been a while. Reply YES to claim a special comeback offer." },
    ],
    planRequired: "scale",
    recommended: true,
  },
  {
    key: "birthday_promo",
    name: "Birthday Promotion",
    category: "loyalty",
    icon: Gift,
    description: "Sends a special birthday message and exclusive offer to clients on their birthday.",
    defaultMessage: "Happy Birthday {{name}}! From all of us at {{business}}, we hope you have a wonderful day. Enjoy {{offer}} on your next visit — valid this month!",
    configFields: [
      { key: "offerText", label: "Birthday offer", type: "text", placeholder: "e.g. 20% off", defaultValue: "20% off your next visit" },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Happy Birthday {{name}}! We hope you have a great day. Enjoy {{offer}} on your next visit — valid this month!" },
    ],
    planRequired: "scale",
  },
  {
    key: "loyalty_milestone",
    name: "Loyalty Milestone",
    category: "loyalty",
    icon: Star,
    description: "Celebrates a client's visit milestone (5th, 10th, 20th visit) with a reward.",
    defaultMessage: "Congratulations {{name}}! You've just reached your {{milestone}} visit at {{business}}. As a thank-you for your loyalty, enjoy {{offer}}. We truly appreciate you!",
    configFields: [
      { key: "visitMilestone", label: "Visit milestone", type: "select", options: [{ value: "5", label: "5th visit" }, { value: "10", label: "10th visit" }, { value: "20", label: "20th visit" }], defaultValue: "5" },
      { key: "offerText", label: "Loyalty reward", type: "text", placeholder: "e.g. a free add-on service", defaultValue: "a complimentary add-on service" },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Congratulations {{name}}! You've just hit your {{milestone}} visit. Enjoy {{offer}} as a thank-you for your loyalty!" },
    ],
    planRequired: "scale",
  },
];

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<AutomationCategory, { label: string; bg: string }> = {
  appointment: { label: "Appointment", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  no_show: { label: "No-Show", bg: "bg-red-500/10 text-red-400 border-red-500/30" },
  cancellation: { label: "Cancellation", bg: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  follow_up: { label: "Follow-Up", bg: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  reactivation: { label: "Re-Engagement", bg: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  welcome: { label: "Welcome", bg: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  loyalty: { label: "Loyalty", bg: "bg-pink-500/10 text-pink-400 border-pink-500/30" },
};

const PLAN_BADGE: Record<string, string> = {
  starter: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  growth: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  scale: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

const CATEGORIES: Array<{ key: AutomationCategory | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "appointment", label: "Appointments" },
  { key: "no_show", label: "No-Shows" },
  { key: "cancellation", label: "Cancellations" },
  { key: "follow_up", label: "Follow-Ups" },
  { key: "reactivation", label: "Re-Engagement" },
  { key: "welcome", label: "Welcome" },
  { key: "loyalty", label: "Loyalty" },
];

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card className="border-border bg-card/60 animate-pulse">
      <CardContent className="p-0">
        <div className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 rounded-xl bg-muted/50 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 bg-muted/50 rounded" />
            <div className="h-3 w-64 bg-muted/30 rounded" />
          </div>
          <div className="h-6 w-11 bg-muted/50 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Configure Dialog ─────────────────────────────────────────────────────────

function ConfigureDialog({
  template,
  savedConfig,
  open,
  onClose,
  onSave,
}: {
  template: AutomationTemplate;
  savedConfig?: Record<string, string | number>;
  open: boolean;
  onClose: () => void;
  onSave: (config: Record<string, string | number>) => void;
}) {
  const [config, setConfig] = useState<Record<string, string | number>>(() => {
    const defaults: Record<string, string | number> = {};
    template.configFields.forEach((f) => { defaults[f.key] = savedConfig?.[f.key] ?? f.defaultValue; });
    return defaults;
  });

  const Icon = template.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base">{template.name}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {template.configFields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-xs font-medium">
                {field.label}
                {field.unit && <span className="text-muted-foreground ml-1">({field.unit})</span>}
              </Label>
              {field.type === "textarea" ? (
                <div>
                  <Textarea
                    className="text-sm resize-none min-h-[90px]"
                    value={config[field.key] as string}
                    onChange={(e) => setConfig((p) => ({ ...p, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Variables: {"{{name}}"}, {"{{business}}"}, {"{{time}}"}, {"{{date}}"}, {"{{phone}}"}
                  </p>
                  {config[field.key] && String(config[field.key]).length > 10 && (
                    <div className="mt-2 p-2.5 bg-muted/40 rounded-lg border border-border">
                      <p className="text-[10px] text-muted-foreground font-medium mb-1">Preview</p>
                      <p className="text-xs text-foreground/80 leading-relaxed">
                        {String(config[field.key]).replace(/\{\{name\}\}/g, "Jane").replace(/\{\{business\}\}/g, "Your Business").replace(/\{\{time\}\}/g, "2:00 PM").replace(/\{\{date\}\}/g, "Mon Mar 24").replace(/\{\{phone\}\}/g, "+1 555 0000000")}
                      </p>
                    </div>
                  )}
                </div>
              ) : field.type === "select" ? (
                <Select
                  value={String(config[field.key])}
                  onValueChange={(v) => setConfig((p) => ({ ...p, [field.key]: v }))}
                >
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {field.options?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={field.type}
                  className="text-sm"
                  value={config[field.key] as string}
                  onChange={(e) => setConfig((p) => ({ ...p, [field.key]: field.type === "number" ? (parseFloat(e.target.value) || 0) : e.target.value }))}
                  placeholder={field.placeholder}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => { onSave(config); onClose(); }}>Save configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Automation Row ────────────────────────────────────────────────────────────

function AutomationRow({
  template,
  saved,
  onToggle,
  onConfigure,
  isToggling,
}: {
  template: AutomationTemplate;
  saved?: { id?: number; enabled: boolean; runCount: number; errorCount?: number; lastRunAt?: string | Date | null; config?: Record<string, string | number> };
  onToggle: (enabled: boolean) => void;
  onConfigure: () => void;
  isToggling?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const testMutation = trpc.automations.test.useMutation({
    onSuccess: () => {
      setTestPhone("");
      toast.success("Test automation sent");
    },
    onError: (err) => toast.error(err.message),
  });

  const Icon = template.icon;
  const isEnabled = saved?.enabled ?? false;
  const cat = CATEGORY_CONFIG[template.category];

  const lastTriggered = saved?.lastRunAt
    ? new Date(saved.lastRunAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <Card className={`border transition-all ${isEnabled ? "border-primary/20 bg-card" : "border-border bg-card/60"}`}>
      <CardContent className="p-0">
        <div className="flex items-center gap-4 p-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isEnabled ? "bg-primary/10" : "bg-muted/30"}`}>
            <Icon className={`w-4 h-4 ${isEnabled ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{template.name}</span>
              {template.recommended && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-yellow-500/10 text-yellow-400 border-yellow-500/30">Recommended</Badge>
              )}
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cat.bg}`}>{cat.label}</Badge>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PLAN_BADGE[template.planRequired]}`}>{template.planRequired}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{template.description}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[11px] text-muted-foreground/70">
                Triggered {saved?.runCount ?? 0} times
              </span>
              <span className="text-[11px] text-muted-foreground/50">|</span>
              <span className="text-[11px] text-muted-foreground/70">
                Last: {lastTriggered ?? "Never"}
              </span>
              {(saved?.errorCount ?? 0) > 0 && (
                <>
                  <span className="text-[11px] text-muted-foreground/50">|</span>
                  <span className="text-[11px] text-red-400/70">
                    {saved!.errorCount} errors
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={saved ? "ghost" : "outline"}
              size="sm"
              className={saved ? "h-8 w-8 p-0 text-muted-foreground hover:text-foreground" : "h-8 px-2.5 text-xs text-primary border-primary/30 hover:bg-primary/5"}
              onClick={onConfigure}
              title="Configure this automation"
            >
              {saved ? <Settings2 className="w-3.5 h-3.5" /> : <><Settings2 className="w-3 h-3 mr-1" />Configure</>}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <span className="text-xs text-muted-foreground">{isToggling ? "..." : isEnabled ? "On" : "Off"}</span>
              <Switch checked={isEnabled} onCheckedChange={onToggle} disabled={isToggling} />
            </div>
          </div>
        </div>
        {expanded && (
          <div className="px-4 pb-4 border-t border-border/50 pt-3">
            <div className="bg-muted/20 rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Default message preview</p>
              <p className="text-xs text-foreground/80 leading-relaxed">{template.defaultMessage}</p>
            </div>
            {saved?.config && Object.keys(saved.config).filter(k => k !== "message").length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(saved.config).filter(([k]) => k !== "message").map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1 bg-muted/30 rounded px-2 py-1 text-xs">
                    <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1").toLowerCase()}:</span>
                    <span className="font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Test this automation</p>
              <div className="flex gap-2">
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Phone (e.g. +15551112222)"
                  className="text-xs"
                />
                <Button
                  size="sm"
                  disabled={!testPhone || !saved?.id || testMutation.isPending}
                  onClick={() => {
                    if (!saved?.id || !testPhone) return;
                    testMutation.mutate({ automationId: saved.id, testPhone: testPhone.trim() });
                  }}
                >
                  {testMutation.isPending ? "Sending..." : "Send Test"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Automations() {
  const utils = trpc.useUtils();
  const [activeCategory, setActiveCategory] = useState<AutomationCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [configTarget, setConfigTarget] = useState<AutomationKey | null>(null);

  const { data: savedList, isLoading } = trpc.automations.list.useQuery(undefined, { retry: false });
  const savedArray = (savedList ?? []) as Array<{
    id?: number;
    key: string;
    enabled: boolean;
    runCount: number;
    errorCount?: number;
    lastRunAt?: Date | string | null;
    triggerConfig?: Record<string, unknown>;
  }>;

  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const toggleMutation = trpc.automations.toggleByKey.useMutation({
    onSuccess: () => {
      utils.automations.list.invalidate();
      setTogglingKey(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setTogglingKey(null);
    },
  });

  const configureMutation = trpc.automations.configureByKey.useMutation({
    onSuccess: () => {
      toast.success("Automation configured");
      utils.automations.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const savedMap = useMemo(() => {
    const map: Record<string, (typeof savedArray)[number]> = {};
    for (const s of savedArray) {
      if (s.key) map[s.key] = s;
    }
    return map;
  }, [savedArray]);

  // Stats
  const enabledCount = CATALOGUE.filter((t) => savedMap[t.key]?.enabled).length;
  const totalTriggeredThisMonth = savedArray.reduce((sum, s) => sum + (s.runCount ?? 0), 0);
  const totalErrors = savedArray.reduce((sum, s) => sum + (s.errorCount ?? 0), 0);

  // Filter & search
  const filtered = useMemo(() => {
    let list = CATALOGUE;
    if (activeCategory !== "all") {
      list = list.filter((t) => t.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeCategory, searchQuery]);

  const configTemplate = configTarget ? CATALOGUE.find((t) => t.key === configTarget) : null;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Automations
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your SMS automations. {CATALOGUE.length} templates available.
          </p>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <ToggleRight className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xl font-bold">{isLoading ? "-" : enabledCount}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xl font-bold">{isLoading ? "-" : totalTriggeredThisMonth}</p>
                <p className="text-xs text-muted-foreground">Triggered</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Send className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-xl font-bold">{isLoading ? "-" : (totalTriggeredThisMonth - totalErrors)}</p>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search automations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(({ key, label }) => {
              const count = key === "all" ? CATALOGUE.length : CATALOGUE.filter((t) => t.category === key).length;
              return (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    activeCategory === key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {label} <span className="opacity-60 ml-0.5">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Automation list */}
        <div className="space-y-3">
          {isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No automations match your search.</p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearchQuery(""); setActiveCategory("all"); }}>
                Clear filters
              </Button>
            </div>
          ) : (
            filtered.map((template) => {
              const saved = savedMap[template.key];
              return (
                <AutomationRow
                  key={template.key}
                  template={template}
                  saved={saved ? {
                    id: saved.id,
                    enabled: saved.enabled,
                    runCount: saved.runCount,
                    errorCount: saved.errorCount,
                    lastRunAt: saved.lastRunAt,
                    config: saved.triggerConfig as Record<string, string | number> | undefined,
                  } : undefined}
                  onToggle={(enabled) => {
                    setTogglingKey(template.key);
                    toggleMutation.mutate({ key: template.key, enabled });
                  }}
                  onConfigure={() => setConfigTarget(template.key)}
                  isToggling={togglingKey === template.key}
                />
              );
            })
          )}
        </div>
      </div>

      {configTemplate && (
        <ConfigureDialog
          template={configTemplate}
          savedConfig={savedMap[configTarget!]?.triggerConfig as Record<string, string | number> | undefined}
          open={!!configTarget}
          onClose={() => setConfigTarget(null)}
          onSave={(config) => configureMutation.mutate({ key: configTarget!, config })}
        />
      )}
    </DashboardLayout>
  );
}
