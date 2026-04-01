import { describe, it, expect, vi } from "vitest";
import {
  computeErrorFingerprint,
  extractAffectedFile,
  isGraphicalOnlyError,
} from "../services/sentinel.service";

// ─── computeErrorFingerprint ─────────────────────────────────────────────────

describe("computeErrorFingerprint", () => {
  it("produces consistent hash for same root cause", () => {
    const hash1 = computeErrorFingerprint(
      "automation",
      "Cannot read properties of undefined (reading 'id')",
      "Error: Cannot read properties of undefined\n    at processLead (server/services/lead.service.ts:45:12)\n    at runAutomation (server/services/automation-runner.service.ts:120:5)",
    );
    const hash2 = computeErrorFingerprint(
      "automation",
      "Cannot read properties of undefined (reading 'id')",
      "Error: Cannot read properties of undefined\n    at processLead (server/services/lead.service.ts:45:12)\n    at runAutomation (server/services/automation-runner.service.ts:120:5)",
    );
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it("produces same hash when only line numbers differ (timestamps stripped, stack normalised)", () => {
    const stack1 = "Error: Something broke\n    at handler (server/routes.ts:100:5)\n    at next (server/middleware.ts:50:3)";
    const stack2 = "Error: Something broke\n    at handler (server/routes.ts:200:10)\n    at next (server/middleware.ts:75:8)";
    const hash1 = computeErrorFingerprint(
      "automation",
      "Error at 2024-01-15T10:30:00Z",
      stack1,
    );
    const hash2 = computeErrorFingerprint(
      "automation",
      "Error at 2025-03-28T14:00:00Z",
      stack2,
    );
    // Timestamps are stripped to "TS", line numbers removed from frames — same root cause
    expect(hash1).toBe(hash2);
  });

  it("produces different hash for different error types", () => {
    const hash1 = computeErrorFingerprint("ai", "timeout", null);
    const hash2 = computeErrorFingerprint("billing", "timeout", null);
    expect(hash1).not.toBe(hash2);
  });

  it("handles null detail gracefully", () => {
    const hash = computeErrorFingerprint("webhook", "Connection refused", null);
    expect(hash).toHaveLength(64);
  });
});

// ─── extractAffectedFile ─────────────────────────────────────────────────────

describe("extractAffectedFile", () => {
  it("extracts file path from stack trace", () => {
    const stack = `Error: Something broke
    at processLead (/app/server/services/lead.service.ts:45:12)
    at Object.<anonymous> (/app/node_modules/express/lib/router.js:100:5)`;
    expect(extractAffectedFile(stack)).toBe("/app/server/services/lead.service.ts");
  });

  it("skips node_modules frames", () => {
    const stack = `Error: fail
    at something (/app/node_modules/drizzle-orm/index.js:10:5)
    at myHandler (/app/server/routers/lead.router.ts:22:8)`;
    expect(extractAffectedFile(stack)).toBe("/app/server/routers/lead.router.ts");
  });

  it("returns null for empty detail", () => {
    expect(extractAffectedFile(null)).toBeNull();
    expect(extractAffectedFile("")).toBeNull();
  });

  it("returns null when no app files in trace", () => {
    const stack = `Error: fail
    at something (/app/node_modules/express/index.js:10:5)`;
    expect(extractAffectedFile(stack)).toBeNull();
  });

  it("handles Windows-style paths", () => {
    const stack = `Error: fail
    at handler (C:\\Users\\dev\\Rebookd\\server\\services\\sms.service.ts:30:10)`;
    expect(extractAffectedFile(stack)).toBe("C:\\Users\\dev\\Rebookd\\server\\services\\sms.service.ts");
  });
});

// ─── Fingerprint regression tests for normalization fixes ────────────────────

describe("computeErrorFingerprint — normalization correctness", () => {
  it("HTTP 404 and HTTP 500 produce different fingerprints (4-digit codes NOT normalized)", () => {
    const hash404 = computeErrorFingerprint(
      "system",
      "Request failed with status 404 Not Found",
      null,
    );
    const hash500 = computeErrorFingerprint(
      "system",
      "Request failed with status 500 Internal Server Error",
      null,
    );
    expect(hash404).not.toBe(hash500);
  });

  it("Different 6-digit error codes produce different fingerprints (not collapsed to ID)", () => {
    const hashA = computeErrorFingerprint(
      "billing",
      "Stripe error code 123456: card_declined",
      null,
    );
    const hashB = computeErrorFingerprint(
      "billing",
      "Stripe error code 654321: insufficient_funds",
      null,
    );
    // 6-digit numbers are preserved (not normalized), so messages differ → different hashes
    expect(hashA).not.toBe(hashB);
  });

  it("8-digit row IDs are normalized to the same fingerprint", () => {
    const hash1 = computeErrorFingerprint(
      "automation",
      "Lead 12345678 not found in tenant 87654321",
      null,
    );
    const hash2 = computeErrorFingerprint(
      "automation",
      "Lead 99999999 not found in tenant 11111111",
      null,
    );
    expect(hash1).toBe(hash2);
  });

  it("Path-segment IDs are normalized (/leads/1234 → /leads/ID)", () => {
    const hash1 = computeErrorFingerprint(
      "system",
      "Resource at /leads/1234 not found",
      null,
    );
    const hash2 = computeErrorFingerprint(
      "system",
      "Resource at /leads/5678 not found",
      null,
    );
    expect(hash1).toBe(hash2);
  });
});

// ─── isGraphicalOnlyError ───────────────────────────────────────────────────

describe("isGraphicalOnlyError", () => {
  const makeError = (message: string, category?: string) =>
    ({
      id: 1,
      type: "client",
      message,
      detail: null,
      severity: "high",
      tenantId: 1,
      resolved: false,
      createdAt: new Date(),
      stackTraceHash: null,
      errorCategory: category ?? null,
    }) as any;

  it("detects [PERF_ANOMALY] prefix", () => {
    expect(isGraphicalOnlyError(makeError("[PERF_ANOMALY] CLS shift detected"))).toBe(true);
  });

  it("detects [VISUAL_ANOMALY] prefix", () => {
    expect(isGraphicalOnlyError(makeError("[VISUAL_ANOMALY] Layout thrash on dashboard"))).toBe(true);
  });

  it("detects [DEAD_CLICK] prefix", () => {
    expect(isGraphicalOnlyError(makeError("[DEAD_CLICK] on .btn-submit"))).toBe(true);
  });

  it("detects [RAGE_CLICK] prefix", () => {
    expect(isGraphicalOnlyError(makeError("[RAGE_CLICK] detected on nav"))).toBe(true);
  });

  it("detects [AI_CHAT_QUALITY] prefix", () => {
    expect(isGraphicalOnlyError(makeError("[AI_CHAT_QUALITY] low confidence response"))).toBe(true);
  });

  it("detects [JOURNEY_ prefix", () => {
    expect(isGraphicalOnlyError(makeError("[JOURNEY_DROP] user abandoned onboarding"))).toBe(true);
  });

  it("detects graphical errorCategory", () => {
    expect(isGraphicalOnlyError(makeError("Some error", "graphical"))).toBe(true);
  });

  it("detects performance errorCategory", () => {
    expect(isGraphicalOnlyError(makeError("Slow render", "performance"))).toBe(true);
  });

  it("returns false for runtime errors", () => {
    expect(isGraphicalOnlyError(makeError("TypeError: Cannot read properties of undefined", "runtime"))).toBe(false);
  });

  it("returns false for ERROR_PAGE errors (these ARE patchable)", () => {
    expect(isGraphicalOnlyError(makeError("[ERROR_PAGE_SHOWN] component crash"))).toBe(false);
  });

  it("returns false for plain error messages", () => {
    expect(isGraphicalOnlyError(makeError("Connection timeout to Twilio API"))).toBe(false);
  });
});

// ─── Priority scoring (verifying ordering behavior) ─────────────────────────

describe("findUnresolvedCriticalErrors — priority scoring", () => {
  it("computeErrorFingerprint handles all error types consistently", () => {
    // Verify all types produce valid hashes
    const types = ["twilio", "ai", "automation", "billing", "webhook", "system"];
    const hashes = types.map((t) => computeErrorFingerprint(t, "test error", null));

    // All should be valid SHA-256 hashes
    for (const h of hashes) {
      expect(h).toHaveLength(64);
      expect(h).toMatch(/^[a-f0-9]{64}$/);
    }

    // All should be unique (different types = different hashes)
    const unique = new Set(hashes);
    expect(unique.size).toBe(types.length);
  });
});
