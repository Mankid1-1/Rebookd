import { desc, eq, and, ne, sql } from "drizzle-orm";
import { referrals, referralPayouts } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { getOrCreateReferralCode } from "../services/referral.service";

function buildReferralLink(code: string): string {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return `${appUrl}/signup?ref=${code}`;
}

// Use the canonical service function — crypto-secure, HMAC-signed, status-filtered
async function getOrCreateCode(db: any, userId: number): Promise<string> {
  return getOrCreateReferralCode(db, userId);
}

async function computeStats(db: any, userId: number) {
  const allReferrals = await db
    .select()
    .from(referrals)
    .where(and(eq(referrals.referrerId, userId), ne(referrals.referredUserId, userId)))
    .limit(500);

  const completedPayouts = await db
    .select()
    .from(referralPayouts)
    .where(and(eq(referralPayouts.userId, userId), eq(referralPayouts.status, "completed")))
    .limit(500);

  const pendingPayoutRows = await db
    .select()
    .from(referralPayouts)
    .where(and(eq(referralPayouts.userId, userId), eq(referralPayouts.status, "pending")))
    .limit(100);

  const totalEarned = completedPayouts.reduce((s: number, p: any) => s + p.amount, 0);
  const pendingAmount = pendingPayoutRows.reduce((s: number, p: any) => s + p.amount, 0);
  const completed = allReferrals.filter((r: any) => r.status === "completed");

  return {
    totalEarned: totalEarned / 100,
    pendingPayouts: pendingAmount / 100,
    pendingPayout: pendingAmount / 100,         // alias for client compat
    lifetimeEarnings: totalEarned / 100,
    activeReferrals: completed.length,
    completedReferrals: completed.length,        // alias for client compat
    totalReferrals: allReferrals.length,
    nextPayoutDate: pendingPayoutRows.length > 0 ? pendingPayoutRows[0].createdAt?.toISOString() : null,
  };
}

export const referralRouter = router({
  // ─── Primary endpoints (canonical names) ─────────────────────────────────

  getMyCode: protectedProcedure.query(async ({ ctx }) => {
    const code = await getOrCreateCode(ctx.db, ctx.user!.id);
    return { code, link: buildReferralLink(code) };
  }),

  // Alias: client pages use trpc.referral.getCode
  getCode: protectedProcedure.query(async ({ ctx }) => {
    const code = await getOrCreateCode(ctx.db, ctx.user!.id);
    return { code, link: buildReferralLink(code) };
  }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    return computeStats(ctx.db, ctx.user!.id);
  }),

  // Alias: client pages use trpc.referral.stats
  stats: protectedProcedure.query(async ({ ctx }) => {
    return computeStats(ctx.db, ctx.user!.id);
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user!.id;

    const myReferrals = await ctx.db
      .select()
      .from(referrals)
      .where(and(eq(referrals.referrerId, userId), ne(referrals.referredUserId, userId)))
      .orderBy(desc(referrals.createdAt))
      .limit(200);

    return myReferrals.map(r => ({
      id: String(r.id),
      code: r.referralCode,
      referralCode: r.referralCode,
      // Both field names for client compat
      referredAt: r.createdAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      payoutScheduledAt: r.payoutScheduledAt?.toISOString() ?? null,
      status: r.status,
      rewardAmount: r.rewardAmount,
      monthsActive: r.completedAt
        ? Math.min(6, Math.floor((Date.now() - r.completedAt.getTime()) / (30 * 24 * 60 * 60 * 1000)) + 1)
        : 0,
      totalEarned: r.rewardAmount * (r.completedAt
        ? Math.min(6, Math.floor((Date.now() - r.completedAt.getTime()) / (30 * 24 * 60 * 60 * 1000)) + 1)
        : 0),
      nextPayoutDate: r.payoutScheduledAt?.toISOString() ?? null,
    }));
  }),

  // Aliases used by Referrals.tsx (different naming convention)
  getReferralStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user!.id;
    const stats = await computeStats(ctx.db, userId);
    const code = await getOrCreateCode(ctx.db, userId);

    return {
      stats: {
        referralCode: code,
        totalReferrals: stats.totalReferrals,
        completedReferrals: stats.completedReferrals,
        totalEarned: stats.totalEarned,
        availableForPayout: stats.pendingPayout,
      },
    };
  }),

  getUserReferrals: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user!.id;

    const myReferrals = await ctx.db
      .select()
      .from(referrals)
      .where(and(eq(referrals.referrerId, userId), ne(referrals.referredUserId, userId)))
      .orderBy(desc(referrals.createdAt))
      .limit(200);

    return {
      referrals: myReferrals.map(r => ({
        id: String(r.id),
        code: r.referralCode,
        createdAt: r.createdAt.toISOString(),
        status: r.status,
        rewardAmount: r.rewardAmount / 100,
      })),
    };
  }),

  generateReferralCode: protectedProcedure.mutation(async ({ ctx }) => {
    const code = await getOrCreateCode(ctx.db, ctx.user!.id);
    return { code, link: buildReferralLink(code) };
  }),

  leaderboard: protectedProcedure.query(async ({ ctx }) => {
    const results = await ctx.db
      .select({
        referrerId: referrals.referrerId,
        count: sql<number>`count(*)`,
        totalEarned: sql<number>`sum(${referrals.rewardAmount})`,
      })
      .from(referrals)
      .where(and(eq(referrals.status, "completed"), ne(referrals.referredUserId, referrals.referrerId)))
      .groupBy(referrals.referrerId)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    return results.map((r, i) => {
      const isYou = r.referrerId === ctx.user!.id;
      return {
        rank: i + 1,
        isYou,
        referralCount: Number(r.count),
        totalEarned: isYou ? Number(r.totalEarned ?? 0) : null,
      };
    });
  }),
});
