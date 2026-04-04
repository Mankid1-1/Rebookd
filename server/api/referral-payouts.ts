/**
 * 🎯 REFERRAL PAYOUTS API
 * Admin endpoints for managing referral payout processing
 */

import { z } from 'zod';
import { adminProcedure, protectedProcedure } from '../_core/trpc';
import { 
  processReferralPayouts, 
  getUpcomingPayoutSchedule, 
  getPayoutProcessingStats,
  getUserPayoutTimeline
} from '../jobs/referral-payout-processor';

// Validation schemas
const processPayoutsSchema = z.object({
  force: z.boolean().default(false).optional(),
});

const getUserPayoutsSchema = z.object({
  userId: z.string(),
});

export const referralPayoutsRouter = {
  // Process scheduled payouts (admin only)
  processPayouts: adminProcedure
    .input(processPayoutsSchema)
    .mutation(async ({ input }) => {
      const result = await processReferralPayouts();
      
      return {
        success: result.processed > 0,
        processed: result.processed,
        total: result.total,
        message: result.message,
        timestamp: new Date().toISOString(),
      };
    }),

  // Get upcoming payout schedule (admin only)
  getUpcomingSchedule: adminProcedure
    .query(async () => {
      const schedule = await getUpcomingPayoutSchedule();
      
      return {
        success: true,
        schedule,
        total: schedule.length,
        message: "Upcoming payout schedule retrieved successfully",
      };
    }),

  // Get payout processing statistics (admin only)
  getProcessingStats: adminProcedure
    .query(async () => {
      const stats = await getPayoutProcessingStats();
      
      return {
        success: true,
        stats,
        message: "Payout processing statistics retrieved successfully",
      };
    }),

  // Get user's payout timeline (protected)
  getUserPayoutTimeline: protectedProcedure
    .input(getUserPayoutsSchema)
    .query(async ({ input, ctx }) => {
      // Users can only see their own payout timeline
      if (input.userId !== ctx.user.id.toString()) {
        throw new Error("Unauthorized: You can only view your own payout timeline");
      }

      const timeline = await getUserPayoutTimeline(Number(input.userId));

      return {
        success: true,
        timeline,
        total: timeline.length,
        message: "User payout timeline retrieved successfully",
      };
    }),

  // Get current user's payout timeline (protected - no input needed)
  getMyPayoutTimeline: protectedProcedure
    .query(async ({ ctx }) => {
      const timeline = await getUserPayoutTimeline(ctx.user.id);
      
      return {
        success: true,
        timeline,
        total: timeline.length,
        message: "Your payout timeline retrieved successfully",
      };
    }),
};
