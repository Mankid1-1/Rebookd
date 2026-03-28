import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Zap, Clock, MessageSquare,
  CalendarCheck, UserX, XCircle, RotateCcw, Bell, Star, AlertTriangle,
  ThumbsUp, Gift, RefreshCw, Info
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { AutomationRow } from "@/components/automations/AutomationRow";
import { ConfigureDialog } from "@/components/automations/ConfigureDialog";
import type { AutomationCategory, AutomationKey, AutomationTemplate } from "@/components/automations/types";
import { 
  useDynamicAutomationTemplates,
  useDynamicAutomationRecommendations,
  useDynamicAutomationConfig,
  useDynamicAutomationSuccessPrediction,
  useProgressiveDisclosureContext,
  trackFeatureUsage
} from "@/hooks/useDynamicAutomation";
import { useAuth } from "@/hooks/useAuth";
import { useLocale } from "@/contexts/LocaleContext";

// Dynamic automation catalogue based on user skill and business type
const getDynamicAutomationCatalogue = (userSkill?: any, businessType?: string) => {
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  const baseTemplates: any[] = [
    {
      key: "appointment_reminder_24h",
      name: "24-Hour Reminder",
      description: "Send reminder 24 hours before appointment",
      category: "appointment" as const,
      icon: <Clock className="h-4 w-4" />,
      recommended: true,
      impact: "high" as const,
      setupComplexity: "low" as const,
    },
    {
      key: "no_show_follow_up", 
      name: "No-Show Follow-Up",
      description: "Automatically follow up with no-shows",
      category: "no_show" as const,
      icon: <UserX className="h-4 w-4" />,
      recommended: true,
      impact: "high" as const,
      setupComplexity: "medium" as const,
    }
  ];

  // Add advanced automations for intermediate+ users
  if (userSkill?.level !== 'beginner') {
    baseTemplates.push(
      {
        key: "cancellation_rebooking",
        name: "Cancellation Rebooking", 
        description: "Offer rebooking when appointments are cancelled",
        category: "cancellation" as const,
        icon: <RotateCcw className="h-4 w-4" />,
        recommended: true,
        impact: "medium" as const,
        setupComplexity: "medium" as const,
      },
      {
        key: "post_appointment_feedback",
        name: "Post-Appointment Feedback",
        description: "Request feedback after appointments",
        category: "follow_up" as const,
        icon: <ThumbsUp className="h-4 w-4" />,
        recommended: false,
        impact: "low" as const,
        setupComplexity: "low" as const,
      }
    );
  }

  // Add expert automations for advanced users
  if (userSkill?.level === 'expert' || userSkill?.level === 'advanced') {
    baseTemplates.push(
      {
        key: "win_back_90d",
        name: "90-Day Win-Back",
        description: "Re-engage clients after 90 days of inactivity",
        category: "reactivation" as const,
        icon: <Gift className="h-4 w-4" />,
        recommended: false,
        impact: "medium" as const,
        setupComplexity: "high" as const,
      },
      {
        key: "birthday_promo",
        name: "Birthday Promotion",
        description: "Send special offers on client birthdays",
        category: "loyalty" as const,
        icon: <Star className="h-4 w-4" />,
        recommended: false,
        impact: "low" as const,
        setupComplexity: "medium" as const,
      }
    );
  }

  // Business-specific automations
  if (businessType?.includes('medical') || businessType?.includes('clinic')) {
    baseTemplates.push({
      key: "medical_follow_up",
      name: "Medical Follow-Up",
      description: "Follow up on medical appointments and care",
      category: "follow_up" as const,
      icon: <AlertTriangle className="h-4 w-4" />,
      recommended: true,
      impact: "high" as const,
      setupComplexity: "medium" as const,
    });
  }

  return baseTemplates;
};

// Dynamic categories based on available automations
const getDynamicCategories = (catalogue: any[]) => {
  const categories = [{ key: "all" as const, label: "All" }];
  const uniqueCategories = [...new Set(catalogue.map(t => t.category))];
  
  uniqueCategories.forEach(category => {
    categories.push({
      key: category,
      label: category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')
    });
  });

  return categories;
};

// Dynamic category config based on theme
const getDynamicCategoryConfig = () => {
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  return {
    appointment: isDarkMode ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : "bg-blue-500/15 text-blue-400 border-blue-500/30",
    no_show: isDarkMode ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-red-500/15 text-red-400 border-red-500/30", 
    cancellation: isDarkMode ? "bg-orange-500/20 text-orange-300 border-orange-500/30" : "bg-orange-500/15 text-orange-400 border-orange-500/30",
    follow_up: isDarkMode ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-green-500/15 text-green-400 border-green-500/30",
    reactivation: isDarkMode ? "bg-purple-500/20 text-purple-300 border-purple-500/30" : "bg-purple-500/15 text-purple-400 border-purple-500/30",
    welcome: isDarkMode ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    loyalty: isDarkMode ? "bg-pink-500/20 text-pink-300 border-pink-500/30" : "bg-pink-500/15 text-pink-400 border-pink-500/30",
    scale: isDarkMode ? "bg-purple-500/20 text-purple-300 border-purple-500/30" : "bg-purple-500/15 text-purple-400 border-purple-500/30",
  };
};

// ─── Catalogue ────────────────────────────────────────────────────────────────

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
    key: "next_visit_prompt",
    name: "Next Visit Prompt",
    category: "follow_up",
    icon: CalendarCheck,
    description: "Prompts recent clients to lock in their next appointment before they go cold.",
    defaultMessage: "Thanks again for visiting {{business}}. Want to get your next appointment on the calendar now?",
    configFields: [
      { key: "delayDays", label: "Send after visit", type: "number", unit: "days", placeholder: "3", defaultValue: 3 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Thanks again for visiting {{business}}. Want to get your next appointment on the calendar now?" },
    ],
    planRequired: "growth",
    recommended: true,
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
    key: "vip_winback_45d",
    name: "VIP Win-Back (45 Days)",
    category: "reactivation",
    icon: Star,
    description: "Reactivates your highest-value clients before they fully lapse.",
    defaultMessage: "Hi {{name}}, we've missed you at {{business}}. Want priority booking for your next visit? Reply VIP.",
    configFields: [
      { key: "delayDays", label: "Days since last visit", type: "number", unit: "days", placeholder: "45", defaultValue: 45 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Hi {{name}}, we've missed you at {{business}}. Want priority booking for your next visit? Reply VIP." },
    ],
    planRequired: "scale",
  },
  {
    key: "vip_winback_90d",
    name: "VIP Win-Back (90 Days)",
    category: "reactivation",
    icon: Gift,
    description: "A stronger comeback ask for VIP clients who have stayed away longer.",
    defaultMessage: "We've saved a special comeback offer for you at {{business}}. Reply YES if you want first pick of availability.",
    configFields: [
      { key: "delayDays", label: "Days since last visit", type: "number", unit: "days", placeholder: "90", defaultValue: 90 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "We've saved a special comeback offer for you at {{business}}. Reply YES if you want first pick of availability." },
    ],
    planRequired: "scale",
    recommended: true,
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
    key: "qualified_followup_1d",
    name: "Qualified Follow-Up (1 Day)",
    category: "follow_up",
    icon: MessageSquare,
    description: "Checks back with qualified leads who still have not booked.",
    defaultMessage: "Hi {{name}}, just checking in from {{business}}. Want me to help you grab a time?",
    configFields: [
      { key: "delayDays", label: "Days after qualification", type: "number", unit: "days", placeholder: "1", defaultValue: 1 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Hi {{name}}, just checking in from {{business}}. Want me to help you grab a time?" },
    ],
    planRequired: "starter",
  },
  {
    key: "qualified_followup_3d",
    name: "Qualified Follow-Up (3 Days)",
    category: "follow_up",
    icon: RefreshCw,
    description: "Second touch for qualified leads still sitting without an appointment.",
    defaultMessage: "Still interested in booking with {{business}}? Reply YES and we'll help you lock in a spot.",
    configFields: [
      { key: "delayDays", label: "Days after qualification", type: "number", unit: "days", placeholder: "3", defaultValue: 3 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Still interested in booking with {{business}}? Reply YES and we'll help you lock in a spot." },
    ],
    planRequired: "starter",
  },
  {
    key: "inbound_response_sla",
    name: "Inbound Auto-Reply",
    category: "follow_up",
    icon: Bell,
    description: "Automatically acknowledges inbound messages if staff have not replied fast enough.",
    defaultMessage: "Thanks for reaching out to {{business}}. We got your message and will text you back shortly.",
    configFields: [
      { key: "delayMinutes", label: "Reply after", type: "number", unit: "minutes", placeholder: "10", defaultValue: 10 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "Thanks for reaching out to {{business}}. We got your message and will text you back shortly." },
    ],
    planRequired: "starter",
    recommended: true,
  },
  {
    key: "delivery_failure_retry",
    name: "Delivery Failure Recovery",
    category: "follow_up",
    icon: AlertTriangle,
    description: "Retries or recovers conversations when an outbound SMS fails.",
    defaultMessage: "We had trouble reaching you earlier. If you still want to book with {{business}}, reply here and we'll help.",
    configFields: [
      { key: "delayMinutes", label: "Retry after", type: "number", unit: "minutes", placeholder: "15", defaultValue: 15 },
      { key: "message", label: "Message", type: "textarea", defaultValue: "We had trouble reaching you earlier. If you still want to book with {{business}}, reply here and we'll help." },
    ],
    planRequired: "starter",
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Automations() {
  const { t } = useLocale();
  const { context, trackFeatureUsage } = useProgressiveDisclosureContext();
  const { user } = useAuth();
  const { data: tenant } = trpc.tenant.get.useQuery();
  
  // Dynamic hooks for user-adaptive automation system
  const dynamicTemplates = useDynamicAutomationTemplates();
  const dynamicRecommendations = useDynamicAutomationRecommendations();
  const getAutomationConfig = useDynamicAutomationConfig();
  const predictSuccess = useDynamicAutomationSuccessPrediction();
  
  // Get dynamic data
  const catalogue = getDynamicAutomationCatalogue(context.userSkill, tenant?.industry);
  const categories = getDynamicCategories(catalogue);
  const categoryConfig = getDynamicCategoryConfig();
  
  const utils = trpc.useUtils();
  const [activeCategory, setActiveCategory] = useState<AutomationCategory | "all">("all");
  const [configTarget, setConfigTarget] = useState<AutomationKey | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const templatesQuery = trpc.automations.catalog.useQuery();
  const activateTemplate = trpc.automations.activateTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template automation created");
      setShowTemplatePicker(false);
      utils.automations.list.invalidate();
      trackFeatureUsage('automation_template_activated');
    },
    onError: (err) => {
      toast.error(err.message);
      trackFeatureUsage('automation_activation_error');
    },
  });

  const { data: savedList = [] } = trpc.automations.list.useQuery(undefined, { retry: false });

  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const toggleMutation = trpc.automations.toggleByKey.useMutation({
    onSuccess: () => {
      utils.automations.list.invalidate();
      setTogglingKey(null);
      trackFeatureUsage('automation_toggled');
    },
    onError: (err) => {
      toast.error(err.message);
      setTogglingKey(null);
      trackFeatureUsage('automation_toggle_error');
    },
  });

  const configureMutation = trpc.automations.configureByKey.useMutation({
    onSuccess: () => {
      toast.success("Automation configured");
      utils.automations.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  type SavedItem = { id?: number; key: string; enabled: boolean; runCount: number; errorCount?: number; lastRunAt?: Date | string; triggerConfig?: Record<string, unknown> };
  const savedMap: Record<string, SavedItem> = {};
  for (const s of savedList as SavedItem[]) {
    if (s.key) savedMap[s.key] = s;
  }

  const filtered = CATALOGUE.filter((t) => activeCategory === "all" || t.category === activeCategory);
  const enabledCount = CATALOGUE.filter((t) => savedMap[t.key]?.enabled).length;
  const configTemplate = configTarget ? CATALOGUE.find((t) => t.key === configTarget) : null;

  const configuredCount = CATALOGUE.filter((t) => savedMap[t.key]?.triggerConfig).length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-4xl mx-auto">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('automationsPage.title')}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {enabledCount} active · {configuredCount} configured · {CATALOGUE.length} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowTemplatePicker(true)}>Create automation</Button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>When this happens → Then do this</span>
            </div>
          </div>
        </div>

        {/* Getting started banner — only shown when nothing is enabled */}
        {enabledCount === 0 && (
          <div className="border border-primary/20 bg-primary/5 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">No automations active yet</p>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  Start with recommended automations for your skill level. Each takes under a minute to configure.
                </p>
                <div className="flex flex-wrap gap-2">
                  {dynamicRecommendations.slice(0, 3).map((rec, index) => {
                    const template = dynamicTemplates.find(t => 
                      rec.automationKeys.includes(t.key)
                    );
                    if (!template) return null;
                    return (
                      <button
                        key={rec.automationKeys[0]}
                        onClick={() => setConfigTarget(rec.automationKeys[0] as AutomationKey)}
                        className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all font-medium"
                      >
                        {template.name} →
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

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
                {label} <span className="opacity-60 ml-1">{count}</span>
              </button>
            );
          })}
        </div>

        {showTemplatePicker && (
          <div className="border border-primary/20 bg-primary/5 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-medium">Choose a template</p>
              <Button variant="ghost" size="sm" onClick={() => setShowTemplatePicker(false)}>Close</Button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {templatesQuery.isLoading && <p className="text-sm text-muted-foreground">Loading templates...</p>}
              {templatesQuery.data?.map((tpl) => (
                <button
                  key={tpl.key}
                  className="text-left p-2 bg-white/80 rounded border border-border hover:border-primary"
                  onClick={() => activateTemplate.mutate({ templateKey: tpl.key })}
                >
                  <p className="font-medium">{tpl.name}</p>
                  <p className="text-[11px] text-muted-foreground">Trigger {tpl.trigger}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((template) => {
            const saved = savedMap[template.key];
            return (
              <AutomationRow
                key={template.key}
                template={template}
                saved={saved ? {
                  enabled: saved.enabled,
                  runCount: saved.runCount,
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
          })}
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
