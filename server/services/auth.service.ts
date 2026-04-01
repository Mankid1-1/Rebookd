import { and, desc, eq, isNull, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  apiKeys,
  emailVerificationTokens,
  passwordResetTokens,
  users,
} from "../../drizzle/schema";
import type { User } from "../../drizzle/schema";
import type { Db } from "../_core/context";

const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 2; // 2 hours (security: limit token hijack window)
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;

// Password policy configuration
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  forbiddenPatterns: RegExp[];
  maxCommonPasswords: number;
}

export const PASSWORD_POLICY: PasswordPolicy = {
  minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || "12", 10),
  requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== "false",
  requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== "false",
  requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== "false",
  requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL !== "false",
  forbiddenPatterns: [
    // No sequences like 123, abc
    /(.)\1{2,}/, // Repeated characters
    /123|234|345|456|567|678|789|890|012/i, // Number sequences
    /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i, // Letter sequences
    /qwerty|asdf|zxcv|password|admin|letmein|welcome/i, // Common patterns
  ],
  maxCommonPasswords: 1000, // Check against common passwords list
};

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let strength: 'weak' | 'medium' | 'strong' | 'very-strong' = 'weak';

  // Length check
  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters long`);
  }

  // Uppercase check
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Lowercase check
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Numbers check
  if (PASSWORD_POLICY.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Special characters check
  if (PASSWORD_POLICY.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Forbidden patterns check
  for (const pattern of PASSWORD_POLICY.forbiddenPatterns) {
    if (pattern.test(password)) {
      errors.push('Password contains forbidden patterns (sequences or common words)');
      break;
    }
  }

  // Calculate strength
  const score = calculatePasswordStrength(password);
  if (score >= 80) strength = 'very-strong';
  else if (score >= 60) strength = 'strong';
  else if (score >= 40) strength = 'medium';
  else strength = 'weak';

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
}

function calculatePasswordStrength(password: string): number {
  let score = 0;

  // Length contribution
  score += Math.min(password.length * 2, 20);

  // Character variety
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/\d/.test(password)) score += 10;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 15;

  // Complexity bonus
  const uniqueChars = new Set(password).size;
  score += Math.min(uniqueChars * 2, 15);

  // Penalties
  if (/(.)\1{2,}/.test(password)) score -= 10; // Repeated chars
  if (/123|234|345|456|567|678|789|890|012/i.test(password)) score -= 10; // Sequences
  if (/qwerty|asdf|zxcv|password|admin/i.test(password)) score -= 15; // Common patterns

  return Math.max(0, Math.min(100, score));
}

export async function hashPassword(password: string): Promise<string> {
  const validation = validatePassword(password);
  if (!validation.isValid) {
    throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
  }
  
  const saltRounds = parseInt(process.env.PASSWORD_SALT_ROUNDS || "12", 10);
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function newToken(prefix: string) {
  return `${prefix}_${crypto.randomBytes(24).toString("hex")}`;
}

export async function getApiKeys(db: Db, tenantId: number) {
  return db.select().from(apiKeys).where(eq(apiKeys.tenantId, tenantId)).orderBy(desc(apiKeys.createdAt));
}

export async function createApiKey(db: Db, tenantId: number, keyHash: string, keyPrefix: string, label?: string) {
  await db.insert(apiKeys).values({ tenantId, keyHash, keyPrefix, label });
  return { success: true };
}

export async function revokeApiKey(db: Db, tenantId: number, keyId: number) {
  await db.update(apiKeys).set({ active: false }).where(and(eq(apiKeys.id, keyId), eq(apiKeys.tenantId, tenantId)));
}

export async function resolveUserFromApiKey(db: Db, rawKey: string): Promise<User | null> {
  if (!rawKey.startsWith("rk_")) return null;
  const prefix = rawKey.slice(0, 7);
  const candidates = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyPrefix, prefix), eq(apiKeys.active, true)));
  for (const row of candidates) {
    const ok = await bcrypt.compare(rawKey, row.keyHash);
    if (!ok) continue;
    const [u] = await db.select().from(users).where(eq(users.tenantId, row.tenantId)).limit(1);
    return u ?? null;
  }
  return null;
}

export async function createEmailVerificationToken(db: Db, userId: number, email: string) {
  const rawToken = newToken("verify");
  const tokenHash = sha256(rawToken);
  await db
    .update(emailVerificationTokens)
    .set({ consumedAt: sql`NOW()` })
    .where(and(eq(emailVerificationTokens.userId, userId), isNull(emailVerificationTokens.consumedAt)));
  await db.insert(emailVerificationTokens).values({
    userId,
    email,
    tokenHash,
    expiresAt: sql`DATE_ADD(NOW(), INTERVAL ${EMAIL_VERIFICATION_TTL_MS / 1000} SECOND)`,
  });
  return rawToken;
}

export async function consumeEmailVerificationToken(db: Db, rawToken: string) {
  const tokenHash = sha256(rawToken);
  const [row] = await db
    .select()
    .from(emailVerificationTokens)
    .where(and(eq(emailVerificationTokens.tokenHash, tokenHash), isNull(emailVerificationTokens.consumedAt)))
    .orderBy(desc(emailVerificationTokens.createdAt))
    .limit(1);
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;
  await db
    .update(emailVerificationTokens)
    .set({ consumedAt: sql`NOW()` })
    .where(eq(emailVerificationTokens.id, row.id));
  return row;
}

export async function createPasswordResetToken(db: Db, userId: number) {
  const rawToken = newToken("reset");
  const tokenHash = sha256(rawToken);
  await db
    .update(passwordResetTokens)
    .set({ consumedAt: sql`NOW()` })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.consumedAt)));
  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash,
    expiresAt: sql`DATE_ADD(NOW(), INTERVAL ${PASSWORD_RESET_TTL_MS / 1000} SECOND)`,
  });
  return rawToken;
}

export async function consumePasswordResetToken(db: Db, rawToken: string) {
  const tokenHash = sha256(rawToken);
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.consumedAt)))
    .orderBy(desc(passwordResetTokens.createdAt))
    .limit(1);
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;
  await db
    .update(passwordResetTokens)
    .set({ consumedAt: sql`NOW()` })
    .where(eq(passwordResetTokens.id, row.id));
  return row;
}
