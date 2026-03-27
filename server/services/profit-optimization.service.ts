/**
 * Profit Optimization Service
 * 
 * Maximizes revenue and profit through intelligent pricing strategies,
 * upselling opportunities, and revenue optimization algorithms
 */

import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { leads, subscriptions, plans, tenants, recoveryEvents } from "../../drizzle/schema";
import type { Db } from "../_core/context";

export interface ProfitMetrics {
  totalRevenue: number;
  totalCosts: number;
  grossProfit: number;
  profitMargin: number;
  averageRevenuePerCustomer: number;
  churnRate: number;
  ltv: number;
  cac: number;
}

export interface UpsellOpportunity {
  tenantId: number;
  currentPlan: string;
  recommendedPlan: string;
  potentialRevenueIncrease: number;
  probability: number;
  reason: string;
}

export interface PricingOptimization {
  currentPricing: number;
  optimalPricing: number;
  expectedRevenueIncrease: number;
  demandElasticity: number;
  competitorPricing: number[];
}

/**
 * Calculate comprehensive profit metrics
 */
export async function calculateProfitMetrics(
  db: Db,
  periodDays: number = 30
): Promise<ProfitMetrics> {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodDays);

  // Calculate total revenue from subscriptions and revenue share
  // Use recovery_events (realized payments) as the source of truth for revenue share
  const [revenueData] = await db
    .select({
      subscriptionRevenue: sql<number>`SUM(CASE
        WHEN ${subscriptions.isPromotional} = true AND ${subscriptions.promotionalExpiresAt} > NOW() THEN 0
        ELSE ${plans.priceMonthly} / 100
      END)`,
      totalCustomers: sql<number>`COUNT(DISTINCT ${subscriptions.tenantId})`
    })
    .from(subscriptions)
    .leftJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(
        eq(subscriptions.status, 'active'),
        gte(subscriptions.currentPeriodStart, periodStart)
      )
    );

  // Revenue share from ACTUAL realized recovery events (not leads table)
  const [recoveryData] = await db
    .select({
      totalRealizedRevenue: sql<number>`COALESCE(SUM(${recoveryEvents.realizedRevenue}), 0)`,
    })
    .from(recoveryEvents)
    .where(
      and(
        eq(recoveryEvents.isPrimaryAttribution, true),
        sql`${recoveryEvents.status} IN ('realized', 'manual_realized')`,
        gte(recoveryEvents.realizedAt, periodStart)
      )
    );

  // Calculate revenue share per tenant using their plan's rate
  const [revenueShareData] = await db
    .select({
      revenueShareRevenue: sql<number>`COALESCE(SUM(re.realizedRevenue * ${plans.revenueSharePercent} / 100 / 100), 0)`,
    })
    .from(recoveryEvents)
    .innerJoin(subscriptions, eq(recoveryEvents.tenantId, subscriptions.tenantId))
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(
        eq(recoveryEvents.isPrimaryAttribution, true),
        sql`${recoveryEvents.status} IN ('realized', 'manual_realized')`,
        gte(recoveryEvents.realizedAt, periodStart)
      )
    );

  // Calculate costs (simplified - would include actual operational costs)
  const operationalCosts = await calculateOperationalCosts(db, periodDays);
  
  const totalRevenue = (revenueData?.subscriptionRevenue || 0) + (revenueShareData?.revenueShareRevenue || 0);
  const totalCosts = operationalCosts;
  const grossProfit = totalRevenue - totalCosts;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const averageRevenuePerCustomer = revenueData?.totalCustomers > 0 
    ? totalRevenue / revenueData.totalCustomers 
    : 0;

  // Calculate churn rate
  const [churnData] = await db
    .select({
      churnedCustomers: sql<number>`COUNT(*)`,
      totalCustomers: sql<number>`COUNT(*)`
    })
    .from(subscriptions)
    .where(
      and(
        lte(subscriptions.updatedAt, periodStart),
        eq(subscriptions.status, 'canceled')
      )
    );

  const churnRate = churnData?.totalCustomers > 0 
    ? (churnData.churnedCustomers / churnData.totalCustomers) * 100 
    : 0;

  return {
    totalRevenue,
    totalCosts,
    grossProfit,
    profitMargin,
    averageRevenuePerCustomer,
    churnRate,
    ltv: calculateLTV(averageRevenuePerCustomer, churnRate),
    cac: calculateCAC(totalCosts, revenueData?.totalCustomers || 0)
  };
}

/**
 * Identify upsell opportunities
 */
export async function identifyUpsellOpportunities(
  db: Db
): Promise<UpsellOpportunity[]> {
  const opportunities: UpsellOpportunity[] = [];

  // Get all active tenants with their current plans and usage
  const tenantsWithUsage = await db
    .select({
      tenantId: tenants.id,
      currentPlan: plans.name,
      currentPlanSlug: plans.slug,
      maxMessages: plans.maxMessages,
      maxAutomations: plans.maxAutomations,
      messagesUsed: sql<number>`COALESCE(u.messagesSent, 0)`,
      automationsUsed: sql<number>`COALESCE(u.automationsRun, 0)`,
      recoveredRevenue: sql<number>`COALESCE(l.recoveredRevenue, 0)`
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
    .leftJoin(
      sql`(SELECT tenantId, SUM(realizedRevenue) as recoveredRevenue
           FROM recovery_events
           WHERE isPrimaryAttribution = true
           AND status IN ('realized', 'manual_realized')
           AND realizedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           GROUP BY tenantId) as l`,
      eq(tenants.id, sql`l.tenantId`)
    )
    .where(eq(subscriptions.status, 'active'));

  for (const tenant of tenantsWithUsage) {
    // Check if tenant is approaching limits
    const messageUtilization = tenant.maxMessages > 0 ? tenant.messagesUsed / tenant.maxMessages : 0;
    const automationUtilization = tenant.maxAutomations > 0 ? tenant.automationsUsed / tenant.maxAutomations : 0;

    // High utilization indicates need for upgrade
    if (messageUtilization > 0.8 || automationUtilization > 0.8) {
      const recommendedPlan = tenant.currentPlanSlug === 'free' ? 'professional' : 'enterprise';
      const [recommendedPlanData] = await db
        .select()
        .from(plans)
        .where(eq(plans.slug, recommendedPlan))
        .limit(1);

      if (recommendedPlanData) {
        const potentialRevenueIncrease = calculateUpsellRevenue(
          tenant.currentPlanSlug,
          recommendedPlan,
          tenant.recoveredRevenue
        );

        opportunities.push({
          tenantId: tenant.tenantId,
          currentPlan: tenant.currentPlan,
          recommendedPlan: recommendedPlanData.name,
          potentialRevenueIncrease,
          probability: messageUtilization > 0.9 ? 0.8 : 0.6,
          reason: messageUtilization > automationUtilization 
            ? `${Math.round(messageUtilization * 100)}% message utilization`
            : `${Math.round(automationUtilization * 100)}% automation utilization`
        });
      }
    }
  }

  return opportunities.sort((a, b) => b.potentialRevenueIncrease - a.potentialRevenueIncrease);
}

/**
 * Optimize pricing based on market data and demand elasticity
 */
export async function optimizePricing(
  db: Db,
  planId: number
): Promise<PricingOptimization> {
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);

  if (!plan) {
    throw new Error("Plan not found");
  }

  // Analyze historical pricing and conversion data
  const [pricingData] = await db
    .select({
      conversionRate: sql<number>`AVG(CASE 
        WHEN s.status = 'active' THEN 1 
        ELSE 0 
      END)`,
      averageRevenue: sql<number>`AVG(p.priceMonthly)`,
      competitorPrice: sql<number>`19900` // Would pull from market research
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(plans.id, planId));

  // Calculate optimal pricing using demand elasticity model
  const currentPricing = plan.priceMonthly;
  const demandElasticity = -1.5; // Typical SaaS elasticity
  const competitorPricing = [19900, 24900, 29900]; // Competitor prices in cents
  
  // Optimize for maximum revenue
  const optimalPricing = calculateOptimalPrice(
    currentPricing,
    pricingData?.conversionRate || 0.05,
    demandElasticity,
    competitorPricing
  );

  const expectedRevenueIncrease = calculateRevenueIncrease(
    currentPricing,
    optimalPricing,
    pricingData?.conversionRate || 0.05,
    demandElasticity
  );

  return {
    currentPricing,
    optimalPricing,
    expectedRevenueIncrease,
    demandElasticity,
    competitorPricing
  };
}

/**
 * Generate profit maximization recommendations
 */
export async function generateProfitRecommendations(
  db: Db
): Promise<string[]> {
  const recommendations: string[] = [];
  
  const metrics = await calculateProfitMetrics(db);
  const upsellOpportunities = await identifyUpsellOpportunities(db);

  // Profit margin analysis
  if (metrics.profitMargin < 20) {
    recommendations.push("Increase focus on high-margin revenue share customers");
    recommendations.push("Consider reducing operational costs through automation");
  }

  // Churn analysis
  if (metrics.churnRate > 5) {
    recommendations.push("Implement customer retention programs for high-churn segments");
    recommendations.push("Add onboarding assistance for new customers");
  }

  // Upsell opportunities
  if (upsellOpportunities.length > 0) {
    const topOpportunity = upsellOpportunities[0];
    recommendations.push(`Target ${upsellOpportunities.length} customers for upsell - potential $${(topOpportunity.potentialRevenueIncrease / 100).toFixed(0)} increase`);
  }

  // LTV/CAC ratio
  if (metrics.ltv / metrics.cac < 3) {
    recommendations.push("Improve customer acquisition efficiency");
    recommendations.push("Focus on higher-value customer segments");
  }

  // Revenue optimization
  if (metrics.averageRevenuePerCustomer < 25000) { // $250/month
    recommendations.push("Encourage customers to increase recovered revenue for higher share");
    recommendations.push("Offer performance bonuses for high-recovery customers");
  }

  return recommendations;
}

/**
 * Calculate operational costs
 */
async function calculateOperationalCosts(db: Db, periodDays: number): Promise<number> {
  // Simplified cost calculation - would include actual costs
  const baseCosts = 50000; // $500/month base operational costs
  const perCustomerCost = 2000; // $20/month per customer
  
  const [customerCount] = await db
    .select({ count: sql<number>`COUNT(DISTINCT tenantId)` })
    .from(subscriptions)
    .where(eq(subscriptions.status, 'active'));

  return baseCosts + (customerCount.count * perCustomerCost);
}

/**
 * Calculate Customer Lifetime Value
 */
function calculateLTV(averageRevenuePerCustomer: number, churnRate: number): number {
  if (churnRate === 0) return averageRevenuePerCustomer * 36; // 3 years default
  const monthlyChurnRate = churnRate / 100 / 12;
  return averageRevenuePerCustomer / monthlyChurnRate;
}

/**
 * Calculate Customer Acquisition Cost
 */
function calculateCAC(totalCosts: number, customerCount: number): number {
  return customerCount > 0 ? totalCosts / customerCount : 0;
}

/**
 * Calculate upsell revenue potential
 */
function calculateUpsellRevenue(
  currentPlanSlug: string,
  recommendedPlanSlug: string,
  currentRecoveredRevenue: number
): number {
  const planPricing = {
    free: { base: 0, share: 0 },
    professional: { base: 19900, share: 15 },
    enterprise: { base: 0, share: 10 } // Custom pricing
  };

  const current = planPricing[currentPlanSlug as keyof typeof planPricing];
  const recommended = planPricing[recommendedPlanSlug as keyof typeof planPricing];

  const currentRevenue = current.base + (currentRecoveredRevenue * current.share / 100);
  const recommendedRevenue = recommended.base + (currentRecoveredRevenue * recommended.share / 100);

  return Math.max(0, recommendedRevenue - currentRevenue);
}

/**
 * Calculate optimal price using demand elasticity
 */
function calculateOptimalPrice(
  currentPrice: number,
  currentConversionRate: number,
  elasticity: number,
  competitorPrices: number[]
): number {
  // Find price that maximizes revenue = price * conversion_rate
  // Using midpoint of competitor prices as starting point
  const midpoint = competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length;
  
  // Adjust based on current performance
  if (currentConversionRate > 0.1) {
    return Math.min(midpoint * 1.2, currentPrice * 1.1);
  } else if (currentConversionRate < 0.05) {
    return Math.max(midpoint * 0.8, currentPrice * 0.9);
  }
  
  return midpoint;
}

/**
 * Calculate expected revenue increase from price change
 */
function calculateRevenueIncrease(
  currentPrice: number,
  newPrice: number,
  currentConversionRate: number,
  elasticity: number
): number {
  const priceChange = (newPrice - currentPrice) / currentPrice;
  const conversionChange = elasticity * priceChange;
  const newConversionRate = currentConversionRate * (1 + conversionChange);
  
  const currentRevenue = currentPrice * currentConversionRate;
  const newRevenue = newPrice * newConversionRate;
  
  return Math.max(0, newRevenue - currentRevenue);
}
