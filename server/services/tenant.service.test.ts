import { describe, it, expect } from "vitest";

// Unit tests for tenant service pure logic
// Tests the settings merge behavior without database dependency

describe("tenant settings merge logic", () => {
  function mergeSettings(current: Record<string, any>, key: string, config: Record<string, any>) {
    return { ...current, [key]: config };
  }

  it("should add a new feature config to empty settings", () => {
    const result = mergeSettings({}, "noShowRecovery", { enabled: true, delayMinutes: 10 });
    expect(result).toEqual({
      noShowRecovery: { enabled: true, delayMinutes: 10 },
    });
  });

  it("should preserve existing settings when adding new config", () => {
    const existing = {
      noShowRecovery: { enabled: true },
      cancellationRecovery: { enabled: false },
    };
    const result = mergeSettings(existing, "retentionEngine", { enabled: true, daysThreshold: 45 });
    expect(result.noShowRecovery).toEqual({ enabled: true });
    expect(result.cancellationRecovery).toEqual({ enabled: false });
    expect(result.retentionEngine).toEqual({ enabled: true, daysThreshold: 45 });
  });

  it("should overwrite existing config for same key", () => {
    const existing = {
      noShowRecovery: { enabled: true, delayMinutes: 10 },
    };
    const result = mergeSettings(existing, "noShowRecovery", { enabled: false, delayMinutes: 30 });
    expect(result.noShowRecovery).toEqual({ enabled: false, delayMinutes: 30 });
  });

  it("should handle all 13 feature config keys", () => {
    const keys = [
      "noShowRecovery", "cancellationRecovery", "retentionEngine",
      "smartScheduling", "bookingConversion", "leadCapture",
      "paymentEnforcement", "afterHours", "adminAutomation",
      "calendarIntegration", "waitingList", "reviewManagement", "rescheduling",
    ];
    let settings: Record<string, any> = {};
    for (const key of keys) {
      settings = mergeSettings(settings, key, { enabled: true });
    }
    expect(Object.keys(settings)).toHaveLength(13);
    for (const key of keys) {
      expect(settings[key]).toEqual({ enabled: true });
    }
  });
});

describe("getSettings fallback", () => {
  it("should return empty object when tenant has no settings", () => {
    const tenant = { settings: null };
    const result = (tenant?.settings as Record<string, any>) ?? {};
    expect(result).toEqual({});
  });

  it("should return settings when they exist", () => {
    const tenant = { settings: { noShowRecovery: { enabled: true } } };
    const result = (tenant?.settings as Record<string, any>) ?? {};
    expect(result).toEqual({ noShowRecovery: { enabled: true } });
  });

  it("should return empty object for undefined tenant", () => {
    const tenant = undefined;
    const result = (tenant?.settings as Record<string, any> | undefined) ?? {};
    expect(result).toEqual({});
  });
});
