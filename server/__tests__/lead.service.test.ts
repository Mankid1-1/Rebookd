import { describe, it, expect, vi, beforeEach } from "vitest";
import * as LeadService from "../services/lead.service";

// ─── Minimal Drizzle-like mock ────────────────────────────────────────────────
function makeDb(overrides: Record<string, any> = {}) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    offset: () => Promise.resolve(overrides.selectResult ?? []),
    orderBy: () => chain,
    innerJoin: () => chain,
    set: () => chain,
    values: () => Promise.resolve({ insertId: 1 }),
    then: (res: any) => Promise.resolve(overrides.selectResult ?? []).then(res),
  };

  return {
    select: (_fields?: any) => {
      // count query returns [{ count: N }]
      if (_fields && Object.keys(_fields).some((k) => k === "count")) {
        return {
          from: () => ({ where: () => Promise.resolve([{ count: overrides.count ?? 0 }]) }),
        };
      }
      return chain;
    },
    insert: (_t: any) => ({ values: () => Promise.resolve({ insertId: overrides.insertId ?? 1 }) }),
    update: (_t: any) => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: (_t: any) => ({ where: () => Promise.resolve() }),
  };
}

describe("LeadService.getLeads", () => {
  it("returns leads and total count", async () => {
    const db = makeDb({ selectResult: [{ id: 1, phone: "+14155552671", tenantId: 1 }], count: 1 });
    const result = await LeadService.getLeads(db as any, 1, { page: 1, limit: 20 });
    expect(result.leads).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("returns empty when no leads", async () => {
    const db = makeDb({ selectResult: [], count: 0 });
    const result = await LeadService.getLeads(db as any, 1);
    expect(result.leads).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe("LeadService.createLead", () => {
  it("inserts a lead and returns success", async () => {
    const db = makeDb();
    const result = await LeadService.createLead(db as any, {
      tenantId: 1,
      phone: "+14155552671",
      name: "Jane Doe",
    });
    expect(result).toEqual({ success: true });
  });
});

describe("LeadService.getLeadById", () => {
  it("returns the lead when found", async () => {
    const lead = { id: 5, tenantId: 1, phone: "+14155552671" };
    const db = makeDb({ selectResult: [lead] });
    const result = await LeadService.getLeadById(db as any, 1, 5);
    expect(result).toMatchObject({ id: 5 });
  });

  it("returns undefined when not found", async () => {
    const db = makeDb({ selectResult: [] });
    const result = await LeadService.getLeadById(db as any, 1, 999);
    expect(result).toBeUndefined();
  });
});
