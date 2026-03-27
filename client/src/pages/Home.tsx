import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight, Zap, CheckCircle, Star, Shield,
  Bell, UserX, XCircle, Gift, ThumbsUp, RotateCcw,
  MessageSquare, BarChart3, Bot, Calendar, Clock,
  Users, CreditCard, Phone, Send, Heart, Award,
  TrendingUp, DollarSign, Target,
  CalendarCheck, ListChecks, StarHalf, Building2
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

const automationCategories = [
  {
    label: "Appointments",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    items: [
      { icon: Bell, name: "24hr Reminder" },
      { icon: Clock, name: "2hr Reminder" },
      { icon: CheckCircle, name: "Booking Confirmation" },
      { icon: CalendarCheck, name: "Auto-Reschedule" },
    ],
  },
  {
    label: "Recovery",
    color: "bg-red-500/15 text-red-400 border-red-500/30",
    items: [
      { icon: UserX, name: "No-Show Follow-Up" },
      { icon: XCircle, name: "Cancellation Rebook" },
      { icon: ListChecks, name: "Waiting List Flurry" },
      { icon: CreditCard, name: "Payment Enforcement" },
    ],
  },
  {
    label: "Growth",
    color: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    items: [
      { icon: Gift, name: "30-Day Win-Back" },
      { icon: RotateCcw, name: "90-Day Win-Back" },
      { icon: Heart, name: "Birthday Promo" },
      { icon: Award, name: "Loyalty Milestone" },
    ],
  },
  {
    label: "Engagement",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    items: [
      { icon: Send, name: "New Lead Welcome" },
      { icon: ThumbsUp, name: "Post-Visit Feedback" },
      { icon: TrendingUp, name: "Post-Visit Upsell" },
      { icon: StarHalf, name: "Review Request" },
    ],
  },
  {
    label: "Follow-Up",
    color: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    items: [
      { icon: Phone, name: "3-Day Lead Nurture" },
      { icon: MessageSquare, name: "7-Day Lead Nurture" },
      { icon: Calendar, name: "Calendar Sync" },
    ],
  },
];

const featureList = [
  {
    icon: Zap,
    title: "19 Pre-Built Automations",
    description: "Every revenue-recovery workflow you need — reminders, no-show follow-ups, cancellation rebooks, win-backs, review requests, and more. Just toggle on.",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  {
    icon: Bot,
    title: "AI-Powered Messaging",
    description: "Every SMS is rewritten in the perfect tone — friendly, professional, or urgent — using built-in AI that adapts to your business voice.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    icon: Calendar,
    title: "Calendar Integration",
    description: "Sync with Google Calendar, Outlook, or Calendly. Automations trigger based on real appointment data — no manual entry needed.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: Users,
    title: "Waiting List & Flurry SMS",
    description: "When a client cancels, Rebooked instantly texts your waiting list to fill the slot. Turn cancellations into same-day bookings.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    icon: StarHalf,
    title: "Automated Review Requests",
    description: "After a successful visit, automatically ask happy clients for a Google or Yelp review. Build your reputation on autopilot.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: BarChart3,
    title: "Revenue Analytics",
    description: "Track recovered revenue, booking rates, no-show trends, and ROI in real time. Know exactly what Rebooked is earning you.",
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  {
    icon: MessageSquare,
    title: "Two-Way SMS Inbox",
    description: "Manage all client conversations in one place. Reply manually or let automations handle it. Full conversation history per lead.",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    icon: Clock,
    title: "After-Hours Auto-Reply",
    description: "Never miss a lead outside business hours. Rebooked responds instantly with booking links and captures interest until you're back.",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
  {
    icon: Target,
    title: "Smart Scheduling",
    description: "AI analyzes your booking patterns and optimizes send times for maximum response rates. Fill gaps in your calendar automatically.",
    color: "text-teal-400",
    bg: "bg-teal-500/10",
  },
  {
    icon: Gift,
    title: "Referral Program",
    description: "Refer other businesses and earn $50/month for 6 months per active referral. Share your link and grow together.",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
];

const steps = [
  { step: "1", title: "Connect your calendar", description: "Link Google Calendar, Outlook, or Calendly in under 2 minutes." },
  { step: "2", title: "Toggle on automations", description: "Pick from 19 pre-built workflows. Customize messages or use our AI-written defaults." },
  { step: "3", title: "Watch revenue recover", description: "Rebooked handles the rest — reminders, follow-ups, rebooking, reviews, and waiting list fills." },
];

// Plan display config keyed by slug
const planMeta: Record<string, { popular?: boolean; highlight?: string; cta: string }> = {
  starter: { cta: "Start free trial" },
  growth: { cta: "Start free trial" },
  professional: { popular: true, cta: "Start free trial" },
  scale: { cta: "Contact sales" },
  flex: { highlight: "Limited — first 10 only", cta: "Claim your spot" },
};

function formatPrice(cents: number) {
  return `$${Math.round(cents / 100)}`;
}

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: plans } = trpc.plans.list.useQuery();
  const { data: stats } = trpc.platformStats.get.useQuery();

  useEffect(() => {
    if (!loading && user) setLocation("/dashboard");
  }, [user, loading, setLocation]);

  const goSignup = () => setLocation(getLoginUrl());

  // Filter to the plans we want to show and sort by price
  const displayPlans = (plans ?? [])
    .filter((p: any) => ["starter", "growth", "professional", "flex"].includes(p.slug))
    .sort((a: any, b: any) => a.priceMonthly - b.priceMonthly);

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Rebooked</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block">Features</a>
            <a href="#automations" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block">Automations</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block">Pricing</a>
            <Button variant="outline" size="sm" onClick={goSignup}>Sign in</Button>
            <Button size="sm" onClick={goSignup}>Start free trial <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge variant="outline" className="mb-6 px-3 py-1.5 text-xs bg-primary/5 border-primary/20 text-primary">
            <Shield className="w-3 h-3 mr-1.5" /> ROI Guarantee — free if you don't profit
          </Badge>
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-[1.1] tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Turn no-shows into<br /><span className="text-primary">recovered revenue</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            19 SMS automations that fill cancellations from your waiting list, chase no-shows, send reminders, request reviews, and win back lapsed clients. Connect your calendar and go.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap mb-12">
            <Button size="lg" className="h-12 px-8 text-base" onClick={goSignup}>
              Start your free trial <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <p className="text-sm text-muted-foreground">14-day free trial · No credit card required</p>
          </div>

          {/* Live platform stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="p-4 rounded-xl border border-border bg-card/50">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-primary" />
                <p className="text-2xl font-bold text-primary">{stats?.businesses ?? 0}</p>
              </div>
              <p className="text-xs text-muted-foreground">businesses on Rebooked</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card/50">
              <div className="flex items-center justify-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <p className="text-2xl font-bold text-blue-400">{(stats?.messagesSent ?? 0).toLocaleString()}</p>
              </div>
              <p className="text-xs text-muted-foreground">SMS messages sent</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card/50">
              <div className="flex items-center justify-center gap-2 mb-1">
                <CalendarCheck className="w-4 h-4 text-green-400" />
                <p className="text-2xl font-bold text-green-400">{stats?.appointmentsRecovered ?? 0}</p>
              </div>
              <p className="text-xs text-muted-foreground">appointments recovered</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card/50">
              <div className="flex items-center justify-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <p className="text-2xl font-bold text-emerald-400">${(stats?.revenueRecovered ?? 0).toLocaleString()}</p>
              </div>
              <p className="text-xs text-muted-foreground">revenue recovered</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 border-t border-border/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Up and running in 3 steps</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-lg font-bold text-primary">{s.step}</span>
                </div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Automations grid */}
      <section id="automations" className="py-20 px-6 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>19 automations, ready to go</h2>
            <p className="text-muted-foreground">Every workflow an appointment business needs. Toggle on, customize the message, done.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {automationCategories.map((cat) => (
              <div key={cat.label} className="p-5 rounded-2xl border border-border bg-card">
                <Badge variant="outline" className={`text-[11px] mb-4 ${cat.color}`}>{cat.label}</Badge>
                <ul className="space-y-3">
                  {cat.items.map(({ icon: Icon, name }) => (
                    <li key={name} className="flex items-center gap-3 text-sm">
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Everything you need to recover revenue</h2>
            <p className="text-muted-foreground">Built for salons, clinics, spas, gyms, consultants — any business that books appointments.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {featureList.map((f) => (
              <div key={f.title} className="flex gap-4 p-5 rounded-2xl border border-border bg-card hover:border-border/80 transition-colors">
                <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center shrink-0`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Guarantee */}
      <section className="py-20 px-6 border-t border-border/50">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Risk-Free ROI Guarantee</h2>
          <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
            Our first 20 clients get Rebooked completely free if it doesn't generate a positive ROI. We track every dollar recovered so you can see the results yourself.
          </p>
          <div className="inline-flex items-center gap-3 p-4 rounded-xl border border-green-500/30 bg-green-500/5">
            <DollarSign className="w-5 h-5 text-green-400" />
            <span className="text-sm font-medium text-green-300">If Rebooked doesn't make you money, you pay nothing.</span>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 border-t border-border/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Flexible pricing for every stage</h2>
            <p className="text-muted-foreground">Start small, scale up. Every plan includes a 14-day free trial.</p>
          </div>

          <div className={`grid gap-6 ${displayPlans.length === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3"}`}>
            {displayPlans.map((plan: any) => {
              const meta = planMeta[plan.slug] ?? { cta: "Start free trial" };
              return (
                <div
                  key={plan.slug}
                  className={`relative p-6 rounded-2xl border transition-all ${
                    meta.popular
                      ? "border-primary bg-card ring-1 ring-primary/20"
                      : plan.slug === "flex"
                      ? "border-pink-500/40 bg-card ring-1 ring-pink-500/20"
                      : "border-border bg-card"
                  }`}
                >
                  {meta.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <Badge className="px-3 py-1 text-xs"><Star className="w-3 h-3 mr-1" /> Most popular</Badge>
                    </div>
                  )}
                  {meta.highlight && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <Badge className="px-3 py-1 text-xs bg-pink-500 hover:bg-pink-600"><Zap className="w-3 h-3 mr-1" /> {meta.highlight}</Badge>
                    </div>
                  )}

                  <div className="mb-5">
                    <h3 className="text-xl font-bold mb-1 capitalize" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-4xl font-extrabold">{formatPrice(plan.priceMonthly)}</span>
                      <span className="text-muted-foreground text-sm">/mo</span>
                    </div>
                    {plan.revenueSharePercent > 0 && (
                      <p className="text-xs text-muted-foreground">+ {plan.revenueSharePercent}% of recovered revenue</p>
                    )}
                  </div>

                  <div className="space-y-2 mb-3 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Automations</span>
                      <span className="font-medium text-foreground">{plan.maxAutomations === -1 ? "Unlimited" : plan.maxAutomations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SMS / month</span>
                      <span className="font-medium text-foreground">{plan.maxMessages === -1 ? "Unlimited" : plan.maxMessages.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Team seats</span>
                      <span className="font-medium text-foreground">{plan.maxSeats}</span>
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-3 mb-5">
                    <ul className="space-y-2">
                      {(plan.features as string[] ?? []).slice(0, 6).map((feat: string) => (
                        <li key={feat} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    className="w-full"
                    variant={meta.popular || plan.slug === "flex" ? "default" : "outline"}
                    onClick={goSignup}
                  >
                    {meta.cta}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Referral callout */}
          <div className="mt-10 max-w-lg mx-auto p-5 rounded-2xl border border-pink-500/30 bg-pink-500/5 text-center">
            <Gift className="w-6 h-6 text-pink-400 mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">Referral Program</p>
            <p className="text-sm text-muted-foreground">Earn <span className="text-pink-400 font-semibold">$50/month for 6 months</span> for every business you refer that stays active.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-border/50 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Ready to stop losing revenue?</h2>
          <p className="text-muted-foreground mb-8">Join appointment businesses using Rebooked to fill cancellations, reduce no-shows, recover lapsed clients, and grow their reviews.</p>
          <Button size="lg" className="h-12 px-8 text-base" onClick={goSignup}>
            Start your free trial <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <p className="text-xs text-muted-foreground mt-4">14-day trial · Cancel anytime · ROI guaranteed</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Zap className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Rebooked</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Support</a>
          </div>
          <p className="text-xs text-muted-foreground">&copy; 2026 Rebooked. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
