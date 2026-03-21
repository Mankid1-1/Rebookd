import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const VALID_KEY = "a".repeat(64); // 64 hex chars = 32 bytes

describe("PII encryption — with key", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
    vi.resetModules();
  });

  it("encrypt → decrypt round-trips correctly", async () => {
    const { encrypt, decrypt } = await import("../_core/crypto");
    const plaintext = "+15550001234";
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.split(":")).toHaveLength(3);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("decrypt returns plaintext unchanged when value is not encrypted", async () => {
    const { decrypt } = await import("../_core/crypto");
    expect(decrypt("+15550001234")).toBe("+15550001234");
  });

  it("encryptIfNeeded skips already-encrypted values", async () => {
    const { encrypt, encryptIfNeeded } = await import("../_core/crypto");
    const encrypted = encrypt("hello");
    expect(encryptIfNeeded(encrypted)).toBe(encrypted);
  });

  it("encryptIfNeeded returns null for null input", async () => {
    const { encryptIfNeeded } = await import("../_core/crypto");
    expect(encryptIfNeeded(null)).toBeNull();
  });

  it("two encryptions of same value produce different ciphertexts (random IV)", async () => {
    const { encrypt } = await import("../_core/crypto");
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
  });
});

describe("PII encryption — dev mode (no key)", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.ENCRYPTION_KEY;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns plaintext when ENCRYPTION_KEY is not set", async () => {
    const { encrypt, decrypt } = await import("../_core/crypto");
    expect(encrypt("hello")).toBe("hello");
    expect(decrypt("hello")).toBe("hello");
  });
});
