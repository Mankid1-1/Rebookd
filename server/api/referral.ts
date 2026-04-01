/**
 * 🎯 REFERRAL API ROUTES (Legacy)
 *
 * NOTE: This file is NOT imported into the appRouter.
 * The active referral router is in server/routers/referral.router.ts.
 * This file is kept for reference only.
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import * as ReferralService from '../services/referral.service';

export const legacyReferralRouter = {
  // Generate a new referral code for the authenticated user
  generateReferralCode: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = ctx.db ?? await getDb();
      const referralCode = await ReferralService.getOrCreateReferralCode(db, ctx.user.id);
      return {
        success: true,
        referralCode,
        message: "Referral code generated successfully",
      };
    }),

  // Process a referral code during signup/registration
  processReferral: publicProcedure
    .input(z.object({
      referralCode: z.string().min(6).max(16),
      referredUserId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      return ReferralService.processReferral(db, input.referralCode, input.referredUserId);
    }),

  // Get referral statistics for the authenticated user
  getReferralStats: protectedProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db ?? await getDb();
      const stats = await ReferralService.getReferralStats(db, ctx.user.id);
      return {
        success: true,
        stats: {
          totalReferrals: stats.totalReferrals,
          completedReferrals: stats.completedReferrals,
          pendingReferrals: stats.pendingReferrals,
          totalEarned: stats.totalEarned,
          availableForPayout: stats.pendingPayout,
          lifetimeEarnings: stats.lifetimeEarnings,
        }
      };
    }),

  // Get user's payout history
  getUserPayouts: protectedProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db ?? await getDb();
      const payouts = await ReferralService.getUserPayouts(db, ctx.user.id);
      return { success: true, payouts, total: payouts.length };
    }),

  // Get referral leaderboard
  getLeaderboard: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      const db = await getDb();
      const leaderboard = await ReferralService.getReferralLeaderboard(db, input.limit);
      return { success: true, leaderboard, total: leaderboard.length };
    }),

  // Clean up expired referrals (admin only)
  cleanupExpiredReferrals: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new Error("Admin access required");
      const db = ctx.db ?? await getDb();
      const cleanedCount = await ReferralService.cleanupExpiredReferrals(db);
      return { success: true, cleanedCount, message: `Cleaned up ${cleanedCount} expired referrals` };
    }),
};
