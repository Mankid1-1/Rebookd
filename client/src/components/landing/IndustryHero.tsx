import { Link } from "wouter";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RebookedLogo } from "@/components/RebookedLogo";
import type { IndustryConfig } from "@/data/industries";

interface IndustryHeroProps {
  config: IndustryConfig;
}

export function IndustryHero({ config }: IndustryHeroProps) {
  const signupUrl = `/login?tab=signup&industry=${config.slug}`;

  return (
    <section className="relative overflow-hidden bg-sidebar">
      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <Link href="/">
          <RebookedLogo size={28} />
        </Link>
        <Link href={signupUrl}>
          <Button size="sm" className="font-semibold">
            Start Free Trial
          </Button>
        </Link>
      </header>

      {/* Hero content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-12 pb-20">
        {/* Industry badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 mb-6">
          <span className="text-lg">{config.emoji}</span>
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">
            Built for {config.namePlural}
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold leading-tight text-sidebar-foreground mb-6"
                style={{ fontFamily: "Space Grotesk, sans-serif", letterSpacing: "-0.02em" }}>
              {config.heroHeadline}
            </h1>
            <p className="text-lg text-sidebar-foreground/70 mb-8 leading-relaxed">
              {config.heroSubheadline}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link href={signupUrl}>
                <Button size="lg" className="font-semibold text-base px-8 w-full sm:w-auto">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="flex flex-col gap-2.5">
              {[
                "Free for 35 days — pay only if you see positive ROI",
                "No setup fees, no contracts, cancel anytime",
                "Live in under 10 minutes",
              ].map((point) => (
                <div key={point} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm text-sidebar-foreground/75">{point}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stat card */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
              <div className="relative bg-card border border-border rounded-2xl p-8 shadow-2xl text-center max-w-xs">
                <div className="text-6xl font-bold text-primary mb-2"
                     style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                  {config.heroStat}
                </div>
                <div className="text-sm text-muted-foreground leading-snug">
                  {config.heroStatLabel}
                </div>
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    ROI Guarantee
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    Positive ROI in 35 days or it's free
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
