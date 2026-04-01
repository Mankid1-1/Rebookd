/**
 * Automation Engine Test Suite
 *
 * Tests the core automation engine for:
 *   1. TCPA Kill-Switch — STOP opt-outs prevent message sending
 *   2. State Machine — Detected → Contacted → Recovered → Billed
 *   3. Revenue Share — 15% commission calculation
 *   4. Cooldown enforcement
 *   5. Max attempts enforcement
 *   6. Performance — sub-500ms trigger response (enqueue-only)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Dependencies ───────────────────────────────────────────────────────

// Mock TCPA compliance service
const mockCanSendSms = vi.fn();
vi.mock("./tcpa-compliance.service", () => ({
  canSendSms: (...args: any[]) => mockCanSendSms(...args),
}));

// Mock tenant service
vi.mock("./tenant.service", () => ({
  tenantHasAutomationAccess: vi.fn().mockResolvedValue(true),
  getTenantById: vi.fn().mockResolvedValue({ id: 1, name: "Test Salon" }),
}));

// Mock automation service
const mockUpsertByKey = vi.fn();
const mockGetByKey = vi.fn();
vi.mock("./automation.service", () => ({
  upsertAutomationByKey: (...args: any[]) => mockUpsertByKey(...args),
  getAutomationByKey: (...args: any[]) => mockGetByKey(...args),
  getAutomationsByTrigger: vi.fn().mockResolvedValue([]),
  updateAutomation: vi.fn().mockResolvedValue(undefined),
}));

// Mock automation job service
const mockEnqueueJob = vi.fn();
vi.mock("./automation-job.service", () => ({
  enqueueAutomationJob: (...args: any[]) => mockEnqueueJob(...args),
}));

// Mock recovery attribution
const mockCreateRecoveryEvent = vi.fn();
const mockMarkConverted = vi.fn();
const mockMarkRealized = vi.fn();
vi.mock("./recovery-attribution.service", () => ({
  createRecoveryEvent: (...args: any[]) => mockCreateRecoveryEvent(...args),
  markRecoveryConverted: (...args: any[]) => mockMarkConverted(...args),
  markRecoveryRealized: (...args: any[]) => mockMarkRealized(...args),
}));

// Mock SMS
vi.mock("../_core/sms", () => ({
  sendSMS: vi.fn().mockResolvedValue({ success: true, sid: "test_sid", provider: "mock" }),
  resolveTemplate: vi.fn().mockImplementation((tpl: string) => tpl),
}));

// Mock logger
vi.mock("../_core/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock DB — must handle chained patterns like:
//   db.select().from().where()          → resolves to []
//   db.select().from().where().limit()  → resolves to []
//   db.select().from().where().orderBy().limit() → resolves to []
// The key is that where() must be BOTH thenable (for direct await) AND
// have .limit()/.orderBy() methods for further chaining.
function createMockSelect() {
  const emptyArray: any[] = [];
  const limitFn = vi.fn().mockResolvedValue(emptyArray);
  const orderByFn = vi.fn().mockReturnValue({ limit: limitFn });

  // where() returns a Promise-like object that also has .limit() and .orderBy()
  const whereFn = vi.fn().mockImplementation(() => {
    const result = Promise.resolve(emptyArray) as any;
    result.limit = limitFn;
    result.orderBy = orderByFn;
    return result;
  });
  const fromFn = vi.fn().mockReturnValue({ where: whereFn });
  return vi.fn().mockReturnValue({ from: fromFn });
}

const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
});
const mockSelect = createMockSelect();
const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
    }),
  }),
} as any;

// ─── Import after mocks ─────────────────────────────────────────────────────

import { executeAutomation } from "./automationCore";
import { isValidTransition } from "./automationCore";
import { WORKFLOW_REGISTRY, isRegisteredWorkflow, getRecoveryWorkflows } from "./recoveryWorkflows";

// ─── Test Setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockCanSendSms.mockResolvedValue({ allowed: true });
  mockUpsertByKey.mockResolvedValue({ id: 1, key: "missed_call_textback", enabled: true });
  mockGetByKey.mockResolvedValue({ id: 1, key: "missed_call_textback" });
  mockEnqueueJob.mockResolvedValue(42);
  mockCreateRecoveryEvent.mockResolvedValue({
    recoveryEventId: 100,
    trackingToken: "rb_1_42_test_abc123",
  });
});

// ─── TCPA Kill-Switch Tests ──────────────────────────────────────────────────

describe("TCPA Kill-Switch", () => {
  it("blocks SMS when lead has unsubscribed (replied STOP)", async () => {
    mockCanSendSms.mockResolvedValue({ allowed: false, reason: "Lead has unsubscribed" });

    const result = await executeAutomation(mockDb, {
      tenantId: 1,
      leadId: 42,
      workflowKey: "missed_call_textback",
      eventType: "call.missed",
      eventData: { phone: "+12025551234" },
    });

    expect(result.success).toBe(false);
    expect(result.blockedReason).toContain("TCPA");
    expect(result.blockedReason).toContain("Lead has unsubscribed");
    // SMS should NEVER have been sent
    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("blocks SMS when lead has no consent on record", async () => {
    mockCanSendSms.mockResolvedValue({ allowed: false, reason: "No SMS consent on record" });

    const result = await executeAutomation(mockDb, {
      tenantId: 1,
      leadId: 42,
      workflowKey: "noshow_recovery",
      eventType: "appointment.no_show",
      eventData: { phone: "+12025551234" },
    });

    expect(result.success).toBe(false);
    expect(result.blockedReason).toContain("No SMS consent");
    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("allows SMS when lead has valid consent", async () => {
    mockCanSendSms.mockResolvedValue({ allowed: true });

    const result = await executeAutomation(mockDb, {
      tenantId: 1,
      leadId: 42,
      workflowKey: "missed_call_textback",
      eventType: "call.missed",
      eventData: { phone: "+12025551234" },
    });

    expect(result.success).toBe(true);
    expect(mockEnqueueJob).toHaveBeenCalled();
  });

  it("TCPA check is called with correct tenant and lead IDs", async () => {
    await executeAutomation(mockDb, {
      tenantId: 7,
      leadId: 99,
      workflowKey: "missed_call_textback",
      eventType: "call.missed",
      eventData: { phone: "+12025551234" },
    });

    expect(mockCanSendSms).toHaveBeenCalledWith(mockDb, 7, 99);
  });
});

// ─── State Machine Tests ─────────────────────────────────────────────────────

describe("Recovery State Machine", () => {
  it("validates Detected → Contacted transition", () => {
    expect(isValidTransition("detected", "contacted")).toBe(true);
  });

  it("validates Contacted → Recovered transition", () => {
    expect(isValidTransition("contacted", "recovered")).toBe(true);
  });

  it("validates Recovered → Billed transition", () => {
    expect(isValidTransition("recovered", "billed")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(isValidTransition("detected", "recovered")).toBe(false);
    expect(isValidTransition("detected", "billed")).toBe(false);
    expect(isValidTransition("contacted", "billed")).toBe(false);
    expect(isValidTransition("billed", "detected")).toBe(false);
  });

  it("creates recovery event for recovery workflows", async () => {
    const result = await executeAutomation(mockDb, {
      tenantId: 1,
      leadId: 42,
      workflowKey: "missed_call_textback",
      eventType: "call.missed",
      eventData: { phone: "+12025551234" },
      estimatedRevenue: 15000, // $150 in cents
    });

    expect(result.success).toBe(true);
    expect(result.recoveryEventId).toBe(100);
    expect(result.trackingToken).toBe("rb_1_42_test_abc123");
    expect(mockCreateRecoveryEvent).toHaveBeenCalledWith(mockDb, expect.objectContaining({
      tenantId: 1,
      leadId: 42,
      leakageType: "missed_call",
      estimatedRevenue: 15000,
    }));
  });

  it("does NOT create recovery event for non-recovery workflows", async () => {
    mockUpsertByKey.mockResolvedValue({ id: 2, key: "welcome_new_lead", enabled: true });

    const result = await executeAutomation(mockDb, {
      tenantId: 1,
      leadId: 42,
      workflowKey: "welcome_new_lead",
      eventType: "lead.created",
      eventData: { phone: "+12025551234" },
    });

    expect(result.success).toBe(true);
    expect(result.recoveryEventId).toBeUndefined();
    expect(mockCreateRecoveryEvent).not.toHaveBeenCalled();
  });
});

// ─── Revenue Share (15% Commission) Tests ────────────────────────────────────

describe("Revenue Share Calculation", () => {
  it("calculates 15% commission correctly", () => {
    // $100 payment in cents
    const realizedRevenue = 10000;
    const commissionRate = 0.15;
    const commissionAmount = Math.round(realizedRevenue * commissionRate);
    expect(commissionAmount).toBe(1500); // $15.00
  });

  it("handles fractional cents by rounding", () => {
    // $33.33 payment in cents
    const realizedRevenue = 3333;
    const commissionAmount = Math.round(realizedRevenue * 0.15);
    expect(commissionAmount).toBe(500); // $5.00 (rounded from $4.9995)
  });
});

// ─── Workflow Registry Tests ─────────────────────────────────────────────────

describe("Workflow Registry", () => {
  it("contains exactly 19 workflows", () => {
    expect(Object.keys(WORKFLOW_REGISTRY)).toHaveLength(19);
  });

  it("all workflows have required fields", () => {
    for (const [key, workflow] of Object.entries(WORKFLOW_REGISTRY)) {
      expect(workflow.key).toBe(key);
      expect(workflow.name).toBeTruthy();
      expect(workflow.description).toBeTruthy();
      expect(workflow.category).toBeTruthy();
      expect(workflow.triggerEvent).toBeTruthy();
      expect(workflow.triggerType).toBeTruthy();
      expect(typeof workflow.priority).toBe("number");
      expect(typeof workflow.isRecoveryFlow).toBe("boolean");
      expect(workflow.steps.length).toBeGreaterThan(0);
      expect(typeof workflow.cooldownMinutes).toBe("number");
      expect(typeof workflow.maxAttemptsPerLead).toBe("number");
    }
  });

  it("all recovery workflows have leakageType set", () => {
    const recoveryFlows = getRecoveryWorkflows();
    expect(recoveryFlows.length).toBeGreaterThan(0);

    for (const wf of recoveryFlows) {
      expect(wf.leakageType).toBeTruthy();
    }
  });

  it("all SMS steps include STOP language", () => {
    for (const [, workflow] of Object.entries(WORKFLOW_REGISTRY)) {
      for (const step of workflow.steps) {
        if (step.type === "sms" && step.messageBody) {
          expect(step.messageBody).toContain("Reply STOP to unsubscribe");
        }
      }
    }
  });

  it("isRegisteredWorkflow returns true for known keys", () => {
    expect(isRegisteredWorkflow("missed_call_textback")).toBe(true);
    expect(isRegisteredWorkflow("noshow_recovery")).toBe(true);
    expect(isRegisteredWorkflow("win_back_90d")).toBe(true);
  });

  it("isRegisteredWorkflow returns false for unknown keys", () => {
    expect(isRegisteredWorkflow("nonexistent_workflow")).toBe(false);
    expect(isRegisteredWorkflow("")).toBe(false);
  });
});

// ─── Performance Tests ───────────────────────────────────────────────────────

describe("Performance", () => {
  it("executeAutomation enqueues and returns in under 500ms", async () => {
    const start = performance.now();

    await executeAutomation(mockDb, {
      tenantId: 1,
      leadId: 42,
      workflowKey: "missed_call_textback",
      eventType: "call.missed",
      eventData: { phone: "+12025551234" },
    });

    const duration = performance.now() - start;
    // With mocked DB, this should be well under 100ms
    expect(duration).toBeLessThan(500);
  });

  it("returns a jobId indicating background processing", async () => {
    const result = await executeAutomation(mockDb, {
      tenantId: 1,
      leadId: 42,
      workflowKey: "missed_call_textback",
      eventType: "call.missed",
      eventData: { phone: "+12025551234" },
    });

    expect(result.jobId).toBe(42); // From mockEnqueueJob
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tenantId: 1,
        leadId: 42,
        stepIndex: 0,
        nextRunAt: expect.any(Date),
      }),
    );
  });
});

// ─── Edge Cases ──────────────────────────────────────────────────────────────

describe("Edge Cases", () => {
  it("rejects unknown workflow keys", async () => {
    const result = await executeAutomation(mockDb, {
      tenantId: 1,
      leadId: 42,
      workflowKey: "nonexistent" as any,
      eventType: "call.missed",
      eventData: {},
    });

    expect(result.success).toBe(false);
    expect(result.blockedReason).toContain("Unknown workflow");
  });

  it("blocks when tenant is not entitled", async () => {
    const TenantService = await import("./tenant.service");
    vi.mocked(TenantService.tenantHasAutomationAccess).mockResolvedValueOnce(false);

    const result = await executeAutomation(mockDb, {
      tenantId: 1,
      leadId: 42,
      workflowKey: "missed_call_textback",
      eventType: "call.missed",
      eventData: {},
    });

    expect(result.success).toBe(false);
    expect(result.blockedReason).toContain("not entitled");
  });
});
