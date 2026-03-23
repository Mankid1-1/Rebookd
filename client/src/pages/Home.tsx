import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { ArrowRight, Bot, BarChart3, MessageSquare, Zap, CheckCircle, Star, Bell, UserX, XCircle, Gift, ThumbsUp, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useProgressiveDisclosureContext } from "@/components/ui/ProgressiveDisclosure";

const [, setLocation] = useLocation();

// Dynamic features based on user skill and business type
const getDynamicFeatures = (userSkill?: any, businessType?: string) => {
  const isDarkMode = document.documentElement.classList.contains('dark');
  const baseFeatures = [
    { 
      icon: Bot, 
      title: "AI-Powered Messaging", 
      description: "Rewrite every SMS in the perfect tone — friendly, professional, or urgent — automatically using built-in AI.", 
      color: isDarkMode ? "text-purple-300" : "text-purple-400", 
      bg: isDarkMode ? "bg-purple-500/20" : "bg-purple-500/10" 
    },
    { 
      icon: MessageSquare, 
      title: "Two-Way Conversations", 
      description: "Manage all client SMS conversations in one inbox. Respond manually or let automations handle replies.", 
      color: isDarkMode ? "text-blue-300" : "text-blue-400", 
      bg: isDarkMode ? "bg-blue-500/20" : "bg-blue-500/10" 
    },
    { 
      icon: BarChart3, 
      title: "Revenue Analytics", 
      description: "Track booking rates, no-show rates, re-engagement success, and actual revenue recovered over time.", 
      color: isDarkMode ? "text-green-300" : "text-green-400", 
      bg: isDarkMode ? "bg-green-500/20" : "bg-green-500/10" 
    },
  ];

  // Add advanced features for expert users
  if (userSkill?.level === 'expert' || userSkill?.level === 'advanced') {
    baseFeatures.push({
      icon: Zap,
      title: "16 Ready-Made Automations", 
      description: "Enable pre-built workflows for reminders, no-shows, cancellations, win-backs and more. No setup required.",
      color: isDarkMode ? "text-yellow-300" : "text-yellow-400",
      bg: isDarkMode ? "bg-yellow-500/20" : "bg-yellow-500/10"
    });
  }

  return baseFeatures;
};

// Dynamic automation previews based on business type
const getDynamicAutomationPreviews = (businessType?: string) => {
  const isDarkMode = document.documentElement.classList.contains('dark');
  const basePreviews = [
    { icon: Bell, label: "24-hr Appointment Reminder", cat: isDarkMode ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/40" : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", catLabel: "appointment" },
    { icon: UserX, label: "No-Show Follow-Up", cat: isDarkMode ? "bg-red-500/25 text-red-300 border-red-500/40" : "bg-red-500/15 text-red-400 border-red-500/30", catLabel: "no-show" },
  ];

  // Business-specific automations
  if (businessType?.includes('medical') || businessType?.includes('clinic')) {
    basePreviews.push(
      { icon: Gift, label: "90-Day Win-Back", cat: isDarkMode ? "bg-purple-500/25 text-purple-300 border-purple-500/40" : "bg-purple-500/15 text-purple-400 border-purple-500/30", catLabel: "re-engagement" },
      { icon: ThumbsUp, label: "Post-Visit Feedback", cat: isDarkMode ? "bg-blue-500/25 text-blue-300 border-blue-500/40" : "bg-blue-500/15 text-blue-400 border-blue-500/30", catLabel: "follow-up" }
    );
  } else {
    basePreviews.push(
      { icon: XCircle, label: "Cancellation Rebook", cat: isDarkMode ? "bg-orange-500/25 text-orange-300 border-orange-500/40" : "bg-orange-500/15 text-orange-400 border-orange-500/30", catLabel: "cancellation" },
      { icon: RotateCcw, label: "Loyalty Milestone", cat: isDarkMode ? "bg-pink-500/25 text-pink-300 border-pink-500/40" : "bg-pink-500/15 text-pink-400 border-pink-500/30", catLabel: "loyalty" }
    );
  }

  return basePreviews;
};

export default function Home() {
  const { user, loading } = useAuth();
  const { context } = useProgressiveDisclosureContext();
  const [, setLocation] = useLocation();
  
  // Get dynamic data
  const { data: plansData } = trpc.plans.list.useQuery();
  const { data: testimonialsData } = trpc.testimonials.list.useQuery();
  const { data: tenant } = trpc.tenant.get.useQuery();

  const features = getDynamicFeatures(context.userSkill, tenant?.industry);
  const automationPreviews = getDynamicAutomationPreviews(tenant?.industry);

  useEffect(() => {
    if (!loading && user) setLocation("/dashboard");
  }, [user, loading, setLocation]);

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
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block">Pricing</a>
            <Button variant="outline" size="sm" onClick={() => setLocation(getLoginUrl())}>Sign in</Button>
            <Button size="sm" onClick={() => setLocation(getLoginUrl())}>Start free trial <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge variant="outline" className="mb-6 px-3 py-1.5 text-xs bg-primary/5 border-primary/20 text-primary">
            <Zap className="w-3 h-3 mr-1.5" /> Revenue recovery for appointment businesses
          </Badge>
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-[1.1] tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Stop losing revenue to<br /><span className="text-primary">no-shows &amp; cancellations</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Rebooked automatically sends the right SMS at the right time — appointment reminders, no-show follow-ups, cancellation recovery, and win-back campaigns. 16 ready-made automations. Enable and go.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button size="lg" className="h-12 px-8 text-base" onClick={() => setLocation(getLoginUrl())}>
              Start your free trial <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <p className="text-sm text-muted-foreground">14-day free trial · No credit card required</p>
          </div>
        </div>
      </section>

      {/* Automation Strip */}
      <section className="pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs text-muted-foreground mb-5 uppercase tracking-widest">16 pre-built automations ready to enable</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {automationPreviews.map(({ icon: Icon, label, cat, catLabel }) => (
              <div key={label} className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card/50">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{label}</p>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 mt-0.5 ${cat}`}>{catLabel}</Badge>
                </div>
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
            <p className="text-muted-foreground">Built specifically for appointment-based businesses — salons, clinics, gyms, spas, and more.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((f) => (
              <div key={f.title} className="flex gap-4 p-6 rounded-2xl border border-border bg-card">
                <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center shrink-0`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <div>
                  <h3 className="font-semibold mb-1.5">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-6 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Businesses love Rebooked</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="p-6 rounded-2xl border border-border bg-card">
                <Badge variant="outline" className="mb-4 text-xs bg-primary/5 border-primary/20 text-primary">{t.stat}</Badge>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{t.quote}"</p>
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.business}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Simple, transparent pricing</h2>
            <p className="text-muted-foreground">Start free for 14 days. No credit card required.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.name} className={`relative p-6 rounded-2xl border transition-all ${plan.popular ? "border-primary bg-card ring-1 ring-primary/20" : "border-border bg-card"}`}>
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <Badge className="px-3 py-1 text-xs"><Star className="w-3 h-3 mr-1" /> Most popular</Badge>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                </div>
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />{feat}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={plan.popular ? "default" : "outline"} onClick={() => setLocation(getLoginUrl())}>
                  {plan.cta}
                </Button>
              </div>
            ))}
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
          <Button size="lg" className="h-12 px-8 text-base" onClick={() => setLocation(getLoginUrl())}>
            Start your free trial <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <p className="text-xs text-muted-foreground mt-4">14-day trial · Cancel anytime · No credit card required</p>
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
          <p className="text-xs text-muted-foreground">© 2025 Rebooked. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
