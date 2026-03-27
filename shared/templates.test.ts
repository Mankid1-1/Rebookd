import { describe, it, expect } from "vitest";
import { automationTemplates } from "./templates";

describe("automationTemplates", () => {
  it("should have exactly 19 templates", () => {
    expect(automationTemplates).toHaveLength(19);
  });

  it("should have unique keys", () => {
    const keys = automationTemplates.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("should have unique names", () => {
    const names = automationTemplates.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("should include all required categories", () => {
    const categories = new Set(automationTemplates.map((t) => t.category));
    expect(categories).toContain("appointment");
    expect(categories).toContain("follow_up");
    expect(categories).toContain("cancellation");
    expect(categories).toContain("reactivation");
    expect(categories).toContain("no_show");
    expect(categories).toContain("welcome");
    expect(categories).toContain("loyalty");
  });

  it("should include the cancellation_flurry template", () => {
    const flurry = automationTemplates.find((t) => t.key === "cancellation_flurry");
    expect(flurry).toBeDefined();
    expect(flurry!.category).toBe("cancellation");
    expect(flurry!.trigger).toBe("appointment.cancelled");
  });

  it("every template should have required fields", () => {
    for (const t of automationTemplates) {
      expect(t.key).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t.trigger).toBeTruthy();
      expect(t.steps.length).toBeGreaterThan(0);
    }
  });

  it("every step should have a type and sms steps should have a message", () => {
    for (const t of automationTemplates) {
      for (const step of t.steps) {
        expect(step.type).toBeTruthy();
        if (step.type === "sms") {
          expect((step as any).message).toBeTruthy();
        }
      }
    }
  });

  it("should have cancellation templates for waitlist fill workflow", () => {
    const cancellationTemplates = automationTemplates.filter((t) => t.category === "cancellation");
    expect(cancellationTemplates.length).toBeGreaterThanOrEqual(4);

    const keys = cancellationTemplates.map((t) => t.key);
    expect(keys).toContain("waitlist_fill");
    expect(keys).toContain("cancellation_same_day");
    expect(keys).toContain("cancellation_flurry");
  });

  it("should have appointment reminder and confirmation templates", () => {
    const appointmentTemplates = automationTemplates.filter((t) => t.category === "appointment");
    expect(appointmentTemplates.length).toBeGreaterThanOrEqual(2);
  });

  it("should have VIP win-back templates at 45d and 90d", () => {
    const winback45 = automationTemplates.find((t) => t.key === "vip_winback_45d");
    const winback90 = automationTemplates.find((t) => t.key === "vip_winback_90d");
    expect(winback45).toBeDefined();
    expect(winback90).toBeDefined();
  });
});
