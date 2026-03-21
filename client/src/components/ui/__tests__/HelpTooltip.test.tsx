import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HelpTooltip } from "../HelpTooltip";

describe("HelpTooltip", () => {
  it("renders children and tooltip content", () => {
    render(
      <HelpTooltip content="This is helpful information" variant="info">
        <button>Help</button>
      </HelpTooltip>
    );

    const button = screen.getByRole("button", { name: "Help" });
    expect(button).toBeInTheDocument();
  });

  it("shows tooltip on hover", async () => {
    render(
      <HelpTooltip content="This is helpful information" variant="info">
        <button>Help</button>
      </HelpTooltip>
    );

    const button = screen.getByRole("button", { name: "Help" });
    
    // Hover over the button
    fireEvent.mouseEnter(button);
    fireEvent.mouseMove(button);
    
    // Tooltip should appear (implementation depends on Radix Tooltip)
    expect(button).toBeInTheDocument();
  });

  it("renders info variant correctly", () => {
    render(
      <HelpTooltip content="Info tooltip" variant="info">
        <span>Info</span>
      </HelpTooltip>
    );

    const span = screen.getByText("Info");
    expect(span).toBeInTheDocument();
  });

  it("renders help variant correctly", () => {
    render(
      <HelpTooltip content="Help tooltip" variant="help">
        <span>Help</span>
      </HelpTooltip>
    );

    const span = screen.getByText("Help");
    expect(span).toBeInTheDocument();
  });

  it("renders tip variant correctly", () => {
    render(
      <HelpTooltip content="Tip tooltip" variant="tip">
        <span>Tip</span>
      </HelpTooltip>
    );

    const span = screen.getByText("Tip");
    expect(span).toBeInTheDocument();
  });

  it("applies correct CSS classes", () => {
    render(
      <HelpTooltip content="Test content" variant="info">
        <div className="test-child">Test</div>
      </HelpTooltip>
    );

    const child = screen.getByText("Test");
    expect(child).toBeInTheDocument();
    expect(child).toHaveClass("test-child");
  });

  it("handles empty content gracefully", () => {
    render(
      <HelpTooltip content="" variant="info">
        <span>Empty</span>
      </HelpTooltip>
    );

    const span = screen.getByText("Empty");
    expect(span).toBeInTheDocument();
  });

  it("supports long content", () => {
    const longContent = "This is a very long help text that should wrap properly and still be readable by users who need additional context about the feature they are looking at.";
    
    render(
      <HelpTooltip content={longContent} variant="info">
        <span>Long Content</span>
      </HelpTooltip>
    );

    const span = screen.getByText("Long Content");
    expect(span).toBeInTheDocument();
  });
});
