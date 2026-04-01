/**
 * RebookedAI Proactive Insights Engine
 *
 * Analyses the expanded UserProfile and returns prioritised, actionable insights.
 * Pure rule-based — zero LLM cost. Insights are surfaced in the chat UI
 * when no explicit intent was detected.
 */

import type { UserProfile } from "./chatActions";

export interface ProactiveInsight {
  id: string;
  type: "warning" | "opportunity" | "achievement" | "recommendation";
  title: string;
  message: string;
  priority: number; // 1 = critical, 5 = nice-to-know
  actionLabel?: string;
  actionIntent?: string; // chat message the UI sends when the user clicks the action button
}

/**
 * Generate prioritised insights from the user's live profile data.
 * Returns insights sorted by priority (highest first).
 */
export function generateInsights(profile: UserProfile): ProactiveInsight[] {
  const insights: ProactiveInsight[] = [];
  const lk = profile.leakageMetrics ?? { unconfirmedAppointments: 0, qualifiedUnbooked: 0, cancellationsUnrecovered: 0, failedDeliveryRecovery: 0 };
  const ds = profile.deliveryStats ?? { total: 0, delivered: 0, failed: 0, rate: 100 };
  const avg = profile.avgRevenuePerBooking || 150;

  // ── Priority 1: Critical issues ─────────────────────────────────────────

  if (lk.qualifiedUnbooked > 3) {
    const potential = lk.qualifiedUnbooked * avg;
    insights.push({
      id: "leakage_qualified",
      type: "opportunity",
      title: "Revenue sitting on the table",
      message: `${lk.qualifiedUnbooked} qualified leads never booked — ~$${Math.round(potential).toLocaleString()} in potential revenue. A follow-up campaign could recover 20-30% of this.`,
      priority: 1,
      actionLabel: "Show leakage details",
      actionIntent: "Show revenue leakage",
    });
  }

  if (ds.rate < 85 && ds.total > 10) {
    insights.push({
      id: "delivery_low",
      type: "warning",
      title: "Low SMS delivery rate",
      message: `Your delivery rate is ${ds.rate.toFixed(0)}% — ${ds.failed} messages failed recently. Invalid phone numbers may be wasting your SMS credits.`,
      priority: 1,
      actionLabel: "View delivery stats",
      actionIntent: "Show delivery stats",
    });
  }

  // ── Priority 2: Important opportunities ─────────────────────────────────

  // Key automations disabled while matching leakage exists
  const noShowAuto = profile.automations.find((a) => a.key === "noshow_recovery");
  if (noShowAuto && !noShowAuto.enabled && profile.noShowCount > 0) {
    insights.push({
      id: "enable_noshow",
      type: "recommendation",
      title: "No-Show Recovery is off",
      message: `You have ${profile.noShowCount} no-show(s) but the No-Show Recovery automation is disabled. Enabling it could automatically recover lost appointments.`,
      priority: 2,
      actionLabel: "Enable it",
      actionIntent: "Enable no-show recovery",
    });
  }

  const missedCallAuto = profile.automations.find((a) => a.key === "missed_call_textback");
  if (missedCallAuto && !missedCallAuto.enabled) {
    insights.push({
      id: "enable_missed_call",
      type: "recommendation",
      title: "Missed Call Text-Back is off",
      message: `The Missed Call Text-Back automation instantly texts anyone whose call you miss — before they call a competitor. Consider enabling it.`,
      priority: 2,
      actionLabel: "Enable it",
      actionIntent: "Enable missed call textback",
    });
  }

  if (profile.revenueTrend === "down") {
    insights.push({
      id: "revenue_declining",
      type: "warning",
      title: "Revenue trending down",
      message: `Your recovery revenue is declining over the last 30 days. Consider enabling more automations or running a win-back campaign.`,
      priority: 2,
      actionLabel: "Get recommendations",
      actionIntent: "How can I improve?",
    });
  }

  if (lk.unconfirmedAppointments > 0) {
    insights.push({
      id: "unconfirmed_appts",
      type: "warning",
      title: "Unconfirmed appointments",
      message: `${lk.unconfirmedAppointments} appointment(s) in the next 48 hours without confirmation. These are at risk of becoming no-shows.`,
      priority: 2,
      actionLabel: "View details",
      actionIntent: "Show revenue leakage",
    });
  }

  if (lk.cancellationsUnrecovered > 2) {
    const cancAuto = profile.automations.find((a) => a.key === "cancellation_same_day" || a.key === "cancellation_rescue_48h");
    if (!cancAuto?.enabled) {
      insights.push({
        id: "cancellation_recovery",
        type: "recommendation",
        title: "Cancellations going unrecovered",
        message: `${lk.cancellationsUnrecovered} cancellation(s) not yet recovered. Enable the Cancellation Rescue automation to automatically follow up.`,
        priority: 2,
        actionLabel: "Enable it",
        actionIntent: "Enable cancellation rescue",
      });
    }
  }

  // ── Priority 3: Setup improvements ──────────────────────────────────────

  if (profile.connectedCalendars === 0) {
    insights.push({
      id: "connect_calendar",
      type: "recommendation",
      title: "No calendar connected",
      message: `Connecting your calendar enables automatic no-show detection, appointment reminders, and cancellation recovery.`,
      priority: 3,
      actionLabel: "Learn how",
      actionIntent: "How do I connect my calendar?",
    });
  }

  if (profile.messagesSent < 10 && profile.leadCount > 0) {
    insights.push({
      id: "first_campaign",
      type: "recommendation",
      title: "Start messaging your leads",
      message: `You have ${profile.leadCount} leads but only ${profile.messagesSent} messages sent. Enable your automations to start recovering revenue automatically.`,
      priority: 3,
      actionLabel: "Show automations",
      actionIntent: "Show my automations",
    });
  }

  if (profile.automations.every((a) => !a.enabled) && profile.automations.length > 0) {
    insights.push({
      id: "all_automations_off",
      type: "warning",
      title: "All automations are disabled",
      message: `None of your ${profile.automations.length} automations are active. Enable at least the Appointment Reminder and No-Show Recovery to start.`,
      priority: 3,
      actionLabel: "Show automations",
      actionIntent: "Show my automations",
    });
  }

  // ── Priority 4: Achievements & positive reinforcement ───────────────────

  if (profile.totalRecoveredRevenue > 0) {
    insights.push({
      id: "revenue_recovered",
      type: "achievement",
      title: "Revenue recovered!",
      message: `You've recovered $${profile.totalRecoveredRevenue.toLocaleString()} so far. ${profile.revenueTrend === "up" ? "And it's trending up!" : "Keep those automations running to grow this number."}`,
      priority: 4,
    });
  }

  if (profile.overallRecoveryRate > 30) {
    insights.push({
      id: "high_recovery_rate",
      type: "achievement",
      title: "Strong recovery rate",
      message: `Your ${profile.overallRecoveryRate.toFixed(0)}% recovery rate is above average. Great work!`,
      priority: 4,
    });
  }

  if (profile.leadTrend === "up") {
    insights.push({
      id: "leads_growing",
      type: "achievement",
      title: "Lead growth detected",
      message: `Your lead pipeline is growing. Make sure your automations are keeping up with the volume.`,
      priority: 4,
    });
  }

  // Sort by priority (lowest number = highest priority)
  return insights.sort((a, b) => a.priority - b.priority);
}
