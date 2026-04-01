/**
 * RebookedAI Action Engine
 * Detects user intent to change settings or perform actions from natural language,
 * then executes those actions against the database.
 *
 * Returns structured action results that the chat UI can render as confirmation cards.
 */

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as TenantService from "../services/tenant.service";
import * as AutomationService from "../services/automation.service";

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  userId: number;
  tenantId: number;
  tenantName: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  stateRegion: string;
  zipCode: string;
  timezone: string;
  industry: string;
  skillLevel: string;
  automations: { key: string; name: string; enabled: boolean }[];
  planName: string;
  messagesSent: number;
  revenueRecovered: number;
  // Live platform data
  leadCount: number;
  bookedCount: number;
  noShowCount: number;
  connectedCalendars: number;
  recentLeads: { name: string; status: string; phone?: string }[];
  todayAppointments: number;
  // ── Rich context (Phase 1) ──
  totalRecoveredRevenue: number;
  recentRecoveredRevenue: number;
  overallRecoveryRate: number;
  recentRecoveryRate: number;
  avgRevenuePerBooking: number;
  qualifiedLeadCount: number;
  contactedLeadCount: number;
  lostLeadCount: number;
  leakageMetrics: {
    unconfirmedAppointments: number;
    qualifiedUnbooked: number;
    cancellationsUnrecovered: number;
    failedDeliveryRecovery: number;
  };
  deliveryStats: { total: number; delivered: number; failed: number; rate: number };
  revenueTrend: "up" | "down" | "flat";
  leadTrend: "up" | "down" | "flat";
}

export interface ActionResult {
  executed: boolean;
  actionType: string;
  description: string;
  confirmationMessage: string;
  /** If true, the action needs user confirmation before executing */
  needsConfirmation?: boolean;
  pendingAction?: PendingAction;
}

export interface PendingAction {
  type: string;
  params: Record<string, unknown>;
}

// ── Intent Detection ─────────────────────────────────────────────────────────

interface DetectedIntent {
  action: string;
  params: Record<string, string>;
  confidence: number;
}

const INTENT_PATTERNS: {
  action: string;
  patterns: RegExp[];
  extractParams: (match: RegExpMatchArray, raw: string) => Record<string, string>;
}[] = [
  // ── Update phone number ──
  {
    action: "update_phone",
    patterns: [
      /(?:set|change|update)\s+(?:my\s+)?(?:phone|number|phone\s*number)\s+(?:to\s+)?["']?([+\d().\s-]{7,20})["']?/i,
      /(?:my\s+)?(?:phone|number)\s+(?:is|should\s+be)\s+["']?([+\d().\s-]{7,20})["']?/i,
    ],
    extractParams: (m) => ({ phone: m[1].trim() }),
  },
  // ── Update email ──
  {
    action: "update_email",
    patterns: [
      /(?:set|change|update)\s+(?:my\s+)?email\s+(?:to\s+)?["']?([^\s"']+@[^\s"']+)["']?/i,
      /(?:my\s+)?email\s+(?:is|should\s+be)\s+["']?([^\s"']+@[^\s"']+)["']?/i,
    ],
    extractParams: (m) => ({ email: m[1].trim() }),
  },
  // ── Update business name ──
  {
    action: "update_business_name",
    patterns: [
      /(?:set|change|update|rename)\s+(?:my\s+)?(?:business\s*name|company\s*name|salon\s*name)\s+(?:to\s+)?["']([^"']+)["']/i,
      /(?:set|change|update|rename)\s+(?:my\s+)?(?:business\s*name|company\s*name|salon\s*name)\s+to\s+(.+)/i,
    ],
    extractParams: (m) => ({ name: m[1].trim() }),
  },
  // ── Update timezone ──
  {
    action: "update_timezone",
    patterns: [
      /(?:set|change|update)\s+(?:my\s+)?timezone\s+(?:to\s+)?["']?([A-Za-z/_]+)["']?/i,
      /(?:my\s+)?timezone\s+(?:is|should\s+be)\s+["']?([A-Za-z/_]+)["']?/i,
    ],
    extractParams: (m) => ({ timezone: m[1].trim() }),
  },
  // ── Update website ──
  {
    action: "update_website",
    patterns: [
      /(?:set|change|update)\s+(?:my\s+)?website\s+(?:to\s+)?["']?(https?:\/\/[^\s"']+|[a-z0-9][\w.-]+\.[a-z]{2,})["']?/i,
      /(?:my\s+)?website\s+(?:is|should\s+be)\s+["']?(https?:\/\/[^\s"']+|[a-z0-9][\w.-]+\.[a-z]{2,})["']?/i,
    ],
    extractParams: (m) => ({ website: m[1].trim() }),
  },
  // ── Update address / city / zip ──
  {
    action: "update_address",
    patterns: [
      /(?:set|change|update)\s+(?:my\s+)?address\s+(?:to\s+)?["'](.+?)["']/i,
      /(?:set|change|update)\s+(?:my\s+)?address\s+to\s+(.+)/i,
    ],
    extractParams: (m) => ({ address: m[1].trim() }),
  },
  {
    action: "update_city",
    patterns: [
      /(?:set|change|update)\s+(?:my\s+)?city\s+(?:to\s+)?["']?([A-Za-z\s]+?)["']?$/i,
    ],
    extractParams: (m) => ({ city: m[1].trim() }),
  },
  // ── Update industry ──
  {
    action: "update_industry",
    patterns: [
      /(?:set|change|update)\s+(?:my\s+)?industry\s+(?:to\s+)?["']?(.+?)["']?$/i,
      /(?:my\s+)?industry\s+(?:is|should\s+be)\s+["']?(.+?)["']?$/i,
    ],
    extractParams: (m) => ({ industry: m[1].trim() }),
  },
  // ── Change skill level ──
  {
    action: "change_skill_level",
    patterns: [
      /(?:set|change|switch)\s+(?:my\s+)?(?:skill\s*level|experience|mode)\s+(?:to\s+)?["']?(beginner|basic|intermediate|advanced|expert)["']?/i,
      /(?:change|switch)\s+to\s+(beginner|basic|intermediate|advanced|expert)\s*(?:mode)?/i,
      /(?:i'm|im|i\s+am)\s+(?:an?\s+)?(beginner|intermediate|advanced|expert)/i,
    ],
    extractParams: (m) => {
      let level = m[1].toLowerCase().trim();
      if (level === "expert") level = "advanced";
      if (level === "beginner") level = "basic";
      return { level };
    },
  },
  // ── Toggle automations ──
  {
    action: "enable_automation",
    patterns: [
      /(?:enable|turn\s+on|activate|start)\s+(?:the\s+)?["']?(.+?)["']?\s+automation/i,
      /(?:enable|turn\s+on|activate|start)\s+(?:the\s+)?(.+?)$/i,
    ],
    extractParams: (m) => ({ automationName: m[1].trim() }),
  },
  {
    action: "disable_automation",
    patterns: [
      /(?:disable|turn\s+off|deactivate|stop)\s+(?:the\s+)?["']?(.+?)["']?\s+automation/i,
      /(?:disable|turn\s+off|deactivate|stop)\s+(?:the\s+)?(.+?)$/i,
    ],
    extractParams: (m) => ({ automationName: m[1].trim() }),
  },
  // ── Profile query (not an action, but surfaces profile data) ──
  {
    action: "show_profile",
    patterns: [
      /(?:show|what(?:'s| is|are))\s+(?:my\s+)?(?:profile|settings|account|info|details|business\s*info)/i,
      /(?:what(?:'s| is|are))\s+(?:my\s+)?(?:phone|email|business\s*name|timezone|industry|plan|website|address)/i,
    ],
    extractParams: () => ({}),
  },
  // ── Show automations status ──
  {
    action: "show_automations",
    patterns: [
      /(?:show|list|what(?:'s| are|is))\s+(?:my\s+)?(?:automations?|enabled\s+automations?|active\s+automations?)/i,
      /(?:which|what)\s+automations?\s+(?:are\s+)?(?:on|enabled|active|running)/i,
    ],
    extractParams: () => ({}),
  },
  // ── Confirm pending action ──
  {
    action: "confirm_action",
    patterns: [
      /^(?:yes|confirm|do\s+it|go\s+ahead|ok|sure|please|yep|yeah|yup|proceed)[\s!.]*$/i,
    ],
    extractParams: () => ({}),
  },
  // ── Cancel pending action ──
  {
    action: "cancel_action",
    patterns: [
      /^(?:no|cancel|never\s*mind|nah|nope|don'?t|stop)[\s!.]*$/i,
    ],
    extractParams: () => ({}),
  },
  // ── Show live stats ──
  {
    action: "show_stats",
    patterns: [
      /(?:how\s+am\s+i|my\s+stats|my\s+metrics|show\s+(?:me\s+)?(?:my\s+)?(?:stats|metrics|numbers|dashboard|performance))/i,
      /(?:how(?:'s|\s+is)\s+(?:my\s+)?business|(?:give|show)\s+me\s+(?:a\s+)?(?:summary|overview|report))/i,
    ],
    extractParams: () => ({}),
  },
  // ── Show recent leads ──
  {
    action: "show_leads",
    patterns: [
      /(?:show|list|view|who\s+are)\s+(?:me\s+)?(?:my\s+)?(?:recent\s+)?leads/i,
      /(?:my\s+)?(?:recent\s+)?(?:leads|contacts|customers)/i,
    ],
    extractParams: () => ({}),
  },
  // ── Show calendar / appointments ──
  {
    action: "show_calendar",
    patterns: [
      /(?:my\s+)?(?:appointments?|calendar|schedule|what(?:'s|\s+is)\s+on\s+(?:my\s+)?calendar)/i,
      /(?:today(?:'s|\s+)?(?:appointments?|schedule)|upcoming\s+appointments?)/i,
    ],
    extractParams: () => ({}),
  },
  // ── Show no-shows ──
  {
    action: "show_no_shows",
    patterns: [
      /(?:no[\s-]?shows?|who\s+didn(?:'t|\s+not)\s+show|missed\s+appointments?)/i,
    ],
    extractParams: () => ({}),
  },
  // ── Contact a lead by name ──
  {
    action: "contact_lead",
    patterns: [
      /(?:message|text|sms|reach\s+out\s+to|contact)\s+(?:lead\s+)?["']?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)["']?/i,
    ],
    extractParams: (m) => ({ leadName: m[1]?.trim() || "" }),
  },
  // ── Check system health ──
  {
    action: "check_health",
    patterns: [
      /(?:system\s+health|is\s+everything\s+(?:working|ok|fine)|any\s+errors?|sentinel\s+status)/i,
    ],
    extractParams: () => ({}),
  },
  // ── Ask for suggestion ──
  {
    action: "suggest_action",
    patterns: [
      /(?:what\s+should\s+I\s+do|any\s+suggestions?|help\s+me\s+(?:grow|improve)|what\s+(?:do\s+you\s+)?recommend)/i,
      /(?:what(?:'s|\s+is)\s+(?:the\s+)?next\s+step|how\s+(?:can|do)\s+I\s+(?:grow|improve|get\s+more))/i,
    ],
    extractParams: () => ({}),
  },
  // ── Show revenue (real data) ──
  {
    action: "show_revenue",
    patterns: [
      /(?:show|what(?:'s| is)|tell\s+me)\s+(?:my\s+)?(?:revenue|recovered\s+revenue|earnings|income|money)/i,
      /how\s+much\s+(?:have\s+I|did\s+I|we)\s+(?:recover|earn|make|bring\s+in)/i,
      /revenue\s+(?:stats|data|numbers|report|summary)/i,
    ],
    extractParams: () => ({}),
  },
  // ── Show revenue leakage ──
  {
    action: "show_leakage",
    patterns: [
      /(?:revenue\s+)?leakage|where\s+am\s+I\s+losing\s+money/i,
      /missed\s+(?:revenue|opportunities|money)|lost\s+revenue/i,
      /what(?:'s|\s+is)\s+(?:my\s+)?(?:leakage|lost|missed)/i,
    ],
    extractParams: () => ({}),
  },
  // ── Explain automation ──
  {
    action: "explain_automation",
    patterns: [
      /(?:explain|describe|tell\s+me\s+about|how\s+does)\s+(?:the\s+)?["']?(.+?)["']?\s+(?:automation|workflow)/i,
      /what\s+(?:does|is)\s+(?:the\s+)?["']?(.+?)["']?\s+(?:automation|workflow)/i,
      /how\s+does\s+["']?(.+?)["']?\s+work/i,
    ],
    extractParams: (m) => ({ automationName: m[1]?.trim() || "" }),
  },
  // ── Show automation performance ──
  {
    action: "show_automation_performance",
    patterns: [
      /(?:how\s+are|show)\s+(?:my\s+)?automations?\s+(?:doing|performing|working)/i,
      /automation\s+(?:stats|performance|results|effectiveness|metrics)/i,
    ],
    extractParams: () => ({}),
  },
  // ── Show predictions / forecast ──
  {
    action: "show_predictions",
    patterns: [
      /(?:predict|forecast|project|estimate)\s+(?:my\s+)?(?:revenue|earnings|recovery|growth)/i,
      /(?:what\s+(?:will|could|can)\s+I\s+(?:recover|earn|make)|revenue\s+forecast)/i,
      /(?:how\s+much\s+(?:can|could|will)\s+I\s+(?:recover|make|earn))/i,
    ],
    extractParams: () => ({}),
  },
  // ── Show delivery stats ──
  {
    action: "show_delivery_stats",
    patterns: [
      /(?:delivery|sms|message)\s+(?:stats|rate|performance|success)/i,
      /(?:how\s+many|show)\s+(?:messages?\s+)?(?:delivered|failed|bounced)/i,
    ],
    extractParams: () => ({}),
  },
  // ── Optimize suggestions (AI-powered) ──
  {
    action: "optimize_suggestions",
    patterns: [
      /(?:optimize|improve)\s+(?:my\s+)?(?:automations?|recovery|results|performance|rates?)/i,
      /(?:boost|increase)\s+(?:my\s+)?(?:recovery|conversion|booking)\s+rates?/i,
      /what\s+(?:can\s+I|should\s+I)\s+(?:do\s+to\s+)?(?:optimize|improve)/i,
    ],
    extractParams: () => ({}),
  },
  // ── Generate report / summary ──
  {
    action: "generate_report",
    patterns: [
      /(?:generate|create|give\s+me)\s+(?:a\s+)?(?:report|summary|overview|brief|snapshot)/i,
      /(?:full|complete|comprehensive)\s+(?:report|summary|overview)/i,
    ],
    extractParams: () => ({}),
  },
  // ── Show recent activity ──
  {
    action: "show_recent_activity",
    patterns: [
      /(?:what\s+happened|recent\s+activity|what(?:'s| is)\s+new|any\s+updates?)/i,
      /(?:show|tell\s+me)\s+(?:recent\s+)?(?:activity|events|updates)/i,
    ],
    extractParams: () => ({}),
  },
  // ── Create a lead ──
  {
    action: "create_lead",
    patterns: [
      /(?:add|create|new)\s+(?:a\s+)?lead\s+(?:named?\s+)?["']?([A-Za-z]+(?:\s+[A-Za-z]+)?)["']?\s+(?:with\s+)?(?:phone\s+)?["']?([+\d().\s-]{7,20})["']?/i,
      /(?:add|create)\s+(?:a\s+)?lead[:\s]+["']?([A-Za-z]+(?:\s+[A-Za-z]+)?)["']?\s+([+\d().\s-]{7,20})/i,
    ],
    extractParams: (m) => ({ name: m[1]?.trim() || "", phone: m[2]?.trim() || "" }),
  },
  // ── Send message to lead ──
  {
    action: "send_message_to_lead",
    patterns: [
      /(?:send|text|sms)\s+(?:a\s+)?(?:message\s+)?(?:to\s+)?["']?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)["']?\s+(?:saying|with|:)\s+["']?(.+?)["']?$/i,
    ],
    extractParams: (m) => ({ leadName: m[1]?.trim() || "", message: m[2]?.trim() || "" }),
  },
  // ── Show cancellations ──
  {
    action: "show_cancellations",
    patterns: [
      /(?:show|list|how\s+many)\s+(?:my\s+)?(?:cancellations?|cancelled)/i,
      /(?:who|which\s+leads?)\s+cancelled/i,
    ],
    extractParams: () => ({}),
  },
];

export function detectIntent(message: string): DetectedIntent | null {
  const raw = message.trim();

  for (const intent of INTENT_PATTERNS) {
    for (const pattern of intent.patterns) {
      const match = raw.match(pattern);
      if (match) {
        return {
          action: intent.action,
          params: intent.extractParams(match, raw),
          confidence: 0.85,
        };
      }
    }
  }

  return null;
}

// ── Action Execution ─────────────────────────────────────────────────────────

/**
 * Execute a detected action. Some actions execute immediately, others
 * return a confirmation prompt for the user to approve.
 */
export async function executeAction(
  db: MySql2Database<any>,
  tenantId: number,
  userId: number,
  intent: DetectedIntent,
  profile: UserProfile,
  pendingAction?: PendingAction | null,
): Promise<ActionResult> {
  switch (intent.action) {
    // ── Profile display (read-only) ──────────────────────────────────
    case "show_profile": {
      const lines = [
        `Here's your current profile:`,
        ``,
        `**Business:** ${profile.tenantName || "Not set"}`,
        `**Email:** ${profile.email || "Not set"}`,
        `**Phone:** ${profile.phone || "Not set"}`,
        `**Website:** ${profile.website || "Not set"}`,
        `**Address:** ${[profile.address, profile.city, profile.stateRegion, profile.zipCode].filter(Boolean).join(", ") || "Not set"}`,
        `**Timezone:** ${profile.timezone || "Not set"}`,
        `**Industry:** ${profile.industry || "Not set"}`,
        `**Skill Level:** ${profile.skillLevel || "Not set"}`,
        `**Plan:** ${profile.planName || "Free"}`,
        ``,
        `Want to change anything? Just tell me — e.g. "set my phone to 555-1234"`,
      ];
      return {
        executed: true,
        actionType: "show_profile",
        description: "Displayed profile",
        confirmationMessage: lines.join("\n"),
      };
    }

    // ── Automations display ──────────────────────────────────────────
    case "show_automations": {
      const enabled = profile.automations.filter((a) => a.enabled);
      const disabled = profile.automations.filter((a) => !a.enabled);
      const lines = [
        `**Your Automations** (${enabled.length} active, ${disabled.length} inactive)`,
        ``,
      ];
      if (enabled.length > 0) {
        lines.push(`**Active:**`);
        enabled.forEach((a) => lines.push(`- ✅ ${a.name}`));
      }
      if (disabled.length > 0) {
        lines.push(``, `**Inactive:**`);
        disabled.forEach((a) => lines.push(`- ⬜ ${a.name}`));
      }
      if (profile.automations.length === 0) {
        lines.push(`You don't have any automations set up yet.`);
      }
      lines.push(``, `Say "enable [name]" or "disable [name]" to toggle any automation.`);
      return {
        executed: true,
        actionType: "show_automations",
        description: "Listed automations",
        confirmationMessage: lines.join("\n"),
      };
    }

    // ── Update profile fields (needs confirmation) ───────────────────
    case "update_phone":
    case "update_email":
    case "update_business_name":
    case "update_timezone":
    case "update_website":
    case "update_address":
    case "update_city":
    case "update_industry": {
      const fieldMap: Record<string, { label: string; key: string }> = {
        update_phone: { label: "phone number", key: "phone" },
        update_email: { label: "email", key: "email" },
        update_business_name: { label: "business name", key: "name" },
        update_timezone: { label: "timezone", key: "timezone" },
        update_website: { label: "website", key: "website" },
        update_address: { label: "address", key: "address" },
        update_city: { label: "city", key: "city" },
        update_industry: { label: "industry", key: "industry" },
      };
      const field = fieldMap[intent.action];
      const newValue = intent.params[field.key] || Object.values(intent.params)[0];
      const currentValue = (profile as any)[field.key] || (profile as any)[field.key === "name" ? "tenantName" : field.key] || "not set";

      return {
        executed: false,
        actionType: intent.action,
        description: `Update ${field.label} to "${newValue}"`,
        confirmationMessage: `I'll update your **${field.label}** from "${currentValue}" to "**${newValue}**".\n\nShould I go ahead? (yes/no)`,
        needsConfirmation: true,
        pendingAction: {
          type: intent.action,
          params: { [field.key]: newValue },
        },
      };
    }

    // ── Change skill level (needs confirmation) ──────────────────────
    case "change_skill_level": {
      const level = intent.params.level;
      const labelMap: Record<string, string> = { basic: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
      return {
        executed: false,
        actionType: "change_skill_level",
        description: `Change skill level to ${labelMap[level] || level}`,
        confirmationMessage: `I'll switch your experience level to **${labelMap[level] || level}**. This changes how I interact with you and what features are shown.\n\nShould I go ahead? (yes/no)`,
        needsConfirmation: true,
        pendingAction: {
          type: "change_skill_level",
          params: { level },
        },
      };
    }

    // ── Toggle automation (needs confirmation) ───────────────────────
    case "enable_automation":
    case "disable_automation": {
      const enable = intent.action === "enable_automation";
      const searchName = intent.params.automationName.toLowerCase();
      const match = profile.automations.find(
        (a) =>
          a.name.toLowerCase().includes(searchName) ||
          a.key.toLowerCase().includes(searchName.replace(/\s+/g, "_")) ||
          a.key.toLowerCase().includes(searchName.replace(/\s+/g, "-"))
      );

      if (!match) {
        const suggestions = profile.automations
          .slice(0, 5)
          .map((a) => `- ${a.name} (${a.enabled ? "active" : "inactive"})`)
          .join("\n");
        return {
          executed: true,
          actionType: intent.action,
          description: `Could not find automation "${intent.params.automationName}"`,
          confirmationMessage: `I couldn't find an automation matching "**${intent.params.automationName}**".\n\nHere are some of your automations:\n${suggestions}\n\nTry again with a more specific name.`,
        };
      }

      if (match.enabled === enable) {
        return {
          executed: true,
          actionType: intent.action,
          description: `${match.name} is already ${enable ? "enabled" : "disabled"}`,
          confirmationMessage: `**${match.name}** is already ${enable ? "enabled ✅" : "disabled ⬜"}. No changes needed!`,
        };
      }

      return {
        executed: false,
        actionType: intent.action,
        description: `${enable ? "Enable" : "Disable"} ${match.name}`,
        confirmationMessage: `I'll **${enable ? "enable" : "disable"}** the "**${match.name}**" automation.\n\nShould I go ahead? (yes/no)`,
        needsConfirmation: true,
        pendingAction: {
          type: intent.action,
          params: { key: match.key, enabled: String(enable) },
        },
      };
    }

    // ── Confirm a pending action ─────────────────────────────────────
    case "confirm_action": {
      if (!pendingAction) {
        return {
          executed: true,
          actionType: "confirm_action",
          description: "No pending action",
          confirmationMessage: "There's nothing pending to confirm. Ask me to change a setting or toggle an automation!",
        };
      }
      return executePendingAction(db, tenantId, userId, pendingAction, profile);
    }

    // ── Cancel a pending action ──────────────────────────────────────
    // ── Live data actions ────────────────────────────────────────────
    case "show_stats": {
      const active = profile.automations.filter((a) => a.enabled).length;
      const trend = profile.revenueTrend === "up" ? "📈" : profile.revenueTrend === "down" ? "📉" : "➡️";
      const lines = [
        `Here's your live dashboard:`,
        ``,
        `**Leads:** ${profile.leadCount} total (${profile.bookedCount} booked, ${profile.qualifiedLeadCount} qualified, ${profile.noShowCount} no-shows)`,
        `**Messages Sent:** ${profile.messagesSent} (${profile.deliveryStats.rate.toFixed(0)}% delivery rate)`,
        `**Revenue Recovered:** $${profile.totalRecoveredRevenue.toLocaleString()} ${trend}`,
        `**Recovery Rate:** ${profile.overallRecoveryRate.toFixed(1)}%`,
        `**Automations:** ${active} of ${profile.automations.length} active`,
        `**Calendars Connected:** ${profile.connectedCalendars}`,
        `**Today's Appointments:** ${profile.todayAppointments}`,
      ];
      if (profile.bookedCount > 0 && profile.leadCount > 0) {
        lines.push(``, `**Conversion Rate:** ${((profile.bookedCount / profile.leadCount) * 100).toFixed(1)}%`);
      }
      const totalLeakage = (profile.leakageMetrics?.qualifiedUnbooked ?? 0) + (profile.leakageMetrics?.cancellationsUnrecovered ?? 0);
      if (totalLeakage > 0) {
        lines.push(``, `⚠️ **${totalLeakage} revenue leakage issue(s) detected** — say "show leakage" for details`);
      }
      return { executed: true, actionType: "show_stats", description: "Live stats", confirmationMessage: lines.join("\n") };
    }

    case "show_leads": {
      if (profile.recentLeads.length === 0) {
        return { executed: true, actionType: "show_leads", description: "No leads", confirmationMessage: "You don't have any leads yet. Add your first lead from the Leads page or connect your booking software to auto-import contacts." };
      }
      const leadLines = profile.recentLeads.map((l, i) => `${i + 1}. **${l.name || "Unnamed"}** — ${l.status}`);
      return { executed: true, actionType: "show_leads", description: "Recent leads", confirmationMessage: `Your most recent leads:\n\n${leadLines.join("\n")}\n\nView all leads on the [Leads page](/leads).` };
    }

    case "show_calendar": {
      if (profile.connectedCalendars === 0) {
        return { executed: true, actionType: "show_calendar", description: "No calendar", confirmationMessage: "You don't have a calendar connected yet. Go to [Calendar & Booking](/calendar-integration) to connect your Google Calendar, Outlook, Calendly, or Acuity." };
      }
      return { executed: true, actionType: "show_calendar", description: "Calendar", confirmationMessage: `You have **${profile.connectedCalendars}** calendar(s) connected with **${profile.todayAppointments}** appointment(s) today. View details on the [Calendar page](/calendar-integration).` };
    }

    case "show_no_shows": {
      if (profile.noShowCount === 0) {
        return { executed: true, actionType: "show_no_shows", description: "No no-shows", confirmationMessage: "Great news — no recorded no-shows! Keep it up." };
      }
      const noShowAuto = profile.automations.find((a) => a.key === "no_show_check_in" || a.name.toLowerCase().includes("no-show"));
      const suggestion = noShowAuto?.enabled ? "Your no-show recovery automation is active." : "I'd recommend enabling the **No-Show Recovery** automation to automatically re-engage these leads.";
      return { executed: true, actionType: "show_no_shows", description: "No-show report", confirmationMessage: `You have **${profile.noShowCount}** lead(s) marked as no-shows. ${suggestion}` };
    }

    case "contact_lead": {
      const name = intent.params.leadName?.toLowerCase() || "";
      const match = profile.recentLeads.find((l) => (l.name || "").toLowerCase().includes(name));
      if (!match) {
        return { executed: true, actionType: "contact_lead", description: "Lead not found", confirmationMessage: `I couldn't find a lead named "${intent.params.leadName}" in your recent leads. Try checking the [Leads page](/leads).` };
      }
      return { executed: true, actionType: "contact_lead", description: `Contact ${match.name}`, confirmationMessage: `Found **${match.name}** (${match.status}). Go to the [Leads page](/leads) to send them a message.` };
    }

    case "check_health": {
      const active = profile.automations.filter((a) => a.enabled).length;
      const healthLines = [
        `System status:`,
        ``,
        `**Calendars:** ${profile.connectedCalendars > 0 ? `${profile.connectedCalendars} connected` : "None connected"}`,
        `**Automations:** ${active} active`,
        `**Plan:** ${profile.planName}`,
        `**Messages Sent:** ${profile.messagesSent}`,
      ];
      return { executed: true, actionType: "check_health", description: "Health check", confirmationMessage: healthLines.join("\n") };
    }

    case "suggest_action": {
      const suggestions: string[] = [];
      if (profile.connectedCalendars === 0) suggestions.push("Connect your booking software at [Calendar & Booking](/calendar-integration) to auto-import contacts from appointments.");
      if (profile.noShowCount > 0) {
        const noShowAuto = profile.automations.find((a) => a.key === "no_show_check_in" || a.name.toLowerCase().includes("no-show"));
        if (!noShowAuto?.enabled) suggestions.push("Enable the **No-Show Recovery** automation — you have " + profile.noShowCount + " no-shows that could be recovered.");
      }
      if (profile.messagesSent < 10) suggestions.push("Send your first SMS campaign from the [Automations page](/automations) to start recovering revenue.");
      if (profile.automations.every((a) => !a.enabled)) suggestions.push("You have 0 automations active. Enable at least the **Appointment Reminder** and **No-Show Check-In** to start.");
      if (profile.leadCount > 0 && profile.bookedCount === 0) suggestions.push("You have " + profile.leadCount + " leads but no bookings yet. Try sending a rebooking offer.");
      if (suggestions.length === 0) suggestions.push("You're doing great! Keep your automations running and monitor your analytics for optimization opportunities.");
      return { executed: true, actionType: "suggest_action", description: "Suggestions", confirmationMessage: `Here's what I'd recommend:\n\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}` };
    }

    // ── Revenue report (real data) ──────────────────────────────────
    case "show_revenue": {
      const rev = profile.totalRecoveredRevenue;
      const recent = profile.recentRecoveredRevenue;
      const rate = profile.overallRecoveryRate;
      const avg = profile.avgRevenuePerBooking;
      const trend = profile.revenueTrend === "up" ? "📈 Trending up" : profile.revenueTrend === "down" ? "📉 Trending down" : "➡️ Holding steady";
      const lines = [
        `**Revenue Recovery Report**`,
        ``,
        `**Total Recovered:** $${rev.toLocaleString()}`,
        `**Last 30 Days:** $${recent.toLocaleString()}`,
        `**Recovery Rate:** ${rate.toFixed(1)}%`,
        `**Avg per Booking:** $${avg.toLocaleString()}`,
        `**Trend:** ${trend}`,
        ``,
        `**Pipeline:** ${profile.qualifiedLeadCount} qualified leads, ${profile.contactedLeadCount} contacted`,
        `**Lost:** ${profile.lostLeadCount} leads`,
      ];
      if (profile.qualifiedLeadCount > 0 && avg > 0) {
        const potential = profile.qualifiedLeadCount * avg * (rate / 100);
        lines.push(``, `**Estimated potential recovery:** $${Math.round(potential).toLocaleString()}`);
      }
      return { executed: true, actionType: "show_revenue", description: "Revenue report", confirmationMessage: lines.join("\n") };
    }

    // ── Revenue leakage breakdown ────────────────────────────────────
    case "show_leakage": {
      const lk = profile.leakageMetrics;
      const totalLeakage = lk.unconfirmedAppointments + lk.qualifiedUnbooked + lk.cancellationsUnrecovered + lk.failedDeliveryRecovery;
      if (totalLeakage === 0) {
        return { executed: true, actionType: "show_leakage", description: "No leakage", confirmationMessage: "No revenue leakage detected right now. Your automations are covering your bases!" };
      }
      const lines = [
        `**Revenue Leakage Report** (${totalLeakage} issues found)`,
        ``,
      ];
      if (lk.unconfirmedAppointments > 0) lines.push(`⚠️ **${lk.unconfirmedAppointments} unconfirmed appointment(s)** in the next 48 hours — consider sending confirmation reminders`);
      if (lk.qualifiedUnbooked > 0) lines.push(`💰 **${lk.qualifiedUnbooked} qualified lead(s)** never booked — potential revenue sitting on the table`);
      if (lk.cancellationsUnrecovered > 0) lines.push(`🔄 **${lk.cancellationsUnrecovered} cancellation(s)** not yet recovered — try enabling the cancellation rescue automation`);
      if (lk.failedDeliveryRecovery > 0) lines.push(`❌ **${lk.failedDeliveryRecovery} lead(s)** with failed message delivery this week — verify their phone numbers`);
      if (profile.qualifiedLeadCount > 0 && profile.avgRevenuePerBooking > 0) {
        lines.push(``, `**Estimated leaked revenue:** ~$${Math.round(lk.qualifiedUnbooked * profile.avgRevenuePerBooking).toLocaleString()}`);
      }
      return { executed: true, actionType: "show_leakage", description: "Leakage report", confirmationMessage: lines.join("\n") };
    }

    // ── Explain automation workflow ──────────────────────────────────
    case "explain_automation": {
      const searchName = (intent.params.automationName || "").toLowerCase();
      try {
        const { getWorkflow, WORKFLOW_REGISTRY } = await import("../services/recoveryWorkflows");
        // Try exact key match first, then fuzzy name match
        let workflow = getWorkflow(searchName.replace(/\s+/g, "_"));
        if (!workflow) {
          const allKeys = Object.keys(WORKFLOW_REGISTRY);
          const matchKey = allKeys.find((k) =>
            k.includes(searchName.replace(/\s+/g, "_")) ||
            WORKFLOW_REGISTRY[k as keyof typeof WORKFLOW_REGISTRY].name.toLowerCase().includes(searchName)
          );
          if (matchKey) workflow = WORKFLOW_REGISTRY[matchKey as keyof typeof WORKFLOW_REGISTRY];
        }
        if (!workflow) {
          return { executed: true, actionType: "explain_automation", description: "Not found", confirmationMessage: `I couldn't find an automation matching "${intent.params.automationName}". Try "explain the no-show recovery automation" or ask me to "show my automations" to see the full list.` };
        }
        const stepDescriptions = workflow.steps.map((s: any, i: number) => {
          if (s.type === "sms") return `${i + 1}. Send SMS: "${(s.messageBody || "").substring(0, 60)}..."`;
          if (s.type === "delay") return `${i + 1}. Wait ${s.delayMinutes ?? s.delay ?? "?"} minutes`;
          if (s.type === "state_transition") return `${i + 1}. Move to "${s.targetState}" state`;
          if (s.type === "webhook") return `${i + 1}. Call webhook`;
          return `${i + 1}. ${s.type}`;
        });
        const lines = [
          `**${workflow.name}**`,
          ``,
          workflow.description,
          ``,
          `**Trigger:** ${workflow.triggerEvent}`,
          `**Category:** ${workflow.category}`,
          `**Priority:** ${workflow.priority}`,
          `**Recovery flow:** ${workflow.isRecoveryFlow ? "Yes (tracks detected → contacted → recovered → billed)" : "No"}`,
          ``,
          `**Steps:**`,
          ...stepDescriptions,
          ``,
          `**Cooldown:** ${workflow.cooldownMinutes} minutes between triggers`,
          `**Max attempts per lead:** ${workflow.maxAttemptsPerLead}`,
        ];
        return { executed: true, actionType: "explain_automation", description: `Explained ${workflow.name}`, confirmationMessage: lines.join("\n") };
      } catch {
        return { executed: true, actionType: "explain_automation", description: "Error", confirmationMessage: "Sorry, I couldn't load the automation details. Try again in a moment." };
      }
    }

    // ── Automation performance stats ─────────────────────────────────
    case "show_automation_performance": {
      const enabled = profile.automations.filter((a) => a.enabled);
      const disabled = profile.automations.filter((a) => !a.enabled);
      const lines = [
        `**Automation Performance Overview**`,
        ``,
        `**Active:** ${enabled.length} of ${profile.automations.length}`,
        `**Revenue recovered:** $${profile.totalRecoveredRevenue.toLocaleString()}`,
        `**Recovery rate:** ${profile.overallRecoveryRate.toFixed(1)}%`,
        `**Messages sent:** ${profile.messagesSent}`,
        `**Delivery rate:** ${profile.deliveryStats.rate.toFixed(1)}%`,
        ``,
      ];
      if (disabled.length > 0) {
        lines.push(`**Inactive automations that could help:**`);
        disabled.slice(0, 5).forEach((a) => lines.push(`- ⬜ ${a.name}`));
      }
      if (profile.deliveryStats.failed > 0) {
        lines.push(``, `⚠️ ${profile.deliveryStats.failed} messages failed delivery recently. Consider verifying lead phone numbers.`);
      }
      return { executed: true, actionType: "show_automation_performance", description: "Automation performance", confirmationMessage: lines.join("\n") };
    }

    // ── Predictions / forecast ──────────────────────────────────────
    case "show_predictions": {
      const avg = profile.avgRevenuePerBooking || 150;
      const rate = profile.overallRecoveryRate || 0;
      const potentialRecovery = profile.qualifiedLeadCount * avg * (rate / 100);
      const trend = profile.revenueTrend;
      const lines = [
        `**Revenue Forecast & Predictions**`,
        ``,
        `**Current recovery rate:** ${rate.toFixed(1)}%`,
        `**Avg revenue per booking:** $${avg.toLocaleString()}`,
        `**Qualified leads in pipeline:** ${profile.qualifiedLeadCount}`,
        ``,
        `**Projected recovery from pipeline:** $${Math.round(potentialRecovery).toLocaleString()}`,
        `**Revenue trend:** ${trend === "up" ? "📈 Upward — keep it going!" : trend === "down" ? "📉 Declining — consider enabling more automations" : "➡️ Stable"}`,
        ``,
      ];
      if (profile.leakageMetrics.qualifiedUnbooked > 0) {
        lines.push(`💡 **Opportunity:** ${profile.leakageMetrics.qualifiedUnbooked} qualified leads haven't booked. A targeted campaign could recover ~$${Math.round(profile.leakageMetrics.qualifiedUnbooked * avg * 0.3).toLocaleString()}.`);
      }
      const disabledCount = profile.automations.filter((a) => !a.enabled).length;
      if (disabledCount > 3) {
        lines.push(`💡 **Quick win:** You have ${disabledCount} inactive automations. Enabling key ones could boost your recovery rate significantly.`);
      }
      return { executed: true, actionType: "show_predictions", description: "Revenue forecast", confirmationMessage: lines.join("\n") };
    }

    // ── Delivery stats ──────────────────────────────────────────────
    case "show_delivery_stats": {
      const ds = profile.deliveryStats;
      const lines = [
        `**Message Delivery Report**`,
        ``,
        `**Total sent:** ${ds.total.toLocaleString()}`,
        `**Delivered:** ${ds.delivered.toLocaleString()}`,
        `**Failed:** ${ds.failed.toLocaleString()}`,
        `**Delivery rate:** ${ds.rate.toFixed(1)}%`,
      ];
      if (ds.rate < 85 && ds.total > 0) {
        lines.push(``, `⚠️ Your delivery rate is below 85%. This may indicate invalid phone numbers or carrier issues. Consider verifying your lead phone numbers.`);
      } else if (ds.total > 0) {
        lines.push(``, `✅ Delivery rate looks healthy!`);
      }
      return { executed: true, actionType: "show_delivery_stats", description: "Delivery stats", confirmationMessage: lines.join("\n") };
    }

    // ── Optimize suggestions (data-driven) ──────────────────────────
    case "optimize_suggestions": {
      const suggestions: string[] = [];
      // Priority 1: Fix leakage
      if (profile.leakageMetrics.qualifiedUnbooked > 3) {
        suggestions.push(`**Recover pipeline revenue:** You have ${profile.leakageMetrics.qualifiedUnbooked} qualified leads that never booked. Enable the "Qualified Follow-Up" automation or run a rebooking campaign.`);
      }
      if (profile.leakageMetrics.unconfirmedAppointments > 0) {
        suggestions.push(`**Confirm appointments:** ${profile.leakageMetrics.unconfirmedAppointments} upcoming appointment(s) without confirmation. Enable the "Appointment Reminder" automation.`);
      }
      // Priority 2: Fix delivery
      if (profile.deliveryStats.rate < 85 && profile.deliveryStats.total > 0) {
        suggestions.push(`**Improve delivery rate:** Currently at ${profile.deliveryStats.rate.toFixed(1)}%. Verify phone numbers and check for invalid contacts.`);
      }
      // Priority 3: Enable automations
      const keyAutomations = ["noshow_recovery", "missed_call_textback", "appointment_reminder_24h", "cancellation_same_day"];
      const disabledKey = profile.automations.filter((a) => !a.enabled && keyAutomations.includes(a.key));
      if (disabledKey.length > 0) {
        suggestions.push(`**Enable key automations:** These high-impact automations are off: ${disabledKey.map((a) => a.name).join(", ")}`);
      }
      // Priority 4: Connect calendar
      if (profile.connectedCalendars === 0) {
        suggestions.push(`**Connect your calendar:** Enables automatic no-show detection, appointment reminders, and cancellation recovery.`);
      }
      // Priority 5: Growth
      if (profile.overallRecoveryRate > 0 && profile.overallRecoveryRate < 20) {
        suggestions.push(`**Boost recovery rate:** Your ${profile.overallRecoveryRate.toFixed(1)}% rate can improve. Consider adding win-back campaigns and adjusting message timing.`);
      }
      if (suggestions.length === 0) suggestions.push(`Your setup looks strong! Monitor your analytics and consider A/B testing message tones to further optimize.`);
      return { executed: true, actionType: "optimize_suggestions", description: "Optimization tips", confirmationMessage: `**AI Optimization Recommendations**\n\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n\n")}` };
    }

    // ── Generate full report ─────────────────────────────────────────
    case "generate_report": {
      const ds = profile.deliveryStats;
      const lk = profile.leakageMetrics;
      const enabled = profile.automations.filter((a) => a.enabled).length;
      const lines = [
        `**Rebooked Performance Report**`,
        `*Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}*`,
        ``,
        `---`,
        `**Revenue Recovery**`,
        `- Total recovered: $${profile.totalRecoveredRevenue.toLocaleString()}`,
        `- Last 30 days: $${profile.recentRecoveredRevenue.toLocaleString()}`,
        `- Recovery rate: ${profile.overallRecoveryRate.toFixed(1)}%`,
        `- Trend: ${profile.revenueTrend === "up" ? "📈 Up" : profile.revenueTrend === "down" ? "📉 Down" : "➡️ Stable"}`,
        ``,
        `**Leads**`,
        `- Total: ${profile.leadCount}`,
        `- Booked: ${profile.bookedCount}`,
        `- Qualified: ${profile.qualifiedLeadCount}`,
        `- Contacted: ${profile.contactedLeadCount}`,
        `- Lost: ${profile.lostLeadCount}`,
        `- No-shows: ${profile.noShowCount}`,
        ``,
        `**Messaging**`,
        `- Sent: ${profile.messagesSent}`,
        `- Delivery rate: ${ds.rate.toFixed(1)}%`,
        `- Failed: ${ds.failed}`,
        ``,
        `**Automations**`,
        `- Active: ${enabled} of ${profile.automations.length}`,
        `- Calendars connected: ${profile.connectedCalendars}`,
        ``,
        `**Leakage**`,
        `- Unconfirmed appointments: ${lk.unconfirmedAppointments}`,
        `- Qualified unbooked: ${lk.qualifiedUnbooked}`,
        `- Unrecovered cancellations: ${lk.cancellationsUnrecovered}`,
        `- Failed delivery leads: ${lk.failedDeliveryRecovery}`,
        `---`,
      ];
      return { executed: true, actionType: "generate_report", description: "Full report", confirmationMessage: lines.join("\n") };
    }

    // ── Recent activity ─────────────────────────────────────────────
    case "show_recent_activity": {
      const lines = [
        `**Recent Activity**`,
        ``,
        `**Today:** ${profile.todayAppointments} appointment(s)`,
        `**Messages sent:** ${profile.messagesSent}`,
        `**Active automations:** ${profile.automations.filter((a) => a.enabled).length}`,
        ``,
      ];
      if (profile.recentLeads.length > 0) {
        lines.push(`**Latest leads:**`);
        profile.recentLeads.slice(0, 5).forEach((l) => lines.push(`- ${l.name || "Unnamed"} (${l.status})`));
      }
      if (profile.revenueTrend !== "flat") {
        lines.push(``, `**Revenue trend:** ${profile.revenueTrend === "up" ? "📈 Going up" : "📉 Declining"}`);
      }
      return { executed: true, actionType: "show_recent_activity", description: "Recent activity", confirmationMessage: lines.join("\n") };
    }

    // ── Create a lead ───────────────────────────────────────────────
    case "create_lead": {
      const leadName = intent.params.name || "";
      const leadPhone = intent.params.phone || "";
      if (!leadName || !leadPhone) {
        return { executed: true, actionType: "create_lead", description: "Missing info", confirmationMessage: `I need both a name and phone number. Try: "add a lead named Sarah Jones with phone 555-123-4567"` };
      }
      return {
        executed: false,
        actionType: "create_lead",
        description: `Create lead: ${leadName} (${leadPhone})`,
        confirmationMessage: `I'll create a new lead:\n\n**Name:** ${leadName}\n**Phone:** ${leadPhone}\n\nShould I go ahead? (yes/no)`,
        needsConfirmation: true,
        pendingAction: { type: "create_lead", params: { name: leadName, phone: leadPhone } },
      };
    }

    // ── Send message to lead ────────────────────────────────────────
    case "send_message_to_lead": {
      const targetName = (intent.params.leadName || "").toLowerCase();
      const msg = intent.params.message || "";
      const matchLead = profile.recentLeads.find((l) => (l.name || "").toLowerCase().includes(targetName));
      if (!matchLead) {
        return { executed: true, actionType: "send_message_to_lead", description: "Lead not found", confirmationMessage: `I couldn't find a lead named "${intent.params.leadName}" in your recent leads. Check the [Leads page](/leads) or try a different name.` };
      }
      if (!msg) {
        return { executed: true, actionType: "send_message_to_lead", description: "No message", confirmationMessage: `What would you like to say to ${matchLead.name}? Try: "send Sarah saying Hi, would you like to rebook?"` };
      }
      return {
        executed: false,
        actionType: "send_message_to_lead",
        description: `Send SMS to ${matchLead.name}`,
        confirmationMessage: `I'll send this message to **${matchLead.name}**:\n\n> ${msg}\n\nShould I go ahead? (yes/no)`,
        needsConfirmation: true,
        pendingAction: { type: "send_message_to_lead", params: { leadName: matchLead.name || "", phone: matchLead.phone || "", message: msg } },
      };
    }

    // ── Show cancellations ──────────────────────────────────────────
    case "show_cancellations": {
      const cancCount = profile.leakageMetrics.cancellationsUnrecovered;
      if (cancCount === 0) {
        return { executed: true, actionType: "show_cancellations", description: "No cancellations", confirmationMessage: "No unrecovered cancellations found. Your recovery automations are working well!" };
      }
      const cancAuto = profile.automations.find((a) => a.key === "cancellation_same_day" || a.key === "cancellation_rescue_48h");
      const suggestion = cancAuto?.enabled ? "Your cancellation recovery automation is active and working on these." : "Consider enabling the **Cancellation Rescue** automation to automatically recover these.";
      return { executed: true, actionType: "show_cancellations", description: "Cancellations", confirmationMessage: `You have **${cancCount}** unrecovered cancellation(s). ${suggestion}` };
    }

    case "cancel_action": {
      return {
        executed: true,
        actionType: "cancel_action",
        description: "Cancelled",
        confirmationMessage: pendingAction
          ? "No problem — cancelled! What else can I help with?"
          : "Nothing to cancel. What can I help you with?",
      };
    }

    default:
      return {
        executed: false,
        actionType: "unknown",
        description: "Unknown action",
        confirmationMessage: "",
      };
  }
}

// ── Execute a confirmed pending action ───────────────────────────────────────

async function executePendingAction(
  db: MySql2Database<any>,
  tenantId: number,
  userId: number,
  pending: PendingAction,
  profile: UserProfile,
): Promise<ActionResult> {
  try {
    switch (pending.type) {
      case "update_phone":
      case "update_email":
      case "update_website":
      case "update_address":
      case "update_city": {
        const key = Object.keys(pending.params)[0];
        const val = String(pending.params[key]);
        // Settings fields go through updateTenant with settings sub-object
        await TenantService.updateTenant(db, tenantId, { settings: { [key]: val } });
        return {
          executed: true,
          actionType: pending.type,
          description: `Updated ${key} to "${val}"`,
          confirmationMessage: `Done! Your **${key}** has been updated to "**${val}**". ✅`,
        };
      }

      case "update_business_name": {
        await TenantService.updateTenant(db, tenantId, { name: String(pending.params.name) });
        return {
          executed: true,
          actionType: "update_business_name",
          description: `Updated business name to "${pending.params.name}"`,
          confirmationMessage: `Done! Your business name is now "**${pending.params.name}**". ✅`,
        };
      }

      case "update_timezone": {
        await TenantService.updateTenant(db, tenantId, { timezone: String(pending.params.timezone) });
        return {
          executed: true,
          actionType: "update_timezone",
          description: `Updated timezone to "${pending.params.timezone}"`,
          confirmationMessage: `Done! Your timezone is now **${pending.params.timezone}**. ✅`,
        };
      }

      case "update_industry": {
        await TenantService.updateTenant(db, tenantId, { industry: String(pending.params.industry) });
        return {
          executed: true,
          actionType: "update_industry",
          description: `Updated industry to "${pending.params.industry}"`,
          confirmationMessage: `Done! Your industry is now **${pending.params.industry}**. ✅`,
        };
      }

      case "change_skill_level": {
        const { users } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const { sql } = await import("drizzle-orm");
        const level = String(pending.params.level) as "basic" | "intermediate" | "advanced";
        await db.update(users).set({ skillLevel: level, skillLevelSetAt: sql`NOW()` }).where(eq(users.id, userId));
        const labelMap: Record<string, string> = { basic: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
        return {
          executed: true,
          actionType: "change_skill_level",
          description: `Changed skill level to ${level}`,
          confirmationMessage: `Done! Your experience level is now **${labelMap[level] || level}**. ✅\n\nThe interface will adjust to match — you may need to refresh the page.`,
        };
      }

      case "create_lead": {
        const LeadService = await import("../services/lead.service");
        const name = String(pending.params.name);
        const phone = String(pending.params.phone);
        try {
          const result = await LeadService.createLead(db, { tenantId, phone, name, source: "ai_chat" });
          if ((result as any)?.duplicate) {
            return { executed: true, actionType: "create_lead", description: "Duplicate lead", confirmationMessage: `A lead with that phone number already exists. Check the [Leads page](/leads).` };
          }
          return { executed: true, actionType: "create_lead", description: `Created lead ${name}`, confirmationMessage: `Done! Lead **${name}** (${phone}) has been created. ✅\n\nView them on the [Leads page](/leads).` };
        } catch (err: any) {
          return { executed: false, actionType: "create_lead", description: "Failed", confirmationMessage: `Sorry, I couldn't create the lead: ${err.message || "Unknown error"}` };
        }
      }

      case "send_message_to_lead": {
        const leadName = String(pending.params.leadName);
        const phone = String(pending.params.phone);
        const message = String(pending.params.message);
        try {
          const { sendSMS } = await import("./sms");
          const tenant = await TenantService.getTenantById(db, tenantId);
          await sendSMS(phone, message, tenant?.phone || undefined, tenantId);
          return { executed: true, actionType: "send_message_to_lead", description: `Sent SMS to ${leadName}`, confirmationMessage: `Message sent to **${leadName}**! ✅` };
        } catch (err: any) {
          return { executed: false, actionType: "send_message_to_lead", description: "Failed", confirmationMessage: `Sorry, I couldn't send the message: ${err.message || "Unknown error"}. Try sending from the [Leads page](/leads).` };
        }
      }

      case "enable_automation":
      case "disable_automation": {
        const key = String(pending.params.key);
        const enabled = pending.params.enabled === "true";
        const automation = await AutomationService.getAutomationByKey(db, tenantId, key);
        if (!automation) {
          return {
            executed: false,
            actionType: pending.type,
            description: "Automation not found",
            confirmationMessage: "Sorry, I couldn't find that automation. It may have been removed.",
          };
        }
        await AutomationService.updateAutomation(db, tenantId, automation.id, { enabled });
        return {
          executed: true,
          actionType: pending.type,
          description: `${enabled ? "Enabled" : "Disabled"} ${automation.name}`,
          confirmationMessage: `Done! **${automation.name}** is now ${enabled ? "**enabled** ✅" : "**disabled** ⬜"}. `,
        };
      }

      default:
        return {
          executed: false,
          actionType: pending.type,
          description: "Unknown pending action",
          confirmationMessage: "Something went wrong — I don't recognise that action. Try again?",
        };
    }
  } catch (err: any) {
    return {
      executed: false,
      actionType: pending.type,
      description: "Action failed",
      confirmationMessage: `Sorry, something went wrong: ${err.message || "Unknown error"}. Please try again or make the change manually in Settings.`,
    };
  }
}
