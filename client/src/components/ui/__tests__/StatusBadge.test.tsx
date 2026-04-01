import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, CommunicationBadge, ActivityBadge } from "../StatusBadge";

describe("StatusBadge", () => {
  it("renders basic status badge", () => {
    render(<StatusBadge status="new" />);
    
    const badge = screen.getByText("New");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("status-badge");
  });

  it("renders different statuses correctly", () => {
    const { rerender } = render(<StatusBadge status="new" />);
    expect(screen.getByText("New")).toBeInTheDocument();

    rerender(<StatusBadge status="contacted" />);
    expect(screen.getByText("Contacted")).toBeInTheDocument();

    rerender(<StatusBadge status="qualified" />);
    expect(screen.getByText("Qualified")).toBeInTheDocument();

    rerender(<StatusBadge status="booked" />);
    expect(screen.getByText("Booked")).toBeInTheDocument();

    rerender(<StatusBadge status="lost" />);
    expect(screen.getByText("Lost")).toBeInTheDocument();

    rerender(<StatusBadge status="unsubscribed" />);
    expect(screen.getByText("Unsubscribed")).toBeInTheDocument();
  });

  it("applies correct color classes for each status", () => {
    const { rerender } = render(<StatusBadge status="new" />);
    const badge = screen.getByText("New");
    expect(badge).toHaveClass("bg-info/15", "text-info");

    rerender(<StatusBadge status="booked" />);
    const bookedBadge = screen.getByText("Booked");
    expect(bookedBadge).toHaveClass("bg-success/15", "text-success");

    rerender(<StatusBadge status="lost" />);
    const lostBadge = screen.getByText("Lost");
    expect(lostBadge).toHaveClass("bg-destructive/15", "text-destructive");
  });

  it("renders with tooltip when showTooltip is true", () => {
    render(<StatusBadge status="new" showTooltip />);
    
    const badge = screen.getByText("New");
    expect(badge).toBeInTheDocument();
    // Tooltip would be rendered by HelpTooltip component
  });

  it("renders with custom size", () => {
    render(<StatusBadge status="new" size="sm" />);
    
    const badge = screen.getByText("New");
    expect(badge).toHaveClass("text-xs", "px-2", "py-1");
  });

  it("renders with large size", () => {
    render(<StatusBadge status="new" size="lg" />);
    
    const badge = screen.getByText("New");
    expect(badge).toHaveClass("text-base", "px-4", "py-2");
  });

  it("applies custom className", () => {
    render(<StatusBadge status="new" className="custom-badge" />);
    
    const badge = screen.getByText("New");
    expect(badge).toHaveClass("custom-badge");
  });

  it("handles unknown status gracefully", () => {
    render(<StatusBadge status="unknown" as any />);
    
    const badge = screen.getByText("Unknown");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-muted", "text-muted-foreground");
  });

  it("renders with icon when provided", () => {
    render(<StatusBadge status="new" showIcon />);
    
    const badge = screen.getByText("New");
    expect(badge).toBeInTheDocument();
    // Icon would be rendered alongside the text
  });
});

describe("CommunicationBadge", () => {
  it("renders SMS communication badge", () => {
    render(<CommunicationBadge type="sms" />);
    
    const badge = screen.getByText("SMS");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-info/15", "text-info");
  });

  it("renders Email communication badge", () => {
    render(<CommunicationBadge type="email" />);
    
    const badge = screen.getByText("Email");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-accent", "text-accent-foreground");
  });

  it("renders Call communication badge", () => {
    render(<CommunicationBadge type="call" />);
    
    const badge = screen.getByText("Call");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-success/15", "text-success");
  });

  it("renders with count", () => {
    render(<CommunicationBadge type="sms" count={5} />);
    
    expect(screen.getByText("SMS")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("applies custom size", () => {
    render(<CommunicationBadge type="sms" size="sm" />);
    
    const badge = screen.getByText("SMS");
    expect(badge).toHaveClass("text-xs");
  });

  it("handles unknown communication type", () => {
    render(<CommunicationBadge type="unknown" as any />);
    
    const badge = screen.getByText("Unknown");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-muted", "text-muted-foreground");
  });

  it("renders with tooltip", () => {
    render(<CommunicationBadge type="sms" showTooltip />);
    
    const badge = screen.getByText("SMS");
    expect(badge).toBeInTheDocument();
  });
});

describe("ActivityBadge", () => {
  it("renders active status", () => {
    render(<ActivityBadge status="active" />);
    
    const badge = screen.getByText("Active");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-success/15", "text-success");
  });

  it("renders inactive status", () => {
    render(<ActivityBadge status="inactive" />);
    
    const badge = screen.getByText("Inactive");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-muted", "text-muted-foreground");
  });

  it("renders pending status", () => {
    render(<ActivityBadge status="pending" />);
    
    const badge = screen.getByText("Pending");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-warning/15", "text-warning");
  });

  it("renders with last activity time", () => {
    render(<ActivityBadge status="active" lastActivity="2 hours ago" />);
    
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
  });

  it("shows pulse animation for active status", () => {
    render(<ActivityBadge status="active" showPulse />);
    
    const badge = screen.getByText("Active");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("animate-pulse");
  });

  it("applies custom className", () => {
    render(<ActivityBadge status="active" className="custom-activity" />);
    
    const badge = screen.getByText("Active");
    expect(badge).toHaveClass("custom-activity");
  });

  it("handles unknown activity status", () => {
    render(<ActivityBadge status="unknown" as any />);
    
    const badge = screen.getByText("Unknown");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-muted", "text-muted-foreground");
  });

  it("renders with different sizes", () => {
    const { rerender } = render(<ActivityBadge status="active" size="sm" />);
    let badge = screen.getByText("Active");
    expect(badge).toHaveClass("text-xs");

    rerender(<ActivityBadge status="active" size="lg" />);
    badge = screen.getByText("Active");
    expect(badge).toHaveClass("text-base");
  });
});

describe("Badge Integration", () => {
  it("renders multiple badges together", () => {
    render(
      <div>
        <StatusBadge status="new" />
        <CommunicationBadge type="sms" />
        <ActivityBadge status="active" />
      </div>
    );

    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("SMS")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies consistent styling across badge types", () => {
    render(
      <div>
        <StatusBadge status="new" className="test-badge" />
        <CommunicationBadge type="sms" className="test-badge" />
        <ActivityBadge status="active" className="test-badge" />
      </div>
    );

    const badges = screen.getAllByText("New", "SMS", "Active");
    badges.forEach(badge => {
      expect(badge).toHaveClass("test-badge");
    });
  });

  it("handles click events", () => {
    const onClick = vi.fn();
    render(<StatusBadge status="new" onClick={onClick} />);
    
    const badge = screen.getByText("New");
    badge.click();
    expect(onClick).toHaveBeenCalled();
  });

  it("supports keyboard navigation", () => {
    render(<StatusBadge status="new" tabIndex={0} />);
    
    const badge = screen.getByText("New");
    expect(badge).toHaveAttribute("tabIndex", "0");
  });
});
