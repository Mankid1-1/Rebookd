/**
 * Revenue Service — Unified barrel for all revenue & recovery functionality.
 *
 * Instead of importing from 5 separate files, consumers can import from this
 * single module:
 *
 *   import { detectRevenueLeakage, createRecoveryCampaign, ... } from "./revenue.service";
 *
 * Pipeline:
 *   revenue-leakage         → DETECTS (what's broken)
 *   recovery-attribution    → TRACKS  (link SMS to deposits)
 *   revenue-recovery        → ACTS    (campaigns: reschedule, discount)
 *   revenue-maximization    → OPTIMIZES (strategic planning)
 *   recoveryWorkflows       → DEFINES (19 automation workflow templates)
 */

// ─── Detection ───────────────────────────────────────────────────────────────
export {
  detectRevenueLeakage,
  type LeakageDetection,
  type RevenueLeakageReport,
} from "./revenue-leakage.service";

// ─── Attribution & Tracking ──────────────────────────────────────────────────
export {
  generateTrackingToken,
  createRecoveryEvent,
  markRecoveryResponded,
  markRecoveryConverted,
  markRecoveryRealized,
  markManualRecovery,
  expireStaleRecoveryEvents,
  getAttributedRevenueMetrics,
  getAutomationAttribution,
  getRecoveryLedger,
  ledgerToCSV,
  type LedgerEntry,
} from "./recovery-attribution.service";

// ─── Recovery Campaigns ──────────────────────────────────────────────────────
export {
  createRecoveryCampaign,
  executeRecoveryCampaign,
  createSmartRecoveryActions,
  analyzeRecoveryEffectiveness,
  type RecoveryAction,
  type RecoveryCampaign,
  type RecoveryResult,
} from "./revenue-recovery.service";

// ─── Revenue Maximization ────────────────────────────────────────────────────
export {
  generateRevenueStrategies,
  optimizeTenantRevenue,
  generateRevenueAlerts,
  executeRevenueOptimization,
  type RevenueStrategy,
  type RevenueOptimization,
  type RevenueAlert,
} from "./revenue-maximization.service";

// ─── Workflow Definitions ────────────────────────────────────────────────────
export {
  WORKFLOW_REGISTRY,
  getWorkflow,
  isRegisteredWorkflow,
  getRecoveryWorkflows,
  getWorkflowsByTrigger,
  getAllWorkflowKeys,
} from "./recoveryWorkflows";
