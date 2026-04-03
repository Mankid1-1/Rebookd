/**
 * ReferralPrompt — non-intrusive dismissable banner shown at key milestones.
 * Tracks funnel events and persists dismissals in localStorage.
 */

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, ArrowRight, X, DollarSign, Users } from "lucide-react";
import { trackFunnelEvent } from "@/lib/funnelEvents";
import { useLocation } from "wouter";

// ── Trigger messages ────────────────────────────────────────────────────────

const TRIGGER_MESSAGES: Record<ReferralPromptProps["trigger"], { headline: string; body: string }> = {
  first_recovery: {
    headline: "You just recovered your first appointment!",
    body: "Know someone who'd love this? Earn $50/month for 6 months per referral.",
  },
  revenue_milestone: {
    headline: "You've recovered over $500 with Rebooked!",
    body: "Share the love — earn $50/month for each business you refer.",
  },
  day_30: {
    headline: "You've been with Rebooked for 30 days!",
    body: "Know another business losing revenue to no-shows? Refer them and earn $50/month.",
  },
};

const TRIGGER_ICONS: Record<ReferralPromptProps["trigger"], typeof Gift> = {
  first_recovery: Gift,
  revenue_milestone: DollarSign,
  day_30: Users,
};

// ── Props ───────────────────────────────────────────────────────────────────

interface ReferralPromptProps {
  trigger: "first_recovery" | "revenue_milestone" | "day_30";
  onDismiss?: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = "rb_referral_dismissed_";

/**
 * Check whether a referral prompt should be shown for the given trigger.
 * Returns `false` if the user previously dismissed it.
 */
export function shouldShowReferralPrompt(trigger: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${trigger}`) !== "true";
  } catch {
    return true;
  }
}

function dismissPrompt(trigger: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${trigger}`, "true");
  } catch {
    // storage unavailable — ignore
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export function ReferralPrompt({ trigger, onDismiss }: ReferralPromptProps) {
  const [, setLocation] = useLocation();
  const [visible, setVisible] = useState(true);

  const { headline, body } = TRIGGER_MESSAGES[trigger];
  const Icon = TRIGGER_ICONS[trigger];

  // Track that the prompt was shown
  useEffect(() => {
    trackFunnelEvent("referral_prompt_shown", { trigger });
  }, [trigger]);

  const handleDismiss = () => {
    dismissPrompt(trigger);
    setVisible(false);
    onDismiss?.();
  };

  const handleNavigate = () => {
    trackFunnelEvent("referral_shared", { trigger, method: "prompt_click" });
    setLocation("/referral");
  };

  if (!visible) return null;

  return (
    <Card className="border-[#00A896]/30 bg-[#00A896]/10 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-[#00A896]/5 to-transparent pointer-events-none" />
      <CardContent className="p-4 md:p-5 relative">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="w-10 h-10 rounded-xl bg-[#00A896]/20 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-[#00A896]" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[#00A896]">{headline}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{body}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              className="bg-[#00A896] hover:bg-[#00A896]/90 text-white gap-1.5"
              onClick={handleNavigate}
            >
              Refer & Earn <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
              aria-label="Dismiss referral prompt"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ReferralPrompt;
