/**
 * 🎯 REFERRAL API ROUTES
 * TRPC procedures for the referral system
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure } from '../_core/trpc';
import * as ReferralService from '../services/referral.service';

// Validation schemas
const generateReferralCodeSchema = z.object({
  userId: z.string().optional(),
});

const processReferralSchema = z.object({
  referralCode: z.string().min(6).max(16),
  referredUserId: z.string().optional(),
});

const completeReferralSchema = z.object({
  referralId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  subscriptionMonths: z.number().min(6),
});

const getReferralStatsSchema = z.object({
  userId: z.string().uuid(),
});

const getUserReferralsSchema = z.object({
  userId: z.string().uuid(),
  limit: z.number().min(1).max(100).default(10),
});

const requestPayoutSchema = z.object({
  userId: z.string().uuid(),
  method: z.enum(['paypal', 'stripe', 'bank_transfer']),
});

const getUserPayoutsSchema = z.object({
  userId: z.string().uuid(),
});

const getLeaderboardSchema = z.object({
  limit: z.number().min(1).max(50).default(10),
  timeframe: z.enum(['all', 'month', 'year']).default('all'),
});

export const referralRouter = {
  // Generate a new referral code for the authenticated user
  generateReferralCode: protectedProcedure
    .input(generateReferralCodeSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const referralCode = await ReferralService.generateReferralCode(String(userId));
      
      return {
        success: true,
        referralCode,
        message: "Referral code generated successfully",
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      };
    }),

  // Process a referral code during signup/registration
  processReferral: publicProcedure
    .input(processReferralSchema)
    .mutation(async ({ input }) => {
      const result = await ReferralService.processReferral(
        input.referralCode,
        input.referredUserId
      );
      
      return result;
    }),

  // Complete a referral when subscription meets requirements
  completeReferral: protectedProcedure
    .input(completeReferralSchema)
    .mutation(async ({ input, ctx }) => {
      const referral = await ReferralService.completeReferral(
        input.referralId,
        input.subscriptionId,
        input.subscriptionMonths
      );
      
      return {
        success: true,
        referral,
        message: "Referral completed successfully! $50 reward credited.",
        rewardAmount: 50,
      };
    }),

  // Get referral statistics for the authenticated user
  getReferralStats: protectedProcedure
    .input(getReferralStatsSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const stats = await ReferralService.getReferralStats(String(userId));
      
      return {
        success: true,
        stats: {
          totalReferrals: stats.totalReferrals,
          completedReferrals: stats.completedReferrals,
          pendingReferrals: stats.pendingReferrals,
          totalEarned: stats.totalEarned,
          availableForPayout: stats.availableForPayout,
          lifetimeEarnings: stats.lifetimeEarnings,
        }
      };
    }),

  // Get all referrals for the authenticated user
  getUserReferrals: protectedProcedure
    .input(getUserReferralsSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const referrals = await ReferralService.getUserReferrals(String(userId));
      
      return {
        success: true,
        referrals,
        total: referrals.length,
      };
    }),

  // Request payout of available referral earnings
  requestPayout: protectedProcedure
    .input(requestPayoutSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const payout = await ReferralService.requestPayout(String(userId), input.method);
      
      return {
        success: true,
        payout,
        message: "Payout request submitted successfully",
      };
    }),

  // Get user's payout history
  getUserPayouts: protectedProcedure
    .input(getUserPayoutsSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const payouts = await ReferralService.getUserPayouts(String(userId));
      
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
  cleanupExpiredReferrals: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Only admins can cleanup expired referrals
      if (ctx.user.role !== 'admin') {
        throw new Error("Admin access required");
      }

      const cleanedCount = await ReferralService.cleanupExpiredReferrals();
      
      return {
        success: true,
        cleanedCount,
        message: `Cleaned up ${cleanedCount} expired referrals`,
      };
    }),
};
