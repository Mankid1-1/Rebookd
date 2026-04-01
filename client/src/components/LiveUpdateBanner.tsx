import { useLiveUpdate } from "@/hooks/useLiveUpdate";
import { RefreshCw, X } from "lucide-react";
import { useState } from "react";

/**
 * Non-intrusive banner that appears at the top of the page when a new
 * version of Rebooked has been deployed. Clicking it hard-refreshes the
 * page so the user gets the latest code + UI without any interruption.
 * Users can dismiss it; it reappears if another deploy happens.
 */
export function LiveUpdateBanner() {
  const { updateAvailable, refresh } = useLiveUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-3 bg-gradient-to-r from-primary to-primary/80 text-white px-4 py-2.5 text-sm font-medium shadow-lg animate-in slide-in-from-top duration-300">
      <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
      <span>A new version of Rebooked is available.</span>
      <button
        onClick={refresh}
        className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-xs font-semibold transition-colors"
      >
        Refresh now
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="ml-1 p-1 hover:bg-white/20 rounded-full transition-colors shrink-0"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
