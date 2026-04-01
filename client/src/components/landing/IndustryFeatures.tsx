import {
  PhoneCall, RefreshCw, Users, BarChart3, Star, Bell,
  Clock, Calendar, UserX, RotateCcw, XCircle, ThumbsUp,
  TrendingUp, MessageSquare, Gift, Mail, Heart, Zap,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { IndustryConfig } from "@/data/industries";

// All 29 automations with short tooltip descriptions
const ALL_AUTOMATIONS = [
  { icon: Bell,           label: "24-Hour Reminder",               cat: "appointment",    tip: "Texts clients 24h before their appointment" },
  { icon: Clock,          label: "2-Hour Reminder",                cat: "appointment",    tip: "Last-chance nudge 2h before the appointment" },
  { icon: Calendar,       label: "Booking Confirmation",           cat: "appointment",    tip: "Instantly confirms new bookings via SMS" },
  { icon: Bell,           label: "Confirmation Chase",             cat: "appointment",    tip: "Follows up if they haven't confirmed yet" },
  { icon: UserX,          label: "No-Show Check-In",               cat: "no-show",        tip: "Caring follow-up when a client misses their slot" },
  { icon: RotateCcw,      label: "No-Show Rebook Offer",           cat: "no-show",        tip: "Offers to rebook 3 days after a no-show" },
  { icon: XCircle,        label: "Cancellation Acknowledgement",   cat: "cancellation",   tip: "Confirms cancellation and offers to rebook" },
  { icon: RotateCcw,      label: "Post-Cancellation Rebook",       cat: "cancellation",   tip: "Nudges rebooking 48h after a cancel" },
  { icon: RefreshCw,      label: "Cancellation Rescue (7 Days)",   cat: "cancellation",   tip: "Final rebook attempt one week after cancel" },
  { icon: Zap,            label: "Waitlist Fill",                  cat: "cancellation",   tip: "Texts waitlisted clients when a slot opens" },
  { icon: ThumbsUp,       label: "Post-Visit Feedback",            cat: "follow-up",      tip: "Requests a review after their appointment" },
  { icon: TrendingUp,     label: "Post-Visit Upsell",              cat: "follow-up",      tip: "Promotes a related service or next visit offer" },
  { icon: Calendar,       label: "Next Visit Prompt",              cat: "follow-up",      tip: "Encourages booking the next appointment" },
  { icon: MessageSquare,  label: "Lead Follow-Up (3 Days)",        cat: "follow-up",      tip: "Checks in with new leads who haven't booked" },
  { icon: MessageSquare,  label: "Lead Follow-Up (7 Days)",        cat: "follow-up",      tip: "Final follow-up for unconverted leads" },
  { icon: MessageSquare,  label: "Qualified Follow-Up (1 Day)",    cat: "follow-up",      tip: "Quick nudge for qualified but unbooked leads" },
  { icon: MessageSquare,  label: "Qualified Follow-Up (3 Days)",   cat: "follow-up",      tip: "Second touch for qualified leads" },
  { icon: Bell,           label: "Inbound Auto-Reply",             cat: "follow-up",      tip: "Acknowledges texts if you're busy" },
  { icon: Bell,           label: "Delivery Failure Recovery",      cat: "follow-up",      tip: "Retries when an outbound SMS fails" },
  { icon: RotateCcw,      label: "30-Day Win-Back",                cat: "re-engagement",  tip: "Re-engages clients absent for 30 days" },
  { icon: Gift,           label: "90-Day Re-engagement",           cat: "re-engagement",  tip: "Special offer for 90-day lapsed clients" },
  { icon: Star,           label: "VIP Win-Back (45 Days)",         cat: "re-engagement",  tip: "Priority rebooking for your best clients" },
  { icon: Gift,           label: "VIP Win-Back (90 Days)",         cat: "re-engagement",  tip: "Exclusive comeback offer for top-tier VIPs" },
  { icon: Mail,           label: "New Lead Welcome",               cat: "welcome",        tip: "Instantly welcomes new leads with a booking invite" },
  { icon: Heart,          label: "Birthday Promotion",             cat: "loyalty",        tip: "Sends a birthday treat with a special offer" },
  { icon: Star,           label: "Loyalty Milestone",              cat: "loyalty",        tip: "Celebrates their 5th, 10th, 20th visit" },
  { icon: Zap,            label: "Missed Call Text-Back",          cat: "lead-capture",   tip: "Instantly texts missed callers before they leave" },
  { icon: Zap,            label: "Missed Call Follow-Up",          cat: "lead-capture",   tip: "4h follow-up if they haven't booked yet" },
  { icon: Zap,            label: "Missed Call Final Offer",        cat: "lead-capture",   tip: "Last chance nudge 24h after missed call" },
] as const;

const catBadge: Record<string, { bg: string; text: string; border: string; label: string }> = {
  appointment:    { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30", label: "appointment" },
  "no-show":      { bg: "bg-red-500/15",     text: "text-red-600 dark:text-red-400",         border: "border-red-500/30",     label: "no-show" },
  cancellation:   { bg: "bg-amber-500/15",   text: "text-amber-600 dark:text-amber-400",     border: "border-amber-500/30",   label: "cancellation" },
  "follow-up":    { bg: "bg-blue-500/15",    text: "text-blue-600 dark:text-blue-400",       border: "border-blue-500/30",    label: "follow-up" },
  "re-engagement":{ bg: "bg-purple-500/15",  text: "text-purple-600 dark:text-purple-400",   border: "border-purple-500/30",  label: "win-back" },
  welcome:        { bg: "bg-cyan-500/15",    text: "text-cyan-600 dark:text-cyan-400",       border: "border-cyan-500/30",    label: "welcome" },
  loyalty:        { bg: "bg-pink-500/15",    text: "text-pink-600 dark:text-pink-400",       border: "border-pink-500/30",    label: "loyalty" },
  "lead-capture": { bg: "bg-teal-500/15",   text: "text-teal-600 dark:text-teal-400",       border: "border-teal-500/30",    label: "lead capture" },
};

interface IndustryFeaturesProps {
  config: IndustryConfig;
}

export function IndustryFeatures({ config }: IndustryFeaturesProps) {
  const features = [
    { icon: PhoneCall, title: "Missed Call Text-Back",    description: config.featureContext.missedCall },
    { icon: RefreshCw, title: "No-Show Recovery",         description: config.featureContext.noShow },
    { icon: Users,     title: "Waiting List Automation",  description: config.featureContext.cancellation },
    { icon: BarChart3, title: "Win-Back Campaigns",       description: config.featureContext.winBack },
    { icon: Star,      title: "Review Request Automation",description: config.featureContext.review },
    { icon: Bell,      title: "Smart Reminders",          description: config.featureContext.reminder },
  ];

  return (
    <section className="py-20 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground"
              style={{ fontFamily: "Space Grotesk, sans-serif", letterSpacing: "-0.02em" }}>
            {ALL_AUTOMATIONS.length} automations running in the background — built for {config.namePlural.toLowerCase()}
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Every automation is pre-written, pre-configured, and toggle-ready. Turn them on in 10 minutes and let them run forever.
          </p>
        </div>

        {/* 6 highlighted feature cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        {/* Full automation list with tooltips */}
        <div className="mt-12">
          <p className="text-center text-xs text-muted-foreground mb-5 uppercase tracking-widest">
            All {ALL_AUTOMATIONS.length} pre-built automations included
          </p>
          <TooltipProvider delayDuration={200}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {ALL_AUTOMATIONS.map(({ icon: Icon, label, cat, tip }) => {
                const badge = catBadge[cat];
                return (
                  <Tooltip key={label}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-card/80 hover:bg-card hover:shadow-sm transition-all cursor-default">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${badge?.bg ?? "bg-muted"}`}>
                          <Icon className={`w-3.5 h-3.5 ${badge?.text ?? "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate text-foreground">{label}</p>
                          <span className={`inline-flex text-[9px] px-1 py-0 mt-0.5 rounded border ${badge?.bg ?? ""} ${badge?.text ?? ""} ${badge?.border ?? ""}`}>
                            {badge?.label ?? cat}
                          </span>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-52 text-center">
                      <p className="text-xs">{tip}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </div>
      </div>
    </section>
  );
}
