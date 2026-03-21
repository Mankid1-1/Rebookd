import { expect, test, describe } from "vitest";
import { resolveTemplate } from "../sms";

describe("SMS Utility functions", () => {
  test("resolveTemplate replaces variables correctly", () => {
    const template = "Hi {{name}}, see you at {{time}}.";
    const result = resolveTemplate(template, { name: "Alice", time: "10:00 AM" });
    expect(result).toBe("Hi Alice, see you at 10:00 AM.");
  });

  test("resolveTemplate handles missing variables by substituting empty string", () => {
    const template = "Hi {{name}}, see you at {{time}}.";
    const result = resolveTemplate(template, { name: "Bob" });
    expect(result).toBe("Hi Bob, see you at .");
  });
});
