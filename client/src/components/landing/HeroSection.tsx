import { motion } from "framer-motion";
import { ArrowRight, Activity, Share2, Clock, Shield, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RebookedLogo } from "@/components/RebookedLogo";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { trackFunnelEvent } from "@/lib/funnelEvents";
import { useAnimatedCounter, fadeInUp, staggerContainer } from "@/lib/animations";
import { AUTOMATION_COUNT } from "@/data/automations";
import { useTheme, THEME_META, type ThemeName } from "@/contexts/ThemeContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useState } from "react";
import { Palette } from "lucide-react";

interface HeroSectionProps {
  stats: {
    totalClients: number;
    appointmentsRecovered: number;
    revenueRecoveredCents: number;
  };
}

export function HeroSection({ stats }: HeroSectionProps) {
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const [showThemePicker, setShowThemePicker] = useState(false);

  const clientsCounter = useAnimatedCounter(stats.totalClients);
  const appointmentsCounter = useAnimatedCounter(stats.appointmentsRecovered);
  const revenueCounter = useAnimatedCounter(Math.round(stats.revenueRecoveredCents / 100));

  return (
    <>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <RebookedLogo size={32} />
          <div className="flex items-center gap-4">
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block">How It Works</a>
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
      <section className="pt-16 pb-20 px-6 text-center">
        <motion.div
          className="max-w-4xl mx-auto"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.h1
            variants={fadeInUp}
            className="text-5xl md:text-6xl font-extrabold mb-6 leading-[1.1] tracking-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Stop losing revenue to<br /><span className="text-primary">no-shows & cancellations</span>
          </motion.h1>

          <motion.p variants={fadeInUp} className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            I built Rebooked to send the right SMS at the right time — reminders, follow-ups, win-back campaigns, and more. {AUTOMATION_COUNT} automations ready to go. Turn them on, watch revenue come back.
          </motion.p>

          {/* Trust badges */}
          <motion.div variants={fadeInUp} className="flex items-center justify-center gap-4 mb-8 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <CreditCard className="w-3 h-3" /> No credit card required
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <Clock className="w-3 h-3" /> Setup in 15 minutes
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
              <Shield className="w-3 h-3" /> ROI guaranteed or it's free
            </span>
          </motion.div>

          {/* Live Stats Bar — animated counters */}
          <motion.div variants={fadeInUp} className="flex items-center justify-center gap-8 mb-10 flex-wrap">
            <div className="text-center">
              <p ref={clientsCounter.ref as React.RefObject<HTMLParagraphElement>} className="text-3xl font-extrabold text-primary" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {clientsCounter.count.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Active Clients</p>
            </div>
            <div className="w-px h-10 bg-border hidden md:block" />
            <div className="text-center">
              <p ref={appointmentsCounter.ref as React.RefObject<HTMLParagraphElement>} className="text-3xl font-extrabold text-primary" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {appointmentsCounter.count.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Appointments Recovered</p>
            </div>
            <div className="w-px h-10 bg-border hidden md:block" />
            <div className="text-center">
              <p ref={revenueCounter.ref as React.RefObject<HTMLParagraphElement>} className="text-3xl font-extrabold text-primary" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                ${revenueCounter.count.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Revenue Recovered</p>
            </div>
          </motion.div>

          <motion.div variants={fadeInUp} className="flex items-center justify-center gap-4 flex-wrap">
            <Button size="lg" className="h-12 px-8 text-base" onClick={() => { trackFunnelEvent("cta_click_hero"); setLocation(getLoginUrl()); }}>
              Claim your founding spot <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>

          <motion.div variants={fadeInUp} className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-accent/30 bg-accent/5">
            <Share2 className="w-3.5 h-3.5 text-accent-foreground" />
            <span className="text-xs text-accent-foreground">
              <a href="#referral" className="hover:text-accent-foreground transition-colors">
                <span className="font-semibold">Referral Program:</span> Earn $50/mo for 6 months per referral — <span className="underline">learn more</span>
              </a>
            </span>
          </motion.div>
        </motion.div>
      </section>
    </>
  );
}
