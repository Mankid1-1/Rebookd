import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { ArrowRight, Bot, BarChart3, MessageSquare, Zap, CheckCircle, Star, Bell, UserX, XCircle, Gift, ThumbsUp, RotateCcw, Calendar, Clock, Mail, Heart, TrendingUp, Shield, Users, DollarSign, Activity, Share2, Palette } from "lucide-react";
import { RebookedLogo, RebookedIcon } from "@/components/RebookedLogo";
import { useLocation } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useProgressiveDisclosureContext } from "@/components/ui/ProgressiveDisclosure";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useTheme, THEME_META, type ThemeName } from "@/contexts/ThemeContext";
import { INDUSTRIES } from "@/data/industries";

// ─── ALL 29 AUTOMATIONS (matches CATALOGUE in Automations.tsx) ─────────────
const ALL_AUTOMATIONS = [
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
] as const;

const AUTOMATION_COUNT = ALL_AUTOMATIONS.length; // 29

// Category badge styles
const catStyles: Record<string, string> = {
  appointment:    "bg-success/15 text-success border-success/30",
  "no-show":      "bg-destructive/15 text-destructive border-destructive/30",
  cancellation:   "bg-warning/15 text-warning-foreground border-warning/30",
  "follow-up":    "bg-primary/15 text-primary border-primary/30",
  "re-engagement":"bg-accent/15 text-accent-foreground border-accent/30",
  welcome:        "bg-info/15 text-info border-info/30",
  loyalty:        "bg-primary/15 text-primary border-primary/30",
  "lead-capture": "bg-info/15 text-info border-info/30",
};

// ─── ROI CALCULATOR ────────────────────────────────────────────────────────
function ROICalculator({ planPrice, revenueShare, planName }: { planPrice: number; revenueShare: number; planName: string }) {
  const [avgValue, setAvgValue] = useState(80);
  const [monthlyNoShows, setMonthlyNoShows] = useState(20);
  const [monthlyCancellations, setMonthlyCancellations] = useState(15);

  const calc = useMemo(() => {
    const noShowRecoveryRate = 0.40;
    const cancellationRecoveryRate = 0.55;
    const recoveredNoShows = Math.round(monthlyNoShows * noShowRecoveryRate);
    const recoveredCancellations = Math.round(monthlyCancellations * cancellationRecoveryRate);
    const totalRecovered = recoveredNoShows + recoveredCancellations;
    const grossRecovery = totalRecovered * avgValue;
    const platformFee = planPrice;
    const revShareFee = Math.round(grossRecovery * (revenueShare / 100));
    const totalCost = platformFee + revShareFee;
    const netProfit = grossRecovery - totalCost;
    const roi = totalCost > 0 ? Math.round((netProfit / totalCost) * 100) : 0;
    return { recoveredNoShows, recoveredCancellations, totalRecovered, grossRecovery, platformFee, revShareFee, totalCost, netProfit, roi };
  }, [avgValue, monthlyNoShows, monthlyCancellations, planPrice, revenueShare]);

  return (
    <div className="mt-6 p-4 rounded-xl border border-border bg-background/50 text-left">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        <TrendingUp className="w-3 h-3 inline mr-1" /> ROI Calculator — {planName}
      </p>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Avg appointment value ($)</label>
          <input type="range" min={20} max={500} step={5} value={avgValue} onChange={e => setAvgValue(+e.target.value)} className="w-full accent-[var(--success)] h-1.5" />
          <span className="text-xs font-semibold text-success">${avgValue}</span>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Monthly no-shows</label>
          <input type="range" min={0} max={100} value={monthlyNoShows} onChange={e => setMonthlyNoShows(+e.target.value)} className="w-full accent-[var(--success)] h-1.5" />
          <span className="text-xs font-semibold text-success">{monthlyNoShows}</span>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Monthly cancellations</label>
          <input type="range" min={0} max={100} value={monthlyCancellations} onChange={e => setMonthlyCancellations(+e.target.value)} className="w-full accent-[var(--success)] h-1.5" />
          <span className="text-xs font-semibold text-success">{monthlyCancellations}</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded-lg bg-success/5 border border-success/10">
          <p className="text-muted-foreground">Recovered</p>
          <p className="text-lg font-bold text-success">${calc.grossRecovery.toLocaleString()}<span className="text-xs font-normal">/mo</span></p>
          <p className="text-muted-foreground">{calc.totalRecovered} appointments</p>
        </div>
        <div className="p-2 rounded-lg bg-success/5 border border-success/10">
          <p className="text-muted-foreground">Your net profit</p>
          <p className={`text-lg font-bold ${calc.netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>${calc.netProfit.toLocaleString()}<span className="text-xs font-normal">/mo</span></p>
          <p className="text-muted-foreground">{calc.roi}% ROI</p>
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>Platform: ${calc.platformFee}/mo</span>
        <span>Rev share ({revenueShare}%): ${calc.revShareFee}/mo</span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground text-center">Based on 40% no-show recovery &amp; 55% cancellation rebook rates</p>
    </div>
  );
}

// ─── FLEX FOUNDERS SLIDER ──────────────────────────────────────────────────
function FlexFoundersSlider({ flexSlotsUsed }: { flexSlotsUsed: number }) {
  const [avgValue, setAvgValue] = useState(80);
  const [monthlyNoShows, setMonthlyNoShows] = useState(15);

  const calc = useMemo(() => {
    const recoveryRate = 0.40;
    const recovered = Math.round(monthlyNoShows * recoveryRate);
    const gross = recovered * avgValue;
    // Flex: slider-based pricing from $29–$149 based on estimated recovery
    const basePrice = Math.min(149, Math.max(29, Math.round(gross * 0.12)));
    const revShare = Math.round(gross * 0.20);
    const totalCost = basePrice + revShare;
    const netProfit = gross - totalCost;
    return { recovered, gross, basePrice, revShare, totalCost, netProfit, roi: totalCost > 0 ? Math.round((netProfit / totalCost) * 100) : 0 };
  }, [avgValue, monthlyNoShows]);

  return (
    <div className="mt-4 p-4 rounded-xl border border-border bg-background/50 text-left">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        <TrendingUp className="w-3 h-3 inline mr-1" /> Your ROI — Guaranteed
      </p>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Avg appointment value ($)</label>
          <input type="range" min={20} max={500} step={5} value={avgValue} onChange={e => setAvgValue(+e.target.value)} className="w-full accent-[var(--success)] h-1.5" />
          <span className="text-xs font-semibold text-success">${avgValue}</span>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Monthly missed appointments</label>
          <input type="range" min={0} max={80} value={monthlyNoShows} onChange={e => setMonthlyNoShows(+e.target.value)} className="w-full accent-[var(--success)] h-1.5" />
          <span className="text-xs font-semibold text-success">{monthlyNoShows}</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded-lg bg-success/10 border border-success/20">
          <p className="text-muted-foreground">You recover</p>
          <p className="text-lg font-bold text-success">${calc.gross.toLocaleString()}/mo</p>
        </div>
        <div className="p-2 rounded-lg bg-success/10 border border-success/20">
          <p className="text-muted-foreground">Your profit</p>
          <p className="text-lg font-bold text-success">${calc.netProfit.toLocaleString()}/mo</p>
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>Your cost: ${calc.basePrice} + 20% share = ${calc.totalCost}/mo</span>
        <span className="text-success font-semibold">{calc.roi}% ROI</span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground text-center">
        If ROI isn't visible in 35 days, you pay nothing. Guaranteed.
      </p>
    </div>
  );
}

// ─── FEATURES ──────────────────────────────────────────────────────────────
const features = [
  { icon: Bot,            title: "AI-Powered Messaging",       description: "Rewrite every SMS in the perfect tone — friendly, professional, or urgent — automatically using built-in AI.", color: "text-accent-foreground", bg: "bg-accent/10" },
  { icon: MessageSquare,  title: "Two-Way Conversations",      description: "Manage all client SMS conversations in one inbox. Respond manually or let automations handle replies.", color: "text-primary", bg: "bg-primary/10" },
  { icon: BarChart3,      title: "Real-Time Revenue Analytics", description: "Track recovered revenue, booking rates, no-show rates, and re-engagement success — updated live.", color: "text-success", bg: "bg-success/10" },
  { icon: Zap,            title: `${AUTOMATION_COUNT} Ready-Made Automations`, description: "Enable pre-built workflows for reminders, no-shows, cancellations, win-backs and more. No setup required.", color: "text-warning", bg: "bg-warning/10" },
  { icon: Shield,         title: "ROI Guarantee",              description: "If you don't see a positive return within 35 days, you pay nothing. We only win when you do.", color: "text-primary", bg: "bg-primary/10" },
  { icon: Activity,       title: "Attribution Tracking",       description: "Every recovered appointment is tracked end-to-end — from SMS sent, to rebooked, to revenue realized.", color: "text-warning", bg: "bg-warning/10" },
];

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function Home() {
  const { user, loading } = useAuth();
  const { context } = useProgressiveDisclosureContext();
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const [showThemePicker, setShowThemePicker] = useState(false);

  // Live platform stats from DB
  const statsQuery = trpc.platformStats.live.useQuery(undefined, {
    refetchInterval: 30000,  // refresh every 30s for "aliveness"
    retry: false,
    staleTime: 10000,
  });

  const stats = statsQuery.data ?? {
    totalClients: 0,
    appointmentsRecovered: 0,
    revenueRecoveredCents: 0,
    founderSlotsUsed: 0,
    flexSlotsUsed: 0,
  };

  const founderSlotsRemaining = 20 - stats.founderSlotsUsed;
  const flexSlotsRemaining = 10 - stats.flexSlotsUsed;

  useEffect(() => {
    if (!loading && user) setLocation("/dashboard");
  }, [user, loading, setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <RebookedLogo size={32} />
          <div className="flex items-center gap-4">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block">Pricing</a>
            <a href="#referral" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block">Referral</a>
            {/* Theme picker */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowThemePicker((v) => !v); }}
                className="flex items-center justify-center h-8 w-8 rounded-md border border-border hover:bg-accent transition-colors"
                aria-label="Choose theme"
              >
                <Palette className="w-4 h-4 text-muted-foreground" />
              </button>
              {showThemePicker && (
                <>
                  <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setShowThemePicker(false)} />
                  <div className="absolute right-0 top-full mt-2 bg-popover border border-border rounded-lg shadow-xl p-3 w-48" style={{ zIndex: 9999 }}>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Choose Theme</p>
                    <div className="space-y-1">
                      {(Object.keys(THEME_META) as ThemeName[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => { setTheme(t); setShowThemePicker(false); }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${theme === t ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent text-foreground"}`}
                        >
                          <span className={`w-3 h-3 rounded-full border shrink-0 ${theme === t ? "border-primary" : "border-border"}`}
                            style={{ backgroundColor: t === "abyss" ? "#d4a843" : t === "light" ? "#3b7cf5" : t === "corporate" ? "#d44030" : t === "pink" ? "#d44090" : "#2a9060" }}
                          />
                          {THEME_META[t].label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setLocation(getLoginUrl())}>Sign in</Button>
            <Button size="sm" onClick={() => setLocation(getLoginUrl())}>Claim your spot <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Button>
          </div>
        </div>
      </nav>

      {/* Soft Launch Banner */}
      <div className="pt-16 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b border-primary/20">
        <div className="max-w-4xl mx-auto px-6 py-3 text-center">
          <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary text-xs">
            <Activity className="w-3 h-3 mr-1 animate-pulse" /> Soft Launch — Limited Founding Spots Available
          </Badge>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-12 pb-16 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-[1.1] tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Stop losing revenue to<br /><span className="text-primary">no-shows &amp; cancellations</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            Rebooked automatically sends the right SMS at the right time — appointment reminders, no-show follow-ups, cancellation recovery, and win-back campaigns. {AUTOMATION_COUNT} ready-made automations. Enable and go.
          </p>

          {/* Live Stats Bar */}
          <div className="flex items-center justify-center gap-8 mb-8 flex-wrap">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-primary" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {stats.totalClients.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Active Clients</p>
            </div>
            <div className="w-px h-8 bg-border hidden md:block" />
            <div className="text-center">
              <p className="text-2xl font-extrabold text-primary" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {stats.appointmentsRecovered.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Appointments Recovered</p>
            </div>
            <div className="w-px h-8 bg-border hidden md:block" />
            <div className="text-center">
              <p className="text-2xl font-extrabold text-primary" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                ${Math.round(stats.revenueRecoveredCents / 100).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Revenue Recovered</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button size="lg" className="h-12 px-8 text-base" onClick={() => setLocation(getLoginUrl())}>
              Claim your founding spot <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">No credit card required · ROI guaranteed or it's free</p>
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-accent/30 bg-accent/5">
            <Share2 className="w-3.5 h-3.5 text-accent-foreground" />
            <span className="text-xs text-accent-foreground">
              <a href="#referral" className="hover:text-accent-foreground transition-colors">
                <span className="font-semibold">Referral Program:</span> Earn $50/mo for 6 months per referral — <span className="underline">learn more</span>
              </a>
            </span>
          </div>
        </div>
      </section>

      {/* Industry Selector */}
      <section className="pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Built for <span className="text-primary">your</span> industry
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Every business is different. See how Rebooked works for yours — with tailored ROI numbers, pain points, and automations.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.values(INDUSTRIES).map((ind) => (
              <button
                key={ind.slug}
                onClick={() => setLocation(`/for/${ind.slug}`)}
                className="group flex items-center gap-3 p-4 rounded-xl border border-border bg-card/50 hover:border-primary/40 hover:bg-primary/5 transition-all text-left cursor-pointer"
              >
                <span className="text-2xl shrink-0">{ind.emoji}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{ind.namePlural}</p>
                  <p className="text-xs text-muted-foreground">Avg ${ind.avgAppointmentValue}/appt</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ALL Automations Strip */}
      <section className="pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs text-muted-foreground mb-5 uppercase tracking-widest">{AUTOMATION_COUNT} pre-built automations ready to enable</p>
          <TooltipProvider delayDuration={200}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {ALL_AUTOMATIONS.map(({ icon: Icon, label, cat, tip }) => (
                <Tooltip key={label}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-card/50 hover:bg-card hover:shadow-sm transition-all cursor-default">
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{label}</p>
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 mt-0.5 ${catStyles[cat] ?? ""}`}>{cat}</Badge>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-52 text-center">
                    <p className="text-xs">{tip}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Everything you need to recover revenue</h2>
            <p className="text-muted-foreground">Built specifically for appointment-based businesses — salons, clinics, gyms, spas, and more.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="flex gap-4 p-5 rounded-2xl border border-border bg-card">
                <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center shrink-0`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — Soft Launch Plans */}
      <section id="pricing" className="py-20 px-6 border-t border-border/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Soft Launch Pricing</h2>
            <p className="text-muted-foreground">Limited founding spots. ROI guaranteed or you pay nothing.</p>
          </div>
          {/* Soft Launch Trial Message */}
          <div className="mb-10 mx-auto max-w-3xl rounded-2xl border border-primary/20 bg-card p-6 text-center">
            <p className="text-sm leading-relaxed text-foreground">
              <span className="font-semibold">30-day free trial</span> — after 30 days services will be deactivated. You'll then have 5 days to decide whether you dig, like, or love the platform and want to start paying your plan price, or whether you'd like to continue being part of our soft launch trialling period because performance didn't add up.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              If you have any questions please don't hesitate to reach me at{" "}
              <a href="mailto:rebooked@rebooked.org" className="text-primary hover:underline font-medium">rebooked@rebooked.org</a> ❤️
            </p>
          </div>

          {/* Transparency Disclaimer */}
          <div className="mb-8 mx-auto max-w-3xl rounded-xl border-2 border-amber-400/40 bg-amber-50/10 px-6 py-4 text-center">
            <p className="text-sm font-semibold text-amber-300 tracking-wide uppercase mb-1">Transparency Notice</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Prices are only shown to be transparent — so if you do see a positive ROI, you understand the costs and how I came to calculate everything.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">

            {/* FLEX FOUNDERS — 0/10 */}
            <div className="relative p-6 rounded-2xl border bg-card border-success/20">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <Badge className="px-3 py-1 text-xs bg-primary text-primary-foreground border-primary">
                  {stats.flexSlotsUsed}/{10} spots taken
                </Badge>
              </div>
              <div className="mb-5">
                <h3 className="text-xl font-bold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Flex Founders</h3>
                <p className="text-xs text-muted-foreground mb-3">For solo practitioners ready to grow</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold">$29–$149</span>
                  <span className="text-muted-foreground text-sm">/mo</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Price scales with your recovery · 20% revenue share</p>
              </div>
              <ul className="space-y-2 mb-4">
                {[
                  `${AUTOMATION_COUNT} automations`,
                  "500 SMS/mo",
                  "1 user",
                  "Real-time analytics",
                  "20% revenue share",
                  "ROI guarantee — 35 days",
                  "Free if no positive ROI",
                  `${10 - stats.flexSlotsUsed} of 10 spots remaining`,
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-success" />{feat}
                  </li>
                ))}
              </ul>
              <FlexFoundersSlider flexSlotsUsed={stats.flexSlotsUsed} />
              <Button className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground border-primary" onClick={() => setLocation(getLoginUrl())} disabled={flexSlotsRemaining <= 0}>
                {flexSlotsRemaining > 0 ? "Claim Flex Spot" : "Sold Out"}
              </Button>
            </div>

            {/* PROFESSIONAL FOUNDERS — 0/20 · MOST POPULAR */}
            <div className="relative p-6 rounded-2xl border bg-card border-primary/20">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <Badge className="px-3 py-1 text-xs bg-primary text-primary-foreground border-primary">
                  <Star className="w-3 h-3 mr-1" /> Most Popular · {stats.founderSlotsUsed}/20 spots taken
                </Badge>
              </div>
              <div className="mb-5">
                <h3 className="text-xl font-bold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Professional Founders</h3>
                <p className="text-xs text-muted-foreground mb-3">For growing businesses · Best value</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold">$199</span>
                  <span className="text-muted-foreground text-sm">/mo</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">+ 15% of recovered revenue</p>
              </div>
              <ul className="space-y-2 mb-4">
                {[
                  "Unlimited automations",
                  "Unlimited SMS",
                  "5 users",
                  "Advanced analytics + attribution",
                  "15% revenue share",
                  "ROI guarantee — 35 days",
                  "Free if no positive ROI",
                  "Priority support",
                  `${20 - stats.founderSlotsUsed} of 20 spots remaining`,
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-success" />{feat}
                  </li>
                ))}
              </ul>
              <ROICalculator planPrice={199} revenueShare={15} planName="Professional" />
              <Button className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground border-primary" onClick={() => setLocation(getLoginUrl())} disabled={founderSlotsRemaining <= 0}>
                {founderSlotsRemaining > 0 ? "Claim Founding Spot" : "Sold Out"}
              </Button>
            </div>

            {/* ENTERPRISE */}
            <div className="relative p-6 rounded-2xl border bg-card border-primary/20">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <Badge className="px-3 py-1 text-xs bg-primary text-primary-foreground border-primary">
                  Enterprise
                </Badge>
              </div>
              <div className="mb-5 mt-2">
                <h3 className="text-xl font-bold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Enterprise</h3>
                <p className="text-xs text-muted-foreground mb-3">For multi-location teams</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold">Custom</span>
                </div>
              </div>
              <ul className="space-y-2 mb-6">
                {[
                  "Everything in Professional",
                  "Custom integrations",
                  "Dedicated account manager",
                  "SLA guarantee",
                  "Custom revenue share",
                  "White-label options",
                  "Unlimited users",
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-success" />{feat}
                  </li>
                ))}
              </ul>
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-primary" onClick={() => window.location.href = "mailto:rebooked@rebooked.org"}>
                Contact Us
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Guarantee Section */}
      <section className="py-16 px-6 border-t border-border/50">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            The Rebooked ROI Guarantee
          </h2>
          <p className="text-muted-foreground mb-6 leading-relaxed max-w-xl mx-auto">
            I believe in Rebooked so much that I'm putting my money where my mouth is.
            If you don't see a positive return on investment within 35 days, you don't pay a penny. No questions asked.
          </p>
          <div className="grid md:grid-cols-3 gap-4 text-left">
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="font-semibold text-sm mb-1">1. Sign up</p>
              <p className="text-xs text-muted-foreground">Pick a founding plan. No credit card needed to start.</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="font-semibold text-sm mb-1">2. Enable automations</p>
              <p className="text-xs text-muted-foreground">Turn on the SMS automations that fit your business. Takes 15 minutes.</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="font-semibold text-sm mb-1">3. See real ROI</p>
              <p className="text-xs text-muted-foreground">Track every recovered appointment and dollar in your live dashboard. If ROI isn't positive by day 35 — it's free.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Referral Program */}
      <section id="referral" className="py-16 px-6 border-t border-border/50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
            <Share2 className="w-8 h-8 text-accent-foreground" />
          </div>
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Earn $300 for every referral
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed max-w-xl mx-auto">
            Know a business that's losing revenue to no-shows? Refer them to Rebooked and earn <span className="text-foreground font-semibold">$50/month for 6 months</span> for every active referral. That's $300 per client, paid out monthly — no cap on referrals.
          </p>
          <div className="grid md:grid-cols-3 gap-4 text-left max-w-3xl mx-auto">
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
                <Share2 className="w-4 h-4 text-accent-foreground" />
              </div>
              <p className="font-semibold text-sm mb-1">1. Share your link</p>
              <p className="text-xs text-muted-foreground">Get a unique referral link from your dashboard and share it with other businesses.</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
                <Users className="w-4 h-4 text-accent-foreground" />
              </div>
              <p className="font-semibold text-sm mb-1">2. They subscribe</p>
              <p className="text-xs text-muted-foreground">Once your referral subscribes and stays active for 30 days, your payouts begin.</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
                <DollarSign className="w-4 h-4 text-accent-foreground" />
              </div>
              <p className="font-semibold text-sm mb-1">3. Get paid monthly</p>
              <p className="text-xs text-muted-foreground">Receive $50/month for 6 months per active referral. No limit on how many you can refer.</p>
            </div>
          </div>
          <div className="mt-8">
            <Button variant="outline" size="lg" onClick={() => setLocation(getLoginUrl())}>
              Start referring <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-border/50 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Ready to recover lost revenue?</h2>
          <p className="text-muted-foreground mb-8">Join appointment businesses using Rebooked to reduce no-shows, recover cancellations, and win back lapsed clients.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
            <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary">
              Flex Founders: {flexSlotsRemaining}/10 remaining
            </Badge>
            <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary">
              Professional Founders: {founderSlotsRemaining}/20 remaining
            </Badge>
          </div>
          <Button size="lg" className="h-12 px-8 text-base" onClick={() => setLocation(getLoginUrl())}>
            Claim your founding spot <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <p className="text-xs text-muted-foreground mt-4">No credit card required · ROI guaranteed within 35 days or it's free</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <RebookedLogo size={24} />
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
            <a href="mailto:rebooked@rebooked.org" className="hover:text-foreground transition-colors">Support</a>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <p className="text-xs text-muted-foreground">© 2026 Rebooked. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
