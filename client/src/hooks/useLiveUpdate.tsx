import { useEffect, useRef, useState, useCallback } from "react";
import { BUILD_VERSION } from "@shared/version";

const POLL_INTERVAL_MS = 60_000; // check every 60 seconds

/**
 * Polls /api/version and detects when the server has been updated.
 * Returns `updateAvailable: true` when the running client code is stale.
 */
export function useLiveUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (
        data.version &&
        BUILD_VERSION !== "dev" &&
        data.version !== BUILD_VERSION
      ) {
        setUpdateAvailable(true);
      }
    } catch {
      // Network error — ignore, will retry next interval
    }
  }, []);

  useEffect(() => {
    // Don't poll in development
    if (BUILD_VERSION === "dev") return;

    // Initial check after a short delay (don't block startup)
    const initialTimeout = setTimeout(checkVersion, 5_000);
    timerRef.current = setInterval(checkVersion, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [checkVersion]);

  const refresh = useCallback(() => {
    // Hard reload — bust every cache
    window.location.reload();
  }, []);

  return { updateAvailable, refresh };
}
