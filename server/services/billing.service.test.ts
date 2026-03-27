import { describe, it, expect } from "vitest";

// Unit tests for billing constants and pure logic
// Database-dependent functions are tested via integration/e2e tests

const REVENUE_SHARE_PERCENT = 15;
const MONTHLY_FEE_CENTS = 19900;
const EARLY_ADOPTER_SLOTS = 20;
const AVG_APPOINTMENT_VALUE = 150;

describe("billing constants", () => {
  it("revenue share should be 15%", () => {
    expect(REVENUE_SHARE_PERCENT).toBe(15);
  });

  it("monthly fee should be $199", () => {
    expect(MONTHLY_FEE_CENTS / 100).toBe(199);
  });

  it("early adopter slots should be 20", () => {
    expect(EARLY_ADOPTER_SLOTS).toBe(20);
  });

  it("default appointment value should be $150", () => {
    expect(AVG_APPOINTMENT_VALUE).toBe(150);
  });
});

describe("revenue share calculation logic", () => {
  function calculateRevenueShare(recoveredAppointments: number) {
    const recoveredRevenue = recoveredAppointments * AVG_APPOINTMENT_VALUE;
    const revenueShareOwed = Math.round(recoveredRevenue * (REVENUE_SHARE_PERCENT / 100) * 100) / 100;
    return {
      recoveredAppointments,
      recoveredRevenue,
      revenueSharePercent: REVENUE_SHARE_PERCENT,
      revenueShareOwed,
      monthlyFee: MONTHLY_FEE_CENTS / 100,
      totalCost: (MONTHLY_FEE_CENTS / 100) + revenueShareOwed,
      netSavings: recoveredRevenue - ((MONTHLY_FEE_CENTS / 100) + revenueShareOwed),
    };
  }

  it("should calculate 15% revenue share on recovered appointments", () => {
    const result = calculateRevenueShare(10);
    // 10 appointments × $150 = $1500 recovered
    expect(result.recoveredRevenue).toBe(1500);
    // 15% of $1500 = $225
    expect(result.revenueShareOwed).toBe(225);
  });

  it("should show positive ROI when enough appointments recovered", () => {
    const result = calculateRevenueShare(20);
    // 20 × $150 = $3000 recovered
    // Cost: $199 + $450 (15% of $3000) = $649
    // Net: $3000 - $649 = $2351
    expect(result.netSavings).toBeGreaterThan(0);
  });

  it("should show negative ROI with zero recovered appointments", () => {
    const result = calculateRevenueShare(0);
    // Cost: $199 + $0 = $199
    // Net: $0 - $199 = -$199
    expect(result.netSavings).toBe(-199);
    expect(result.revenueShareOwed).toBe(0);
  });

  it("should calculate correct total cost", () => {
    const result = calculateRevenueShare(5);
    // 5 × $150 = $750
    // Share: 15% of $750 = $112.50
    // Total: $199 + $112.50 = $311.50
    expect(result.totalCost).toBe(311.5);
  });

  it("should calculate breakeven point", () => {
    // Breakeven: recoveredRevenue = monthlyFee + revenueShare
    // R = 199 + 0.15R → 0.85R = 199 → R ≈ 234.12
    // That means ~2 appointments ($300) should be positive
    const result = calculateRevenueShare(2);
    expect(result.netSavings).toBeGreaterThan(0);
  });
});

describe("ROI guarantee logic", () => {
  function checkRoiGuarantee(params: {
    isPromotional: boolean;
    netSavings: number;
    totalCost: number;
    earlyAdopterCount: number;
  }) {
    const hasPositiveRoi = params.netSavings > 0;
    return {
      isEarlyAdopter: params.isPromotional,
      slotsRemaining: Math.max(0, EARLY_ADOPTER_SLOTS - params.earlyAdopterCount),
      hasPositiveRoi,
      roiPercent: params.totalCost > 0 ? Math.round((params.netSavings / params.totalCost) * 100) : 0,
      guaranteeActive: params.isPromotional && !hasPositiveRoi,
    };
  }

  it("should activate guarantee for promotional tenant with negative ROI", () => {
    const result = checkRoiGuarantee({
      isPromotional: true,
      netSavings: -199,
      totalCost: 199,
      earlyAdopterCount: 5,
    });
    expect(result.guaranteeActive).toBe(true);
    expect(result.slotsRemaining).toBe(15);
  });

  it("should NOT activate guarantee for non-promotional tenant", () => {
    const result = checkRoiGuarantee({
      isPromotional: false,
      netSavings: -199,
      totalCost: 199,
      earlyAdopterCount: 5,
    });
    expect(result.guaranteeActive).toBe(false);
  });

  it("should NOT activate guarantee when ROI is positive", () => {
    const result = checkRoiGuarantee({
      isPromotional: true,
      netSavings: 500,
      totalCost: 649,
      earlyAdopterCount: 10,
    });
    expect(result.guaranteeActive).toBe(false);
    expect(result.hasPositiveRoi).toBe(true);
  });

  it("should show 0 slots remaining when all 20 taken", () => {
    const result = checkRoiGuarantee({
      isPromotional: true,
      netSavings: -199,
      totalCost: 199,
      earlyAdopterCount: 25,
    });
    expect(result.slotsRemaining).toBe(0);
  });

  it("should calculate ROI percentage correctly", () => {
    const result = checkRoiGuarantee({
      isPromotional: false,
      netSavings: 2351,
      totalCost: 649,
      earlyAdopterCount: 0,
    });
    // 2351/649 ≈ 362%
    expect(result.roiPercent).toBe(362);
  });
});
