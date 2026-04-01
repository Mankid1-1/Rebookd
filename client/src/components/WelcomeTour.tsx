import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getItem, setItem } from "@/utils/storage";
import { ArrowRight, X, Zap, BarChart3, Users, Bot, Sparkles } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { createPortal } from "react-dom";

const TOUR_COMPLETED_KEY = "welcome-tour-completed";

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  /** CSS selector to point to, or null for centered overlay */
  target: string | null;
}

const STEPS: TourStep[] = [
  {
    title: "Welcome to Rebooked!",
    description:
      "Your AI-powered SMS revenue recovery platform is ready. Let's take a quick look around.",
    icon: <Sparkles className="w-6 h-6 text-primary" />,
    target: null,
  },
  {
    title: "This is your Dashboard",
    description:
      "Track leads, messages, automations, and bookings at a glance. All your key metrics live here.",
    icon: <BarChart3 className="w-6 h-6 text-info" />,
    target: "[data-tour='stats-cards']",
  },
  {
    title: "Manage your Leads",
    description:
      "View and manage all your potential customers. Add leads manually or let them come in automatically.",
    icon: <Users className="w-6 h-6 text-success" />,
    target: "[data-tour='sidebar-leads']",
  },
  {
    title: "Set up Automations",
    description:
      "Enable SMS automations like appointment reminders, no-show recovery, and win-back campaigns.",
    icon: <Bot className="w-6 h-6 text-info" />,
    target: "[data-tour='sidebar-automations']",
  },
  {
    title: "You're all set!",
    description:
      "Start by adding your first lead or enabling an automation. Rebooked will handle the rest.",
    icon: <Zap className="w-6 h-6 text-primary" />,
    target: null,
  },
];

export function WelcomeTour() {
  const [location] = useLocation();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // Only show the tour when ?welcome=true is present and tour hasn't been completed
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get("welcome") === "true" &&
      getItem<boolean>(TOUR_COMPLETED_KEY) !== true
    ) {
      setVisible(true);
      // Clean up the query param from the URL without a page reload
      const url = new URL(window.location.href);
      url.searchParams.delete("welcome");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [location]);

  const positionTooltip = useCallback(() => {
    const currentStep = STEPS[step];
    if (!currentStep.target) {
      setTooltipPos(null);
      return;
    }
    const el = document.querySelector(currentStep.target);
    if (!el) {
      setTooltipPos(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const tooltipWidth = 360;
    const tooltipHeight = 200;
    let top = rect.bottom + 12;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;

    // If tooltip goes below viewport, position above the element
    if (top + tooltipHeight > window.innerHeight - 20) {
      top = rect.top - tooltipHeight - 12;
    }
    // Keep within horizontal bounds
    if (left < 16) left = 16;
    if (left + tooltipWidth > window.innerWidth - 16) {
      left = window.innerWidth - tooltipWidth - 16;
    }
    if (top < 16) top = 16;

    setTooltipPos({ top, left });
  }, [step]);

  useEffect(() => {
    if (!visible) return;
    positionTooltip();
    window.addEventListener("resize", positionTooltip);
    return () => window.removeEventListener("resize", positionTooltip);
  }, [visible, step, positionTooltip]);

  const completeTour = useCallback(() => {
    setItem(TOUR_COMPLETED_KEY, true);
    setVisible(false);
  }, []);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      completeTour();
    }
  };

  const handleSkip = () => {
    completeTour();
  };

  if (!visible) return null;

  const currentStep = STEPS[step];
  const isCentered = !currentStep.target || !tooltipPos;
  const isLast = step === STEPS.length - 1;

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-[100] transition-opacity" />

      {/* Tooltip card */}
      <div
        className="fixed z-[101] w-[360px] max-w-[calc(100vw-32px)]"
        style={
          isCentered
            ? {
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }
            : {
                top: tooltipPos!.top,
                left: tooltipPos!.left,
              }
        }
      >
        <Card className="border-border bg-card shadow-2xl">
          <CardContent className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                {currentStep.icon}
                <h3 className="font-semibold text-base">{currentStep.title}</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground -mt-1 -mr-1"
                onClick={handleSkip}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Body */}
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              {currentStep.description}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between">
              {/* Step indicators */}
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === step
                        ? "w-5 bg-primary"
                        : i < step
                        ? "w-1.5 bg-primary/50"
                        : "w-1.5 bg-muted-foreground/20"
                    }`}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {!isLast && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={handleSkip}
                  >
                    Skip
                  </Button>
                )}
                <Button size="sm" onClick={handleNext}>
                  {isLast ? (
                    "Get Started"
                  ) : (
                    <>
                      Next
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>,
    document.body
  );
}
