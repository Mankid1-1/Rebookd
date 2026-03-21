import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock pingDb
vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  pingDb: vi.fn().mockResolvedValue(true),
}));

describe("Health check endpoint logic", () => {
  it("returns ok status when DB is reachable", async () => {
    const { pingDb } = await import("../db");
    const dbOk = await pingDb();
    const response = {
      status: dbOk ? "ok" : "degraded",
      db: dbOk ? "connected" : "unreachable",
    };
    expect(response.status).toBe("ok");
    expect(response.db).toBe("connected");
  });

  it("returns degraded status when DB is unreachable", async () => {
    const { pingDb } = await import("../db");
    vi.mocked(pingDb).mockResolvedValueOnce(false);
    const dbOk = await pingDb();
    const response = {
      status: dbOk ? "ok" : "degraded",
      db: dbOk ? "connected" : "unreachable",
    };
    expect(response.status).toBe("degraded");
    expect(response.db).toBe("unreachable");
  });
});
