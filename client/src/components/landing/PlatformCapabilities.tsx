import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  MessageSquare, Bot, Moon, Clock, ShieldCheck,
  Zap, UserX, XCircle, ListChecks, CreditCard,
  CalendarSearch, Heart, MousePointerClick, Flame, Star,
  BarChart3, Activity, Phone, Workflow,
  Upload, Calendar, Sparkles,
} from "lucide-react";
import { fadeInUp, staggerContainer } from "@/lib/animations";
import { AUTOMATION_COUNT } from "@/data/automations";

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  bg: string;
}

interface Tab {
  key: string;
  label: string;
  emoji: string;
  features: Feature[];
}

const TABS: Tab[] = [
  {
    key: "communicate",
    label: "Stay Connected",
    emoji: "💬",
    features: [
      { icon: MessageSquare, title: "Two-Way SMS Inbox", description: "All your client conversations in one place. Reply manually or let automations handle it.", color: "text-info", bg: "bg-info/10" },
      { icon: Bot, title: "AI Message Writer", description: "Rewrite any SMS in the perfect tone — friendly, professional, or urgent — with one click.", color: "text-primary", bg: "bg-primary/10" },
      { icon: Moon, title: "After-Hours Auto-Reply", description: "Someone texts at 2am? They get an instant, helpful reply until you're back.", color: "text-accent-foreground", bg: "bg-accent/10" },
      { icon: Clock, title: "Smart Send Times", description: "AI picks the best time to text each client based on when they actually respond.", color: "text-warning", bg: "bg-warning/10" },
      { icon: ShieldCheck, title: "TCPA Compliance Built-In", description: "Quiet hours, consent tracking, and frequency limits — all handled for you.", color: "text-success", bg: "bg-success/10" },
    ],
  },
  {
    key: "recover",
    label: "Recover Revenue",
    emoji: "💰",
    features: [
      { icon: Zap, title: `${AUTOMATION_COUNT} Ready-Made Automations`, description: "Turn on pre-built workflows for every scenario — reminders, follow-ups, win-backs. No setup needed.", color: "text-primary", bg: "bg-primary/10" },
      { icon: UserX, title: "No-Show Recovery", description: "Caring follow-ups that bring missed clients back. Most rebook within 3 days.", color: "text-destructive", bg: "bg-destructive/10" },
      { icon: XCircle, title: "Cancellation Recovery", description: "Acknowledge the cancel, then gently nudge them back. 55% rebook rate.", color: "text-warning", bg: "bg-warning/10" },
      { icon: ListChecks, title: "Waitlist Fill", description: "Slot just opened up? Your waitlisted clients get texted instantly.", color: "text-info", bg: "bg-info/10" },
      { icon: CreditCard, title: "Payment Enforcement", description: "Card-on-file, cancellation fees, and prepaid discounts. Cuts no-shows from 20% to ~5%.", color: "text-success", bg: "bg-success/10" },
    ],
  },
  {
    key: "grow",
    label: "Grow & Keep Clients",
    emoji: "🌱",
    features: [
      { icon: CalendarSearch, title: "Smart Scheduling", description: "Auto-detects gaps in your calendar and fills them. 5-15% more utilization.", color: "text-info", bg: "bg-info/10" },
      { icon: Heart, title: "Retention Engine", description: "Loyalty tiers, rebooking nudges, and reactivation campaigns. 10-25% retention boost.", color: "text-destructive", bg: "bg-destructive/10" },
      { icon: MousePointerClick, title: "One-Click Booking", description: "Send booking links via SMS. Clients tap once and they're booked.", color: "text-primary", bg: "bg-primary/10" },
      { icon: Flame, title: "Lead Scoring", description: "Every lead is scored automatically — cold, warm, hot, or VIP — based on their engagement.", color: "text-warning", bg: "bg-warning/10" },
      { icon: Star, title: "Review Requests", description: "Automatically ask happy clients for reviews after their appointment.", color: "text-success", bg: "bg-success/10" },
    ],
  },
  {
    key: "intelligence",
    label: "See What's Working",
    emoji: "📊",
    features: [
      { icon: BarChart3, title: "Real-Time Dashboard", description: "Live metrics — revenue, bookings, no-show rates, message delivery — updated every 30 seconds.", color: "text-success", bg: "bg-success/10" },
      { icon: Activity, title: "Revenue Attribution", description: "Track every recovered dollar end-to-end: from SMS sent, to rebooked, to revenue realized.", color: "text-primary", bg: "bg-primary/10" },
      { icon: Phone, title: "Call Tracking", description: "Auto-log inbound calls, match callers to leads, record and transcribe conversations.", color: "text-info", bg: "bg-info/10" },
      { icon: Workflow, title: "Advanced Workflows", description: "Connect to n8n for complex multi-step automations. Trigger anything from any event.", color: "text-accent-foreground", bg: "bg-accent/10" },
    ],
  },
  {
    key: "onboard",
    label: "Get Started Fast",
    emoji: "🚀",
    features: [
      { icon: Upload, title: "Contact Import", description: "Bring your clients from CSV, vCard, Google Contacts, Square, Vagaro, Booksy, or Fresha.", color: "text-info", bg: "bg-info/10" },
      { icon: Calendar, title: "Calendar Sync", description: "Connect Google Calendar in one click. Appointments sync automatically.", color: "text-primary", bg: "bg-primary/10" },
      { icon: Sparkles, title: "AI Assistant", description: "Got a question? Ask the built-in AI assistant. It knows the platform inside-out.", color: "text-warning", bg: "bg-warning/10" },
    ],
  },
];

export function PlatformCapabilities() {
  const [activeTab, setActiveTab] = useState("communicate");
  const activeTabData = TABS.find((t) => t.key === activeTab)!;

  return (
    <section id="features" className="py-20 px-6 border-t border-border/30">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Everything you need to <span className="text-primary">recover revenue</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Not just reminders — a complete platform for communication, recovery, growth, and analytics. All built for appointment businesses.
          </p>
        </motion.div>

        {/* Tab buttons */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-2 mb-10"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <motion.div
              className={`grid gap-4 ${activeTabData.features.length <= 3 ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-3"}`}
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              {activeTabData.features.map((f) => (
                <motion.div
                  key={f.title}
                  variants={fadeInUp}
                  className="group flex gap-4 p-5 rounded-2xl border border-border bg-card hover:border-primary/20 hover:shadow-sm transition-all"
                >
                  <div className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                    <f.icon className={`w-5 h-5 ${f.color}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
