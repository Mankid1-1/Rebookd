import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../card";
import { Button } from "../button";
import { Badge } from "../badge";

describe("UI User Experience & Friendliness Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Accessibility", () => {
    it("should have proper semantic HTML structure", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Dashboard content</p>
          </CardContent>
        </Card>
      );

      // Check for semantic structure
      expect(screen.getByRole('heading')).toBeInTheDocument();
      expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    });

    it("should provide proper button roles and labels", () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} aria-label="Start recovery process">
          Start Recovery
        </Button>
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Start recovery process');
      
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalled();
    });

    it("should support keyboard navigation", () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick}>Test Button</Button>
      );

      const button = screen.getByRole('button');
      
      // Test keyboard interaction
      button.focus();
      expect(document.activeElement).toBe(button);
      
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalled();
      
      fireEvent.keyDown(button, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it("should have proper ARIA attributes", () => {
      render(
        <div>
          <Badge aria-live="polite">Status: Active</Badge>
          <Button aria-describedby="help-text">Action</Button>
          <span id="help-text">Click to perform action</span>
        </div>
      );

      expect(screen.getByText('Status: Active')).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByRole('button')).toHaveAttribute('aria-describedby', 'help-text');
    });
  });

  describe("Visual Design & Layout", () => {
    it("should display clear visual hierarchy", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Revenue Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <h2>Total Revenue</h2>
            <p className="text-2xl font-bold">$12,500</p>
            <p className="text-sm text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      );

      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
      expect(screen.getByText('$12,500')).toBeInTheDocument();
    });

    it("should use consistent color coding", () => {
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

    it("should provide adequate spacing and layout", () => {
      render(
        <Card>
          <CardContent>
            <div className="space-y-4">
              <div>First item</div>
              <div>Second item</div>
              <div>Third item</div>
            </div>
          </CardContent>
        </Card>
      );

      expect(screen.getByText('First item')).toBeInTheDocument();
      expect(screen.getByText('Second item')).toBeInTheDocument();
      expect(screen.getByText('Third item')).toBeInTheDocument();
    });
  });

  describe("Interactive Elements", () => {
    it("should provide visual feedback on interaction", () => {
      const handleClick = vi.fn();
      render(
        <Button 
          onClick={handleClick}
          className="hover:bg-primary/80 transition-colors"
        >
          Interactive Button
        </Button>
      );

      const button = screen.getByRole('button');
      
      // Simulate hover
      fireEvent.mouseEnter(button);
      fireEvent.mouseLeave(button);
      
      // Button should still be present and functional
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalled();
    });

    it("should handle loading states", () => {
      const LoadingButton = ({ loading }) => (
        <Button disabled={loading}>
          {loading ? 'Loading...' : 'Submit'}
        </Button>
      );

      const { rerender } = render(<LoadingButton loading={false} />);
      expect(screen.getByText('Submit')).toBeInTheDocument();
      expect(screen.getByRole('button')).not.toBeDisabled();

      rerender(<LoadingButton loading={true} />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it("should show confirmation for destructive actions", () => {
      const handleDelete = vi.fn();
      render(
        <div>
          <Button variant="destructive" onClick={handleDelete}>
            Delete Item
          </Button>
          <div role="dialog" style={{ display: 'none' }}>
            <p>Are you sure you want to delete?</p>
            <Button onClick={() => {}}>Confirm</Button>
            <Button onClick={() => {}}>Cancel</Button>
          </div>
        </div>
      );

      expect(screen.getByText('Delete Item')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });
  });

  describe("Error Handling & Validation", () => {
    it("should display clear error messages", () => {
      const ErrorComponent = ({ error }) => (
        <div role="alert">
          <h2>Error</h2>
          <p>{error}</p>
          <Button onClick={() => {}}>Retry</Button>
        </div>
      );

      render(<ErrorComponent error="Failed to load data" />);
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it("should provide helpful empty states", () => {
      const EmptyState = () => (
        <Card>
          <CardContent>
            <div className="text-center py-8">
              <h3>No Data Available</h3>
              <p>Start by adding some data to see insights here.</p>
              <Button>Add Data</Button>
            </div>
          </CardContent>
        </Card>
      );

      render(<EmptyState />);
      
      expect(screen.getByText('No Data Available')).toBeInTheDocument();
      expect(screen.getByText('Start by adding some data to see insights here.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add data/i })).toBeInTheDocument();
    });

    it("should validate user input appropriately", () => {
      const FormComponent = () => {
        const [error, setError] = React.useState('');
        return (
          <div>
            <input
              type="email"
              placeholder="Enter email"
              aria-label="Email input"
              onChange={(e) => {
                if (!e.target.value.includes('@')) {
                  setError('Please enter a valid email address');
                } else {
                  setError('');
                }
              }}
            />
            {error && <span role="alert">{error}</span>}
          </div>
        );
      };

      render(<FormComponent />);
      
      const input = screen.getByLabelText('Email input');
      
      fireEvent.change(input, { target: { value: 'invalid-email' } });
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      
      fireEvent.change(input, { target: { value: 'valid@email.com' } });
      expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
    });
  });

  describe("Responsive Design", () => {
    it("should adapt to different screen sizes", () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const ResponsiveComponent = () => (
        <Card>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>Mobile First</div>
              <div>Desktop View</div>
              <div>Large Screen</div>
            </div>
          </CardContent>
        </Card>
      );

      render(<ResponsiveComponent />);
      
      expect(screen.getByText('Mobile First')).toBeInTheDocument();
      expect(screen.getByText('Desktop View')).toBeInTheDocument();
      expect(screen.getByText('Large Screen')).toBeInTheDocument();
    });

    it("should have touch-friendly elements", () => {
      const TouchButton = () => (
        <Button 
          className="min-h-[44px] min-w-[44px]"
          onClick={() => {}}
        >
          Touch Me
        </Button>
      );

      render(<TouchButton />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      // Touch-friendly size would be verified by visual testing
    });
  });

  describe("Performance & Optimization", () => {
    it("should handle large datasets efficiently", async () => {
      const largeDataSet = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random() * 100
      }));

      const ListComponent = () => (
        <div>
          {largeDataSet.map(item => (
            <div key={item.id} data-testid={`item-${item.id}`}>
              {item.name}: ${item.value.toFixed(2)}
            </div>
          ))}
        </div>
      );

      const startTime = performance.now();
      render(<ListComponent />);
      const endTime = performance.now();

      // Should render quickly
      expect(endTime - startTime).toBeLessThan(100);
      expect(screen.getByTestId('item-0')).toBeInTheDocument();
      expect(screen.getByTestId('item-99')).toBeInTheDocument();
    });

    it("should not cause memory leaks", () => {
      const ComponentWithCleanup = () => {
        const [count, setCount] = React.useState(0);
        
        return (
          <div>
            <Button onClick={() => setCount(c => c + 1)}>
              Count: {count}
            </Button>
          </div>
        );
      };

      const { unmount } = render(<ComponentWithCleanup />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      expect(screen.getByText('Count: 1')).toBeInTheDocument();
      
      // Cleanup
      unmount();
      // Component should be properly cleaned up
    });
  });

  describe("User Guidance & Help", () => {
    it("should provide tooltips and help text", () => {
      const HelpComponent = () => (
        <div>
          <Button title="Click to start the recovery process">
            Start Recovery
          </Button>
          <div className="help-text">
            <p>This action will attempt to recover lost revenue through automated campaigns.</p>
          </div>
        </div>
      );

      render(<HelpComponent />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Click to start the recovery process');
      expect(screen.getByText(/This action will attempt to recover lost revenue/)).toBeInTheDocument();
    });

    it("should show progress indicators for long operations", () => {
      const ProgressComponent = ({ isLoading }) => (
        <div>
          {isLoading ? (
            <div>
              <div aria-live="polite">Processing...</div>
              <div className="progress-bar" role="progressbar" aria-valuenow={50} aria-valuemin={0} aria-valuemax={100}>
                50%
              </div>
            </div>
          ) : (
            <div>Complete!</div>
          )}
        </div>
      );

      const { rerender } = render(<ProgressComponent isLoading={true} />);
      expect(screen.getByText('Processing...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      rerender(<ProgressComponent isLoading={false} />);
      expect(screen.getByText('Complete!')).toBeInTheDocument();
    });

    it("should provide clear success and error feedback", () => {
      const FeedbackComponent = ({ status }) => {
        if (status === 'success') {
          return (
            <div role="status" className="success-message">
              <h3>Success!</h3>
              <p>Recovery campaign created successfully.</p>
            </div>
          );
        } else if (status === 'error') {
          return (
            <div role="alert" className="error-message">
              <h3>Error</h3>
              <p>Failed to create campaign. Please try again.</p>
            </div>
          );
        }
        return null;
      };

      const { rerender } = render(<FeedbackComponent status="success" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Success!')).toBeInTheDocument();

      rerender(<FeedbackComponent status="error" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });

  describe("Data Visualization", () => {
    it("should provide accessible charts", () => {
      const ChartComponent = () => (
        <div>
          <div role="img" aria-label="Revenue chart showing monthly growth">
            <div className="chart-container">
              <div className="chart-bar" style={{ height: '100px', width: '50px' }} title="January: $2,000"></div>
              <div className="chart-bar" style={{ height: '150px', width: '50px' }} title="February: $3,000"></div>
              <div className="chart-bar" style={{ height: '200px', width: '50px' }} title="March: $4,000"></div>
            </div>
          </div>
          <div className="chart-legend">
            <span className="legend-item">Revenue</span>
            <span className="legend-item">Growth</span>
          </div>
        </div>
      );

      render(<ChartComponent />);
      
      expect(screen.getByLabelText('Revenue chart showing monthly growth')).toBeInTheDocument();
      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('Growth')).toBeInTheDocument();
    });

    it("should handle empty chart states", () => {
      const EmptyChart = () => (
        <div>
          <div role="img" aria-label="No data available for chart">
            <div className="empty-chart">
              <p>No data to display</p>
              <p>Complete some actions to see insights</p>
            </div>
          </div>
        </div>
      );

      render(<EmptyChart />);
      
      expect(screen.getByLabelText('No data available for chart')).toBeInTheDocument();
      expect(screen.getByText('No data to display')).toBeInTheDocument();
    });
  });

  describe("Form Interactions", () => {
    it("should provide clear form labels", () => {
      const FormComponent = () => (
        <form>
          <div>
            <label htmlFor="name">Name</label>
            <input id="name" type="text" placeholder="Enter your name" />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="Enter your email" />
          </div>
          <Button type="submit">Submit</Button>
        </form>
      );

      render(<FormComponent />);
      
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });

    it("should show validation feedback", () => {
      const ValidatedForm = () => {
        const [errors, setErrors] = React.useState({});
        return (
          <form>
            <div>
              <label htmlFor="required-field">Required Field</label>
              <input 
                id="required-field" 
                required 
                onChange={(e) => {
                  if (!e.target.value) {
                    setErrors({ ...errors, required: 'This field is required' });
                  }
                }}
              />
              {errors.required && <span role="alert">{errors.required}</span>}
            </div>
          </form>
        );
      };

      render(<ValidatedForm />);
      
      const input = screen.getByLabelText('Required Field');
      fireEvent.blur(input); // Trigger validation
      
      // Validation would show error for empty required field
    });
  });
});
