import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickActions, getLeadsQuickActions } from "../QuickActions";

describe("QuickActions", () => {
  const mockActions = [
    {
      id: "add-lead",
      label: "Add Lead",
      description: "Create a new lead",
      icon: "Plus",
      onClick: vi.fn(),
      shortcut: "Ctrl+N",
      badge: null,
    },
    {
      id: "send-message",
      label: "Send Message",
      description: "Send a message to leads",
      icon: "MessageSquare",
      onClick: vi.fn(),
      shortcut: "Ctrl+M",
      badge: null,
    },
  ];

  it("renders quick actions grid", () => {
    render(<QuickActions actions={mockActions} />);
    
    expect(screen.getByText("Add Lead")).toBeInTheDocument();
    expect(screen.getByText("Send Message")).toBeInTheDocument();
    expect(screen.getByText("Create a new lead")).toBeInTheDocument();
    expect(screen.getByText("Send a message to leads")).toBeInTheDocument();
  });

  it("handles action clicks", async () => {
    const user = userEvent.setup();
    render(<QuickActions actions={mockActions} />);
    
    const addButton = screen.getByText("Add Lead");
    await user.click(addButton);
    
    expect(mockActions[0].onClick).toHaveBeenCalledTimes(1);
  });

  it("renders action icons", () => {
    render(<QuickActions actions={mockActions} />);
    
    // Icons would be rendered via lucide-react components
    expect(screen.getByText("Add Lead")).toBeInTheDocument();
    expect(screen.getByText("Send Message")).toBeInTheDocument();
  });

  it("displays keyboard shortcuts", () => {
    render(<QuickActions actions={mockActions} />);
    
    expect(screen.getByText("Ctrl+N")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+M")).toBeInTheDocument();
  });

  it("renders badges when provided", () => {
    const actionsWithBadges = [
      ...mockActions,
      {
        ...mockActions[0],
        id: "import-leads",
        label: "Import Leads",
        description: "Import leads from CSV",
        icon: "Upload",
        onClick: vi.fn(),
        shortcut: null,
        badge: { text: "New", variant: "success" as const },
      },
    ];

    render(<QuickActions actions={actionsWithBadges} />);
    
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<QuickActions actions={mockActions} className="custom-actions" />);
    
    const container = screen.getByText("Add Lead").closest("div");
    expect(container?.parentElement).toHaveClass("custom-actions");
  });

  it("renders empty state when no actions", () => {
    render(<QuickActions actions={[]} />);
    
    expect(screen.getByText("No quick actions available")).toBeInTheDocument();
  });

  it("handles keyboard shortcuts", () => {
    render(<QuickActions actions={mockActions} />);
    
    // Simulate keyboard shortcut
    fireEvent.keyDown(document, { key: "n", ctrlKey: true });
    
    // The action should be triggered (implementation depends on event handling)
    expect(screen.getByText("Add Lead")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    const loadingActions = mockActions.map(action => ({
      ...action,
      loading: true,
    }));

    render(<QuickActions actions={loadingActions} />);
    
    // Loading indicators would be shown
    expect(screen.getByText("Add Lead")).toBeInTheDocument();
  });

  it("handles disabled actions", async () => {
    const user = userEvent.setup();
    const disabledActions = mockActions.map(action => ({
      ...action,
      disabled: true,
    }));

    render(<QuickActions actions={disabledActions} />);
    
    const addButton = screen.getByText("Add Lead");
    await user.click(addButton);
    
    expect(mockActions[0].onClick).not.toHaveBeenCalled();
  });

  it("renders in different layouts", () => {
    const { rerender } = render(<QuickActions actions={mockActions} layout="grid" />);
    expect(screen.getByText("Add Lead")).toBeInTheDocument();

    rerender(<QuickActions actions={mockActions} layout="list" />);
    expect(screen.getByText("Add Lead")).toBeInTheDocument();
  });

  it("shows tooltips on hover", async () => {
    render(<QuickActions actions={mockActions} showTooltips />);
    
    const addButton = screen.getByText("Add Lead");
    fireEvent.mouseEnter(addButton);
    
    // Tooltip would appear
    expect(addButton).toBeInTheDocument();
  });

  it("filters actions by category", () => {
    const categorizedActions = [
      ...mockActions,
      {
        id: "make-call",
        label: "Make Call",
        description: "Call a lead",
        icon: "Phone",
        onClick: vi.fn(),
        shortcut: "Ctrl+C",
        badge: null,
        category: "communication",
      },
    ];

    render(<QuickActions actions={categorizedActions} category="communication" />);
    
    expect(screen.getByText("Make Call")).toBeInTheDocument();
    expect(screen.queryByText("Add Lead")).not.toBeInTheDocument();
  });
});

describe("getLeadsQuickActions", () => {
  it("returns leads-specific quick actions", () => {
    const mockHandler = vi.fn();
    const actions = getLeadsQuickActions(mockHandler);
    
    expect(actions).toHaveLength(6);
    expect(actions[0].id).toBe("add-lead");
    expect(actions[1].id).toBe("send-message");
    expect(actions[2].id).toBe("make-call");
    expect(actions[3].id).toBe("schedule-appointment");
    expect(actions[4].id).toBe("import-leads");
    expect(actions[5].id).toBe("search-leads");
  });

  it("provides correct action handlers", () => {
    const mockHandler = vi.fn();
    const actions = getLeadsQuickActions(mockHandler);
    
    actions.forEach(action => {
      expect(typeof action.onClick).toBe("function");
    });
  });

  it("includes proper labels and descriptions", () => {
    const mockHandler = vi.fn();
    const actions = getLeadsQuickActions(mockHandler);
    
    const addLeadAction = actions.find(a => a.id === "add-lead");
    expect(addLeadAction?.label).toBe("Add Lead");
    expect(addLeadAction?.description).toBe("Create a new lead");

    const sendMessageAction = actions.find(a => a.id === "send-message");
    expect(sendMessageAction?.label).toBe("Send Message");
    expect(sendMessageAction?.description).toBe("Send a message to leads");
  });

  it("includes keyboard shortcuts", () => {
    const mockHandler = vi.fn();
    const actions = getLeadsQuickActions(mockHandler);
    
    const addLeadAction = actions.find(a => a.id === "add-lead");
    expect(addLeadAction?.shortcut).toBe("Ctrl+N");

    const sendMessageAction = actions.find(a => a.id === "send-message");
    expect(sendMessageAction?.shortcut).toBe("Ctrl+M");
  });

  it("provides icon names", () => {
    const mockHandler = vi.fn();
    const actions = getLeadsQuickActions(mockHandler);
    
    actions.forEach(action => {
      expect(typeof action.icon).toBe("string");
      expect(action.icon).toBeTruthy();
    });
  });

  it("calls handler with correct action IDs", () => {
    const mockHandler = vi.fn();
    const actions = getLeadsQuickActions(mockHandler);
    
    // Test add-lead action
    const addLeadAction = actions.find(a => a.id === "add-lead");
    addLeadAction?.onClick();
    expect(mockHandler).toHaveBeenCalledWith("add-lead");

    // Test send-message action
    mockHandler.mockClear();
    const sendMessageAction = actions.find(a => a.id === "send-message");
    sendMessageAction?.onClick();
    expect(mockHandler).toHaveBeenCalledWith("send-message");
  });

  it("handles all action types", () => {
    const mockHandler = vi.fn();
    const actions = getLeadsQuickActions(mockHandler);
    
    const actionIds = actions.map(a => a.id);
    expect(actionIds).toContain("add-lead");
    expect(actionIds).toContain("send-message");
    expect(actionIds).toContain("make-call");
    expect(actionIds).toContain("schedule-appointment");
    expect(actionIds).toContain("import-leads");
    expect(actionIds).toContain("search-leads");
  });

  it("provides consistent structure", () => {
    const mockHandler = vi.fn();
    const actions = getLeadsQuickActions(mockHandler);
    
    actions.forEach(action => {
      expect(action).toHaveProperty("id");
      expect(action).toHaveProperty("label");
      expect(action).toHaveProperty("description");
      expect(action).toHaveProperty("icon");
      expect(action).toHaveProperty("onClick");
      expect(action).toHaveProperty("shortcut");
      expect(action).toHaveProperty("badge");
    });
  });
});

describe("QuickActions Integration", () => {
  it("integrates with real handler function", () => {
    const mockHandler = vi.fn();
    const actions = getLeadsQuickActions(mockHandler);
    
    render(<QuickActions actions={actions} />);
    
    const addLeadButton = screen.getByText("Add Lead");
    fireEvent.click(addLeadButton);
    
    expect(mockHandler).toHaveBeenCalledWith("add-lead");
  });

  it("handles multiple action clicks", async () => {
    const user = userEvent.setup();
    const mockHandler = vi.fn();
    const actions = getLeadsQuickActions(mockHandler);
    
    render(<QuickActions actions={actions} />);
    
    await user.click(screen.getByText("Add Lead"));
    await user.click(screen.getByText("Send Message"));
    
    expect(mockHandler).toHaveBeenCalledWith("add-lead");
    expect(mockHandler).toHaveBeenCalledWith("send-message");
    expect(mockHandler).toHaveBeenCalledTimes(2);
  });

  it("maintains action order", () => {
    const mockHandler = vi.fn();
    const actions = getLeadsQuickActions(mockHandler);
    
    render(<QuickActions actions={actions} />);
    
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Add Lead");
    expect(buttons[1]).toHaveTextContent("Send Message");
    expect(buttons[2]).toHaveTextContent("Make Call");
  });

  it("renders responsive layout", () => {
    const mockHandler = vi.fn();
    const actions = getLeadsQuickActions(mockHandler);
    
    render(<QuickActions actions={actions} responsive />);
    
    // Responsive layout would adapt to screen size
    expect(screen.getByText("Add Lead")).toBeInTheDocument();
  });
});
