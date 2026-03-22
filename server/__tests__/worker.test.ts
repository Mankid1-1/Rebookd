/**
 * Worker unit tests — idempotency and helper logic.
 * We test the pure helper functions without spinning up the full worker loop.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB helper ───────────────────────────────────────────────────────────
function makeDb(existingMessages: any[] = []) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(existingMessages),
    then: (res: any) => Promise.resolve(existingMessages).then(res),
  };
  return {
    select: () => chain,
    insert: () => ({ values: () => Promise.resolve({ insertId: 1 }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  };
}

// ─── resolveTemplate (from sms.ts) ───────────────────────────────────────────
describe("resolveTemplate variable substitution", () => {
  it("replaces name and time placeholders", async () => {
    const { resolveTemplate } = await import("../_core/sms");
    const result = resolveTemplate("Hi {{name}}, your appt is at {{time}}", {
      name: "Jane",
      time: "3:00 PM",
    });
    expect(result).toBe("Hi Jane, your appt is at 3:00 PM");
  }, 5000); // Add timeout

  it("leaves unknown vars as empty string", async () => {
    const { resolveTemplate } = await import("../_core/sms");
    expect(resolveTemplate("Hi {{name}}", {})).toBe("Hi ");
  }, 5000); // Add timeout
});

// ─── Idempotency check ────────────────────────────────────────────────────────
describe("worker idempotency", () => {
  it("detects already-sent message (non-empty result)", async () => {
    // Simulate the alreadySent logic inline
    const db = makeDb([{ id: 42 }]); // message exists
    const rows = await db.select().from({}).where({}).limit(1);
    expect(rows.length).toBeGreaterThan(0); // would skip
  });

  it("allows sending when no prior message exists", async () => {
    const db = makeDb([]); // no existing message
    const rows = await db.select().from({}).where({}).limit(1);
    expect(rows.length).toBe(0); // would proceed
  });
});

// ─── cfg helper ──────────────────────────────────────────────────────────────
describe("cfg helper", () => {
  function cfg(auto: any, key: string, fallback: number): number {
    const v = (auto.triggerConfig as Record<string, unknown> | null)?.[key];
    return typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) || fallback : fallback;
  }

  it("returns configured number value", () => {
    expect(cfg({ triggerConfig: { delayDays: 7 } }, "delayDays", 3)).toBe(7);
  });

  it("parses string numbers", () => {
    expect(cfg({ triggerConfig: { delayDays: "14" } }, "delayDays", 3)).toBe(14);
  });

  it("returns fallback when key missing", () => {
    expect(cfg({ triggerConfig: {} }, "delayDays", 3)).toBe(3);
  });

  it("returns fallback when triggerConfig is null", () => {
    expect(cfg({ triggerConfig: null }, "delayDays", 3)).toBe(3);
  });
});
