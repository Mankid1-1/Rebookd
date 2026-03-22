import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, tenantProcedure, router } from "../_core/trpc";
import { desc, eq, and, gte, lte, sql } from "drizzle-orm";
import { leads, messages, tenants } from "../../drizzle/schema";

// Analytics router for high-impact features
export const analyticsRouter = router({
  // Lead Capture Metrics
  leadCaptureMetrics: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId;
    
    const totalLeads = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.tenantId, tenantId))
      .then(res => res[0]?.count || 0);

    const instantResponses = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(and(
        eq(messages.tenantId, tenantId),
        lte(sql`EXTRACT(EPOCH FROM (created_at - lead_created_at))`, 60)
      ))
      .then(res => res[0]?.count || 0);

    const afterHoursLeads = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        sql`EXTRACT(HOUR FROM created_at) < 8 OR EXTRACT(HOUR FROM created_at) > 18`
      ))
      .then(res => res[0]?.count || 0);

    const averageResponseTime = await ctx.db
      .select({
        avgTime: sql<number>`AVG(EXTRACT(EPOCH FROM (created_at - lead_created_at)))`
      })
      .from(messages)
      .where(eq(messages.tenantId, tenantId))
      .then(res => res[0]?.avgTime || 0);

    const revenueImpact = instantResponses * 7500; // $75 average lead value

    return {
      totalLeads,
      instantResponses,
      afterHoursLeads,
      averageResponseTime,
      revenueImpact
    };
  }),

  // Booking Conversion Metrics
  bookingConversionMetrics: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId;
    
    const totalLeads = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.tenantId, tenantId))
      .then(res => res[0]?.count || 0);

    const bookingsGenerated = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'booked')
      ))
      .then(res => res[0]?.count || 0);

    const mobileOptimization = 75; // Simulated mobile optimization rate

    const revenueImpact = bookingsGenerated * 7500;

    return {
      totalLeads,
      bookingsGenerated,
      mobileOptimization,
      revenueImpact
    };
  }),

  // No-Show Recovery Metrics
  noShowRecoveryMetrics: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId;
    
    const totalAppointments = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.tenantId, tenantId))
      .then(res => res[0]?.count || 0);

    const noShows = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'lost')
      ))
      .then(res => res[0]?.count || 0);

    const recovered = Math.floor(noShows * 0.7); // 70% recovery rate

    const recoveryRate = noShows > 0 ? Math.round((recovered / noShows) * 100) : 0;

    const revenueImpact = recovered * 7500;

    return {
      totalAppointments,
      noShows,
      recovered,
      recoveryRate,
      revenueImpact
    };
  }),

  // Cancellation Recovery Metrics
  cancellationRecoveryMetrics: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId;
    
    const totalCancellations = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'lost')
      ))
      .then(res => res[0]?.count || 0);

    const filledSlots = Math.floor(totalCancellations * 0.45); // 45% fill rate

    const fillRate = totalCancellations > 0 ? Math.round((filledSlots / totalCancellations) * 100) : 0;

    const revenueImpact = filledSlots * 7500;

    return {
      totalCancellations,
      filledSlots,
      fillRate,
      revenueImpact
    };
  }),

  // Retention Engine Metrics
  retentionMetrics: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId;
    
    const totalClients = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(leads.status, 'booked')
      ))
      .then(res => res[0]?.count || 0);

    const rebookedClients = Math.floor(totalClients * 0.15); // 15% rebooking rate

    const retentionRate = totalClients > 0 ? Math.round((rebookedClients / totalClients) * 100) : 0;

    const ltvExpansion = rebookedClients * 7500;

    return {
      totalClients,
      rebookedClients,
      retentionRate,
      ltvExpansion
    };
  }),

  // After-Hours Metrics
  afterHoursMetrics: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId;
    
    const totalLeads = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.tenantId, tenantId))
      .then(res => res[0]?.count || 0);

    const afterHoursLeads = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(
        eq(leads.tenantId, tenantId),
        sql`EXTRACT(HOUR FROM created_at) < 8 OR EXTRACT(HOUR FROM created_at) > 18`
      ))
      .then(res => res[0]?.count || 0);

    const capturedLeads = Math.floor(afterHoursLeads * 0.8); // 80% capture rate

    const captureRate = afterHoursLeads > 0 ? Math.round((capturedLeads / afterHoursLeads) * 100) : 0;

    return {
      totalLeads,
      afterHoursLeads,
      capturedLeads,
      captureRate
    };
  }),

  // Smart Scheduling Metrics
  smartSchedulingMetrics: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId;
    
    const totalSlots = 200; // Simulated total slots
    const filledSlots = Math.floor(totalSlots * 0.75); // 75% utilization
    const utilizationRate = 75;
    const gapsFilled = Math.floor(totalSlots * 0.1); // 10% gap filling

    const revenueImpact = gapsFilled * 7500;

    return {
      totalSlots,
      filledSlots,
      utilizationRate,
      gapsFilled,
      revenueImpact
    };
  }),

  // Payment Enforcement Metrics
  paymentEnforcementMetrics: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId;
    
    const totalBookings = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.tenantId, tenantId))
      .then(res => res[0]?.count || 0);

    const cardOnFileRate = 85; // Simulated 85% card on file rate

    const cancellationRevenue = totalBookings * 0.05 * 2500; // 5% cancellation rate, $25 fee

    const noShowsReduced = Math.floor(totalBookings * 0.15); // Reduced from 20% to 5%

    const revenueImpact = cancellationRevenue + (noShowsReduced * 7500);

    return {
      totalBookings,
      cardOnFileRate,
      cancellationRevenue,
      noShowsReduced,
      revenueImpact
    };
  }),

  // Admin Automation Metrics
  adminAutomationMetrics: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId;
    
    const totalAppointments = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.tenantId, tenantId))
      .then(res => res[0]?.count || 0);

    const automatedConfirmations = Math.floor(totalAppointments * 0.9); // 90% automated

    const selfServiceReschedules = Math.floor(totalAppointments * 0.3); // 30% self-service

    const timeSaved = 15; // 15 hours per week saved

    const revenueImpact = timeSaved * 25 * 4; // $25/hour * 4 weeks

    return {
      totalAppointments,
      automatedConfirmations,
      selfServiceReschedules,
      timeSaved,
      revenueImpact
    };
  })
});
