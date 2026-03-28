import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import type { User } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { sdk } from "./sdk";
import * as AuthService from "../services/auth.service";

export type Db = MySql2Database<typeof schema>;

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  db: Db;
  tenantId?: number;
  correlationId?: string;
  authViaApiKey?: boolean;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  const { getDb } = await import("../db");
  const dbRaw = await getDb();
  if (!dbRaw) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Service temporarily unavailable — please retry",
    });
  }
  const db = dbRaw;

  let user: User | null = null;
  let authViaApiKey = false;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }

  if (!user && db) {
    const bearer = opts.req.headers.authorization;
    if (bearer?.startsWith("Bearer rk_")) {
      user = await AuthService.resolveUserFromApiKey(db, bearer.slice(7));
      authViaApiKey = !!user;
    } else {
      const xk = opts.req.headers["x-api-key"];
      if (typeof xk === "string" && xk.startsWith("rk_")) {
        user = await AuthService.resolveUserFromApiKey(db, xk);
        authViaApiKey = !!user;
      }
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    db,
    correlationId: (opts.req as { correlationId?: string }).correlationId,
    authViaApiKey,
  };
}
