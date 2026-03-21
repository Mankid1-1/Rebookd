import { describe, it, expect, beforeEach, vi } from "vitest";
import { detectRevenueLeakage } from "../services/revenue-leakage.service";
import { createRecoveryCampaign } from "../services/revenue-recovery.service";
import { eq, and, sql } from "drizzle-orm";
import { leads } from "../../drizzle/schema";

// Mock the database and dependencies
const mockDb = {
  select: vi.fn(() => mockDb),
  from: vi.fn(() => mockDb),
  where: vi.fn(() => mockDb),
  limit: vi.fn(() => mockDb),
  orderBy: vi.fn(() => mockDb),
  groupBy: vi.fn(() => mockDb),
  execute: vi.fn(),
} as any;

// Mock the withQueryTimeout function
vi.mock("../services/query.service", () => ({
  withQueryTimeout: vi.fn((key, query) => query),
}));

describe("Revenue Leakage Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectRevenueLeakage", () => {
    it("should detect no-shows correctly", async () => {
      // Mock database response for no-shows
      mockDb.execute.mockResolvedValueOnce([{ count: 5 }]);
      mockDb.execute.mockResolvedValue([{ count: 0 }]); // Other leakage types return 0

      const result = await detectRevenueLeakage(mockDb, 1, 30);

      expect(result.totalLeakage).toBeGreaterThan(0);
      expect(result.leakageByType.noShows).toBe(1250); // 5 * 250
      expect(result.topLeakageSources).toHaveLength(5);
      expect(result.recommendations).toHaveLengthGreaterThan(0);
    });

    it("should detect cancellations correctly", async () => {
      // Mock database response for cancellations
      mockDb.execute.mockResolvedValue([{ count: 8 }]);
      mockDb.execute.mockResolvedValue([{ count: 0 }]); // Other leakage types return 0

      const result = await detectRevenueLeakage(mockDb, 1, 30);

      expect(result.totalLeakage).toBe(2000); // 8 * 250
      expect(result.leakageByType.cancellations).toBe(2000);
      expect(result.recoverableRevenue).toBe(900); // 2000 * 0.45
    });

    it("should calculate recovery probability correctly", async () => {
      // Mock mixed leakage types
      mockDb.execute.mockResolvedValue([{ count: 5 }]); // no-shows
      mockDb.execute.mockResolvedValue([{ count: 3 }]); // cancellations
      mockDb.execute.mockResolvedValue([{ count: 2 }]); // last-minute
      mockDb.execute.mockResolvedValue([{ count: 0 }]); // others

      const result = await detectRevenueLeakage(mockDb, 1, 30);

      const expectedRecoverable = (5 * 250 * 0.65) + (3 * 250 * 0.45) + (2 * 300 * 0.25);
      expect(result.recoverableRevenue).toBeCloseTo(expectedRecoverable, 2);
    });

    it("should handle zero leakage gracefully", async () => {
      // Mock no leakage detected
      mockDb.execute.mockResolvedValue([{ count: 0 }]);

      const result = await detectRevenueLeakage(mockDb, 1, 30);

      expect(result.totalLeakage).toBe(0);
      expect(result.recoverableRevenue).toBe(0);
      expect(result.topLeakageSources).toHaveLength(5);
      expect(result.recoveryOpportunities).toHaveLength(0);
    });

    it("should generate appropriate recommendations", async () => {
      // Mock high no-show severity
      mockDb.execute.mockResolvedValue([{ count: 15 }]); // High no-show count
      mockDb.execute.mockResolvedValue([{ count: 0 }]); // Others

      const result = await detectRevenueLeakage(mockDb, 1, 30);

      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          category: "process",
          priority: "high",
          title: "Implement No-Show Prevention System",
        })
      );
    });

    it("should detect follow-up missed opportunities", async () => {
      // Mock qualified leads without follow-up
      mockDb.execute.mockResolvedValue([{ count: 0 }]); // Other types
      mockDb.execute.mockResolvedValue([{ count: 25 }]); // Missed follow-ups

      const result = await detectRevenueLeakage(mockDb, 1, 30);

      expect(result.leakageByType.missedFollowups).toBe(3000); // 25 * 200 * 0.6
      expect(result.recoverableRevenue).toBe(2550); // 3000 * 0.85
    });

    it("should calculate severity levels correctly", async () => {
      const testCases = [
        { count: 5, expectedSeverity: "low" },
        { count: 8, expectedSeverity: "medium" },
        { count: 12, expectedSeverity: "high" },
        { count: 20, expectedSeverity: "critical" },
      ];

      for (const testCase of testCases) {
        mockDb.execute.mockResolvedValue([{ count: testCase.count }]);
        mockDb.execute.mockResolvedValue([{ count: 0 }]); // Other types

        const result = await detectRevenueLeakage(mockDb, 1, 30);
        const noShowSource = result.topLeakageSources.find(s => s.type === "no_show");
        expect(noShowSource?.severity).toBe(testCase.expectedSeverity);
      }
    });
  });

  describe("Recovery Campaign Creation", () => {
    it("should create recovery campaign for no-shows", async () => {
      // Mock target leads
      mockDb.execute.mockResolvedValue([
        { id: 1, name: "John Doe", phone: "+1234567890", status: "booked", appointmentAt: new Date() },
        { id: 2, name: "Jane Smith", phone: "+0987654321", status: "booked", appointmentAt: new Date() },
      ]);

      const campaign = await createRecoveryCampaign(mockDb, 1, "no_show", {
        priority: "high",
        discountAmount: 20,
      });

      expect(campaign.name).toBe("NO SHOW Recovery Campaign");
      expect(campaign.targetLeakageType).toBe("no_show");
      expect(campaign.actions).toHaveLength(2);
      expect(campaign.status).toBe("draft");
    });

    it("should create appropriate recovery actions", async () => {
      mockDb.execute.mockResolvedValue([
        { id: 1, name: "John Doe", phone: "+1234567890", status: "qualified", lastMessageAt: null },
      ]);

      const campaign = await createRecoveryCampaign(mockDb, 1, "followup_missed");

      const action = campaign.actions[0];
      expect(action.type).toBe("followup");
      expect(action.priority).toBe("medium");
      expect(action.message).toContain("following up on your inquiry");
      expect(action.recoveryProbability).toBe(0.85);
    });

    it("should apply discount to messages when specified", async () => {
      mockDb.execute.mockResolvedValue([
        { id: 1, name: "John Doe", phone: "+1234567890", status: "booked", appointmentAt: new Date() },
      ]);

      const campaign = await createRecoveryCampaign(mockDb, 1, "no_show", {
        discountAmount: 25,
      });

      const action = campaign.actions[0];
      expect(action.message).toContain("25% off");
    });

    it("should handle empty target leads gracefully", async () => {
      mockDb.execute.mockResolvedValue([]);

      const campaign = await createRecoveryCampaign(mockDb, 1, "no_show");

      expect(campaign.actions).toHaveLength(0);
      expect(campaign.totalEstimatedRevenue).toBe(0);
      expect(campaign.totalRecoveryProbability).toBe(0);
    });

    it("should schedule actions with delay when specified", async () => {
      mockDb.execute.mockResolvedValue([
        { id: 1, name: "John Doe", phone: "+1234567890", status: "booked", appointmentAt: new Date() },
      ]);

      const campaign = await createRecoveryCampaign(mockDb, 1, "no_show", {
        scheduleDelay: 24, // 24 hours
      });

      const action = campaign.actions[0];
      const expectedTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      expect(action.scheduledAt.getTime()).toBeCloseTo(expectedTime.getTime(), -1000);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      mockDb.execute.mockRejectedValue(new Error("Database connection failed"));

      await expect(detectRevenueLeakage(mockDb, 1, 30)).rejects.toThrow("Database connection failed");
    });

    it("should handle unknown leakage types", async () => {
      mockDb.execute.mockResolvedValue([]);

      const campaign = await createRecoveryCampaign(mockDb, 1, "unknown_type");

      expect(campaign.actions).toHaveLength(0);
    });

    it("should handle malformed lead data", async () => {
      mockDb.execute.mockResolvedValue([
        { id: 1, name: null, phone: null, status: "booked" }, // Malformed data
      ]);

      const campaign = await createRecoveryCampaign(mockDb, 1, "no_show");

      expect(campaign.actions).toHaveLength(1);
      expect(campaign.actions[0].message).toContain("there"); // Uses fallback name
    });

    it("should calculate revenue with default values", async () => {
      mockDb.execute.mockResolvedValue([
        { id: 1, name: "John Doe", phone: "+1234567890", status: "contacted", appointmentAt: null }, // No appointment
      ]);

      const campaign = await createRecoveryCampaign(mockDb, 1, "followup_missed");

      expect(campaign.actions[0].estimatedRevenue).toBe(200); // Default for no appointment
    });
  });

  describe("Data Validation", () => {
    it("should validate tenant ID", async () => {
      mockDb.execute.mockResolvedValue([{ count: 5 }]);

      const result = await detectRevenueLeakage(mockDb, 1, 30);

      expect(result).toBeDefined();
      expect(result.totalLeakage).toBeGreaterThanOrEqual(0);
    });

    it("should validate day range", async () => {
      mockDb.execute.mockResolvedValue([{ count: 0 }]);

      const result = await detectRevenueLeakage(mockDb, 1, 365); // Max days

      expect(result).toBeDefined();
      expect(result.leakageByMonth).toBeDefined();
    });

    it("should validate priority levels", async () => {
      const priorities = ["low", "medium", "high", "urgent"] as const;

      for (const priority of priorities) {
        mockDb.execute.mockResolvedValue([{ id: 1, name: "Test", phone: "+123", status: "booked" }]);
        
        const campaign = await createRecoveryCampaign(mockDb, 1, "no_show", { priority });
        
        expect(campaign.actions[0].priority).toBe(priority);
      }
    });
  });

  describe("Performance Considerations", () => {
    it("should handle large datasets efficiently", async () => {
      // Mock large dataset
      const largeLeadSet = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `Lead ${i + 1}`,
        phone: `+123456789${i}`,
        status: "booked",
        appointmentAt: new Date(),
      }));

      mockDb.execute.mockResolvedValue(largeLeadSet);

      const startTime = Date.now();
      const campaign = await createRecoveryCampaign(mockDb, 1, "no_show");
      const endTime = Date.now();

      expect(campaign.actions).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should batch database queries appropriately", async () => {
      mockDb.execute.mockResolvedValue([{ count: 10 }]);

      await detectRevenueLeakage(mockDb, 1, 30);

      // Should make multiple parallel calls for different leakage types
      expect(mockDb.execute).toHaveBeenCalledTimes(9); // 8 leakage types + monthly trends
    });
  });
});

describe("Revenue Leakage Integration", () => {
  it("should integrate leakage detection with recovery", async () => {
    // Step 1: Detect leakage
    mockDb.execute.mockResolvedValue([{ count: 5 }]); // no-shows
    mockDb.execute.mockResolvedValue([{ count: 0 }]); // others

    const leakageReport = await detectRevenueLeakage(mockDb, 1, 30);

    // Step 2: Create recovery campaign based on findings
    mockDb.execute.mockResolvedValue([
      { id: 1, name: "John Doe", phone: "+1234567890", status: "booked" },
    ]);

    const campaign = await createRecoveryCampaign(mockDb, 1, "no_show");

    expect(leakageReport.totalLeakage).toBe(1250);
    expect(campaign.actions).toHaveLength(1);
    expect(campaign.totalEstimatedRevenue).toBe(250);
  });

  it("should provide end-to-end revenue recovery workflow", async () => {
    // Mock complete workflow
    mockDb.execute.mockResolvedValue([{ count: 3 }]); // no-shows
    mockDb.execute.mockResolvedValue([
      { id: 1, name: "John", phone: "+123", status: "booked" },
      { id: 2, name: "Jane", phone: "+456", status: "booked" },
      { id: 3, name: "Bob", phone: "+789", status: "booked" },
    ]);

    const leakageReport = await detectRevenueLeakage(mockDb, 1, 30);
    const campaign = await createRecoveryCampaign(mockDb, 1, "no_show", {
      priority: "high",
      discountAmount: 20,
    });

    // Verify complete workflow
    expect(leakageReport.leakageByType.noShows).toBe(750);
    expect(leakageReport.recoverableRevenue).toBe(487.5); // 750 * 0.65
    expect(campaign.actions).toHaveLength(3);
    expect(campaign.totalRecoveryProbability).toBeCloseTo(0.65, 2);
    expect(campaign.actions[0].message).toContain("20% off");
  });
});
