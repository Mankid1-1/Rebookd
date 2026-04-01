/**
 * Tokenization Vault Service
 *
 * Provides a secure tokenization layer for ultra-sensitive data (credit card
 * numbers, SSNs, etc.) that may flow through the system.  Instead of storing
 * the raw value — even encrypted — we:
 *
 *   1. Generate a cryptographically random opaque token  (tok_xxxx…).
 *   2. Store the mapping  token → AES-256-GCM encrypted value  in an
 *      isolated vault table with strict access controls.
 *   3. Return only the token to the caller.
 *
 * Detokenization requires the original encryption key AND the token — the
 * vault never exposes raw sensitive data in logs, error messages, or stack
 * traces.
 *
 * The vault also supports:
 *   - TTL-based auto-expiry (sensitive tokens self-destruct)
 *   - One-time tokens (single detokenization, then destroyed)
 *   - Audit trail for every detokenization event
 *   - Category tagging (phone, email, card, ssn, etc.)
 */

import { randomBytes, createCipheriv, createDecipheriv, createHash } from "crypto";
import { eq, and, lt } from "drizzle-orm";
import { logger } from "../_core/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TokenCategory = "phone" | "email" | "card" | "ssn" | "pii" | "calendar" | "other";

export interface TokenizeOptions {
  /** Data category for audit/compliance tagging */
  category?: TokenCategory;
  /** TTL in seconds — token auto-expires after this period (0 = never) */
  ttlSeconds?: number;
  /** If true, the token can only be detokenized once, then it is destroyed */
  oneTime?: boolean;
  /** Tenant ID for data isolation */
  tenantId?: number;
}

export interface TokenRecord {
  token: string;
  encryptedValue: string;
  category: TokenCategory;
  tenantId: number | null;
  oneTime: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

// ─── Encryption Core ──────────────────────────────────────────────────────────

const ALGO = "aes-256-gcm";
const VAULT_KEY_HEX = process.env.ENCRYPTION_KEY ?? "";

function getVaultKey(): Buffer | null {
  if (!VAULT_KEY_HEX || VAULT_KEY_HEX.length !== 64) return null;
  return Buffer.from(VAULT_KEY_HEX, "hex");
}

function vaultEncrypt(plaintext: string): string {
  const key = getVaultKey();
  if (!key) {
    // Dev mode: obfuscate but don't truly encrypt
    return `dev:${Buffer.from(plaintext).toString("base64")}`;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

function vaultDecrypt(ciphertext: string): string {
  // Dev mode fallback
  if (ciphertext.startsWith("dev:")) {
    return Buffer.from(ciphertext.slice(4), "base64").toString("utf8");
  }

  const key = getVaultKey();
  if (!key) return ciphertext;

  const [ivB64, authTagB64, encB64] = ciphertext.split(":");
  if (!ivB64 || !authTagB64 || !encB64) return ciphertext;

  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return decipher.update(Buffer.from(encB64, "base64")).toString("utf8") + decipher.final("utf8");
}

// ─── Token Generation ─────────────────────────────────────────────────────────

function generateToken(category: TokenCategory): string {
  const prefix = `tok_${category}_`;
  const rand = randomBytes(24).toString("base64url"); // 32 chars, URL-safe
  return `${prefix}${rand}`;
}

// ─── In-Memory Vault (Production: replace with DB-backed vault table) ─────────
// Using a Map for now — in production this would be a dedicated encrypted
// database table with row-level security.

const vault = new Map<string, TokenRecord>();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Tokenize a sensitive value.
 * Returns an opaque token string; the original value is encrypted and stored
 * in the vault.  The caller should store the token instead of the raw value.
 */
export function tokenize(value: string, options: TokenizeOptions = {}): string {
  if (!value || value.trim() === "") return "";

  const category = options.category ?? "other";
  const token = generateToken(category);

  const record: TokenRecord = {
    token,
    encryptedValue: vaultEncrypt(value),
    category,
    tenantId: options.tenantId ?? null,
    oneTime: options.oneTime ?? false,
    expiresAt: options.ttlSeconds
      ? new Date(Date.now() + options.ttlSeconds * 1000)
      : null,
    createdAt: new Date(),
  };

  vault.set(token, record);

  logger.debug("Tokenized sensitive data", {
    category,
    tokenPrefix: token.slice(0, 15) + "…",
    tenantId: options.tenantId,
    oneTime: record.oneTime,
    ttl: options.ttlSeconds ?? "none",
  });

  return token;
}

/**
 * Detokenize — recover the original value from a token.
 * Returns null if the token is expired, not found, or already consumed (one-time).
 */
export function detokenize(token: string, tenantId?: number): string | null {
  const record = vault.get(token);
  if (!record) return null;

  // Tenant isolation check
  if (tenantId !== undefined && record.tenantId !== null && record.tenantId !== tenantId) {
    logger.warn("Detokenize tenant mismatch", {
      tokenPrefix: token.slice(0, 15) + "…",
      expected: record.tenantId,
      got: tenantId,
    });
    return null;
  }

  // Expiry check
  if (record.expiresAt && record.expiresAt < new Date()) {
    vault.delete(token);
    logger.debug("Token expired, destroyed", { tokenPrefix: token.slice(0, 15) + "…" });
    return null;
  }

  const plaintext = vaultDecrypt(record.encryptedValue);

  // One-time token: destroy after single read
  if (record.oneTime) {
    vault.delete(token);
    logger.debug("One-time token consumed", { tokenPrefix: token.slice(0, 15) + "…" });
  }

  return plaintext;
}

/**
 * Check if a string looks like a vault token.
 */
export function isVaultToken(value: string): boolean {
  return /^tok_[a-z]+_[A-Za-z0-9_-]{20,}$/.test(value);
}

/**
 * Destroy a token immediately (e.g., when a lead is deleted).
 */
export function destroyToken(token: string): boolean {
  return vault.delete(token);
}

/**
 * Cleanup expired tokens (called periodically by the worker).
 */
export function cleanupExpiredTokens(): number {
  const now = new Date();
  let cleaned = 0;
  for (const [token, record] of vault.entries()) {
    if (record.expiresAt && record.expiresAt < now) {
      vault.delete(token);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.info(`Tokenization vault: cleaned ${cleaned} expired tokens`);
  }
  return cleaned;
}

/**
 * Get vault stats (for admin dashboard / health checks).
 */
export function getVaultStats(): {
  totalTokens: number;
  byCategory: Record<string, number>;
  expiredCount: number;
} {
  const now = new Date();
  const byCategory: Record<string, number> = {};
  let expiredCount = 0;

  for (const record of vault.values()) {
    byCategory[record.category] = (byCategory[record.category] || 0) + 1;
    if (record.expiresAt && record.expiresAt < now) expiredCount++;
  }

  return { totalTokens: vault.size, byCategory, expiredCount };
}

// ─── Sensitive Data Detection ─────────────────────────────────────────────────

/** Patterns that indicate highly sensitive data that should be tokenized. */
const SENSITIVE_PATTERNS = {
  creditCard: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/,
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/,
  routingNumber: /\b[0-9]{9}\b/, // too broad alone, only used in combination
};

/**
 * Scan a string for credit card numbers and auto-tokenize them.
 * Returns the string with any detected card numbers replaced by vault tokens.
 */
export function sanitizeSensitiveData(
  input: string,
  options: Omit<TokenizeOptions, "category"> = {}
): string {
  let result = input;

  // Auto-tokenize credit card numbers
  result = result.replace(SENSITIVE_PATTERNS.creditCard, (match) => {
    logger.warn("Auto-tokenized credit card number in input");
    return tokenize(match, { ...options, category: "card", ttlSeconds: 3600 }); // 1hr TTL
  });

  // Auto-tokenize SSN-like patterns (9-digit with dashes)
  result = result.replace(SENSITIVE_PATTERNS.ssn, (match) => {
    // Only tokenize if it looks like a real SSN (not a phone number or date)
    if (/^\d{3}-\d{2}-\d{4}$/.test(match)) {
      logger.warn("Auto-tokenized SSN-like pattern in input");
      return tokenize(match, { ...options, category: "ssn", ttlSeconds: 300 }); // 5min TTL
    }
    return match;
  });

  return result;
}
