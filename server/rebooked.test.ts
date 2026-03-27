import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ─── Mock Drizzle DB ──────────────────────────────────────────────────────────
// Services use ctx.db directly (Drizzle ORM instance). We build a fluent mock
// that returns sensible defaults for all query patterns used in the routers.

const DRIZZLE_NAME = Symbol.for("drizzle:Name");

function getTableName(t: any): string | null {
  if (!t) return null;
  return t[DRIZZLE_NAME] ?? t?._.name ?? t?.name ?? null;
}

function makeMockDb() {
  // Default row data per table
  const tableRows: Record<string, any[]> = {
    users: [{ id: 1, openId: "test-user", name: "Test User", email: "test@example.com", loginMethod: "manus", role: "user", tenantId: 1, active: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }],
    tenants: [{ id: 1, name: "Test Biz", slug: "test-biz", timezone: "UTC", industry: null, active: true, createdAt: new Date(), updatedAt: new Date() }],
    plans: [{ id: 1, name: "Starter", slug: "starter", priceMonthly: 4900, maxMessages: 500, maxAutomations: 3, maxSeats: 1, features: [] }],
    leads: [],
    messages: [],
    automations: [],
    templates: [],
    phoneNumbers: [],
    subscriptions: [],
    usage: [],
    systemErrorLogs: [],
    webhookLogs: [],
    aiMessageLogs: [],
  };

  function makeChain(isCount = false): any {
    let _table: string | null = null;

    const resolve = () => {
      const rows = _table ? (tableRows[_table] ?? []) : [];
      return isCount ? [{ count: rows.length }] : rows;
    };

    const c: any = {
      from: (t: any) => { _table = getTableName(t); return c; },
      where: () => c,
      limit: () => c,   // keep chain going; data resolved at await/offset
      offset: () => Promise.resolve(resolve()),
      orderBy: () => c,
      groupBy: () => c,
      innerJoin: () => c,
      set: () => c,
      values: () => Promise.resolve({ insertId: 1 }),
      then: (onFulfilled: any, onRejected?: any) =>
        Promise.resolve(resolve()).then(onFulfilled, onRejected),
      catch: (fn: any) => Promise.resolve(resolve()).catch(fn),
      finally: (fn: any) => Promise.resolve(resolve()).finally(fn),
    };
    return c;
  }

  return {
    select: (fields?: any) => {
      // Detect count queries by checking if fields object contains a count key
      const isCount = !!fields && Object.keys(fields).some(k => k === "count");
      return makeChain(isCount);
    },
    insert: (_t: any) => ({ values: () => Promise.resolve({ insertId: 1 }) }),
    update: (_t: any) => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: (_t: any) => ({ where: () => Promise.resolve() }),
  };
}

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Rewritten message" } }],
  }),
}));

vi.mock("./services/eventBus", () => ({
  emitEvent: vi.fn().mockResolvedValue(undefined),
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
      emailVerifiedAt: new Date(),
      passwordHash: "",
      tenantId: 1,
      active: true,
      stripeCustomerId: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
    db: makeMockDb() as any,
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
      emailVerifiedAt: new Date(),
      passwordHash: "",
      tenantId: 1,
      active: true,
      stripeCustomerId: "",
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
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const tenant = await caller.tenant.get();
    expect(tenant).toMatchObject({ id: 1, name: "Test Biz" });
  });

  it("phoneNumbers returns empty array when no phones configured", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const phones = await caller.tenant.phoneNumbers();
    expect(Array.isArray(phones)).toBe(true);
    expect(phones.length).toBe(0);
  });
});

// ─── Leads tests ──────────────────────────────────────────────────────────────

describe("leads", () => {
  it("list returns paginated leads", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.leads.list({ page: 1, limit: 20 });
    expect(result).toMatchObject({ leads: [], total: 0 });
  });

  it("create adds a new lead", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.leads.create({ phone: "+12133734253", name: "Jane Doe" });
    expect(result).toEqual({ success: true });
  });

  it("get enforces tenant scope (not found for other tenant)", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.leads.get({ leadId: 99999 })).rejects.toThrow(/NOT_FOUND/i);
  });
});

// ─── Automations tests ────────────────────────────────────────────────────────

describe("automations", () => {
  it("list returns automations array", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.automations.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Templates tests ──────────────────────────────────────────────────────────

describe("templates", () => {
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
    expect(result).toEqual({ success: true });
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
  it("dashboard returns metrics, statusBreakdown, and messageVolume", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.analytics.dashboard();
    expect(result).toHaveProperty("metrics");
    expect(result).toHaveProperty("statusBreakdown");
    expect(result).toHaveProperty("messageVolume");
  });
});

// ─── Admin tests ──────────────────────────────────────────────────────────────

describe("admin", () => {
  it("tenants.list returns tenants for admin users", async () => {
    const ctx = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.tenants.list();
    expect(result).toHaveProperty("tenants");
    expect(Array.isArray(result.tenants)).toBe(true);
    expect(result).toHaveProperty("total");
  });

  it("tenants.list throws FORBIDDEN for non-admin users", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.tenants.list()).rejects.toThrow(/FORBIDDEN|permission/i);
  });

  it("users.list returns users for admin users", async () => {
    const ctx = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.users.list();
    expect(result).toHaveProperty("users");
    expect(Array.isArray(result.users)).toBe(true);
    expect(result).toHaveProperty("total");
  });

  it("users.list throws FORBIDDEN for non-admin users", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.users.list()).rejects.toThrow(/FORBIDDEN|permission/i);
  });

  it("systemHealth.errors returns errors for admin", async () => {
    const ctx = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.systemHealth.errors();
    expect(Array.isArray(result)).toBe(true);
  });
});
