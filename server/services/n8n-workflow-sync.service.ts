/**
 * n8n Workflow Sync Service
 *
 * Communicates with n8n's REST API to:
 * - Fetch workflow list and execution history
 * - Activate/deactivate workflows
 * - Compare n8n state with Rebooked's WORKFLOW_REGISTRY for drift detection
 *
 * Auth: X-N8N-API-KEY header using ENV.n8nAdminApiKey
 */

import { ENV } from "../_core/env";
import { logger } from "../_core/logger";
import { eq } from "drizzle-orm";
import { n8nWorkflowSync } from "../../drizzle/schema";
import type { Db } from "../_core/context";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  versionId?: string;
  nodes?: any[];
  tags?: { id: string; name: string }[];
}

export interface N8nExecution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  status: "success" | "error" | "waiting" | "running";
  data?: any;
}

interface N8nApiOptions {
  method?: string;
  body?: any;
  timeout?: number;
}

// ─── n8n REST API client ─────────────────────────────────────────────────────

async function n8nApi<T = any>(path: string, options: N8nApiOptions = {}): Promise<T> {
  if (!ENV.n8nAdminApiKey) {
    throw new Error("N8N_ADMIN_API_KEY not configured");
  }

  const url = `${ENV.n8nBaseUrl}/api/v1${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout ?? 10_000);

  try {
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        "X-N8N-API-KEY": ENV.n8nAdminApiKey,
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`n8n API ${res.status}: ${text}`);
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ─── Workflow CRUD ───────────────────────────────────────────────────────────

export async function fetchN8nWorkflows(): Promise<N8nWorkflow[]> {
  const result = await n8nApi<{ data: N8nWorkflow[] }>("/workflows");
  return result.data ?? [];
}

export async function getN8nWorkflow(workflowId: string): Promise<N8nWorkflow> {
  return await n8nApi<N8nWorkflow>(`/workflows/${workflowId}`);
}

export async function activateN8nWorkflow(workflowId: string): Promise<N8nWorkflow> {
  return await n8nApi<N8nWorkflow>(`/workflows/${workflowId}/activate`, { method: "POST" });
}

export async function deactivateN8nWorkflow(workflowId: string): Promise<N8nWorkflow> {
  return await n8nApi<N8nWorkflow>(`/workflows/${workflowId}/deactivate`, { method: "POST" });
}

// ─── Execution History ───��───────────────────────────────────────────────────

export async function getWorkflowExecutions(
  workflowId?: string,
  limit: number = 20,
  status?: string,
): Promise<N8nExecution[]> {
  let path = `/executions?limit=${limit}`;
  if (workflowId) path += `&workflowId=${workflowId}`;
  if (status) path += `&status=${status}`;

  const result = await n8nApi<{ data: N8nExecution[] }>(path);
  return result.data ?? [];
}

export async function getExecutionDetail(executionId: string): Promise<N8nExecution> {
  return await n8nApi<N8nExecution>(`/executions/${executionId}`);
}

// ─── Workflow Registry Sync ──────────────────────────────────────────────────

// Import the registry to compare against n8n
const REBOOKED_WORKFLOW_KEYS = [
  "missed_call_textback", "missed_call_followup", "missed_call_final_offer",
  "appointment_confirmation", "appointment_reminder_24h", "appointment_reminder_2h",
  "noshow_recovery", "cancellation_same_day", "cancellation_rescue_48h",
  "cancellation_rescue_7d", "cancellation_flurry", "welcome_new_lead",
  "win_back_90d", "vip_winback_45d", "birthday_promo",
  "review_request", "inbound_auto_reply", "qualified_followup_1d",
  "loyalty_milestone", "rescheduling_offer", "post_visit_feedback",
];

export interface WorkflowSyncResult {
  workflowKey: string;
  n8nWorkflowId: string | null;
  n8nActive: boolean;
  syncStatus: "synced" | "drift_detected" | "missing_in_n8n" | "unknown_in_rebooked";
  n8nName?: string;
  lastSyncAt: Date;
}

/**
 * Sync Rebooked's workflow registry with actual n8n state.
 * Writes results to n8n_workflow_sync table and returns merged view.
 */
export async function syncWorkflowRegistry(db: Db): Promise<WorkflowSyncResult[]> {
  const results: WorkflowSyncResult[] = [];

  let n8nWorkflows: N8nWorkflow[] = [];
  try {
    n8nWorkflows = await fetchN8nWorkflows();
  } catch (err) {
    logger.warn("[n8n-sync] Failed to fetch n8n workflows", { error: String(err) });
    // Return existing sync state from DB
    const existing = await (db as any).select().from(n8nWorkflowSync);
    return existing.map((e: any) => ({
      workflowKey: e.workflowKey,
      n8nWorkflowId: e.n8nWorkflowId,
      n8nActive: e.n8nActive,
      syncStatus: e.syncStatus,
      lastSyncAt: e.lastSyncAt ?? e.updatedAt,
    }));
  }

  // Build a name-based lookup (n8n workflow names often match Rebooked keys with dashes)
  const n8nByName = new Map<string, N8nWorkflow>();
  for (const wf of n8nWorkflows) {
    const normalizedName = wf.name.toLowerCase().replace(/[\s-]+/g, "_");
    n8nByName.set(normalizedName, wf);
    n8nByName.set(wf.id, wf);
  }

  // Load existing sync records
  const existingSync = await (db as any).select().from(n8nWorkflowSync);
  const existingByKey = new Map<string, any>();
  for (const e of existingSync) {
    existingByKey.set(e.workflowKey, e);
  }

  const now = new Date();

  // Check each Rebooked workflow against n8n
  for (const key of REBOOKED_WORKFLOW_KEYS) {
    const existing = existingByKey.get(key);
    // Try to find by saved n8n ID, then by name
    let n8nWf: N8nWorkflow | undefined;
    if (existing?.n8nWorkflowId) {
      n8nWf = n8nWorkflows.find((w) => w.id === existing.n8nWorkflowId);
    }
    if (!n8nWf) {
      n8nWf = n8nByName.get(key);
    }

    const syncResult: WorkflowSyncResult = {
      workflowKey: key,
      n8nWorkflowId: n8nWf?.id ?? null,
      n8nActive: n8nWf?.active ?? false,
      syncStatus: n8nWf ? "synced" : "missing_in_n8n",
      n8nName: n8nWf?.name,
      lastSyncAt: now,
    };

    results.push(syncResult);

    // Upsert sync record
    if (existing) {
      await (db as any)
        .update(n8nWorkflowSync)
        .set({
          n8nWorkflowId: syncResult.n8nWorkflowId,
          n8nActive: syncResult.n8nActive,
          syncStatus: syncResult.syncStatus,
          lastSyncAt: now,
          updatedAt: now,
        })
        .where(eq(n8nWorkflowSync.id, existing.id));
    } else {
      await (db as any).insert(n8nWorkflowSync).values({
        workflowKey: key,
        n8nWorkflowId: syncResult.n8nWorkflowId,
        n8nActive: syncResult.n8nActive,
        syncStatus: syncResult.syncStatus,
        lastSyncAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Check for n8n workflows not in Rebooked's registry
  const knownKeys = new Set(REBOOKED_WORKFLOW_KEYS);
  for (const wf of n8nWorkflows) {
    const normalizedName = wf.name.toLowerCase().replace(/[\s-]+/g, "_");
    if (!knownKeys.has(normalizedName) && !results.some((r) => r.n8nWorkflowId === wf.id)) {
      results.push({
        workflowKey: normalizedName,
        n8nWorkflowId: wf.id,
        n8nActive: wf.active,
        syncStatus: "unknown_in_rebooked",
        n8nName: wf.name,
        lastSyncAt: now,
      });
    }
  }

  logger.info("[n8n-sync] Workflow sync completed", {
    total: results.length,
    synced: results.filter((r) => r.syncStatus === "synced").length,
    missing: results.filter((r) => r.syncStatus === "missing_in_n8n").length,
    unknown: results.filter((r) => r.syncStatus === "unknown_in_rebooked").length,
  });

  return results;
}

/**
 * Check if n8n admin API is accessible.
 */
export async function checkN8nAdminApi(): Promise<boolean> {
  if (!ENV.n8nAdminApiKey) return false;
  try {
    await n8nApi("/workflows?limit=1", { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
