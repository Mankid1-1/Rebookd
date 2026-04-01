/**
 * Sentinel Service - Autopilot Repair Engine Core Logic
 *
 * Monitors systemErrorLogs for critical errors, deduplicates via
 * stack trace fingerprinting, manages repair_jobs lifecycle, and
 * trips the circuit breaker when repairs repeatedly fail.
 */

import { and, count, desc, eq, getTableColumns, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { createHash } from "crypto";
import {
  systemErrorLogs,
  repairJobs,
  featureConfigs,
  type SystemErrorLog,
  type RepairJob,
  type InsertRepairJob,
} from "../../drizzle/schema";
import type { Db } from "../_core/context";
import { logger } from "../_core/logger";

// ─── Constants ───────────────────────────────────────────────────────────────

const TERMINAL_STATUSES = ["deployed", "failed", "escalated"] as const;
const MAX_REPAIR_ATTEMPTS = 5;
const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL;
const SENTINEL_SLACK_WEBHOOK = process.env.SENTINEL_SLACK_WEBHOOK;

// ─── Escalation Alerting ─────────────────────────────────────────────────────

/**
 * Send alert when a repair job is escalated (max attempts reached or graphical error).
 * Sends to ADMIN_ALERT_EMAIL and/or SENTINEL_SLACK_WEBHOOK if configured.
 */
export async function sendEscalationAlert(job: {
  id: number;
  errorFingerprint: string;
  errorType?: string | null;
  errorMessage?: string | null;
  affectedFile?: string | null;
  failureReason?: string | null;
  attemptCount?: number;
}): Promise<void> {
  const subject = `[Sentinel] Repair escalated: ${job.errorType || "unknown"} in ${job.affectedFile || "unknown file"}`;
  const body = [
    `Repair Job #${job.id} has been escalated.`,
    ``,
    `Error Type: ${job.errorType || "N/A"}`,
    `Error: ${(job.errorMessage || "").slice(0, 500)}`,
    `Affected File: ${job.affectedFile || "N/A"}`,
    `Failure Reason: ${job.failureReason || "N/A"}`,
    `Attempts: ${job.attemptCount ?? "N/A"}`,
    `Fingerprint: ${job.errorFingerprint}`,
    ``,
    `Action required: manual investigation needed.`,
  ].join("\n");

  // Email alert
  if (ADMIN_ALERT_EMAIL) {
    try {
      const { EmailService } = await import("./email.service");
      await EmailService.sendEmail?.({
        to: ADMIN_ALERT_EMAIL,
        subject,
        text: body,
      });
      logger.info("Sentinel escalation email sent", { to: ADMIN_ALERT_EMAIL, jobId: job.id });
    } catch (err) {
      logger.warn("Failed to send sentinel escalation email", { error: String(err) });
    }
  }

  // Slack webhook alert
  if (SENTINEL_SLACK_WEBHOOK) {
    try {
      await fetch(SENTINEL_SLACK_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: subject,
          blocks: [
            { type: "header", text: { type: "plain_text", text: "Sentinel Escalation" } },
            { type: "section", text: { type: "mrkdwn", text: `*Job #${job.id}*\n\`\`\`${body}\`\`\`` } },
          ],
        }),
      });
      logger.info("Sentinel escalation Slack alert sent", { jobId: job.id });
    } catch (err) {
      logger.warn("Failed to send sentinel escalation Slack alert", { error: String(err) });
    }
  }

  if (!ADMIN_ALERT_EMAIL && !SENTINEL_SLACK_WEBHOOK) {
    logger.warn("Sentinel escalation: no alert channel configured (set ADMIN_ALERT_EMAIL or SENTINEL_SLACK_WEBHOOK)", {
      jobId: job.id,
    });
  }
}

/** Map error types to the feature key used in featureConfigs.
 * "client" and "system" types are intentionally omitted — they should never
 * trigger feature disabling via the circuit breaker. */
const ERROR_TYPE_TO_FEATURE: Record<string, string> = {
  ai: "ai_chat",
  automation: "automations",
  twilio: "sms_sending",
  billing: "billing",
  webhook: "webhooks",
  // "client" → no mapping: client-side errors should not disable server features
  // "system" → no mapping: system errors are informational
};

// ─── Fingerprinting ──────────────────────────────────────────────────────────

/**
 * Compute a SHA-256 fingerprint from an error's type, message, and stack trace.
 * Normalisation strips line numbers, timestamps, and numeric IDs so that
 * different instances of the same root cause produce the same hash.
 */
export function computeErrorFingerprint(
  type: string,
  message: string,
  detail: string | null,
): string {
  const normMessage = (message || "")
    // Strip timestamps (ISO, Unix ms, etc.)
    .replace(/\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}[.\dZ]*/g, "TS")
    // Strip long numeric IDs (8+ digits — row IDs, Unix timestamps) but NOT 4-6 digit error codes
    .replace(/\b\d{8,}\b/g, "ID")
    // Normalize path-segment IDs like /leads/1234 or /api/v1/123456 (4-7 digit path segments)
    .replace(/\/\d{4,7}\b/g, "/ID")
    // Strip UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "UUID")
    // Keep short numbers (port numbers, HTTP status codes, short error codes) intact
    .trim()
    .slice(0, 300);

  const frames = extractTopFrames(detail || "", 3);
  const input = `${type}::${normMessage}::${frames}`;
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Extract the top N stack frames from a stack trace string, normalised
 * to strip line/column numbers for stable fingerprinting.
 */
function extractTopFrames(detail: string, n: number): string {
  const lines = detail.split("\n").filter((l) => /^\s+at\s/.test(l));
  return lines
    .slice(0, n)
    .map((l) =>
      l
        .trim()
        .replace(/:\d+:\d+\)?$/, "")
        .replace(/\(.*[/\\]/, "(")
    )
    .join("|");
}

// ─── Error Queries ───────────────────────────────────────────────────────────

// ─── Priority Scoring ───────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 40,
  high: 30,
  medium: 20,
  low: 10,
};

const TYPE_WEIGHT: Record<string, number> = {
  billing: 30,
  twilio: 25,
  automation: 20,
  ai: 15,
  webhook: 10,
  system: 5,
};

function computeErrorPriority(error: SystemErrorLog): number {
  return (SEVERITY_WEIGHT[error.severity] ?? 0) + (TYPE_WEIGHT[error.type] ?? 0);
}

/**
 * Find unresolved critical errors logged in the last hour, sorted by priority.
 * Priority = severity weight + error type weight (billing/twilio highest).
 */
export async function findUnresolvedCriticalErrors(db: Db): Promise<SystemErrorLog[]> {
  const oneHourAgo = new Date(Date.now() - 3_600_000);
  const errors = await db
    .select()
    .from(systemErrorLogs)
    .where(
      and(
        eq(systemErrorLogs.resolved, false),
        or(
          eq(systemErrorLogs.severity, "critical"),
          eq(systemErrorLogs.severity, "high"),
        ),
        gt(systemErrorLogs.createdAt, oneHourAgo),
        // Exclude client-side telemetry (dead clicks, perf anomalies, CLS) —
        // these are observational, not actionable server errors
        ne(systemErrorLogs.type, "client"),
      ),
    )
    .orderBy(systemErrorLogs.createdAt)
    .limit(20);

  // Filter out transient infrastructure errors that are not code bugs
  const TRANSIENT_PATTERNS = [
    "EADDRINUSE",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EPIPE",
    "ENOTFOUND",
    "EAI_AGAIN",
    "socket hang up",
    "address already in use",
    "Memory usage critical",
    "Memory usage high",
    "Traffic level changed",
  ];

  const actionableErrors = errors.filter((e) => {
    const msg = e.message ?? "";
    const detail = (e as any).detail ?? "";
    const combined = `${msg} ${detail}`;
    const isTransient = TRANSIENT_PATTERNS.some((p) => combined.includes(p));
    if (isTransient) {
      // Auto-resolve transient errors so they don't pile up
      db.update(systemErrorLogs)
        .set({ resolved: true })
        .where(eq(systemErrorLogs.id, e.id))
        .catch(() => {});
    }
    return !isTransient;
  });

  // Sort by priority score (highest first) for optimal repair ordering
  actionableErrors.sort((a, b) => computeErrorPriority(b) - computeErrorPriority(a));

  return actionableErrors;
}

// ─── Repair Job Management ──────────────────────────────────────────────────

// ─── Retry Backoff ──────────────────────────────────────────────────────────

const BASE_COOLDOWN_MS = 5 * 60 * 1000;  // 5 minutes
const MAX_COOLDOWN_MS = 60 * 60 * 1000;  // 60 minutes cap

/**
 * Check whether a repair is already in progress for a given fingerprint.
 * Uses exponential backoff: 5m → 10m → 20m → 40m → 60m (capped) with jitter.
 */
export async function isRepairInProgress(
  db: Db,
  fingerprint: string,
): Promise<boolean> {
  // Check for active (non-terminal) repair jobs
  const [active] = await db
    .select({ cnt: count() })
    .from(repairJobs)
    .where(
      and(
        eq(repairJobs.errorFingerprint, fingerprint),
        sql`${repairJobs.status} NOT IN ('deployed','failed','escalated')`,
      ),
    );
  if ((active?.cnt ?? 0) > 0) return true;

  // Exponential backoff: cooldown increases with each failed attempt
  const [latest] = await db
    .select({
      attemptCount: repairJobs.attemptCount,
      completedAt: repairJobs.completedAt,
    })
    .from(repairJobs)
    .where(
      and(
        eq(repairJobs.errorFingerprint, fingerprint),
        eq(repairJobs.status, "failed"),
      ),
    )
    .orderBy(desc(repairJobs.completedAt))
    .limit(1);

  if (latest?.completedAt) {
    const attempts = latest.attemptCount || 0;
    // Exponential: 5m * 2^attempts, capped at 60m, plus random jitter (0-30s)
    const cooldownMs = Math.min(
      BASE_COOLDOWN_MS * Math.pow(2, attempts),
      MAX_COOLDOWN_MS,
    ) + Math.floor(Math.random() * 30_000);
    const cooldownCutoff = new Date(Date.now() - cooldownMs);
    if (new Date(latest.completedAt) > cooldownCutoff) return true;
  }

  return false;
}

/**
 * Get the most recent failed repair attempt for a fingerprint.
 * Used to pass context to the next retry so Claude can try a different strategy.
 */
export async function getLastFailedAttempt(
  db: Db,
  fingerprint: string,
): Promise<{ attemptCount: number; failureReason: string | null; claudeOutput: string | null } | null> {
  const [row] = await db
    .select({
      attemptCount: repairJobs.attemptCount,
      failureReason: repairJobs.failureReason,
      claudeOutput: repairJobs.claudeOutput,
    })
    .from(repairJobs)
    .where(
      and(
        eq(repairJobs.errorFingerprint, fingerprint),
        eq(repairJobs.status, "failed"),
      ),
    )
    .orderBy(desc(repairJobs.completedAt))
    .limit(1);

  return row ?? null;
}

/**
 * Create a new repair job for a detected error.
 */
export async function createRepairJob(
  db: Db,
  errorLog: SystemErrorLog,
  fingerprint: string,
): Promise<number> {
  const branchName = `fix/autopilot-${errorLog.id}-${Date.now()}`;
  const [result] = await db.insert(repairJobs).values({
    errorLogId: errorLog.id,
    errorFingerprint: fingerprint,
    status: "detected",
    branchName,
    errorType: errorLog.type,
    errorMessage: (errorLog.message || "").slice(0, 65535),
    affectedFile: extractAffectedFile(errorLog.detail),
    triggeredBy: "sentinel",
    detectedAt: new Date(),
  } satisfies Partial<InsertRepairJob>);

  return (result as any).insertId as number;
}

/**
 * Update a repair job's status and optional extra fields.
 */
export async function updateRepairJobStatus(
  db: Db,
  jobId: number,
  status: RepairJob["status"],
  extras?: Partial<Pick<RepairJob, "claudeOutput" | "diffPatch" | "testResults" | "failureReason" | "attemptCount">>,
): Promise<void> {
  const timestampField = statusToTimestampField(status);
  const update: Record<string, unknown> = { status, ...extras };
  if (timestampField) update[timestampField] = new Date();

  await db
    .update(repairJobs)
    .set(update)
    .where(eq(repairJobs.id, jobId));
}

function statusToTimestampField(status: string): string | null {
  const map: Record<string, string> = {
    diagnosing: "diagnosisStartedAt",
    patching: "patchStartedAt",
    testing: "testStartedAt",
    verifying: "verifyStartedAt",
    deployed: "completedAt",
    failed: "completedAt",
    escalated: "completedAt",
  };
  return map[status] ?? null;
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────────

/**
 * Count how many times repairs have failed for a given fingerprint.
 */
export async function getRepairJobAttempts(
  db: Db,
  fingerprint: string,
): Promise<number> {
  const [row] = await db
    .select({ cnt: count() })
    .from(repairJobs)
    .where(
      and(
        eq(repairJobs.errorFingerprint, fingerprint),
        eq(repairJobs.status, "failed"),
      ),
    );
  return row?.cnt ?? 0;
}

/**
 * Returns whether the circuit breaker should trip, with tenant-scoped granularity.
 *
 * - Tenant-scoped: 3+ failures from a single tenant → disable feature for that tenant only
 * - Platform-wide: 3+ distinct tenants with failures → disable platform-wide
 *
 * This prevents one tenant's issues from disabling features for everyone.
 */
export async function shouldTripCircuitBreaker(
  db: Db,
  fingerprint: string,
  tenantId?: number | null,
): Promise<{ tripped: boolean; scope: "tenant" | "platform" }> {
  // Tenant-scoped check first
  if (tenantId) {
    const [tenantFailures] = await db
      .select({ cnt: count() })
      .from(repairJobs)
      .innerJoin(systemErrorLogs, eq(repairJobs.errorLogId, systemErrorLogs.id))
      .where(
        and(
          eq(repairJobs.errorFingerprint, fingerprint),
          eq(repairJobs.status, "failed"),
          eq(systemErrorLogs.tenantId, tenantId),
        ),
      );
    if ((tenantFailures?.cnt ?? 0) >= MAX_REPAIR_ATTEMPTS) {
      return { tripped: true, scope: "tenant" };
    }
  }

  // Platform-wide check: 3+ distinct tenants with failures for same fingerprint
  const [distinctTenants] = await db
    .select({ cnt: sql<number>`COUNT(DISTINCT ${systemErrorLogs.tenantId})` })
    .from(repairJobs)
    .innerJoin(systemErrorLogs, eq(repairJobs.errorLogId, systemErrorLogs.id))
    .where(
      and(
        eq(repairJobs.errorFingerprint, fingerprint),
        eq(repairJobs.status, "failed"),
      ),
    );
  if ((distinctTenants?.cnt ?? 0) >= 3) {
    return { tripped: true, scope: "platform" };
  }

  return { tripped: false, scope: "tenant" };
}

/**
 * Disable the feature associated with an error type by writing to featureConfigs.
 * If tenantId is null, this is a platform-wide disable (tenantId=0 sentinel).
 */
export async function disableFeatureForError(
  db: Db,
  errorType: string,
  tenantId?: number | null,
): Promise<void> {
  const feature = ERROR_TYPE_TO_FEATURE[errorType];
  if (!feature) return;

  const tid = tenantId ?? 0; // 0 = platform-wide sentinel flag
  await db
    .insert(featureConfigs)
    .values({
      tenantId: tid,
      feature: `sentinel_disabled_${feature}`,
      config: { disabled: true, reason: "circuit_breaker_tripped", disabledAt: new Date().toISOString() },
      enabled: false,
    })
    .onDuplicateKeyUpdate({
      set: {
        config: { disabled: true, reason: "circuit_breaker_tripped", disabledAt: new Date().toISOString() },
        enabled: false,
        updatedAt: new Date(),
      },
    });
}

// ─── Failure Correlation ────────────────────────────────────────────────────

/**
 * Correlated error types: when an upstream provider fails, downstream
 * systems produce cascading errors. The circuit breaker should not penalize
 * the downstream type for failures caused by the upstream provider.
 *
 * Key = upstream, Value = downstream types it causes.
 */
const CORRELATED_TYPES: Record<string, string[]> = {
  twilio: ["automation"],     // SMS provider down → automations that send SMS fail
  billing: ["webhook"],       // Payment processor down → webhook delivery failures
  ai: ["automation"],         // AI provider down → AI-powered automations fail
};

/**
 * Detect correlated failures: when two related error types both spike within
 * a 15-minute window, suppress the downstream circuit breaker and report
 * a correlation event instead.
 *
 * Returns error types that should be suppressed from circuit-breaking.
 */
export async function detectCorrelatedFailures(db: Db): Promise<{
  suppressedTypes: Set<string>;
  correlations: Array<{ upstream: string; downstream: string; upstreamCount: number; downstreamCount: number }>;
}> {
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
  const suppressedTypes = new Set<string>();
  const correlations: Array<{ upstream: string; downstream: string; upstreamCount: number; downstreamCount: number }> = [];

  // Get recent error counts by type
  const errorCounts = await db
    .select({
      type: systemErrorLogs.type,
      cnt: count(),
    })
    .from(systemErrorLogs)
    .where(
      and(
        eq(systemErrorLogs.resolved, false),
        gt(systemErrorLogs.createdAt, fifteenMinAgo),
      ),
    )
    .groupBy(systemErrorLogs.type);

  const countMap = new Map<string, number>();
  for (const row of errorCounts) {
    countMap.set(row.type, row.cnt);
  }

  // Check for correlated spikes
  for (const [upstream, downstreams] of Object.entries(CORRELATED_TYPES)) {
    const upstreamCount = countMap.get(upstream) ?? 0;
    if (upstreamCount < 3) continue; // Upstream needs a real spike

    for (const downstream of downstreams) {
      const downstreamCount = countMap.get(downstream) ?? 0;
      if (downstreamCount < 3) continue; // Downstream also spiking

      suppressedTypes.add(downstream);
      correlations.push({ upstream, downstream, upstreamCount, downstreamCount });
    }
  }

  return { suppressedTypes, correlations };
}

// ─── Circuit Breaker Auto-Recovery ──────────────────────────────────────────

const RECOVERY_BASE_COOLDOWN_MIN = 15;
const RECOVERY_MAX_COOLDOWN_MIN = 120;
const RECOVERY_CHECKS_REQUIRED = 3;

/**
 * Check disabled features for auto-recovery eligibility.
 * After a cooldown period with no new errors, gradually re-enable features.
 *
 * Recovery uses exponential cooldown: 15m → 30m → 60m → 120m (capped).
 * After RECOVERY_CHECKS_REQUIRED clean checks, the feature is re-enabled.
 *
 * Config JSON shape: { disabled: true, reason: string, disabledAt: string,
 *   recoveryAttempts?: number, lastRecoveryCheckAt?: string }
 */
export async function checkCircuitBreakerRecovery(db: Db): Promise<number> {
  const { like, eq: eqOp, and: andOp } = await import("drizzle-orm");

  const disabledRows = await db
    .select({
      id: featureConfigs.id,
      feature: featureConfigs.feature,
      tenantId: featureConfigs.tenantId,
      config: featureConfigs.config,
    })
    .from(featureConfigs)
    .where(
      andOp(
        like(featureConfigs.feature, "sentinel_disabled_%"),
        eqOp(featureConfigs.enabled, false),
      ),
    )
    .limit(20);

  let recovered = 0;
  const now = Date.now();

  for (const row of disabledRows) {
    const config = (row.config as Record<string, unknown>) || {};
    const disabledAt = config.disabledAt ? new Date(config.disabledAt as string).getTime() : 0;
    const recoveryAttempts = (config.recoveryAttempts as number) || 0;

    // Compute cooldown: 15min * 2^attempts, capped at 120min
    const cooldownMin = Math.min(
      RECOVERY_BASE_COOLDOWN_MIN * Math.pow(2, recoveryAttempts),
      RECOVERY_MAX_COOLDOWN_MIN,
    );
    const cooldownMs = cooldownMin * 60 * 1000;
    const lastCheckAt = config.lastRecoveryCheckAt
      ? new Date(config.lastRecoveryCheckAt as string).getTime()
      : disabledAt;

    // Skip if cooldown hasn't elapsed since last check
    if (now - lastCheckAt < cooldownMs) continue;

    // Extract the error type from feature name (sentinel_disabled_ai_chat → ai)
    const featureName = row.feature.replace("sentinel_disabled_", "");
    const errorType = Object.entries(ERROR_TYPE_TO_FEATURE).find(
      ([_, feat]) => feat === featureName,
    )?.[0];

    if (!errorType) continue;

    // Check for new errors of this type in the last 15 minutes
    const fifteenMinAgo = new Date(now - 15 * 60 * 1000);
    const tenantFilter = row.tenantId && row.tenantId !== 0
      ? and(
          sql`${systemErrorLogs.type} = ${errorType}`,
          eq(systemErrorLogs.resolved, false),
          gt(systemErrorLogs.createdAt, fifteenMinAgo),
          eq(systemErrorLogs.tenantId, row.tenantId),
        )
      : and(
          sql`${systemErrorLogs.type} = ${errorType}`,
          eq(systemErrorLogs.resolved, false),
          gt(systemErrorLogs.createdAt, fifteenMinAgo),
        );

    const [recentErrors] = await db
      .select({ cnt: count() })
      .from(systemErrorLogs)
      .where(tenantFilter);

    if ((recentErrors?.cnt ?? 0) > 0) {
      // Still seeing errors — reset recovery attempts
      await db.update(featureConfigs).set({
        config: {
          ...config,
          recoveryAttempts: 0,
          lastRecoveryCheckAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      }).where(eqOp(featureConfigs.id, row.id));
      continue;
    }

    // No new errors — increment recovery attempts
    const newAttempts = recoveryAttempts + 1;

    if (newAttempts >= RECOVERY_CHECKS_REQUIRED) {
      // Enough clean checks — re-enable the feature
      await db.update(featureConfigs).set({
        enabled: true,
        config: {
          ...config,
          disabled: false,
          recovered: true,
          recoveredAt: new Date().toISOString(),
          recoveryAttempts: newAttempts,
          lastRecoveryCheckAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      }).where(eqOp(featureConfigs.id, row.id));
      logger.info(`[sentinel] Auto-recovered feature "${featureName}" for tenant ${row.tenantId} after ${newAttempts} clean checks`);
      recovered++;
    } else {
      // Not enough clean checks yet — record progress
      await db.update(featureConfigs).set({
        config: {
          ...config,
          recoveryAttempts: newAttempts,
          lastRecoveryCheckAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      }).where(eqOp(featureConfigs.id, row.id));
    }
  }

  return recovered;
}

// ─── Auto-Escalation (Dead Letter Queue) ───────────────────────────────────

/**
 * Auto-escalate failed repair jobs that have exhausted all retry attempts.
 * Prevents failed repairs from sitting silently forever — promotes them to
 * "escalated" status and sends alerts to admin channels.
 *
 * Returns the number of jobs escalated.
 */
export async function autoEscalateStaleFailures(db: Db): Promise<number> {
  const maxAttemptsReached = await db
    .select({
      id: repairJobs.id,
      errorFingerprint: repairJobs.errorFingerprint,
      errorType: repairJobs.errorType,
      errorMessage: repairJobs.errorMessage,
      affectedFile: repairJobs.affectedFile,
      attemptCount: repairJobs.attemptCount,
    })
    .from(repairJobs)
    .where(
      and(
        eq(repairJobs.status, "failed"),
        sql`${repairJobs.attemptCount} >= ${MAX_REPAIR_ATTEMPTS}`,
      ),
    )
    .limit(10);

  let escalated = 0;
  for (const job of maxAttemptsReached) {
    await updateRepairJobStatus(db, job.id, "escalated", {
      failureReason: `Auto-escalated: ${job.attemptCount} attempts exhausted`,
    });
    await sendEscalationAlert({
      ...job,
      failureReason: `Auto-escalated after ${job.attemptCount} failed attempts`,
    }).catch((err) => {
      logger.warn("[sentinel] Failed to send auto-escalation alert", { jobId: job.id, error: String(err) });
    });
    escalated++;
  }

  if (escalated > 0) {
    logger.info(`[sentinel] Auto-escalated ${escalated} failed repair job(s)`);
  }
  return escalated;
}

// ─── Admin Queries ──────────────────────────────────────────────────────────

export type RepairJobWithSeverity = RepairJob & { errorSeverity: string | null };

export async function getRepairJobs(
  db: Db,
  opts?: { status?: RepairJob["status"]; limit?: number; offset?: number },
): Promise<RepairJobWithSeverity[]> {
  const { status, limit = 50, offset = 0 } = opts ?? {};
  return db
    .select({ ...getTableColumns(repairJobs), errorSeverity: systemErrorLogs.severity })
    .from(repairJobs)
    .leftJoin(systemErrorLogs, eq(repairJobs.errorLogId, systemErrorLogs.id))
    .where(status ? eq(repairJobs.status, status) : undefined)
    .orderBy(desc(repairJobs.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getRepairJobById(
  db: Db,
  id: number,
): Promise<RepairJobWithSeverity | undefined> {
  const [row] = await db
    .select({ ...getTableColumns(repairJobs), errorSeverity: systemErrorLogs.severity })
    .from(repairJobs)
    .leftJoin(systemErrorLogs, eq(repairJobs.errorLogId, systemErrorLogs.id))
    .where(eq(repairJobs.id, id))
    .limit(1);
  return row;
}

export async function getRepairStats(db: Db) {
  const rows = await db
    .select({ status: repairJobs.status, cnt: count() })
    .from(repairJobs)
    .groupBy(repairJobs.status);

  const stats: Record<string, number> = {};
  for (const r of rows) stats[r.status] = r.cnt;
  return stats;
}

// ─── Graphical Error Routing ─────────────────────────────────────────────────

/**
 * Message prefixes that indicate graphical/performance anomalies that CANNOT
 * be fixed by patching TypeScript source code via git. These are escalated
 * to admin for human review rather than triggering the repair pipeline.
 */
const GRAPHICAL_MESSAGE_PREFIXES = [
  "[PERF_ANOMALY]",
  "[VISUAL_ANOMALY]",
  "[DEAD_CLICK]",
  "[RAGE_CLICK]",
  "[AI_CHAT_QUALITY]",
  "[JOURNEY_",
];

/**
 * Returns true if this error is a graphical/performance observation that
 * cannot be resolved by an automated code patch.
 *
 * Rendering crashes ([ERROR_PAGE_SHOWN], [ERROR_PAGE_STUCK], uncaught JS)
 * return false — those CAN be repaired by the autopilot.
 */
export function isGraphicalOnlyError(error: SystemErrorLog): boolean {
  const msg = error.message || "";

  // Explicit category set at ingestion time
  const category = (error as any).errorCategory as string | undefined;
  if (category === "graphical" || category === "performance") return true;

  // Prefix-based classification
  for (const prefix of GRAPHICAL_MESSAGE_PREFIXES) {
    if (msg.includes(prefix)) return true;
  }
  return false;
}

/**
 * Immediately escalate a graphical error to the admin queue without running
 * the repair pipeline. Creates a repair_jobs record in "escalated" status,
 * then marks the source error as resolved to prevent re-processing.
 */
export async function escalateGraphicalError(
  db: Db,
  errorLog: SystemErrorLog,
  fingerprint: string,
): Promise<void> {
  const branchName = `noop/graphical-${errorLog.id}`;
  const affectedFile = extractAffectedFileFromDetail(errorLog.detail);
  const failureReason = "graphical-only: no source patch applicable — escalated to admin";

  await db.insert(repairJobs).values({
    errorLogId: errorLog.id,
    errorFingerprint: fingerprint,
    status: "escalated",
    branchName,
    errorType: errorLog.type,
    errorMessage: (errorLog.message || "").slice(0, 65535),
    affectedFile,
    triggeredBy: "sentinel",
    failureReason,
    detectedAt: new Date(),
    completedAt: new Date(),
  } satisfies Partial<InsertRepairJob>);

  // Graphical errors are logged to DB but do NOT send email alerts —
  // they are client-side perf observations (CLS, dead clicks, etc.),
  // not actionable server bugs. Admins can review them in the repair dashboard.

  // Mark source error resolved so sentinel won't re-process it next cycle
  await db
    .update(systemErrorLogs)
    .set({ resolved: true })
    .where(eq(systemErrorLogs.id, errorLog.id));
}

/**
 * Return aggregate graphical error profiling data for the admin dashboard.
 * Groups errors by page URL and error category.
 */
export async function getGraphicalErrorProfile(db: Db): Promise<{
  byPage: { page: string; count: number }[];
  byCategory: { category: string; count: number }[];
  recentEscalations: RepairJob[];
}> {
  const oneDayAgo = new Date(Date.now() - 86_400_000);

  // Pull recent escalated jobs with graphical failure reason
  const recentEscalations = await db
    .select()
    .from(repairJobs)
    .where(
      and(
        eq(repairJobs.status, "escalated"),
        sql`${repairJobs.failureReason} LIKE '%graphical-only%'`,
        gt(repairJobs.createdAt, oneDayAgo),
      ),
    )
    .orderBy(desc(repairJobs.createdAt))
    .limit(50);

  // Pull recent graphical/performance errors from error logs
  const recentErrors = await db
    .select()
    .from(systemErrorLogs)
    .where(
      and(
        or(
          eq(systemErrorLogs.errorCategory, "graphical"),
          eq(systemErrorLogs.errorCategory, "performance"),
        ),
        gt(systemErrorLogs.createdAt, oneDayAgo),
      ),
    )
    .orderBy(desc(systemErrorLogs.createdAt))
    .limit(200);

  // Group by pageUrl extracted from detail JSON
  const pageMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();

  for (const err of recentErrors) {
    // Extract pageUrl from detail JSON
    let page = "unknown";
    try {
      const d = JSON.parse(err.detail || "{}");
      if (d.pageUrl) page = d.pageUrl;
      else if (d.url) page = new URL(d.url).pathname;
    } catch {}
    pageMap.set(page, (pageMap.get(page) ?? 0) + 1);

    const cat = (err as any).errorCategory || "unknown";
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
  }

  const byPage = Array.from(pageMap.entries())
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const byCategory = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return { byPage, byCategory, recentEscalations };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Internal alias used by escalateGraphicalError above
function extractAffectedFileFromDetail(detail: string | null): string | null {
  return extractAffectedFile(detail);
}

/**
 * Extract the first application file path from a stack trace.
 */
export function extractAffectedFile(detail: string | null): string | null {
  if (!detail) return null;
  const lines = detail.split("\n");
  for (const line of lines) {
    const match = line.match(/at\s+.*?\(?((?:\/|[A-Z]:\\).*?\.[jt]sx?)/);
    if (match?.[1] && !match[1].includes("node_modules")) {
      return match[1];
    }
  }
  return null;
}

// ─── Observability Queries ──────────────────────────────────────────────────

/**
 * Get sentinel metrics time series data for the dashboard.
 */
export async function getMetricsTimeseries(
  db: Db,
  opts: { hours?: number; tenantId?: number; metric?: string; category?: string },
) {
  const { sentinelMetrics, sentinelBaselines } = await import("../../drizzle/schema");
  const { and: andOp, eq: eqOp, gt: gtOp } = await import("drizzle-orm");

  const hours = opts.hours ?? 24;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const conditions: any[] = [gtOp(sentinelMetrics.measuredAt, since)];
  if (opts.tenantId) conditions.push(eqOp(sentinelMetrics.tenantId, opts.tenantId));
  if (opts.metric) conditions.push(eqOp(sentinelMetrics.metric, opts.metric));
  if (opts.category) conditions.push(eqOp(sentinelMetrics.category, opts.category));

  const metrics = await db
    .select()
    .from(sentinelMetrics)
    .where(andOp(...conditions))
    .orderBy(sentinelMetrics.measuredAt)
    .limit(500);

  // Get matching baselines for overlay
  const baselineConditions: any[] = [];
  if (opts.tenantId) baselineConditions.push(eqOp(sentinelBaselines.tenantId, opts.tenantId));
  if (opts.metric) baselineConditions.push(eqOp(sentinelBaselines.metric, opts.metric));

  const baselines = await db
    .select()
    .from(sentinelBaselines)
    .where(baselineConditions.length > 0 ? andOp(...baselineConditions) : undefined)
    .limit(100);

  return { metrics, baselines };
}

/**
 * Get distinct metric categories and names for dropdown population.
 */
export async function getMetricsCategories(db: Db) {
  const { sentinelMetrics } = await import("../../drizzle/schema");

  const rows = await db
    .select({
      category: sentinelMetrics.category,
      metric: sentinelMetrics.metric,
    })
    .from(sentinelMetrics)
    .groupBy(sentinelMetrics.category, sentinelMetrics.metric)
    .limit(200);

  return rows;
}

/**
 * Get analyzer violations from systemErrorLogs, grouped by analyzer prefix.
 */
export async function getAnalyzerViolations(
  db: Db,
  opts?: { limit?: number },
) {
  const limit = opts?.limit ?? 100;
  const oneDayAgo = new Date(Date.now() - 86_400_000);

  const rows = await db
    .select()
    .from(systemErrorLogs)
    .where(
      and(
        gt(systemErrorLogs.createdAt, oneDayAgo),
        or(
          sql`${systemErrorLogs.message} LIKE '[PIPELINE]%'`,
          sql`${systemErrorLogs.message} LIKE '[AUTOMATION_%'`,
          sql`${systemErrorLogs.message} LIKE '[DATA_CONSISTENCY]%'`,
          sql`${systemErrorLogs.message} LIKE '[PLAN_VIOLATION]%'`,
          sql`${systemErrorLogs.message} LIKE '[ORPHANED_%'`,
          sql`${systemErrorLogs.message} LIKE '[STATE_MACHINE]%'`,
          sql`${systemErrorLogs.message} LIKE '[JOB_QUEUE]%'`,
          sql`${systemErrorLogs.message} LIKE '[CORRELATED_%'`,
        ),
      ),
    )
    .orderBy(desc(systemErrorLogs.createdAt))
    .limit(limit);

  // Group by analyzer prefix
  const grouped: Record<string, typeof rows> = {
    pipeline: [],
    automation: [],
    data: [],
    plan: [],
    correlation: [],
  };

  for (const row of rows) {
    const msg = row.message || "";
    if (msg.startsWith("[PIPELINE]")) grouped.pipeline.push(row);
    else if (msg.startsWith("[AUTOMATION_") || msg.startsWith("[DEAD_AUTOMATION]")) grouped.automation.push(row);
    else if (msg.startsWith("[DATA_CONSISTENCY]") || msg.startsWith("[ORPHANED_") || msg.startsWith("[STATE_MACHINE]") || msg.startsWith("[JOB_QUEUE]")) grouped.data.push(row);
    else if (msg.startsWith("[PLAN_VIOLATION]")) grouped.plan.push(row);
    else if (msg.startsWith("[CORRELATED_")) grouped.correlation.push(row);
  }

  return grouped;
}

/**
 * Get feature disable/enable history from featureConfigs.
 */
export async function getFeatureDisableHistory(db: Db) {
  const { like } = await import("drizzle-orm");

  const rows = await db
    .select()
    .from(featureConfigs)
    .where(like(featureConfigs.feature, "sentinel_disabled_%"))
    .limit(50);

  return rows.map((row) => {
    const config = (row.config as Record<string, unknown>) || {};
    return {
      id: row.id,
      feature: row.feature.replace("sentinel_disabled_", ""),
      tenantId: row.tenantId,
      enabled: row.enabled,
      disabledAt: config.disabledAt as string | undefined,
      recoveredAt: config.recoveredAt as string | undefined,
      reason: config.reason as string | undefined,
      recoveryAttempts: config.recoveryAttempts as number | undefined,
      updatedAt: row.updatedAt,
    };
  });
}

/**
 * Get repair effectiveness analytics: success rates, phase durations, trends.
 */
export async function getRepairEffectiveness(db: Db, opts?: { days?: number }) {
  const days = opts?.days ?? 14;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Status distribution
  const statusDist = await db
    .select({ status: repairJobs.status, cnt: count() })
    .from(repairJobs)
    .where(gt(repairJobs.createdAt, since))
    .groupBy(repairJobs.status);

  // Success rate by error type
  const byType = await db
    .select({
      errorType: repairJobs.errorType,
      total: count(),
      deployed: sql<number>`SUM(CASE WHEN ${repairJobs.status} = 'deployed' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN ${repairJobs.status} = 'failed' THEN 1 ELSE 0 END)`,
      escalated: sql<number>`SUM(CASE WHEN ${repairJobs.status} = 'escalated' THEN 1 ELSE 0 END)`,
    })
    .from(repairJobs)
    .where(gt(repairJobs.createdAt, since))
    .groupBy(repairJobs.errorType);

  // Daily trend
  const dailyTrend = await db
    .select({
      day: sql<string>`DATE(${repairJobs.createdAt})`,
      total: count(),
      deployed: sql<number>`SUM(CASE WHEN ${repairJobs.status} = 'deployed' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN ${repairJobs.status} = 'failed' THEN 1 ELSE 0 END)`,
      escalated: sql<number>`SUM(CASE WHEN ${repairJobs.status} = 'escalated' THEN 1 ELSE 0 END)`,
    })
    .from(repairJobs)
    .where(gt(repairJobs.createdAt, since))
    .groupBy(sql`DATE(${repairJobs.createdAt})`)
    .orderBy(sql`DATE(${repairJobs.createdAt})`);

  // Average phase durations (for completed repairs)
  const phaseDurations = await db
    .select({
      avgDiagnosis: sql<number>`AVG(TIMESTAMPDIFF(SECOND, ${repairJobs.detectedAt}, ${repairJobs.diagnosisStartedAt}))`,
      avgPatch: sql<number>`AVG(TIMESTAMPDIFF(SECOND, ${repairJobs.diagnosisStartedAt}, ${repairJobs.patchStartedAt}))`,
      avgTest: sql<number>`AVG(TIMESTAMPDIFF(SECOND, ${repairJobs.patchStartedAt}, ${repairJobs.testStartedAt}))`,
      avgVerify: sql<number>`AVG(TIMESTAMPDIFF(SECOND, ${repairJobs.testStartedAt}, ${repairJobs.verifyStartedAt}))`,
      avgTotal: sql<number>`AVG(TIMESTAMPDIFF(SECOND, ${repairJobs.detectedAt}, ${repairJobs.completedAt}))`,
    })
    .from(repairJobs)
    .where(
      and(
        gt(repairJobs.createdAt, since),
        eq(repairJobs.status, "deployed"),
      ),
    );

  return {
    statusDistribution: statusDist,
    byErrorType: byType,
    dailyTrend,
    phaseDurations: phaseDurations[0] ?? null,
    periodDays: days,
  };
}
