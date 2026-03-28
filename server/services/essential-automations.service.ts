/**
 * Essential Automations Service
 *
 * Defines automations that are auto-enabled after onboarding based on
 * the user's skill level:
 *   - Beginner: ALL essentials auto-enabled (simplest UI, most background work)
 *   - Intermediate: CORE essentials auto-enabled (middle ground)
 *   - Advanced/Expert: NONE auto-enabled (full manual control)
 *
 * Users can toggle any of them on/off at any time via the disclaimer panel.
 */

import { automationTemplates } from "../../shared/templates";
import * as AutomationService from "./automation.service";
import type { Db } from "../_core/context";

type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

/**
 * Tier definitions: which automations auto-enable at each skill level.
 * "core" = most fundamental (auto-reply, confirmations)
 * "extended" = valuable but slightly more advanced (follow-ups, no-show recovery)
 */
const CORE_KEYS = [
  "appointment_confirmation_chase",  // Confirm bookings immediately
  "inbound_response_sla",            // Auto-reply to inbound messages
  "welcome_new_lead",                // Welcome new leads
] as const;

const EXTENDED_KEYS = [
  "reduce_no_shows",                 // Follow up on no-shows
  "qualified_followup_1d",           // 1-day lead follow-up
  "cancellation_same_day",           // Same-day cancellation rescue
] as const;

/** All essential automation keys (union of tiers) */
export const ESSENTIAL_AUTOMATION_KEYS = [...CORE_KEYS, ...EXTENDED_KEYS];

/** Which keys auto-enable per skill level */
function getAutoEnabledKeys(skillLevel: SkillLevel): string[] {
  switch (skillLevel) {
    case "beginner":
      return [...CORE_KEYS, ...EXTENDED_KEYS]; // all
    case "intermediate":
      return [...CORE_KEYS]; // core only
    case "advanced":
    case "expert":
      return []; // none — full manual control
  }
}

export interface EssentialAutomationStatus {
  key: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  autoEnabled: boolean; // was this one auto-enabled for this skill level?
  tier: "core" | "extended";
}

/** Descriptions for the disclaimer UI */
const ESSENTIAL_DESCRIPTIONS: Record<string, string> = {
  appointment_confirmation_chase: "Sends a confirmation text when someone books, so they know it went through.",
  inbound_response_sla: "Instantly replies when a lead texts you, so they're not left waiting.",
  welcome_new_lead: "Greets new leads automatically so they feel acknowledged right away.",
  reduce_no_shows: "Follows up with no-shows to offer easy rescheduling.",
  qualified_followup_1d: "Checks in with new leads after 1 day if they haven't booked yet.",
  cancellation_same_day: "Offers to rebook when someone cancels same-day, recovering lost revenue.",
};

const TRIGGER_MAPPING: Record<string, string> = {
  "lead.created": "new_lead",
  "appointment.booked": "appointment_reminder",
  "appointment.no_show": "time_delay",
  "appointment.cancelled": "appointment_reminder",
  "message.received": "inbound_message",
  "message.sent": "inbound_message",
};

function getTier(key: string): "core" | "extended" {
  return (CORE_KEYS as readonly string[]).includes(key) ? "core" : "extended";
}

/**
 * Auto-enable essential automations for a tenant based on their skill level.
 * Called after onboarding completes. Idempotent — won't overwrite
 * existing automations the tenant has already configured.
 */
export async function enableEssentialAutomations(
  db: Db,
  tenantId: number,
  skillLevel: SkillLevel = "beginner",
): Promise<EssentialAutomationStatus[]> {
  const autoEnabledKeys = getAutoEnabledKeys(skillLevel);
  const results: EssentialAutomationStatus[] = [];

  for (const key of ESSENTIAL_AUTOMATION_KEYS) {
    const template = automationTemplates.find(t => t.key === key);
    if (!template) continue;

    const shouldAutoEnable = autoEnabledKeys.includes(key);
    const existing = await AutomationService.getAutomationByKey(db, tenantId, key);

    if (!existing && shouldAutoEnable) {
      await AutomationService.upsertAutomationByKey(db, tenantId, key, {
        name: template.name,
        category: template.category as any,
        triggerType: (TRIGGER_MAPPING[template.trigger] || "custom") as any,
        triggerConfig: {},
        conditions: [],
        actions: template.steps as any,
        enabled: true,
      });
    }

    results.push({
      key,
      name: template.name,
      description: ESSENTIAL_DESCRIPTIONS[key] || template.steps?.[0]?.message || "",
      category: template.category,
      enabled: existing ? !!existing.enabled : shouldAutoEnable,
      autoEnabled: shouldAutoEnable,
      tier: getTier(key),
    });
  }

  return results;
}

/**
 * Get the status of all essential automations for a tenant.
 */
export async function getEssentialAutomationStatuses(
  db: Db,
  tenantId: number,
  skillLevel: SkillLevel = "beginner",
): Promise<EssentialAutomationStatus[]> {
  const autoEnabledKeys = getAutoEnabledKeys(skillLevel);
  const results: EssentialAutomationStatus[] = [];

  for (const key of ESSENTIAL_AUTOMATION_KEYS) {
    const template = automationTemplates.find(t => t.key === key);
    if (!template) continue;

    const existing = await AutomationService.getAutomationByKey(db, tenantId, key);

    results.push({
      key,
      name: template.name,
      description: ESSENTIAL_DESCRIPTIONS[key] || "",
      category: template.category,
      enabled: existing ? !!existing.enabled : false,
      autoEnabled: autoEnabledKeys.includes(key),
      tier: getTier(key),
    });
  }

  return results;
}
