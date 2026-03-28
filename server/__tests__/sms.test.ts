import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock database
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve([]))
      }))
    }))
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => Promise.resolve())
  }))
};

vi.mock("../db", () => ({
  getDb: () => Promise.resolve(mockDb)
}));

vi.mock("../services/rate-limit.service", () => ({
  assertSmsRateLimitAvailable: () => Promise.resolve(),
  assertSmsHourlyDailyLimits: () => Promise.resolve(),
}));

vi.mock("../services/usage.service", () => ({
  assertUsageCapAvailable: () => Promise.resolve(),
}));

describe("SMS provider selection", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    vi.clearAllMocks();
    delete process.env.TELNYX_API_KEY;
    delete process.env.TELNYX_FROM_NUMBER;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
  });

  it("uses Telnyx when TELNYX_API_KEY is set", async () => {
    process.env.TELNYX_API_KEY = "KEY0test";
    process.env.TELNYX_FROM_NUMBER = "+15550000001";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: { id: "telnyx-msg-id" } }),
      json: async () => ({ data: { id: "telnyx-msg-id" } }),
    });

    const { sendSMS } = await import("../_core/sms");
    const result = await sendSMS("+14155552671", "Hello!", undefined, 1);

    expect(result.success).toBe(true);
    expect(result.provider).toBe("telnyx");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.telnyx.com/v2/messages",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("falls back to Twilio when Telnyx is not configured", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "authtest";
    process.env.TWILIO_FROM_NUMBER = "+15550000002";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ sid: "SM123" }),
      json: async () => ({ sid: "SM123" }),
    });

    const { sendSMS } = await import("../_core/sms");
    const result = await sendSMS("+14155552671", "Hello!", undefined, 1);

    expect(result.success).toBe(true);
    expect(result.provider).toBe("twilio");
  });

  it("returns dev mode result when no provider is configured", async () => {
    const { sendSMS } = await import("../_core/sms");
    const result = await sendSMS("+14155552671", "Hello!");
    expect(result.success).toBe(true);
    expect(result.provider).toBe("dev");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns error when Telnyx API fails", async () => {
    process.env.TELNYX_API_KEY = "KEY0test";
    process.env.TELNYX_FROM_NUMBER = "+15550000001";

    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ errors: [{ detail: "Invalid number" }] }),
      json: async () => ({ errors: [{ detail: "Invalid number" }] }),
    });

    const { sendSMS } = await import("../_core/sms");
    const result = await sendSMS("+14155552671", "Hello!");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid number");
  });
});

describe("resolveTemplate", () => {
  it("replaces {{variable}} placeholders", async () => {
    const { resolveTemplate } = await import("../_core/sms");
    const result = resolveTemplate("Hi {{name}}, your appt is {{date}}", {
      name: "Jane",
      date: "Monday",
    });
    expect(result).toBe("Hi Jane, your appt is Monday");
  });
});
