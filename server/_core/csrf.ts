import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// Only skip CSRF for webhook endpoints (which use their own signature verification).
// tRPC mutations (POST) now require CSRF tokens; tRPC queries (GET) are safe.
const SKIP_PATHS = ["/webhooks/", "/api/webhooks/"];
const STATE_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function csrfProtection() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF for webhook and tRPC endpoints
    if (SKIP_PATHS.some((p) => req.path.startsWith(p))) {
      return next();
    }

    const cookieHeader = req.headers.cookie;

    // On GET requests, set CSRF token cookie if not present
    if (req.method === "GET") {
      if (!parseCookie(cookieHeader, "_csrf")) {
        const token = crypto.randomBytes(32).toString("hex");
        res.cookie("_csrf", token, {
          httpOnly: false, // JS must read it to send in header
          sameSite: "strict",
          secure: process.env.NODE_ENV === "production",
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          path: "/",
        });
      }
      return next();
    }

    // On state-changing requests, validate CSRF token
    if (STATE_METHODS.has(req.method)) {
      const cookieToken = parseCookie(cookieHeader, "_csrf");
      const headerToken = req.headers["x-csrf-token"] as string | undefined;

      if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return res.status(403).json({ error: "CSRF token mismatch" });
      }
    }

    next();
  };
}

/**
 * Simple signup-specific rate limiter.
 * Limits signup attempts to 3 per hour per IP.
 */
const signupAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_SIGNUP_ENTRIES = 5_000;

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of signupAttempts) {
    if (entry.resetAt < now) signupAttempts.delete(ip);
  }
  // Hard cap
  if (signupAttempts.size > MAX_SIGNUP_ENTRIES) signupAttempts.clear();
}, 5 * 60 * 1000).unref();

export function signupRateLimit() {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const entry = signupAttempts.get(ip);

    if (entry) {
      if (entry.resetAt < now) {
        // Window expired, reset
        signupAttempts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
        return next();
      }
      if (entry.count >= 3) {
        return res.status(429).json({
          error: "Too many signup attempts. Please try again later.",
          retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        });
      }
      entry.count++;
    } else {
      signupAttempts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    }

    next();
  };
}
