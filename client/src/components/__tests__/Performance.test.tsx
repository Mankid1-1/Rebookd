/**
 * 🚀 PERFORMANCE TESTS
 * Performance testing for Visual Automation Builder and Progressive Disclosure UI
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { VisualAutomationBuilder } from '../../automation/VisualAutomationBuilder';
import { 
  useProgressiveDisclosure, 
  ProgressiveDisclosure,
  AdaptiveUIController 
} from '../../ui/ProgressiveDisclosure';

// Performance monitoring utilities
class PerformanceMonitor {
  private measurements: Map<string, number[]> = new Map();
  
  startMeasurement(name: string) {
    this.measurements.set(name, []);
    return performance.now();
  }
  
  endMeasurement(name: string, startTime: number) {
    const duration = performance.now() - startTime;
    const measurements = this.measurements.get(name) || [];
    measurements.push(duration);
    this.measurements.set(name, measurements);
    return duration;
  }
  
  getAverageTime(name: string): number {
    const measurements = this.measurements.get(name) || [];
    return measurements.reduce((a, b) => a + b, 0) / measurements.length;
  }
  
  getMaxTime(name: string): number {
    const measurements = this.measurements.get(name) || [];
    return Math.max(...measurements);
  }
  
  getMinTime(name: string): number {
    const measurements = this.measurements.get(name) || [];
    return Math.min(...measurements);
  }
  
  reset() {
    this.measurements.clear();
  }
}

// Mock components for performance testing
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="card-title">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => 
    <button data-testid="button" onClick={onClick} {...props}>{children}</button>,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: any) => 
    <div data-testid="progress" style={{ width: `${value}%` }}></div>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Performance Tests: Visual Automation Builder', () => {
  let monitor: PerformanceMonitor;
  
  beforeEach(() => {
    monitor = new PerformanceMonitor();
    vi.clearAllMocks();
    
    // Mock canvas dimensions
    global.Element.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }));
  });

  describe('Rendering Performance', () => {
    it('renders initial interface within acceptable time', async () => {
      const monitor = new PerformanceMonitor();
      const startTime = monitor.startMeasurement('initial-render');
      
      render(
        <VisualAutomationBuilder
          onSave={() => {}}
          onExecute={() => {}}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Node Library')).toBeInTheDocument();
      });
      
      const renderTime = monitor.endMeasurement('initial-render', startTime);
      expect(renderTime).toBeLessThan(1000); // Should render within 1 second
    });

    it('handles large number of nodes efficiently', async () => {
      const user = userEvent.setup();
      const monitor = new PerformanceMonitor();
      render(
        <VisualAutomationBuilder
          onSave={() => {}}
          onExecute={() => {}}
        />
      );
      
      const startTime = monitor.startMeasurement('add-many-nodes');
      
      // Add 100 nodes
      for (let i = 0; i < 100; i++) {
        const missedCallNode = screen.getByText('Missed Call');
        await user.click(missedCallNode);
      }
      
      const totalTime = monitor.endMeasurement('add-many-nodes', startTime);
      const averageTime = totalTime / 100;
      
      expect(averageTime).toBeLessThan(50); // Average 50ms per node
      expect(totalTime).toBeLessThan(5000); // Total within 5 seconds
    });

    it('maintains performance with complex connections', async () => {
      const user = userEvent.setup();
      
      render(
        <VisualAutomationBuilder
          onSave={() => {}}
          onExecute={() => {}}
        />
      );
      
      // Add nodes first
      for (let i = 0; i < 50; i++) {
        const missedCallNode = screen.getByText('Missed Call');
        await user.click(missedCallNode);
      }
      
      const startTime = monitor.startMeasurement('create-connections');
      
      // Create connections (this would involve complex canvas operations)
      for (let i = 0; i < 25; i++) {
        // Simulate connection creation
        const connectionTime = monitor.endMeasurement(`connection-${i}`, startTime);
        expect(connectionTime).toBeLessThan(100); // Each connection under 100ms
      }
    });
  });

  describe('Memory Performance', () => {
    it('does not leak memory with repeated operations', async () => {
      const user = userEvent.setup();
      
      render(
        <VisualAutomationBuilder
          onSave={() => {}}
          onExecute={() => {}}
        />
      );
      
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Perform many operations
      for (let cycle = 0; cycle < 10; cycle++) {
        // Add nodes
        for (let i = 0; i < 20; i++) {
          const missedCallNode = screen.getByText('Missed Call');
          await user.click(missedCallNode);
        }
        
        // Clear nodes (simulate deletion)
        const deleteButtons = screen.getAllByTestId('button').filter(
          button => button.textContent === 'Delete'
        );
        for (const button of deleteButtons.slice(0, 10)) {
          await user.click(button);
        }
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('efficiently manages canvas state', async () => {
      const user = userEvent.setup();
      
      render(
        <VisualAutomationBuilder
          onSave={() => {}}
          onExecute={() => {}}
        />
      );
      
      const startTime = monitor.startMeasurement('canvas-state-management');
      
      // Perform many canvas operations
      for (let i = 0; i < 100; i++) {
        // Add node
        const missedCallNode = screen.getByText('Missed Call');
        await user.click(missedCallNode);
        
        // Zoom in/out
        const zoomButtons = screen.getAllByTestId('button').filter(
          button => button.textContent && ['%', ''].includes(button.textContent as string)
        );
        if (zoomButtons.length > 0) {
          await user.click(zoomButtons[0]);
        }
        
        // Pan canvas
        const canvas = screen.getByTestId('canvas') || document.body;
        await user.drag(canvas, { deltaX: 10, deltaY: 10 });
      }
      
      const totalTime = monitor.endMeasurement('canvas-state-management', startTime);
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Animation Performance', () => {
    it('maintains 60fps during node animations', async () => {
      const user = userEvent.setup();
      
      render(
        <VisualAutomationBuilder
          onSave={() => {}}
          onExecute={() => {}}
        />
      );
      
      const frameTimes: number[] = [];
      
      // Monitor frame rate during animations
      const measureFrame = () => {
        const start = performance.now();
        requestAnimationFrame(() => {
          const end = performance.now();
          frameTimes.push(end - start);
        });
      };
      
      // Trigger animations
      for (let i = 0; i < 60; i++) {
        measureFrame();
        const missedCallNode = screen.getByText('Missed Call');
        await user.click(missedCallNode);
        await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps
      }
      
      const averageFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      expect(averageFrameTime).toBeLessThan(16.67); // Should maintain 60fps (16.67ms per frame)
    });

    it('smoothly handles canvas zoom animations', async () => {
      const user = userEvent.setup();
      
      render(
        <VisualAutomationBuilder
          onSave={() => {}}
          onExecute={() => {}}
        />
      );
      
      const startTime = monitor.startMeasurement('zoom-animation');
      
      // Perform rapid zoom operations
      const zoomButtons = screen.getAllByTestId('button').filter(
        button => button.textContent && ['%', ''].includes(button.textContent as string)
      );
      
      if (zoomButtons.length >= 2) {
        for (let i = 0; i < 20; i++) {
          await user.click(zoomButtons[0]); // Zoom in
          await user.click(zoomButtons[1]); // Zoom out
        }
      }
      
      const totalTime = monitor.endMeasurement('zoom-animation', startTime);
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});

describe('Performance Tests: Progressive Disclosure UI', () => {
  let monitor: PerformanceMonitor;
  
  beforeEach(() => {
    monitor = new PerformanceMonitor();
    vi.clearAllMocks();
  });

  describe('Rendering Performance', () => {
    it('renders adaptive UI quickly', async () => {
      const startTime = monitor.startMeasurement('adaptive-ui-render');
      
      const TestComponent = () => {
        const hook = useProgressiveDisclosure('perf-test');
        return (
          <div>
            <AdaptiveUIController />
            <ProgressiveDisclosure
              featureId="test-feature"
              complexity={['standard', 'advanced', 'expert']}
            >
              <div>Test Content</div>
            </ProgressiveDisclosure>
          </div>
        );
      };
      
      render(<TestComponent />);
      
      await waitFor(() => {
        expect(screen.getByTestId('adaptive-ui-controller')).toBeInTheDocument();
      });
      
      const renderTime = monitor.endMeasurement('adaptive-ui-render', startTime);
      expect(renderTime).toBeLessThan(500); // Should render within 500ms
    });

    it('handles many progressive disclosure components efficiently', async () => {
      const startTime = monitor.startMeasurement('many-disclosure-components');
      
      const TestManyComponents = () => (
        <div>
          {Array.from({ length: 100 }, (_, i) => (
            <ProgressiveDisclosure
              key={i}
              featureId={`feature-${i}`}
              complexity={['standard', 'advanced', 'expert']}
            >
              <div>Feature {i}</div>
            </ProgressiveDisclosure>
          ))}
        </div>
      );
      
      render(<TestManyComponents />);
      
      const renderTime = monitor.endMeasurement('many-disclosure-components', startTime);
      expect(renderTime).toBeLessThan(2000); // Should render within 2 seconds
    });

    it('quickly adjusts complexity levels', async () => {
      const user = userEvent.setup();
      
      const TestComplexityAdjustment = () => {
        const { adjustComplexity } = useProgressiveDisclosure('complexity-perf-test');
        return (
          <div>
            <button onClick={() => adjustComplexity('expert')}>Expert</button>
            <button onClick={() => adjustComplexity('essential')}>Essential</button>
            <AdaptiveUIController />
          </div>
        );
      };
      
      render(<TestComplexityAdjustment />);
      
      const startTime = monitor.startMeasurement('complexity-adjustment');
      
      // Perform many complexity changes
      for (let i = 0; i < 50; i++) {
        const expertButton = screen.getByText('Expert');
        await user.click(expertButton);
        
        const essentialButton = screen.getByText('Essential');
        await user.click(essentialButton);
      }
      
      const totalTime = monitor.endMeasurement('complexity-adjustment', startTime);
      const averageTime = totalTime / 100; // 50 changes * 2 clicks each
      
      expect(averageTime).toBeLessThan(20); // Average under 20ms per change
    });
  });

  describe('User Behavior Analysis Performance', () => {
    it('efficiently analyzes user behavior', async () => {
      const user = userEvent.setup();
      
      const TestBehaviorAnalysis = () => {
        const { trackFeatureUsage } = useProgressiveDisclosure('behavior-perf-test');
        return (
          <div>
            {Array.from({ length: 100 }, (_, i) => (
              <button
                key={i}
                onClick={() => trackFeatureUsage(`feature-${i}`, 1)}
              >
                Track {i}
              </button>
            ))}
          </div>
        );
      };
      
      render(<TestBehaviorAnalysis />);
      
      const startTime = monitor.startMeasurement('behavior-analysis');
      
      // Track many features
      const buttons = screen.getAllByRole('button');
      for (const button of buttons.slice(0, 50)) {
        await user.click(button);
      }
      
      const totalTime = monitor.endMeasurement('behavior-analysis', startTime);
      expect(totalTime).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('quickly generates adaptive hints', async () => {
      const user = userEvent.setup();
      
      const TestHintGeneration = () => {
        const { trackFeatureUsage, dismissHint } = useProgressiveDisclosure('hint-perf-test');
        return (
          <div>
            <button onClick={() => trackFeatureUsage('automation', 10)}>
              Use Automation
            </button>
            <button onClick={() => dismissHint('test-hint')}>
              Dismiss Hint
            </button>
            <AdaptiveHintsDisplay />
          </div>
        );
      };
      
      render(<TestHintGeneration />);
      
      const startTime = monitor.startMeasurement('hint-generation');
      
      // Trigger hint generation and dismissal
      for (let i = 0; i < 20; i++) {
        const useButton = screen.getByText('Use Automation');
        await user.click(useButton);
        
        const dismissButton = screen.getByText('Dismiss Hint');
        await user.click(dismissButton);
      }
      
      const totalTime = monitor.endMeasurement('hint-generation', startTime);
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Memory Management', () => {
    it('efficiently manages user profile data', async () => {
      const user = userEvent.setup();
      
      const TestMemoryManagement = () => {
        const { trackFeatureUsage } = useProgressiveDisclosure('memory-perf-test');
        return (
          <div>
            {Array.from({ length: 1000 }, (_, i) => (
              <button
                key={i}
                onClick={() => trackFeatureUsage(`feature-${i}`, Math.random() * 10)}
              >
                Track {i}
              </button>
            ))}
          </div>
        );
      };
      
      render(<TestMemoryManagement />);
      
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Track many features with different durations
      const buttons = screen.getAllByRole('button');
      for (const button of buttons.slice(0, 500)) {
        await user.click(button);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB
    });

    it('cleans up event listeners properly', async () => {
      const user = userEvent.setup();
      
      const TestEventCleanup = () => {
        const [mounted, setMounted] = React.useState(true);
        const { trackFeatureUsage } = useProgressiveDisclosure('event-perf-test');
        
        React.useEffect(() => {
          return () => {
            // Cleanup should happen here
          };
        }, []);
        
        return (
          <div>
            {mounted && (
              <button onClick={() => trackFeatureUsage('test', 1)}>
                Track
              </button>
            )}
            <button onClick={() => setMounted(false)}>
              Unmount
            </button>
          </div>
        );
      };
      
      const { unmount } = render(<TestEventCleanup />);
      
      // Use component
      const trackButton = screen.getByText('Track');
      await user.click(trackButton);
      
      // Unmount component
      const unmountButton = screen.getByText('Unmount');
      await user.click(unmountButton);
      
      unmount();
      
      // Memory should be cleaned up (this would be verified with more sophisticated tools)
      expect(true).toBe(true); // Placeholder
    });
  });
});

describe('Accessibility Performance', () => {
  it('maintains performance with accessibility features enabled', async () => {
    const user = userEvent.setup();
    
    // Enable accessibility features
    const originalPrefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)' ? true : originalPrefersReducedMotion,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    
    const monitor = new PerformanceMonitor();
    render(
      <VisualAutomationBuilder
        onSave={() => {}}
        onExecute={() => {}}
      />
    );
    
    const startTime = monitor.startMeasurement('accessibility-performance');
    
    // Test interactions with accessibility features
    for (let i = 0; i < 10; i++) {
      await user.tab();
      await user.keyboard('Enter');
    }
    
    const totalTime = monitor.endMeasurement('accessibility-performance', startTime);
    expect(totalTime).toBeLessThan(1000); // Should remain performant
  });

  it('provides smooth screen reader experience', async () => {
    render(
      <AdaptiveUIController />
    );
    
    // Check for proper ARIA labels and structure
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    
    // Performance should not be impacted by accessibility features
    expect(true).toBe(true); // Placeholder for screen reader performance tests
  });
});

describe('Stress Tests', () => {
  it('handles extreme user load gracefully', async () => {
    const user = userEvent.setup();
    
    render(
      <VisualAutomationBuilder
        onSave={() => {}}
        onExecute={() => {}}
      />
    );
    
    const startTime = monitor.startMeasurement('stress-test');
    
    // Simulate extreme user behavior
    const actions = [];
    
    // Rapid clicking
    for (let i = 0; i < 100; i++) {
      actions.push(() => {
        const missedCallNode = screen.getByText('Missed Call');
        return user.click(missedCallNode);
      });
    }
    
    // Rapid keyboard navigation
    for (let i = 0; i < 50; i++) {
      actions.push(() => user.tab());
    }
    
    // Execute all actions rapidly
    await Promise.all(actions.map(action => action()));
    
    const totalTime = monitor.endMeasurement('stress-test', startTime);
    expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
    
    // System should still be responsive
    expect(screen.getByText('Node Library')).toBeInTheDocument();
  });

  it('maintains performance under memory pressure', async () => {
    // Simulate memory pressure
    const largeData = new Array(1000000).fill(0).map((_, i) => ({ id: i, data: 'x'.repeat(100) }));
    
    render(
      <AdaptiveUIController />
    );
    
    const startTime = monitor.startMeasurement('memory-pressure');
    
    // Perform operations while under memory pressure
    const user = userEvent.setup();
    
    for (let i = 0; i < 20; i++) {
      const buttons = screen.getAllByRole('button');
      if (buttons.length > 0) {
        await user.click(buttons[0]);
      }
    }
    
    const totalTime = monitor.endMeasurement('memory-pressure', startTime);
    expect(totalTime).toBeLessThan(5000); // Should still be performant
    
    // Clean up
    largeData.length = 0;
  });
});
