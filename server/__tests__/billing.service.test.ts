import { describe, it, expect, vi } from "vitest";
import * as BillingService from "../services/billing.service";

// ─── Minimal Drizzle-like mock ────────────────────────────────────────────────
function makeDb(overrides: Record<string, any> = {}) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: () => overrides.selectResult ?? [],
    offset: () => Promise.resolve(overrides.selectResult ?? []),
    orderBy: () => chain,
    set: () => chain,
    values: () => Promise.resolve({ insertId: overrides.insertId ?? 1 }),
    then: (res: any) => Promise.resolve(overrides.selectResult ?? []).then(res),
  };

  return {
    select: (_fields?: any) => chain,
    insert: (_t: any) => ({ values: () => Promise.resolve({ insertId: overrides.insertId ?? 1 }) }),
    update: (_t: any) => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: (_t: any) => ({ where: () => Promise.resolve() }),
  };
}

describe("BillingService.listInvoicesByTenant", () => {
  it("returns invoices for tenant", async () => {
    const invoices = [
      { id: 1, tenantId: 1, stripeInvoiceId: "inv_1", total: 19900 },
      { id: 2, tenantId: 1, stripeInvoiceId: "inv_2", total: 19900 },
    ];
    const db = makeDb({ selectResult: invoices });
    const result = await BillingService.listInvoicesByTenant(db as any, 1);
    expect(result).toHaveLength(2);
    expect(result[0].stripeInvoiceId).toBe("inv_1");
  });

  it("returns empty array when no invoices", async () => {
    const db = makeDb({ selectResult: [] });
    const result = await BillingService.listInvoicesByTenant(db as any, 1);
    expect(result).toHaveLength(0);
  });
});

describe("BillingService.listRefundsByTenant", () => {
  it("returns refunds for tenant", async () => {
    const refunds = [{ id: 1, tenantId: 1, stripeRefundId: "re_1", amount: 5000 }];
    const db = makeDb({ selectResult: refunds });
    const result = await BillingService.listRefundsByTenant(db as any, 1);
    expect(result).toHaveLength(1);
    expect(result[0].stripeRefundId).toBe("re_1");
  });
});

describe("BillingService.getSubscriptionRowByTenant", () => {
  it("returns subscription when exists", async () => {
    const sub = { id: 1, tenantId: 1, stripeId: "sub_123", planId: 1 };
    const db = makeDb({ selectResult: [sub] });
    const result = await BillingService.getSubscriptionRowByTenant(db as any, 1);
    expect(result).toMatchObject({ stripeId: "sub_123" });
  });

  it("returns undefined when no subscription", async () => {
    const db = makeDb({ selectResult: [] });
    const result = await BillingService.getSubscriptionRowByTenant(db as any, 1);
    expect(result).toBeUndefined();
  });
});

describe("BillingService.changeSubscriptionPlan", () => {
  it("throws when no subscription found", async () => {
    const db = makeDb({ selectResult: [] });
    await expect(
      BillingService.changeSubscriptionPlan(db as any, {
        tenantId: 1,
        priceId: "price_123",
      })
    ).rejects.toThrow("No active Stripe subscription found");
  });
});

// ─── Revenue Share Calculation Tests ──────────────────────────────────────────

/**
 * Multi-query mock for calculateRevenueShare which makes 5 sequential queries:
 * 1. getSubscriptionRowByTenant → select().from(subscriptions).where().orderBy().limit(1)
 * 2. plan lookup → select({}).from(plans).where().limit(1)
 * 3. tenant lookup → select({}).from(tenants).where().limit(1)
 * 4. recovery events → select({}).from(recoveryEvents).where() (no .limit — resolved via .then())
 * 5. booked count → Promise.all([select({}).from(leads).where()])  (no .limit!)
 *
 * The mock tracks a call index that advances on .limit() or when the chain
 * is awaited via .then() (for queries 4 and 5).
 */
function makeRevenueShareDb(opts: {
  subscription?: any;
  plan?: any;
  tenant?: any;
  bookedCount?: number;
  realizedRevenue?: number;
  realizedCount?: number;
}) {
  let callIndex = 0;
  const responses = [
    opts.subscription ? [opts.subscription] : [],
    opts.plan ? [opts.plan] : [],
    opts.tenant ? [opts.tenant] : [],
    [{ totalRealized: opts.realizedRevenue ?? 0, realizedCount: opts.realizedCount ?? 0 }],
    [{ c: opts.bookedCount ?? 0 }],
  ];

  const next = () => {
    const result = responses[callIndex] ?? [];
    callIndex++;
    return result;
  };

  const makeChain = (): any => {
    const chain: any = {
      from: () => chain,
      where: () => chain,
      limit: () => next(),
      orderBy: () => chain,
      // Promise.all calls .then() on the chain for query 4
      then: (resolve: any) => Promise.resolve(next()).then(resolve),
    };
    return chain;
  };

  return {
    select: (_fields?: any) => makeChain(),
    insert: (_t: any) => ({ values: () => Promise.resolve({ insertId: 1 }) }),
    update: (_t: any) => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: (_t: any) => ({ where: () => Promise.resolve() }),
  };
}

describe("BillingService.calculateRevenueShare", () => {
  it("calculates 15% revenue share for standard client", async () => {
    const db = makeRevenueShareDb({
      subscription: { id: 1, tenantId: 1, planId: 1, customMonthlyPrice: null },
      plan: { revenueSharePercent: 15 },
      tenant: { settings: { avgAppointmentValue: 100 }, currency: "usd", billingType: "standard" },
      bookedCount: 10,
    });

    const result = await BillingService.calculateRevenueShare(db as any, 1);

    expect(result.recoveredAppointments).toBe(10);
    expect(result.recoveredRevenue).toBe(1000);
    expect(result.revenueShareOwed).toBe(150);
    expect(result.monthlyFee).toBe(199);
    expect(result.totalCost).toBe(349);
    expect(result.netSavings).toBe(651);
    expect(result.billingType).toBe("standard");
  });

  it("returns $0 base fee for founder clients", async () => {
    const db = makeRevenueShareDb({
      subscription: { id: 1, tenantId: 1, planId: 1, customMonthlyPrice: null },
      plan: { revenueSharePercent: 15 },
      tenant: { settings: { avgAppointmentValue: 100 }, currency: "usd", billingType: "founder" },
      bookedCount: 10,
    });

    const result = await BillingService.calculateRevenueShare(db as any, 1);

    expect(result.monthlyFee).toBe(0);
    expect(result.revenueShareOwed).toBe(150);
    expect(result.totalCost).toBe(150);
    expect(result.netSavings).toBe(850);
    expect(result.billingType).toBe("founder");
  });

  it("uses custom monthly price for flex clients", async () => {
    const db = makeRevenueShareDb({
      subscription: { id: 1, tenantId: 1, planId: 2, customMonthlyPrice: 9900 },
      plan: { revenueSharePercent: 15 },
      tenant: { settings: { avgAppointmentValue: 200 }, currency: "usd", billingType: "flex" },
      bookedCount: 5,
    });

    const result = await BillingService.calculateRevenueShare(db as any, 1);

    expect(result.recoveredRevenue).toBe(1000);
    expect(result.monthlyFee).toBe(99);
    expect(result.revenueShareOwed).toBe(150);
    expect(result.billingType).toBe("flex");
  });

  it("returns zero share when no appointments recovered", async () => {
    const db = makeRevenueShareDb({
      subscription: { id: 1, tenantId: 1, planId: 1, customMonthlyPrice: null },
      plan: { revenueSharePercent: 15 },
      tenant: { settings: {}, currency: "usd", billingType: "standard" },
      bookedCount: 0,
    });

    const result = await BillingService.calculateRevenueShare(db as any, 1);

    expect(result.recoveredAppointments).toBe(0);
    expect(result.recoveredRevenue).toBe(0);
    expect(result.revenueShareOwed).toBe(0);
    expect(result.monthlyFee).toBe(199);
    expect(result.netSavings).toBe(-199);
  });

  it("defaults to 15% when plan has no revenue share configured", async () => {
    const db = makeRevenueShareDb({
      subscription: { id: 1, tenantId: 1, planId: 1, customMonthlyPrice: null },
      plan: { revenueSharePercent: 0 },
      tenant: { settings: { avgAppointmentValue: 100 }, currency: "usd", billingType: "standard" },
      bookedCount: 4,
    });

    const result = await BillingService.calculateRevenueShare(db as any, 1);

    expect(result.revenueSharePercent).toBe(15);
    expect(result.revenueShareOwed).toBe(60);
  });

  it("uses $150 default avg appointment value when not configured", async () => {
    const db = makeRevenueShareDb({
      subscription: { id: 1, tenantId: 1, planId: 1, customMonthlyPrice: null },
      plan: { revenueSharePercent: 15 },
      tenant: { settings: {}, currency: "usd", billingType: "standard" },
      bookedCount: 2,
    });

    const result = await BillingService.calculateRevenueShare(db as any, 1);

    expect(result.avgAppointmentValue).toBe(150);
    expect(result.recoveredRevenue).toBe(300);
  });
});
