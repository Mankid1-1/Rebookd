/**
 * RecoveryShareCard — branded shareable results card.
 * Shows recovery stats and provides share buttons for social / clipboard.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Linkedin, Check } from "lucide-react";
import { trackFunnelEvent } from "@/lib/funnelEvents";

// ── Props ───────────────────────────────────────────────────────────────────

interface RecoveryShareCardProps {
  recoveredAmount: number;
  recoveredCount: number;
  businessName: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export function RecoveryShareCard({
  recoveredAmount,
  recoveredCount,
  businessName,
}: RecoveryShareCardProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = "https://rebooked.org/?ref=share";
  const shareText = `I recovered $${recoveredAmount.toLocaleString("en-US")} from ${recoveredCount} no-show${recoveredCount !== 1 ? "s" : ""} with Rebooked`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackFunnelEvent("referral_shared", { method: "copy_link" });
    } catch {
      // clipboard API unavailable — ignore
    }
  };

  const handleTwitter = () => {
    const tweetText = encodeURIComponent(`${shareText} — check it out:`);
    const tweetUrl = encodeURIComponent(shareUrl);
    window.open(
      `https://twitter.com/intent/tweet?text=${tweetText}&url=${tweetUrl}`,
      "_blank",
      "noopener,noreferrer"
    );
    trackFunnelEvent("referral_shared", { method: "twitter" });
  };

  const handleLinkedIn = () => {
    const linkedInUrl = encodeURIComponent(shareUrl);
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${linkedInUrl}`,
      "_blank",
      "noopener,noreferrer"
    );
    trackFunnelEvent("referral_shared", { method: "linkedin" });
  };

  return (
    <Card className="overflow-hidden border-0 shadow-lg">
      {/* Branded header */}
      <div className="bg-[#0D1B2A] px-6 py-5">
        <div className="flex items-center gap-2 mb-3">
          <Share2 className="w-4 h-4 text-[#00A896]" />
          <span className="text-xs font-semibold uppercase tracking-widest text-[#00A896]">
            Share your results
          </span>
        </div>
        <p className="text-2xl font-bold text-white leading-tight">
          I recovered{" "}
          <span className="text-[#E8920A]">
            ${recoveredAmount.toLocaleString("en-US")}
          </span>{" "}
          from{" "}
          <span className="text-[#00A896]">
            {recoveredCount} no-show{recoveredCount !== 1 ? "s" : ""}
          </span>{" "}
          with Rebooked
        </p>
        <p className="text-sm text-white/60 mt-1">{businessName}</p>
      </div>

      {/* Share actions */}
      <CardContent className="p-4 bg-[#0D1B2A]/5">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#00A896]" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy Link
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleTwitter}
          >
            <span className="w-4 h-4 flex items-center justify-center text-xs font-bold">
              X
            </span>
            Share on X
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleLinkedIn}
          >
            <Linkedin className="w-4 h-4" /> LinkedIn
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default RecoveryShareCard;
