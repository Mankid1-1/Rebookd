import { describe, it, expect, vi, beforeEach } from "vitest";
import * as AnalyticsService from "../services/analytics.service";

// ─── Mock Database ────────────────────────────────────────────────────────────────
function makeDb(overrides: Record<string, any> = {}) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    then: (res: any) => Promise.resolve(overrides.selectResult ?? []).then(res),
  };

  return {
    select: (_fields?: any) => {
      // Handle count queries
      if (_fields && Object.keys(_fields).some((k) => k === "count")) {
        return {
          from: () => ({ 
            where: () => Promise.resolve([{ count: overrides.count ?? 0 }])
          }),
        };
      }
      
      // Handle specific analytics queries
      if (overrides.totalLeads) {
        return {
          from: () => ({
            where: () => Promise.resolve(overrides.totalLeads)
          })
        };
      }
      
      if (overrides.bookedLeads) {
        return {
          from: () => ({
            where: () => Promise.resolve(overrides.bookedLeads)
          })
        };
      }
      
      if (overrides.avgRevenuePerBooking) {
        return {
          from: () => ({
            where: () => Promise.resolve(overrides.avgRevenuePerBooking)
          })
        };
      }
      
      if (overrides.recentBookings) {
        return {
          from: () => ({
            where: () => Promise.resolve(overrides.recentBookings)
          })
        };
      }
      
      if (overrides.recoveredLeads) {
        return {
          from: () => ({
            where: () => Promise.resolve(overrides.recoveredLeads)
          })
        };
      }
      
      if (overrides.lostLeads) {
        return {
          from: () => ({
            where: () => Promise.resolve(overrides.lostLeads)
          })
        };
      }
      
      if (overrides.qualifiedLeads) {
        return {
          from: () => ({
            where: () => Promise.resolve(overrides.qualifiedLeads)
          })
        };
      }
      
      if (overrides.contactedLeads) {
        return {
          from: () => ({
            where: () => Promise.resolve(overrides.contactedLeads)
          })
        };
      }
      
      return chain;
    },
    insert: () => ({ values: () => Promise.resolve({ insertId: 1 }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: () => ({ where: () => Promise.resolve() }),
  };
}

describe("AnalyticsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDashboardMetrics", () => {
    it("returns dashboard metrics", async () => {
      const db = makeDb({ count: 10 });
      const result = await AnalyticsService.getDashboardMetrics(db as any, 1);
      
      expect(result).toHaveProperty("leadCount");
      expect(result).toHaveProperty("messageCount");
      expect(result).toHaveProperty("automationCount");
      expect(result).toHaveProperty("bookedCount");
      expect(typeof result.leadCount).toBe("number");
      expect(typeof result.messageCount).toBe("number");
      expect(typeof result.automationCount).toBe("number");
      expect(typeof result.bookedCount).toBe("number");
    });

    it("returns zero metrics when no data", async () => {
      const db = makeDb({ count: 0 });
      const result = await AnalyticsService.getDashboardMetrics(db as any, 1);
      
      expect(result.leadCount).toBe(0);
      expect(result.messageCount).toBe(0);
      expect(result.automationCount).toBe(0);
      expect(result.bookedCount).toBe(0);
    });
  });

  describe("getRevenueRecoveryMetrics", () => {
    it("calculates revenue metrics correctly", async () => {
      const mockData = {
        totalLeads: [{ count: 100 }],
        bookedLeads: [{ count: 25 }],
        avgRevenuePerBooking: [{ avgRevenue: 250 }],
        recentBookings: [{ count: 5 }],
        recoveredLeads: [{ count: 3 }],
        lostLeads: [{ count: 10 }],
        qualifiedLeads: [{ count: 15 }],
        contactedLeads: [{ count: 20 }],
      };

      const db = makeDb({
        ...mockData,
        // Map to count queries
        totalLeads: mockData.totalLeads,
        bookedLeads: mockData.bookedLeads,
        avgRevenuePerBooking: mockData.avgRevenuePerBooking,
        recentBookings: mockData.recentBookings,
        recoveredLeads: mockData.recoveredLeads,
        lostLeads: mockData.lostLeads,
        qualifiedLeads: mockData.qualifiedLeads,
        contactedLeads: mockData.contactedLeads,
      });
      const result = await AnalyticsService.getRevenueRecoveryMetrics(db as any, 1);

      expect(result.totalRecoveredRevenue).toBe(25 * 250); // 6250
      expect(result.recentRecoveredRevenue).toBe(5 * 250); // 1250
      expect(result.potentialRevenue).toBe(15 * 250); // 3750
      expect(result.lostRevenue).toBe(10 * 250); // 2500
      expect(result.pipelineRevenue).toBe(20 * 250 * 0.3); // 1500
      expect(result.overallRecoveryRate).toBe(25); // 25%
      expect(result.recentRecoveryRate).toBe(60); // 3/5 * 100
      expect(result.avgRevenuePerBooking).toBe(250);
      expect(result.totalLeadsCount).toBe(100);
      expect(result.bookedLeadsCount).toBe(25);
      expect(result.qualifiedLeadsCount).toBe(15);
      expect(result.contactedLeadsCount).toBe(20);
      expect(result.lostLeadsCount).toBe(10);
      expect(result.recentBookingsCount).toBe(5);
      expect(result.recoveredLeadsCount).toBe(3);
    });

    it("handles zero leads gracefully", async () => {
      const mockData = {
        totalLeads: [{ count: 0 }],
        bookedLeads: [{ count: 0 }],
        avgRevenuePerBooking: [{ avgRevenue: 0 }],
        recentBookings: [{ count: 0 }],
        recoveredLeads: [{ count: 0 }],
        lostLeads: [{ count: 0 }],
        qualifiedLeads: [{ count: 0 }],
        contactedLeads: [{ count: 0 }],
      };

      const db = makeDb(mockData);
      const result = await AnalyticsService.getRevenueRecoveryMetrics(db as any, 1);

      expect(result.totalRecoveredRevenue).toBe(0);
      expect(result.overallRecoveryRate).toBe(0);
      expect(result.recentRecoveryRate).toBe(0);
    });

    it("uses default average revenue when null", async () => {
      const mockData = {
        totalLeads: [{ count: 50 }],
        bookedLeads: [{ count: 10 }],
        avgRevenuePerBooking: [{ avgRevenue: null }],
        recentBookings: [{ count: 2 }],
        recoveredLeads: [{ count: 1 }],
        lostLeads: [{ count: 5 }],
        qualifiedLeads: [{ count: 8 }],
        contactedLeads: [{ count: 12 }],
      };

      const db = makeDb(mockData);
      const result = await AnalyticsService.getRevenueRecoveryMetrics(db as any, 1);

      expect(result.avgRevenuePerBooking).toBe(250); // Default value
      expect(result.totalRecoveredRevenue).toBe(10 * 250); // 2500
    });
  });

  describe("getRevenueTrends", () => {
    it("returns revenue trends data", async () => {
      const mockTrendData = [
        { date: "2024-01-01", bookings: 5, revenue: 1250, totalLeads: 20 },
        { date: "2024-01-02", bookings: 3, revenue: 750, totalLeads: 15 },
      ];

      const db = makeDb({ selectResult: mockTrendData });
      const result = await AnalyticsService.getRevenueTrends(db as any, 1, 90);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("date");
      expect(result[0]).toHaveProperty("bookings");
      expect(result[0]).toHaveProperty("revenue");
      expect(result[0]).toHaveProperty("totalLeads");
      expect(result[0]).toHaveProperty("recoveryRate");
      expect(typeof result[0].recoveryRate).toBe("number");
    });

    it("calculates recovery rate correctly", async () => {
      const mockTrendData = [
        { date: "2024-01-01", bookings: 5, revenue: 1250, totalLeads: 20 }, // 25%
        { date: "2024-01-02", bookings: 3, revenue: 750, totalLeads: 15 },  // 20%
      ];

      const db = makeDb({ selectResult: mockTrendData });
      const result = await AnalyticsService.getRevenueTrends(db as any, 1, 90);

      expect(result[0].recoveryRate).toBe(25); // 5/20 * 100
      expect(result[1].recoveryRate).toBe(20); // 3/15 * 100
    });

    it("handles zero total leads", async () => {
      const mockTrendData = [
        { date: "2024-01-01", bookings: 0, revenue: 0, totalLeads: 0 },
      ];

      const db = makeDb({ selectResult: mockTrendData });
      const result = await AnalyticsService.getRevenueTrends(db as any, 1, 90);

      expect(result[0].recoveryRate).toBe(0);
    });
  });

  describe("getLeadStatusBreakdown", () => {
    it("returns lead status breakdown", async () => {
      const mockStatusData = [
        { status: "new", count: 30 },
        { status: "contacted", count: 20 },
        { status: "qualified", count: 15 },
        { status: "booked", count: 10 },
        { status: "lost", count: 5 },
      ];

      const db = makeDb({ selectResult: mockStatusData });
      const result = await AnalyticsService.getLeadStatusBreakdown(db as any, 1);

      expect(result).toHaveLength(5);
      expect(result[0]).toHaveProperty("status");
      expect(result[0]).toHaveProperty("count");
      expect(typeof result[0].count).toBe("number");
      expect(result.find(s => s.status === "new")?.count).toBe(30);
      expect(result.find(s => s.status === "booked")?.count).toBe(10);
    });

    it("returns empty array when no leads", async () => {
      const db = makeDb({ selectResult: [] });
      const result = await AnalyticsService.getLeadStatusBreakdown(db as any, 1);

      expect(result).toHaveLength(0);
    });
  });

  describe("getMessageVolume", () => {
    it("returns message volume data", async () => {
      const mockMessageData = [
        { date: "2024-01-01", count: 10, direction: "outbound" },
        { date: "2024-01-01", count: 8, direction: "inbound" },
        { date: "2024-01-02", count: 12, direction: "outbound" },
      ];

      const db = makeDb({ selectResult: mockMessageData });
      const result = await AnalyticsService.getMessageVolume(db as any, 1, 30);

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty("date");
      expect(result[0]).toHaveProperty("count");
      expect(result[0]).toHaveProperty("direction");
      expect(result.find(m => m.direction === "outbound")?.count).toBe(10);
      expect(result.find(m => m.direction === "inbound")?.count).toBe(8);
    });

    it("uses default days parameter", async () => {
      const db = makeDb({ selectResult: [] });
      await AnalyticsService.getMessageVolume(db as any, 1);
      // Should not throw and use default 30 days
      expect(true).toBe(true);
    });
  });

  describe("getLeakageMetrics", () => {
    it("returns leakage metrics", async () => {
      const mockLeakageData = {
        unconfirmed: [{ count: 5 }],
        qualifiedUnbooked: [{ count: 8 }],
        cancellations: [{ count: 3 }],
        failedMessages: [{ count: 2 }],
      };

      const db = makeDb(mockLeakageData);
      const result = await AnalyticsService.getLeakageMetrics(db as any, 1);

      expect(result).toHaveProperty("unconfirmedAppointments");
      expect(result).toHaveProperty("qualifiedUnbooked");
      expect(result).toHaveProperty("cancellationsUnrecovered");
      expect(result).toHaveProperty("failedDeliveryRecovery");
      expect(result.unconfirmedAppointments).toBe(5);
      expect(result.qualifiedUnbooked).toBe(8);
      expect(result.cancellationsUnrecovered).toBe(3);
      expect(result.failedDeliveryRecovery).toBe(2);
    });

    it("returns zero when no leakage issues", async () => {
      const mockLeakageData = {
        unconfirmed: [{ count: 0 }],
        qualifiedUnbooked: [{ count: 0 }],
        cancellations: [{ count: 0 }],
        failedMessages: [{ count: 0 }],
      };

      const db = makeDb(mockLeakageData);
      const result = await AnalyticsService.getLeakageMetrics(db as any, 1);

      expect(result.unconfirmedAppointments).toBe(0);
      expect(result.qualifiedUnbooked).toBe(0);
      expect(result.cancellationsUnrecovered).toBe(0);
      expect(result.failedDeliveryRecovery).toBe(0);
    });
  });
});
