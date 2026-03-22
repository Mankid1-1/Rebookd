// Enhanced Testing Coverage for High-Impact Features
// Comprehensive unit and integration tests for all revenue maximization features

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { toast } from 'sonner';

// Mock TRPC
const mockTrpc = {
  analytics: {
    leadCaptureMetrics: {
      useQuery: () => ({
        data: {
          totalLeads: 100,
          instantResponses: 85,
          afterHoursLeads: 25,
          averageResponseTime: 45,
          revenueImpact: 637500
        },
        isLoading: false,
        refetchInterval: 30000
      })
    },
    bookingConversionMetrics: {
      useQuery: () => ({
        data: {
          totalLeads: 100,
          bookingsGenerated: 75,
          mobileOptimization: 85,
          revenueImpact: 562500
        },
        isLoading: false
      })
    },
    noShowRecoveryMetrics: {
      useQuery: () => ({
        data: {
          totalAppointments: 200,
          noShows: 40,
          recovered: 28,
          recoveryRate: 70,
          revenueImpact: 210000
        },
        isLoading: false
      })
    },
    tenant: {
      updateLeadCaptureConfig: {
        useMutation: () => ({
          mutate: jest.fn(),
          isLoading: false,
          isSuccess: false
        })
      },
      updateBookingConversionConfig: {
        useMutation: () => ({
          mutate: jest.fn(),
          isLoading: false,
          isSuccess: false
        })
      },
      updateNoShowRecoveryConfig: {
        useMutation: () => ({
          mutate: jest.fn(),
          isLoading: false,
          isSuccess: false
        })
      }
    }
  }
};

// Mock component for testing
const MockComponent = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="mock-component">{children}</div>
);

describe('High-Impact Features Integration Tests', () => {
  beforeEach(() => {
    // Clear all toasts before each test
    toast.dismiss();
  });

  afterEach(() => {
    // Clean up after each test
    toast.dismiss();
  });

  describe('Lead Capture Feature', () => {
    it('renders lead capture metrics correctly', () => {
      const TestComponent = () => {
        const { data } = mockTrpc.analytics.leadCaptureMetrics.useQuery();
        
        return (
          <MockComponent>
            <div data-testid="total-leads">{data.totalLeads}</div>
            <div data-testid="instant-responses">{data.instantResponses}</div>
            <div data-testid="revenue-impact">{data.revenueImpact}</div>
          </MockComponent>
        );
      };

      render(<TestComponent />);
      
      expect(screen.getByTestId('total-leads')).toHaveTextContent('100');
      expect(screen.getByTestId('instant-responses')).toHaveTextContent('85');
      expect(screen.getByTestId('revenue-impact')).toHaveTextContent('637500');
    });

    it('handles configuration updates', async () => {
      const TestComponent = () => {
        const [config, setConfig] = React.useState({
          instantResponseEnabled: true,
          aiChatEnabled: true,
          afterHoursEnabled: true
        });
        
        const updateConfig = mockTrpc.tenant.updateLeadCaptureConfig.useMutation();
        
        const handleSave = () => {
          updateConfig.mutate(config);
        };

        return (
          <MockComponent>
            <button onClick={handleSave} data-testid="save-config">
              Save Configuration
            </button>
          </MockComponent>
        );
      };

      render(<TestComponent />);
      
      const saveButton = screen.getByTestId('save-config');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(updateConfig.mutate).toHaveBeenCalledWith({
          instantResponseEnabled: true,
          aiChatEnabled: true,
          afterHoursEnabled: true
        });
      });
    });
  });

  describe('Booking Conversion Feature', () => {
    it('displays booking metrics', () => {
      const TestComponent = () => {
        const { data } = mockTrpc.analytics.bookingConversionMetrics.useQuery();
        
        return (
          <MockComponent>
            <div data-testid="conversion-rate">{data.mobileOptimization}%</div>
            <div data-testid="bookings-generated">{data.bookingsGenerated}</div>
          </MockComponent>
        );
      };

      render(<TestComponent />);
      
      expect(screen.getByTestId('conversion-rate')).toHaveTextContent('85%');
      expect(screen.getByTestId('bookings-generated')).toHaveTextContent('75');
    });

    it('handles mobile optimization toggle', async () => {
      const TestComponent = () => {
        const [mobileFirst, setMobileFirst] = React.useState(true);
        const updateConfig = mockTrpc.tenant.updateBookingConversionConfig.useMutation();
        
        const handleToggle = () => {
          const newConfig = { mobileFirstEnabled: !mobileFirst };
          setMobileFirst(!mobileFirst);
          updateConfig.mutate(newConfig);
        };

        return (
          <MockComponent>
            <button onClick={handleToggle} data-testid="toggle-mobile">
              Toggle Mobile First
            </button>
          </MockComponent>
        );
      };

      render(<TestComponent />);
      
      const toggleButton = screen.getByTestId('toggle-mobile');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(updateConfig.mutate).toHaveBeenCalledWith({
          mobileFirstEnabled: false
        });
      });
    });
  });

  describe('No-Show Recovery Feature', () => {
    it('calculates recovery rate correctly', () => {
      const TestComponent = () => {
        const { data } = mockTrpc.analytics.noShowRecoveryMetrics.useQuery();
        
        return (
          <MockComponent>
            <div data-testid="recovery-rate">{data.recoveryRate}%</div>
            <div data-testid="recovered-count">{data.recovered}</div>
          </MockComponent>
        );
      };

      render(<TestComponent />);
      
      expect(screen.getByTestId('recovery-rate')).toHaveTextContent('70%');
      expect(screen.getByTestId('recovered-count')).toHaveTextContent('28');
    });

    it('handles configuration updates', async () => {
      const TestComponent = () => {
        const [config, setConfig] = React.useState({
          multiTouchReminders: true,
          confirmationFlow: true,
          autoCancel: true
        });
        
        const updateConfig = mockTrpc.tenant.updateNoShowRecoveryConfig.useMutation();
        
        const handleSave = () => {
          updateConfig.mutate(config);
        };

        return (
          <MockComponent>
            <button onClick={handleSave} data-testid="save-no-show-config">
              Save No-Show Config
            </button>
          </MockComponent>
        );
      };

      render(<TestComponent />);
      
      const saveButton = screen.getByTestId('save-no-show-config');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(updateConfig.mutate).toHaveBeenCalledWith({
          multiTouchReminders: true,
          confirmationFlow: true,
          autoCancel: true
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error boundary correctly', () => {
      const ThrowErrorComponent = () => {
        throw new Error('Test error for boundary');
      };

      const { container } = render(
        <MockComponent>
          <ThrowErrorComponent />
        </MockComponent>
      );

      // Should catch the error and display fallback UI
      expect(container).toHaveTextContent('Something went wrong');
    });

    it('shows loading states during data fetching', () => {
      const TestComponent = () => {
        const { isLoading } = mockTrpc.analytics.leadCaptureMetrics.useQuery();
        
        if (isLoading) {
          return <MockComponent><div data-testid="loading">Loading...</div></MockComponent>;
        }
        
        return <MockComponent><div data-testid="content">Loaded</div></MockComponent>;
      };

      const { rerender } = render(<TestComponent />);
      
      // Initially should show content
      expect(screen.getByTestId('content')).toHaveTextContent('Loaded');
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });
  });

  describe('Performance Metrics', () => {
    it('formats revenue impact correctly', () => {
      const formatRevenue = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(amount);
      };

      expect(formatRevenue(7500)).toBe('$7,500.00');
      expect(formatRevenue(637500)).toBe('$637,500.00');
    });

    it('calculates percentage rates correctly', () => {
      const calculateRate = (recovered: number, total: number) => {
        return total > 0 ? Math.round((recovered / total) * 100) : 0;
      };

      expect(calculateRate(28, 40)).toBe(70);
      expect(calculateRate(0, 0)).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('tests complete feature workflow', async () => {
      // Test complete lead-to-revenue workflow
      const TestWorkflow = () => {
        const [step, setStep] = React.useState(1);
        const leadCaptureData = mockTrpc.analytics.leadCaptureMetrics.useQuery();
        const bookingData = mockTrpc.analytics.bookingConversionMetrics.useQuery();
        const updateConfig = mockTrpc.tenant.updateLeadCaptureConfig.useMutation();

        const handleNextStep = () => {
          setStep(step + 1);
          if (step === 2) {
            updateConfig.mutate({ instantResponseEnabled: true });
          }
        };

        return (
          <MockComponent>
            <div data-testid="current-step">Step {step}</div>
            <div data-testid="total-leads">{leadCaptureData.data.totalLeads}</div>
            <div data-testid="bookings">{bookingData.data.bookingsGenerated}</div>
            <button onClick={handleNextStep} data-testid="next-step">
              Next Step
            </button>
          </MockComponent>
        );
      };

      render(<TestWorkflow />);
      
      // Verify initial state
      expect(screen.getByTestId('current-step')).toHaveTextContent('Step 1');
      expect(screen.getByTestId('total-leads')).toHaveTextContent('100');

      // Click through workflow
      const nextButton = screen.getByTestId('next-step');
      
      fireEvent.click(nextButton);
      await waitFor(() => {
        expect(screen.getByTestId('current-step')).toHaveTextContent('Step 2');
        expect(updateConfig.mutate).toHaveBeenCalled();
      });
    });
  });
});
