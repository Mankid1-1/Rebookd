import { Bell, Clock, Calendar, UserX, RotateCcw, XCircle, ThumbsUp, TrendingUp, MessageSquare, Gift, Star, Mail, Heart, Zap, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface AutomationDef {
  icon: LucideIcon;
  label: string;
  cat: string;
  tip: string;
}

export const ALL_AUTOMATIONS: AutomationDef[] = [
  // Appointment (4)
  { icon: Bell,           label: "24-Hour Reminder",               cat: "appointment",    tip: "Texts clients 24h before their appointment" },
  { icon: Clock,          label: "2-Hour Reminder",                cat: "appointment",    tip: "Last-chance nudge 2h before the appointment" },
  { icon: Calendar,       label: "Booking Confirmation",           cat: "appointment",    tip: "Instantly confirms new bookings via SMS" },
  { icon: Bell,           label: "Confirmation Chase",             cat: "appointment",    tip: "Follows up if they haven't confirmed yet" },
  // No-Show (2)
  { icon: UserX,          label: "No-Show Check-In",               cat: "no-show",        tip: "Caring follow-up when a client misses their slot" },
  { icon: RotateCcw,      label: "No-Show Rebook Offer",           cat: "no-show",        tip: "Offers to rebook 3 days after a no-show" },
  // Cancellation (4)
  { icon: XCircle,        label: "Cancellation Acknowledgement",   cat: "cancellation",   tip: "Confirms cancellation and offers to rebook" },
  { icon: RotateCcw,      label: "Post-Cancellation Rebook",       cat: "cancellation",   tip: "Nudges rebooking 48h after a cancel" },
  { icon: RotateCcw,      label: "Cancellation Rescue (7 Days)",   cat: "cancellation",   tip: "Final rebook attempt one week after cancel" },
  { icon: Zap,            label: "Waitlist Fill",                  cat: "cancellation",   tip: "Texts waitlisted clients when a slot opens" },
  // Follow-Up & Engagement (9)
  { icon: ThumbsUp,       label: "Post-Visit Feedback",            cat: "follow-up",      tip: "Requests a review after their appointment" },
  { icon: TrendingUp,     label: "Post-Visit Upsell",              cat: "follow-up",      tip: "Promotes a related service or next visit offer" },
  { icon: Calendar,       label: "Next Visit Prompt",              cat: "follow-up",      tip: "Encourages booking the next appointment" },
  { icon: MessageSquare,  label: "Lead Follow-Up (3 Days)",        cat: "follow-up",      tip: "Checks in with new leads who haven't booked" },
  { icon: MessageSquare,  label: "Lead Follow-Up (7 Days)",        cat: "follow-up",      tip: "Final follow-up for unconverted leads" },
  { icon: MessageSquare,  label: "Qualified Follow-Up (1 Day)",    cat: "follow-up",      tip: "Quick nudge for qualified but unbooked leads" },
  { icon: MessageSquare,  label: "Qualified Follow-Up (3 Days)",   cat: "follow-up",      tip: "Second touch for qualified leads" },
  { icon: Bell,           label: "Inbound Auto-Reply",             cat: "follow-up",      tip: "Acknowledges texts if you're busy" },
  { icon: Shield,         label: "Delivery Failure Recovery",      cat: "follow-up",      tip: "Retries when an outbound SMS fails" },
  // Re-Engagement (4)
  { icon: Gift,           label: "30-Day Win-Back",                cat: "re-engagement",  tip: "Re-engages clients absent for 30 days" },
  { icon: Gift,           label: "90-Day Re-engagement",           cat: "re-engagement",  tip: "Special offer for 90-day lapsed clients" },
  { icon: Star,           label: "VIP Win-Back (45 Days)",         cat: "re-engagement",  tip: "Priority rebooking for your best clients" },
  { icon: Gift,           label: "VIP Win-Back (90 Days)",         cat: "re-engagement",  tip: "Exclusive comeback offer for top-tier VIPs" },
  // Welcome (1)
  { icon: Mail,           label: "New Lead Welcome",               cat: "welcome",        tip: "Instantly welcomes new leads with a booking invite" },
  // Loyalty (2)
  { icon: Heart,          label: "Birthday Promotion",             cat: "loyalty",        tip: "Sends a birthday treat with a special offer" },
  { icon: Star,           label: "Loyalty Milestone",              cat: "loyalty",        tip: "Celebrates their 5th, 10th, 20th visit" },
  // Lead Capture (3)
  { icon: Zap,            label: "Missed Call Text-Back",          cat: "lead-capture",   tip: "Instantly texts missed callers before they leave" },
  { icon: Zap,            label: "Missed Call Follow-Up",          cat: "lead-capture",   tip: "4h follow-up if they haven't booked yet" },
  { icon: Zap,            label: "Missed Call Final Offer",        cat: "lead-capture",   tip: "Last chance nudge 24h after missed call" },
];

export const AUTOMATION_COUNT = ALL_AUTOMATIONS.length;

export const AUTOMATION_CATEGORIES = [
  { key: "all",            label: "All" },
  { key: "appointment",    label: "Appointment" },
  { key: "no-show",        label: "No-Show" },
  { key: "cancellation",   label: "Cancellation" },
  { key: "follow-up",      label: "Follow-Up" },
  { key: "re-engagement",  label: "Re-Engagement" },
  { key: "welcome",        label: "Welcome" },
  { key: "loyalty",        label: "Loyalty" },
  { key: "lead-capture",   label: "Lead Capture" },
] as const;

export const catStyles: Record<string, string> = {
  appointment:    "bg-success/15 text-success border-success/30",
  "no-show":      "bg-destructive/15 text-destructive border-destructive/30",
  cancellation:   "bg-warning/15 text-warning-foreground border-warning/30",
  "follow-up":    "bg-primary/15 text-primary border-primary/30",
  "re-engagement":"bg-accent/15 text-accent-foreground border-accent/30",
  welcome:        "bg-info/15 text-info border-info/30",
  loyalty:        "bg-primary/15 text-primary border-primary/30",
  "lead-capture": "bg-info/15 text-info border-info/30",
};
