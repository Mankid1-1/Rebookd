import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getLoginUrl } from "@/const";
import {
  ArrowRight,
  Bot,
  BarChart3,
  MessageSquare,
  Zap,
  CheckCircle,
  Star,
  Bell,
  UserX,
  XCircle,
  Gift,
  ThumbsUp,
  RotateCcw,
  Shield,
  ChevronDown,
  ChevronUp,
  Heart,
  Scissors,
  Dumbbell,
  Stethoscope,
  Calendar,
  TrendingUp,
  DollarSign,
  Phone,
  Mail,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLocale } from "@/contexts/LocaleContext";

// --- Animated counter hook ---
function useAnimatedCounter(target: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [hasStarted, target, duration]);

  return { count, ref };
}

// --- FAQ Item ---
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="font-medium text-sm pr-4">{q}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-0">
          <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

// --- Category colors for automation badges ---
const categoryStyles: Record<string, string> = {
  appointment: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  "no-show": "bg-red-500/15 text-red-500 border-red-500/30",
  cancellation: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  "re-engagement": "bg-purple-500/15 text-purple-500 border-purple-500/30",
  loyalty: "bg-pink-500/15 text-pink-500 border-pink-500/30",
  "follow-up": "bg-blue-500/15 text-blue-500 border-blue-500/30",
  revenue: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  welcome: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30",
};

// --- Main Component ---

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { t, formatCurrency } = useLocale();

  // Static data arrays (inside component so they use t())
  const automationTypes = [
    { icon: Bell, labelKey: 'automations.24hrReminder' as const, category: "appointment", catKey: 'automations.catAppointment' as const },
    { icon: Bell, labelKey: 'automations.2hrReminder' as const, category: "appointment", catKey: 'automations.catAppointment' as const },
    { icon: UserX, labelKey: 'automations.noShowFollowUp' as const, category: "no-show", catKey: 'automations.catNoShow' as const },
    { icon: UserX, labelKey: 'automations.noShowRebook' as const, category: "no-show", catKey: 'automations.catNoShow' as const },
    { icon: XCircle, labelKey: 'automations.cancellationRecovery' as const, category: "cancellation", catKey: 'automations.catCancellation' as const },
    { icon: XCircle, labelKey: 'automations.sameDayFill' as const, category: "cancellation", catKey: 'automations.catCancellation' as const },
    { icon: RotateCcw, labelKey: 'automations.winBack30' as const, category: "re-engagement", catKey: 'automations.catReEngagement' as const },
    { icon: RotateCcw, labelKey: 'automations.winBack90' as const, category: "re-engagement", catKey: 'automations.catReEngagement' as const },
    { icon: Gift, labelKey: 'automations.birthday' as const, category: "loyalty", catKey: 'automations.catLoyalty' as const },
    { icon: Gift, labelKey: 'automations.loyaltyMilestone' as const, category: "loyalty", catKey: 'automations.catLoyalty' as const },
    { icon: ThumbsUp, labelKey: 'automations.postVisitFeedback' as const, category: "follow-up", catKey: 'automations.catFollowUp' as const },
    { icon: ThumbsUp, labelKey: 'automations.reviewRequest' as const, category: "follow-up", catKey: 'automations.catFollowUp' as const },
    { icon: Calendar, labelKey: 'automations.bookingConfirmation' as const, category: "appointment", catKey: 'automations.catAppointment' as const },
    { icon: Calendar, labelKey: 'automations.waitlistNotification' as const, category: "appointment", catKey: 'automations.catAppointment' as const },
    { icon: TrendingUp, labelKey: 'automations.upsellSuggestion' as const, category: "revenue", catKey: 'automations.catRevenue' as const },
    { icon: TrendingUp, labelKey: 'automations.seasonalPromotion' as const, category: "revenue", catKey: 'automations.catRevenue' as const },
    { icon: Sparkles, labelKey: 'automations.welcomeNewLead' as const, category: "welcome", catKey: 'automations.catWelcome' as const },
    { icon: MessageSquare, labelKey: 'automations.inboundAutoReply' as const, category: "follow-up", catKey: 'automations.catFollowUp' as const },
    { icon: CheckCircle, labelKey: 'automations.confirmationChase' as const, category: "appointment", catKey: 'automations.catAppointment' as const },
  ];

  const features = [
    {
      icon: Bot,
      titleKey: 'features.aiMessaging' as const,
      descKey: 'features.aiMessagingDesc' as const,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      icon: Zap,
      titleKey: 'features.smartAutomations' as const,
      descKey: 'features.smartAutomationsDesc' as const,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
    },
    {
      icon: MessageSquare,
      titleKey: 'features.twoWaySms' as const,
      descKey: 'features.twoWaySmsDesc' as const,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      icon: BarChart3,
      titleKey: 'features.revenueAnalytics' as const,
      descKey: 'features.revenueAnalyticsDesc' as const,
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
    {
      icon: UserX,
      titleKey: 'features.noShowRecovery' as const,
      descKey: 'features.noShowRecoveryDesc' as const,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
    {
      icon: Shield,
      titleKey: 'features.tcpaCompliance' as const,
      descKey: 'features.tcpaComplianceDesc' as const,
      color: "text-teal-400",
      bg: "bg-teal-500/10",
    },
  ];

  const industries = [
    {
      icon: Stethoscope,
      nameKey: 'industries.healthcare' as const,
      descKey: 'industries.healthcareDesc' as const,
      statKey: 'industries.healthcareStat' as const,
    },
    {
      icon: Scissors,
      nameKey: 'industries.beauty' as const,
      descKey: 'industries.beautyDesc' as const,
      statKey: 'industries.beautyStat' as const,
    },
    {
      icon: Dumbbell,
      nameKey: 'industries.fitness' as const,
      descKey: 'industries.fitnessDesc' as const,
      statKey: 'industries.fitnessStat' as const,
    },
    {
      icon: Heart,
      nameKey: 'industries.wellness' as const,
      descKey: 'industries.wellnessDesc' as const,
      statKey: 'industries.wellnessStat' as const,
    },
  ];

  const faqs = [
    { qKey: 'faq.q1' as const, aKey: 'faq.a1' as const },
    { qKey: 'faq.q2' as const, aKey: 'faq.a2' as const },
    { qKey: 'faq.q3' as const, aKey: 'faq.a3' as const },
    { qKey: 'faq.q4' as const, aKey: 'faq.a4' as const },
    { qKey: 'faq.q5' as const, aKey: 'faq.a5' as const },
    { qKey: 'faq.q6' as const, aKey: 'faq.a6' as const },
    { qKey: 'faq.q7' as const, aKey: 'faq.a7' as const },
    { qKey: 'faq.q8' as const, aKey: 'faq.a8' as const },
  ];

  // Flex Plan: Slider = estimated monthly recovered revenue
  // Subscription = ~20% of estimated monthly recovery (capped at reasonable tiers)
  // Revenue share = 20% on ACTUAL recovered revenue for Flex (metered by Stripe)
  // Client always keeps the majority of recovered revenue
  const [monthlyRecoverySlider, setMonthlyRecoverySlider] = useState(500);
  // Tiered subscription: affordable at every level, scales with recovery
  const flexSubscription = monthlyRecoverySlider <= 300 ? 29
    : monthlyRecoverySlider <= 500 ? 49
    : monthlyRecoverySlider <= 800 ? 79
    : monthlyRecoverySlider <= 1200 ? 99
    : monthlyRecoverySlider <= 1800 ? 129
    : 149;
  const flexRevenueShare = Math.round(monthlyRecoverySlider * 0.20);
  const flexTotalCost = flexSubscription + flexRevenueShare;
  const flexClientKeeps = monthlyRecoverySlider - flexTotalCost;
  const flexClientKeepsPct = Math.round((flexClientKeeps / monthlyRecoverySlider) * 100);

  // ROI Calculator state
  const [avgValue, setAvgValue] = useState(150);
  const [monthlyNoShows, setMonthlyNoShows] = useState(20);
  const [monthlyCancellations, setMonthlyCancellations] = useState(15);

  const recoveredNoShows = Math.round(monthlyNoShows * 0.4);
  const recoveredCancellations = Math.round(monthlyCancellations * 0.55);
  const monthlyRecovery = (recoveredNoShows + recoveredCancellations) * avgValue;
  const annualRecovery = monthlyRecovery * 12;
  const revenueShare = Math.round(monthlyRecovery * 0.15);
  const netMonthlyGain = monthlyRecovery - revenueShare - 199;

  // Platform stats — will show real numbers as clients onboard
  const [platformStats] = useState({ totalMessages: 0, totalRecovered: 0, totalBusinesses: 0 });
  // TODO: Replace with tRPC query when platform.getStats endpoint is added
  // const { data: platformStats } = trpc.platform.getStats.useQuery();

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
            <span
              className="font-bold text-lg tracking-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Rebooked
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="#how-it-works"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block"
            >
              {t('nav.howItWorks')}
            </a>
            <a
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block"
            >
              {t('nav.features')}
            </a>
            <a
              href="#pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block"
            >
              {t('nav.pricing')}
            </a>
            <a
              href="#faq"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block"
            >
              {t('nav.faq')}
            </a>
            <a
              href="#referral"
              className="text-sm text-green-400 hover:text-green-300 transition-colors hidden md:block font-medium"
            >
              {t('nav.referrals')}
            </a>
            <Button variant="outline" size="sm" onClick={() => window.location.href = getLoginUrl()}>
              {t('nav.signIn')}
            </Button>
            <Button size="sm" onClick={() => window.location.href = getLoginUrl()}>
              {t('nav.getStarted')}
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/[0.07] via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-4xl mx-auto">
          <Badge
            variant="outline"
            className="mb-4 px-3 py-1.5 text-xs bg-amber-500/10 border-amber-500/30 text-amber-400"
          >
            <Zap className="w-3 h-3 mr-1.5" /> {t('hero.badge1')}
          </Badge>
          <Badge
            variant="outline"
            className="mb-6 px-3 py-1.5 text-xs bg-primary/5 border-primary/20 text-primary"
          >
            <Zap className="w-3 h-3 mr-1.5" /> {t('hero.badge2')}
          </Badge>
          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-[1.05] tracking-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t('hero.title1')}
            <br />
            <span className="text-primary">{t('hero.title2')}</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed">
            {t('hero.subtitle')}
          </p>
          {/* Founding client offer */}
          <div className="max-w-lg mx-auto mb-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-sm font-semibold text-amber-400 mb-1">
              {t('hero.foundingGuarantee')}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('hero.foundingDesc')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <Button
              size="lg"
              className="h-13 px-10 text-base font-semibold"
              onClick={() => window.location.href = getLoginUrl()}
            >
              {t('hero.claimSpot')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <a
              href="#roi-calculator"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
            >
              {t('hero.calcRoi')}
            </a>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('hero.noCreditCard')}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {t('hero.worldwide')}
          </p>
        </div>
      </section>

      {/* Soft Launch Stats — shows real platform numbers, starts at 0 */}
      <section className="py-12 px-6 border-y border-border/50 bg-muted/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <Badge variant="outline" className="mb-3 text-xs bg-amber-500/10 border-amber-500/30 text-amber-400">
              {t('stats.softLaunch')}
            </Badge>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {t('stats.description')}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <p
                className="text-3xl md:text-4xl font-extrabold text-foreground"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {platformStats.totalMessages.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{t('stats.messagesSent')}</p>
            </div>
            <div>
              <p
                className="text-3xl md:text-4xl font-extrabold text-foreground"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {formatCurrency(platformStats.totalRecovered)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{t('stats.revenueRecovered')}</p>
            </div>
            <div>
              <p
                className="text-3xl md:text-4xl font-extrabold text-foreground"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {platformStats.totalBusinesses}/20
              </p>
              <p className="text-sm text-muted-foreground mt-1">{t('stats.foundingSpots')}</p>
            </div>
          </div>
          {/* Integrations */}
          <div className="mt-10 flex items-center justify-center gap-8 opacity-30">
            {["Calendly", "Mindbody", "Acuity", "Vagaro", "Square"].map((name) => (
              <div
                key={name}
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 text-xs">
              {t('howItWorks.badge')}
            </Badge>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('howItWorks.title')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t('howItWorks.subtitle')}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                titleKey: 'howItWorks.step1.title' as const,
                descKey: 'howItWorks.step1.desc' as const,
                icon: Calendar,
              },
              {
                step: "02",
                titleKey: 'howItWorks.step2.title' as const,
                descKey: 'howItWorks.step2.desc' as const,
                icon: Zap,
              },
              {
                step: "03",
                titleKey: 'howItWorks.step3.title' as const,
                descKey: 'howItWorks.step3.desc' as const,
                icon: DollarSign,
              },
            ].map(({ step, titleKey, descKey, icon: Icon }) => (
              <div key={step} className="relative text-center p-8 rounded-2xl border border-border bg-card">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-5">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="absolute top-4 right-5 text-5xl font-extrabold text-muted-foreground/10 select-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {step}
                </div>
                <h3
                  className="text-lg font-bold mb-2"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {t(titleKey)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section id="roi-calculator" className="py-24 px-6 border-t border-border/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 text-xs">
              {t('roi.badge')}
            </Badge>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('roi.title')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t('roi.subtitle')}
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Inputs */}
            <div className="space-y-6 p-8 rounded-2xl border border-border bg-card">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t('roi.avgValue')}
                </label>
                <Input
                  type="number"
                  value={avgValue}
                  onChange={(e) => setAvgValue(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-11"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t('roi.monthlyNoShows')}
                </label>
                <Input
                  type="number"
                  value={monthlyNoShows}
                  onChange={(e) => setMonthlyNoShows(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-11"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t('roi.monthlyCancellations')}
                </label>
                <Input
                  type="number"
                  value={monthlyCancellations}
                  onChange={(e) =>
                    setMonthlyCancellations(Math.max(0, parseInt(e.target.value) || 0))
                  }
                  className="h-11"
                />
              </div>
              <div className="pt-2 text-xs text-muted-foreground">
                {t('roi.basedOn')}
              </div>
            </div>
            {/* Results */}
            <div className="flex flex-col justify-center p-8 rounded-2xl border border-primary/30 bg-primary/[0.03]">
              <p className="text-sm text-muted-foreground mb-2">{t('roi.estimatedMonthly')}</p>
              <p
                className="text-5xl font-extrabold text-primary mb-1"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {formatCurrency(monthlyRecovery)}
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                {recoveredNoShows} {t('roi.noShowsRecovered')} + {recoveredCancellations} {t('roi.cancellationsRecovered')}
              </p>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('roi.annualRecovery')}</span>
                  <span className="font-semibold">{formatCurrency(annualRecovery)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('roi.platformFee')}</span>
                  <span className="text-muted-foreground">-{formatCurrency(199)}/{t('common.month')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('roi.revenueShare')}</span>
                  <span className="text-muted-foreground">
                    -{formatCurrency(revenueShare)}/{t('common.month')}
                  </span>
                </div>
                <div className="border-t border-border pt-3 flex justify-between text-sm">
                  <span className="font-medium">{t('roi.netMonthly')}</span>
                  <span className="font-bold text-primary">
                    {formatCurrency(Math.max(0, netMonthlyGain))}/{t('common.month')}
                  </span>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => window.location.href = getLoginUrl()}
              >
                {t('roi.startRecovering')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 text-xs">
              {t('features.badge')}
            </Badge>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('features.title')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t('features.subtitle')}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.titleKey}
                className="p-6 rounded-2xl border border-border bg-card hover:border-primary/20 transition-colors"
              >
                <div
                  className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-4`}
                >
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3
                  className="font-semibold mb-2"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {t(f.titleKey)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(f.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Automation Showcase */}
      <section className="py-24 px-6 border-t border-border/50 bg-muted/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 text-xs">
              {t('automations.badge')}
            </Badge>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('automations.title')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t('automations.subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {automationTypes.map(({ icon: Icon, labelKey, category, catKey }) => (
              <div
                key={labelKey}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card/80 hover:bg-card transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t(labelKey)}</p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 mt-0.5 ${categoryStyles[category] || ""}`}
                  >
                    {t(catKey)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industry Focus */}
      <section className="py-24 px-6 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 text-xs">
              {t('industries.badge')}
            </Badge>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('industries.title')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t('industries.subtitle')}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {industries.map((ind) => (
              <div
                key={ind.nameKey}
                className="p-6 rounded-2xl border border-border bg-card hover:border-primary/20 transition-colors text-center"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                  <ind.icon className="w-5 h-5 text-primary" />
                </div>
                <h3
                  className="font-semibold mb-2"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {t(ind.nameKey)}
                </h3>
                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                  {t(ind.descKey)}
                </p>
                <p className="text-xs font-semibold text-primary">{t(ind.statKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founding Client Program */}
      <section className="py-24 px-6 border-t border-border/50 bg-muted/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 text-xs bg-amber-500/10 border-amber-500/30 text-amber-400">
              {t('founding.badge')}
            </Badge>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('founding.title')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t('founding.subtitle')}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
                <Shield className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{t('founding.roiGuarantee')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('founding.roiDesc')}
              </p>
            </div>
            <div className="p-6 rounded-2xl border border-primary/30 bg-primary/5">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{t('founding.whiteGlove')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('founding.whiteGloveDesc')}
              </p>
            </div>
            <div className="p-6 rounded-2xl border border-green-500/30 bg-green-500/5">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{t('founding.lockedPricing')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('founding.lockedPricingDesc')}
              </p>
            </div>
          </div>
          <div className="text-center mt-10">
            <Button
              size="lg"
              className="h-13 px-10 text-base font-semibold"
              onClick={() => window.location.href = getLoginUrl()}
            >
              {t('hero.claimSpot')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              {20 - platformStats.totalBusinesses} {t('founding.spotsRemaining')}
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 text-xs">
              {t('pricing.badge')}
            </Badge>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('pricing.title')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t('pricing.subtitle')}
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Flex Plan */}
            <div className="relative p-8 md:p-10 rounded-2xl border-2 border-border bg-card">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <Badge variant="outline" className="px-4 py-1 text-xs font-semibold">
                  {t('pricing.flexBadge')}
                </Badge>
              </div>

              <h3
                className="text-2xl font-bold mb-2"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t('pricing.flexPlan')}
              </h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span
                  className="text-5xl font-extrabold"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {formatCurrency(flexSubscription)}
                </span>
                <span className="text-muted-foreground text-sm">{t('pricing.perMonth')}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                {t('pricing.flexDesc')}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                + 20% {t('pricing.flexShareDesc')}
              </p>

              {/* Slider: estimated monthly recovery */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  {t('pricing.flexSliderLabel')} <span className="font-bold">{formatCurrency(monthlyRecoverySlider)}</span>{t('pricing.perMonth')}
                </label>
                <input
                  type="range"
                  min={200}
                  max={2500}
                  step={50}
                  value={monthlyRecoverySlider}
                  onChange={(e) => setMonthlyRecoverySlider(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{formatCurrency(200)}{t('pricing.perMonth')}</span>
                  <span>{formatCurrency(2500)}{t('pricing.perMonth')}</span>
                </div>
              </div>

              {/* Live cost breakdown */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border mb-6 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('pricing.subscription')}</span>
                  <span>{formatCurrency(flexSubscription)}{t('pricing.perMonth')}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('pricing.revenueShare20')}</span>
                  <span>{formatCurrency(flexRevenueShare)}{t('pricing.perMonth')}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('pricing.totalCost')}</span>
                  <span>{formatCurrency(flexTotalCost)}{t('pricing.perMonth')}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-primary">{t('pricing.youKeep')}</span>
                  <span className="text-primary">{formatCurrency(flexClientKeeps)}{t('pricing.perMonth')} ({flexClientKeepsPct}%)</span>
                </div>
              </div>

              <Button
                size="lg"
                variant="outline"
                className="w-full h-12 text-base font-semibold"
                onClick={() => window.location.href = getLoginUrl()}
              >
                {t('pricing.getStarted')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                {t('pricing.noCreditCard')}
              </p>

              <ul className="space-y-3 mt-6">
                {([
                  'pricing.feat.automations',
                  'pricing.feat.sms',
                  'pricing.feat.ai',
                  'pricing.feat.inbox',
                  'pricing.feat.analytics',
                  'pricing.feat.tcpa',
                  'pricing.feat.clients',
                  'pricing.feat.support',
                ] as const).map((featKey) => (
                  <li key={featKey} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    {t(featKey)}
                  </li>
                ))}
              </ul>
            </div>

            {/* Growth Plan */}
            <div className="relative p-8 md:p-10 rounded-2xl border-2 border-primary bg-card">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <Badge className="px-4 py-1 text-xs font-semibold">
                  <Star className="w-3 h-3 mr-1.5" /> {t('pricing.growthBadge')}
                </Badge>
              </div>

              <h3
                className="text-2xl font-bold mb-2"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t('pricing.growthPlan')}
              </h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span
                  className="text-5xl font-extrabold"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {formatCurrency(199)}
                </span>
                <span className="text-muted-foreground text-sm">/{t('common.month')}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                {t('pricing.growthDesc')}
              </p>
              <Button
                size="lg"
                className="w-full h-12 text-base font-semibold"
                onClick={() => window.location.href = getLoginUrl()}
              >
                {t('pricing.claimSpot')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                {t('pricing.noCreditCard')}
              </p>

              <ul className="space-y-3 mt-6">
                {([
                  'pricing.feat.automations',
                  'pricing.feat.sms',
                  'pricing.feat.ai',
                  'pricing.feat.inbox',
                  'pricing.feat.analytics',
                  'pricing.feat.tcpa',
                  'pricing.feat.clients',
                  'pricing.feat.support',
                ] as const).map((featKey) => (
                  <li key={featKey} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    {t(featKey)}
                  </li>
                ))}
              </ul>

              <p className="text-xs text-muted-foreground mt-4 text-center">
                {t('pricing.bestFor')}
              </p>
            </div>
          </div>

          {/* ROI guarantee */}
          <div className="mt-8 p-6 rounded-2xl border border-border bg-card flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t('pricing.roiGuarantee')}</p>
              <p className="text-xs text-muted-foreground">
                {t('pricing.roiGuaranteeDesc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Referral Program */}
      <section id="referral" className="py-24 px-6 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 text-xs bg-green-500/10 border-green-500/30 text-green-400">
              <Gift className="w-3 h-3 mr-1.5" /> {t('referral.badge')}
            </Badge>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('referral.title')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t('referral.subtitle')}
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* How it works */}
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-green-400 font-bold text-sm">1</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {t('referral.step1')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('referral.step1Desc')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-green-400 font-bold text-sm">2</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {t('referral.step2')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('referral.step2Desc')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-green-400 font-bold text-sm">3</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {t('referral.step3')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('referral.step3Desc')}
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Card */}
            <div className="p-8 rounded-2xl border-2 border-green-500/30 bg-green-500/[0.03]">
              <div className="text-center mb-6">
                <p
                  className="text-5xl font-extrabold text-green-400 mb-1"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  $300
                </p>
                <p className="text-sm text-muted-foreground">{t('referral.earnings')}</p>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2.5 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  <span>{t('referral.monthlyPayout')}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  <span>{t('referral.noCap')}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  <span>{t('referral.autoPayouts')}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  <span>{t('referral.dashboardEarnings')}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  <span>{t('referral.syncsBusiness')}</span>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full h-12 text-base font-semibold bg-green-600 hover:bg-green-700"
                onClick={() => window.location.href = '/login?type=referral'}
              >
                <Gift className="w-4 h-4 mr-2" />
                {t('referral.createFree')}
              </Button>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                {t('referral.alreadyHaveAccount')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6 border-t border-border/50 bg-muted/10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 text-xs">
              {t('faq.badge')}
            </Badge>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('faq.title')}
            </h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <FaqItem key={faq.qKey} q={t(faq.qKey)} a={t(faq.aKey)} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 border-t border-border/50 text-center">
        <div className="relative max-w-2xl mx-auto">
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-3xl blur-3xl" />
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t('cta.title')}
          </h2>
          <p className="text-muted-foreground mb-4 max-w-lg mx-auto leading-relaxed">
            {t('cta.subtitle')} {t('cta.avgRecovery')} {formatCurrency(4200)}{t('cta.perMonth')}.
          </p>
          <p className="text-sm font-medium text-primary mb-8">
            {t('cta.limitedSpots')}
          </p>
          <Button
            size="lg"
            className="h-13 px-10 text-base font-semibold"
            onClick={() => window.location.href = getLoginUrl()}
          >
            {t('cta.startTrial')}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            {t('cta.trialTerms')}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <span
                  className="font-bold text-base"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  Rebooked
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('footer.tagline')}
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {t('footer.product')}
              </p>
              <ul className="space-y-2">
                <li>
                  <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('nav.features')}</a>
                </li>
                <li>
                  <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('nav.pricing')}</a>
                </li>
                <li>
                  <a href="#roi-calculator" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('roi.badge')}</a>
                </li>
                <li>
                  <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('nav.howItWorks')}</a>
                </li>
                <li>
                  <a href="#referral" className="text-sm text-green-400 hover:text-green-300 transition-colors">{t('referral.badge')}</a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {t('footer.legal')}
              </p>
              <ul className="space-y-2">
                <li>
                  <a href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.privacyPolicy')}</a>
                </li>
                <li>
                  <a href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.termsOfService')}</a>
                </li>
                <li>
                  <a href="/tcpa" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.tcpa')}</a>
                </li>
                <li>
                  <a href="/support" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.support')}</a>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {t('footer.support')}
              </p>
              <ul className="space-y-2">
                <li>
                  <a href="mailto:rebooked@rebooked.org" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> rebooked@rebooked.org
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5" /> {t('nav.faq')}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/50 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <p className="text-xs text-muted-foreground">
                &copy; 2026 Rebooked. {t('footer.allRightsReserved')}
              </p>
              <LanguageSelector />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <a href="/privacy" className="hover:text-foreground transition-colors">{t('footer.privacyPolicy')}</a>
              <span className="text-border">|</span>
              <a href="/terms" className="hover:text-foreground transition-colors">{t('footer.termsOfService')}</a>
              <span className="text-border">|</span>
              <a href="/tcpa" className="hover:text-foreground transition-colors">{t('footer.tcpa')}</a>
              <span className="text-border">|</span>
              <a href="/support" className="hover:text-foreground transition-colors">{t('footer.support')}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
