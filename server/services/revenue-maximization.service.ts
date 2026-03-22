/**
 * Revenue Maximization Service
 * 
 * Actively works to maximize revenue through intelligent strategies,
 * automated optimizations, and revenue enhancement algorithms
 */

import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { leads, subscriptions, plans, tenants, messages } from "../../drizzle/schema";
import type { Db } from "../_core/context";

export interface RevenueStrategy {
  strategy: string;
  potentialIncrease: number;
  implementationCost: number;
  roi: number;
  priority: 'high' | 'medium' | 'low';
  timeframe: string;
}

export interface RevenueOptimization {
  tenantId: number;
  currentRevenue: number;
  potentialRevenue: number;
  optimizationActions: string[];
  expectedIncrease: number;
  probability: number;
}

export interface RevenueAlert {
  type: 'opportunity' | 'risk' | 'milestone';
  tenantId: number;
  message: string;
  value: number;
  actionRequired: boolean;
}

/**
 * Generate comprehensive revenue maximization strategies
 */
export async function generateRevenueStrategies(
  db: Db,
  tenantId?: number
): Promise<RevenueStrategy[]> {
  const strategies: RevenueStrategy[] = [];

  // Analyze current revenue performance
  const metrics = await analyzeRevenuePerformance(db, tenantId);
  
  // Strategy 1: Promotional slot optimization
  if (metrics.promotionalSlotsRemaining > 0) {
    strategies.push({
      strategy: "Promotional Slot Acceleration",
      potentialIncrease: metrics.promotionalSlotsRemaining * 19900,
      implementationCost: 5000,
      roi: (metrics.promotionalSlotsRemaining * 19900) / 5000,
      priority: 'high',
      timeframe: "1-2 months"
    });
  }

  // Strategy 2: Revenue share optimization
  if (metrics.averageRevenueShare < 15) {
    strategies.push({
      strategy: "Revenue Share Optimization",
      potentialIncrease: metrics.totalCustomers * 5000,
      implementationCost: 10000,
      roi: (metrics.totalCustomers * 5000) / 10000,
      priority: 'high',
      timeframe: "3-6 months"
    });
  }

  // Strategy 3: Upsell automation
  const upsellPotential = await calculateUpsellPotential(db, tenantId);
  if (upsellPotential > 0) {
    strategies.push({
      strategy: "Automated Upsell Campaigns",
      potentialIncrease: upsellPotential,
      implementationCost: 15000,
      roi: upsellPotential / 15000,
      priority: 'medium',
      timeframe: "2-4 months"
    });
  }

  // Strategy 4: Churn reduction
  if (metrics.churnRate > 5) {
    strategies.push({
      strategy: "Churn Reduction Program",
      potentialIncrease: metrics.churnedCustomers * metrics.averageRevenuePerCustomer * 12,
      implementationCost: 20000,
      roi: (metrics.churnedCustomers * metrics.averageRevenuePerCustomer * 12) / 20000,
      priority: 'high',
      timeframe: "6-12 months"
    });
  }

  // Strategy 5: Revenue recovery enhancement
  const recoveryEnhancement = await calculateRecoveryEnhancement(db, tenantId);
  strategies.push({
    strategy: "AI-Powered Recovery Enhancement",
    potentialIncrease: recoveryEnhancement,
    implementationCost: 25000,
    roi: recoveryEnhancement / 25000,
    priority: 'medium',
    timeframe: "4-8 months"
  });

  return strategies.sort((a, b) => b.roi - a.roi);
}

/**
 * Optimize revenue for specific tenant
 */
export async function optimizeTenantRevenue(
  db: Db,
  tenantId: number
): Promise<RevenueOptimization> {
  // Get tenant's current performance
  const [tenantData] = await db
    .select({
      currentPlan: plans.name,
      currentPlanSlug: plans.slug,
      messagesSent: sql<number>`COALESCE(u.messagesSent, 0)`,
      automationsRun: sql<number>`COALESCE(u.automationsRun, 0)`,
      recoveredRevenue: sql<number>`COALESCE(l.recoveredRevenue, 0)`,
      leadCount: sql<number>`COUNT(DISTINCT leads.id)`,
      conversionRate: sql<number>`(COUNT(DISTINCT CASE WHEN leads.status = 'recovered' THEN leads.id END) * 100.0 / COUNT(DISTINCT leads.id))`
    })
    .from(tenants)
    .innerJoin(subscriptions, eq(subscriptions.tenantId, tenants.id))
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .leftJoin(
      sql`(SELECT tenantId, messagesSent, automationsRun 
           FROM usage 
           WHERE periodStart >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as u`,
      eq(tenants.id, sql`u.tenantId`)
    )
    .leftJoin(leads, eq(leads.tenantId, tenants.id))
    .where(eq(tenants.id, tenantId))
    .groupBy(tenants.id);

  if (!tenantData) {
    throw new Error("Tenant not found");
  }

  const currentRevenue = calculateTenantRevenue(tenantData);
  const optimizationActions: string[] = [];
  let potentialRevenue = currentRevenue;

  // Analyze and generate optimization actions
  if (tenantData.messagesSent > 40000) { // Approaching Professional limit
    optimizationActions.push("Upgrade to Enterprise for unlimited messaging");
    potentialRevenue += 10000; // Estimated additional value
  }

  if (tenantData.automationsRun > 20) { // Approaching Professional limit
    optimizationActions.push("Increase automation capacity");
    potentialRevenue += 5000;
  }

  if (tenantData.conversionRate < 25) { // Low conversion rate
    optimizationActions.push("Implement AI-powered message optimization");
    potentialRevenue += tenantData.recoveredRevenue * 0.3; // 30% improvement
  }

  if (tenantData.recoveredRevenue < 10000) { // Low recovery
    optimizationActions.push("Activate advanced recovery campaigns");
    potentialRevenue += 8000;
  }

  // Check promotional eligibility
  const promotionalOpportunity = await checkPromotionalOpportunity(db, tenantId);
  if (promotionalOpportunity.isEligible) {
    optimizationActions.push("Apply promotional pricing for competitive advantage");
    potentialRevenue -= currentRevenue; // Free for qualifying period
  }

  const expectedIncrease = potentialRevenue - currentRevenue;
  const probability = calculateOptimizationProbability(tenantData, optimizationActions);

  return {
    tenantId,
    currentRevenue,
    potentialRevenue,
    optimizationActions,
    expectedIncrease,
    probability
  };
}

/**
 * Generate revenue alerts and opportunities
 */
export async function generateRevenueAlerts(
  db: Db
): Promise<RevenueAlert[]> {
  const alerts: RevenueAlert[] = [];

  // High-value opportunities
  const highValueTenants = await db
    .select({
      tenantId: tenants.id,
      recoveredRevenue: sql<number>`COALESCE(l.recoveredRevenue, 0)`
    })
    .from(tenants)
    .innerJoin(subscriptions, eq(subscriptions.tenantId, tenants.id))
    .leftJoin(
      sql`(SELECT tenantId, SUM(estimatedRevenue) as recoveredRevenue 
           FROM leads 
           WHERE status = 'recovered' 
           AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           GROUP BY tenantId) as l`,
      eq(tenants.id, sql`l.tenantId`)
    )
    .where(
      and(
        eq(subscriptions.status, 'active'),
        sql`l.recoveredRevenue > 50000` // > $500 recovered
      )
    )
    .orderBy(desc(sql`l.recoveredRevenue`))
    .limit(10);

  for (const tenant of highValueTenants) {
    alerts.push({
      type: 'opportunity',
      tenantId: tenant.tenantId,
      message: `High-value customer with $${(tenant.recoveredRevenue / 100).toFixed(0)} recovered revenue`,
      value: tenant.recoveredRevenue,
      actionRequired: false
    });
  }

  // Churn risks
  const churnRisks = await db
    .select({
      tenantId: tenants.id,
      utilizationRate: sql<number>`(COALESCE(u.messagesSent, 0) / p.maxMessages * 100)`,
      lastActivity: sql<Date>`MAX(COALESCE(l.createdAt, u.updatedAt))`
    })
    .from(tenants)
    .innerJoin(subscriptions, eq(subscriptions.tenantId, tenants.id))
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .leftJoin(
      sql`(SELECT tenantId, messagesSent, updatedAt 
           FROM usage 
           WHERE periodStart >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as u`,
      eq(tenants.id, sql`u.tenantId`)
    )
    .leftJoin(leads, eq(leads.tenantId, tenants.id))
    .where(
      and(
        eq(subscriptions.status, 'active'),
        sql`(COALESCE(u.messagesSent, 0) / p.maxMessages) < 0.2` // Low utilization
      )
    );

  for (const risk of churnRisks) {
    const daysSinceActivity = risk.lastActivity 
      ? Math.floor((Date.now() - risk.lastActivity.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    if (daysSinceActivity > 30) {
      alerts.push({
        type: 'risk',
        tenantId: risk.tenantId,
        message: `Low utilization (${risk.utilizationRate.toFixed(1)}%) - high churn risk`,
        value: risk.utilizationRate,
        actionRequired: true
      });
    }
  }

  // Milestone achievements
  const milestones = await db
    .select({
      tenantId: tenants.id,
      totalRecovered: sql<number>`COALESCE(SUM(l.recoveredRevenue), 0)`
    })
    .from(tenants)
    .innerJoin(subscriptions, eq(subscriptions.tenantId, tenants.id))
    .leftJoin(
      sql`(SELECT tenantId, estimatedRevenue as recoveredRevenue 
           FROM leads 
           WHERE status = 'recovered') as l`,
      eq(tenants.id, sql`l.tenantId`)
    )
    .where(eq(subscriptions.status, 'active'))
    .groupBy(tenants.id)
    .having(sql`COALESCE(SUM(l.recoveredRevenue), 0) >= 100000`) // $1,000+ recovered
    .limit(5);

  for (const milestone of milestones) {
    alerts.push({
      type: 'milestone',
      tenantId: milestone.tenantId,
      message: `Milestone: $${(milestone.totalRecovered / 100).toFixed(0)} total recovered revenue`,
      value: milestone.totalRecovered,
      actionRequired: false
    });
  }

  return alerts;
}

/**
 * Execute revenue optimization actions
 */
export async function executeRevenueOptimization(
  db: Db,
  tenantId: number,
  actions: string[]
): Promise<boolean> {
  try {
    for (const action of actions) {
      switch (action) {
        case "Upgrade to Enterprise for unlimited messaging":
          await executeUpgrade(db, tenantId, 'enterprise');
          break;
        case "Implement AI-powered message optimization":
          await enableAIMessageOptimization(db, tenantId);
          break;
        case "Activate advanced recovery campaigns":
          await activateAdvancedCampaigns(db, tenantId);
          break;
        case "Apply promotional pricing":
          await applyPromotionalPricing(db, tenantId);
          break;
      }
    }
    return true;
  } catch (error) {
    console.error("Failed to execute revenue optimization:", error);
    return false;
  }
}

/**
 * Helper functions
 */
async function analyzeRevenuePerformance(db: Db, tenantId?: number) {
  const whereClause = tenantId ? eq(subscriptions.tenantId, tenantId) : sql`1=1`;
  
  const [metrics] = await db
    .select({
      totalCustomers: sql<number>`COUNT(DISTINCT s.tenantId)`,
      averageRevenueShare: sql<number>`AVG(p.revenueSharePercent)`,
      churnRate: sql<number>`(COUNT(CASE WHEN s.status = 'canceled' THEN 1 END) * 100.0 / COUNT(*))`,
      churnedCustomers: sql<number>`COUNT(CASE WHEN s.status = 'canceled' THEN 1 END)`,
      averageRevenuePerCustomer: sql<number>`AVG(p.priceMonthly / 100)`,
      promotionalSlotsRemaining: sql<number>`SUM(CASE WHEN p.hasPromotion = true THEN p.promotionalSlots - COUNT(CASE WHEN s.isPromotional = true THEN 1 END) ELSE 0 END)`
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(whereClause);

  return metrics;
}

async function calculateUpsellPotential(db: Db, tenantId?: number): Promise<number> {
  const whereClause = tenantId ? eq(subscriptions.tenantId, tenantId) : sql`1=1`;
  
  const [potential] = await db
    .select({
      upsellValue: sql<number>`SUM(CASE 
        WHEN p.slug = 'free' AND u.messagesSent > 80 THEN 19900
        WHEN p.slug = 'professional' AND u.messagesSent > 40000 THEN 50000
        ELSE 0 
      END)`
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .leftJoin(
      sql`(SELECT tenantId, messagesSent 
           FROM usage 
           WHERE periodStart >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as u`,
      eq(subscriptions.tenantId, sql`u.tenantId`)
    )
    .where(whereClause);

  return potential.upsellValue || 0;
}

async function calculateRecoveryEnhancement(db: Db, tenantId?: number): Promise<number> {
  const whereClause = tenantId ? eq(leads.tenantId, tenantId) : sql`1=1`;
  
  const [enhancement] = await db
    .select({
      potential: sql<number>`COUNT(*) * 2500` // $25 per lead improvement
    })
    .from(leads)
    .where(
      and(
        whereClause,
        sql`status IN ('new', 'contacted')` // Untouched leads
      )
    );

  return enhancement.potential || 0;
}

function calculateTenantRevenue(tenantData: any): number {
  // Simplified revenue calculation
  return tenantData.recoveredRevenue || 0;
}

async function checkPromotionalOpportunity(db: Db, tenantId: number) {
  // Check if tenant qualifies for promotional pricing
  const [opportunity] = await db
    .select({
      isEligible: sql<boolean>`CASE 
        WHEN p.hasPromotion = true AND p.promotionalSlots > 0 THEN true 
        ELSE false 
      END`,
      slotsRemaining: sql<number>`p.promotionalSlots`
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  return opportunity || { isEligible: false, slotsRemaining: 0 };
}

function calculateOptimizationProbability(tenantData: any, actions: string[]): number {
  let probability = 0.5; // Base probability
  
  // Increase probability based on tenant characteristics
  if (tenantData.leadCount > 100) probability += 0.2;
  if (tenantData.conversionRate > 20) probability += 0.1;
  if (tenantData.recoveredRevenue > 10000) probability += 0.2;
  
  // Adjust based on number of actions
  probability += (actions.length * 0.05);
  
  return Math.min(0.95, probability);
}

async function executeUpgrade(db: Db, tenantId: number, targetPlan: string) {
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.slug, targetPlan))
    .limit(1);

  if (plan) {
    await db
      .update(subscriptions)
      .set({ planId: plan.id, updatedAt: new Date() })
      .where(eq(subscriptions.tenantId, tenantId));
  }
}

async function enableAIMessageOptimization(db: Db, tenantId: number) {
  // Enable AI features for tenant
  // This would integrate with the AI service
  console.log(`Enabling AI message optimization for tenant ${tenantId}`);
}

async function activateAdvancedCampaigns(db: Db, tenantId: number) {
  // Activate advanced recovery campaigns
  // This would integrate with the campaign service
  console.log(`Activating advanced campaigns for tenant ${tenantId}`);
}

async function applyPromotionalPricing(db: Db, tenantId: number) {
  // Apply promotional pricing
  await db
    .update(subscriptions)
    .set({ 
      isPromotional: true, 
      promotionalExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    })
    .where(eq(subscriptions.tenantId, tenantId));
}
