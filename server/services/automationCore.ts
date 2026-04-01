/**
 * AUTOMATION CORE ENGINE
 *
 * Centralized executeAutomation() function that provides:
 *   1. TCPA Kill-Switch — literally cannot send if lead replied STOP
 *   2. State Machine — Detected → Contacted → Recovered → Billed (recovery flows only)
 *   3. Audit Logging — every attempt logged to automation_logs table
 *   4. Revenue Tracking — recovery SMS tagged with unique recoveryId
 *   5. Sub-500ms Response — enqueues work for background processing
 *
 * Usage:
 *   import { executeAutomation } from "./automationCore";
 *   const result = await executeAutomation(db, {
 *     tenantId: 1,
 *     leadId: 42,
 *     workflowKey: "missed_call_textback",
 *     eventType: "call.missed",
 *     eventData: { phone: "+12025551234" },
 *   });
 */

import { eq, and, gte, desc, sql } from "drizzle-orm";
import { automationLogs, automations, messages } from "../../drizzle/schema";
import type { Db } from "../_core/context";
import { logger } from "../_core/logger";
import * as TcpaCompliance from "./tcpa-compliance.service";
import * as TenantService from "./tenant.service";
import * as AutomationService from "./automation.service";
import * as AutomationJobService from "./automation-job.service";
import * as RecoveryAttribution from "./recovery-attribution.service";
import { getWorkflow, isRegisteredWorkflow } from "./recoveryWorkflows";
import type {
  ExecuteAutomationInput,
  ExecuteAutomationResult,
  RecoveryState,
  AutomationWorkflowType,
} from "../../shared/interfaces";
import { VALID_RECOVERY_TRANSITIONS } from "../../shared/interfaces";

// ─── State Machine ───────────────────────────────────────────────────────────

/**
 * Validate a recovery state transition.
 * Returns true if the transition from → to is valid.
 */
export function isValidTransition(from: RecoveryState, to: RecoveryState): boolean {
  return VALID_RECOVERY_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Transition the recovery state for a log entry.
 * Creates a new audit log entry with the target state.
 */
async function transitionRecoveryState(
  db: Db,
  tenantId: number,
  automationId: number,
  automationKey: string,
  leadId: number,
  eventType: string,
  targetState: RecoveryState,
  recoveryEventId: number | undefined,
): Promise<void> {
  await logAutomationStep(db, {
    tenantId,
    automationId,
    automationKey,
    leadId,
    eventType,
    stepIndex: 0,
    stepType: "state_transition",
    status: "completed",
    recoveryState: targetState,
    recoveryEventId,
  });
}

// ─── Audit Logging ───────────────────────────────────────────────────────────

interface LogStepInput {
  tenantId: number;
  automationId: number;
  automationKey: string;
  leadId?: number;
  eventType: string;
  stepIndex: number;
  stepType: string;
  status: "started" | "completed" | "failed" | "skipped" | "tcpa_blocked";
  recoveryState?: RecoveryState;
  recoveryEventId?: number;
  durationMs?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an automation step to the audit trail.
 * NEVER throws — audit logging must not block automation execution.
 */
export async function logAutomationStep(db: Db, input: LogStepInput): Promise<number | undefined> {
  try {
    const result = await db.insert(automationLogs).values({
      tenantId: input.tenantId,
      automationId: input.automationId,
      automationKey: input.automationKey,
      leadId: input.leadId ?? null,
      eventType: input.eventType,
      stepIndex: input.stepIndex,
      stepType: input.stepType,
      status: input.status,
      recoveryState: input.recoveryState ?? null,
      recoveryEventId: input.recoveryEventId ?? null,
      durationMs: input.durationMs ?? null,
      errorMessage: input.errorMessage ?? null,
      metadata: input.metadata ?? null,
    });
    return Number((result as any)[0]?.insertId ?? (result as any).insertId ?? 0);
  } catch (err) {
    // Swallow — audit logging must never block execution
    logger.warn("Failed to write automation log", { error: String(err), ...input });
    return undefined;
  }
}

// ─── Cooldown & Dedup ────────────────────────────────────────────────────────

/**
 * Check if a lead is within the cooldown window for a specific workflow.
 */
async function isWithinCooldown(
  db: Db,
  tenantId: number,
  leadId: number,
  automationKey: string,
  cooldownMinutes: number,
): Promise<boolean> {
  if (cooldownMinutes <= 0) return false;

  const cutoff = new Date(Date.now() - cooldownMinutes * 60_000);
  const [recent] = await db
    .select({ id: automationLogs.id })
    .from(automationLogs)
    .where(
      and(
        eq(automationLogs.tenantId, tenantId),
        eq(automationLogs.leadId, leadId),
        eq(automationLogs.automationKey, automationKey),
        eq(automationLogs.status, "completed"),
        gte(automationLogs.createdAt, cutoff),
      ),
    )
    .limit(1);

  return !!recent;
}

/**
 * Count total attempts for a lead on a specific workflow.
 */
async function getAttemptCount(
  db: Db,
  tenantId: number,
  leadId: number,
  automationKey: string,
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(automationLogs)
    .where(
      and(
        eq(automationLogs.tenantId, tenantId),
        eq(automationLogs.leadId, leadId),
        eq(automationLogs.automationKey, automationKey),
        eq(automationLogs.stepType, "sms"),
      ),
    );
  return Number(result?.count ?? 0);
}

// ─── Core Engine ─────────────────────────────────────────────────────────────

/**
 * Central automation execution function.
 *
 * Flow:
 *   1. Validate tenant access (GDPR isolation)
 *   2. Look up workflow in WORKFLOW_REGISTRY
 *   3. TCPA Kill-Switch — blocks if lead is unsubscribed or has no consent
 *   4. Cooldown + max attempt checks
 *   5. Create recovery event (if recovery flow)
 *   6. Log to automation_logs with state "detected"
 *   7. Enqueue the automation job for background processing (sub-500ms)
 *   8. Return immediately
 */
export async function executeAutomation(
  db: Db,
  input: ExecuteAutomationInput,
): Promise<ExecuteAutomationResult> {
  const startTime = Date.now();
  const { tenantId, leadId, workflowKey, eventType, eventData } = input;

  // ── 1. Validate tenant access ──────────────────────────────────────────
  const entitled = await TenantService.tenantHasAutomationAccess(db, tenantId);
  if (!entitled) {
    return { success: false, blockedReason: "Tenant not entitled to automations" };
  }

  // ── 2. Look up workflow ────────────────────────────────────────────────
  const workflow = getWorkflow(workflowKey);
  if (!workflow) {
    return { success: false, blockedReason: `Unknown workflow: ${workflowKey}` };
  }

  // ── 3. TCPA KILL-SWITCH ────────────────────────────────────────────────
  const tcpaCheck = await TcpaCompliance.canSendSms(db, tenantId, leadId);
  if (!tcpaCheck.allowed) {
    // Log the TCPA block
    const automationRow = await AutomationService.getAutomationByKey(db, tenantId, workflowKey);
    if (automationRow) {
      await logAutomationStep(db, {
        tenantId,
        automationId: automationRow.id,
        automationKey: workflowKey,
        leadId,
        eventType,
        stepIndex: 0,
        stepType: "tcpa_check",
        status: "tcpa_blocked",
        metadata: { reason: tcpaCheck.reason },
      });
    }

    logger.info("TCPA Kill-Switch: automation blocked", {
      tenantId,
      leadId,
      workflowKey,
      reason: tcpaCheck.reason,
    });

    return { success: false, blockedReason: `TCPA: ${tcpaCheck.reason}` };
  }

  // ── 4. Ensure automation exists in DB (upsert from registry) ───────────
  const upsertResult = await AutomationService.upsertAutomationByKey(db, tenantId, workflowKey, {
    name: workflow.name,
    category: workflow.category as any,
    triggerType: workflow.triggerType as any,
    triggerConfig: {},
    actions: workflow.steps.map((s) => ({
      type: s.type === "sms" ? "send_message" : s.type,
      message: s.messageBody,
      messageKey: s.messageKey,
      tone: s.tone,
      value: s.delaySeconds,
      targetState: s.targetState,
    })),
    enabled: true,
  });

  // upsertAutomationByKey returns the existing record (with .id) or the insert result.
  // Normalize to get the automation ID.
  let automationId: number;
  if (upsertResult && typeof upsertResult === "object" && "id" in upsertResult) {
    automationId = (upsertResult as any).id;
  } else {
    // If upsert returned a raw result, fetch the automation by key
    const fetched = await AutomationService.getAutomationByKey(db, tenantId, workflowKey);
    if (!fetched) {
      return { success: false, blockedReason: "Failed to upsert automation record" };
    }
    automationId = fetched.id;
  }

  const automation = { id: automationId };

  // ── 5. Cooldown check ──────────────────────────────────────────────────
  if (workflow.cooldownMinutes > 0) {
    const inCooldown = await isWithinCooldown(db, tenantId, leadId, workflowKey, workflow.cooldownMinutes);
    if (inCooldown) {
      await logAutomationStep(db, {
        tenantId,
        automationId: automation.id,
        automationKey: workflowKey,
        leadId,
        eventType,
        stepIndex: 0,
        stepType: "cooldown_check",
        status: "skipped",
        metadata: { cooldownMinutes: workflow.cooldownMinutes },
      });
      return { success: false, blockedReason: "Within cooldown window" };
    }
  }

  // ── 6. Max attempts check ──────────────────────────────────────────────
  if (workflow.maxAttemptsPerLead > 0) {
    const attempts = await getAttemptCount(db, tenantId, leadId, workflowKey);
    if (attempts >= workflow.maxAttemptsPerLead) {
      await logAutomationStep(db, {
        tenantId,
        automationId: automation.id,
        automationKey: workflowKey,
        leadId,
        eventType,
        stepIndex: 0,
        stepType: "max_attempts_check",
        status: "skipped",
        metadata: { attempts, maxAttemptsPerLead: workflow.maxAttemptsPerLead },
      });
      return { success: false, blockedReason: "Max attempts reached" };
    }
  }

  // ── 7. Create recovery event (if recovery flow) ────────────────────────
  let recoveryEventId: number | undefined;
  let trackingToken: string | undefined;

  if (workflow.isRecoveryFlow && workflow.leakageType) {
    const recoveryResult = await RecoveryAttribution.createRecoveryEvent(db, {
      tenantId,
      leadId,
      automationId: automation.id,
      leakageType: workflow.leakageType,
      estimatedRevenue: input.estimatedRevenue ?? 0,
    });
    recoveryEventId = recoveryResult.recoveryEventId;
    trackingToken = recoveryResult.trackingToken;

    // State machine: Detected
    await transitionRecoveryState(
      db, tenantId, automation.id, workflowKey, leadId, eventType,
      "detected", recoveryEventId,
    );
  }

  // ── 8. Log "started" ──────────────────────────────────────────────────
  const logId = await logAutomationStep(db, {
    tenantId,
    automationId: automation.id,
    automationKey: workflowKey,
    leadId,
    eventType,
    stepIndex: 0,
    stepType: "execute",
    status: "started",
    recoveryState: workflow.isRecoveryFlow ? "detected" : undefined,
    recoveryEventId,
    durationMs: Date.now() - startTime,
  });

  // ── 9. Enqueue for background processing (sub-500ms response) ─────────
  const jobId = await AutomationJobService.enqueueAutomationJob(db, {
    tenantId,
    automationId: automation.id,
    leadId,
    eventType,
    eventData: {
      ...eventData,
      _workflowKey: workflowKey,
      _recoveryEventId: recoveryEventId,
      _trackingToken: trackingToken,
      _automationLogId: logId,
    },
    stepIndex: 0,
    nextRunAt: new Date(), // Process immediately on next worker tick
  });

  logger.info("Automation enqueued", {
    tenantId,
    leadId,
    workflowKey,
    automationId: automation.id,
    recoveryEventId,
    jobId,
    durationMs: Date.now() - startTime,
  });

  return {
    success: true,
    automationLogId: logId,
    recoveryEventId,
    trackingToken,
    jobId: typeof jobId === "number" ? jobId : undefined,
  };
}

// ─── Recovery State Transitions (called by external services) ────────────────

/**
 * Mark a recovery as "contacted" — called when SMS is actually delivered.
 * This is the Detected → Contacted transition.
 */
export async function markRecoveryContacted(
  db: Db,
  tenantId: number,
  leadId: number,
  automationId: number,
  workflowKey: string,
  recoveryEventId: number,
): Promise<void> {
  await transitionRecoveryState(
    db, tenantId, automationId, workflowKey, leadId,
    "sms.delivered", "contacted", recoveryEventId,
  );
}

/**
 * Mark a recovery as "recovered" — called when appointment.booked fires
 * for a lead with an active recovery event.
 * This is the Contacted → Recovered transition.
 */
export async function markRecoveryRecovered(
  db: Db,
  tenantId: number,
  leadId: number,
  data: { recoveredAppointmentId?: string; estimatedRevenue?: number },
): Promise<void> {
  // Delegate to existing attribution service (last-touch dedup)
  const { primaryEventId } = await RecoveryAttribution.markRecoveryConverted(
    db, tenantId, leadId, data,
  );

  if (primaryEventId) {
    // Find the automation that sent the recovery SMS
    const [log] = await db
      .select({
        automationId: automationLogs.automationId,
        automationKey: automationLogs.automationKey,
      })
      .from(automationLogs)
      .where(
        and(
          eq(automationLogs.tenantId, tenantId),
          eq(automationLogs.leadId, leadId),
          eq(automationLogs.recoveryState, "contacted"),
        ),
      )
      .orderBy(desc(automationLogs.createdAt))
      .limit(1);

    if (log) {
      await transitionRecoveryState(
        db, tenantId, log.automationId, log.automationKey, leadId,
        "appointment.booked", "recovered", primaryEventId,
      );
    }
  }
}

/**
 * Mark a recovery as "billed" — called when Stripe payment is captured.
 * This is the Recovered → Billed transition.
 * Calculates the 15% commission.
 */
export async function markRecoveryBilled(
  db: Db,
  tenantId: number,
  leadId: number,
  data: {
    stripePaymentIntentId: string;
    stripeInvoiceId?: string;
    realizedRevenue: number;
    recoveryEventId?: number;
  },
): Promise<void> {
  // Delegate to existing attribution service
  await RecoveryAttribution.markRecoveryRealized(db, tenantId, leadId, {
    stripePaymentIntentId: data.stripePaymentIntentId,
    stripeInvoiceId: data.stripeInvoiceId,
    realizedRevenue: data.realizedRevenue,
    recoveryEventId: data.recoveryEventId,
  });

  // Find the log for this recovery
  const [log] = await db
    .select({
      automationId: automationLogs.automationId,
      automationKey: automationLogs.automationKey,
    })
    .from(automationLogs)
    .where(
      and(
        eq(automationLogs.tenantId, tenantId),
        eq(automationLogs.leadId, leadId),
        eq(automationLogs.recoveryState, "recovered"),
      ),
    )
    .orderBy(desc(automationLogs.createdAt))
    .limit(1);

  if (log) {
    await transitionRecoveryState(
      db, tenantId, log.automationId, log.automationKey, leadId,
      "payment.captured", "billed", data.recoveryEventId,
    );
  }
}

// ─── Re-exports for convenience ──────────────────────────────────────────────

export { isRegisteredWorkflow, getWorkflow } from "./recoveryWorkflows";
