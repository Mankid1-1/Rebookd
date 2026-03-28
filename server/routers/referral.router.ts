import { desc, eq, and, sql } from "drizzle-orm";
import { referrals, referralPayouts } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { randomUUID } from "crypto";

export const referralRouter = router({
  getMyCode: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user!.id;
    const existing = await ctx.db
      .select({ referralCode: referrals.referralCode })
      .from(referrals)
      .where(eq(referrals.referrerId, userId))
      .limit(1);

    if (existing.length > 0) {
      return { code: existing[0].referralCode };
    }

    // Generate a new referral code
    const code = `RB-${randomUUID().slice(0, 8).toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);

    await ctx.db.insert(referrals).values({
      referrerId: userId,
      referredUserId: 0, // placeholder until someone signs up
      referralCode: code,
      status: "pending",
      rewardAmount: 50,
      rewardCurrency: "USD",
      expiresAt,
    });

    return { code };
  }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user!.id;

    const allReferrals = await ctx.db
      .select()
      .from(referrals)
      .where(and(eq(referrals.referrerId, userId), sql`${referrals.referredUserId} != 0`));

    const completedPayouts = await ctx.db
      .select()
      .from(referralPayouts)
      .where(and(eq(referralPayouts.userId, userId), eq(referralPayouts.status, "completed")));

    const pendingPayouts = await ctx.db
      .select()
      .from(referralPayouts)
      .where(and(eq(referralPayouts.userId, userId), eq(referralPayouts.status, "pending")));

    const totalEarned = completedPayouts.reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);

    return {
      totalEarned: totalEarned / 100,
      pendingPayouts: pendingAmount / 100,
      lifetimeEarnings: totalEarned / 100,
      activeReferrals: allReferrals.filter(r => r.status === "completed").length,
      totalReferrals: allReferrals.length,
      nextPayoutDate: pendingPayouts.length > 0 ? pendingPayouts[0].createdAt?.toISOString() : null,
    };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user!.id;

    const myReferrals = await ctx.db
      .select()
      .from(referrals)
      .where(and(eq(referrals.referrerId, userId), sql`${referrals.referredUserId} != 0`))
      .orderBy(desc(referrals.createdAt));

    return myReferrals.map(r => ({
      id: String(r.id),
      code: r.referralCode,
      referredAt: r.createdAt.toISOString(),
      status: r.status === "completed" ? "active" as const : r.status === "expired" ? "expired" as const : "churned" as const,
      monthsActive: r.completedAt
        ? Math.min(6, Math.floor((Date.now() - r.completedAt.getTime()) / (30 * 24 * 60 * 60 * 1000)) + 1)
        : 0,
      totalEarned: r.rewardAmount * (r.completedAt
        ? Math.min(6, Math.floor((Date.now() - r.completedAt.getTime()) / (30 * 24 * 60 * 60 * 1000)) + 1)
        : 0),
      nextPayoutDate: r.payoutScheduledAt?.toISOString() ?? null,
    }));
  }),

  leaderboard: protectedProcedure.query(async ({ ctx }) => {
    const results = await ctx.db
      .select({
        referrerId: referrals.referrerId,
        count: sql<number>`count(*)`,
        totalEarned: sql<number>`sum(${referrals.rewardAmount})`,
      })
      .from(referrals)
      .where(and(eq(referrals.status, "completed"), sql`${referrals.referredUserId} != 0`))
      .groupBy(referrals.referrerId)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    return results.map((r, i) => ({
      rank: i + 1,
      referrerId: r.referrerId,
      isYou: r.referrerId === ctx.user!.id,
      referralCount: Number(r.count),
      totalEarned: Number(r.totalEarned ?? 0),
    }));
  }),
});
