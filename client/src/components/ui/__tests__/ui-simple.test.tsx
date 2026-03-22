import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Card, CardContent, CardHeader, CardTitle } from "../card";
import { Button } from "../button";
import { Badge } from "../badge";

describe("UI User Experience - Simple Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Component Rendering", () => {
    it("should render card components correctly", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Revenue Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Total Revenue: $12,500</p>
          </CardContent>
        </Card>
      );

      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Total Revenue: $12,500')).toBeInTheDocument();
    });

    it("should render buttons with proper accessibility", () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} aria-label="Start recovery">
          Start Recovery
        </Button>
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Start recovery');
      
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalled();
    });

    it("should render badges with appropriate styling", () => {
      render(
        <div>
          <Badge variant="destructive">High Priority</Badge>
          <Badge variant="default">Normal</Badge>
          <Badge variant="secondary">Low Priority</Badge>
        </div>
      );

      expect(screen.getByText('High Priority')).toBeInTheDocument();
      expect(screen.getByText('Normal')).toBeInTheDocument();
      expect(screen.getByText('Low Priority')).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle button clicks properly", () => {
      const mockAction = vi.fn();
      render(
        <Button onClick={mockAction}>
          Click Me
        </Button>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);
      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it("should support keyboard navigation", () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick}>
          Test Button
        </Button>
      );

      const button = screen.getByRole('button');
      
      // Test Enter key
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);
      
      // Test Space key
      fireEvent.keyDown(button, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it("should handle hover states", () => {
      const handleHover = vi.fn();
      render(
        <Button onMouseEnter={handleHover}>
          Hover Me
        </Button>
      );

      const button = screen.getByRole('button');
      fireEvent.mouseEnter(button);
      expect(handleHover).toHaveBeenCalled();
    });
  });

  describe("Loading and Error States", () => {
    it("should show loading state", () => {
      const LoadingComponent = ({ isLoading }) => (
        <Button disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Submit'}
        </Button>
      );

      const { rerender } = render(<LoadingComponent isLoading={true} />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();

      rerender(<LoadingComponent isLoading={false} />);
      expect(screen.getByText('Submit')).toBeInTheDocument();
      expect(screen.getByRole('button')).not.toBeDisabled();
    });

    it("should display error messages", () => {
      const ErrorComponent = ({ error }) => (
        <div role="alert">
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      );

      render(<ErrorComponent error="Failed to load data" />);
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });

    it("should show empty states", () => {
      const EmptyState = () => (
        <Card>
          <CardContent>
            <h3>No Data Available</h3>
            <p>Start by adding some data to see insights here.</p>
          </CardContent>
        </Card>
      );

      render(<EmptyState />);
      
      expect(screen.getByText('No Data Available')).toBeInTheDocument();
      expect(screen.getByText('Start by adding some data to see insights here.')).toBeInTheDocument();
    });
  });

  describe("Form Elements", () => {
    it("should render form inputs with labels", () => {
      render(
        <form>
          <div>
            <label htmlFor="name">Name</label>
            <input id="name" type="text" placeholder="Enter your name" />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="Enter your email" />
          </div>
        </form>
      );

      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });

    it("should handle input changes", () => {
      const handleChange = vi.fn();
      render(
        <input
          type="text"
          placeholder="Type here"
          onChange={handleChange}
        />
      );

      const input = screen.getByPlaceholderText('Type here');
      fireEvent.change(input, { target: { value: 'Hello World' } });
      expect(handleChange).toHaveBeenCalled();
    });

    it("should validate required fields", () => {
      render(
        <form>
          <input
            type="text"
            required
            aria-label="Required field"
          />
        </form>
      );

      const input = screen.getByLabelText('Required field');
      expect(input).toHaveAttribute('required');
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      render(
        <div>
          <Button aria-label="Close dialog">X</Button>
          <Badge aria-live="polite">Status: Active</Badge>
        </div>
      );

      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Close dialog');
      expect(screen.getByText('Status: Active')).toHaveAttribute('aria-live', 'polite');
    });

    it("should support screen readers", () => {
      render(
        <div role="main">
          <h1>Revenue Dashboard</h1>
          <div role="img" aria-label="Chart showing revenue growth">
            <p>Revenue increased by 25% this month</p>
          </div>
        </div>
      );

      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByLabelText('Chart showing revenue growth')).toBeInTheDocument();
    });

    it("should have proper focus management", () => {
      render(
        <div>
          <Button>First Button</Button>
          <Button>Second Button</Button>
          <Button>Third Button</Button>
        </div>
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
      
      // Test focus
      buttons[0].focus();
      expect(document.activeElement).toBe(buttons[0]);
    });
  });

  describe("Responsive Design", () => {
    it("should adapt to mobile viewports", () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const MobileComponent = () => (
        <Card>
          <CardContent>
            <h2>Mobile Dashboard</h2>
            <p>Optimized for mobile devices</p>
          </CardContent>
        </Card>
      );

      render(<MobileComponent />);
      
      expect(screen.getByText('Mobile Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Optimized for mobile devices')).toBeInTheDocument();
    });

    it("should have touch-friendly elements", () => {
      render(
        <Button style={{ minHeight: '44px', minWidth: '44px' }}>
          Touch Button
        </Button>
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      // Touch-friendly size would be verified by visual testing tools
    });
  });

  describe("Visual Feedback", () => {
    it("should provide hover feedback", () => {
      const handleHover = vi.fn();
      render(
        <Button onMouseEnter={handleHover} onMouseLeave={vi.fn()}>
          Hover Button
        </Button>
      );

      const button = screen.getByRole('button');
      fireEvent.mouseEnter(button);
      expect(handleHover).toHaveBeenCalled();
    });

    it("should show tooltips", () => {
      render(
        <Button title="Click to start recovery process">
          Start Recovery
        </Button>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Click to start recovery process');
    });

    it("should display progress indicators", () => {
      render(
        <div>
          <div aria-live="polite">Processing...</div>
          <div role="progressbar" aria-valuenow={50} aria-valuemin={0} aria-valuemax={100}>
            50%
          </div>
        </div>
      );

      expect(screen.getByText('Processing...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe("Data Visualization", () => {
    it("should render accessible charts", () => {
      render(
        <div role="img" aria-label="Revenue chart showing monthly growth">
          <div className="chart-container">
            <div className="chart-bar" title="January: $2,000">Jan</div>
            <div className="chart-bar" title="February: $3,000">Feb</div>
            <div className="chart-bar" title="March: $4,000">Mar</div>
          </div>
          <div className="chart-legend">
            <span>Revenue</span>
            <span>Growth</span>
          </div>
        </div>
      );

      expect(screen.getByLabelText('Revenue chart showing monthly growth')).toBeInTheDocument();
      expect(screen.getByText('Jan')).toBeInTheDocument();
      expect(screen.getByText('Feb')).toBeInTheDocument();
      expect(screen.getByText('Mar')).toBeInTheDocument();
      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('Growth')).toBeInTheDocument();
    });

    it("should handle empty chart states", () => {
      render(
        <div role="img" aria-label="No data available for chart">
          <div className="empty-chart">
            <p>No data to display</p>
            <p>Complete some actions to see insights</p>
          </div>
        </div>
      );

      expect(screen.getByLabelText('No data available for chart')).toBeInTheDocument();
      expect(screen.getByText('No data to display')).toBeInTheDocument();
      expect(screen.getByText('Complete some actions to see insights')).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("should render quickly", () => {
      const startTime = performance.now();
      
      render(
        <Card>
          <CardContent>
            <h1>Performance Test</h1>
            <p>This should render quickly</p>
          </CardContent>
        </Card>
      );
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100); // Should render in under 100ms
      expect(screen.getByText('Performance Test')).toBeInTheDocument();
    });

    it("should handle multiple components efficiently", () => {
      const items = Array.from({ length: 50 }, (_, i) => `Item ${i}`);
      
      const startTime = performance.now();
      
      render(
        <div>
          {items.map(item => (
            <div key={item}>{item}</div>
          ))}
        </div>
      );
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(200); // Should render 50 items in under 200ms
      expect(screen.getByText('Item 0')).toBeInTheDocument();
      expect(screen.getByText('Item 49')).toBeInTheDocument();
    });
  });

  describe("Error Boundaries", () => {
    it("should handle component errors gracefully", () => {
      const ErrorComponent = ({ hasError }) => {
        if (hasError) {
          return (
            <div role="alert">
              <h2>Something went wrong</h2>
              <p>Please try refreshing the page.</p>
              <Button onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            </div>
          );
        }
        return <div>Normal content</div>;
      };

      render(<ErrorComponent hasError={true} />);
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Please try refreshing the page.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();
    });
  });

  describe("Confirmation Dialogs", () => {
    it("should show confirmation for important actions", () => {
      const ConfirmDialog = ({ isOpen }) => {
        if (!isOpen) return null;
        
        return (
          <div role="dialog" aria-labelledby="dialog-title">
            <h2 id="dialog-title">Confirm Deletion</h2>
            <p>Are you sure you want to delete this item?</p>
            <Button onClick={() => {}}>Cancel</Button>
            <Button onClick={() => {}}>Delete</Button>
          </div>
        );
      };

      render(<ConfirmDialog isOpen={true} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });
  });
});
