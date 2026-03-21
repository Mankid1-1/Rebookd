/**
 * PII field encryption — AES-256-GCM symmetric encryption for phone numbers,
 * names, and other sensitive lead data stored in the database.
 *
 * Key: ENCRYPTION_KEY env var — 32-byte hex string (64 hex chars).
 * Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * If ENCRYPTION_KEY is not set, data is stored in plaintext (dev mode).
 * In production, always set ENCRYPTION_KEY.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const KEY_HEX = process.env.ENCRYPTION_KEY ?? "";

function getKey(): Buffer | null {
  if (!KEY_HEX || KEY_HEX.length !== 64) return null;
  return Buffer.from(KEY_HEX, "hex");
}

/**
 * Encrypt a plaintext string. Returns a compact string: `iv:authTag:ciphertext`
 * all base64-encoded. Returns plaintext unchanged if no key is configured.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext; // dev mode — no encryption

  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a value produced by `encrypt()`. Returns the original string.
 * If the value doesn't look encrypted (no colons), returns it as-is
 * (handles plaintext values stored before encryption was enabled).
 */
export function decrypt(value: string): string {
  const key = getKey();
  if (!key) return value; // dev mode

  const parts = value.split(":");
  if (parts.length !== 3) return value; // not encrypted — legacy plaintext

  const [ivB64, authTagB64, ciphertextB64] = parts;
  try {
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");

    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
  } catch {
    // Decryption failed — return raw value rather than crashing
    return value;
  }
}

/** Encrypt only if the value is not already encrypted. */
export function encryptIfNeeded(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  // Already encrypted values contain exactly 2 colons
  if (value.split(":").length === 3) return value;
  return encrypt(value);
}
