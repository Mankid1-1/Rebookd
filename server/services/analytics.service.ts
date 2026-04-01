import { eq, and, sql, desc, isNotNull, gt, lt, isNull, gte, lte } from "drizzle-orm";
import { leads, messages, automations, recoveryEvents } from "../../drizzle/schema";

import type { Db } from "../_core/context";
import { withQueryTimeout } from "./query.service";

export async function getDashboardMetrics(db: Db, tenantId: number) {
  const [leadCount, messageCount, automationCount, bookedCount] = await withQueryTimeout("analytics.dashboardMetrics", Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(leads).where(eq(leads.tenantId, tenantId)),
    db.select({ count: sql<number>`count(*)` }).from(messages).where(eq(messages.tenantId, tenantId)),
    db.select({ count: sql<number>`count(*)` }).from(automations).where(and(eq(automations.tenantId, tenantId), eq(automations.enabled, true), isNull(automations.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tenantId), eq(leads.status, "booked"))),
  ]));

  return {
    leadCount: Number(leadCount[0]?.count ?? 0),
    messageCount: Number(messageCount[0]?.count ?? 0),
    automationCount: Number(automationCount[0]?.count ?? 0),
    bookedCount: Number(bookedCount[0]?.count ?? 0),
  };
}

export async function getRevenueRecoveryMetrics(db: Db, tenantId: number) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Revenue recovery calculations
  const [
    totalLeads,
    bookedLeads,
    avgRevenuePerBooking,
    recentBookings,
    recoveredLeads,
    lostLeads,
    qualifiedLeads,
    contactedLeads
  ] = await withQueryTimeout("analytics.revenueRecovery", Promise.all([
    // Total leads in system
    db.select({ count: sql<number>`count(*)` }).from(leads).where(eq(leads.tenantId, tenantId)),
    
    // Booked leads (converted revenue)
    db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tenantId), eq(leads.status, "booked"))),
    
    // Real revenue from recovery events (not estimated)
    db.select({ avgRevenue: sql<number>`COALESCE(SUM(${recoveryEvents.realizedRevenue}), 0)` }).from(recoveryEvents).where(eq(recoveryEvents.tenantId, tenantId)),
    
    // Recent bookings (last 30 days)
    db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tenantId), eq(leads.status, "booked"), gte(leads.createdAt, thirtyDaysAgo))),
    
    // Recovered leads (new -> booked)
    db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tenantId), eq(leads.status, "booked"), isNotNull(leads.updatedAt), gte(leads.updatedAt, thirtyDaysAgo))),
    
    // Lost leads (lost revenue)
    db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tenantId), eq(leads.status, "lost"))),
    
    // Qualified leads (potential revenue)
    db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tenantId), eq(leads.status, "qualified"))),
    
    // Contacted leads (in pipeline)
    db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tenantId), eq(leads.status, "contacted")))
  ]));

  const totalLeadsCount = Number(totalLeads[0]?.count ?? 0);
  const bookedLeadsCount = Number(bookedLeads[0]?.count ?? 0);
  const totalRealRevenue = Number(avgRevenuePerBooking[0]?.avgRevenue ?? 0); // This is now SUM(realizedRevenue), not an average
  const recentBookingsCount = Number(recentBookings[0]?.count ?? 0);
  const recoveredLeadsCount = Number(recoveredLeads[0]?.count ?? 0);
  const lostLeadsCount = Number(lostLeads[0]?.count ?? 0);
  const qualifiedLeadsCount = Number(qualifiedLeads[0]?.count ?? 0);
  const contactedLeadsCount = Number(contactedLeads[0]?.count ?? 0);

  // Revenue from real recovery event data — no hardcoded multipliers
  const totalRecoveredRevenue = totalRealRevenue;
  const recentRecoveredRevenue = totalRealRevenue;

  // Potential revenue: recovery events in active outreach (sent/responded)
  // Lost revenue: recovery events that failed or expired
  // Pipeline revenue: converted but not yet realized
  let potentialRevenue = 0;
  let lostRevenue = 0;
  let pipelineRevenue = 0;
  try {
    const [potentialRow, lostRow, pipelineRow] = await Promise.all([
      db.select({ total: sql<number>`COALESCE(SUM(${recoveryEvents.estimatedRevenue}), 0)` })
        .from(recoveryEvents)
        .where(and(eq(recoveryEvents.tenantId, tenantId),
          sql`${recoveryEvents.status} IN ('sent', 'responded')`)),
      db.select({ total: sql<number>`COALESCE(SUM(${recoveryEvents.estimatedRevenue}), 0)` })
        .from(recoveryEvents)
        .where(and(eq(recoveryEvents.tenantId, tenantId),
          sql`${recoveryEvents.status} IN ('failed', 'expired')`)),
      db.select({ total: sql<number>`COALESCE(SUM(${recoveryEvents.estimatedRevenue}), 0)` })
        .from(recoveryEvents)
        .where(and(eq(recoveryEvents.tenantId, tenantId),
          eq(recoveryEvents.status, 'converted'))),
    ]);
    potentialRevenue = Number(potentialRow[0]?.total ?? 0);
    lostRevenue = Number(lostRow[0]?.total ?? 0);
    pipelineRevenue = Number(pipelineRow[0]?.total ?? 0);
  } catch {
    // recovery_events table may not have data yet — fall back to 0
  }

  // Calculate recovery rates
  const overallRecoveryRate = totalLeadsCount > 0 ? (bookedLeadsCount / totalLeadsCount) * 100 : 0;
  const recentRecoveryRate = recentBookingsCount > 0 ? (recoveredLeadsCount / recentBookingsCount) * 100 : 0;

  return {
    totalRecoveredRevenue,
    recentRecoveredRevenue,
    potentialRevenue,
    lostRevenue,
    pipelineRevenue,
    overallRecoveryRate,
    recentRecoveryRate,
    avgRevenuePerBooking: bookedLeadsCount > 0 ? Math.round(totalRealRevenue / bookedLeadsCount) : 0,
    totalLeadsCount,
    bookedLeadsCount,
    qualifiedLeadsCount,
    contactedLeadsCount,
    lostLeadsCount,
    recentBookingsCount,
    recoveredLeadsCount
  };
}

export async function getRevenueTrends(db: Db, tenantId: number, days = 90) {
  const boundedDays = Math.min(Math.max(days, 1), 365);
  const since = new Date(Date.now() - boundedDays * 24 * 60 * 60 * 1000);

  // Fetch lead trends
  const revenueData = await withQueryTimeout("analytics.revenueTrends", db
    .select({
      date: sql<string>`DATE(${leads.createdAt})`,
      bookings: sql<number>`SUM(CASE WHEN ${leads.status} = 'booked' THEN 1 ELSE 0 END)`,
      totalLeads: sql<number>`COUNT(*)`,
    })
    .from(leads)
    .where(and(eq(leads.tenantId, tenantId), gte(leads.createdAt, since)))
    .groupBy(sql`DATE(${leads.createdAt})`)
    .orderBy(sql`DATE(${leads.createdAt})`));

  // Fetch real daily revenue from recovery_events (realized revenue per day)
  let revenueMap = new Map<string, number>();
  try {
    const revenueByDay = await withQueryTimeout("analytics.revenueByDay", db
      .select({
        date: sql<string>`DATE(${recoveryEvents.realizedAt})`,
        revenue: sql<number>`SUM(${recoveryEvents.realizedRevenue})`,
      })
      .from(recoveryEvents)
      .where(and(
        eq(recoveryEvents.tenantId, tenantId),
        gte(recoveryEvents.realizedAt, since),
        sql`${recoveryEvents.status} IN ('realized', 'manual_realized')`
      ))
      .groupBy(sql`DATE(${recoveryEvents.realizedAt})`));
    revenueMap = new Map(revenueByDay.map((r: any) => [r.date, Number(r.revenue)]));
  } catch {
    // recovery_events may not have data yet — revenue stays at 0
  }

  return revenueData.map((row: any) => ({
    date: row.date,
    bookings: Number(row.bookings),
    revenue: revenueMap.get(row.date) ?? 0,
    totalLeads: Number(row.totalLeads),
    recoveryRate: Number(row.totalLeads) > 0 ? (Number(row.bookings) / Number(row.totalLeads)) * 100 : 0
  }));
}

export async function getLeadStatusBreakdown(db: Db, tenantId: number) {
  const result = await withQueryTimeout("analytics.statusBreakdown", db
    .select({ status: leads.status, count: sql<number>`count(*)` })
    .from(leads)
    .where(eq(leads.tenantId, tenantId))
    .groupBy(leads.status));
  return result.map((r: any) => ({ status: r.status, count: Number(r.count) }));
}

export async function getMessageVolume(db: Db, tenantId: number, days = 30) {
  const boundedDays = Math.min(Math.max(days, 1), 90);
  const since = new Date(Date.now() - boundedDays * 24 * 60 * 60 * 1000);
  return withQueryTimeout("analytics.messageVolume", db
    .select({
      date: sql<string>`DATE(createdAt)`,
      count: sql<number>`count(*)`,
      direction: messages.direction,
    })
    .from(messages)
    .where(and(eq(messages.tenantId, tenantId), sql`createdAt >= ${since}`))
    .groupBy(sql`DATE(createdAt)`, messages.direction)
    .orderBy(sql`DATE(createdAt)`));
}

export async function getLeakageMetrics(db: Db, tenantId: number) {
  const [unconfirmed, qualifiedUnbooked, cancellations, failedMessages] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tenantId), eq(leads.status, "booked"), isNotNull(leads.appointmentAt), gt(leads.appointmentAt, new Date()), lt(leads.appointmentAt, new Date(Date.now() + 48 * 60 * 60 * 1000)))),
    db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tenantId), eq(leads.status, "qualified"), sql`${leads.appointmentAt} IS NULL`)),
    db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tenantId), sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'cancelled') IS NOT NULL`, sql`${leads.status} <> 'booked'`)),
    db.select({ count: sql<number>`count(distinct ${messages.leadId})` }).from(messages).where(and(eq(messages.tenantId, tenantId), eq(messages.direction, "outbound"), eq(messages.status, "failed"), gt(messages.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))),
  ]);

  return {
    unconfirmedAppointments: Number(unconfirmed[0]?.count ?? 0),
    qualifiedUnbooked: Number(qualifiedUnbooked[0]?.count ?? 0),
    cancellationsUnrecovered: Number(cancellations[0]?.count ?? 0),
    failedDeliveryRecovery: Number(failedMessages[0]?.count ?? 0),
  };
}
