import { eq, desc, sql } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import type { Db } from "../_core/context";

export async function getUserById(db: Db, id: number) {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByEmail(db: Db, email: string) {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function getUserByOpenId(db: Db, openId: string) {
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getAllUsers(db: Db, page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const [rows, countRows] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(users),
  ]);
  return { rows, total: Number(countRows[0]?.count ?? 0) };
}

export async function updateUserActive(db: Db, userId: number, active: boolean) {
  await db.update(users).set({ active, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function createUser(
  db: Db,
  data: {
    openId: string;
    name?: string;
    email?: string;
    loginMethod?: "email" | "phone" | "sso" | "oauth" | "google" | "microsoft";
    passwordHash?: string;
    role?: "user" | "admin";
    accountType?: "business" | "referral";
    active?: boolean;
    lastSignedIn?: Date;
  },
) {
  await db.insert(users).values(data);
}

export async function setUserPasswordHash(db: Db, userId: number, passwordHash: string) {
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
}

/** Insert or update by openId — used by OAuth session sync */
export async function upsertUser(
  db: Db,
  data: {
    openId: string;
    name?: string;
    email?: string;
    loginMethod?: "email" | "phone" | "sso" | "oauth" | "google" | "microsoft";
    lastSignedIn?: Date;
  },
) {
  const existing = await getUserByOpenId(db, data.openId);
  if (existing) {
    await db
      .update(users)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.loginMethod !== undefined ? { loginMethod: data.loginMethod } : {}),
        ...(data.lastSignedIn ? { lastSignedIn: data.lastSignedIn } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
  } else {
    await db.insert(users).values({
      openId: data.openId ?? crypto.randomUUID(),
      name: data.name ?? null,
      email: data.email ?? null,
      loginMethod: data.loginMethod ?? "email",
      lastSignedIn: data.lastSignedIn ?? new Date(),
    });
  }
}

export async function updateLastSignedIn(db: Db, userId: number) {
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function getPrimaryUserEmailByTenant(db: Db, tenantId: number) {
  const result = await db.select().from(users).where(eq(users.tenantId, tenantId)).orderBy(users.id).limit(1);
  return result[0]?.email;
}

export async function verifyUserEmail(db: Db, userId: number) {
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}
