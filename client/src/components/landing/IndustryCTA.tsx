import { Link } from "wouter";
import { ArrowRight, Shield, Zap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RebookedLogo } from "@/components/RebookedLogo";
import type { IndustryConfig } from "@/data/industries";

interface IndustryCTAProps {
  config: IndustryConfig;
}

export function IndustryCTA({ config }: IndustryCTAProps) {
  const signupUrl = `/login?tab=signup&industry=${config.slug}`;

  return (
    <>
      {/* CTA section */}
      <section className="py-20 px-6 bg-sidebar">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-sidebar-foreground mb-4"
              style={{ fontFamily: "Space Grotesk, sans-serif", letterSpacing: "-0.02em" }}>
            Start recovering revenue today — risk free
          </h2>
          <p className="text-lg text-sidebar-foreground/70 mb-8">
            If Rebooked doesn't show you a positive ROI within 35 days, you don't pay a cent. No contracts, no setup fees, no risk.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link href={signupUrl}>
              <Button size="lg" className="font-semibold text-base px-10 w-full sm:w-auto">
                Start Free Trial for {config.namePlural}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 max-w-xl mx-auto">
            {[
              { icon: Shield, text: "35-day ROI guarantee" },
              { icon: Zap, text: "Live in 10 minutes" },
              { icon: Clock, text: "No long-term contract" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs text-sidebar-foreground/60 text-center">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border bg-background">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <RebookedLogo size={24} />
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/tcpa" className="hover:text-foreground transition-colors">TCPA</Link>
            <a href="mailto:rebooked@rebooked.org" className="hover:text-foreground transition-colors">
              rebooked@rebooked.org
            </a>
          </div>
          <p className="text-xs text-muted-foreground">&copy; 2026 Rebooked. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
