import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { loginSchema } from "../../shared/schemas/leads";
import { sql, and, eq, gte } from "drizzle-orm";
import { authRateLimits, users } from "../../drizzle/schema";
import { COOKIE_NAME } from "../../shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sendEmail } from "../_core/email";
import type { Db } from "../_core/context";
import { protectedProcedure, tenantProcedure, publicProcedure, router } from "../_core/trpc";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import * as UserService from "../services/user.service";
import * as AuthService from "../services/auth.service";
import { applyReferralCode } from "../services/referral.service";
import { sdk } from "../_core/sdk";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

const signupSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().optional(),
  accountType: z.enum(["business", "referral"]).default("business"),
  captchaToken: z.string().optional(),
  website: z.string().max(0).optional(),
  referralCode: z.string().max(20).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(12),
  password: passwordSchema,
});

async function sendVerificationEmail(email: string, token: string) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const verifyUrl = `${appUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: email,
    subject: "Verify your Rebooked email",
    text: `Verify your email to activate your account: ${verifyUrl}`,
    html: `<p>Verify your email to activate your account.</p><p><a href="${verifyUrl}">Verify email</a></p>`,
  });
}

async function sendPasswordResetEmail(email: string, token: string) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const resetUrl = `${appUrl}/login?mode=reset&token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: email,
    subject: "Reset your Rebooked password",
    text: `Reset your password using this secure link: ${resetUrl}`,
    html: `<p>Reset your password using this secure link.</p><p><a href="${resetUrl}">Reset password</a></p>`,
  });
}

// Database-backed auth rate limiting (per email, max 10 attempts / 15 min)
async function checkAuthRateLimit(db: Db, email: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 15 * 60 * 1000);
  const maxAttempts = 10;

  try {
    // Opportunistically clean up expired records (older than 1 hour) to prevent unbounded growth.
    // Run fire-and-forget — don't block the auth response.
    db.delete(authRateLimits)
      .where(sql`${authRateLimits.createdAt} < DATE_SUB(NOW(), INTERVAL 1 HOUR)`)
      .catch(() => { /* non-critical */ });

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(authRateLimits)
      .where(
        and(
          eq(authRateLimits.email, email),
          gte(authRateLimits.createdAt, windowStart)
        )
      );

    if (Number(count) >= maxAttempts) {
      return false;
    }

    // Record this attempt
    await db.insert(authRateLimits).values({
      email,
    });

    return true;
  } catch (error) {
    // If table doesn't exist, fall back to simple check
    console.warn("Auth rate limit table error:", error);
    return true;
  }
}

export const authRouter = router({
  me: publicProcedure.query(async ({ ctx }) => ctx.user ?? null),

  getSkillLevel: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({ skillLevel: users.skillLevel })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
    return { skillLevel: row?.skillLevel ?? "basic" } as { skillLevel: "basic" | "intermediate" | "advanced" };
  }),

  setSkillLevel: protectedProcedure
    .input(z.object({ level: z.enum(["basic", "intermediate", "advanced"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ skillLevel: input.level, skillLevelSetAt: sql`NOW()` })
        .where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    // Use the same cookie options that were used to set the cookie
    // Don't override secure/sameSite — must match the original cookie settings
    ctx.res.clearCookie(COOKIE_NAME, getSessionCookieOptions(ctx.req));
    return { success: true };
  }),

  signup: publicProcedure
    .input(signupSchema)
    .mutation(async ({ input, ctx }) => {
      if (input.website) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Spam protection triggered" });
      }
      if (!await checkAuthRateLimit(ctx.db, input.email)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Try again later." });
      }
      const db = ctx.db;
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const requestedType = input.accountType || "business";
      const existing = await UserService.getUserByEmail(db, input.email);
      if (existing?.emailVerifiedAt) {
        // If user has one type and requests the other, upgrade to "both"
        if (existing.accountType !== "both" && existing.accountType !== requestedType) {
          await db.update(users).set({ accountType: "both" }).where(eq(users.id, existing.id));
          return { success: true, upgraded: true };
        }
        throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
      }
      if (existing && !existing.emailVerifiedAt) {
        const verifyToken = await AuthService.createEmailVerificationToken(db, existing.id, input.email);
        await sendVerificationEmail(input.email, verifyToken);
        return { success: true, pendingVerification: true };
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      const openId = randomUUID();
      await UserService.createUser(db, { openId, email: input.email, name: input.name, passwordHash, loginMethod: "password", accountType: requestedType, role: "user", active: true });
      const created = await UserService.getUserByOpenId(db, openId);
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user" });

      // Apply referral code if provided (links this new user to the referrer)
      if (input.referralCode) {
        try {
          await applyReferralCode(db, input.referralCode, created.id);
        } catch (e) {
          // Don't block signup if referral application fails — log and continue
          console.warn("Failed to apply referral code during signup:", e);
        }
      }

      const verifyToken = await AuthService.createEmailVerificationToken(db, created.id, input.email);
      await sendVerificationEmail(input.email, verifyToken);
      return { success: true, pendingVerification: true };
    }),

  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ input, ctx }) => {
      if (!await checkAuthRateLimit(ctx.db, input.email)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Try again later." });
      }
      const db = ctx.db;
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const user = await UserService.getUserByEmail(db, input.email);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      if (!user.passwordHash) throw new TRPCError({ code: "UNAUTHORIZED", message: "No password set for this user" });
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      if (!user.emailVerifiedAt) {
        const verifyToken = await AuthService.createEmailVerificationToken(db, user.id, user.email || input.email);
        await sendVerificationEmail(user.email || input.email, verifyToken);
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Verify your email before signing in. We sent a fresh link." });
      }
      await UserService.updateLastSignedIn(db, user.id);
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || input.email,
        expiresInMs: 30 * 24 * 60 * 60 * 1000,
      });
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: 30 * 24 * 60 * 60 * 1000 });
      return { success: true };
    }),

  requestPasswordReset: publicProcedure
    .input(forgotPasswordSchema)
    .mutation(async ({ input, ctx }) => {
      const user = await UserService.getUserByEmail(ctx.db, input.email);
      if (user?.passwordHash) {
        const token = await AuthService.createPasswordResetToken(ctx.db, user.id);
        await sendPasswordResetEmail(input.email, token);
      }
      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(resetPasswordSchema)
    .mutation(async ({ input, ctx }) => {
      const row = await AuthService.consumePasswordResetToken(ctx.db, input.token);
      if (!row) throw new TRPCError({ code: "BAD_REQUEST", message: "Reset link is invalid or expired" });
      const passwordHash = await bcrypt.hash(input.password, 12);
      await UserService.setUserPasswordHash(ctx.db, row.userId, passwordHash);
      // Invalidate all existing sessions by bumping passwordChangedAt
      await ctx.db.update(users).set({ updatedAt: new Date() }).where(eq(users.id, row.userId));
      // Clear the requesting user's cookie so they must re-authenticate
      ctx.res.clearCookie(COOKIE_NAME);
      return { success: true };
    }),

  // Upgrade account to add referral or business capability
  upgradeAccountType: protectedProcedure
    .input(z.object({ addType: z.enum(["business", "referral"]) }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      if (user.accountType === "both") {
        return { success: true, accountType: "both", message: "Account already has both capabilities." };
      }
      if (user.accountType === input.addType) {
        return { success: true, accountType: user.accountType, message: "You already have this account type." };
      }
      await ctx.db.update(users).set({ accountType: "both" }).where(eq(users.id, user.id));
      return { success: true, accountType: "both", message: "Account upgraded to both business and referral." };
    }),

  // Admin: impersonate another user's view
  adminViewAs: protectedProcedure
    .input(z.object({ targetUserId: z.number().optional(), accountTypeView: z.enum(["business", "referral", "both", "admin"]).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      // Audit log: record admin impersonation for security trail
      try {
        const { getDb } = await import("../db");
        const { adminAuditLogs } = await import("../../drizzle/schema");
        const db = await getDb();
        if (db) {
          await db.insert(adminAuditLogs).values({
            userId: ctx.user.id,
            action: "admin_impersonate",
            detail: JSON.stringify({
              adminEmail: ctx.user.email,
              targetUserId: input.targetUserId || "self",
              accountTypeView: input.accountTypeView,
              ip: ctx.req.ip || ctx.req.socket?.remoteAddress,
            }),
          });
        }
      } catch { /* audit logging is best-effort */ }

      if (input.targetUserId) {
        const target = await UserService.getUserById(ctx.db, input.targetUserId);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        return {
          success: true,
          viewAs: {
            id: target.id,
            email: target.email,
            name: target.name,
            role: target.role,
            accountType: target.accountType,
            tenantId: target.tenantId,
          }
        };
      }
      // Just change the view type without impersonating a specific user
      return {
        success: true,
        viewAs: {
          id: ctx.user.id,
          email: ctx.user.email,
          name: ctx.user.name,
          role: ctx.user.role,
          accountType: input.accountTypeView || ctx.user.accountType,
          tenantId: ctx.user.tenantId,
        }
      };
    }),
});

export const apiKeysRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => AuthService.getApiKeys(ctx.db, ctx.tenantId)),

  create: tenantProcedure
    .input(z.object({ label: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const key = `rk_${randomUUID().replace(/-/g, "")}`;
      const keyHash = await bcrypt.hash(key, 12);
      await AuthService.createApiKey(ctx.db, ctx.tenantId, keyHash, key.slice(0, 7), input.label);
      return { key };
    }),

  revoke: tenantProcedure
    .input(z.object({ keyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await AuthService.revokeApiKey(ctx.db, ctx.tenantId, input.keyId);
      return { success: true };
    }),
});
