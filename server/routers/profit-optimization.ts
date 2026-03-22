/**
 * Profit Optimization Router
 * 
 * API endpoints for profit optimization, revenue maximization,
 * and automated profit management
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, tenantProcedure } from "../_core/trpc";
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

  // Admin-only endpoints
  getSystemProfitMetrics: publicProcedure
    .input(z.object({ periodDays: z.number().int().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      // Only allow admin access
      if (!ctx.user || ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Admin access required"
        });
      }

      const metrics = await calculateProfitMetrics(ctx.db, input.periodDays);
      return metrics;
    }),

  // Start automated profit optimizer (admin only)
  startAutomatedOptimizer: publicProcedure
    .mutation(async ({ ctx }) => {
      // Only allow admin access
      if (!ctx.user || ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Admin access required"
        });
      }

      if (globalOptimizer) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Automated optimizer is already running"
        });
      }

      globalOptimizer = await startAutomatedProfitOptimizer(ctx.db);
      return { success: true, message: "Automated profit optimizer started" };
    }),

  // Stop automated profit optimizer (admin only)
  stopAutomatedOptimizer: publicProcedure
    .mutation(async ({ ctx }) => {
      // Only allow admin access
      if (!ctx.user || ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Admin access required"
        });
      }

      if (!globalOptimizer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Automated optimizer is not running"
        });
      }

      globalOptimizer.stopOptimization();
      globalOptimizer = null;
      return { success: true, message: "Automated profit optimizer stopped" };
    }),

  // Get optimizer status and dashboard (admin only)
  getOptimizerDashboard: publicProcedure
    .query(async ({ ctx }) => {
      // Only allow admin access
      if (!ctx.user || ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Admin access required"
        });
      }

      if (!globalOptimizer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Automated optimizer is not running"
        });
      }

      const dashboard = await globalOptimizer.getProfitDashboard();
      const history = globalOptimizer.getOptimizationHistory();

      return {
        dashboard,
        recentHistory: history.slice(-10), // Last 10 optimizations
        isRunning: true
      };
    }),

  // Get system-wide revenue strategies (admin only)
  getSystemRevenueStrategies: publicProcedure
    .query(async ({ ctx }) => {
      // Only allow admin access
      if (!ctx.user || ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Admin access required"
        });
      }

      const strategies = await generateRevenueStrategies(ctx.db);
      return strategies;
    }),

  // Get system-wide revenue alerts (admin only)
  getSystemRevenueAlerts: publicProcedure
    .query(async ({ ctx }) => {
      // Only allow admin access
      if (!ctx.user || ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Admin access required"
        });
      }

      const alerts = await generateRevenueAlerts(ctx.db);
      return alerts;
    }),

  // Force optimization cycle (admin only)
  forceOptimizationCycle: publicProcedure
    .mutation(async ({ ctx }) => {
      // Only allow admin access
      if (!ctx.user || ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Admin access required"
        });
      }

      if (!globalOptimizer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Automated optimizer is not running"
        });
      }

      await globalOptimizer.runOptimizationCycle();
      return { success: true, message: "Optimization cycle completed" };
    }),

  // Get promotional pricing statistics (admin only)
  getPromotionalStats: publicProcedure
    .query(async ({ ctx }) => {
      // Only allow admin access
      if (!ctx.user || ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Admin access required"
        });
      }

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

  // Get profit forecast (admin only)
  getProfitForecast: publicProcedure
    .input(z.object({ months: z.number().int().min(1).max(24).default(12) }))
    .query(async ({ ctx, input }) => {
      // Only allow admin access
      if (!ctx.user || ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Admin access required"
        });
      }

      const currentMetrics = await calculateProfitMetrics(ctx.db);
      const strategies = await generateRevenueStrategies(ctx.db);
      
      // Calculate projected growth based on strategies
      const monthlyGrowthRate = 0.15; // 15% monthly growth target
      const strategyImpact = strategies.reduce((sum, s) => sum + (s.potentialIncrease / 100), 0);
      
      const forecast = [];
      let projectedProfit = currentMetrics.grossProfit;
      
      for (let month = 1; month <= input.months; month++) {
        projectedProfit *= (1 + monthlyGrowthRate);
        
        // Add strategy impact distributed over months
        if (month <= 6) { // Strategies impact first 6 months
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
