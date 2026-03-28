/**
 * Traffic Monitor — tracks real-time server load signals
 * for three-tier load shedding decisions.
 */

import { logger } from "./logger";

export enum TrafficLevel {
  NORMAL = "normal",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface TrafficStats {
  activeConnections: number;
  eventLoopLagMs: number;
  heapUsagePercent: number;
  level: TrafficLevel;
}

interface Thresholds {
  highConnections: number;
  criticalConnections: number;
  highLoopLagMs: number;
  criticalLoopLagMs: number;
  highHeapPercent: number;
  criticalHeapPercent: number;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

class TrafficMonitor {
  private activeConnections = 0;
  private eventLoopLagMs = 0;
  private heapUsagePercent = 0;
  private lastLevel: TrafficLevel = TrafficLevel.NORMAL;
  private sampleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSampleTime = Date.now();

  private thresholds: Thresholds;

  constructor() {
    this.thresholds = {
      highConnections: envInt("TRAFFIC_HIGH_CONNECTIONS", 150),
      criticalConnections: envInt("TRAFFIC_CRITICAL_CONNECTIONS", 300),
      highLoopLagMs: envInt("TRAFFIC_HIGH_LOOP_LAG_MS", 100),
      criticalLoopLagMs: envInt("TRAFFIC_CRITICAL_LOOP_LAG_MS", 500),
      highHeapPercent: envInt("TRAFFIC_HIGH_HEAP_PERCENT", 80),
      criticalHeapPercent: envInt("TRAFFIC_CRITICAL_HEAP_PERCENT", 92),
    };
    this.startSampling();
  }

  private startSampling() {
    const sample = () => {
      const now = Date.now();
      // Event loop lag = actual elapsed - expected elapsed (500ms)
      this.eventLoopLagMs = Math.max(0, now - this.lastSampleTime - 500);

      const mem = process.memoryUsage();
      this.heapUsagePercent = mem.heapTotal > 0
        ? Math.round((mem.heapUsed / mem.heapTotal) * 100)
        : 0;

      // Log level transitions
      const newLevel = this.computeLevel();
      if (newLevel !== this.lastLevel) {
        logger.warn("Traffic level changed", {
          from: this.lastLevel,
          to: newLevel,
          connections: this.activeConnections,
          loopLagMs: this.eventLoopLagMs,
          heapPercent: this.heapUsagePercent,
        });
        this.lastLevel = newLevel;
      }

      this.lastSampleTime = Date.now();
      this.sampleTimer = setTimeout(sample, 500);
      // Don't let the sampling timer keep the process alive
      if (this.sampleTimer.unref) this.sampleTimer.unref();
    };

    this.lastSampleTime = Date.now();
    this.sampleTimer = setTimeout(sample, 500);
    if (this.sampleTimer.unref) this.sampleTimer.unref();
  }

  private computeLevel(): TrafficLevel {
    const t = this.thresholds;

    // Critical if ANY signal is critical
    if (
      this.activeConnections >= t.criticalConnections ||
      this.eventLoopLagMs >= t.criticalLoopLagMs ||
      this.heapUsagePercent >= t.criticalHeapPercent
    ) {
      return TrafficLevel.CRITICAL;
    }

    // High if ANY signal is high
    if (
      this.activeConnections >= t.highConnections ||
      this.eventLoopLagMs >= t.highLoopLagMs ||
      this.heapUsagePercent >= t.highHeapPercent
    ) {
      return TrafficLevel.HIGH;
    }

    return TrafficLevel.NORMAL;
  }

  incrementConnections() {
    this.activeConnections++;
  }

  decrementConnections() {
    if (this.activeConnections > 0) this.activeConnections--;
  }

  getLevel(): TrafficLevel {
    return this.computeLevel();
  }

  getStats(): TrafficStats {
    return {
      activeConnections: this.activeConnections,
      eventLoopLagMs: this.eventLoopLagMs,
      heapUsagePercent: this.heapUsagePercent,
      level: this.computeLevel(),
    };
  }

  stop() {
    if (this.sampleTimer) {
      clearTimeout(this.sampleTimer);
      this.sampleTimer = null;
    }
  }
}

export const trafficMonitor = new TrafficMonitor();
