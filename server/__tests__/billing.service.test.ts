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
