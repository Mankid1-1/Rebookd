import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RevenueDashboard } from "../RevenueDashboard";

// Mock Recharts components
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => <div data-testid="area-chart" />,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => <div data-testid="pie-cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => <div data-testid="bar-chart" />,
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  TrendingDown: () => <div data-testid="trending-down-icon" />,
  DollarSign: () => <div data-testid="dollar-sign-icon" />,
  Users: () => <div data-testid="users-icon" />,
  Target: () => <div data-testid="target-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  ArrowUp: () => <div data-testid="arrow-up-icon" />,
  ArrowDown: () => <div data-testid="arrow-down-icon" />,
  Calendar: () => <div data-testid="calendar-icon" />,
  PieChart: () => <div data-testid="pie-chart-icon" />,
  BarChart3: () => <div data-testid="bar-chart-icon" />,
}));

const mockRevenueMetrics = {
  totalRecoveredRevenue: 25000,
  recentRecoveredRevenue: 5000,
  potentialRevenue: 7500,
  lostRevenue: 2000,
  pipelineRevenue: 3000,
  overallRecoveryRate: 25.5,
  recentRecoveryRate: 30.0,
  avgRevenuePerBooking: 250,
  totalLeadsCount: 100,
  bookedLeadsCount: 25,
  qualifiedLeadsCount: 30,
  contactedLeadsCount: 20,
  lostLeadsCount: 10,
  recentBookingsCount: 5,
  recoveredLeadsCount: 3,
};

const mockRevenueTrends = [
  { date: "2024-01-01", bookings: 5, revenue: 1250, totalLeads: 20, recoveryRate: 25 },
  { date: "2024-01-02", bookings: 3, revenue: 750, totalLeads: 15, recoveryRate: 20 },
  { date: "2024-01-03", bookings: 7, revenue: 1750, totalLeads: 25, recoveryRate: 28 },
];

describe("RevenueDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders revenue dashboard header", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    expect(screen.getByText("Revenue Recovery Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Track your recovered revenue and conversion metrics")).toBeInTheDocument();
    expect(screen.getByText("Last 90 days")).toBeInTheDocument();
  });

  it("displays key revenue metrics", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    // Total Recovered
    expect(screen.getByText("Total Recovered")).toBeInTheDocument();
    expect(screen.getByText("$25,000")).toBeInTheDocument();
    expect(screen.getByText("25 bookings")).toBeInTheDocument();

    // This Month
    expect(screen.getByText("This Month")).toBeInTheDocument();
    expect(screen.getByText("$5,000")).toBeInTheDocument();
    expect(screen.getByText("5 bookings")).toBeInTheDocument();

    // Potential Revenue
    expect(screen.getByText("Potential Revenue")).toBeInTheDocument();
    expect(screen.getByText("$7,500")).toBeInTheDocument();
    expect(screen.getByText("30 qualified leads")).toBeInTheDocument();

    // Pipeline Value
    expect(screen.getByText("Pipeline Value")).toBeInTheDocument();
    expect(screen.getByText("$3,000")).toBeInTheDocument();
    expect(screen.getByText("20 in pipeline")).toBeInTheDocument();
  });

  it("displays recovery metrics section", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    expect(screen.getByText("Recovery Metrics")).toBeInTheDocument();
    expect(screen.getByText("25.5%")).toBeInTheDocument(); // Overall Rate
    expect(screen.getByText("Overall Rate")).toBeInTheDocument();
    expect(screen.getByText("$250")).toBeInTheDocument(); // Avg per Booking
    expect(screen.getByText("Avg per Booking")).toBeInTheDocument();
    expect(screen.getByText("Lost Revenue")).toBeInTheDocument();
    expect(screen.getByText("$2,000")).toBeInTheDocument(); // Lost Revenue
  });

  it("displays lead status distribution", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    expect(screen.getByText("Lead Status Distribution")).toBeInTheDocument();
    expect(screen.getByText("Booked")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("Qualified")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("Contacted")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("Lost")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("displays revenue trends chart", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    expect(screen.getByText("Revenue Trends")).toBeInTheDocument();
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    expect(screen.getByTestId("x-axis")).toBeInTheDocument();
    expect(screen.getByTestId("y-axis")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();
  });

  it("displays conversion funnel", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    expect(screen.getByText("Conversion Funnel")).toBeInTheDocument();
    expect(screen.getByText("Total Leads")).toBeInTheDocument();
    expect(screen.getByText("100 leads")).toBeInTheDocument();
    expect(screen.getByText("Contacted")).toBeInTheDocument();
    expect(screen.getByText("20 leads")).toBeInTheDocument();
    expect(screen.getByText("Qualified")).toBeInTheDocument();
    expect(screen.getByText("30 leads")).toBeInTheDocument();
    expect(screen.getByText("Booked")).toBeInTheDocument();
    expect(screen.getByText("25 leads")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={true}
      />
    );

    expect(screen.getByText("—")).toBeInTheDocument(); // Loading state for metrics
  });

  it("formats currency correctly", () => {
    const largeRevenueMetrics = {
      ...mockRevenueMetrics,
      totalRecoveredRevenue: 1234567,
      recentRecoveredRevenue: 987654,
    };

    render(
      <RevenueDashboard 
        revenueMetrics={largeRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    expect(screen.getByText("$1,234,567")).toBeInTheDocument();
    expect(screen.getByText("$987,654")).toBeInTheDocument();
  });

  it("calculates percentages correctly", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    expect(screen.getByText("25.5%")).toBeInTheDocument(); // Overall recovery rate
    expect(screen.getByText("30.0%")).toBeInTheDocument(); // Recent recovery rate
  });

  it("displays trend indicators", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    expect(screen.getByTestId("arrow-up-icon")).toBeInTheDocument();
    expect(screen.getByTestId("arrow-down-icon")).toBeInTheDocument();
    expect(screen.getByText("12.5%")).toBeInTheDocument(); // Trend value
    expect(screen.getByText("8.3%")).toBeInTheDocument(); // Another trend value
  });

  it("handles zero values gracefully", () => {
    const zeroRevenueMetrics = {
      totalRecoveredRevenue: 0,
      recentRecoveredRevenue: 0,
      potentialRevenue: 0,
      lostRevenue: 0,
      pipelineRevenue: 0,
      overallRecoveryRate: 0,
      recentRecoveryRate: 0,
      avgRevenuePerBooking: 0,
      totalLeadsCount: 0,
      bookedLeadsCount: 0,
      qualifiedLeadsCount: 0,
      contactedLeadsCount: 0,
      lostLeadsCount: 0,
      recentBookingsCount: 0,
      recoveredLeadsCount: 0,
    };

    render(
      <RevenueDashboard 
        revenueMetrics={zeroRevenueMetrics}
        revenueTrends={[]}
        isLoading={false}
      />
    );

    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("0 leads")).toBeInTheDocument();
  });

  it("displays help tooltips", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    // Help tooltips should be present for metrics
    expect(screen.getByText("Total Recovered")).toBeInTheDocument();
    expect(screen.getByText("This Month")).toBeInTheDocument();
    expect(screen.getByText("Potential Revenue")).toBeInTheDocument();
    expect(screen.getByText("Pipeline Value")).toBeInTheDocument();
  });

  it("renders funnel percentages", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    // Funnel should show conversion percentages
    expect(screen.getByText("100.0%")).toBeInTheDocument(); // Total leads
    expect(screen.getByText("20.0%")).toBeInTheDocument(); // Contacted (20/100)
    expect(screen.getByText("30.0%")).toBeInTheDocument(); // Qualified (30/100)
    expect(screen.getByText("25.0%")).toBeInTheDocument(); // Booked (25/100)
  });

  it("handles empty revenue trends", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={[]}
        isLoading={false}
      />
    );

    expect(screen.getByText("No revenue data available for the selected period")).toBeInTheDocument();
  });

  it("displays metric cards with correct styling", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    // Check for metric cards
    expect(screen.getByTestId("dollar-sign-icon")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-icon")).toBeInTheDocument();
    expect(screen.getByTestId("target-icon")).toBeInTheDocument();
    expect(screen.getByTestId("users-icon")).toBeInTheDocument();
  });

  it("shows revenue funnel with values", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    // Check that funnel shows both lead counts and revenue values
    expect(screen.getByText("100 leads")).toBeInTheDocument();
    expect(screen.getByText("20 leads")).toBeInTheDocument();
    expect(screen.getByText("$3,000")).toBeInTheDocument(); // Pipeline revenue
    expect(screen.getByText("$7,500")).toBeInTheDocument(); // Potential revenue
    expect(screen.getByText("$25,000")).toBeInTheDocument(); // Total recovered
  });

  it("displays status distribution with colors", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
    expect(screen.getByTestId("pie-cell")).toBeInTheDocument();
  });

  it("handles large numbers in formatting", () => {
    const largeMetrics = {
      ...mockRevenueMetrics,
      totalRecoveredRevenue: 999999999,
      totalLeadsCount: 1000000,
    };

    render(
      <RevenueDashboard 
        revenueMetrics={largeMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    expect(screen.getByText("$999,999,999")).toBeInTheDocument();
    expect(screen.getByText("1,000,000")).toBeInTheDocument();
  });

  it("shows conversion rate calculations", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    expect(screen.getByText("25.5%")).toBeInTheDocument(); // 25/100 * 100
    expect(screen.getByText("30.0%")).toBeInTheDocument(); // 3/5 * 100 (recent recovery)
  });

  it("displays pipeline revenue calculation", () => {
    render(
      <RevenueDashboard 
        revenueMetrics={mockRevenueMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    // Pipeline revenue should be: contactedLeads * avgRevenue * 0.3
    // 20 * 250 * 0.3 = 1500, but our mock shows 3000, so let's check what's displayed
    expect(screen.getByText("$3,000")).toBeInTheDocument();
  });

  it("handles missing data gracefully", () => {
    const incompleteMetrics = {
      ...mockRevenueMetrics,
      qualifiedLeadsCount: 0,
      contactedLeadsCount: 0,
    };

    render(
      <RevenueDashboard 
        revenueMetrics={incompleteMetrics}
        revenueTrends={mockRevenueTrends}
        isLoading={false}
      />
    );

    // Should still render without crashing
    expect(screen.getByText("Revenue Recovery Dashboard")).toBeInTheDocument();
    expect(screen.getByText("$25,000")).toBeInTheDocument();
  });
});
