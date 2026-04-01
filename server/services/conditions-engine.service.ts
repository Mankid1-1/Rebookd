/**
 * Conditions Engine Service
 *
 * Evaluates automation conditions against leads to determine
 * whether an automation should fire for a given lead.
 *
 * Uses the existing `automations.conditions` JSON field.
 */

import { eq, and } from "drizzle-orm";
import { leadSegmentMembers, leadAutomationOverrides } from "../../drizzle/schema";
import type { Db } from "../_core/context";
import type { Lead } from "../../drizzle/schema";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Condition {
  field: string;     // "lead.status" | "lead.source" | "lead.tags" | "lead.segment" | "lead.createdAt" | "lead.email" ...
  operator: string;  // "equals" | "not_equals" | "contains" | "not_contains" | "in" | "not_in" | "gt" | "lt" | "before" | "after" | "exists" | "not_exists"
  value: unknown;
}

export interface ConditionGroup {
  logic: "AND" | "OR";
  conditions: Array<Condition | ConditionGroup>;
}

// ─── Condition Evaluation ──────────────────────────────────────────────────────

/**
 * Evaluate a condition group against a lead.
 * Returns true if the lead matches the conditions.
 */
export function evaluateConditions(
  lead: Lead,
  conditionGroup: ConditionGroup | null | undefined,
  context?: { segmentIds?: number[] }
): boolean {
  if (!conditionGroup || !conditionGroup.conditions?.length) {
    return true; // No conditions = matches all
  }

  const { logic, conditions } = conditionGroup;

  if (logic === "AND") {
    return conditions.every((c) => evaluateSingle(lead, c, context));
  } else {
    return conditions.some((c) => evaluateSingle(lead, c, context));
  }
}

function evaluateSingle(
  lead: Lead,
  condition: Condition | ConditionGroup,
  context?: { segmentIds?: number[] }
): boolean {
  // Nested group
  if ("logic" in condition) {
    return evaluateConditions(lead, condition as ConditionGroup, context);
  }

  const { field, operator, value } = condition as Condition;
  const fieldValue = resolveField(lead, field, context);

  switch (operator) {
    case "equals":
      return String(fieldValue) === String(value);
    case "not_equals":
      return String(fieldValue) !== String(value);
    case "contains":
      if (Array.isArray(fieldValue)) return fieldValue.includes(value);
      return String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
    case "not_contains":
      if (Array.isArray(fieldValue)) return !fieldValue.includes(value);
      return !String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
    case "in":
      if (Array.isArray(value)) return value.includes(fieldValue);
      return false;
    case "not_in":
      if (Array.isArray(value)) return !value.includes(fieldValue);
      return true;
    case "gt":
      return Number(fieldValue) > Number(value);
    case "lt":
      return Number(fieldValue) < Number(value);
    case "before": {
      const d = fieldValue instanceof Date ? fieldValue : new Date(String(fieldValue));
      const target = new Date(String(value));
      return d < target;
    }
    case "after": {
      const d = fieldValue instanceof Date ? fieldValue : new Date(String(fieldValue));
      const target = new Date(String(value));
      return d > target;
    }
    case "exists":
      return fieldValue != null && fieldValue !== "" && fieldValue !== undefined;
    case "not_exists":
      return fieldValue == null || fieldValue === "" || fieldValue === undefined;
    default:
      return true; // Unknown operator — pass
  }
}

function resolveField(
  lead: Lead,
  field: string,
  context?: { segmentIds?: number[] }
): unknown {
  switch (field) {
    case "lead.status":
      return lead.status;
    case "lead.source":
      return lead.source;
    case "lead.tags":
      return lead.tags || [];
    case "lead.email":
      return lead.email;
    case "lead.phone":
      return lead.phone;
    case "lead.name":
      return lead.name;
    case "lead.createdAt":
      return lead.createdAt;
    case "lead.lastMessageAt":
      return lead.lastMessageAt;
    case "lead.lastInboundAt":
      return lead.lastInboundAt;
    case "lead.appointmentAt":
      return lead.appointmentAt;
    case "lead.smsConsentAt":
      return lead.smsConsentAt;
    case "lead.segment":
      return context?.segmentIds || [];
    case "lead.notes":
      return lead.notes;
    default:
      // Support dot-notation for any lead field
      if (field.startsWith("lead.")) {
        const key = field.slice(5) as keyof Lead;
        return (lead as Record<string, unknown>)[key];
      }
      return undefined;
  }
}

// ─── Automation Override Checks ────────────────────────────────────────────────

/**
 * Check if a lead has an override for a specific automation template.
 * Returns: true = force enabled, false = force disabled, null = use default
 */
export async function checkAutomationOverride(
  db: Db,
  leadId: number,
  automationTemplateKey: string
): Promise<boolean | null> {
  const [override] = await db
    .select({ enabled: leadAutomationOverrides.enabled })
    .from(leadAutomationOverrides)
    .where(
      and(
        eq(leadAutomationOverrides.leadId, leadId),
        eq(leadAutomationOverrides.automationTemplateKey, automationTemplateKey)
      )
    )
    .limit(1);

  return override ? override.enabled : null;
}

/**
 * Get segment IDs for a lead (for condition evaluation context).
 */
export async function getLeadSegmentIds(db: Db, leadId: number): Promise<number[]> {
  const memberships = await db
    .select({ segmentId: leadSegmentMembers.segmentId })
    .from(leadSegmentMembers)
    .where(eq(leadSegmentMembers.leadId, leadId));

  return memberships.map((m) => m.segmentId);
}

// ─── Preset Condition Bundles (for intermediate skill level) ───────────────────

export const PRESET_CONDITION_BUNDLES = {
  all_leads: {
    name: "All Leads",
    description: "Every lead receives this automation",
    conditions: null,
  },
  new_leads_only: {
    name: "New Leads Only",
    description: "Only leads with 'new' status",
    conditions: {
      logic: "AND" as const,
      conditions: [{ field: "lead.status", operator: "equals", value: "new" }],
    },
  },
  booked_clients: {
    name: "Booked Clients",
    description: "Leads who have booked appointments",
    conditions: {
      logic: "AND" as const,
      conditions: [{ field: "lead.status", operator: "equals", value: "booked" }],
    },
  },
  at_risk: {
    name: "At-Risk Contacts",
    description: "Contacts who haven't messaged in 14+ days",
    conditions: {
      logic: "AND" as const,
      conditions: [
        { field: "lead.lastInboundAt", operator: "before", value: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() },
      ],
    },
  },
  lost_leads: {
    name: "Lost Leads",
    description: "Re-engage leads marked as lost",
    conditions: {
      logic: "AND" as const,
      conditions: [{ field: "lead.status", operator: "equals", value: "lost" }],
    },
  },
  qualified_leads: {
    name: "Qualified Leads",
    description: "Leads that have been qualified",
    conditions: {
      logic: "AND" as const,
      conditions: [{ field: "lead.status", operator: "equals", value: "qualified" }],
    },
  },
} as const;
