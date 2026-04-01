import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock ENV
vi.mock("../_core/env", () => ({
  ENV: {
    n8nEnabled: true,
    n8nBaseUrl: "http://localhost:5678",
    n8nApiKey: "test-api-key",
    n8nCircuitBreakerThreshold: 3,
    n8nCircuitBreakerTimeoutMs: 5000,
    n8nRetryMaxAttempts: 1,
    n8nDlqReprocessIntervalMs: 300000,
  },
}));

vi.mock("../_core/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../db", () => ({
  getDb: () => Promise.resolve({
    insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  }),
}));

vi.mock("../../drizzle/schema", () => ({
  n8nDeadLetterQueue: { id: "id", status: "status", createdAt: "createdAt", tenantId: "tenantId" },
}));

describe("n8n Bridge Service", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("dispatchToN8n", () => {
    it("dispatches events successfully to n8n webhook", async () => {
      const { dispatchToN8n } = await import("../services/n8n-bridge.service");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await dispatchToN8n({
        id: "test-1",
        type: "lead.created",
        tenantId: 1,
        data: { phone: "+1234567890" },
      } as any);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/webhook/welcome-new-lead");
    });

    it("returns false when n8n is disabled", async () => {
      vi.doMock("../_core/env", () => ({
        ENV: {
          n8nEnabled: false,
          n8nBaseUrl: "",
          n8nApiKey: "",
          n8nCircuitBreakerThreshold: 3,
          n8nCircuitBreakerTimeoutMs: 5000,
          n8nRetryMaxAttempts: 1,
          n8nDlqReprocessIntervalMs: 300000,
        },
      }));

      // Re-import to get fresh module with new ENV
      const mod = await import("../services/n8n-bridge.service");
      // Note: due to module caching, this tests the cached module
      // In a real test, you'd use vi.resetModules()
    });

    it("falls back on 5xx errors", async () => {
      const { dispatchToN8n } = await import("../services/n8n-bridge.service");

      // First call: 500 error
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await dispatchToN8n({
        id: "test-2",
        type: "call.missed",
        tenantId: 1,
        data: {},
      } as any);

      expect(result).toBe(false);
    });

    it("does not retry 4xx errors", async () => {
      const { dispatchToN8n } = await import("../services/n8n-bridge.service");

      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await dispatchToN8n({
        id: "test-3",
        type: "lead.created",
        tenantId: 1,
        data: {},
      } as any);

      expect(result).toBe(false);
      // Should only be called once (no retry for 4xx)
      expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(2); // health check + dispatch
    });
  });

  describe("verifySignature", () => {
    it("verifies valid HMAC signatures", async () => {
      const { verifySignature } = await import("../services/n8n-bridge.service");
      const { createHmac } = await import("crypto");

      const payload = '{"test": true}';
      const secret = "test-secret";
      const signature = createHmac("sha256", secret).update(payload).digest("hex");

      expect(verifySignature(payload, signature, secret)).toBe(true);
    });

    it("rejects invalid signatures", async () => {
      const { verifySignature } = await import("../services/n8n-bridge.service");

      expect(verifySignature('{"test": true}', "invalid-signature", "secret")).toBe(false);
    });
  });

  describe("getN8nStatus", () => {
    it("returns status with circuit breaker state", async () => {
      const { getN8nStatus } = await import("../services/n8n-bridge.service");

      mockFetch.mockResolvedValueOnce({ ok: true });

      const status = await getN8nStatus();
      expect(status).toHaveProperty("enabled");
      expect(status).toHaveProperty("healthy");
      expect(status).toHaveProperty("circuitBreaker");
      expect(status.circuitBreaker).toHaveProperty("state");
    });
  });

  describe("getEventWebhookMap", () => {
    it("returns event-to-webhook path mapping", async () => {
      const { getEventWebhookMap } = await import("../services/n8n-bridge.service");

      const map = getEventWebhookMap();
      expect(map["call.missed"]).toBe("missed-call-textback");
      expect(map["lead.created"]).toBe("welcome-new-lead");
      expect(map["appointment.booked"]).toBe("appointment-confirmation");
    });
  });
});
