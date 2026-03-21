import { eq, and, sql, desc, isNotNull, gt, lt, isNull, gte, lte, or, between } from "drizzle-orm";
import { leads, messages, automations } from "../../drizzle/schema";

import type { Db } from "../_core/context";
import { withQueryTimeout } from "./query.service";

export interface LeakageDetection {
  id: string;
  type: "no_show" | "cancellation" | "last_minute" | "double_booking" | "underbooking" | "followup_missed";
  severity: "low" | "medium" | "high" | "critical";
  estimatedRevenue: number;
  recoveryProbability: number;
  description: string;
  affectedLeads: number;
  timeWindow: string;
  recoveryActions: string[];
}

export interface RevenueLeakageReport {
  totalLeakage: number;
  recoverableRevenue: number;
  leakageByType: Record<string, number>;
  leakageByMonth: Array<{ month: string; leakage: number; recovered: number }>;
  topLeakageSources: LeakageDetection[];
  recoveryOpportunities: Array<{
    leadId: number;
    leadName: string;
    leadPhone: string;
    leakageType: string;
    estimatedRevenue: number;
    recoveryActions: string[];
    lastActivity: Date;
  }>;
  recommendations: Array<{
    category: "process" | "automation" | "staffing" | "technology";
    priority: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    expectedImpact: number;
    implementationEffort: "low" | "medium" | "high";
  }>;
}

export async function detectRevenueLeakage(db: Db, tenantId: number, days = 90): Promise<RevenueLeakageReport> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Detect various types of revenue leakage
  const [
    noShows,
    cancellations,
    lastMinuteCancellations,
    doubleBookings,
    underbookedSlots,
    missedFollowups,
    abandonedLeads,
    expiredLeads
  ] = await withQueryTimeout("revenue-leakage.detection", Promise.all([
    // No-shows (booked appointments that were missed)
    detectNoShows(db, tenantId, thirtyDaysAgo),
    
    // Cancellations (revenue lost to cancellations)
    detectCancellations(db, tenantId, thirtyDaysAgo),
    
    // Last-minute cancellations (high impact)
    detectLastMinuteCancellations(db, tenantId, thirtyDaysAgo),
    
    // Double bookings (missed opportunities)
    detectDoubleBookings(db, tenantId, thirtyDaysAgo),
    
    // Underbooked time slots
    detectUnderbookedSlots(db, tenantId, thirtyDaysAgo),
    
    // Missed follow-ups
    detectMissedFollowups(db, tenantId, thirtyDaysAgo),
    
    // Abandoned leads (qualified but never booked)
    detectAbandonedLeads(db, tenantId, ninetyDaysAgo),
    
    // Expired leads (old leads never converted)
    detectExpiredLeads(db, tenantId, ninetyDaysAgo)
  ]));

  // Calculate total leakage
  const totalLeakage = noShows.estimatedRevenue + cancellations.estimatedRevenue + 
                       lastMinuteCancellations.estimatedRevenue + doubleBookings.estimatedRevenue +
                       underbookedSlots.estimatedRevenue + missedFollowups.estimatedRevenue +
                       abandonedLeads.estimatedRevenue + expiredLeads.estimatedRevenue;

  // Calculate recoverable revenue (based on recovery probability)
  const recoverableRevenue = noShows.estimatedRevenue * noShows.recoveryProbability +
                            cancellations.estimatedRevenue * cancellations.recoveryProbability +
                            lastMinuteCancellations.estimatedRevenue * lastMinuteCancellations.recoveryProbability +
                            doubleBookings.estimatedRevenue * doubleBookings.recoveryProbability +
                            underbookedSlots.estimatedRevenue * underbookedSlots.recoveryProbability +
                            missedFollowups.estimatedRevenue * missedFollowups.recoveryProbability +
                            abandonedLeads.estimatedRevenue * abandonedLeads.recoveryProbability +
                            expiredLeads.estimatedRevenue * expiredLeads.recoveryProbability;

  // Get recovery opportunities
  const recoveryOpportunities = await getRecoveryOpportunities(db, tenantId, thirtyDaysAgo);

  // Generate recommendations
  const recommendations = generateRecommendations([
    noShows, cancellations, lastMinuteCancellations, doubleBookings,
    underbookedSlots, missedFollowups, abandonedLeads, expiredLeads
  ]);

  // Get monthly leakage trends
  const leakageByMonth = await getLeakageByMonth(db, tenantId, days);

  return {
    totalLeakage,
    recoverableRevenue,
    leakageByType: {
      noShows: noShows.estimatedRevenue,
      cancellations: cancellations.estimatedRevenue,
      lastMinuteCancellations: lastMinuteCancellations.estimatedRevenue,
      doubleBookings: doubleBookings.estimatedRevenue,
      underbookedSlots: underbookedSlots.estimatedRevenue,
      missedFollowups: missedFollowups.estimatedRevenue,
      abandonedLeads: abandonedLeads.estimatedRevenue,
      expiredLeads: expiredLeads.estimatedRevenue
    },
    leakageByMonth,
    topLeakageSources: [
      noShows, cancellations, lastMinuteCancellations, doubleBookings,
      underbookedSlots, missedFollowups, abandonedLeads, expiredLeads
    ].sort((a, b) => b.estimatedRevenue - a.estimatedRevenue).slice(0, 5),
    recoveryOpportunities,
    recommendations
  };
}

async function detectNoShows(db: Db, tenantId: number, since: Date): Promise<LeakageDetection> {
  // Find leads that were booked but had no-show appointments
  const result = await withQueryTimeout("leakage.no-shows", db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(leads)
    .where(and(
      eq(leads.tenantId, tenantId),
      eq(leads.status, "booked"),
      isNotNull(leads.appointmentAt),
      lt(leads.appointmentAt, new Date()), // Appointment was in the past
      gte(leads.appointmentAt, since), // But within our time window
      sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'no_show') IS NOT NULL`
    )));

  const count = Number(result[0]?.count ?? 0);
  const avgRevenue = 250; // Default average revenue per appointment
  const estimatedRevenue = count * avgRevenue;

  return {
    id: "no-shows",
    type: "no_show",
    severity: count > 10 ? "high" : count > 5 ? "medium" : "low",
    estimatedRevenue,
    recoveryProbability: 0.65, // 65% of no-shows can be recovered
    description: `${count} no-show appointments costing $${estimatedRevenue.toLocaleString()}`,
    affectedLeads: count,
    timeWindow: "Last 30 days",
    recoveryActions: [
      "Send automated re-scheduling SMS",
      "Offer discount for re-booking",
      "Implement reminder system",
      "Call to re-schedule"
    ]
  };
}

async function detectCancellations(db: Db, tenantId: number, since: Date): Promise<LeakageDetection> {
  // Find cancelled appointments
  const result = await withQueryTimeout("leakage.cancellations", db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(leads)
    .where(and(
      eq(leads.tenantId, tenantId),
      sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'cancelled') IS NOT NULL`,
      gte(leads.updatedAt, since)
    )));

  const count = Number(result[0]?.count ?? 0);
  const avgRevenue = 250; // Default average revenue per appointment
  const estimatedRevenue = count * avgRevenue;

  return {
    id: "cancellations",
    type: "cancellation",
    severity: count > 15 ? "high" : count > 8 ? "medium" : "low",
    estimatedRevenue,
    recoveryProbability: 0.45, // 45% of cancellations can be recovered
    description: `${count} cancelled appointments costing $${estimatedRevenue.toLocaleString()}`,
    affectedLeads: count,
    timeWindow: "Last 30 days",
    recoveryActions: [
      "Send cancellation follow-up survey",
      "Offer alternative time slots",
      "Address cancellation reasons",
      "Implement retention strategy"
    ]
  };
}

async function detectLastMinuteCancellations(db: Db, tenantId: number, since: Date): Promise<LeakageDetection> {
  // Find cancellations within 24 hours of appointment
  const result = await withQueryTimeout("leakage.last-minute-cancellations", db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(leads)
    .where(and(
      eq(leads.tenantId, tenantId),
      sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'cancelled') IS NOT NULL`,
      sql`${leads.appointmentAt} IS NOT NULL`,
      sql`TIMESTAMPDIFF(HOUR, ${leads.updatedAt}, ${leads.appointmentAt}) <= 24`,
      gte(leads.updatedAt, since)
    )));

  const count = Number(result[0]?.count ?? 0);
  const avgRevenue = 300; // Higher value for last-minute
  const estimatedRevenue = count * avgRevenue;

  return {
    id: "last-minute-cancellations",
    type: "last_minute",
    severity: count > 5 ? "critical" : count > 2 ? "high" : "medium",
    estimatedRevenue,
    recoveryProbability: 0.25, // Harder to recover last-minute cancellations
    description: `${count} last-minute cancellations costing $${estimatedRevenue.toLocaleString()}`,
    affectedLeads: count,
    timeWindow: "Last 30 days",
    recoveryActions: [
      "Implement cancellation penalty policy",
      "Waitlist management system",
      "Overbooking strategy",
      "Last-minute booking promotions"
    ]
  };
}

async function detectDoubleBookings(db: Db, tenantId: number, since: Date): Promise<LeakageDetection> {
  // Find potential double bookings (same time slot for multiple leads)
  const result = await withQueryTimeout("leakage.double-bookings", db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(leads)
    .where(and(
      eq(leads.tenantId, tenantId),
      eq(leads.status, "booked"),
      isNotNull(leads.appointmentAt),
      gte(leads.appointmentAt, since),
      sql`${leads.appointmentAt} IN (
        SELECT appointmentAt 
        FROM leads l2 
        WHERE l2.tenantId = ${tenantId} 
        AND l2.status = 'booked' 
        AND l2.appointmentAt IS NOT NULL
        AND l2.appointmentAt >= ${since}
        GROUP BY appointmentAt 
        HAVING COUNT(*) > 1
      )`
    )));

  const count = Number(result[0]?.count ?? 0);
  const avgRevenue = 250; // Default average revenue per appointment
  const estimatedRevenue = count * avgRevenue * 0.5; // Assume 50% of double bookings result in lost revenue

  return {
    id: "double-bookings",
    type: "double_booking",
    severity: count > 10 ? "high" : count > 5 ? "medium" : "low",
    estimatedRevenue,
    recoveryProbability: 0.80, // High recovery potential with better scheduling
    description: `${count} potential double bookings costing $${estimatedRevenue.toLocaleString()}`,
    affectedLeads: count,
    timeWindow: "Last 30 days",
    recoveryActions: [
      "Implement calendar integration",
      "Real-time availability checking",
      "Automated conflict detection",
      "Staff scheduling optimization"
    ]
  };
}

async function detectUnderbookedSlots(db: Db, tenantId: number, since: Date): Promise<LeakageDetection> {
  // This is a simplified calculation - in reality would need calendar/schedule data
  const totalBookings = await withQueryTimeout("leakage.total-bookings", db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(and(
      eq(leads.tenantId, tenantId),
      eq(leads.status, "booked"),
      gte(leads.appointmentAt, since)
    )));

  const totalBookingsCount = Number(totalBookings[0]?.count ?? 0);
  const expectedCapacity = 30; // Assume 30 bookings per day as full capacity
  const actualCapacity = totalBookingsCount / 30; // Actual utilization
  const underbookedSlots = Math.max(0, (1 - actualCapacity) * expectedCapacity);
  const estimatedRevenue = underbookedSlots * 250; // Average revenue per slot

  return {
    id: "underbooked-slots",
    type: "underbooking",
    severity: underbookedSlots > 20 ? "high" : underbookedSlots > 10 ? "medium" : "low",
    estimatedRevenue,
    recoveryProbability: 0.70, // Good recovery potential with marketing
    description: `${Math.round(underbookedSlots)} underbooked time slots costing $${estimatedRevenue.toLocaleString()}`,
    affectedLeads: Math.round(underbookedSlots),
    timeWindow: "Last 30 days",
    recoveryActions: [
      "Launch last-minute booking campaigns",
      "Implement waitlist system",
      "Dynamic pricing for off-peak times",
      "Targeted marketing for slow periods"
    ]
  };
}

async function detectMissedFollowups(db: Db, tenantId: number, since: Date): Promise<LeakageDetection> {
  // Find qualified leads that haven't been followed up with
  const result = await withQueryTimeout("leakage.missed-followups", db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(leads)
    .where(and(
      eq(leads.tenantId, tenantId),
      eq(leads.status, "qualified"),
      sql`${leads.lastMessageAt} IS NULL OR ${leads.lastMessageAt} < DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      sql`${leads.createdAt} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    )));

  const count = Number(result[0]?.count ?? 0);
  const avgRevenue = 200; // Average revenue for qualified leads
  const estimatedRevenue = count * avgRevenue * 0.6; // 60% conversion rate for qualified leads

  return {
    id: "missed-followups",
    type: "followup_missed",
    severity: count > 20 ? "high" : count > 10 ? "medium" : "low",
    estimatedRevenue,
    recoveryProbability: 0.85, // Very high recovery potential
    description: `${count} qualified leads without follow-up costing $${estimatedRevenue.toLocaleString()}`,
    affectedLeads: count,
    timeWindow: "Last 30 days",
    recoveryActions: [
      "Automated follow-up sequences",
      "Lead scoring prioritization",
      "Staff reminder system",
      "CRM integration for tracking"
    ]
  };
}

async function detectAbandonedLeads(db: Db, tenantId: number, since: Date): Promise<LeakageDetection> {
  // Find leads that were contacted but never became qualified
  const result = await withQueryTimeout("leakage.abandoned-leads", db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(leads)
    .where(and(
      eq(leads.tenantId, tenantId),
      eq(leads.status, "contacted"),
      sql`${leads.lastMessageAt} < DATE_SUB(NOW(), INTERVAL 14 DAY)`,
      gte(leads.createdAt, since)
    )));

  const count = Number(result[0]?.count ?? 0);
  const avgRevenue = 150; // Average revenue for contacted leads
  const estimatedRevenue = count * avgRevenue * 0.3; // 30% conversion rate for abandoned leads

  return {
    id: "abandoned-leads",
    type: "followup_missed",
    severity: count > 25 ? "high" : count > 15 ? "medium" : "low",
    estimatedRevenue,
    recoveryProbability: 0.60, // Moderate recovery potential
    description: `${count} abandoned contacted leads costing $${estimatedRevenue.toLocaleString()}`,
    affectedLeads: count,
    timeWindow: "Last 90 days",
    recoveryActions: [
      "Re-engagement campaigns",
      "Special offers for abandoned leads",
      "Lead nurturing sequences",
      "Exit interview surveys"
    ]
  };
}

async function detectExpiredLeads(db: Db, tenantId: number, since: Date): Promise<LeakageDetection> {
  // Find very old leads that never converted
  const result = await withQueryTimeout("leakage.expired-leads", db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(leads)
    .where(and(
      eq(leads.tenantId, tenantId),
      or(eq(leads.status, "new"), eq(leads.status, "contacted")),
      lt(leads.createdAt, since),
      sql`${leads.lastMessageAt} IS NULL OR ${leads.lastMessageAt} < DATE_SUB(NOW(), INTERVAL 60 DAY)`
    )));

  const count = Number(result[0]?.count ?? 0);
  const avgRevenue = 100; // Very low value for expired leads
  const estimatedRevenue = count * avgRevenue * 0.1; // Very low conversion rate for expired leads

  return {
    id: "expired-leads",
    type: "followup_missed",
    severity: count > 50 ? "medium" : "low",
    estimatedRevenue,
    recoveryProbability: 0.15, // Very low recovery potential
    description: `${count} expired leads costing $${estimatedRevenue.toLocaleString()}`,
    affectedLeads: count,
    timeWindow: "Last 90 days",
    recoveryActions: [
      "Lead list cleaning",
      "Final re-engagement attempt",
      "Archive and focus on new leads",
      "Analyze lead source quality"
    ]
  };
}

async function getTargetLeadsForRecovery(db: Db, tenantId: number, leakageType: string) {
  // Filter based on leakage type
  switch (leakageType) {
    case "no_show":
      return await withQueryTimeout("recovery.target-leads", db
        .select({
          id: leads.id,
          name: leads.name,
          phone: leads.phone,
          status: leads.status,
          appointmentAt: leads.appointmentAt,
          lastMessageAt: leads.lastMessageAt,
          tags: leads.tags,
          createdAt: leads.createdAt,
          updatedAt: leads.updatedAt
        })
        .from(leads)
        .where(and(
          eq(leads.tenantId, tenantId),
          eq(leads.status, "booked"),
          isNotNull(leads.appointmentAt),
          lt(leads.appointmentAt, new Date()),
          sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'no_show') IS NOT NULL`,
          gte(leads.appointmentAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
        )));

    case "cancellation":
      return await withQueryTimeout("recovery.target-leads", db
        .select({
          id: leads.id,
          name: leads.name,
          phone: leads.phone,
          status: leads.status,
          appointmentAt: leads.appointmentAt,
          lastMessageAt: leads.lastMessageAt,
          tags: leads.tags,
          createdAt: leads.createdAt,
          updatedAt: leads.updatedAt
        })
        .from(leads)
        .where(and(
          eq(leads.tenantId, tenantId),
          sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'cancelled') IS NOT NULL`,
          gte(leads.updatedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )));

    case "last_minute":
      return await withQueryTimeout("recovery.target-leads", db
        .select({
          id: leads.id,
          name: leads.name,
          phone: leads.phone,
          status: leads.status,
          appointmentAt: leads.appointmentAt,
          lastMessageAt: leads.lastMessageAt,
          tags: leads.tags,
          createdAt: leads.createdAt,
          updatedAt: leads.updatedAt
        })
        .from(leads)
        .where(and(
          eq(leads.tenantId, tenantId),
          sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'cancelled') IS NOT NULL`,
          sql`${leads.appointmentAt} IS NOT NULL`,
          sql`TIMESTAMPDIFF(HOUR, ${leads.updatedAt}, ${leads.appointmentAt}) <= 24`,
          gte(leads.updatedAt, new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) // Last 3 days
        )));

    case "followup_missed":
      return await withQueryTimeout("recovery.target-leads", db
        .select({
          id: leads.id,
          name: leads.name,
          phone: leads.phone,
          status: leads.status,
          appointmentAt: leads.appointmentAt,
          lastMessageAt: leads.lastMessageAt,
          tags: leads.tags,
          createdAt: leads.createdAt,
          updatedAt: leads.updatedAt
        })
        .from(leads)
        .where(and(
          eq(leads.tenantId, tenantId),
          eq(leads.status, "qualified"),
          sql`${leads.lastMessageAt} IS NULL OR ${leads.lastMessageAt} < DATE_SUB(NOW(), INTERVAL 7 DAY)`,
          gte(leads.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        )));

    case "abandoned_leads":
      return await withQueryTimeout("recovery.target-leads", db
        .select({
          id: leads.id,
          name: leads.name,
          phone: leads.phone,
          status: leads.status,
          appointmentAt: leads.appointmentAt,
          lastMessageAt: leads.lastMessageAt,
          tags: leads.tags,
          createdAt: leads.createdAt,
          updatedAt: leads.updatedAt
        })
        .from(leads)
        .where(and(
          eq(leads.tenantId, tenantId),
          eq(leads.status, "contacted"),
          sql`${leads.lastMessageAt} < DATE_SUB(NOW(), INTERVAL 14 DAY)`,
          gte(leads.createdAt, new Date(Date.now() - 60 * 24 * 60 * 60 * 1000))
        )));

    default:
      return []; // No matches for unknown types
  }
}

async function getRecoveryOpportunities(db: Db, tenantId: number, since: Date) {
  // Get specific leads with recovery potential
  const opportunities = await withQueryTimeout("leakage.recovery-opportunities", db
    .select({
      leadId: leads.id,
      leadName: leads.name,
      leadPhone: leads.phone,
      status: leads.status,
      appointmentAt: leads.appointmentAt,
      lastMessageAt: leads.lastMessageAt,
      tags: leads.tags,
      createdAt: leads.createdAt
    })
    .from(leads)
    .where(and(
      eq(leads.tenantId, tenantId),
      or(
        // No-shows
        and(
          eq(leads.status, "booked"),
          isNotNull(leads.appointmentAt),
          lt(leads.appointmentAt, new Date()),
          sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'no_show') IS NOT NULL`
        ),
        // Qualified but not followed up
        and(
          eq(leads.status, "qualified"),
          sql`${leads.lastMessageAt} IS NULL OR ${leads.lastMessageAt} < DATE_SUB(NOW(), INTERVAL 7 DAY)`
        ),
        // Recently cancelled
        and(
          sql`JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'cancelled') IS NOT NULL`,
          gte(leads.updatedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )
      )
    ))
    .orderBy(desc(leads.createdAt))
    .limit(20));

  return opportunities.map((lead: any) => {
    let leakageType = "unknown";
    let recoveryActions: string[] = [];
    let estimatedRevenue = 250; // Default revenue

    if (lead.status === "booked" && lead.appointmentAt && new Date(lead.appointmentAt) < new Date()) {
      const tags = JSON.parse(lead.tags || "[]");
      if (tags.includes("no_show")) {
        leakageType = "no_show";
        recoveryActions = ["Send re-scheduling SMS", "Offer discount", "Call to re-schedule"];
      }
    } else if (lead.status === "qualified" && (!lead.lastMessageAt || new Date(lead.lastMessageAt) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))) {
      leakageType = "missed_followup";
      recoveryActions = ["Send follow-up message", "Schedule call", "Send special offer"];
      estimatedRevenue = 200; // Higher for qualified leads
    } else if (lead.tags && JSON.parse(lead.tags || "[]").includes("cancelled")) {
      leakageType = "cancellation";
      recoveryActions = ["Send cancellation survey", "Offer alternative slot", "Address concerns"];
      estimatedRevenue = 150; // Lower for cancellations
    }

    return {
      leadId: lead.leadId,
      leadName: lead.leadName || lead.leadPhone,
      leadPhone: lead.leadPhone,
      leakageType,
      estimatedRevenue,
      recoveryActions,
      lastActivity: new Date(lead.lastMessageAt || lead.createdAt)
    };
  });
}

function generateRecommendations(leakageSources: LeakageDetection[]) {
  const recommendations = [];

  // Process-based recommendations
  if (leakageSources.find(l => l.type === "no_show")?.severity === "high") {
    recommendations.push({
      category: "process" as const,
      priority: "high" as const,
      title: "Implement No-Show Prevention System",
      description: "Automated reminders, confirmation calls, and deposit requirements to reduce no-shows",
      expectedImpact: (leakageSources.find(l => l.type === "no_show")?.estimatedRevenue ?? 0) * 0.5,
      implementationEffort: "medium" as const
    });
  }

  // Automation recommendations
  if (leakageSources.find(l => l.type === "followup_missed")?.severity === "high") {
    recommendations.push({
      category: "automation" as const,
      priority: "critical" as const,
      title: "Automated Lead Follow-up System",
      description: "Set up automated sequences for qualified leads with personalized timing and content",
      expectedImpact: (leakageSources.find(l => l.type === "followup_missed")?.estimatedRevenue ?? 0) * 0.7,
      implementationEffort: "low" as const
    });
  }

  // Staffing recommendations
  if (leakageSources.find(l => l.type === "double_booking")?.severity === "high") {
    recommendations.push({
      category: "staffing" as const,
      priority: "medium" as const,
      title: "Staff Training for Scheduling",
      description: "Train staff on proper scheduling procedures and calendar management",
      expectedImpact: (leakageSources.find(l => l.type === "double_booking")?.estimatedRevenue ?? 0) * 0.8,
      implementationEffort: "low" as const
    });
  }

  // Technology recommendations
  if (leakageSources.find(l => l.type === "underbooking")?.severity === "high") {
    recommendations.push({
      category: "technology" as const,
      priority: "medium" as const,
      title: "Dynamic Pricing System",
      description: "Implement automated pricing adjustments for off-peak hours to maximize occupancy",
      expectedImpact: (leakageSources.find(l => l.type === "underbooking")?.estimatedRevenue ?? 0) * 0.4,
      implementationEffort: "high" as const
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

async function getLeakageByMonth(db: Db, tenantId: number, days: number) {
  const months = Math.ceil(days / 30);
  const result = await withQueryTimeout("leakage.monthly-trends", db
    .select({
      month: sql<string>`DATE_FORMAT(${leads.createdAt}, '%Y-%m')`,
      leakage: sql<number>`SUM(CASE 
        WHEN ${leads.status} = 'booked' AND ${leads.appointmentAt} < NOW() AND JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'no_show') IS NOT NULL THEN 250
        WHEN JSON_SEARCH(COALESCE(${leads.tags}, JSON_ARRAY()), 'one', 'cancelled') IS NOT NULL THEN 250
        ELSE 0 
      END)`,
      recovered: sql<number>`SUM(CASE 
        WHEN ${leads.status} = 'booked' AND ${leads.appointmentAt} >= NOW() THEN 250
        ELSE 0 
      END)`
    })
    .from(leads)
    .where(and(
      eq(leads.tenantId, tenantId),
      gte(leads.createdAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000))
    ))
    .groupBy(sql`DATE_FORMAT(${leads.createdAt}, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(${leads.createdAt}, '%Y-%m')`));

  return result.map((row: any) => ({
    month: row.month,
    leakage: Number(row.leakage),
    recovered: Number(row.recovered)
  }));
}
