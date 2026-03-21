import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return {
    ...original,
    getDb: vi.fn().mockResolvedValue(null),
    getUserById: vi.fn().mockResolvedValue(null),
    ensureUserTenant: vi.fn().mockResolvedValue({ id: 1, name: "Test Biz" }),
    getTenantById: vi.fn().mockResolvedValue({ id: 1, name: "Test Biz", timezone: "UTC", industry: null }),
    updateTenant: vi.fn().mockResolvedValue(undefined),
    getLeadsByTenantId: vi.fn().mockResolvedValue({ leads: [], total: 0, page: 1, totalPages: 0 }),
    getLeadById: vi.fn().mockResolvedValue(null),
    createLead: vi.fn().mockResolvedValue(undefined),
    updateLead: vi.fn().mockResolvedValue(undefined),
    updateLeadStatus: vi.fn().mockResolvedValue(undefined),
    getMessagesByLeadId: vi.fn().mockResolvedValue([]),
    createMessage: vi.fn().mockResolvedValue(undefined),
    getAutomationsByTenantId: vi.fn().mockResolvedValue([]),
    getAutomationById: vi.fn().mockResolvedValue(null),
    createAutomation: vi.fn().mockResolvedValue(undefined),
    updateAutomation: vi.fn().mockResolvedValue(undefined),
    deleteAutomation: vi.fn().mockResolvedValue(undefined),
    toggleAutomation: vi.fn().mockResolvedValue(undefined),
    getTemplatesByTenantId: vi.fn().mockResolvedValue([]),
    getTemplateById: vi.fn().mockResolvedValue(null),
    createTemplate: vi.fn().mockResolvedValue(undefined),
    updateTemplate: vi.fn().mockResolvedValue(undefined),
    deleteTemplate: vi.fn().mockResolvedValue(undefined),
    getDashboardMetrics: vi.fn().mockResolvedValue({ leadCount: 5, messageCount: 20, bookedCount: 2, automationCount: 3 }),
    getLeadStatusBreakdown: vi.fn().mockResolvedValue([{ status: "new", count: 3 }, { status: "booked", count: 2 }]),
    getMessageVolume: vi.fn().mockResolvedValue([]),
    getRecentMessages: vi.fn().mockResolvedValue([]),
    getSubscriptionByTenantId: vi.fn().mockResolvedValue({ sub: { id: 1, tenantId: 1, planId: 1, status: "active", currentPeriodEnd: null }, plan: { id: 1, name: "Starter", priceMonthly: 4900, maxMessages: 500, maxAutomations: 3 } }),
    getUsageByTenantId: vi.fn().mockResolvedValue({ id: 1, tenantId: 1, messagesSent: 10, automationsRun: 2 }),
    getAllPlans: vi.fn().mockResolvedValue([{ id: 1, name: "Starter", slug: "starter", priceMonthly: 4900, maxMessages: 500, maxAutomations: 3, maxSeats: 1, features: [] }]),
    getPhoneNumbersByTenantId: vi.fn().mockResolvedValue([]),
    addPhoneNumber: vi.fn().mockResolvedValue(undefined),
    removePhoneNumber: vi.fn().mockResolvedValue(undefined),
    setDefaultPhoneNumber: vi.fn().mockResolvedValue(undefined),
    setInboundPhoneNumber: vi.fn().mockResolvedValue(undefined),
    getApiKeysByTenantId: vi.fn().mockResolvedValue([]),
    createApiKey: vi.fn().mockResolvedValue(undefined),
    revokeApiKey: vi.fn().mockResolvedValue(undefined),
    getAllTenants: vi.fn().mockResolvedValue({ tenants: [], total: 0 }),
    getAllUsers: vi.fn().mockResolvedValue({ users: [], total: 0 }),
    updateUserActive: vi.fn().mockResolvedValue(undefined),
    getSystemErrors: vi.fn().mockResolvedValue([]),
    getWebhookLogs: vi.fn().mockResolvedValue([]),
    getAiLogsByTenantId: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Rewritten message" } }],
  }),
}));

// ─── Context helpers ──────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

function makeAdminCtx(): TrpcContext {
  return makeCtx({
    user: {
      id: 99,
      openId: "admin-user",
      email: "admin@example.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  });
}

// ─── Auth tests ───────────────────────────────────────────────────────────────

describe("auth", () => {
  it("me returns the current user when authenticated", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toMatchObject({ id: 1, name: "Test User" });
  });

  it("me returns null when not authenticated", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("logout clears the session cookie", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalledWith(
      COOKIE_NAME,
      expect.objectContaining({ maxAge: -1 })
    );
  });
});

// ─── Plans tests ──────────────────────────────────────────────────────────────

describe("plans", () => {
  it("list returns available plans", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    const plans = await caller.plans.list();
    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0]).toMatchObject({ name: "Starter" });
  });
});

// ─── Tenant tests ─────────────────────────────────────────────────────────────

describe("tenant", () => {
  it("get returns tenant info for authenticated user", async () => {
    const { getUserById } = await import("./db");
    vi.mocked(getUserById).mockResolvedValueOnce({
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      tenantId: 1,
    } as any);
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const tenant = await caller.tenant.get();
    expect(tenant).toMatchObject({ id: 1, name: "Test Biz" });
  });

  it("phoneNumbers returns empty array when no phones configured", async () => {
    const { getUserById } = await import("./db");
    vi.mocked(getUserById).mockResolvedValueOnce({
      id: 1, openId: "test-user", name: "Test User", email: "test@example.com",
      loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(),
      lastSignedIn: new Date(), tenantId: 1,
    } as any);
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const phones = await caller.tenant.phoneNumbers();
    expect(Array.isArray(phones)).toBe(true);
    expect(phones.length).toBe(0);
  });
});

// ─── Leads tests ──────────────────────────────────────────────────────────────

describe("leads", () => {
  beforeEach(async () => {
    const { getUserById } = await import("./db");
    vi.mocked(getUserById).mockResolvedValue({
      id: 1, openId: "test-user", name: "Test User", email: "test@example.com",
      loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(),
      lastSignedIn: new Date(), tenantId: 1,
    } as any);
  });

  it("list returns paginated leads", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.leads.list({ page: 1, limit: 20 });
    expect(result).toMatchObject({ leads: [], total: 0, page: 1 });
  });

  it("create adds a new lead", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.leads.create({ phone: "+15550001234", name: "Jane Doe" });
    expect(result).toEqual({ ok: true });
  });
});

// ─── Automations tests ────────────────────────────────────────────────────────

describe("automations", () => {
  beforeEach(async () => {
    const { getUserById } = await import("./db");
    vi.mocked(getUserById).mockResolvedValue({
      id: 1, openId: "test-user", name: "Test User", email: "test@example.com",
      loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(),
      lastSignedIn: new Date(), tenantId: 1,
    } as any);
  });

  it("list returns automations array", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.automations.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Templates tests ──────────────────────────────────────────────────────────

describe("templates", () => {
  beforeEach(async () => {
    const { getUserById } = await import("./db");
    vi.mocked(getUserById).mockResolvedValue({
      id: 1, openId: "test-user", name: "Test User", email: "test@example.com",
      loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(),
      lastSignedIn: new Date(), tenantId: 1,
    } as any);
  });

  it("list returns templates array", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("create creates a template", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.create({ key: "test_tmpl", name: "Test Template", body: "Hello {{name}}!" });
    expect(result).toEqual({ ok: true });
  });

  it("preview rewrites message with AI", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.preview({ body: "Hello!", tone: "friendly" });
    expect(result).toHaveProperty("rewritten");
    expect(typeof result.rewritten).toBe("string");
  });
});

// ─── Analytics tests ──────────────────────────────────────────────────────────

describe("analytics", () => {
  beforeEach(async () => {
    const { getUserById } = await import("./db");
    vi.mocked(getUserById).mockResolvedValue({
      id: 1, openId: "test-user", name: "Test User", email: "test@example.com",
      loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(),
      lastSignedIn: new Date(), tenantId: 1,
    } as any);
  });

  it("dashboard returns metrics, statusBreakdown, and messageVolume", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.analytics.dashboard();
    expect(result).toHaveProperty("metrics");
    expect(result).toHaveProperty("statusBreakdown");
    expect(result).toHaveProperty("messageVolume");
    expect(result.metrics).toMatchObject({ leadCount: 5, bookedCount: 2 });
  });
});

// ─── Admin tests ──────────────────────────────────────────────────────────────

describe("admin", () => {
  it("tenants.list returns tenants for admin users", async () => {
    const ctx = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.tenants.list({ page: 1, limit: 20 });
    expect(result).toMatchObject({ tenants: [], total: 0 });
  });

  it("tenants.list throws FORBIDDEN for non-admin users", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.tenants.list({ page: 1, limit: 20 })).rejects.toThrow("FORBIDDEN");
  });

  it("users.list returns users for admin users", async () => {
    const ctx = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.users.list({ page: 1, limit: 20 });
    expect(result).toMatchObject({ users: [], total: 0 });
  });

  it("users.list throws FORBIDDEN for non-admin users", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.users.list({ page: 1, limit: 20 })).rejects.toThrow("FORBIDDEN");
  });

  it("systemHealth.errors returns errors for admin", async () => {
    const ctx = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.systemHealth.errors({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });
});
