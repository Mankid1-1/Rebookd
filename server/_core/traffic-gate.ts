/**
 * Traffic Gate Middleware — three-tier load shedding.
 *
 * NORMAL:   everyone through
 * HIGH:     authenticated users (session cookie) through, anonymous users get 503
 * CRITICAL: everyone gets 503
 */

import type { Request, Response, NextFunction } from "express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { trafficMonitor, TrafficLevel } from "./traffic-monitor";
import { BUSY_PAGE_HTML, BUSY_PAGE_JSON } from "./busy-page";
import { logger } from "./logger";

// Paths that always pass through (health probes, monitoring)
const BYPASS_PATHS = new Set(["/health", "/ready"]);

// Reference to the shutdown flag — set via setShutdownRef()
let isShuttingDownRef: { value: boolean } = { value: false };

export function setShutdownRef(ref: { value: boolean }) {
  isShuttingDownRef = ref;
}

function sendBusy(req: Request, res: Response) {
  const wantsJson =
    req.path.startsWith("/api/") ||
    req.headers.accept?.includes("application/json");

  res.status(503).set("Retry-After", "30");

  if (wantsJson) {
    res.json(BUSY_PAGE_JSON);
  } else {
    res.set("Content-Type", "text/html; charset=utf-8").send(BUSY_PAGE_HTML);
  }
}

function hasSessionCookie(req: Request): boolean {
  const raw = req.headers.cookie;
  if (!raw) return false;
  const cookies = parseCookieHeader(raw);
  return !!cookies[COOKIE_NAME];
}

export function trafficGateMiddleware(req: Request, res: Response, next: NextFunction) {
  // Always track connections for accurate metrics
  trafficMonitor.incrementConnections();
  let decremented = false;
  const decrement = () => {
    if (!decremented) {
      decremented = true;
      trafficMonitor.decrementConnections();
    }
  };
  res.on("finish", decrement);
  res.on("close", decrement);

  // Health probes always pass
  if (BYPASS_PATHS.has(req.path)) {
    return next();
  }

  // During graceful shutdown, reject all new requests
  if (isShuttingDownRef.value) {
    return sendBusy(req, res);
  }

  const level = trafficMonitor.getLevel();

  if (level === TrafficLevel.NORMAL) {
    return next();
  }

  if (level === TrafficLevel.HIGH) {
    if (hasSessionCookie(req)) {
      return next();
    }
    logger.info("Traffic gate: shedding anonymous request", {
      path: req.path,
      ip: req.ip,
      level,
    });
    return sendBusy(req, res);
  }

  // CRITICAL — shed everyone
  logger.warn("Traffic gate: shedding ALL requests (critical)", {
    path: req.path,
    ip: req.ip,
    level,
    ...trafficMonitor.getStats(),
  });
  return sendBusy(req, res);
}
