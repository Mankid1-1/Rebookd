/**
 * 📊 ANALYTICS ROUTER
 * TRPC router for analytics endpoints
 */

import { createRouter, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import * as AnalyticsService from './analytics';

export const analyticsRouter = createRouter({
  // Get dashboard statistics
  getDashboardStats: protectedProcedure
    .input(z.object({
      dateRange: z.object({
        start: z.string(),
        end: z.string(),
      }).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return await AnalyticsService.getDashboardStats(ctx.db, {
        tenantId: ctx.tenantId,
        ...input,
      });
    }),

  // Get revenue analytics
  getRevenueAnalytics: protectedProcedure
    .input(z.object({
      dateRange: z.object({
        start: z.string(),
        end: z.string(),
      }).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return await AnalyticsService.getRevenueAnalytics(ctx.db, {
        tenantId: ctx.tenantId,
        ...input,
      });
    }),

  // Get lead analytics
  getLeadAnalytics: protectedProcedure
    .input(z.object({
      dateRange: z.object({
        start: z.string(),
        end: z.string(),
      }).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return await AnalyticsService.getLeadAnalytics(ctx.db, {
        tenantId: ctx.tenantId,
        ...input,
      });
    }),

  // Get activity feed
  getActivityFeed: protectedProcedure
    .input(z.object({
      limit: z.number().optional().default(20),
    }))
    .query(async ({ ctx, input }) => {
      return await AnalyticsService.getActivityFeed(ctx.db, ctx.tenantId, input.limit);
    }),

  // Get real-time stats (for live updates)
  getRealTimeStats: protectedProcedure
    .query(async ({ ctx }) => {
      // Get today's stats only for real-time updates
      const today = new Date().toISOString().split('T')[0];
      return await AnalyticsService.getDashboardStats(ctx.db, {
        tenantId: ctx.tenantId,
        dateRange: {
          start: today,
          end: today,
        },
      });
    }),
});
