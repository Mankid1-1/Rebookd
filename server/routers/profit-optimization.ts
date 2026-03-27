/**
 * Profit Optimization Router
 * 
 * API endpoints for profit optimization, revenue maximization,
 * and automated profit management
 */

import { z } from "zod";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { adminProcedure, tenantProcedure } from "../_core/trpc";
import { subscriptions, plans } from "../../drizzle/schema";
import { 
  generateRevenueStrategies, 
  optimizeTenantRevenue, 
  generateRevenueAlerts,
  executeRevenueOptimization 
} from "../services/revenue-maximization.service";
import { 
  calculateProfitMetrics, 
  identifyUpsellOpportunities, 
  optimizePricing,
  generateProfitRecommendations 
} from "../services/profit-optimization.service";
import { 
  AutomatedProfitOptimizer,
  startAutomatedProfitOptimizer 
} from "../services/automated-profit.service";

// Global optimizer instance
let globalOptimizer: AutomatedProfitOptimizer | null = null;

export const profitOptimizationRouter = {
  // Get comprehensive profit metrics
  getProfitMetrics: tenantProcedure
    .input(z.object({ periodDays: z.number().int().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      const metrics = await calculateProfitMetrics(ctx.db, input.periodDays);
      return {
        totalRevenue: metrics.totalRevenue,
        totalCosts: metrics.totalCosts,
        grossProfit: metrics.grossProfit,
        profitMargin: metrics.profitMargin,
        averageRevenuePerCustomer: metrics.averageRevenuePerCustomer,
        churnRate: metrics.churnRate,
        ltv: metrics.ltv,
        cac: metrics.cac,
        periodDays: input.periodDays
      };
    }),

  // Generate revenue optimization strategies
  getRevenueStrategies: tenantProcedure
    .query(async ({ ctx }) => {
      const strategies = await generateRevenueStrategies(ctx.db, ctx.tenantId);
      return strategies;
    }),

  // Get tenant-specific optimization recommendations
  getTenantOptimization: tenantProcedure
    .query(async ({ ctx }) => {
      const optimization = await optimizeTenantRevenue(ctx.db, ctx.tenantId);
      return optimization;
    }),

  // Execute revenue optimization actions
  executeOptimization: tenantProcedure
    .input(z.object({ actions: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const success = await executeRevenueOptimization(ctx.db, ctx.tenantId, input.actions);
      
      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to execute optimization actions"
        });
      }

      return { success, executedActions: input.actions };
    }),

  // Get upsell opportunities
  getUpsellOpportunities: tenantProcedure
    .query(async ({ ctx }) => {
      const opportunities = await identifyUpsellOpportunities(ctx.db);
      return opportunities;
    }),

  // Get pricing optimization recommendations
  getPricingOptimization: tenantProcedure
    .input(z.object({ planId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const optimization = await optimizePricing(ctx.db, input.planId);
      return optimization;
    }),

  // Get profit recommendations
  getProfitRecommendations: tenantProcedure
    .query(async ({ ctx }) => {
      const recommendations = await generateProfitRecommendations(ctx.db);
      return recommendations;
    }),

  // Get revenue alerts and opportunities
  getRevenueAlerts: tenantProcedure
    .query(async ({ ctx }) => {
      const alerts = await generateRevenueAlerts(ctx.db);
      return alerts;
    }),

  // Admin-only endpoints — use adminProcedure for proper auth
  getSystemProfitMetrics: adminProcedure
    .input(z.object({ periodDays: z.number().int().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      const metrics = await calculateProfitMetrics(ctx.db, input.periodDays);
      return metrics;
    }),

  startAutomatedOptimizer: adminProcedure
    .mutation(async ({ ctx }) => {
      if (globalOptimizer) {
        throw new TRPCError({ code: "CONFLICT", message: "Automated optimizer is already running" });
      }
      globalOptimizer = await startAutomatedProfitOptimizer(ctx.db);
      return { success: true, message: "Automated profit optimizer started" };
    }),

  stopAutomatedOptimizer: adminProcedure
    .mutation(async ({ ctx }) => {
      if (!globalOptimizer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Automated optimizer is not running" });
      }
      globalOptimizer.stopOptimization();
      globalOptimizer = null;
      return { success: true, message: "Automated profit optimizer stopped" };
    }),

  getOptimizerDashboard: adminProcedure
    .query(async ({ ctx }) => {
      if (!globalOptimizer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Automated optimizer is not running" });
      }
      const dashboard = await globalOptimizer.getProfitDashboard();
      const history = globalOptimizer.getOptimizationHistory();
      return { dashboard, recentHistory: history.slice(-10), isRunning: true };
    }),

  getSystemRevenueStrategies: adminProcedure
    .query(async ({ ctx }) => {
      const strategies = await generateRevenueStrategies(ctx.db);
      return strategies;
    }),

  getSystemRevenueAlerts: adminProcedure
    .query(async ({ ctx }) => {
      const alerts = await generateRevenueAlerts(ctx.db);
      return alerts;
    }),

  forceOptimizationCycle: adminProcedure
    .mutation(async ({ ctx }) => {
      if (!globalOptimizer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Automated optimizer is not running" });
      }
      await globalOptimizer.runOptimizationCycle();
      return { success: true, message: "Optimization cycle completed" };
    }),

  getPromotionalStats: adminProcedure
    .query(async ({ ctx }) => {
      const [stats] = await ctx.db
        .select({
          totalPromotionalSubscriptions: sql<number>`COUNT(*)`,
          activePromotions: sql<number>`COUNT(CASE WHEN isPromotional = true AND (promotionalExpiresAt IS NULL OR promotionalExpiresAt > NOW()) THEN 1 END)`,
          expiredPromotions: sql<number>`COUNT(CASE WHEN isPromotional = true AND promotionalExpiresAt <= NOW() THEN 1 END)`,
          totalSlotsUsed: sql<number>`SUM(CASE WHEN isPromotional = true THEN 1 ELSE 0 END)`,
          averagePromotionalValue: sql<number>`AVG(CASE WHEN isPromotional = true THEN 19900 ELSE 0 END)`
        })
        .from(subscriptions);

      const [planStats] = await ctx.db
        .select({
          totalPromotionalSlots: sql<number>`SUM(promotionalSlots)`,
          plansWithPromotion: sql<number>`COUNT(CASE WHEN hasPromotion = true THEN 1 END)`
        })
        .from(plans);

      return {
        totalPromotionalSubscriptions: stats.totalPromotionalSubscriptions || 0,
        activePromotions: stats.activePromotions || 0,
        expiredPromotions: stats.expiredPromotions || 0,
        totalSlotsUsed: stats.totalSlotsUsed || 0,
        averagePromotionalValue: stats.averagePromotionalValue || 0,
        totalPromotionalSlots: planStats.totalPromotionalSlots || 0,
        plansWithPromotion: planStats.plansWithPromotion || 0,
        slotsRemaining: Math.max(0, (planStats.totalPromotionalSlots || 0) - (stats.totalSlotsUsed || 0))
      };
    }),

  getProfitForecast: adminProcedure
    .input(z.object({ months: z.number().int().min(1).max(24).default(12) }))
    .query(async ({ ctx, input }) => {
      const currentMetrics = await calculateProfitMetrics(ctx.db);
      const strategies = await generateRevenueStrategies(ctx.db);

      const monthlyGrowthRate = 0.15;
      const strategyImpact = strategies.reduce((sum, s) => sum + (s.potentialIncrease / 100), 0);

      const forecast = [];
      let projectedProfit = currentMetrics.grossProfit;

      for (let month = 1; month <= input.months; month++) {
        projectedProfit *= (1 + monthlyGrowthRate);
        if (month <= 6) {
          projectedProfit += (strategyImpact / 6) / 100;
        }
        forecast.push({
          month,
          projectedProfit,
          projectedRevenue: projectedProfit * (1 + (1 - currentMetrics.profitMargin / 100)),
          growthRate: monthlyGrowthRate * 100
        });
      }

      return {
        currentProfit: currentMetrics.grossProfit,
        forecast,
        totalProjectedProfit: forecast.reduce((sum, f) => sum + f.projectedProfit, 0),
        averageMonthlyGrowth: monthlyGrowthRate * 100,
        strategyImpact
      };
    })
};
