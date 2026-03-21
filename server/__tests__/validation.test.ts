import { describe, it, expect } from "vitest";
import { createLeadSchema, updateLeadStatusSchema, sendMessageSchema, phoneSchema, smsBodySchema } from "../../shared/schemas/leads";
import { paginationSchema } from "../../shared/schemas/admin";

describe("phoneSchema", () => {
  it("accepts valid E.164 numbers", () => {
    expect(phoneSchema.parse("+14155552671")).toBe("+14155552671"); // Valid San Francisco number
    expect(phoneSchema.parse("+447911123456")).toBe("+447911123456"); // Valid UK number
  });

  it("rejects numbers without + prefix", () => {
    expect(() => phoneSchema.parse("15550001234")).toThrow();
  });

  it("rejects numbers that are too short", () => {
    expect(() => phoneSchema.parse("+1234")).toThrow();
  });

  it("rejects plain text", () => {
    expect(() => phoneSchema.parse("not-a-phone")).toThrow();
  });
});

describe("smsBodySchema", () => {
  it("accepts normal messages", () => {
    expect(smsBodySchema.parse("Hello there!")).toBe("Hello there!");
  });

  it("rejects empty string", () => {
    expect(() => smsBodySchema.parse("")).toThrow();
  });

  it("rejects messages over 1600 chars", () => {
    expect(() => smsBodySchema.parse("a".repeat(1601))).toThrow();
  });

  it("accepts exactly 1600 chars", () => {
    expect(smsBodySchema.parse("a".repeat(1600))).toHaveLength(1600);
  });
});

describe("createLeadSchema", () => {
  it("accepts valid lead data", () => {
    const result = createLeadSchema.parse({
      name: "Jane Doe",
      phone: "+14155552671",
    });
    expect(result.name).toBe("Jane Doe");
    expect(result.phone).toBe("+14155552671");
  });

  it("rejects missing name", () => {
    expect(() => createLeadSchema.parse({ phone: "+14155552671" })).toThrow();
  });

  it("rejects invalid phone", () => {
    expect(() => createLeadSchema.parse({ name: "Jane", phone: "5550001234" })).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() => createLeadSchema.parse({ name: "Jane", phone: "+14155552671", email: "not-an-email" })).toThrow();
  });

  it("accepts empty string email (optional)", () => {
    const result = createLeadSchema.parse({ name: "Jane", phone: "+14155552671", email: "" });
    expect(result.email).toBe("");
  });
});

describe("updateLeadStatusSchema", () => {
  it("accepts valid statuses", () => {
    for (const status of ["new", "contacted", "qualified", "booked", "lost", "unsubscribed"]) {
      expect(() => updateLeadStatusSchema.parse({ leadId: 1, status })).not.toThrow();
    }
  });

  it("rejects unknown status", () => {
    expect(() => updateLeadStatusSchema.parse({ leadId: 1, status: "pending" })).toThrow();
  });
});

describe("sendMessageSchema", () => {
  it("accepts valid message", () => {
    const result = sendMessageSchema.parse({ leadId: 1, body: "Hello!" });
    expect(result.body).toBe("Hello!");
  });

  it("accepts valid idempotency key", () => {
    const key = "550e8400-e29b-41d4-a716-446655440000";
    const result = sendMessageSchema.parse({ leadId: 1, body: "Hi", idempotencyKey: key });
    expect(result.idempotencyKey).toBe(key);
  });

  it("rejects non-UUID idempotency key", () => {
    expect(() => sendMessageSchema.parse({ leadId: 1, body: "Hi", idempotencyKey: "not-a-uuid" })).toThrow();
  });

  it("rejects empty body", () => {
    expect(() => sendMessageSchema.parse({ leadId: 1, body: "" })).toThrow();
  });
});

describe("paginationSchema", () => {
  it("defaults page to 1 and limit to 50", () => {
    const result = paginationSchema.parse({});
    expect(result?.page).toBe(1);
    expect(result?.limit).toBe(50);
  });

  it("rejects limit over 100", () => {
    expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
  });

  it("rejects page 0", () => {
    expect(() => paginationSchema.parse({ page: 0 })).toThrow();
  });
});
