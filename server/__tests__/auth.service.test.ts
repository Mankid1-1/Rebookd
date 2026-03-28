import { describe, it, expect, vi, beforeEach } from "vitest";
import { validatePassword, PASSWORD_POLICY } from "../services/auth.service";

describe("validatePassword", () => {
  it("rejects passwords shorter than minimum length", () => {
    const result = validatePassword("Ab1!");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining("at least")
    );
  });

  it("rejects passwords without uppercase when required", () => {
    const result = validatePassword("abcdefgh1234!@#$");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining("uppercase")
    );
  });

  it("rejects passwords without lowercase when required", () => {
    const result = validatePassword("ABCDEFGH1234!@#$");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining("lowercase")
    );
  });

  it("rejects passwords without numbers when required", () => {
    const result = validatePassword("Abcdefghijkl!@#$");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining("number")
    );
  });

  it("rejects passwords without special characters when required", () => {
    const result = validatePassword("Abcdefghij1234");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining("special character")
    );
  });

  it("rejects passwords with forbidden patterns", () => {
    const result = validatePassword("Password123!@#$");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining("forbidden patterns")
    );
  });

  it("accepts a strong valid password", () => {
    const result = validatePassword("Tr0ub4dor&Hx9!z");
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns strength rating", () => {
    const result = validatePassword("Tr0ub4dor&Hx9!z");
    expect(["weak", "medium", "strong", "very-strong"]).toContain(
      result.strength
    );
  });

  it("rates short simple passwords as weak", () => {
    const result = validatePassword("a");
    expect(result.strength).toBe("weak");
  });
});
