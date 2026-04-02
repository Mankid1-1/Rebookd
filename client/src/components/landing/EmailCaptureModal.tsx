import { useState } from "react";
import { X, Mail, ArrowRight, CheckCircle } from "lucide-react";
import { getAttribution } from "@/lib/attribution";
import { trackFunnelEvent } from "@/lib/funnelEvents";

interface EmailCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  industry?: string;
  roiData?: {
    avgValue: number;
    noShows: number;
    cancellations: number;
    grossRevenue: number;
    netProfit: number;
    roi: number;
  };
}

export function EmailCaptureModal({ isOpen, onClose, industry, roiData }: EmailCaptureModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === "submitting") return;

    setStatus("submitting");
    trackFunnelEvent("email_capture_submitted", { industry, source: "roi_calculator" });

    try {
      const attribution = getAttribution();
      const res = await fetch("/api/trpc/public.captureEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: {
            email,
            name: name || undefined,
            source: "roi_calculator" as const,
            industry,
            roiData,
            attribution: attribution.lastTouch || attribution.firstTouch || undefined,
          },
        }),
      });

      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {status === "success" ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3
              className="text-xl font-bold text-foreground mb-2"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
            >
              Check your inbox
            </h3>
            <p className="text-muted-foreground text-sm">
              Your personalized ROI breakdown is on its way. Keep an eye out for tips on recovering even more revenue.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Got it
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3
                  className="text-lg font-bold text-foreground"
                  style={{ fontFamily: "Space Grotesk, sans-serif" }}
                >
                  Get your ROI breakdown
                </h3>
                <p className="text-xs text-muted-foreground">
                  Personalized recovery projections, delivered to your inbox
                </p>
              </div>
            </div>

            {roiData && roiData.grossRevenue > 0 && (
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Your potential monthly recovery</span>
                  <span className="text-lg font-bold text-primary" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                    {roiData.grossRevenue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Your name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="submit"
                disabled={status === "submitting" || !email}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {status === "submitting" ? (
                  "Sending..."
                ) : (
                  <>
                    Email me the breakdown
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {status === "error" && (
              <p className="text-xs text-red-500 mt-2 text-center">
                Something went wrong. Please try again.
              </p>
            )}

            <p className="text-xs text-muted-foreground text-center mt-3">
              No spam, ever. Unsubscribe anytime.{" "}
              <a href="/privacy" className="underline hover:text-foreground">Privacy policy</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
