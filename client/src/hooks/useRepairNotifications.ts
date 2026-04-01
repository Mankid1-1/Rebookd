/**
 * Hook for real-time repair notifications via WebSocket.
 * Listens for sentinel events and shows toast notifications.
 */

import { useEffect } from "react";
import { toast } from "sonner";
import { useWebSocket } from "./useWebSocket";

export function useRepairNotifications() {
  const { lastEvent } = useWebSocket();

  useEffect(() => {
    if (!lastEvent) return;

    const { type, data } = lastEvent as { type: string; data: any };

    switch (type) {
      case "repair_completed":
        toast.success("Automated fix deployed", {
          description: `Repair #${data?.jobId} for ${data?.errorType} error was fixed automatically.`,
          duration: 8000,
        });
        break;

      case "repair_failed":
        toast.error("Automated repair failed", {
          description: `Repair #${data?.jobId} could not be fixed. Escalated for manual review.`,
          duration: 10000,
        });
        break;

      case "feature_disabled":
        toast.warning("Feature temporarily disabled", {
          description: `The ${data?.feature} feature was disabled due to repeated failures. Check Admin Repairs.`,
          duration: 12000,
        });
        break;
    }
  }, [lastEvent]);
}
