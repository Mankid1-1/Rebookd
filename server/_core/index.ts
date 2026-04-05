import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerInboundWebhooks } from "./inboundWebhook";
import { registerCallWebhooks } from "../api/call-webhooks";
import { registerFunnelTrackEndpoint } from "../api/funnel-track";
import { registerSitemapEndpoint } from "../api/sitemap";
import { registerStripeWebhook } from "./stripe";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getDb, pingDb } from "../db";
import * as SystemService from "../services/system.service";
import { logger } from "./logger";
import { initSentry, captureException } from "./sentry";
import { ensureCorrelationId, runWithCorrelationId } from "./requestContext";
import { registerSecurityMiddleware } from "./security";
import { registerCalendarCallbacks } from "./calendarCallback";
import { widgetRouter } from "../api/widget";
import { registerSupportTicketEndpoint } from "../api/support-ticket";
import { readFileSync } from "fs";
import { trafficGateMiddleware, setShutdownRef } from "./traffic-gate";
import { validateEnv } from "./env";
import { BUILD_VERSION } from "../../shared/version";
import * as DeploymentService from "../services/deployment.service";

// Graceful shutdown state — shared with traffic gate
const shutdownState = { value: false };
let isShuttingDown = false;
const shutdownTimeoutMs = 30000; // 30 seconds timeout

const corsOrigins = [
  ...process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean) ?? [],
  ...process.env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [],
].filter((v, i, a) => a.indexOf(v) === i);

import { tmpdir as _tmpdir } from "os";
const WORKER_HEARTBEAT_FILE = process.env.WORKER_HEARTBEAT_FILE || `${_tmpdir()}/worker-heartbeat.json`;
const WORKER_STALE_MS = 2 * 60_000;

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  // In Docker/production, always use the specified port
  if (process.env.NODE_ENV === "production" || !!process.env.DOCKER_ENV) {
    return startPort;
  }
  
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// Graceful shutdown handler
async function gracefulShutdown(server: any, signal: string) {
  if (isShuttingDown) {
    logger.warn("Shutdown already in progress, ignoring signal", { signal });
    return;
  }

  isShuttingDown = true;
  shutdownState.value = true;
  logger.info("Starting graceful shutdown", { signal, timeout: shutdownTimeoutMs });

  try {
    // Set a timeout to force shutdown if graceful shutdown takes too long
    const shutdownTimeout = setTimeout(() => {
      logger.error("Graceful shutdown timeout, forcing exit", { signal });
      process.exit(1);
    }, shutdownTimeoutMs);

    // Stop accepting new connections
    server.close(async (err: any) => {
      if (err) {
        logger.error("Error closing server", { error: err.message });
        clearTimeout(shutdownTimeout);
        process.exit(1);
      }

      logger.info("Server stopped accepting new connections");

      try {
        // Close database connections
        const db = await getDb();
        if (db && db.$client) {
          logger.info("Closing database connections");
          await db.$client.end();
        }

        // Log successful shutdown
        logger.info("Graceful shutdown completed successfully", { signal });
        clearTimeout(shutdownTimeout);
        process.exit(0);
      } catch (dbError) {
        logger.error("Error closing database connections", { error: (dbError as Error).message });
        clearTimeout(shutdownTimeout);
        process.exit(1);
      }
    });

    // Handle any active connections that don't close gracefully
    server.on('close', () => {
      logger.info("All connections closed");
    });

  } catch (error) {
    logger.error("Error during graceful shutdown", { error: (error as Error).message, signal });
    process.exit(1);
  }
}

// Register shutdown handlers
function registerShutdownHandlers(server: any) {
  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
  
  signals.forEach(signal => {
    process.on(signal, () => {
      logger.info(`Received ${signal} signal`, { signal });
      gracefulShutdown(server, signal);
    });
  });

  // Handle uncaught exceptions — log to sentinel before shutdown
  process.on('uncaughtException', async (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    try {
      const db = await getDb();
      if (db) {
        await SystemService.createSystemError(db, {
          type: "system",
          message: `[UNCAUGHT] ${error.message}`,
          detail: error.stack,
          severity: "critical",
        });
      }
    } catch { /* don't let logging prevent shutdown */ }
    gracefulShutdown(server, 'uncaughtException');
  });

  // Handle unhandled promise rejections — log to sentinel
  process.on('unhandledRejection', async (reason, promise) => {
    logger.error('Unhandled Rejection', { reason: String(reason), promise: String(promise) });
    try {
      const db = await getDb();
      if (db) {
        await SystemService.createSystemError(db, {
          type: "system",
          message: `[UNHANDLED_REJECTION] ${String(reason)}`,
          detail: reason instanceof Error ? reason.stack : String(reason),
          severity: "critical",
        });
      }
    } catch { /* don't let logging prevent shutdown */ }
    gracefulShutdown(server, 'unhandledRejection');
  });
}

async function startServer() {
  validateEnv();
  await initSentry();
  const app = express();
  // Trust reverse proxy (nginx → Apache → PHP proxy → Node)
  app.set('trust proxy', 1);
  const server = createServer(app);
  // Register Stripe webhook route first (it needs raw body)
  registerStripeWebhook(app);

  // Traffic gate — load shedding before any heavy middleware
  setShutdownRef(shutdownState);
  app.use(trafficGateMiddleware);

  const IS_PRODUCTION = process.env.NODE_ENV === "production";

  // Canonical domain redirect: www → bare domain (consolidates link equity)
  if (IS_PRODUCTION) {
    app.use((req, res, next) => {
      if (req.hostname?.startsWith("www.")) {
        return res.redirect(301, `https://rebooked.org${req.originalUrl}`);
      }
      next();
    });
  }

  app.use(
    cors({
      // In production, only allow explicitly configured origins.
      // Falling back to `true` (reflect all) would neutralise CORS entirely.
      origin: corsOrigins.length > 0 ? corsOrigins : (IS_PRODUCTION ? false : true),
      credentials: true,
    }),
  );

  app.use((req, res, next) => {
    const correlationId = ensureCorrelationId(req.header("x-correlation-id") || undefined);
    (req as any).correlationId = correlationId;
    res.setHeader("x-correlation-id", correlationId);
    runWithCorrelationId(correlationId, () => next());
  });

  // Response compression (gzip) — reduces payload size by 60-80%
  const { default: compression } = await import("compression");
  app.use(compression({ threshold: 1024 }));

  // Body parsers
  const rawBodySaver = (req: express.Request, _res: express.Response, buffer: Buffer) => {
    (req as any).rawBody = buffer.toString("utf8");
  };
  app.use(express.json({ limit: "2mb", verify: rawBodySaver }));
  app.use(express.urlencoded({ limit: "2mb", extended: true, verify: rawBodySaver }));

  // Security hardening: headers, sanitization, rate limiting, audit logging, CORS
  registerSecurityMiddleware(app);

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Calendar OAuth callbacks (Google, Outlook, Calendly — browser redirects)
  registerCalendarCallbacks(app);
  // Inbound SMS webhooks (Telnyx + Twilio, STOP compliance)
  registerInboundWebhooks(app);
  // Voice call webhooks (Twilio Voice, Telnyx Voice, generic VoIP)
  registerCallWebhooks(app);
  // Funnel event tracking beacon (public, no auth)
  registerFunnelTrackEndpoint(app);
  // Dynamic sitemap.xml
  registerSitemapEndpoint(app);
  // Support contact form (public, rate-limited)
  registerSupportTicketEndpoint(app);
  // Embeddable booking widget (/widget.js — public, CORS-open)
  app.use(widgetRouter);

  // ─── Health check ─────────────────────────────────────────────────────────
  app.get("/health", async (_req, res) => {
    const dbOk = await pingDb();
    const memUsage = process.memoryUsage();
    const status = dbOk ? 200 : 503;
    res.status(status).json({
      status: dbOk ? "ok" : "degraded",
      db: dbOk ? "connected" : "unreachable",
      uptime: Math.floor(process.uptime()),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
      version: process.env.npm_package_version || "2.0.0",
      ts: new Date().toISOString(),
    });
  });

  app.get("/health/detailed", async (req, res) => {
    // Restrict to internal callers only — this endpoint leaks Stripe connectivity,
    // memory pressure, and worker state that should not be public.
    const internalToken = process.env.INTERNAL_HEALTH_TOKEN || process.env.WEBHOOK_SECRET;
    const providedToken = req.headers["x-internal-token"];
    const clientIp = req.ip || "";
    const isLocalhost = clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "::ffff:127.0.0.1";
    if (!isLocalhost && (!internalToken || providedToken !== internalToken)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

    // DB check with latency
    const dbStart = Date.now();
    const dbOk = await pingDb();
    checks.database = { status: dbOk ? "healthy" : "unhealthy", latencyMs: Date.now() - dbStart };

    // Worker heartbeat
    let workerHealthy = false;
    try {
      const heartbeat = JSON.parse(readFileSync(WORKER_HEARTBEAT_FILE, "utf8"));
      const ts = Date.parse(heartbeat.ts || heartbeat.lastSuccessAt || "");
      workerHealthy = Number.isFinite(ts) && Date.now() - ts <= WORKER_STALE_MS && heartbeat.status !== "error";
      checks.worker = { status: workerHealthy ? "healthy" : "stale" };
    } catch {
      checks.worker = { status: "unreachable", error: "No heartbeat file" };
    }

    // Stripe connectivity
    try {
      const stripeStart = Date.now();
      const { stripe: stripeClient } = await import("./stripe");
      await stripeClient.balance.retrieve();
      checks.stripe = { status: "healthy", latencyMs: Date.now() - stripeStart };
    } catch (err) {
      checks.stripe = { status: "unhealthy", error: err instanceof Error ? err.message : "Unknown" };
    }

    // Memory
    const memUsage = process.memoryUsage();
    const memPressure = memUsage.heapUsed / memUsage.heapTotal;
    checks.memory = { status: memPressure > 0.9 ? "warning" : "healthy" };

    const allHealthy = Object.values(checks).every((c) => c.status === "healthy");
    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? "healthy" : "degraded",
      checks,
      uptime: Math.floor(process.uptime()),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapPressure: Math.round(memPressure * 100),
      },
      ts: new Date().toISOString(),
    });
  });

  // ─── Version endpoint (live-update system) ──────────────────────────────
  app.get("/api/version", (_req, res) => {
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({ version: BUILD_VERSION });
  });

  // ─── System status (admin-only, rich metrics for dashboard widget) ─────
  app.get("/api/system/status", async (req, res) => {
    // Only allow from localhost or with internal token
    const internalToken = process.env.INTERNAL_HEALTH_TOKEN || process.env.WEBHOOK_SECRET;
    const providedToken = req.headers["x-internal-token"] || req.query.token;
    const clientIp = req.ip || "";
    const isLocal = clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "::ffff:127.0.0.1";
    // Also allow authenticated admin requests (cookie-based auth checked via tRPC)
    const hasAdminCookie = req.headers.cookie?.includes("rebooked_session");
    if (!isLocal && !hasAdminCookie && (!internalToken || providedToken !== internalToken)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const dbOk = await pingDb();

    // Worker heartbeat
    let workerStatus = "unknown";
    let workerLastBeat: string | null = null;
    try {
      const heartbeat = JSON.parse(readFileSync(WORKER_HEARTBEAT_FILE, "utf8"));
      const ts = Date.parse(heartbeat.ts || heartbeat.lastSuccessAt || "");
      const stale = !Number.isFinite(ts) || Date.now() - ts > WORKER_STALE_MS;
      workerStatus = stale ? "stale" : (heartbeat.status === "error" ? "error" : "healthy");
      workerLastBeat = heartbeat.ts || heartbeat.lastSuccessAt || null;
    } catch { workerStatus = "unreachable"; }

    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({
      version: BUILD_VERSION,
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      uptime: Math.floor(process.uptime()),
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      environment: process.env.NODE_ENV || "unknown",
      cluster: {
        isWorker: !!process.env.NODE_APP_INSTANCE,
        workerId: process.env.NODE_APP_INSTANCE || "0",
      },
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        heapPressure: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      cpu: {
        user: Math.round(cpuUsage.user / 1000),
        system: Math.round(cpuUsage.system / 1000),
      },
      database: { status: dbOk ? "connected" : "unreachable" },
      worker: { status: workerStatus, lastHeartbeat: workerLastBeat },
      ts: new Date().toISOString(),
    });
  });

  // ─── Deploy record endpoint (called by deploy script) ──────────────────
  app.post("/api/system/deploy-record", async (req, res) => {
    const internalToken = process.env.INTERNAL_HEALTH_TOKEN || process.env.WEBHOOK_SECRET;
    const providedToken = req.headers["x-internal-token"];
    const clientIp = req.ip || "";
    const isLocal = clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "::ffff:127.0.0.1";
    if (!isLocal && (!internalToken || providedToken !== internalToken)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    try {
      const db = await getDb();
      if (!db) { res.status(503).json({ error: "Database unavailable" }); return; }
      const result = await DeploymentService.recordDeployment(db, {
        version: req.body.version,
        gitHash: req.body.gitHash || null,
        gitBranch: req.body.gitBranch || null,
        status: req.body.status || "verified",
        deployedBy: req.body.deployedBy || null,
        durationMs: req.body.durationMs || null,
        completedAt: new Date(),
      });
      res.json({ ok: true, id: result?.id });
    } catch (err) {
      logger.error("Failed to record deployment", { error: String(err) });
      res.status(500).json({ error: "Failed to record" });
    }
  });

  // ─── Client error reporting (frontend → sentinel) ────────────────────
  // Server-side rate limiter: max 5 identical errors (by message fingerprint) per 5 minutes.
  const _clientErrorRateMap = new Map<string, { count: number; windowStart: number }>();
  const CLIENT_ERROR_RATE_WINDOW = 5 * 60_000; // 5 minutes
  const CLIENT_ERROR_RATE_LIMIT = 5;

  app.post("/api/system/client-error", async (req, res) => {
    try {
      const {
        message,
        stack,
        componentStack,
        componentPath,
        errorCategory,
        pageUrl,
        performanceData,
        url,
        userAgent,
      } = req.body || {};
      if (!message) { res.status(400).json({ error: "message required" }); return; }

      // Rate-limit by normalised message prefix (first 120 chars, strip dynamic parts)
      const fingerprint = String(message).slice(0, 120).replace(/\d{6,}/g, "ID");
      const now = Date.now();
      const rateEntry = _clientErrorRateMap.get(fingerprint);
      if (rateEntry) {
        if (now - rateEntry.windowStart < CLIENT_ERROR_RATE_WINDOW) {
          if (rateEntry.count >= CLIENT_ERROR_RATE_LIMIT) {
            res.json({ ok: true, ratelimited: true }); // silent drop
            return;
          }
          rateEntry.count++;
        } else {
          rateEntry.count = 1;
          rateEntry.windowStart = now;
        }
      } else {
        _clientErrorRateMap.set(fingerprint, { count: 1, windowStart: now });
        // Prune stale entries periodically
        if (_clientErrorRateMap.size > 200) {
          for (const [k, v] of _clientErrorRateMap) {
            if (now - v.windowStart > CLIENT_ERROR_RATE_WINDOW) _clientErrorRateMap.delete(k);
          }
        }
      }

      const db = await getDb();
      if (!db) { res.status(503).json({ ok: false }); return; }

      // Track error rate for health check
      try {
        const { recordClientError } = await import("./health-check");
        recordClientError();
      } catch {}

      // Classify severity by prefix — sentinel uses these to prioritize repairs
      const msg = String(message);
      const isStuck = msg.startsWith("[ERROR_PAGE_STUCK]");
      const isVisual = msg.startsWith("[VISUAL_ANOMALY]");
      const isDeadClick = msg.startsWith("[DEAD_CLICK]") || msg.startsWith("[RAGE_CLICK]");
      const isAIChatIssue = msg.startsWith("[AI_CHAT_QUALITY]");
      const isErrorPage = msg.startsWith("[ERROR_PAGE_SHOWN]");
      const isPerfAnomaly = msg.startsWith("[PERF_ANOMALY]");
      const isJourney = msg.startsWith("[JOURNEY_");
      const severity = isStuck ? "critical"
        : isErrorPage ? "high"
        : isDeadClick ? "high"
        : isPerfAnomaly ? "high"
        : isVisual ? "medium"
        : isAIChatIssue ? "medium"
        : isJourney ? "medium"
        : "medium";

      // Determine errorCategory: client-sent value takes precedence, else infer from prefix
      const resolvedCategory: string = errorCategory ||
        (isErrorPage || isStuck ? "rendering" :
         isPerfAnomaly ? "performance" :
         isVisual || isDeadClick ? "graphical" :
         "runtime");

      // Enrich detail with structured graphical profiling data
      const detail = JSON.stringify({
        stack,
        componentStack,
        componentPath: Array.isArray(componentPath) ? componentPath.slice(0, 5) : undefined,
        pageUrl: typeof pageUrl === "string" ? pageUrl.slice(0, 200) : undefined,
        performanceData: performanceData || undefined,
        url,
        userAgent,
      }).slice(0, 4000);

      await SystemService.createSystemError(db, {
        type: "client",
        message: `[CLIENT] ${msg.slice(0, 500)}`,
        detail,
        severity,
        errorCategory: resolvedCategory as any,
      });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ ok: false });
    }
  });

  // ─── Sentinel metric ingestion (client → sentinel_metrics table) ──────
  app.post("/api/system/sentinel-metric", async (req, res) => {
    try {
      const { category, metrics } = req.body || {};
      if (!category || !Array.isArray(metrics) || metrics.length === 0) {
        res.status(400).json({ error: "category and metrics[] required" });
        return;
      }
      const db = await getDb();
      if (!db) { res.status(503).json({ ok: false }); return; }

      // Extract tenantId from session if available
      const tenantId = (req as any).session?.tenantId || 0;

      const { sentinelMetrics } = await import("../../drizzle/schema");
      const rows = metrics.slice(0, 50).map((m: any) => ({
        tenantId,
        category: String(category).slice(0, 50),
        metric: String(m.metric || "").slice(0, 100),
        value: Number(m.value) || 0,
        detail: m.detail ? JSON.parse(JSON.stringify(m.detail)) : null,
      }));

      await db.insert(sentinelMetrics).values(rows);
      res.json({ ok: true, count: rows.length });
    } catch {
      res.status(500).json({ ok: false });
    }
  });

  app.get("/ready", async (_req, res) => {
    const dbOk = await pingDb();
    let workerHealthy = false;

    try {
      const heartbeat = JSON.parse(readFileSync(WORKER_HEARTBEAT_FILE, "utf8"));
      const ts = Date.parse(heartbeat.ts || heartbeat.lastSuccessAt || "");
      workerHealthy = Number.isFinite(ts) && Date.now() - ts <= WORKER_STALE_MS && heartbeat.status !== "error";
    } catch {
      workerHealthy = false;
    }

    const healthy = dbOk && workerHealthy;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? "ready" : "degraded",
      db: dbOk ? "connected" : "unreachable",
      worker: workerHealthy ? "healthy" : "stale",
      ts: new Date().toISOString(),
    });
  });

  // ─── Privacy & compliance endpoints ────────────────────────────────────────
  app.get("/api/privacy-policy", (_req, res) => {
    res.json({
      version: "1.0",
      lastUpdated: "2026-03-01",
      dataRetention: "Messages retained for 2 years, then anonymized",
      encryption: "AES-256 at rest, TLS 1.3 in transit",
      compliance: ["TCPA", "GDPR", "CCPA", "PCI-DSS"],
      contact: "privacy@rebooked.io",
    });
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: async ({ error, path, ctx }) => {
        try {
          // Expected client errors (not logged in, no tenant yet) — log as debug, not error
          const isExpectedClientError =
            error.code === "UNAUTHORIZED" ||
            (error.code === "FORBIDDEN" && error.message === "No tenant found");
          if (isExpectedClientError) {
            logger.debug("tRPC client error (expected)", { path, message: error.message, code: error.code });
            return; // Don't log to system_errors or Sentry
          }

          logger.error("tRPC error", { path, message: error.message, correlationId: (ctx as any)?.correlationId });
          captureException(error, { path, tenantId: (ctx as any)?.tenantId });
          const db = await getDb();
          if (db) {
            const isServerError = error.code === "INTERNAL_SERVER_ERROR" || error.code === "TIMEOUT";
            await SystemService.createSystemError(db, {
              type: "system",
              message: `tRPC Error in ${path}: ${error.message}`,
              detail: JSON.stringify({
                stack: error.stack,
                correlationId: (ctx as { correlationId?: string })?.correlationId,
                trpcCode: error.code,
              }),
              tenantId: (ctx as any)?.tenantId,
              severity: isServerError ? "critical" : undefined, // auto-classify non-500s
            }).catch((err) => logger.error("Failed to log system error", { error: String(err) }));
          }
        } catch (logErr) {
          // Error logging itself failed (e.g., pool exhausted) — never let this propagate
          logger.error("onError handler failed", { error: String(logErr) });
        }
      },
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  
  // In Docker/production, bind strictly to the specified port without fallback
  const isDocker = process.env.NODE_ENV === "production" || !!process.env.DOCKER_ENV;
  let port = preferredPort;
  
  if (!isDocker) {
    // In development, find an available port
    port = await findAvailablePort(preferredPort);
    if (port !== preferredPort) {
      console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
    }
  }

  server.listen(port, () => {
    logger.info("Server started", { port, env: process.env.NODE_ENV, version: BUILD_VERSION });

    // Tell PM2 cluster this worker is ready to accept traffic.
    // This enables zero-downtime reload: PM2 waits for 'ready' before
    // killing the old instance, so there is always a live worker.
    if (typeof process.send === "function") {
      process.send("ready");
    }
  });

  // Register graceful shutdown handlers after server starts
  registerShutdownHandlers(server);
}

startServer().catch(console.error);
