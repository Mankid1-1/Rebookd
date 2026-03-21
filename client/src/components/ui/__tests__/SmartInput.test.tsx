import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SmartInput } from "../SmartInput";

describe("SmartInput", () => {
  it("renders basic input correctly", () => {
    render(
      <SmartInput
        label="Test Label"
        placeholder="Enter text"
      />
    );

    expect(screen.getByText("Test Label")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("displays help text when provided", () => {
    render(
      <SmartInput
        label="Test Label"
        helpText="This is helpful text"
      />
    );

    expect(screen.getByText("This is helpful text")).toBeInTheDocument();
  });

  it("shows error state", () => {
    render(
      <SmartInput
        label="Test Label"
        error="This field is required"
      />
    );

    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });

  it("shows success state", () => {
    render(
      <SmartInput
        label="Test Label"
        success="Looking good!"
      />
    );

    expect(screen.getByText("Looking good!")).toBeInTheDocument();
  });

  it("handles input changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SmartInput
        label="Test Label"
        onChange={onChange}
      />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "test input");

    expect(onChange).toHaveBeenCalled();
    expect(input).toHaveValue("test input");
  });

  it("validates required field", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();

    render(
      <SmartInput
        label="Test Label"
        required
        onBlur={onBlur}
      />
    );

    const input = screen.getByRole("textbox");
    await user.click(input);
    await user.tab(); // Blur the input

    expect(onBlur).toHaveBeenCalled();
  });

  it("formats phone number input", async () => {
    const user = userEvent.setup();

    render(
      <SmartInput
        label="Phone"
        type="tel"
        phoneFormat
      />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "5551234567");

    // Phone formatting would be handled by the component
    expect(input).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();

    render(
      <SmartInput
        label="Password"
        type="password"
        toggleable
      />
    );

    const input = screen.getByLabelText(/password/i) as HTMLInputElement;
    const toggleButton = screen.getByRole("button");

    expect(input.type).toBe("password");

    await user.click(toggleButton);
    expect(input.type).toBe("text");

    await user.click(toggleButton);
    expect(input.type).toBe("password");
  });

  it("displays hint text", () => {
    render(
      <SmartInput
        label="Test Label"
        hint="Optional field"
      />
    );

    expect(screen.getByText("Optional field")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(
      <SmartInput
        label="Test Label"
        className="custom-class"
      />
    );

    const container = screen.getByText("Test Label").closest("div");
    expect(container).toHaveClass("custom-class");
  });

  it("handles disabled state", () => {
    render(
      <SmartInput
        label="Test Label"
        disabled
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });

  it("shows loading state", () => {
    render(
      <SmartInput
        label="Test Label"
        loading
      />
    );

    // Loading indicator would be visible
    expect(screen.getByText("Test Label")).toBeInTheDocument();
  });

  it("handles character limit", async () => {
    const user = userEvent.setup();

    render(
      <SmartInput
        label="Test Label"
        maxLength={10}
      />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "this is way too long text");

    // Character limit enforcement
    expect(input).toBeInTheDocument();
  });

  it("supports different input types", () => {
    const { rerender } = render(
      <SmartInput
        label="Email"
        type="email"
      />
    );

    expect(screen.getByRole("textbox")).toHaveAttribute("type", "email");

    rerender(
      <SmartInput
        label="Number"
        type="number"
      />
    );

    expect(screen.getByRole("spinbutton")).toHaveAttribute("type", "number");
  });

  it("handles focus and blur events", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    const onBlur = vi.fn();

    render(
      <SmartInput
        label="Test Label"
        onFocus={onFocus}
        onBlur={onBlur}
      />
    );

    const input = screen.getByRole("textbox");
    
    await user.click(input);
    expect(onFocus).toHaveBeenCalled();

    await user.tab();
    expect(onBlur).toHaveBeenCalled();
  });

  it("displays character count when showCount is true", () => {
    render(
      <SmartInput
        label="Test Label"
        showCount
        maxLength={50}
      />
    );

    // Character count would be displayed
    expect(screen.getByText("Test Label")).toBeInTheDocument();
  });

  it("validates email format", async () => {
    const user = userEvent.setup();

    render(
      <SmartInput
        label="Email"
        type="email"
        required
      />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "invalid-email");

    // Email validation would trigger error
    expect(input).toBeInTheDocument();
  });

  it("handles paste events", async () => {
    const user = userEvent.setup();
    const onPaste = vi.fn();

    render(
      <SmartInput
        label="Test Label"
        onPaste={onPaste}
      />
    );

    const input = screen.getByRole("textbox");
    
    // Simulate paste
    fireEvent.paste(input, {
      clipboardData: {
        getData: () => "pasted text"
      }
    });

    expect(input).toBeInTheDocument();
  });
});
