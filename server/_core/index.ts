import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import rateLimit from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerInboundWebhooks } from "./inboundWebhook";
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
import { readFileSync } from "fs";
import { trafficGateMiddleware, setShutdownRef } from "./traffic-gate";
import { validateEnv } from "./env";
import { BUILD_VERSION } from "../../shared/version";

// Graceful shutdown state — shared with traffic gate
const shutdownState = { value: false };
let isShuttingDown = false;
const shutdownTimeoutMs = 30000; // 30 seconds timeout

const corsOrigins = [
  ...process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean) ?? [],
  ...process.env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [],
].filter((v, i, a) => a.indexOf(v) === i);

const WORKER_HEARTBEAT_FILE = process.env.WORKER_HEARTBEAT_FILE || "/tmp/worker-heartbeat.json";
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

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    gracefulShutdown(server, 'uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason: String(reason), promise: String(promise) });
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

  app.use(
    cors({
      origin: corsOrigins.length > 0 ? corsOrigins : true,
      credentials: true,
    }),
  );

  app.use((req, res, next) => {
    const correlationId = ensureCorrelationId(req.header("x-correlation-id") || undefined);
    (req as any).correlationId = correlationId;
    res.setHeader("x-correlation-id", correlationId);
    runWithCorrelationId(correlationId, () => next());
  });

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
  // Inbound SMS webhooks (Telnyx + Twilio, STOP compliance)
  registerInboundWebhooks(app);

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

  app.get("/health/detailed", async (_req, res) => {
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
      const { default: Stripe } = await import("stripe");
      const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2022-11-15" });
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

  const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, 
    limit: 600, 
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });
  app.use("/api/", apiLimiter);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: async ({ error, path, ctx }) => {
        try {
          logger.error("tRPC error", { path, message: error.message, correlationId: (ctx as any)?.correlationId });
          captureException(error, { path, tenantId: (ctx as any)?.tenantId });
          const db = await getDb();
          if (db) {
            await SystemService.createSystemError(db, {
              type: "system",
              message: `tRPC Error in ${path}: ${error.message}`,
              detail: JSON.stringify({
                stack: error.stack,
                correlationId: (ctx as { correlationId?: string })?.correlationId,
              }),
              tenantId: (ctx as any)?.tenantId,
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
