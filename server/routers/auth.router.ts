import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { loginSchema } from "../../shared/schemas/leads";
import { sql, and, eq, gte } from "drizzle-orm";
import { authRateLimits } from "../../drizzle/schema";
import { COOKIE_NAME } from "../../shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sendEmail } from "../_core/email";
import type { Db } from "../_core/context";
import { protectedProcedure, tenantProcedure, publicProcedure, router } from "../_core/trpc";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import * as UserService from "../services/user.service";
import * as AuthService from "../services/auth.service";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  captchaToken: z.string().optional(),
  website: z.string().max(0).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(12),
  password: z.string().min(8, "Password must be at least 8 characters"),
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
      createdAt: new Date(),
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

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    ctx.res.clearCookie(COOKIE_NAME, {
      maxAge: -1,
      ...getSessionCookieOptions(ctx.req),
      secure: true,
      sameSite: "none",
    });
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
      const existing = await UserService.getUserByEmail(db, input.email);
      if (existing?.emailVerifiedAt) throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
      if (existing && !existing.emailVerifiedAt) {
        const verifyToken = await AuthService.createEmailVerificationToken(db, existing.id, input.email);
        await sendVerificationEmail(input.email, verifyToken);
        return { success: true, pendingVerification: true };
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      const openId = randomUUID();
      await UserService.createUser(db, { openId, email: input.email, passwordHash, loginMethod: "password", role: "user", active: true });
      const created = await UserService.getUserByOpenId(db, openId);
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user" });
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
      ctx.res.cookie(COOKIE_NAME, user.openId, { ...getSessionCookieOptions(ctx.req), httpOnly: true, secure: true, sameSite: "none" });
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
      return { success: true };
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
