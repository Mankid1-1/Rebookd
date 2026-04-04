/**
 * Production-Grade Security Hardening Module
 *
 * Provides defense-in-depth middleware for:
 *   - Security response headers (CSP, HSTS, etc.)
 *   - Recursive input sanitization with injection detection
 *   - Endpoint-specific rate limiting
 *   - CORS origin validation
 *   - Audit logging to adminAuditLogs
 *   - Request size enforcement
 *   - IP-based brute-force protection with temporary bans
 */

import { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger } from "./logger";
import { getDb } from "../db";
import { adminAuditLogs } from "../../drizzle/schema";

// ─── Configuration ───────────────────────────────────────────────────────────

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_DEV = process.env.NODE_ENV === "development";

const CORS_ORIGINS =
  process.env.CORS_ORIGIN?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];
const ALLOWED_ORIGINS =
  process.env.ALLOWED_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];
const ALL_ALLOWED_ORIGINS = [...new Set([...CORS_ORIGINS, ...ALLOWED_ORIGINS])];

/** Paths that should skip input sanitization (webhook routes needing raw body) */
const SANITIZATION_SKIP_PATHS = [
  "/api/stripe/webhook",
  "/api/webhooks/stripe",
  "/api/inbound-sms",
  "/api/webhooks/telnyx",
  "/api/webhooks/twilio",
  "/api/auth/verify-email",  // Clicked from email - no Origin header
  "/api/auth/signin",        // Server-rendered login form POST
  "/api/calendar/",          // OAuth callbacks from Google/Outlook/Calendly — redirects have no Origin
  "/api/version",            // Health check from curl/monitoring
  "/api/health",             // Health check endpoint
  "/api/trpc/ai.",           // AI chat/generation: user text naturally contains patterns that false-positive
  "/api/system/client-error", // Client-side telemetry (dead clicks, CLS) — contains selectors/URLs that false-positive
  "/api/system/deploy-record", // Internal deploy script call from localhost — no Origin header
];

// ─── Security Headers ────────────────────────────────────────────────────────

function buildCsp(): string {
  // Base directives safe for production
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "https://www.redditstatic.com", "https://alb.reddit.com", "https://cloud.umami.is", "https://www.googletagmanager.com", "https://www.google-analytics.com", "https://static.cloudflareinsights.com"],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "img-src": ["'self'", "data:", "https:", "https://www.redditstatic.com", "https://www.google-analytics.com", "https://www.googletagmanager.com"],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    "connect-src": ["'self'", "https://api.stripe.com", "https://maps.googleapis.com", "https://alb.reddit.com", "https://www.redditstatic.com", "https://cloud.umami.is", "https://api-gateway.umami.dev", "https://pixel-config.reddit.com", "https://www.google-analytics.com", "https://www.googletagmanager.com", "https://analytics.google.com", "https://cloudflareinsights.com"],
    "frame-src": ["https://js.stripe.com", "https://hooks.stripe.com"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "upgrade-insecure-requests": [],
  };

  // In development, allow Vite HMR websocket
  if (IS_DEV) {
    directives["connect-src"].push("ws://localhost:*", "ws://127.0.0.1:*", "http://localhost:*");
    delete directives["upgrade-insecure-requests"];
  }

  return Object.entries(directives)
    .map(([key, values]) => (values.length > 0 ? `${key} ${values.join(" ")}` : key))
    .join("; ");
}

const CSP_HEADER = buildCsp();

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Content-Security-Policy", CSP_HEADER);

  // Prevent MIME-type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Clickjacking protection
  res.setHeader("X-Frame-Options", "DENY");

  // XSS filter (legacy browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // HSTS with preload
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Feature / Permissions policy
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  // Cross-origin policy:
  // - API routes stay "same-site" (no reason for cross-origin APIs to be loaded by other sites)
  // - HTML pages use "cross-origin" so third-party pixels (Reddit, Meta, etc.) can operate
  const corp = req.path.startsWith("/api/") ? "same-site" : "cross-origin";
  res.setHeader("Cross-Origin-Resource-Policy", corp);
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

  // Cache-Control for API responses (prevent caching sensitive data)
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache");
    res.setHeader("Pragma", "no-cache");
  }

  // Unique request ID for tracing and audit
  const requestId =
    (res.getHeader("x-request-id") as string) || crypto.randomUUID();
  res.setHeader("X-Request-ID", requestId);
  (req as any).requestId = requestId;

  next();
}

// ─── Input Sanitization ──────────────────────────────────────────────────────

/** Strip HTML tags from a string */
function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

/** SQL injection patterns (defense-in-depth; parameterized queries are primary defense) */
const SQL_PATTERNS: RegExp[] = [
  /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|EXECUTE)\b\s)/i,
  /(\b(OR|AND)\b\s+[\w'"]+\s*=\s*[\w'"]+)/i,
  /(--\s|\/\*)/,  // SQL comments (-- with space, or /* block). # removed — too many false positives on URLs
  /(\bWAITFOR\b\s+\bDELAY\b)/i,
  /(\bBENCHMARK\b\s*\()/i,
  /(\bSLEEP\b\s*\()/i,
  /(;\s*(DROP|ALTER|CREATE|TRUNCATE)\b)/i,
  /('\s*(OR|AND)\s+')/i,
];

/** NoSQL injection patterns */
const NOSQL_PATTERNS: RegExp[] = [
  /\$where/i,
  /\$regex/i,
  /\$ne/i,
  /\$gt/i,
  /\$lt/i,
  /\$gte/i,
  /\$lte/i,
  /\$in\b/i,
  /\$nin/i,
  /\$or\b/i,
  /\$and\b/i,
  /\$not\b/i,
  /\$exists/i,
  /\$elemMatch/i,
];

/** XSS payload patterns */
const XSS_PATTERNS: RegExp[] = [
  /javascript\s*:/i,
  /on(load|error|click|mouseover|focus|blur|submit|change|input)\s*=/i,
  /<\s*script/i,
  /<\s*iframe/i,
  /<\s*object/i,
  /<\s*embed/i,
  /<\s*svg[^>]*\bon/i,
  /data\s*:\s*text\/html/i,
  /vbscript\s*:/i,
  /expression\s*\(/i,
];

/** Path traversal patterns */
const PATH_TRAVERSAL_PATTERNS: RegExp[] = [
  /\.\.\//,
  /\.\.\\/,
  /%2e%2e/i,
  /%252e%252e/i,
  /\.\.%2f/i,
  /\.\.%5c/i,
];

/** Command injection patterns */
const COMMAND_INJECTION_PATTERNS: RegExp[] = [
  /[;&|`$]\s*(cat|ls|dir|rm|mv|cp|wget|curl|bash|sh|cmd|powershell|nc|ncat)\b/i,
  /\$\(.*\)/,
  /`[^`]*`/,
  /\|\s*(cat|ls|dir|rm|bash|sh)\b/i,
  />\s*\/?(etc|tmp|dev|proc)\//i,
];

type InjectionType = "sql" | "nosql" | "xss" | "path_traversal" | "command_injection";

interface InjectionCheckResult {
  detected: boolean;
  type?: InjectionType;
}

function detectInjection(value: string): InjectionCheckResult {
  for (const p of SQL_PATTERNS) {
    if (p.test(value)) return { detected: true, type: "sql" };
  }
  for (const p of NOSQL_PATTERNS) {
    if (p.test(value)) return { detected: true, type: "nosql" };
  }
  for (const p of XSS_PATTERNS) {
    if (p.test(value)) return { detected: true, type: "xss" };
  }
  for (const p of PATH_TRAVERSAL_PATTERNS) {
    if (p.test(value)) return { detected: true, type: "path_traversal" };
  }
  for (const p of COMMAND_INJECTION_PATTERNS) {
    if (p.test(value)) return { detected: true, type: "command_injection" };
  }
  return { detected: false };
}

/** Recursively sanitize all string values in an object */
export function sanitizeObject(
  obj: any,
  context?: { ip?: string; path?: string },
): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    const stripped = stripHtmlTags(obj);
    const check = detectInjection(stripped);
    if (check.detected) {
      logger.warn("Blocked injection attempt", {
        type: check.type,
        input: stripped.substring(0, 120),
        ip: context?.ip,
        path: context?.path,
      });
      // Log security event asynchronously
      logSecurityEvent("injection_attempt_blocked", {
        type: check.type,
        input: stripped.substring(0, 120),
        ip: context?.ip,
        path: context?.path,
      }).catch(() => {});
      // Strip the dangerous content
      return stripped
        .replace(/<[^>]*>/g, "")
        .replace(/\$\w+/g, "")
        .replace(/(--|\/\*|\*\/)/g, "");
    }
    // Auto-tokenize any credit card numbers that slip through input fields
    const cardPattern = /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/;
    if (cardPattern.test(stripped)) {
      logger.warn("Auto-tokenized credit card number in request input", {
        ip: context?.ip,
        path: context?.path,
      });
      return stripped.replace(cardPattern, "[REDACTED]");
    }
    return stripped;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, context));
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      // Block object keys that start with $ (NoSQL operator injection)
      if (key.startsWith("$")) {
        logger.warn("Blocked NoSQL injection key", { key, ip: context?.ip });
        continue;
      }
      sanitized[key] = sanitizeObject(obj[key], context);
    }
    return sanitized;
  }

  return obj;
}

export function inputSanitization(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Skip sanitization for webhook routes that need raw/unmodified body
  if (SANITIZATION_SKIP_PATHS.some((p) => req.path.startsWith(p))) {
    return next();
  }

  const context = { ip: req.ip || "unknown", path: req.path };

  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body, context);
  }

  // Also sanitize query params
  if (req.query && typeof req.query === "object") {
    req.query = sanitizeObject(req.query, context);
  }

  next();
}

// ─── Rate Limiting ───────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStores = {
  auth: new Map<string, RateLimitEntry>(),
  api: new Map<string, RateLimitEntry>(),
  webhook: new Map<string, RateLimitEntry>(),
  upload: new Map<string, RateLimitEntry>(),
  sms: new Map<string, RateLimitEntry>(),
  export: new Map<string, RateLimitEntry>(),
  ai: new Map<string, RateLimitEntry>(),
};

// Periodically clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const store of Object.values(rateLimitStores)) {
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }
}, 5 * 60 * 1000).unref();

function checkRateLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  windowMs: number,
  maxRequests: number,
): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining: maxRequests - entry.count, retryAfter: 0 };
}

function sendRateLimitHeaders(
  res: Response,
  limit: number,
  remaining: number,
  retryAfter: number,
): void {
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  if (retryAfter > 0) {
    res.setHeader("Retry-After", String(retryAfter));
  }
}

/** Auth endpoints: rate-limited per IP (brute force protection) */
export function authRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Only rate-limit mutating auth endpoints (POST), not session checks (GET /auth.me)
  // Matches both REST paths (/api/auth/signin) and tRPC paths (/api/trpc/auth.login)
  if (req.method !== "POST" ||
    !req.path.startsWith("/api/") ||
    !req.path.match(
      /\/(signin|signup|register|reset-password|forgot-password)|auth\.(login|signup|requestPasswordReset|resetPassword)/i,
    )
  ) {
    return next();
  }

  const key = req.ip || "unknown";
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = process.env.NODE_ENV === "production" ? 5 : 50;
  const result = checkRateLimit(rateLimitStores.auth, key, windowMs, maxRequests);

  sendRateLimitHeaders(res, maxRequests, result.remaining, result.retryAfter);

  if (!result.allowed) {
    logger.warn("Auth rate limit exceeded", { ip: key, path: req.path });
    logSecurityEvent("auth_rate_limit_exceeded", {
      ip: key,
      path: req.path,
    }).catch(() => {});
    res.status(429).json({
      error: "Too many authentication attempts. Please try again later.",
      retryAfter: result.retryAfter,
    });
    return;
  }

  next();
}

/** API general: 600 requests per 5 minutes per IP */
export function apiRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.path.startsWith("/api/")) {
    return next();
  }

  const key = req.ip || "unknown";
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const maxRequests = 600;
  const result = checkRateLimit(rateLimitStores.api, key, windowMs, maxRequests);

  sendRateLimitHeaders(res, maxRequests, result.remaining, result.retryAfter);

  if (!result.allowed) {
    logger.warn("API rate limit exceeded", { ip: key, path: req.path });
    res.status(429).json({
      error: "Too many requests. Please try again later.",
      retryAfter: result.retryAfter,
    });
    return;
  }

  next();
}

/** Webhook endpoints: 1000 requests per 5 minutes per IP */
export function webhookRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!SANITIZATION_SKIP_PATHS.some((p) => req.path.startsWith(p))) {
    return next();
  }

  const key = req.ip || "unknown";
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const maxRequests = 1000;
  const result = checkRateLimit(rateLimitStores.webhook, key, windowMs, maxRequests);

  sendRateLimitHeaders(res, maxRequests, result.remaining, result.retryAfter);

  if (!result.allowed) {
    logger.warn("Webhook rate limit exceeded", { ip: key, path: req.path });
    res.status(429).json({
      error: "Too many webhook requests.",
      retryAfter: result.retryAfter,
    });
    return;
  }

  next();
}

/** File upload: 10 requests per minute per IP */
export function uploadRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.path.match(/\/(upload|import|file)/i)) {
    return next();
  }

  // Only limit POST/PUT (actual uploads)
  if (req.method !== "POST" && req.method !== "PUT") {
    return next();
  }

  const key = req.ip || "unknown";
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10;
  const result = checkRateLimit(rateLimitStores.upload, key, windowMs, maxRequests);

  sendRateLimitHeaders(res, maxRequests, result.remaining, result.retryAfter);

  if (!result.allowed) {
    logger.warn("Upload rate limit exceeded", { ip: key, path: req.path });
    res.status(429).json({
      error: "Too many upload requests. Please try again later.",
      retryAfter: result.retryAfter,
    });
    return;
  }

  next();
}

/** SMS sending: 10 requests per minute per tenant (prevents abuse) */
export function smsRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.path.match(/\/(send-sms|messages\.send|sms\.send)/i)) {
    return next();
  }
  if (req.method !== "POST") return next();

  const tenantId = (req as any).user?.tenantId || req.ip || "unknown";
  const key = `sms:${tenantId}`;
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10;
  const result = checkRateLimit(rateLimitStores.sms, key, windowMs, maxRequests);

  sendRateLimitHeaders(res, maxRequests, result.remaining, result.retryAfter);

  if (!result.allowed) {
    logger.warn("SMS rate limit exceeded", { tenantId, path: req.path });
    res.status(429).json({
      error: "SMS sending rate limit exceeded. Please try again later.",
      retryAfter: result.retryAfter,
    });
    return;
  }
  next();
}

/** Data export: 5 requests per minute per tenant */
export function exportRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.path.match(/\/(export|download|csv)/i)) {
    return next();
  }

  const tenantId = (req as any).user?.tenantId || req.ip || "unknown";
  const key = `export:${tenantId}`;
  const windowMs = 60 * 1000;
  const maxRequests = 5;
  const result = checkRateLimit(rateLimitStores.export, key, windowMs, maxRequests);

  sendRateLimitHeaders(res, maxRequests, result.remaining, result.retryAfter);

  if (!result.allowed) {
    logger.warn("Export rate limit exceeded", { tenantId, path: req.path });
    res.status(429).json({
      error: "Export rate limit exceeded. Please try again later.",
      retryAfter: result.retryAfter,
    });
    return;
  }
  next();
}

/** AI endpoints: 20 requests per minute per tenant */
export function aiRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.path.match(/\/ai\./i) && !req.path.match(/\/trpc\/ai\./i)) {
    return next();
  }

  const tenantId = (req as any).user?.tenantId || req.ip || "unknown";
  const key = `ai:${tenantId}`;
  const windowMs = 60 * 1000;
  const maxRequests = 20;
  const result = checkRateLimit(rateLimitStores.ai, key, windowMs, maxRequests);

  sendRateLimitHeaders(res, maxRequests, result.remaining, result.retryAfter);

  if (!result.allowed) {
    logger.warn("AI rate limit exceeded", { tenantId, path: req.path });
    res.status(429).json({
      error: "AI request rate limit exceeded. Please try again later.",
      retryAfter: result.retryAfter,
    });
    return;
  }
  next();
}

// ─── CORS Hardening ──────────────────────────────────────────────────────────

export function corsHardening(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const origin = req.headers.origin;

  // If configured origins exist, enforce strict validation
  if (ALL_ALLOWED_ORIGINS.length > 0) {
    if (origin && ALL_ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    } else if (origin) {
      // Origin not in whitelist -- do not set CORS headers (browser blocks)
      logger.warn("CORS blocked request from disallowed origin", {
        origin,
        path: req.path,
      });
    } else if (IS_PRODUCTION && req.path.startsWith("/api/")) {
      // In production, block API requests with no Origin header
      // (allows server-to-server via webhook skip paths)
      // Also allow same-origin requests where browser sends Referer but not Origin (GET requests)
      const referer = req.headers.referer || req.headers.referrer;
      const refererStr = Array.isArray(referer) ? referer[0] : referer;
      const isSameOriginReferer = refererStr && ALL_ALLOWED_ORIGINS.some((o) => refererStr.startsWith(o));
      const isSkipPath = SANITIZATION_SKIP_PATHS.some((p) => req.path.startsWith(p));
      if (!isSkipPath && !isSameOriginReferer) {
        logger.warn("Blocked request with no Origin header in production", {
          path: req.path,
          ip: req.ip,
        });
        res.status(403).json({ error: "Forbidden: missing Origin header" });
        return;
      }
    }
  }

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Request-ID, X-Correlation-ID",
    );
    res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours
    res.sendStatus(204);
    return;
  }

  next();
}

// ─── Request Size Limiting ───────────────────────────────────────────────────

const SIZE_2MB = 2 * 1024 * 1024;
const SIZE_10MB = 10 * 1024 * 1024;

export function bodySizeLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Skip webhook routes (they have their own body handling)
  if (SANITIZATION_SKIP_PATHS.some((p) => req.path.startsWith(p))) {
    return next();
  }

  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  const contentType = req.headers["content-type"] || "";

  // Multipart (file uploads): 10MB
  if (contentType.includes("multipart/form-data")) {
    if (contentLength > SIZE_10MB) {
      logger.warn("Multipart request body too large", {
        path: req.path,
        contentLength,
      });
      res.status(413).json({
        error: "Request body too large. Maximum size for file uploads is 10MB.",
      });
      return;
    }
    return next();
  }

  // JSON and URL-encoded: 2MB
  if (contentLength > SIZE_2MB) {
    logger.warn("Request body too large", { path: req.path, contentLength });
    res.status(413).json({
      error: "Request body too large. Maximum size is 2MB.",
    });
    return;
  }

  next();
}

// ─── IP-Based Brute Force Protection ─────────────────────────────────────────

interface FailedAttemptEntry {
  attempts: number;
  firstAttemptAt: number;
  bannedUntil: number | null;
}

const failedAuthAttempts = new Map<string, FailedAttemptEntry>();

const IP_BAN_THRESHOLD = 10; // failed attempts
const IP_BAN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const IP_BAN_DURATION_MS = 15 * 60 * 1000; // 15 minutes ban

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of failedAuthAttempts.entries()) {
    const windowExpired = now - entry.firstAttemptAt > IP_BAN_WINDOW_MS;
    const banExpired = entry.bannedUntil !== null && entry.bannedUntil <= now;
    if (windowExpired && (entry.bannedUntil === null || banExpired)) {
      failedAuthAttempts.delete(ip);
    }
  }
}, 10 * 60 * 1000).unref();

/**
 * Record a failed authentication attempt for an IP.
 * Call this from your auth routes when login/register fails.
 */
export function recordFailedAuth(ip: string): void {
  const now = Date.now();
  const entry = failedAuthAttempts.get(ip);

  if (!entry || now - entry.firstAttemptAt > IP_BAN_WINDOW_MS) {
    failedAuthAttempts.set(ip, {
      attempts: 1,
      firstAttemptAt: now,
      bannedUntil: null,
    });
    return;
  }

  entry.attempts++;

  if (entry.attempts >= IP_BAN_THRESHOLD) {
    entry.bannedUntil = now + IP_BAN_DURATION_MS;
    logger.warn("IP temporarily banned due to excessive failed auth attempts", {
      ip,
      attempts: entry.attempts,
      bannedUntil: new Date(entry.bannedUntil).toISOString(),
    });
    logSecurityEvent("ip_banned", {
      ip,
      attempts: entry.attempts,
      reason: "excessive_failed_auth",
    }).catch(() => {});
  }
}

/** Clear failed attempts on successful auth */
export function clearFailedAuth(ip: string): void {
  failedAuthAttempts.delete(ip);
}

/** Middleware that blocks temporarily banned IPs */
export function ipBanProtection(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const ip = req.ip || "unknown";
  const entry = failedAuthAttempts.get(ip);

  if (entry?.bannedUntil) {
    const now = Date.now();
    if (entry.bannedUntil > now) {
      const retryAfter = Math.ceil((entry.bannedUntil - now) / 1000);
      logger.warn("Blocked request from banned IP", { ip, path: req.path });
      res.setHeader("Retry-After", String(retryAfter));
      res.status(403).json({
        error:
          "Your IP has been temporarily blocked due to suspicious activity. Please try again later.",
        retryAfter,
      });
      return;
    }
    // Ban expired, clear entry
    failedAuthAttempts.delete(ip);
  }

  next();
}

// ─── Audit Logging ───────────────────────────────────────────────────────────

/**
 * Write an audit log entry to the adminAuditLogs table.
 * Failures are logged but never crash the application.
 */
export async function auditLog(
  action: string,
  userId: number,
  details: Record<string, any>,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      logger.error("Audit log failed: database not available", {
        action,
        userId,
      });
      return;
    }

    // Skip DB insert if no valid userId — FK constraint requires a real user
    if (!userId) {
      logger.debug("Audit log skipped (no userId)", { action, path: details.path });
      return;
    }

    await db.insert(adminAuditLogs).values({
      adminUserId: userId,
      action,
      route: details.path || details.route || null,
      metadata: {
        ...details,
        timestamp: new Date().toISOString(),
        source: "security-audit",
      },
    });

    logger.info("Audit log recorded", { action, userId });
  } catch (error) {
    // Audit logging failures must never crash the application
    logger.error("Failed to write audit log", {
      action,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Log a security event (blocked requests, injection attempts, bans).
 * Uses userId=0 as a system-level event.
 */
async function logSecurityEvent(
  action: string,
  details: Record<string, any>,
): Promise<void> {
  await auditLog(`security:${action}`, 0, details);
}

/** Middleware that logs authentication and admin actions */
export function auditLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Only audit API routes
  if (!req.path.startsWith("/api/")) {
    return next();
  }

  // Skip health checks
  if (req.path === "/health" || req.path === "/ready") {
    return next();
  }

  const userId = (req as any).user?.id || 0;
  const startTime = Date.now();

  // Capture response status after completion
  const originalEnd = res.end;
  res.end = function (this: Response, ...args: any[]) {
    const duration = Date.now() - startTime;

    // Determine if this is a notable event worth auditing
    const isAuthEvent = /\/(auth|login|register|logout|reset-password|forgot-password)/i.test(
      req.path,
    );
    const isAdminAction = /\/admin/i.test(req.path);
    const isMutatingMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(
      req.method,
    );
    const isSecurityRelevant =
      (isAuthEvent && isMutatingMethod) || isAdminAction || (isMutatingMethod && userId > 0);

    if (isSecurityRelevant) {
      const eventAction = isAuthEvent
        ? "auth_event"
        : isAdminAction
          ? "admin_action"
          : "api_access";

      auditLog(eventAction, userId, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        requestId: (req as any).requestId,
        correlationId: (req as any).correlationId,
      }).catch(() => {
        // Already logged inside auditLog
      });
    }

    return originalEnd.apply(this, args as any);
  } as any;

  next();
}

// ─── Register All Security Middleware ─────────────────────────────────────────

/**
 * Registers all security middleware on the Express app in the correct order.
 *
 * Call this after Stripe webhook routes are registered (they need raw body)
 * but before other route handlers.
 */
export function registerSecurityMiddleware(app: Express): void {
  logger.info("Registering security middleware");

  // 1. Security headers on all responses
  app.use(securityHeaders);

  // 2. IP ban protection (early exit for banned IPs)
  app.use(ipBanProtection);

  // 3. CORS hardening
  if (ALL_ALLOWED_ORIGINS.length > 0 || IS_PRODUCTION) {
    app.use(corsHardening);
  }

  // 4. Request body size enforcement
  app.use(bodySizeLimit);

  // 5. Input sanitization (skips webhook routes)
  app.use(inputSanitization);

  // 6. Rate limiting by endpoint category
  app.use(authRateLimit);
  app.use(apiRateLimit);
  app.use(webhookRateLimit);
  app.use(uploadRateLimit);
  app.use(smsRateLimit);
  app.use(exportRateLimit);
  app.use(aiRateLimit);

  // 7. Audit logging for authentication, admin, and data-access events
  app.use(auditLoggingMiddleware);

  logger.info("Security middleware registered successfully");
}
