/**
 * No-Show Prediction Service
 *
 * Rule-based predictive scoring for appointment no-shows.
 * Structured so ML models can replace individual factors later.
 *
 * Score: 0-100, bucketed as: low (0-24), medium (25-49), high (50-74), critical (75-100)
 *
 * Factors:
 *   1. History       (0-30)  — past no-shows / cancellations
 *   2. Confirmation  (0-25)  — replied to confirmation SMS?
 *   3. Recency       (0-20)  — how recently lead was in contact
 *   4. Engagement    (0-15)  — visit count & loyalty tier
 *   5. Time-of-day   (0-10)  — day/time pattern risk
 */

import { eq, and, sql, gte, isNotNull } from "drizzle-orm";
import { leads, messages, calendarEvents } from "../../drizzle/schema";
import type { Db } from "../_core/context";
import { logger } from "../_core/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NoShowFactor {
  name: string;
  weight: number; // points contributed to score
  description: string;
}

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface NoShowPrediction {
  leadId: number;
  leadName: string | null;
  appointmentAt: Date;
  riskScore: number; // 0-100 (higher = more likely to no-show)
  riskLevel: RiskLevel;
  factors: NoShowFactor[];
  suggestedAction: string;
}

export interface NoShowRiskStats {
  totalUpcoming: number;
  riskDistribution: { low: number; medium: number; high: number; critical: number };
  avgRiskScore: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function suggestedActionForLevel(level: RiskLevel): string {
  switch (level) {
    case "critical":
      return "Send deposit request + extra reminder";
    case "high":
      return "Send extra reminder 4h before + confirmation chase";
    case "medium":
      return "Send standard 2h reminder";
    case "low":
      return "No extra action needed";
  }
}

// ─── Factor Calculators ───────────────────────────────────────────────────────

/**
 * Factor 1: History (0-30 points)
 * Each past cancelled calendar event for this lead adds 10 points, capped at 30.
 */
async function calcHistoryFactor(db: Db, tenantId: number, leadId: number): Promise<NoShowFactor> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.tenantId, tenantId),
        eq(calendarEvents.leadId, leadId),
        eq(calendarEvents.status, "cancelled"),
      ),
    );

  const pastNoShows = Number(row?.count ?? 0);
  const weight = Math.min(30, pastNoShows * 10);

  return {
    name: "history",
    weight,
    description:
      pastNoShows === 0
        ? "No previous no-shows or cancellations"
        : `${pastNoShows} previous no-show${pastNoShows > 1 ? "s" : ""}/cancellation${pastNoShows > 1 ? "s" : ""}`,
  };
}

/**
 * Factor 2: Confirmation status (0-25 points)
 * Check if the lead replied to a confirmation SMS with yes/confirm/confirmed
 * within 24h before the appointment. No reply = 25 points.
 */
async function calcConfirmationFactor(
  db: Db,
  tenantId: number,
  leadId: number,
  appointmentAt: Date,
): Promise<NoShowFactor> {
  const twentyFourHrsBefore = new Date(appointmentAt.getTime() - 24 * 60 * 60 * 1000);

  const confirmationReplies = await db
    .select({ body: messages.body })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.leadId, leadId),
        eq(messages.direction, "inbound"),
        gte(messages.createdAt, twentyFourHrsBefore),
      ),
    )
    .limit(20);

  const confirmed = confirmationReplies.some((msg) => {
    const lower = (msg.body ?? "").toLowerCase().trim();
    return (
      lower.includes("yes") ||
      lower.includes("confirm") ||
      lower.includes("confirmed") ||
      lower === "y" ||
      lower === "yep" ||
      lower === "yeah" ||
      lower === "sure"
    );
  });

  if (confirmed) {
    return { name: "confirmation", weight: 0, description: "Lead confirmed appointment via SMS" };
  }

  // Check if the appointment is still more than 24h away — not yet a concern
  const now = new Date();
  if (appointmentAt.getTime() - now.getTime() > 24 * 60 * 60 * 1000) {
    return {
      name: "confirmation",
      weight: 10,
      description: "Appointment more than 24h away — confirmation window not yet open",
    };
  }

  return {
    name: "confirmation",
    weight: 25,
    description: "No confirmation reply within 24h of appointment",
  };
}

/**
 * Factor 3: Recency (0-20 points)
 * No messages in 7+ days = 20.  Messages in last 3 days = 0.  Scale linearly between.
 */
async function calcRecencyFactor(db: Db, tenantId: number, leadId: number): Promise<NoShowFactor> {
  const [row] = await db
    .select({ latest: sql<Date | null>`MAX(${messages.createdAt})` })
    .from(messages)
    .where(and(eq(messages.tenantId, tenantId), eq(messages.leadId, leadId)));

  const latest = row?.latest ? new Date(row.latest) : null;

  if (!latest) {
    return { name: "recency", weight: 20, description: "No message history with this lead" };
  }

  const daysSince = (Date.now() - latest.getTime()) / (24 * 60 * 60 * 1000);

  if (daysSince <= 3) {
    return { name: "recency", weight: 0, description: "Recent contact within 3 days" };
  }
  if (daysSince >= 7) {
    return { name: "recency", weight: 20, description: `No messages in ${Math.round(daysSince)} days` };
  }

  // Linear scale: 3 days = 0 pts, 7 days = 20 pts
  const weight = Math.round(((daysSince - 3) / 4) * 20);
  return {
    name: "recency",
    weight,
    description: `Last message ${Math.round(daysSince)} days ago`,
  };
}

/**
 * Factor 4: Engagement tier (0-15 points)
 * New lead (visitCount=0) = 15.  Regular (5+ visits) = 0.  Scale between.
 */
async function calcEngagementFactor(db: Db, tenantId: number, leadId: number): Promise<NoShowFactor> {
  const [lead] = await db
    .select({ visitCount: leads.visitCount, loyaltyTier: leads.loyaltyTier })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .limit(1);

  const visits = Number(lead?.visitCount ?? 0);
  const tier = lead?.loyaltyTier ?? null;

  // Loyalty tier bonus: gold/platinum clients are lower risk
  if (tier === "platinum" || tier === "gold") {
    return { name: "engagement", weight: 0, description: `${tier} loyalty tier with ${visits} visits` };
  }

  if (visits >= 5) {
    return { name: "engagement", weight: 0, description: `Regular client with ${visits} visits` };
  }
  if (visits === 0) {
    return { name: "engagement", weight: 15, description: "New lead with no previous visits" };
  }

  // Linear scale: 0 visits = 15 pts, 5 visits = 0 pts
  const weight = Math.round(((5 - visits) / 5) * 15);
  return {
    name: "engagement",
    weight,
    description: `${visits} previous visit${visits > 1 ? "s" : ""}`,
  };
}

/**
 * Factor 5: Time-of-day pattern (0-10 points)
 * Friday PM = 10, Monday AM = 8, any afternoon = 5.
 */
function calcTimeFactor(appointmentAt: Date): NoShowFactor {
  const day = appointmentAt.getDay(); // 0=Sun, 1=Mon, ... 5=Fri
  const hour = appointmentAt.getHours();
  const isPM = hour >= 12;
  const isAM = hour < 12;

  // Friday afternoon — highest risk slot
  if (day === 5 && isPM) {
    return { name: "time_pattern", weight: 10, description: "Friday afternoon — highest no-show risk slot" };
  }
  // Monday morning
  if (day === 1 && isAM) {
    return { name: "time_pattern", weight: 8, description: "Monday morning — elevated no-show risk slot" };
  }
  // Any afternoon
  if (isPM) {
    return { name: "time_pattern", weight: 5, description: "Afternoon appointment — moderate risk slot" };
  }

  return { name: "time_pattern", weight: 0, description: "Low-risk time slot" };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Predict no-show risk for a single lead + appointment.
 */
export async function predictNoShow(
  db: Db,
  tenantId: number,
  leadId: number,
  appointmentAt: Date,
): Promise<NoShowPrediction> {
  // Fetch lead name for the response
  const [lead] = await db
    .select({ name: leads.name })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .limit(1);

  // Calculate all factors in parallel
  const [history, confirmation, recency, engagement] = await Promise.all([
    calcHistoryFactor(db, tenantId, leadId),
    calcConfirmationFactor(db, tenantId, leadId, appointmentAt),
    calcRecencyFactor(db, tenantId, leadId),
    calcEngagementFactor(db, tenantId, leadId),
  ]);

  const timeFactor = calcTimeFactor(appointmentAt);

  const factors = [history, confirmation, recency, engagement, timeFactor];
  const riskScore = Math.min(100, factors.reduce((sum, f) => sum + f.weight, 0));
  const riskLevel = riskLevelFromScore(riskScore);

  logger.debug("No-show prediction computed", { tenantId, leadId, riskScore, riskLevel });

  return {
    leadId,
    leadName: lead?.name ?? null,
    appointmentAt,
    riskScore,
    riskLevel,
    factors,
    suggestedAction: suggestedActionForLevel(riskLevel),
  };
}

/**
 * Get predictions for upcoming appointments above a risk threshold.
 */
export async function getUpcomingRiskyAppointments(
  db: Db,
  tenantId: number,
  opts?: { days?: number; minRisk?: number },
): Promise<NoShowPrediction[]> {
  const days = opts?.days ?? 7;
  const minRisk = opts?.minRisk ?? 0;

  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Find leads with upcoming appointments
  const upcomingLeads = await db
    .select({ id: leads.id, appointmentAt: leads.appointmentAt })
    .from(leads)
    .where(
      and(
        eq(leads.tenantId, tenantId),
        isNotNull(leads.appointmentAt),
        gte(leads.appointmentAt, now),
      ),
    )
    .limit(200);

  // Filter to those within the day window
  const inWindow = upcomingLeads.filter(
    (l) => l.appointmentAt && l.appointmentAt.getTime() <= cutoff.getTime(),
  );

  // Score each one
  const predictions = await Promise.all(
    inWindow.map((l) => predictNoShow(db, tenantId, l.id, l.appointmentAt!)),
  );

  return predictions
    .filter((p) => p.riskScore >= minRisk)
    .sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Aggregate risk stats for a tenant's upcoming appointments.
 */
export async function getNoShowRiskStats(db: Db, tenantId: number): Promise<NoShowRiskStats> {
  const predictions = await getUpcomingRiskyAppointments(db, tenantId, { days: 14, minRisk: 0 });

  const dist = { low: 0, medium: 0, high: 0, critical: 0 };
  let totalScore = 0;

  for (const p of predictions) {
    dist[p.riskLevel]++;
    totalScore += p.riskScore;
  }

  return {
    totalUpcoming: predictions.length,
    riskDistribution: dist,
    avgRiskScore: predictions.length > 0 ? Math.round(totalScore / predictions.length) : 0,
  };
}
