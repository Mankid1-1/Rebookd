/**
 * TechLevelGuide — a modal walkthrough tailored to the user's tech level.
 *
 * Shows after onboarding completes or when the user switches tech level.
 * Includes a "Don't show this again" checkbox. If unchecked, the prompt
 * reappears every time the tech level changes.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Zap,
  MessageSquare,
  BarChart3,
  Bot,
  Users,
  Calendar,
  Settings,
  Star,
  Shield,
  Layers,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Target,
  TrendingUp,
  Workflow,
  Code,
  Database,
  Globe,
  FileText,
} from "lucide-react";
import type { ReactNode } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

type SkillLevel = "basic" | "intermediate" | "advanced";

interface GuideStep {
  title: string;
  description: string;
  icon: ReactNode;
  highlights: Array<{
    label: string;
    description: string;
    path?: string;
  }>;
}

interface TechLevelGuideProps {
  open: boolean;
  onClose: () => void;
  level: SkillLevel;
  /** Called when user navigates to a page from the guide */
  onNavigate?: (path: string) => void;
}

// ─── Storage Keys ───────────────────────────────────────────────────────────

const SUPPRESS_KEY = "rebooked-guide-suppress";

/** Returns true if the user has opted out of future guides */
export function isGuideSuppressed(): boolean {
  return localStorage.getItem(SUPPRESS_KEY) === "true";
}

export function clearGuideSuppression(): void {
  localStorage.removeItem(SUPPRESS_KEY);
}

// ─── Guide Content Per Level ────────────────────────────────────────────────

const GUIDE_STEPS: Record<SkillLevel, GuideStep[]> = {
  basic: [
    {
      title: "Welcome to Your Dashboard",
      description:
        "This is your home base. You'll see how many leads you have, messages sent, and revenue recovered — all at a glance. No technical knowledge needed!",
      icon: <Sparkles className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "Stats Cards",
          description: "Your key numbers: leads, messages, bookings, and revenue recovered. Updated in real time.",
          path: "/dashboard",
        },
        {
          label: "Getting Started Checklist",
          description: "Follow the steps to set up your account — add a lead, send a message, and connect payments.",
          path: "/dashboard",
        },
      ],
    },
    {
      title: "Your Leads",
      description:
        "Leads are your potential and existing clients. When someone calls or texts, they show up here automatically. You can also add them manually.",
      icon: <Users className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "Lead List",
          description: "See all your contacts, their status, and when they last interacted with your business.",
          path: "/leads",
        },
        {
          label: "Conversations",
          description: "Click any lead to see their full SMS conversation and respond directly.",
          path: "/leads",
        },
      ],
    },
    {
      title: "Automations — Set It and Forget It",
      description:
        "Automations send messages on your behalf — reminders, follow-ups, and recovery texts. They're pre-built and ready to go. Just toggle them on!",
      icon: <Zap className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "Toggle On/Off",
          description: "Each automation has a simple switch. Turn it on and it runs automatically.",
          path: "/automations",
        },
        {
          label: "Pre-built Templates",
          description: "Missed call text-back, no-show recovery, booking reminders — all included and ready to use.",
          path: "/templates",
        },
      ],
    },
    {
      title: "Calendar & Scheduling",
      description:
        "Connect your calendar so Rebooked knows when appointments happen. This powers reminders, no-show detection, and rescheduling.",
      icon: <Calendar className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "Connect Calendar",
          description: "Link Google Calendar, Outlook, Calendly, or others in one click.",
          path: "/calendar-integration",
        },
        {
          label: "Automatic Sync",
          description: "Once connected, new bookings and cancellations sync automatically.",
          path: "/calendar-integration",
        },
      ],
    },
    {
      title: "Billing & Your ROI Guarantee",
      description:
        "Check your plan, usage, and the ROI guarantee. If Rebooked doesn't generate positive ROI within 35 days, it's free.",
      icon: <Star className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "Plan & Usage",
          description: "See your current plan, messages sent, and what's included.",
          path: "/billing",
        },
        {
          label: "ROI Tracker",
          description: "Track how much revenue Rebooked has recovered for you.",
          path: "/dashboard",
        },
      ],
    },
  ],

  intermediate: [
    {
      title: "Dashboard Deep Dive",
      description:
        "Beyond the basics — your dashboard shows revenue trends, conversion funnels, leakage alerts, and recovery campaigns. Use these to make smarter decisions.",
      icon: <TrendingUp className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "Revenue Charts",
          description: "Track recovered revenue over time with interactive area charts. Toggle between time periods.",
          path: "/dashboard",
        },
        {
          label: "Leakage Alerts",
          description: "Rebooked flags unconfirmed appointments, unbooked leads, and unrecovered cancellations for you.",
          path: "/dashboard",
        },
        {
          label: "Pipeline Funnel",
          description: "See how leads flow from New → Contacted → Qualified → Booked.",
          path: "/dashboard",
        },
      ],
    },
    {
      title: "Lead Management",
      description:
        "Filter, sort, and manage leads with more detail. Use tags, status updates, and the conversation timeline to stay organized.",
      icon: <Users className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "Search & Filter",
          description: "Find leads by name, phone, status, or date. Sort by most recent activity.",
          path: "/leads",
        },
        {
          label: "Lead Detail View",
          description: "Full conversation history, appointment data, and lead scoring in one place.",
          path: "/leads",
        },
        {
          label: "Bulk Actions",
          description: "Select multiple leads to send campaigns, update statuses, or export data.",
          path: "/leads",
        },
      ],
    },
    {
      title: "Automation Customization",
      description:
        "Customize when automations fire, edit message templates, and set up multi-step sequences. Each automation is fully configurable.",
      icon: <Workflow className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "Timing & Delays",
          description: "Control when messages send — instantly, after 5 minutes, next morning, etc.",
          path: "/automations",
        },
        {
          label: "Template Editor",
          description: "Edit the exact wording of every automated message. Use variables like {name} and {business}.",
          path: "/templates",
        },
        {
          label: "AI Message Rewriting",
          description: "Let AI optimize your messages for higher response rates.",
          path: "/automations",
        },
      ],
    },
    {
      title: "Analytics & Reporting",
      description:
        "Go beyond the dashboard with detailed analytics — conversion rates, message performance, and custom date ranges.",
      icon: <BarChart3 className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "Analytics Page",
          description: "Detailed breakdowns of revenue, lead conversion, and automation effectiveness.",
          path: "/analytics",
        },
        {
          label: "Custom Reports",
          description: "Generate reports for any date range in PDF, CSV, or JSON format.",
          path: "/analytics",
        },
      ],
    },
    {
      title: "Reviews & Referrals",
      description:
        "Automate review requests after successful appointments and earn referral income by sharing Rebooked.",
      icon: <MessageSquare className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "Review Requests",
          description: "Automatically ask happy clients for reviews after their appointment.",
          path: "/review-management",
        },
        {
          label: "Referral Program",
          description: "Earn $50/month for 6 months for every active business you refer.",
          path: "/referrals",
        },
      ],
    },
    {
      title: "Settings & Integrations",
      description:
        "Configure your business hours, connect SMS providers, and manage team access.",
      icon: <Settings className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "Business Settings",
          description: "Hours, timezone, closed dates, and TCPA compliance settings.",
          path: "/settings",
        },
        {
          label: "Integrations",
          description: "See connected services — SMS provider, calendar, Stripe, and more.",
          path: "/settings",
        },
      ],
    },
  ],

  advanced: [
    {
      title: "Platform Architecture",
      description:
        "Rebooked is a multi-tenant SaaS running Node.js + tRPC backend with React frontend. Understanding the architecture helps you get the most out of every feature.",
      icon: <Layers className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "Multi-Tenant Isolation",
          description: "Each business has isolated data. Tenant context is enforced at the database query level.",
          path: "/dashboard",
        },
        {
          label: "Real-Time Updates",
          description: "Dashboard polls every 30s, live stats every 10s. WebSocket support coming soon.",
          path: "/dashboard",
        },
        {
          label: "Sentinel System",
          description: "An autonomous monitoring agent that detects errors, theme issues, and can auto-repair code.",
          path: "/admin/system",
        },
      ],
    },
    {
      title: "Advanced Automation Engine",
      description:
        "Build complex automation workflows with conditions, delays, branching logic, and multi-step sequences. The visual builder gives you full control.",
      icon: <Code className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "Visual Automation Builder",
          description: "Drag-and-drop workflow editor with conditions, delays, and branching paths.",
          path: "/automations",
        },
        {
          label: "Conditions Engine",
          description: "Trigger automations based on lead status, time of day, appointment type, or custom rules.",
          path: "/automations",
        },
        {
          label: "A/B Testing",
          description: "Test different message variants and let the system pick the winner automatically.",
          path: "/templates",
        },
      ],
    },
    {
      title: "Revenue Analytics & Recovery",
      description:
        "Deep analytics on revenue leakage, recovery rates, and ROI. Understand exactly where money is being lost and how to recover it.",
      icon: <Target className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "Revenue Leakage Dashboard",
          description: "Pinpoints no-shows, cancellations, and unbooked leads with dollar values attached.",
          path: "/analytics",
        },
        {
          label: "Recovery Campaigns",
          description: "One-click campaigns targeting specific leakage types with optimized messaging.",
          path: "/dashboard",
        },
        {
          label: "Commission Tracking",
          description: "15% revenue share is tracked in real time. See exactly what generates ROI.",
          path: "/billing",
        },
      ],
    },
    {
      title: "API, Webhooks & Integrations",
      description:
        "Extend Rebooked with webhooks, API keys, calendar sync, and Stripe Connect. Full programmatic access to your data.",
      icon: <Globe className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "API Keys",
          description: "Generate API keys for programmatic access to leads, messages, and analytics.",
          path: "/settings",
        },
        {
          label: "Webhook Events",
          description: "Subscribe to lead.created, message.sent, booking.confirmed, and more.",
          path: "/settings",
        },
        {
          label: "Stripe Connect",
          description: "Full payment processing with deposit enforcement and automated billing.",
          path: "/stripe-connect",
        },
      ],
    },
    {
      title: "Admin & Compliance",
      description:
        "TCPA compliance, data encryption, audit logging, and platform administration. Everything needed for regulatory compliance.",
      icon: <Shield className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "TCPA Compliance",
          description: "Opt-in/opt-out tracking, quiet hours enforcement, and message frequency limits.",
          path: "/tcpa-compliance",
        },
        {
          label: "Data & Privacy",
          description: "Data encryption at rest, tenant isolation, and GDPR-ready data export.",
          path: "/settings",
        },
        {
          label: "Contact Import",
          description: "Bulk import leads from CSV with deduplication, validation, and TCPA consent tracking.",
          path: "/contact-import",
        },
      ],
    },
    {
      title: "Advanced Reporting",
      description:
        "Generate detailed reports with custom metrics, date ranges, and export formats. Perfect for stakeholder presentations and business reviews.",
      icon: <FileText className="w-5 h-5 text-primary" />,
      highlights: [
        {
          label: "Custom Reports",
          description: "Choose metrics, date ranges, and output format (PDF, CSV, JSON).",
          path: "/analytics",
        },
        {
          label: "Multi-Location",
          description: "Manage multiple business locations from a single account with per-location analytics.",
          path: "/settings",
        },
        {
          label: "Feature Flags",
          description: "Toggle advanced features on/off per tenant. Control rollout of new capabilities.",
          path: "/settings",
        },
      ],
    },
  ],
};

const LEVEL_META: Record<SkillLevel, { label: string; color: string; description: string }> = {
  basic: {
    label: "Basic",
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    description: "Simple, visual walkthroughs of the essential features",
  },
  intermediate: {
    label: "Intermediate",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    description: "Deeper exploration of customization, analytics, and integrations",
  },
  advanced: {
    label: "Advanced",
    color: "bg-purple-500/10 text-purple-500 border-purple-500/30",
    description: "Architecture, API access, compliance, and power-user features",
  },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function TechLevelGuide({ open, onClose, level, onNavigate }: TechLevelGuideProps) {
  const [step, setStep] = useState(0);
  const [suppressChecked, setSuppressChecked] = useState(false);

  const steps = GUIDE_STEPS[level];
  const meta = LEVEL_META[level];
  const currentStep = steps[step];
  const isLast = step === steps.length - 1;

  // Reset step when level or open state changes
  useEffect(() => {
    if (open) setStep(0);
  }, [open, level]);

  const handleClose = useCallback(() => {
    if (suppressChecked) {
      localStorage.setItem(SUPPRESS_KEY, "true");
    }
    onClose();
  }, [suppressChecked, onClose]);

  const handleNext = () => {
    if (isLast) {
      handleClose();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleNavigate = (path: string) => {
    handleClose();
    onNavigate?.(path);
  };

  if (!currentStep) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={meta.color}>
              {meta.label} Guide
            </Badge>
            <span className="text-xs text-muted-foreground">
              Step {step + 1} of {steps.length}
            </span>
          </div>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {currentStep.icon}
            {currentStep.title}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {currentStep.description}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex gap-1 my-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Highlights */}
        <div className="space-y-3 my-3">
          {currentStep.highlights.map((h, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{h.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{h.description}</p>
              </div>
              {h.path && onNavigate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2 flex-shrink-0"
                  onClick={() => handleNavigate(h.path!)}
                >
                  Go <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Checkbox
              id="suppress-guide"
              checked={suppressChecked}
              onCheckedChange={(checked) => setSuppressChecked(checked === true)}
            />
            <label htmlFor="suppress-guide" className="text-xs text-muted-foreground cursor-pointer select-none">
              Don't show this again
            </label>
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={handlePrev}>
                <ArrowLeft className="w-3 h-3 mr-1" /> Back
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {isLast ? "Finish" : "Next"}
              {!isLast && <ArrowRight className="w-3 h-3 ml-1" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Prompt Component ───────────────────────────────────────────────────────

interface GuidePromptProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
  level: SkillLevel;
}

/**
 * Small dialog asking if the user wants a tour after switching tech level.
 */
export function GuidePrompt({ open, onAccept, onDecline, level }: GuidePromptProps) {
  const [suppressChecked, setSuppressChecked] = useState(false);
  const meta = LEVEL_META[level];

  const handleDecline = () => {
    if (suppressChecked) {
      localStorage.setItem(SUPPRESS_KEY, "true");
    }
    onDecline();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDecline()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Take a guided tour?</DialogTitle>
          <DialogDescription className="text-sm">
            You switched to{" "}
            <Badge variant="outline" className={`${meta.color} mx-1`}>
              {meta.label}
            </Badge>{" "}
            mode. Would you like a quick walkthrough of the features available at this level?
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{meta.description}</p>
        <div className="flex items-center justify-between pt-3 border-t border-border mt-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="suppress-prompt"
              checked={suppressChecked}
              onCheckedChange={(checked) => setSuppressChecked(checked === true)}
            />
            <label htmlFor="suppress-prompt" className="text-xs text-muted-foreground cursor-pointer select-none">
              Don't show this again
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleDecline}>
              Skip
            </Button>
            <Button size="sm" onClick={onAccept}>
              Show Guide
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
