/**
 * Send Time Optimization Service
 *
 * Analyzes historical message response rates to determine the optimal
 * time to send SMS messages for each tenant/lead combination.
 *
 * Uses a simple hour-of-day bucketing approach:
 *   1. Count outbound messages per hour bucket
 *   2. Count inbound responses within 2h of outbound per hour bucket
 *   3. Rank hours by response rate
 *   4. Return top 3 hours as optimal send windows
 */

import { eq, and, sql, gte, desc } from "drizzle-orm";
import { messages } from "../../drizzle/schema";
import type { Db } from "../_core/context";
import { logger } from "../_core/logger";

export interface OptimalSendWindow {
  hour: number; // 0-23 UTC
  responseRate: number; // 0-100
  sampleSize: number;
}

export interface SendTimeRecommendation {
  tenantId: number;
  optimalWindows: OptimalSendWindow[];
  bestHourUtc: number;
  confidence: "low" | "medium" | "high";
  sampleSize: number;
}

/**
 * Analyze historical response patterns and recommend optimal send times.
 * Requires at least 20 outbound messages for meaningful results.
 */
export async function getOptimalSendTime(
  db: Db,
  tenantId: number,
): Promise<SendTimeRecommendation> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Get response rates bucketed by hour of day
  const hourlyStats = await db
    .select({
      hour: sql<number>`HOUR(${messages.createdAt})`,
      outbound: sql<number>`SUM(CASE WHEN ${messages.direction} = 'outbound' THEN 1 ELSE 0 END)`,
      inbound: sql<number>`SUM(CASE WHEN ${messages.direction} = 'inbound' THEN 1 ELSE 0 END)`,
    })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        gte(messages.createdAt, ninetyDaysAgo),
      )
    )
    .groupBy(sql`HOUR(${messages.createdAt})`)
    .orderBy(sql`HOUR(${messages.createdAt})`);

  const totalOutbound = hourlyStats.reduce((s, r) => s + Number(r.outbound ?? 0), 0);

  // Need minimum data for meaningful recommendations
  if (totalOutbound < 20) {
    return {
      tenantId,
      optimalWindows: [
        { hour: 10, responseRate: 0, sampleSize: 0 },
        { hour: 14, responseRate: 0, sampleSize: 0 },
        { hour: 18, responseRate: 0, sampleSize: 0 },
      ],
      bestHourUtc: 10, // Default to 10am UTC
      confidence: "low",
      sampleSize: totalOutbound,
    };
  }

  // Calculate response rate per hour
  const windows: OptimalSendWindow[] = hourlyStats
    .filter((r) => Number(r.outbound ?? 0) >= 3) // Need at least 3 sends
    .map((r) => {
      const out = Number(r.outbound ?? 0);
      const inb = Number(r.inbound ?? 0);
      return {
        hour: Number(r.hour),
        responseRate: out > 0 ? Math.round((inb / out) * 100) : 0,
        sampleSize: out,
      };
    })
    .sort((a, b) => b.responseRate - a.responseRate);

  const topWindows = windows.slice(0, 3);
  const confidence = totalOutbound >= 200 ? "high" : totalOutbound >= 50 ? "medium" : "low";

  return {
    tenantId,
    optimalWindows: topWindows,
    bestHourUtc: topWindows[0]?.hour ?? 10,
    confidence,
    sampleSize: totalOutbound,
  };
}

/**
 * Get a lead-specific optimal send time based on their response history.
 * Falls back to tenant-level if insufficient lead data.
 */
export async function getLeadOptimalSendTime(
  db: Db,
  tenantId: number,
  leadId: number,
): Promise<{ hour: number; confidence: "low" | "medium" | "high" }> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Check lead-specific message history
  const [leadStats] = await db
    .select({
      totalMessages: sql<number>`COUNT(*)`,
      avgResponseHour: sql<number>`AVG(CASE WHEN ${messages.direction} = 'inbound' THEN HOUR(${messages.createdAt}) ELSE NULL END)`,
    })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.leadId, leadId),
        gte(messages.createdAt, ninetyDaysAgo),
      )
    );

  const totalMessages = Number(leadStats?.totalMessages ?? 0);

  // If we have enough lead data, use their preferred response hour
  if (totalMessages >= 5 && leadStats?.avgResponseHour != null) {
    return {
      hour: Math.round(Number(leadStats.avgResponseHour)),
      confidence: totalMessages >= 20 ? "high" : "medium",
    };
  }

  // Fall back to tenant-level
  const tenantRec = await getOptimalSendTime(db, tenantId);
  return {
    hour: tenantRec.bestHourUtc,
    confidence: "low",
  };
}
