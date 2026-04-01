/**
 * Rebooked Autopilot Sentinel
 *
 * Separate process that polls for critical errors and orchestrates
 * automated repairs via Claude Code CLI. Mirrors worker.ts structure.
 *
 * Start: pnpm sentinel  (or: tsx server/sentinel.ts)
 */

import "dotenv/config";
import { getHeapStatistics } from "v8";
import { eq, and, sql } from "drizzle-orm";
import { tmpdir } from "os";
import { writeFileSync } from "fs";
import { createHash, randomUUID } from "crypto";
import { getDb } from "./db";
import { systemErrorLogs } from "../drizzle/schema";
import { logger } from "./_core/logger";
import { captureException, initSentry } from "./_core/sentry";
import { runWithCorrelationId } from "./_core/requestContext";
import { gracefulShutdown } from "./_core/graceful-shutdown";
import * as SentinelService from "./services/sentinel.service";
import { executeRepairScript, PROTECTED_FILES } from "./services/autopilot-executor";
import { attemptQuickFix, hasQuickFixCandidate } from "./services/quick-fix-engine";
import { checkPlanConsistency } from "./services/sentinel-plan-checker";
import { analyzePipeline } from "./services/sentinel-pipeline-analyzer";
import { scoreAutomations } from "./services/sentinel-automation-scorer";
import { validateDataConsistency } from "./services/sentinel-data-validator";
import { analyzeThemeIntegrity } from "./services/sentinel-theme-analyzer";
import type { Db } from "./_core/context";
import { performHealthCheck } from "./_core/health-check";

// ─── Constants ───────────────────────────────────────────────────────────────

const SENTINEL_POLL_INTERVAL_MS = 60_000; // 1 minute — fast detection
const MAX_CONCURRENT_REPAIRS = 1;
const HEARTBEAT_FILE = process.env.SENTINEL_HEARTBEAT_FILE || `${tmpdir()}/sentinel-heartbeat.json`;
const REPAIR_TIMEOUT_MS = 360_000; // 6 min hard timeout (script has 5 min)

// Memory/load thresholds — sentinel backs off when server is strained
const HEAP_BACKOFF_PERCENT = 85; // Skip repairs if heap > 85%

let activeRepairs = 0;
let cycleCount = 0;
let lastRepairAttemptAt: string | null = null;

/**
 * In-memory violation dedup cache: maps "violationType:tenantId" to the
 * Unix timestamp it was last written to systemErrorLogs. Skips re-reporting
 * identical violations within 30 minutes, eliminating per-cycle DB LIKE queries.
 */
const violationCache = new Map<string, number>();
const VIOLATION_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Error types currently suppressed from circuit-breaking due to correlated upstream failures */
let correlatedSuppressedTypes = new Set<string>();

/** jobId → startTime (ms) for in-flight repairs */
const repairStartTimes = new Map<number, number>();

// Reset stale repair counter on startup — prevents stuck counter from previous crash
function resetRepairCounterIfStale() {
  // If sentinel restarts, any "active" repairs from the previous run are dead.
  // This is safe because MAX_CONCURRENT_REPAIRS = 1 and repairs have a 6-min timeout.
  activeRepairs = 0;
  repairStartTimes.clear();
}

// ─── Stuck Repair Detection ──────────────────────────────────────────────────

/**
 * Escalate repair jobs that have been running longer than REPAIR_TIMEOUT_MS + 60s.
 * This catches edge cases where the Promise.race timeout fires but the DB update fails.
 */
async function checkStuckRepairs(db: Db) {
  const STUCK_THRESHOLD_MS = REPAIR_TIMEOUT_MS + 60_000; // 7 minutes
  const now = Date.now();
  for (const [jobId, startTime] of repairStartTimes.entries()) {
    if (now - startTime > STUCK_THRESHOLD_MS) {
      logger.warn(`[sentinel] Repair job #${jobId} exceeded ${STUCK_THRESHOLD_MS / 60000} min — escalating`);
      repairStartTimes.delete(jobId);
      await SentinelService.updateRepairJobStatus(db, jobId, "escalated", {
        failureReason: `Stuck repair: exceeded ${STUCK_THRESHOLD_MS / 60000} minutes without completing`,
      }).catch((err) => {
        logger.warn(`[sentinel] Failed to escalate stuck job #${jobId}`, { error: String(err) });
      });
    }
  }
}

// ─── Core Cycle ──────────────────────────────────────────────────────────────

async function runSentinelCycle() {
  const db = await getDb();
  if (!db) {
    logger.warn("[sentinel] Database unavailable, skipping cycle");
    writeHeartbeat("db_unavailable");
    return;
  }

  // Detect and escalate any repairs stuck beyond the timeout
  await checkStuckRepairs(db).catch((err) => {
    logger.warn("[sentinel] checkStuckRepairs failed (non-fatal)", { error: String(err) });
  });

  // Auto-escalate failed repairs that exhausted all retries (every 5 cycles)
  if (cycleCount % 5 === 0) {
    await SentinelService.autoEscalateStaleFailures(db).catch((err) => {
      logger.warn("[sentinel] Auto-escalation check failed (non-fatal)", { error: String(err) });
    });
  }

  // Auto-recover circuit-breaker-disabled features (every 10 cycles)
  if (cycleCount % 10 === 0) {
    await SentinelService.checkCircuitBreakerRecovery(db).catch((err) => {
      logger.warn("[sentinel] Circuit breaker recovery check failed (non-fatal)", { error: String(err) });
    });
  }

  // Failure correlation: detect cascading failures (every 15 cycles)
  if (cycleCount % 15 === 0) {
    try {
      const { suppressedTypes, correlations } = await SentinelService.detectCorrelatedFailures(db);
      if (correlations.length > 0) {
        // Report correlation event so admins can see root cause
        const { createSystemError } = await import("./services/system.service");
        for (const c of correlations) {
          await createSystemError(db, {
            type: "system",
            message: `[CORRELATED_FAILURES] ${c.upstream} (${c.upstreamCount} errors) causing ${c.downstream} (${c.downstreamCount} errors) cascade — downstream circuit breaker suppressed`,
            detail: JSON.stringify(c),
            severity: "high",
          });
        }
        // Store suppressed types for circuit breaker decisions this cycle
        correlatedSuppressedTypes = suppressedTypes;
        logger.info(`[sentinel] Detected ${correlations.length} correlated failure(s), suppressing: ${[...suppressedTypes].join(", ")}`);
      } else {
        correlatedSuppressedTypes = new Set();
      }
    } catch (err) {
      logger.warn("[sentinel] Failure correlation check failed (non-fatal)", { error: String(err) });
    }
  }

  // ── Load-awareness: back off when server is strained ──
  // Sentinel still polls (to detect errors) but skips expensive repair jobs
  let serverOverloaded = false;
  try {
    const mem = process.memoryUsage();
    const heapStats = getHeapStatistics();
    const heapLimit = heapStats.heap_size_limit > 0 ? heapStats.heap_size_limit : mem.heapTotal;
    const heapPercent = (mem.heapUsed / heapLimit) * 100;
    if (heapPercent > HEAP_BACKOFF_PERCENT) {
      serverOverloaded = true;
      logger.warn(`[sentinel] Server heap at ${heapPercent.toFixed(1)}% — deferring repairs to protect server`);
    }
  } catch {}

  let errors: Awaited<ReturnType<typeof SentinelService.findUnresolvedCriticalErrors>>;
  try {
    errors = await SentinelService.findUnresolvedCriticalErrors(db);
  } catch (err) {
    // Non-fatal: DB query may fail if schema migration is pending
    logger.warn("[sentinel] Error polling for critical errors (schema may be updating)", { error: String(err) });
    writeHeartbeat("ok");
    return;
  }
  if (errors.length === 0) {
    writeHeartbeat("ok");
    return;
  }

  // If overloaded, log errors found but don't attempt repairs
  if (serverOverloaded) {
    logger.info(`[sentinel] ${errors.length} error(s) found but repairs deferred (server overloaded)`);
    writeHeartbeat("backoff_overloaded");
    return;
  }

  // ── Plan consistency check (lightweight, runs every cycle) ──
  try {
    const planViolations = await checkPlanConsistency(db);
    if (planViolations.length > 0) {
      const { createSystemError } = await import("./services/system.service");
      for (const v of planViolations) {
        // Dedup: check if this violation already exists as an unresolved error
        const fingerprint = createHash("md5")
          .update(`${v.type}:${v.tenantId}:${v.message.slice(0, 100)}`)
          .digest("hex");
        const existing = await db
          .select({ id: systemErrorLogs.id })
          .from(systemErrorLogs)
          .where(
            and(
              eq(systemErrorLogs.resolved, false),
              sql`${systemErrorLogs.message} LIKE ${`%${v.type}%tenant ${v.tenantId}%`}`,
            ),
          )
          .limit(1);
        if (existing.length > 0) continue; // Already reported, skip

        await createSystemError(db, {
          type: "billing",
          message: v.message.slice(0, 500),
          detail: JSON.stringify(v.detail).slice(0, 4000),
          severity: v.severity,
          tenantId: v.tenantId || undefined,
        });
        logger.warn(`[sentinel] Plan violation: ${v.type} for tenant ${v.tenantId}`, { violation: v });
      }
      logger.info(`[sentinel] Found ${planViolations.length} plan violation(s)`);
    }
  } catch (err) {
    logger.warn("[sentinel] Plan consistency check failed (non-fatal)", { error: String(err) });
  }

  // ── Adaptive Analyzers (staggered cadences) ──
  cycleCount++;

  // Every cycle: Revenue Pipeline Guardian (sub-checks staggered internally)
  try {
    const pipelineViolations = await analyzePipeline(db, cycleCount);
    await reportViolations(db, pipelineViolations);
  } catch (err) {
    logger.warn("[sentinel] Pipeline analysis failed (non-fatal)", { error: String(err) });
  }

  // Every 10 cycles (~10 min): Automation Effectiveness Scorer
  if (cycleCount % 10 === 0) {
    try {
      const automationViolations = await scoreAutomations(db);
      await reportViolations(db, automationViolations);
    } catch (err) {
      logger.warn("[sentinel] Automation scoring failed (non-fatal)", { error: String(err) });
    }
  }

  // Every 20 cycles (~20 min): Theme Integrity Analyzer
  if (cycleCount % 20 === 0) {
    try {
      const themeViolations = await analyzeThemeIntegrity(db);
      await reportViolations(db, themeViolations);
    } catch (err) {
      logger.warn("[sentinel] Theme integrity check failed (non-fatal)", { error: String(err) });
    }
  }

  // Every 30 cycles (~30 min): Data Consistency Validator
  if (cycleCount % 30 === 0) {
    try {
      const dataViolations = await validateDataConsistency(db);
      await reportViolations(db, dataViolations);
    } catch (err) {
      logger.warn("[sentinel] Data consistency check failed (non-fatal)", { error: String(err) });
    }
  }

  // Every 100 cycles (~100 min): Compute adaptive baselines + prune violation cache
  if (cycleCount % 100 === 0) {
    try {
      await computeBaselines(db);
    } catch (err) {
      logger.warn("[sentinel] Baseline computation failed (non-fatal)", { error: String(err) });
    }
    // Prune stale violation cache entries
    const pruneNow = Date.now();
    for (const [k, v] of violationCache) {
      if (pruneNow - v > VIOLATION_CACHE_TTL_MS) violationCache.delete(k);
    }
  }

  logger.info(`[sentinel] Found ${errors.length} unresolved critical error(s)`);

  for (const error of errors) {
    if (activeRepairs >= MAX_CONCURRENT_REPAIRS) {
      logger.info("[sentinel] Max concurrent repairs reached, deferring remaining");
      break;
    }

    if (gracefulShutdown.isShuttingDownActive()) {
      logger.info("[sentinel] Shutdown in progress, stopping cycle");
      break;
    }

    const fingerprint = SentinelService.computeErrorFingerprint(
      error.type,
      error.message,
      error.detail,
    );

    // Graphical-only errors (CLS, DOM thrash, dead clicks, perf anomalies) cannot
    // be fixed by patching TypeScript source. Escalate directly to admin queue.
    if (SentinelService.isGraphicalOnlyError(error)) {
      logger.debug(`[sentinel] Graphical error #${error.id} — resolved (client-side perf, no patch needed)`);
      await SentinelService.escalateGraphicalError(db, error, fingerprint).catch((err) => {
        logger.warn("[sentinel] Failed to escalate graphical error", { error: String(err) });
      });
      continue;
    }

    // Dedup: skip if already being repaired
    if (await SentinelService.isRepairInProgress(db, fingerprint)) {
      logger.info(`[sentinel] Repair already in progress for fingerprint ${fingerprint.slice(0, 12)}...`);
      continue;
    }

    // Circuit breaker: skip if too many failures (tenant-scoped or platform-wide)
    // Suppress circuit breaker for downstream types during correlated upstream failures
    if (correlatedSuppressedTypes.has(error.type)) {
      logger.info(`[sentinel] Skipping circuit breaker for ${error.type} (correlated with upstream failure)`);
    } else {
      const breakerResult = await SentinelService.shouldTripCircuitBreaker(db, fingerprint, error.tenantId);
      if (breakerResult.tripped) {
        const targetTenantId = breakerResult.scope === "tenant" ? error.tenantId : null;
        logger.warn(`[sentinel] Circuit breaker tripped (${breakerResult.scope}) for fingerprint ${fingerprint.slice(0, 12)}... — disabling feature`);
        await SentinelService.disableFeatureForError(db, error.type, targetTenantId);
        // Mark error as resolved to stop re-triggering
        await db.update(systemErrorLogs).set({ resolved: true }).where(eq(systemErrorLogs.id, error.id));
        continue;
      }
    }

    // Create repair job and execute (with hard timeout to prevent blocking)
    const jobId = await SentinelService.createRepairJob(db, error, fingerprint);
    logger.info(`[sentinel] Created repair job #${jobId} for error #${error.id}`);

    await Promise.race([
      executeRepair(db, jobId, error),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error(`Repair job #${jobId} hard timeout after ${REPAIR_TIMEOUT_MS / 1000}s`)), REPAIR_TIMEOUT_MS),
      ),
    ]).catch(async (err) => {
      logger.error(`[sentinel] Repair job #${jobId} timed out`, { error: String(err) });
      await SentinelService.updateRepairJobStatus(db, jobId, "failed", {
        failureReason: String(err),
      }).catch(() => {});
      activeRepairs = Math.max(0, activeRepairs - 1);
    });
  }

  writeHeartbeat("ok");
}

// ─── Repair Orchestration ────────────────────────────────────────────────────

async function executeRepair(
  db: Db,
  jobId: number,
  error: { id: number; type: string; message: string; detail: string | null },
) {
  activeRepairs++;
  repairStartTimes.set(jobId, Date.now());
  lastRepairAttemptAt = new Date().toISOString();
  try {
    // Phase: diagnosing
    await SentinelService.updateRepairJobStatus(db, jobId, "diagnosing");

    const job = await SentinelService.getRepairJobById(db, jobId);
    if (!job) {
      logger.error(`[sentinel] Repair job #${jobId} not found after creation`);
      return;
    }

    const fingerprint = job.errorFingerprint;

    // ── Step 1: Try quick-fix engine (instant, no Claude CLI) ──
    const quickFixCtx = {
      errorType: error.type,
      errorMessage: error.message,
      stackTrace: error.detail || "",
      affectedFile: job.affectedFile,
    };

    if (hasQuickFixCandidate(quickFixCtx)) {
      logger.info(`[sentinel] Attempting quick fix for job #${jobId}`);
      const quickResult = attemptQuickFix(quickFixCtx);

      if (quickResult?.applied) {
        // Quick fix succeeded — commit it via git
        let gitCommitOk = false;
        try {
          const { execFileSync } = await import("child_process");
          const cwd = process.cwd();
          for (const f of quickResult.filesChanged) {
            execFileSync("git", ["add", f], { cwd, timeout: 10_000 });
          }
          const safeFile = (job.affectedFile || "unknown").replace(/[^a-zA-Z0-9._\-/\\]/g, "_");
          execFileSync("git", [
            "commit", "-m",
            `fix(sentinel-quickfix): ${quickResult.fixType} in ${safeFile}\n\nAutomated quick fix by Sentinel.\nJob ID: ${jobId}\n\nCo-Authored-By: Rebooked Sentinel <sentinel@rebooked.org>`,
          ], { cwd, timeout: 10_000 });
          gitCommitOk = true;
        } catch (gitErr) {
          // Git commit failed — revert file changes to keep working tree clean
          logger.warn(`[sentinel] Quick fix git commit failed — reverting files`, { error: String(gitErr) });
          try {
            const { execFileSync: efs } = await import("child_process");
            efs("git", ["checkout", "--", ...quickResult.filesChanged], { cwd: process.cwd(), timeout: 10_000 });
          } catch { /* revert is best-effort */ }
        }

        if (gitCommitOk) {
          await SentinelService.updateRepairJobStatus(db, jobId, "deployed", {
            claudeOutput: `Quick fix (${quickResult.fixType}): ${quickResult.description}`,
            diffPatch: quickResult.diffSummary,
          });
          await db
            .update(systemErrorLogs)
            .set({ resolved: true })
            .where(eq(systemErrorLogs.id, error.id));
          logger.info(`[sentinel] Quick fix deployed for job #${jobId}: ${quickResult.fixType}`);
          return;
        }
        // Git failed — fall through to Claude CLI
        logger.info(`[sentinel] Quick fix reverted due to git failure — falling through to Claude CLI`);
      } else {
        logger.info(`[sentinel] Quick fix didn't apply — falling through to Claude CLI`);
      }
    }

    // ── Step 2: Get retry context from previous attempts ──
    const lastFailed = await SentinelService.getLastFailedAttempt(db, fingerprint);
    const attemptNumber = (lastFailed?.attemptCount ?? 0) + 1;

    // Phase: patching
    await SentinelService.updateRepairJobStatus(db, jobId, "patching");

    const result = await executeRepairScript({
      jobId,
      branchName: job.branchName || `fix/autopilot-${jobId}`,
      errorType: error.type,
      errorMessage: error.message,
      stackTrace: error.detail || "",
      affectedFile: job.affectedFile,
      attemptNumber,
      previousFailureReason: lastFailed?.failureReason || undefined,
      previousClaudeOutput: lastFailed?.claudeOutput?.slice(0, 2000) || undefined,
    });

    if (result.noOp) {
      // No-op: Claude ran but all changes were reverted by the protected-file safety scan,
      // or the CLI/source files are unavailable. Not retriable — escalate to admin.
      await SentinelService.updateRepairJobStatus(db, jobId, "escalated", {
        claudeOutput: result.claudeOutput,
        failureReason: result.failureReason,
      });
      // Mark original error as resolved to prevent re-triggering every cycle
      await db
        .update(systemErrorLogs)
        .set({ resolved: true })
        .where(eq(systemErrorLogs.id, error.id));
      logger.info(`[sentinel] Repair job #${jobId} no-op — escalated to admin, source error resolved`);
    } else if (result.success) {
      // Phase: testing → verifying → deployed
      await SentinelService.updateRepairJobStatus(db, jobId, "testing", {
        testResults: result.testResults,
      });
      await SentinelService.updateRepairJobStatus(db, jobId, "verifying", {
        claudeOutput: result.claudeOutput,
        diffPatch: result.diffPatch,
      });
      await SentinelService.updateRepairJobStatus(db, jobId, "deployed");

      // Mark original error as resolved
      await db
        .update(systemErrorLogs)
        .set({ resolved: true })
        .where(eq(systemErrorLogs.id, error.id));

      logger.info(`[sentinel] Repair job #${jobId} deployed successfully (attempt #${attemptNumber})`);
    } else {
      // Failed — retriable up to MAX_REPAIR_ATTEMPTS (now 5)
      await SentinelService.updateRepairJobStatus(db, jobId, "failed", {
        claudeOutput: result.claudeOutput,
        diffPatch: result.diffPatch,
        testResults: result.testResults,
        failureReason: result.failureReason,
        attemptCount: attemptNumber,
      });

      logger.warn(`[sentinel] Repair job #${jobId} failed (attempt #${attemptNumber}): ${result.failureReason}`);
    }
  } catch (err) {
    logger.error(`[sentinel] Unexpected error during repair job #${jobId}`, { error: String(err) });
    captureException(err);

    await SentinelService.updateRepairJobStatus(db, jobId, "failed", {
      failureReason: `Unexpected error: ${String(err)}`,
    }).catch(() => {});
  } finally {
    activeRepairs--;
    repairStartTimes.delete(jobId);
  }
}

// ─── Violation Reporting Helper ──────────────────────────────────────────────

async function reportViolations(
  db: Db,
  violations: Array<{ type: string; severity: string; tenantId: number; message: string; detail: Record<string, unknown> }>,
) {
  if (violations.length === 0) return;

  const { createSystemError } = await import("./services/system.service");
  let reported = 0;
  const now = Date.now();

  for (const v of violations) {
    // Fast path: in-memory cache dedup (avoids DB LIKE query per violation per cycle)
    const cacheKey = `${v.type}:${v.tenantId || 0}`;
    const lastReported = violationCache.get(cacheKey);
    if (lastReported && now - lastReported < VIOLATION_CACHE_TTL_MS) continue;

    // Slow path: DB dedup for first-time or expired cache entries
    const existing = await db
      .select({ id: systemErrorLogs.id })
      .from(systemErrorLogs)
      .where(
        and(
          eq(systemErrorLogs.resolved, false),
          sql`${systemErrorLogs.message} LIKE ${`%${v.type}%`}`,
          eq(systemErrorLogs.tenantId, v.tenantId || 0),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Already exists in DB — update cache to skip future cycles
      violationCache.set(cacheKey, now);
      continue;
    }

    await createSystemError(db, {
      type: "system",
      message: v.message.slice(0, 500),
      detail: JSON.stringify(v.detail).slice(0, 4000),
      severity: v.severity as any,
      tenantId: v.tenantId || undefined,
    });
    violationCache.set(cacheKey, now);
    reported++;
  }

  if (reported > 0) {
    logger.info(`[sentinel] Reported ${reported} new violation(s) (${violations.length - reported} deduplicated)`);
  }
}

// ─── Adaptive Baseline Computation ──────────────────────────────────────────

async function computeBaselines(db: Db) {
  const { sentinelMetrics, sentinelBaselines } = await import("../drizzle/schema");
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Get distinct tenantId + metric combinations from last 14 days
  const groups = await db
    .select({
      tenantId: sentinelMetrics.tenantId,
      metric: sentinelMetrics.metric,
    })
    .from(sentinelMetrics)
    .where(sql`${sentinelMetrics.measuredAt} > ${fourteenDaysAgo}`)
    .groupBy(sentinelMetrics.tenantId, sentinelMetrics.metric)
    .limit(500);

  let updated = 0;
  for (const group of groups) {
    // Fetch all values for this metric in the window
    const values = await db
      .select({ value: sentinelMetrics.value })
      .from(sentinelMetrics)
      .where(
        and(
          eq(sentinelMetrics.tenantId, group.tenantId),
          eq(sentinelMetrics.metric, group.metric),
          sql`${sentinelMetrics.measuredAt} > ${fourteenDaysAgo}`,
        ),
      )
      .limit(1000);

    if (values.length < 10) continue; // Need minimum data

    const sorted = values.map((v) => v.value).sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    // Upsert baseline
    await db
      .insert(sentinelBaselines)
      .values({
        tenantId: group.tenantId,
        metric: group.metric,
        p50,
        p95,
        sampleCount: sorted.length,
      })
      .onDuplicateKeyUpdate({
        set: { p50, p95, sampleCount: sorted.length, computedAt: new Date() },
      });
    updated++;
  }

  if (updated > 0) {
    logger.info(`[sentinel] Updated ${updated} adaptive baselines from ${groups.length} metric groups`);
  }

  // Prune old metrics (>30 days) to prevent table bloat
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await db.delete(sentinelMetrics).where(sql`${sentinelMetrics.measuredAt} < ${thirtyDaysAgo}`);
}

// ─── Heartbeat ───────────────────────────────────────────────────────────────

function writeHeartbeat(status: string, error?: string) {
  try {
    const mem = process.memoryUsage();
    const stuckRepairCount = repairStartTimes.size > 0
      ? [...repairStartTimes.values()].filter(t => Date.now() - t > REPAIR_TIMEOUT_MS).length
      : 0;
    writeFileSync(HEARTBEAT_FILE, JSON.stringify({
      ts: new Date().toISOString(),
      status,
      error,
      activeRepairs,
      cycleCount,
      lastRepairAttemptAt,
      stuckRepairCount,
      pollIntervalMs: SENTINEL_POLL_INTERVAL_MS,
      memoryMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapPercent: mem.heapTotal > 0 ? Math.round((mem.heapUsed / mem.heapTotal) * 100) : 0,
    }));
  } catch {
    /* non-fatal */
  }
}

// ─── Startup ─────────────────────────────────────────────────────────────────

async function main() {
  await initSentry();
  resetRepairCounterIfStale();
  logger.info("[sentinel] Starting", { pollIntervalMs: SENTINEL_POLL_INTERVAL_MS });

  gracefulShutdown.addShutdownHandler("SIGTERM", async () => {
    logger.info("[sentinel] SIGTERM - graceful shutdown initiated");
    await new Promise((r) => setTimeout(r, 2000));
  });

  gracefulShutdown.addShutdownHandler("SIGINT", async () => {
    logger.info("[sentinel] SIGINT - graceful shutdown initiated");
    await new Promise((r) => setTimeout(r, 2000));
  });

  // Initial cycle
  await runWithCorrelationId(randomUUID(), runSentinelCycle);

  // Polling loop
  const pollInterval = setInterval(async () => {
    try {
      if (gracefulShutdown.isShuttingDownActive()) {
        clearInterval(pollInterval);
        logger.info("[sentinel] Polling stopped due to shutdown");
        return;
      }
      await runWithCorrelationId(randomUUID(), runSentinelCycle);
    } catch (err) {
      logger.error("[sentinel] Cycle error", { error: String(err) });
      writeHeartbeat("error", String(err));
      captureException(err);
    }
  }, SENTINEL_POLL_INTERVAL_MS);
}

main().catch((err) => {
  logger.error("[sentinel] Fatal", { error: String(err) });
  writeHeartbeat("fatal", String(err));
  process.exit(1);
});
