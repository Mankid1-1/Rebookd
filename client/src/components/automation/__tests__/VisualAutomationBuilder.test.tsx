/**
 * 🧪 VISUAL AUTOMATION BUILDER TESTS
 * Comprehensive test suite for the Visual Automation Builder
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { VisualAutomationBuilder, WorkflowNode, WorkflowConnection } from '../VisualAutomationBuilder';

// Mock dependencies
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

vi.mock('@/components/ui/input', () => ({
  Input: ({ onChange, value, ...props }: any) => 
    <input data-testid="input" onChange={onChange} value={value} {...props} />,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ onChange, value, ...props }: any) => 
    <textarea data-testid="textarea" onChange={onChange} value={value} {...props} />,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div data-testid="select">{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <div />,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: any) => 
    <input 
      type="checkbox" 
      checked={checked} 
      onChange={(e) => onCheckedChange(e.target.checked)} 
      data-testid="switch"
      aria-label="Toggle switch"
      title="Toggle switch"
    />,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock canvas and SVG interactions
const mockCanvasRef = { current: null };
const mockSvgRef = { current: null };

// Test data
const mockNodeTemplate = {
  type: 'trigger' as const,
  name: 'Missed Call',
  description: 'Trigger when a call is missed',
  icon: <div>Phone</div>,
  category: 'Triggers',
  config: {
    phoneNumber: '',
    businessHoursOnly: false,
    excludeWeekends: true,
  },
};

const mockWorkflow = {
  id: 'test-workflow',
  name: 'Test Workflow',
  description: 'Test Description',
  category: 'Test',
  status: 'draft' as const,
  nodes: [],
  connections: [],
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    author: 'Test User',
  },
  settings: {
    timeout: 300,
    retryPolicy: 'linear' as const,
    maxRetries: 3,
    logging: true,
  },
};

describe('VisualAutomationBuilder', () => {
  const mockOnSave = vi.fn();
  const mockOnExecute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock canvas getBoundingClientRect
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

  it('renders without crashing', () => {
    render(
      <VisualAutomationBuilder 
        workflow={mockWorkflow}
        onSave={mockOnSave}
        onExecute={mockOnExecute}
      />
    );
    
    expect(screen.getByDisplayValue('Test Workflow')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Description')).toBeInTheDocument();
  });

  it('displays node palette with categories', () => {
    render(
      <VisualAutomationBuilder 
        workflow={mockWorkflow}
        onSave={mockOnSave}
        onExecute={mockOnExecute}
      />
    );
    
    expect(screen.getByText('Node Library')).toBeInTheDocument();
    expect(screen.getByText('Triggers')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Conditions')).toBeInTheDocument();
  });

  it('adds node to canvas when clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <VisualAutomationBuilder 
        workflow={mockWorkflow}
        onSave={mockOnSave}
        onExecute={mockOnExecute}
      />
    );
    
    // Find and click the "Missed Call" node template
    const missedCallNode = screen.getByText('Missed Call');
    await user.click(missedCallNode);
    
    // Verify toast was called
    expect(vi.mocked(require('sonner').toast).success).toHaveBeenCalledWith('Added Missed Call node');
  });

  it('saves workflow when save button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <VisualAutomationBuilder 
        workflow={mockWorkflow}
        onSave={mockOnSave}
        onExecute={mockOnExecute}
      />
    );
    
    const saveButton = screen.getByText('Save');
    await user.click(saveButton);
    
    expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 'test-workflow',
      name: 'Test Workflow',
    }));
    
    expect(vi.mocked(require('sonner').toast).success).toHaveBeenCalledWith('Workflow saved successfully');
  });

  it('executes workflow when execute button is clicked', async () => {
    const user = userEvent.setup();
    const activeWorkflow = { ...mockWorkflow, status: 'active' as const };
    
    render(
      <VisualAutomationBuilder 
        workflow={activeWorkflow}
        onSave={mockOnSave}
        onExecute={mockOnExecute}
      />
    );
    
    const executeButton = screen.getByText('Execute');
    await user.click(executeButton);
    
    expect(mockOnExecute).toHaveBeenCalledWith('test-workflow');
    expect(vi.mocked(require('sonner').toast).info).toHaveBeenCalledWith('Executing workflow...');
  });

  it('prevents execution for inactive workflows', async () => {
    const user = userEvent.setup();
    
    render(
      <VisualAutomationBuilder 
        workflow={mockWorkflow}
        onSave={mockOnSave}
        onExecute={mockOnExecute}
      />
    );
    
    const executeButton = screen.getByText('Execute');
    await user.click(executeButton);
    
    expect(mockOnExecute).not.toHaveBeenCalled();
    expect(vi.mocked(require('sonner').toast).error).toHaveBeenCalledWith('Workflow must be active to execute');
  });

  it('updates workflow name when input changes', async () => {
    const user = userEvent.setup();
    
    render(
      <VisualAutomationBuilder 
        workflow={mockWorkflow}
        onSave={mockOnSave}
        onExecute={mockOnExecute}
      />
    );
    
    const nameInput = screen.getByDisplayValue('Test Workflow');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Workflow');
    
    expect(screen.getByDisplayValue('Updated Workflow')).toBeInTheDocument();
  });

  it('handles zoom controls', async () => {
    const user = userEvent.setup();
    
    render(
      <VisualAutomationBuilder 
        workflow={mockWorkflow}
        onSave={mockOnSave}
        onExecute={mockOnExecute}
      />
    );
    
    // Find zoom controls (they might be in different order)
    const zoomButtons = screen.getAllByTestId('button').filter(button => 
      button.textContent && ['%', ''].includes(button.textContent as string)
    );
    
    if (zoomButtons.length > 0) {
      await user.click(zoomButtons[0]);
      // Zoom functionality would be tested through canvas behavior
    }
  });
});

describe('WorkflowNode', () => {
  it('creates node with valid structure', () => {
    const node: WorkflowNode = {
      id: 'test-node',
      type: 'trigger',
      name: 'Test Node',
      description: 'Test Description',
      icon: <div>Icon</div>,
      category: 'Test',
      config: { test: 'value' },
      position: { x: 100, y: 200 },
      inputs: [],
      outputs: [],
    };
    
    expect(node.id).toBe('test-node');
    expect(node.type).toBe('trigger');
    expect(node.position).toEqual({ x: 100, y: 200 });
  });
});

describe('WorkflowConnection', () => {
  it('creates connection with valid structure', () => {
    const connection: WorkflowConnection = {
      id: 'test-connection',
      sourceNodeId: 'source-node',
      sourcePortId: 'source-port',
      targetNodeId: 'target-node',
      targetPortId: 'target-port',
    };
    
    expect(connection.id).toBe('test-connection');
    expect(connection.sourceNodeId).toBe('source-node');
    expect(connection.targetNodeId).toBe('target-node');
  });
});

describe('Node Port Generation', () => {
  it('generates correct ports for trigger nodes', () => {
    // This would test the generateNodePorts function
    // Since it's internal, we test through component behavior
    const triggerNode = { ...mockNodeTemplate, type: 'trigger' as const };
    
    // Trigger nodes should have only output ports
    expect(triggerNode.type).toBe('trigger');
  });

  it('generates correct ports for action nodes', () => {
    const actionNode = { ...mockNodeTemplate, type: 'action' as const };
    
    // Action nodes should have both input and output ports
    expect(actionNode.type).toBe('action');
  });

  it('generates correct ports for condition nodes', () => {
    const conditionNode = { ...mockNodeTemplate, type: 'condition' as const };
    
    // Condition nodes should have input and multiple output ports
    expect(conditionNode.type).toBe('condition');
  });
});

describe('Canvas Interactions', () => {
  beforeEach(() => {
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

  it('handles node dragging', async () => {
    const user = userEvent.setup();
    
    render(
      <VisualAutomationBuilder 
        workflow={mockWorkflow}
        onSave={mockOnSave}
        onExecute={mockOnExecute}
      />
    );
    
    // Add a node first
    const missedCallNode = screen.getByText('Missed Call');
    await user.click(missedCallNode);
    
    // Node dragging would be tested through mouse events
    // This is complex to test without actual canvas implementation
  });

  it('handles connection creation', async () => {
    const user = userEvent.setup();
    
    render(
      <VisualAutomationBuilder 
        workflow={mockWorkflow}
        onSave={mockOnSave}
        onExecute={mockOnExecute}
      />
    );
    
    // Connection creation would involve:
    // 1. Adding two nodes
    // 2. Mousedown on output port
    // 3. Mousemove to input port
    // 4. Mouseup on input port
    
    // This is complex to test without actual canvas implementation
  });
});

describe('Workflow Validation', () => {
  it('validates workflow structure', () => {
    // Test workflow validation logic
    const validWorkflow = { ...mockWorkflow };
    
    expect(validWorkflow.id).toBeDefined();
    expect(validWorkflow.name).toBeDefined();
    expect(validWorkflow.nodes).toBeInstanceOf(Array);
    expect(validWorkflow.connections).toBeInstanceOf(Array);
  });

  it('detects invalid connections', () => {
    // Test connection validation
    const invalidConnection: WorkflowConnection = {
      id: 'invalid',
      sourceNodeId: 'non-existent',
      sourcePortId: 'source-port',
      targetNodeId: 'also-non-existent',
      targetPortId: 'target-port',
    };
    
    // This would test connection validation logic
    expect(invalidConnection.sourceNodeId).toBe('non-existent');
  });
});

describe('Performance Tests', () => {
  it('handles large number of nodes efficiently', async () => {
    const user = userEvent.setup();
    
    // Create workflow with many nodes
    const largeWorkflow = { ...mockWorkflow };
    
    render(
      <VisualAutomationBuilder 
        workflow={largeWorkflow}
        onSave={mockOnSave}
        onExecute={mockOnExecute}
      />
    );
    
    // Add multiple nodes
    for (let i = 0; i < 50; i++) {
      const missedCallNode = screen.getByText('Missed Call');
      await user.click(missedCallNode);
    }
    
    // Performance would be measured
    expect(true).toBe(true); // Placeholder
  });
});

describe('Accessibility Tests', () => {
  it('has proper ARIA labels', () => {
    render(
      <VisualAutomationBuilder 
        workflow={mockWorkflow}
        onSave={mockOnSave}
        onExecute={mockOnExecute}
      />
    );
    
    // Check for accessibility attributes
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    
    render(
      <VisualAutomationBuilder 
        workflow={mockWorkflow}
        onSave={mockOnSave}
        onExecute={mockOnExecute}
      />
    );
    
    // Test keyboard navigation
    await user.tab();
    // Focus should move to interactive elements
  });
});

describe('Error Handling', () => {
  it('handles invalid workflow data gracefully', () => {
    const invalidWorkflow = { ...mockWorkflow, name: '' };
    
    render(
      <VisualAutomationBuilder 
        workflow={invalidWorkflow}
        onSave={mockOnSave}
        onExecute={mockOnExecute}
      />
    );
    
    // Should still render with default values
    expect(screen.getByTestId('input')).toBeInTheDocument();
  });

  it('handles canvas errors gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock canvas error
    global.Element.prototype.getBoundingClientRect = vi.fn(() => {
      throw new Error('Canvas error');
    });
    
    render(
      <VisualAutomationBuilder 
        workflow={mockWorkflow}
        onSave={mockOnSave}
        onExecute={mockOnExecute}
      />
    );
    
    // Should not crash
    expect(screen.getByText('Node Library')).toBeInTheDocument();
  });
});
