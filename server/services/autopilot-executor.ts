/**
 * Autopilot Executor - Node.js bridge to the repair shell script.
 *
 * Uses child_process.execFile (not exec) to avoid shell injection.
 * Parses structured output between delimiters for audit trail storage.
 */

import { execFile, execSync } from "child_process";
import { resolve } from "path";
import { existsSync } from "fs";
import { logger } from "../_core/logger";

// ─── Constants ───────────────────────────────────────────────────────────────

// In production (bundled ESM in dist/), script lives alongside dist at project root.
// In dev, it's at scripts/autopilot-repair.sh relative to project root.
const PROJECT_ROOT = process.cwd();
const SCRIPT_PATH = (() => {
  const candidates = [
    resolve(PROJECT_ROOT, "scripts/autopilot-repair.sh"),
    resolve(PROJECT_ROOT, "../scripts/autopilot-repair.sh"),
  ];
  return candidates.find(p => existsSync(p)) || candidates[0];
})();

// Pre-flight: check if `claude` CLI is available on this machine.
// If not, all repairs will immediately escalate instead of failing after 5 min.
const CLAUDE_CLI_AVAILABLE = (() => {
  try {
    execSync("which claude", { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
})();

// Check for source files (TypeScript source needed for Edit/Write)
const SOURCE_FILES_PRESENT = existsSync(resolve(PROJECT_ROOT, "server/services")) ||
  existsSync(resolve(PROJECT_ROOT, "../server/services"));

if (!CLAUDE_CLI_AVAILABLE) {
  logger.warn("[autopilot-executor] claude CLI not found — autopilot repairs will escalate immediately");
}
if (!SOURCE_FILES_PRESENT) {
  logger.warn("[autopilot-executor] TypeScript source files not found — autopilot repairs will escalate immediately");
}
const TIMEOUT_MS = 300_000; // 5 minutes
const MAX_BUFFER = 10 * 1024 * 1024; // 10 MB

const OUTPUT_START = "===REPAIR_OUTPUT_START===";
const OUTPUT_END = "===REPAIR_OUTPUT_END===";
const DIFF_START = "===REPAIR_DIFF_START===";
const DIFF_END = "===REPAIR_DIFF_END===";
const TEST_START = "===REPAIR_TEST_START===";
const TEST_END = "===REPAIR_TEST_END===";

/**
 * Files the autopilot is forbidden from modifying.
 * Enforced at both the Claude prompt level AND the shell script level.
 */
export const PROTECTED_FILES = [
  "server/services/sentinel.service.ts",
  "server/services/autopilot-executor.ts",
  "server/sentinel.ts",
  "scripts/autopilot-repair.sh",
  "drizzle/schema.ts",
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RepairContext {
  jobId: number;
  branchName: string;
  errorType: string;
  errorMessage: string;
  stackTrace: string;
  affectedFile: string | null;
  /** Which attempt is this (1-based)? Used for multi-strategy prompts. */
  attemptNumber?: number;
  /** Previous failure reason, provided on retry so Claude can try differently. */
  previousFailureReason?: string;
  /** Previous Claude output from failed attempt, for context. */
  previousClaudeOutput?: string;
}

export interface RepairResult {
  success: boolean;
  noOp?: boolean;
  claudeOutput: string;
  diffPatch: string;
  testResults: string;
  failureReason?: string;
}

// ─── Executor ────────────────────────────────────────────────────────────────

/**
 * Execute the autopilot repair shell script with the given context.
 * Returns a structured result with Claude output, diff, and test results.
 */
export function executeRepairScript(ctx: RepairContext): Promise<RepairResult> {
  return new Promise((resolve) => {
    // Pre-flight: if claude CLI or source files are missing, escalate immediately
    if (!CLAUDE_CLI_AVAILABLE || !SOURCE_FILES_PRESENT) {
      const reason = !CLAUDE_CLI_AVAILABLE
        ? "claude CLI not installed on this machine — cannot run automated repairs"
        : "TypeScript source files not present — cannot edit bundled dist output";
      logger.info(`[autopilot-executor] Skipping repair for job ${ctx.jobId}: ${reason}`);
      resolve({
        success: false,
        noOp: true,
        claudeOutput: "",
        diffPatch: "",
        testResults: "",
        failureReason: reason,
      });
      return;
    }

    const args = [
      SCRIPT_PATH,
      String(ctx.jobId),
      ctx.branchName,
      ctx.errorType,
      ctx.errorMessage.slice(0, 2000),
      ctx.stackTrace.slice(0, 4000),
      ctx.affectedFile || "unknown",
      PROTECTED_FILES.join(","),
      String(ctx.attemptNumber ?? 1),
      (ctx.previousFailureReason || "").slice(0, 1000),
      (ctx.previousClaudeOutput || "").slice(0, 2000),
    ];

    logger.info(`[autopilot-executor] Starting repair for job ${ctx.jobId}`, {
      branch: ctx.branchName,
      affectedFile: ctx.affectedFile,
    });

    execFile("bash", args, {
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        AUTOPILOT_JOB_ID: String(ctx.jobId),
        AUTOPILOT_BRANCH: ctx.branchName,
      },
    }, (error, stdout, stderr) => {
      const fullOutput = stdout + "\n" + stderr;

      if (error) {
        const exitCode = (error as any).code as number | undefined;
        const isTimeout = (error as any).killed && (error as any).signal === "SIGTERM";
        // Exit 6 = no-op: Claude made changes but they were all reverted by the protected-file
        // safety scan, leaving nothing to commit. Not a retriable failure.
        const isNoOp = exitCode === 6;

        const failureReason = isTimeout
          ? `Repair timed out after ${TIMEOUT_MS / 1000}s`
          : isNoOp
          ? "No-op: all changes were reverted by the protected-file safety scan — no net patch produced"
          : `Script exited with code ${exitCode}: ${error.message}`;

        if (isNoOp) {
          logger.info(`[autopilot-executor] Repair no-op for job ${ctx.jobId} (exit 6)`);
        } else {
          logger.warn(`[autopilot-executor] Repair failed for job ${ctx.jobId}`, {
            reason: failureReason,
          });
        }

        resolve({
          success: false,
          noOp: isNoOp,
          claudeOutput: extractBetween(fullOutput, OUTPUT_START, OUTPUT_END),
          diffPatch: extractBetween(fullOutput, DIFF_START, DIFF_END),
          testResults: extractBetween(fullOutput, TEST_START, TEST_END),
          failureReason,
        });
        return;
      }

      logger.info(`[autopilot-executor] Repair succeeded for job ${ctx.jobId}`);

      resolve({
        success: true,
        claudeOutput: extractBetween(fullOutput, OUTPUT_START, OUTPUT_END),
        diffPatch: extractBetween(fullOutput, DIFF_START, DIFF_END),
        testResults: extractBetween(fullOutput, TEST_START, TEST_END),
      });
    });
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractBetween(text: string, startMarker: string, endMarker: string): string {
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    if (text.length > 0) {
      logger.warn(`[autopilot-executor] Missing output delimiters: ${startMarker}`, {
        hasStart: startIdx !== -1,
        hasEnd: endIdx !== -1,
        outputLength: text.length,
      });
    }
    return "";
  }
  return text.slice(startIdx + startMarker.length, endIdx).trim();
}
