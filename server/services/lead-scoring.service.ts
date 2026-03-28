/**
 * Lead Scoring Service
 *
 * Auto-scores leads based on engagement signals:
 *   - Response rate to outbound messages
 *   - Booking frequency
 *   - Recency of last interaction
 *   - Message volume
 *
 * Score: 0-100, bucketed as: cold (0-25), warm (26-50), hot (51-75), vip (76-100)
 */

import { eq, and, sql, gte, desc } from "drizzle-orm";
import { leads, messages } from "../../drizzle/schema";
import type { Db } from "../_core/context";

export type LeadTier = "cold" | "warm" | "hot" | "vip";

export interface LeadScore {
  leadId: number;
  score: number;
  tier: LeadTier;
  signals: {
    responseRate: number;
    bookingCount: number;
    daysSinceLastMessage: number;
    totalMessages: number;
  };
}

function tierFromScore(score: number): LeadTier {
  if (score >= 76) return "vip";
  if (score >= 51) return "hot";
  if (score >= 26) return "warm";
  return "cold";
}

/**
 * Calculate engagement score for a single lead.
 */
export async function scoreLead(db: Db, tenantId: number, leadId: number): Promise<LeadScore> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Get message stats for this lead
  const [stats] = await db
    .select({
      totalMessages: sql<number>`COUNT(*)`,
      inboundCount: sql<number>`SUM(CASE WHEN ${messages.direction} = 'inbound' THEN 1 ELSE 0 END)`,
      outboundCount: sql<number>`SUM(CASE WHEN ${messages.direction} = 'outbound' THEN 1 ELSE 0 END)`,
      lastMessageAt: sql<Date>`MAX(${messages.createdAt})`,
    })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.leadId, leadId),
      )
    );

  // Get lead status info
  const [lead] = await db
    .select({
      status: leads.status,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .limit(1);

  const totalMessages = Number(stats?.totalMessages ?? 0);
  const inbound = Number(stats?.inboundCount ?? 0);
  const outbound = Number(stats?.outboundCount ?? 0);
  const lastMessageAt = stats?.lastMessageAt ? new Date(stats.lastMessageAt) : null;
  const daysSinceLastMessage = lastMessageAt
    ? Math.floor((Date.now() - lastMessageAt.getTime()) / (24 * 60 * 60 * 1000))
    : 999;

  // Calculate sub-scores (each 0-25, total 0-100)
  const responseRate = outbound > 0 ? (inbound / outbound) * 100 : 0;
  const responseScore = Math.min(25, Math.round(responseRate / 4));

  // Booking signal (booked status = strong signal)
  const bookingCount = lead?.status === "booked" ? 1 : 0;
  const bookingScore = bookingCount > 0 ? 25 : lead?.status === "qualified" ? 15 : lead?.status === "contacted" ? 10 : 0;

  // Recency score (more recent = higher)
  let recencyScore = 0;
  if (daysSinceLastMessage <= 1) recencyScore = 25;
  else if (daysSinceLastMessage <= 7) recencyScore = 20;
  else if (daysSinceLastMessage <= 14) recencyScore = 15;
  else if (daysSinceLastMessage <= 30) recencyScore = 10;
  else if (daysSinceLastMessage <= 60) recencyScore = 5;

  // Volume score
  const volumeScore = Math.min(25, totalMessages * 3);

  const score = Math.min(100, responseScore + bookingScore + recencyScore + volumeScore);

  return {
    leadId,
    score,
    tier: tierFromScore(score),
    signals: {
      responseRate: Math.round(responseRate),
      bookingCount,
      daysSinceLastMessage,
      totalMessages,
    },
  };
}

/**
 * Score all leads for a tenant and return sorted by score (highest first).
 */
export async function scoreAllLeads(
  db: Db,
  tenantId: number,
  opts?: { limit?: number; minScore?: number }
): Promise<LeadScore[]> {
  const limit = opts?.limit ?? 100;
  const minScore = opts?.minScore ?? 0;

  // Get all lead IDs for tenant
  const leadRows = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.tenantId, tenantId))
    .limit(limit * 2); // Fetch more to filter

  const scores = await Promise.all(
    leadRows.map((l) => scoreLead(db, tenantId, l.id))
  );

  return scores
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
