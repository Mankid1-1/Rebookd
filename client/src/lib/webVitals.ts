/**
 * Core Web Vitals reporting — measures LCP, CLS, and INP and reports
 * to the existing sentinel metric endpoint for monitoring.
 *
 * Loaded lazily from main.tsx so it never blocks the initial render.
 */
import type { Metric } from "web-vitals";

function reportMetric(metric: Metric) {
  // Fire-and-forget beacon to the sentinel metrics endpoint
  const body = JSON.stringify({
    source: "web-vitals",
    metric: metric.name,
    value: metric.value,
    rating: metric.rating, // "good" | "needs-improvement" | "poor"
    delta: metric.delta,
    id: metric.id,
    url: window.location.pathname,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/system/sentinel-metric", body);
  } else {
    fetch("/api/system/sentinel-metric", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  }
}

export async function initWebVitals() {
  const { onCLS, onINP, onLCP } = await import("web-vitals");
  onCLS(reportMetric);
  onINP(reportMetric);
  onLCP(reportMetric);
}
