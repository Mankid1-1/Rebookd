import { describe, expect, it } from "vitest";
import { resolveTemplate } from "../_core/sms";
import { normalizePhoneE164 } from "../../shared/phone";

describe("automation runner — shared helpers", () => {
  it("resolveTemplate substitutes placeholders", () => {
    expect(resolveTemplate("Hi {{name}} — {{time}}", { name: "Alex", time: "3pm" })).toBe("Hi Alex — 3pm");
  });

  it("normalizePhoneE164 accepts common US formats", () => {
    expect(normalizePhoneE164("(415) 555-2671")).toBe("+14155552671");
    expect(normalizePhoneE164("+1 415 555 2671")).toBe("+14155552671");
  });
});
