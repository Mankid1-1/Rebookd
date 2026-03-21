import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import Leads from "../Leads";
import React from "react";

// Mock out all TRPC instances
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ 
      leads: { list: { invalidate: vi.fn() } }, 
      analytics: { dashboard: { invalidate: vi.fn() } } 
    }),
    leads: {
      list: { useQuery: () => ({ data: { leads: [], total: 0 }, isLoading: false }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      updateStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    analytics: {
      dashboard: { useQuery: () => ({ data: { statusBreakdown: [] } }) },
    },
    tenant: {
      get: { useQuery: () => ({ data: { name: "Test Tenant" } }) },
    }
  }
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/leads", vi.fn()],
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, name: "Test User", role: "admin" }, loading: false }),
}));

vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: any) => React.createElement("div", null, children),
}));

vi.mock("react-hook-form", () => ({
  useForm: () => ({
    register: vi.fn(),
    handleSubmit: (fn: any) => fn,
    reset: vi.fn(),
    formState: { errors: {} },
  }),
}));

vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: vi.fn(),
}));

vi.mock("@shared/schemas", () => ({
  createLeadSchema: {},
}));

test("Leads component renders correctly", () => {
    render(React.createElement(Leads));
    expect(screen.getByText("Leads")).toBeDefined();
});
