/**
 * Core Web Vitals reporting — measures LCP, CLS, and INP and reports
 * to the existing sentinel metric endpoint for monitoring.
 *
 * Loaded lazily from main.tsx so it never blocks the initial render.
 */
import type { Metric } from "web-vitals";

function reportMetric(metric: Metric) {
  // Endpoint expects { category, metrics: [{ metric, value, detail }] }
  const body = JSON.stringify({
    category: "web-vitals",
    metrics: [{
      metric: metric.name,
      value: metric.value,
      detail: {
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        url: window.location.pathname,
      },
    }],
  });

  // sendBeacon must use a Blob to set Content-Type; plain string sends as text/plain
  // which bypasses Express's JSON body parser and arrives as empty req.body
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/system/sentinel-metric", new Blob([body], { type: "application/json" }));
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
