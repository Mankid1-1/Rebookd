import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import * as TenantService from "../services/tenant.service";
import { isAppError } from "./appErrors";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Convert AppError to structured error response
    const cause = error.cause;
    return {
      ...shape,
      data: {
        ...shape.data,
        appError: isAppError(cause)
          ? { code: cause.code, retryable: cause.retryable }
          : undefined,
      },
    };
  },
});

export const createRouter = t.router;
export const router = t.router;
export const publicProcedure = t.procedure;

// ─── Auth middleware ──────────────────────────────────────────────────────────
const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);

// ─── Tenant middleware — resolves tenantId once, injects into ctx ─────────────
const requireTenant = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  const tenantId = await TenantService.getTenantId(ctx.db, ctx.user.id);
  return next({ ctx: { ...ctx, user: ctx.user, tenantId } });
});

// ─── Sentinel gate — block requests to features disabled by sentinel ─────────
const sentinelGate = t.middleware(async ({ ctx, next, path }) => {
  const routerName = path.split(".")[0];
  const featureMap: Record<string, string> = {
    ai: "ai_chat",
    automations: "automations",
    billing: "billing",
    webhooks: "webhooks",
  };
  const feature = featureMap[routerName];
  if (feature && ctx.db) {
    const { isFeatureDisabled } = await import("./sentinel-bridge");
    const disabled = await isFeatureDisabled(ctx.db, feature, (ctx as any).tenantId);
    if (disabled) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "This feature is temporarily disabled for maintenance. Our automated systems are working on a fix.",
      });
    }
  }
  return next();
});

export const tenantProcedure = t.procedure.use(requireTenant).use(sentinelGate);

// ─── Admin middleware ─────────────────────────────────────────────────────────
const requireAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = t.procedure.use(requireAdmin);

// ─── In-memory rate limiter for tRPC procedures ────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Cleanup expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) rateLimitStore.delete(key);
  }
}, 60_000);

/**
 * Creates a tRPC middleware that rate-limits by a key derived from context.
 * @param maxRequests max requests per window
 * @param windowMs window duration in milliseconds
 * @param keyFn function to derive rate-limit key from context (default: userId)
 */
export function createTrpcRateLimit(
  maxRequests: number,
  windowMs: number,
  keyFn?: (ctx: any, path: string) => string,
) {
  return t.middleware(async ({ ctx, next, path }) => {
    const key = keyFn
      ? keyFn(ctx, path)
      : `trpc:${path}:user:${(ctx as any).user?.id ?? 'anon'}`;

    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (entry && entry.resetAt > now) {
      if (entry.count >= maxRequests) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Rate limit exceeded. Please try again shortly.",
        });
      }
      entry.count++;
    } else {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    }

    return next();
  });
}
