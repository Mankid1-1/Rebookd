import { Shield, Lock } from "lucide-react";

interface EncryptionBadgeProps {
  /** Compact inline badge (default) or expanded card with details */
  variant?: "badge" | "card";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Encryption & Privacy Disclaimer Badge
 *
 * Displays a trust signal letting users know their data is
 * tokenized and encrypted with AES-256-GCM at rest and TLS in transit.
 */
export function EncryptionBadge({ variant = "badge", className = "" }: EncryptionBadgeProps) {
  if (variant === "card") {
    return (
      <div className={`rounded-lg border border-success/20 bg-success/5 p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-success/10 rounded-lg shrink-0">
            <Shield className="h-5 w-5 text-success" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-success" />
              Your data is encrypted &amp; tokenized
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All data we receive or access via your connected accounts (Google, Outlook, Calendly, etc.)
              is <strong>tokenized and encrypted using AES-256-GCM</strong> before storage.
              Sensitive information like phone numbers, emails, and client details are never stored
              in plain text. Payment data is handled exclusively by Stripe and never touches our servers.
              All connections use TLS encryption in transit.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 rounded-full px-2 py-0.5">
                <Lock className="h-2.5 w-2.5" /> AES-256 Encryption
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 rounded-full px-2 py-0.5">
                <Shield className="h-2.5 w-2.5" /> Data Tokenization
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 rounded-full px-2 py-0.5">
                <Lock className="h-2.5 w-2.5" /> TLS in Transit
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 rounded-full px-2 py-0.5">
                <Shield className="h-2.5 w-2.5" /> PCI Compliant (Stripe)
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Compact inline badge
  return (
    <div className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
      <Shield className="h-3.5 w-3.5 text-success" />
      <span>All data encrypted &amp; tokenized (AES-256)</span>
    </div>
  );
}
