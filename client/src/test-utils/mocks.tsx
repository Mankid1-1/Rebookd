/**
 * 🛠️ TEST UTILITIES AND MOCKS
 * Shared testing utilities, mocks, and helpers for the advanced features
 */

import { vi, type Mock } from 'vitest';
import React from 'react';
import type { ReactNode } from 'react';

// Mock user profiles for testing
export const mockUserProfiles = {
  beginner: {
    level: 'beginner' as const,
    experience: {
      totalSessions: 5,
      sessionDuration: 10,
      featureUsage: {
        dashboard: 10,
        messaging: 8,
        analytics: 2,
        settings: 1,
        automation: 0,
      },
      completedTutorials: [],
      errorRate: 0.4,
      helpSeekingFrequency: 0.8,
    },
    preferences: {
      uiComplexity: 'minimal' as const,
      learningMode: true,
      showHints: true,
      progressiveDisclosure: true,
      adaptationSpeed: 'slow' as const,
    },
    behavior: {
      explorationScore: 20,
      efficiencyScore: 40,
      confidenceLevel: 30,
      adaptationWillingness: 60,
    },
  },
  intermediate: {
    level: 'intermediate' as const,
    experience: {
      totalSessions: 45,
      sessionDuration: 25,
      featureUsage: {
        dashboard: 120,
        messaging: 89,
        analytics: 34,
        settings: 15,
        automation: 5,
      },
      completedTutorials: ['dashboard_overview', 'messaging_basics'],
      errorRate: 0.15,
      helpSeekingFrequency: 0.3,
    },
    preferences: {
      uiComplexity: 'balanced' as const,
      learningMode: true,
      showHints: true,
      progressiveDisclosure: true,
      adaptationSpeed: 'moderate' as const,
    },
    behavior: {
      explorationScore: 65,
      efficiencyScore: 75,
      confidenceLevel: 70,
      adaptationWillingness: 80,
    },
  },
  advanced: {
    level: 'advanced' as const,
    experience: {
      totalSessions: 200,
      sessionDuration: 45,
      featureUsage: {
        dashboard: 500,
        messaging: 450,
        analytics: 200,
        settings: 100,
        automation: 150,
      },
      completedTutorials: ['dashboard_overview', 'messaging_basics', 'advanced_automation'],
      errorRate: 0.05,
      helpSeekingFrequency: 0.1,
    },
    preferences: {
      uiComplexity: 'comprehensive' as const,
      learningMode: false,
      showHints: false,
      progressiveDisclosure: true,
      adaptationSpeed: 'fast' as const,
    },
    behavior: {
      explorationScore: 85,
      efficiencyScore: 90,
      confidenceLevel: 85,
      adaptationWillingness: 90,
    },
  },
  expert: {
    level: 'expert' as const,
    experience: {
      totalSessions: 500,
      sessionDuration: 60,
      featureUsage: {
        dashboard: 1000,
        messaging: 800,
        analytics: 400,
        settings: 200,
        automation: 300,
        developer_tools: 150,
      },
      completedTutorials: ['dashboard_overview', 'messaging_basics', 'advanced_automation', 'developer_tools'],
      errorRate: 0.02,
      helpSeekingFrequency: 0.05,
    },
    preferences: {
      uiComplexity: 'comprehensive' as const,
      learningMode: false,
      showHints: false,
      progressiveDisclosure: false,
      adaptationSpeed: 'fast' as const,
    },
    behavior: {
      explorationScore: 95,
      efficiencyScore: 95,
      confidenceLevel: 95,
      adaptationWillingness: 95,
    },
  },
};

// Mock workflow data
export const mockWorkflows = {
  simple: {
    id: 'simple-workflow',
    name: 'Simple Missed Call Response',
    description: 'Basic workflow to respond to missed calls',
    category: 'Customer Service',
    status: 'active' as const,
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger' as const,
        name: 'Missed Call',
        description: 'Trigger when a call is missed',
        icon: '📞',
        category: 'Triggers',
        config: {
          phoneNumber: '+1234567890',
          businessHoursOnly: true,
          excludeWeekends: true,
        },
        position: { x: 100, y: 100 },
        inputs: [],
        outputs: [
          { id: 'trigger-out', name: 'Trigger', type: 'output' as const, dataType: 'trigger' as const },
        ],
      },
      {
        id: 'action-1',
        type: 'action' as const,
        name: 'Send SMS',
        description: 'Send text message to lead',
        icon: '💬',
        category: 'Actions',
        config: {
          message: 'Sorry we missed your call. We\'ll call you back soon!',
          template: 'missed_call_response',
          delayMinutes: 2,
        },
        position: { x: 300, y: 100 },
        inputs: [
          { id: 'trigger-in', name: 'Trigger', type: 'input' as const, dataType: 'trigger' as const, required: true },
        ],
        outputs: [
          { id: 'action-out', name: 'Result', type: 'output' as const, dataType: 'data' as const },
        ],
      },
    ],
    connections: [
      {
        id: 'conn-1',
        sourceNodeId: 'trigger-1',
        sourcePortId: 'trigger-out',
        targetNodeId: 'action-1',
        targetPortId: 'trigger-in',
      },
    ],
    metadata: {
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
      version: 1,
      author: 'Test User',
    },
    settings: {
      timeout: 300,
      retryPolicy: 'linear' as const,
      maxRetries: 3,
      logging: true,
    },
  },
  complex: {
    id: 'complex-workflow',
    name: 'Advanced Lead Recovery System',
    description: 'Multi-step workflow with conditional logic and integrations',
    category: 'Sales',
    status: 'active' as const,
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger' as const,
        name: 'Missed Call',
        description: 'Trigger when a call is missed',
        icon: '📞',
        category: 'Triggers',
        config: {
          phoneNumber: '+1234567890',
          businessHoursOnly: false,
          excludeWeekends: false,
        },
        position: { x: 100, y: 100 },
        inputs: [],
        outputs: [
          { id: 'trigger-out', name: 'Trigger', type: 'output' as const, dataType: 'trigger' as const },
        ],
      },
      {
        id: 'condition-1',
        type: 'condition' as const,
        name: 'Check Business Hours',
        description: 'Check if current time is within business hours',
        icon: '🕐',
        category: 'Conditions',
        config: {
          condition: 'business_hours',
          timezone: 'America/New_York',
        },
        position: { x: 300, y: 100 },
        inputs: [
          { id: 'condition-in', name: 'Input', type: 'input' as const, dataType: 'data' as const, required: true },
        ],
        outputs: [
          { id: 'condition-true', name: 'True', type: 'output' as const, dataType: 'trigger' as const },
          { id: 'condition-false', name: 'False', type: 'output' as const, dataType: 'trigger' as const },
        ],
      },
      {
        id: 'action-1',
        type: 'action' as const,
        name: 'Send Immediate SMS',
        description: 'Send SMS immediately during business hours',
        icon: '💬',
        category: 'Actions',
        config: {
          message: 'We missed your call and will respond immediately!',
          template: 'immediate_response',
          delayMinutes: 0,
        },
        position: { x: 500, y: 50 },
        inputs: [
          { id: 'trigger-in', name: 'Trigger', type: 'input' as const, dataType: 'trigger' as const, required: true },
        ],
        outputs: [
          { id: 'action-out', name: 'Result', type: 'output' as const, dataType: 'data' as const },
        ],
      },
      {
        id: 'delay-1',
        type: 'delay' as const,
        name: 'Wait for Business Hours',
        description: 'Wait until next business hours',
        icon: '⏰',
        category: 'Flow Control',
        config: {
          duration: 1,
          unit: 'hours',
        },
        position: { x: 500, y: 150 },
        inputs: [
          { id: 'delay-in', name: 'Input', type: 'input' as const, dataType: 'trigger' as const, required: true },
        ],
        outputs: [
          { id: 'delay-out', name: 'Output', type: 'output' as const, dataType: 'trigger' as const },
        ],
      },
      {
        id: 'integration-1',
        type: 'integration' as const,
        name: 'CRM Integration',
        description: 'Update lead in CRM system',
        icon: '🔗',
        category: 'Integrations',
        config: {
          url: 'https://api.crm.com/leads',
          method: 'POST',
          headers: { 'Authorization': 'Bearer token' },
        },
        position: { x: 700, y: 100 },
        inputs: [
          { id: 'integration-in', name: 'Input', type: 'input' as const, dataType: 'data' as const, required: true },
        ],
        outputs: [
          { id: 'integration-out', name: 'Response', type: 'output' as const, dataType: 'data' as const },
        ],
      },
    ],
    connections: [
      {
        id: 'conn-1',
        sourceNodeId: 'trigger-1',
        sourcePortId: 'trigger-out',
        targetNodeId: 'condition-1',
        targetPortId: 'condition-in',
      },
      {
        id: 'conn-2',
        sourceNodeId: 'condition-1',
        sourcePortId: 'condition-true',
        targetNodeId: 'action-1',
        targetPortId: 'trigger-in',
      },
      {
        id: 'conn-3',
        sourceNodeId: 'condition-1',
        sourcePortId: 'condition-false',
        targetNodeId: 'delay-1',
        targetPortId: 'delay-in',
      },
      {
        id: 'conn-4',
        sourceNodeId: 'action-1',
        sourcePortId: 'action-out',
        targetNodeId: 'integration-1',
        targetPortId: 'integration-in',
      },
      {
        id: 'conn-5',
        sourceNodeId: 'delay-1',
        sourcePortId: 'delay-out',
        targetNodeId: 'integration-1',
        targetPortId: 'integration-in',
      },
    ],
    metadata: {
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
      version: 1,
      author: 'Test User',
    },
    settings: {
      timeout: 600,
      retryPolicy: 'exponential' as const,
      maxRetries: 5,
      logging: true,
    },
  },
};

// Mock component factories
export const createMockComponent = (displayName: string, defaultProps: Record<string, any> = {}) => {
  const MockComponent = ({ children, ...props }: { children?: ReactNode; [key: string]: any }) => {
    return (
      <div data-testid={`mock-${displayName.toLowerCase()}`} {...defaultProps} {...props}>
        {children}
      </div>
    );
  };
  MockComponent.displayName = displayName;
  return MockComponent;
};

// UI Component Mocks
export const mockUIComponents = {
  Card: createMockComponent('Card'),
  CardContent: createMockComponent('CardContent'),
  CardHeader: createMockComponent('CardHeader'),
  CardTitle: createMockComponent('CardTitle'),
  Button: createMockComponent('Button', { onClick: vi.fn() }),
  Input: createMockComponent('Input', { onChange: vi.fn(), value: '' }),
  Textarea: createMockComponent('Textarea', { onChange: vi.fn(), value: '' }),
  Select: createMockComponent('Select'),
  SelectContent: createMockComponent('SelectContent'),
  SelectItem: createMockComponent('SelectItem'),
  SelectTrigger: createMockComponent('SelectTrigger'),
  SelectValue: createMockComponent('SelectValue'),
  Switch: createMockComponent('Switch', { onCheckedChange: vi.fn(), checked: false }),
  Slider: createMockComponent('Slider', { onValueChange: vi.fn(), value: [50] }),
  Progress: createMockComponent('Progress', { value: 50 }),
  Badge: createMockComponent('Badge'),
  Tabs: createMockComponent('Tabs'),
  TabsContent: createMockComponent('TabsContent'),
  TabsList: createMockComponent('TabsList'),
  TabsTrigger: createMockComponent('TabsTrigger'),
  Label: createMockComponent('Label'),
};

// Mock external libraries
export const mockExternalLibraries = {
  sonner: {
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    },
  },
  lucideReact: {
    // Add commonly used icons
    Play: () => <span data-testid="icon-play">▶</span>,
    Pause: () => <span data-testid="icon-pause">⏸</span>,
    Save: () => <span data-testid="icon-save">💾</span>,
    Trash2: () => <span data-testid="icon-trash">🗑</span>,
    Settings: () => <span data-testid="icon-settings">⚙</span>,
    Brain: () => <span data-testid="icon-brain">🧠</span>,
    Target: () => <span data-testid="icon-target">🎯</span>,
    Eye: () => <span data-testid="icon-eye">👁</span>,
    EyeOff: () => <span data-testid="icon-eye-off">👁‍🗨</span>,
    ChevronDown: () => <span data-testid="icon-chevron-down">▼</span>,
    ChevronUp: () => <span data-testid="icon-chevron-up">▲</span>,
    ChevronRight: () => <span data-testid="icon-chevron-right">▶</span>,
    Phone: () => <span data-testid="icon-phone">📞</span>,
    MessageSquare: () => <span data-testid="icon-message">💬</span>,
    Calendar: () => <span data-testid="icon-calendar">📅</span>,
    Users: () => <span data-testid="icon-users">👥</span>,
    Clock: () => <span data-testid="icon-clock">🕐</span>,
    Zap: () => <span data-testid="icon-zap">⚡</span>,
    BarChart3: () => <span data-testid="icon-bar-chart">📊</span>,
    TrendingUp: () => <span data-testid="icon-trending-up">📈</span>,
    AlertCircle: () => <span data-testid="icon-alert">⚠</span>,
    CheckCircle: () => <span data-testid="icon-check">✅</span>,
    X: () => <span data-testid="icon-x">❌</span>,
    Plus: () => <span data-testid="icon-plus">➕</span>,
    Minus: () => <span data-testid="icon-minus">➖</span>,
    RotateCcw: () => <span data-testid="icon-rotate">🔄</span>,
    Move: () => <span data-testid="icon-move">↔</span>,
    Maximize2: () => <span data-testid="icon-maximize">⛶</span>,
    Minimize2: () => <span data-testid="icon-minimize">⛷</span>,
    MousePointer: () => <span data-testid="icon-mouse">👆</span>,
    Hand: () => <span data-testid="icon-hand">✋</span>,
    GitBranch: () => <span data-testid="icon-branch">🌿</span>,
    Diamond: () => <span data-testid="icon-diamond">💎</span>,
    Circle: () => <span data-testid="icon-circle">⭕</span>,
    Square: () => <span data-testid="icon-square">⬜</span>,
    Triangle: () => <span data-testid="icon-triangle">🔺</span>,
    Layers: () => <span data-testid="icon-layers">📚</span>,
    Grid: () => <span data-testid="icon-grid">⊞</span>,
    List: () => <span data-testid="icon-list">☰</span>,
    Sliders: () => <span data-testid="icon-sliders">🎚</span>,
    Info: () => <span data-testid="icon-info">ℹ</span>,
    User: () => <span data-testid="icon-user">👤</span>,
    Shield: () => <span data-testid="icon-shield">🛡</span>,
    Lightbulb: () => <span data-testid="icon-lightbulb">💡</span>,
    GraduationCap: () => <span data-testid="icon-graduation">🎓</span>,
    Award: () => <span data-testid="icon-award">🏆</span>,
    Star: () => <span data-testid="icon-star">⭐</span>,
    ArrowRight: () => <span data-testid="icon-arrow-right">→</span>,
    Sparkles: () => <span data-testid="icon-sparkles">✨</span>,
    Workflow: () => <span data-testid="icon-workflow">🔄</span>,
  },
  recharts: {
    ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="responsive-container">{children}</div>,
    AreaChart: ({ children }: { children: ReactNode }) => <div data-testid="area-chart">{children}</div>,
    BarChart: ({ children }: { children: ReactNode }) => <div data-testid="bar-chart">{children}</div>,
    LineChart: ({ children }: { children: ReactNode }) => <div data-testid="line-chart">{children}</div>,
    PieChart: ({ children }: { children: ReactNode }) => <div data-testid="pie-chart">{children}</div>,
    RadarChart: ({ children }: { children: ReactNode }) => <div data-testid="radar-chart">{children}</div>,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Legend: () => <div data-testid="legend" />,
    Area: () => <div data-testid="area" />,
    Bar: () => <div data-testid="bar" />,
    Line: () => <div data-testid="line" />,
    Pie: () => <div data-testid="pie" />,
    Radar: () => <div data-testid="radar" />,
    Cell: () => <div data-testid="cell" />,
  },
  dateFns: {
    format: (date: Date | string, format: string) => `formatted-${format}`,
    subDays: (date: Date, days: number) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000),
    addDays: (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000),
    startOfDay: (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    endOfDay: (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59),
  },
};

// Mock canvas and DOM utilities
export const mockCanvasUtils = {
  getBoundingClientRect: () => ({
    left: 0,
    top: 0,
    width: 800,
    height: 600,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: vi.fn(),
  }),
  createEvent: (type: string, properties: Record<string, any> = {}) => ({
    type,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    clientX: properties.clientX || 0,
    clientY: properties.clientY || 0,
    target: properties.target || null,
    ...properties,
  }),
  mockDragEvent: (startX: number, startY: number, endX: number, endY: number) => [
    mockCanvasUtils.createEvent('mousedown', { clientX: startX, clientY: startY }),
    mockCanvasUtils.createEvent('mousemove', { clientX: endX, clientY: endY }),
    mockCanvasUtils.createEvent('mouseup', { clientX: endX, clientY: endY }),
  ],
};

// Test helper functions
export const testHelpers = {
  // Wait for component to be rendered
  waitForComponent: async (testId: string, timeout = 5000) => {
    const element = document.querySelector(`[data-testid="${testId}"]`);
    if (element) return element;
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkElement = () => {
        const el = document.querySelector(`[data-testid="${testId}"]`);
        if (el) {
          resolve(el);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Component ${testId} not found within ${timeout}ms`));
        } else {
          setTimeout(checkElement, 50);
        }
      };
      checkElement();
    });
  },

  // Simulate user interaction
  simulateClick: (element: HTMLElement | null) => {
    if (!element) throw new Error('Element not found');
    element.click();
  },

  // Simulate keyboard input
  simulateInput: (element: HTMLElement | null, value: string) => {
    if (!element) throw new Error('Element not found');
    if (element instanceof HTMLInputElement) {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  },

  // Create mock function with call tracking
  createTrackedMock: () => {
    const mock = vi.fn();
    mock.callCount = 0;
    mock.lastCall = null;
    mock.calls = [];
    
    const trackedMock = (...args: any[]) => {
      mock.callCount++;
      mock.lastCall = args;
      mock.calls.push(args);
      return mock(...args);
    };
    
    trackedMock.reset = () => {
      mock.mockReset();
      mock.callCount = 0;
      mock.lastCall = null;
      mock.calls = [];
    };
    
    return trackedMock;
  },

  // Generate test data
  generateTestData: {
    user: (level: keyof typeof mockUserProfiles) => mockUserProfiles[level],
    workflow: (type: keyof typeof mockWorkflows) => mockWorkflows[type],
    nodes: (count: number) => Array.from({ length: count }, (_, i) => ({
      id: `node-${i}`,
      type: 'action' as const,
      name: `Test Node ${i}`,
      description: `Test node description ${i}`,
      icon: '🧪',
      category: 'Test',
      config: { test: true },
      position: { x: i * 100, y: i * 50 },
      inputs: [],
      outputs: [{ id: `output-${i}`, name: 'Output', type: 'output' as const, dataType: 'data' as const }],
    })),
    connections: (count: number) => Array.from({ length: count }, (_, i) => ({
      id: `conn-${i}`,
      sourceNodeId: `node-${i}`,
      sourcePortId: `output-${i}`,
      targetNodeId: `node-${i + 1}`,
      targetPortId: `input-${i + 1}`,
    })),
  },

  // Performance measurement
  measurePerformance: async (fn: () => Promise<void> | void, iterations = 1) => {
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }
    
    return {
      average: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      median: times.sort((a, b) => a - b)[Math.floor(times.length / 2)],
      times,
    };
  },

  // Memory usage measurement
  measureMemory: () => {
    const memory = (performance as any).memory;
    if (!memory) return null;
    
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
    };
  },

  // Accessibility testing helpers
  accessibility: {
    checkAriaLabels: (container: HTMLElement) => {
      const interactiveElements = container.querySelectorAll('button, input, select, textarea, a');
      const issues: string[] = [];
      
      interactiveElements.forEach((element, index) => {
        const hasLabel = element.hasAttribute('aria-label') || 
                         element.hasAttribute('aria-labelledby') ||
                         element.hasAttribute('title') ||
                         element.getAttribute('placeholder') ||
                         element.textContent?.trim();
        
        if (!hasLabel) {
          issues.push(`Element ${index} (${element.tagName}) missing accessible label`);
        }
      });
      
      return issues;
    },

    checkKeyboardNavigation: (container: HTMLElement) => {
      const focusableElements = container.querySelectorAll(
        'button, input, select, textarea, a, [tabindex]:not([tabindex="-1"])'
      );
      
      return {
        count: focusableElements.length,
        elements: Array.from(focusableElements).map(el => ({
          tagName: el.tagName,
          tabIndex: el.getAttribute('tabindex'),
        })),
      };
    },

    checkColorContrast: (element: HTMLElement) => {
      // This would typically use a library like axe-core
      // For now, return placeholder
      return {
        ratio: 4.5, // WCAG AA compliant
        passes: true,
      };
    },
  },
};

// Global test setup
export const setupGlobalMocks = () => {
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock canvas context
  const mockCanvasContext = {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Array(4) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({ data: new Array(4) })),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCanvasContext);
};

// Export all mocks and utilities
export const mocks = {
  userProfiles: mockUserProfiles,
  workflows: mockWorkflows,
  components: mockUIComponents,
  libraries: mockExternalLibraries,
  canvas: mockCanvasUtils,
  helpers: testHelpers,
};

export default mocks;
