/**
 * REFERRAL API ROUTES
 * tRPC procedures for the referral system
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, adminProcedure } from '../_core/trpc';
import * as ReferralService from '../services/referral.service';

// Validation schemas
const processReferralSchema = z.object({
  referralCode: z.string().min(6).max(16),
});

const completeReferralSchema = z.object({
  referralId: z.number().int().positive(),
  subscriptionId: z.string().min(1),
  subscriptionMonths: z.number().min(6),
});

const requestPayoutSchema = z.object({
  method: z.enum(['paypal', 'stripe', 'bank_transfer']),
});

const getLeaderboardSchema = z.object({
  limit: z.number().min(1).max(50).default(10),
  timeframe: z.enum(['all', 'month', 'year']).default('all'),
});

export const referralRouter = {
  // Generate a new referral code for the authenticated user
  generateReferralCode: protectedProcedure
    .mutation(async ({ ctx }) => {
      const referralCode = await ReferralService.generateReferralCode(ctx.user.id);

      return {
        success: true,
        referralCode,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      };
    }),

  // Process a referral code during signup/registration
  processReferral: publicProcedure
    .input(processReferralSchema)
    .mutation(async ({ input, ctx }) => {
      // Requires a logged-in user to associate the referral
      if (!ctx.user) {
        return { success: false, message: "Must be logged in to use a referral code" };
      }
      const result = await ReferralService.processReferral(
        input.referralCode,
        ctx.user.id,
      );

      return result;
    }),

  // Complete a referral when subscription meets requirements (system/admin only)
  completeReferral: adminProcedure
    .input(completeReferralSchema)
    .mutation(async ({ input }) => {
      await ReferralService.completeReferral(
        input.referralId,
        input.subscriptionId,
        input.subscriptionMonths
      );

      return {
        success: true,
        message: "Referral completed successfully! $50 reward scheduled.",
        rewardAmount: 50,
      };
    }),

  // Get referral statistics for the authenticated user
  getReferralStats: protectedProcedure
    .query(async ({ ctx }) => {
      const stats = await ReferralService.getReferralStats(ctx.user.id);

      return { success: true, stats };
    }),

  // Get all referrals for the authenticated user
  getUserReferrals: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(10) }).optional())
    .query(async ({ input, ctx }) => {
      const referrals = await ReferralService.getUserReferrals(ctx.user.id, input?.limit ?? 10);

      return {
        success: true,
        referrals,
        total: referrals.length,
      };
    }),

  // Request payout of available referral earnings
  requestPayout: protectedProcedure
    .input(requestPayoutSchema)
    .mutation(async ({ ctx, input }) => {
      const payout = await ReferralService.requestPayout(ctx.user.id, input.method);

      return {
        success: true,
        payout,
        message: "Payout request submitted successfully",
      };
    }),

  // Get user's payout history
  getUserPayouts: protectedProcedure
    .query(async ({ ctx }) => {
      const payouts = await ReferralService.getUserPayouts(ctx.user.id);

      return {
        success: true,
        payouts,
        total: payouts.length,
      };
    }),

  // Get referral leaderboard
  getLeaderboard: publicProcedure
    .input(getLeaderboardSchema)
    .query(async ({ input }) => {
      const leaderboard = await ReferralService.getReferralLeaderboard(
        input.limit,
        input.timeframe
      );

      return {
        success: true,
        leaderboard,
        total: leaderboard.length,
      };
    }),

  // Clean up expired referrals (admin only)
  cleanupExpiredReferrals: adminProcedure
    .mutation(async () => {
      const cleanedCount = await ReferralService.cleanupExpiredReferrals();

      return {
        success: true,
        cleanedCount,
        message: `Cleaned up ${cleanedCount} expired referrals`,
      };
    }),
};
