import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { ArrowRight, CheckCircle, Star, Shield, Share2, Users, DollarSign, Zap, TrendingUp } from "lucide-react";
import { RebookedLogo } from "@/components/RebookedLogo";
import { useLocation } from "wouter";
import { lazy, Suspense, useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useProgressiveDisclosureContext } from "@/components/ui/ProgressiveDisclosure";
import { LanguageSelector } from "@/components/LanguageSelector";
import { INDUSTRIES } from "@/data/industries";
import { AUTOMATION_COUNT } from "@/data/automations";
import { fadeInUp, staggerContainer } from "@/lib/animations";

// ─── Landing sections ──────────────────────────────────────────────────────
import { HeroSection } from "@/components/landing/HeroSection";
import { SocialProofBar } from "@/components/landing/SocialProofBar";
import { JsonLd, REBOOKED_ORGANIZATION, REBOOKED_SOFTWARE } from "@/components/seo/JsonLd";

// Below-fold sections — lazy loaded to reduce initial JS and speed up hero paint
const HowItWorks = lazy(() => import("@/components/landing/HowItWorks").then(m => ({ default: m.HowItWorks })));
const PlatformCapabilities = lazy(() => import("@/components/landing/PlatformCapabilities").then(m => ({ default: m.PlatformCapabilities })));
const AutomationsExplorer = lazy(() => import("@/components/landing/AutomationsExplorer").then(m => ({ default: m.AutomationsExplorer })));
const TestimonialsSection = lazy(() => import("@/components/landing/TestimonialsSection").then(m => ({ default: m.TestimonialsSection })));
import { usePageMeta } from "@/hooks/usePageMeta";
import { trackFunnelEvent } from "@/lib/funnelEvents";

// ─── ROI CALCULATOR (inline — used only in pricing) ─────────────────────────
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

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function Home() {
  const { user, loading } = useAuth();
  const { context } = useProgressiveDisclosureContext();
  const [, setLocation] = useLocation();

  // Live platform stats from DB
  const statsQuery = trpc.platformStats.live.useQuery(undefined, {
    refetchInterval: 30000,
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

  const founderSlotsRemaining = 10 - stats.founderSlotsUsed;
  const flexSlotsRemaining = 10 - stats.flexSlotsUsed;

  usePageMeta({
    title: "Rebooked — AI-Powered SMS Revenue Recovery",
    description: "Reduce no-shows, recover cancellations, and win back lapsed clients automatically. 35-day ROI guarantee for appointment businesses.",
    ogUrl: "https://rebooked.org",
    canonical: "https://rebooked.org/",
  });

  useEffect(() => {
    if (!loading && user) setLocation("/dashboard");
  }, [user, loading, setLocation]);

  useEffect(() => {
    trackFunnelEvent("page_view_landing");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground scroll-smooth" style={{ fontFamily: "'Inter', sans-serif" }}>
      <JsonLd data={REBOOKED_ORGANIZATION} />
      <JsonLd data={REBOOKED_SOFTWARE} />

      {/* ── Hero + Nav + Banner ── */}
      <HeroSection stats={stats} />

      {/* ── Social Proof ── */}
      <SocialProofBar />

      {/* ── Below-fold sections (lazy-loaded to defer JS) ── */}
      <Suspense fallback={null}>
      <HowItWorks />

      {/* ── Industry Selector ── */}
      <section className="py-16 px-6 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-10"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Built for <span className="text-primary">your</span> industry
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Every business is different. See how Rebooked works for yours — with tailored ROI numbers and automations.
            </p>
          </motion.div>
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {Object.values(INDUSTRIES).map((ind) => (
              <motion.button
                key={ind.slug}
                variants={fadeInUp}
                onClick={() => setLocation(`/for/${ind.slug}`)}
                className="group flex items-center gap-3 p-4 rounded-xl border border-border bg-card/50 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm transition-all text-left cursor-pointer"
              >
                <span className="text-2xl shrink-0">{ind.emoji}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{ind.namePlural}</p>
                  <p className="text-xs text-muted-foreground">Avg ${ind.avgAppointmentValue}/appt</p>
                </div>
              </motion.button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Platform Capabilities (tabbed) ── */}
      <PlatformCapabilities />

      {/* ── Automations Explorer (filterable) ── */}
      <AutomationsExplorer />

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20 px-6 border-t border-border/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-10"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Simple, fair pricing
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              I wanted pricing to feel right — so you only pay if it's working. Limited founding spots available.
            </p>
          </motion.div>

          {/* Soft Launch Trial Message */}
          <motion.div
            className="mb-8 mx-auto max-w-3xl rounded-2xl border border-primary/20 bg-card p-6 text-center"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
          >
            <p className="text-sm leading-relaxed text-foreground">
              <span className="font-semibold">30-day free trial</span> — after 30 days services will be deactivated. You'll then have 5 days to decide whether you dig, like, or love the platform and want to start paying your plan price, or whether you'd like to continue being part of our soft launch trialling period because performance didn't add up.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              If you have any questions please don't hesitate to reach me at{" "}
              <a href="mailto:rebooked@rebooked.org" className="text-primary hover:underline font-medium">rebooked@rebooked.org</a>
            </p>
          </motion.div>

          {/* Transparency Disclaimer */}
          <motion.div
            className="mb-8 mx-auto max-w-3xl rounded-xl border-2 border-amber-400/40 bg-amber-50/10 px-6 py-4 text-center"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
          >
            <p className="text-sm font-semibold text-amber-300 tracking-wide uppercase mb-1">Transparency Notice</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Prices are only shown to be transparent — so if you do see a positive ROI, you understand the costs and how I came to calculate everything.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* FOUNDER SPOTS */}
            <motion.div
              className="relative p-6 rounded-2xl border bg-card border-primary/20"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
            >
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <Badge className="px-3 py-1 text-xs bg-primary text-primary-foreground border-primary">
                  <Star className="w-3 h-3 mr-1" /> {stats.founderSlotsUsed}/10 spots taken
                </Badge>
              </div>
              <div className="mb-5 mt-2">
                <h3 className="text-xl font-bold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Founder Spots</h3>
                <p className="text-xs text-muted-foreground mb-3">Free forever — in exchange for honest feedback</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold">$0</span>
                  <span className="text-muted-foreground text-sm">/forever</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">No credit card · No hidden fees · No expiry date</p>
              </div>
              <ul className="space-y-2 mb-4">
                {[
                  "Full platform access — forever",
                  `All ${AUTOMATION_COUNT} automations`,
                  "Unlimited SMS",
                  "Real-time analytics & dashboard",
                  "Call tracking & recording",
                  "No revenue share — ever",
                  `${founderSlotsRemaining} of 10 spots remaining`,
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-success" />{feat}
                  </li>
                ))}
              </ul>
              <Button className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground border-primary" onClick={() => { trackFunnelEvent("cta_click_pricing", { plan: "founder" }); setLocation(getLoginUrl()); }} disabled={founderSlotsRemaining <= 0}>
                {founderSlotsRemaining > 0 ? "Claim Founder Spot" : "Sold Out"}
              </Button>
            </motion.div>

            {/* FLEX SPOTS */}
            <motion.div
              className="relative p-6 rounded-2xl border-2 bg-card border-success/30 shadow-lg"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
            >
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <Badge className="px-3 py-1 text-xs bg-success text-white border-success">
                  Most Popular — {stats.flexSlotsUsed}/10 spots taken
                </Badge>
              </div>
              <div className="mb-5 mt-2">
                <h3 className="text-xl font-bold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Flex Spots</h3>
                <p className="text-xs text-muted-foreground mb-3">Free trial — pay only if it works for you</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold">$0</span>
                  <span className="text-muted-foreground text-sm">for 35 days</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Then $199/mo + 15% revenue share — only if you see positive ROI</p>
              </div>
              <ul className="space-y-2 mb-4">
                {[
                  "Full platform — completely free for 35 days",
                  `All ${AUTOMATION_COUNT} automations`,
                  "Unlimited SMS during trial",
                  "Real-time analytics & call tracking",
                  "35-day ROI guarantee",
                  "No ROI = you owe nothing",
                  "Positive ROI = $199/mo + 15% share",
                  `${flexSlotsRemaining} of 10 spots remaining`,
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-success" />{feat}
                  </li>
                ))}
              </ul>
              <ROICalculator planPrice={199} revenueShare={15} planName="Flex (after trial)" />
              <Button className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground border-primary" onClick={() => { trackFunnelEvent("cta_click_pricing", { plan: "flex" }); setLocation(getLoginUrl()); }} disabled={flexSlotsRemaining <= 0}>
                {flexSlotsRemaining > 0 ? "Claim Flex Spot" : "Sold Out"}
              </Button>
            </motion.div>

            {/* ENTERPRISE */}
            <motion.div
              className="relative p-6 rounded-2xl border bg-card border-primary/20"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
            >
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
                  "Everything in Flex",
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
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-primary" onClick={() => { trackFunnelEvent("cta_click_pricing", { plan: "enterprise" }); window.location.href = "mailto:rebooked@rebooked.org"; }}>
                Contact Us
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── ROI Guarantee ── */}
      <section className="py-16 px-6 border-t border-border/30">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}>
            <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              The Rebooked ROI Guarantee
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed max-w-xl mx-auto">
              I believe in Rebooked so much that I'm putting my money where my mouth is.
              If you don't see a positive return on investment within 35 days, you don't pay a penny. No questions asked.
            </p>
          </motion.div>
          <motion.div
            className="grid md:grid-cols-3 gap-4 text-left"
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              { title: "1. Sign up", desc: "Pick a plan. No credit card needed to start." },
              { title: "2. Enable automations", desc: "Turn on the SMS automations that fit your business. Takes 15 minutes." },
              { title: "3. See real ROI", desc: "Track every recovered appointment and dollar in your live dashboard. No ROI by day 35? It's free." },
            ].map((step) => (
              <motion.div key={step.title} variants={fadeInUp} className="p-5 rounded-xl border border-border bg-card">
                <p className="font-semibold text-sm mb-1">{step.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <TestimonialsSection />

      {/* ── Referral Program ── */}
      <section id="referral" className="py-16 px-6 border-t border-border/30">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}>
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <Share2 className="w-8 h-8 text-accent-foreground" />
            </div>
            <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Earn $300 for every referral
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed max-w-xl mx-auto">
              Know a business that's losing revenue to no-shows? Refer them to Rebooked and earn <span className="text-foreground font-semibold">$50/month for 6 months</span> for every active referral. That's $300 per client, paid out monthly — no cap on referrals.
            </p>
          </motion.div>
          <motion.div
            className="grid md:grid-cols-3 gap-4 text-left max-w-3xl mx-auto"
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              { icon: Share2, title: "1. Share your link", desc: "Get a unique referral link from your dashboard and share it with other businesses." },
              { icon: Users, title: "2. They subscribe", desc: "Once your referral subscribes and stays active for 30 days, your payouts begin." },
              { icon: DollarSign, title: "3. Get paid monthly", desc: "Receive $50/month for 6 months per active referral. No limit on how many you can refer." },
            ].map((step) => (
              <motion.div key={step.title} variants={fadeInUp} className="p-5 rounded-xl border border-border bg-card">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
                  <step.icon className="w-4 h-4 text-accent-foreground" />
                </div>
                <p className="font-semibold text-sm mb-1">{step.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
          <motion.div className="mt-8" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}>
            <Button variant="outline" size="lg" onClick={() => { trackFunnelEvent("cta_click_referral"); setLocation(getLoginUrl()); }}>
              Start referring <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 px-6 border-t border-border/30 text-center">
        <motion.div
          className="max-w-2xl mx-auto"
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            I'd love to have you on board
          </h2>
          <p className="text-muted-foreground mb-8">
            Join the appointment businesses already using Rebooked to reduce no-shows, recover cancellations, and win back lapsed clients. Spots are limited — grab yours while they're open.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
            <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary">
              Founder Spots: {founderSlotsRemaining}/10 remaining
            </Badge>
            <Badge variant="outline" className="text-xs bg-success/5 border-success/20 text-success">
              Flex Spots: {flexSlotsRemaining}/10 remaining
            </Badge>
          </div>
          <Button size="lg" className="h-12 px-8 text-base" onClick={() => setLocation(getLoginUrl())}>
            Claim your founding spot <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <p className="text-xs text-muted-foreground mt-4">No credit card required · ROI guaranteed within 35 days or it's free</p>
        </motion.div>
      </section>

      </Suspense>

      {/* ── Footer ── */}
      <footer className="border-t border-border/30 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <RebookedLogo size={24} />
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
            <a href="/tcpa" className="hover:text-foreground transition-colors">TCPA</a>
            <a href="mailto:rebooked@rebooked.org" className="hover:text-foreground transition-colors">Support</a>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <p className="text-xs text-muted-foreground">&copy; 2026 Rebooked. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
