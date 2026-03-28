import { useLiveUpdate } from "@/hooks/useLiveUpdate";
import { RefreshCw } from "lucide-react";

/**
 * Non-intrusive banner that appears at the top of the page when a new
 * version of Rebooked has been deployed. Clicking it hard-refreshes the
 * page so the user gets the latest code + UI without any interruption.
 */
export function LiveUpdateBanner() {
  const { updateAvailable, refresh } = useLiveUpdate();

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-3 bg-[#00A896] text-white px-4 py-2 text-sm font-medium shadow-lg animate-in slide-in-from-top duration-300">
      <RefreshCw className="h-4 w-4 animate-spin" />
      <span>A new version of Rebooked is available.</span>
      <button
        onClick={refresh}
        className="underline underline-offset-2 font-semibold hover:opacity-80 transition-opacity"
      >
        Refresh now
      </button>
    </div>
  );
}
