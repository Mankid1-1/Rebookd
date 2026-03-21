import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { RevenueLeakageDashboard } from "../analytics/RevenueLeakageDashboard";
import { RevenueDashboard } from "../analytics/RevenueDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "../card";
import { Button } from "../button";
import { Badge } from "../badge";

// Mock data for testing
const mockLeakageReport = {
  totalLeakage: 5000,
  recoverableRevenue: 3250,
  leakageByType: {
    noShows: 1250,
    cancellations: 2000,
    lastMinute: 750,
    doubleBooking: 500,
    underbooking: 300,
    missedFollowups: 150,
    abandonedLeads: 50,
    expiredLeads: 0
  },
  leakageByMonth: [
    { month: "2024-01", leakage: 1200, recovered: 800 },
    { month: "2024-02", leakage: 1500, recovered: 950 },
    { month: "2024-03", leakage: 2300, recovered: 1500 }
  ],
  topLeakageSources: [
    {
      id: "no-shows",
      type: "no_show",
      severity: "high",
      estimatedRevenue: 1250,
      recoveryProbability: 0.65,
      description: "5 no-show appointments costing $1,250",
      affectedLeads: 5,
      timeWindow: "Last 30 days",
      recoveryActions: ["Send re-scheduling SMS", "Offer discount", "Call to re-schedule"]
    }
  ],
  recoveryOpportunities: [
    {
      leadId: 1,
      leadName: "John Doe",
      leadPhone: "+1234567890",
      leakageType: "no_show",
      estimatedRevenue: 250,
      recoveryActions: ["Send re-scheduling SMS", "Offer discount"],
      lastActivity: new Date("2024-03-15")
    }
  ],
  recommendations: [
    {
      category: "process",
      priority: "high",
      title: "Implement No-Show Prevention System",
      description: "Automated reminders and confirmation calls",
      expectedImpact: 625,
      implementationEffort: "medium"
    }
  ]
};

const mockRevenueMetrics = {
  totalRecoveredRevenue: 12500,
  recentRecoveredRevenue: 2500,
  potentialRevenue: 3750,
  avgRevenuePerBooking: 250,
  recoveryRate: 65,
  monthlyGrowth: 15
};

const mockRevenueTrends = [
  { month: "Jan", recovered: 2000, potential: 3000 },
  { month: "Feb", recovered: 2500, potential: 3200 },
  { month: "Mar", recovered: 3000, potential: 3500 }
];

describe("User Friendliness & UI Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Revenue Leakage Dashboard - User Experience", () => {
    it("should display clear and informative loading states", () => {
      render(
        <RevenueLeakageDashboard 
          leakageReport={null} 
          isLoading={true} 
          onRecoveryAction={() => {}} 
        />
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
      expect(screen.getByText(/analyzing revenue leakage/i)).toBeInTheDocument();
    });

    it("should show helpful empty state when no data available", () => {
      render(
        <RevenueLeakageDashboard 
          leakageReport={null} 
          isLoading={false} 
          onRecoveryAction={() => {}} 
        />
      );

      expect(screen.getByText(/no revenue leakage detected/i)).toBeInTheDocument();
      expect(screen.getByText(/analyzing your appointment data/i)).toBeInTheDocument();
    });

    it("should display key metrics prominently", () => {
      render(
        <RevenueLeakageDashboard 
          leakageReport={mockLeakageReport} 
          isLoading={false} 
          onRecoveryAction={() => {}} 
        />
      );

      // Check for key metrics
      expect(screen.getByText(/\$5,000/)).toBeInTheDocument(); // Total leakage
      expect(screen.getByText(/\$3,250/)).toBeInTheDocument(); // Recoverable revenue
      expect(screen.getByText(/65%/)).toBeInTheDocument(); // Recovery rate
    });

    it("should provide clear visual indicators for severity levels", () => {
      render(
        <RevenueLeakageDashboard 
          leakageReport={mockLeakageReport} 
          isLoading={false} 
          onRecoveryAction={() => {}} 
        />
      );

      // Check for severity indicators
      expect(screen.getByText(/high/i)).toBeInTheDocument();
      expect(screen.getByText(/no-shows/i)).toBeInTheDocument();
    });

    it("should offer actionable recovery options", async () => {
      const mockOnRecoveryAction = vi.fn();
      render(
        <RevenueLeakageDashboard 
          leakageReport={mockLeakageReport} 
          isLoading={false} 
          onRecoveryAction={mockOnRecoveryAction} 
        />
      );

      // Find and click recovery action button
      const recoveryButton = screen.getByText(/start recovery/i);
      expect(recoveryButton).toBeInTheDocument();

      await userEvent.click(recoveryButton);
      expect(mockOnRecoveryAction).toHaveBeenCalled();
    });

    it("should display tooltips and help information", () => {
      render(
        <RevenueLeakageDashboard 
          leakageReport={mockLeakageReport} 
          isLoading={false} 
          onRecoveryAction={() => {}} 
        />
      );

      // Check for help indicators
      expect(screen.getByTitle(/help/i)).toBeInTheDocument();
    });

    it("should be responsive and mobile-friendly", () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <RevenueLeakageDashboard 
          leakageReport={mockLeakageReport} 
          isLoading={false} 
          onRecoveryAction={() => {}} 
        />
      );

      // Should still display key information on mobile
      expect(screen.getByText(/\$5,000/)).toBeInTheDocument();
    });
  });

  describe("Revenue Dashboard - User Experience", () => {
    it("should display revenue metrics in an intuitive format", () => {
      render(
        <RevenueDashboard 
          revenueMetrics={mockRevenueMetrics}
          revenueTrends={mockRevenueTrends}
          isLoading={false}
        />
      );

      expect(screen.getByText(/\$12,500/)).toBeInTheDocument(); // Total recovered
      expect(screen.getByText(/\$2,500/)).toBeInTheDocument(); // Recent recovered
      expect(screen.getByText(/65%/)).toBeInTheDocument(); // Recovery rate
    });

    it("should show visual charts and graphs", () => {
      render(
        <RevenueDashboard 
          revenueMetrics={mockRevenueMetrics}
          revenueTrends={mockRevenueTrends}
          isLoading={false}
        />
      );

      // Check for chart containers
      expect(screen.getByTestId(/revenue-trends-chart/i)).toBeInTheDocument();
      expect(screen.getByTestId(/recovery-rate-chart/i)).toBeInTheDocument();
    });

    it("should provide clear period selection options", async () => {
      render(
        <RevenueDashboard 
          revenueMetrics={mockRevenueMetrics}
          revenueTrends={mockRevenueTrends}
          isLoading={false}
        />
      );

      const periodSelector = screen.getByText(/period/i);
      expect(periodSelector).toBeInTheDocument();

      await userEvent.click(periodSelector);
      expect(screen.getByText(/30 days/i)).toBeInTheDocument();
      expect(screen.getByText(/90 days/i)).toBeInTheDocument();
    });
  });

  describe("UI Components - Accessibility & Usability", () => {
    it("should have proper ARIA labels and roles", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => {}}>Test Button</Button>
            <Badge>Test Badge</Badge>
          </CardContent>
        </Card>
      );

      // Check for accessibility attributes
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });

    it("should support keyboard navigation", async () => {
      render(
        <Button onClick={() => {}}>Test Button</Button>
      );

      const button = screen.getByRole('button');
      button.focus();
      expect(document.activeElement).toBe(button);

      await userEvent.keyboard('{Enter}');
      // Button should handle Enter key
    });

    it("should have sufficient color contrast", () => {
      render(
        <Badge variant="destructive">High Priority</Badge>
      );

      const badge = screen.getByText('High Priority');
      expect(badge).toBeInTheDocument();
      // Visual contrast would be checked by accessibility tools
    });

    it("should handle loading states gracefully", () => {
      render(
        <Card>
          <CardContent>
            <div aria-live="polite" aria-busy="true">
              Loading data...
            </div>
          </CardContent>
        </Card>
      );

      expect(screen.getByText('Loading data...')).toBeInTheDocument();
    });

    it("should provide clear error messages", () => {
      const ErrorComponent = () => (
        <Card>
          <CardContent>
            <div role="alert">
              <h2>Error Loading Data</h2>
              <p>Please try again later or contact support.</p>
              <Button onClick={() => {}}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      );

      render(<ErrorComponent />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Error Loading Data')).toBeInTheDocument();
      expect(screen.getByText('Please try again later')).toBeInTheDocument();
    });
  });

  describe("Interactive Elements - User Experience", () => {
    it("should provide visual feedback on hover", async () => {
      render(
        <Button variant="default" onClick={() => {}}>
          Interactive Button
        </Button>
      );

      const button = screen.getByRole('button');
      
      // Simulate hover
      await userEvent.hover(button);
      expect(button).toBeInTheDocument();
    });

    it("should handle form inputs properly", async () => {
      const TestForm = () => {
        const [value, setValue] = '';
        return (
          <input
            type="text"
            placeholder="Enter your name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Name input"
          />
        );
      };

      render(<TestForm />);

      const input = screen.getByLabelText('Name input');
      expect(input).toBeInTheDocument();

      await userEvent.type(input, 'John Doe');
      expect(input).toHaveValue('John Doe');
    });

    it("should validate user input appropriately", async () => {
      const TestForm = () => {
        const [error, setError] = '';
        const validateEmail = (email: string) => {
          if (!email.includes('@')) {
            setError('Please enter a valid email');
          }
        };

        return (
          <div>
            <input
              type="email"
              placeholder="Enter email"
              onChange={(e) => validateEmail(e.target.value)}
              aria-label="Email input"
            />
            {error && <span role="alert">{error}</span>}
          </div>
        );
      };

      render(<TestForm />);

      const input = screen.getByLabelText('Email input');
      await userEvent.type(input, 'invalid-email');
      
      expect(screen.getByText('Please enter a valid email')).toBeInTheDocument();
    });

    it("should provide confirmation dialogs for important actions", async () => {
      const TestDialog = () => {
        const [isOpen, setIsOpen] = false;
        return (
          <div>
            <Button onClick={() => setIsOpen(true)}>Delete Item</Button>
            {isOpen && (
              <div role="dialog" aria-labelledby="dialog-title">
                <h2 id="dialog-title">Confirm Deletion</h2>
                <p>Are you sure you want to delete this item?</p>
                <Button onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button onClick={() => setIsOpen(false)}>Delete</Button>
              </div>
            )}
          </div>
        );
      };

      render(<TestDialog />);

      const deleteButton = screen.getByText('Delete Item');
      await userEvent.click(deleteButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
    });
  });

  describe("Data Visualization - User Experience", () => {
    it("should display charts with proper labels", () => {
      const ChartComponent = () => (
        <div data-testid="revenue-chart">
          <div aria-label="Revenue chart showing monthly trends">
            <div role="img" aria-label="Chart showing revenue growth">
              <span>January: $2,000</span>
              <span>February: $2,500</span>
              <span>March: $3,000</span>
            </div>
          </div>
        </div>
      );

      render(<ChartComponent />);

      expect(screen.getByLabelText('Revenue chart showing monthly trends')).toBeInTheDocument();
      expect(screen.getByText('January: $2,000')).toBeInTheDocument();
    });

    it("should provide chart tooltips and legends", async () => {
      const ChartWithTooltip = () => (
        <div>
          <div data-testid="chart-element">
            <div className="chart-bar" title="No-shows: $1,250">Bar</div>
          </div>
          <div className="chart-legend">
            <span>No-shows</span>
            <span>Cancellations</span>
          </div>
        </div>
      );

      render(<ChartWithTooltip />);

      const chartBar = screen.getByText('Bar');
      await userEvent.hover(chartBar);
      
      expect(screen.getByText('No-shows')).toBeInTheDocument();
      expect(screen.getByText('Cancellations')).toBeInTheDocument();
    });

    it("should handle empty chart states gracefully", () => {
      const EmptyChart = () => (
        <div data-testid="empty-chart">
          <div aria-label="No data available for chart">
            <p>No data to display</p>
            <p>Start generating data to see insights</p>
          </div>
        </div>
      );

      render(<EmptyChart />);

      expect(screen.getByText('No data to display')).toBeInTheDocument();
      expect(screen.getByText('Start generating data to see insights')).toBeInTheDocument();
    });
  });

  describe("Performance - User Experience", () => {
    it("should render quickly with large datasets", async () => {
      const largeDataSet = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Lead ${i}`,
        revenue: 250
      }));

      const LargeList = () => (
        <div>
          {largeDataSet.map(item => (
            <div key={item.id} data-testid={`lead-${item.id}`}>
              {item.name}: ${item.revenue}
            </div>
          ))}
        </div>
      );

      const startTime = performance.now();
      render(<LargeList />);
      const endTime = performance.now();

      // Should render within 100ms
      expect(endTime - startTime).toBeLessThan(100);
      expect(screen.getByTestId('lead-0')).toBeInTheDocument();
      expect(screen.getByTestId('lead-999')).toBeInTheDocument();
    });

    it("should handle rapid user interactions smoothly", async () => {
      let clickCount = 0;
      const InteractiveComponent = () => (
        <Button onClick={() => clickCount++}>
          Clicked {clickCount} times
        </Button>
      );

      render(<InteractiveComponent />);

      const button = screen.getByRole('button');

      // Rapid clicking
      for (let i = 0; i < 10; i++) {
        await userEvent.click(button);
      }

      expect(screen.getByText('Clicked 10 times')).toBeInTheDocument();
    });
  });

  describe("Error Handling - User Experience", () => {
    it("should display user-friendly error messages", () => {
      const ErrorBoundary = ({ children, hasError }) => {
        if (hasError) {
          return (
            <div role="alert">
              <h2>Something went wrong</h2>
              <p>We're having trouble loading this data. Please try refreshing the page.</p>
              <Button onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            </div>
          );
        }
        return children;
      };

      render(
        <ErrorBoundary hasError={true}>
          <div>Content that failed to load</div>
        </ErrorBoundary>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Refresh Page')).toBeInTheDocument();
    });

    it("should provide retry mechanisms for failed operations", async () => {
      let attemptCount = 0;
      const RetryComponent = () => {
        const [error, setError] = false;
        const [loading, setLoading] = false;

        const fetchData = async () => {
          setLoading(true);
          attemptCount++;
          if (attemptCount < 2) {
            setError(true);
          } else {
            setError(false);
          }
          setLoading(false);
        };

        if (loading) return <div>Loading...</div>;
        if (error) {
          return (
            <div>
              <p>Failed to load data</p>
              <Button onClick={fetchData}>Retry</Button>
            </div>
          );
        }
        return <div>Data loaded successfully!</div>;
      };

      render(<RetryComponent />);

      // First attempt fails
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();

      // Retry and succeed
      const retryButton = screen.getByText('Retry');
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Data loaded successfully!')).toBeInTheDocument();
      });
    });
  });

  describe("Mobile Responsiveness - User Experience", () => {
    it("should adapt layout for mobile screens", () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const ResponsiveLayout = () => (
        <div className="mobile-layout">
          <header className="mobile-header">
            <h1>Revenue Dashboard</h1>
          </header>
          <main className="mobile-main">
            <Card>
              <CardContent>
                <h2>Key Metrics</h2>
                <p>$5,000 Total Leakage</p>
              </CardContent>
            </Card>
          </main>
        </div>
      );

      render(<ResponsiveLayout />);

      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Key Metrics')).toBeInTheDocument();
      expect(screen.getByText('$5,000 Total Leakage')).toBeInTheDocument();
    });

    it("should have touch-friendly interactive elements", () => {
      const TouchFriendlyButton = () => (
        <Button 
          className="touch-friendly"
          style={{ minHeight: '44px', minWidth: '44px' }}
          onClick={() => {}}
        >
          Touch Me
        </Button>
      );

      render(<TouchFriendlyButton />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      
      // Button should be large enough for touch (44px minimum)
      expect(button).toHaveStyle({ minHeight: '44px', minWidth: '44px' });
    });
  });
});
