import { and, asc, eq, lte } from "drizzle-orm";
import { automationJobs } from "../../drizzle/schema";
import type { Db } from "../_core/context";

export async function enqueueAutomationJob(db: Db, input: {
  tenantId: number;
  automationId: number;
  leadId?: number;
  eventType: string;
  eventData: Record<string, unknown>;
  stepIndex: number;
  nextRunAt: Date;
}) {
  await db.insert(automationJobs).values({
    tenantId: input.tenantId,
    automationId: input.automationId,
    leadId: input.leadId,
    eventType: input.eventType,
    eventData: input.eventData,
    stepIndex: input.stepIndex,
    nextRunAt: input.nextRunAt,
  });
}

export async function claimDueAutomationJobs(db: Db, limit = 50) {
  const rows = await db
    .select()
    .from(automationJobs)
    .where(and(eq(automationJobs.status, "pending"), lte(automationJobs.nextRunAt, new Date())))
    .orderBy(asc(automationJobs.nextRunAt))
    .limit(limit);

  const claimed = [];
  for (const row of rows) {
    await db
      .update(automationJobs)
      .set({ status: "running", attempts: row.attempts + 1, updatedAt: new Date() })
      .where(and(eq(automationJobs.id, row.id), eq(automationJobs.status, "pending")));
    claimed.push({ ...row, status: "running", attempts: row.attempts + 1 });
  }
  return claimed;
}

export async function completeAutomationJob(db: Db, jobId: number) {
  await db
    .update(automationJobs)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(automationJobs.id, jobId));
}

export async function rescheduleAutomationJob(db: Db, jobId: number, nextRunAt: Date, lastError?: string) {
  await db
    .update(automationJobs)
    .set({ status: "pending", nextRunAt, lastError, updatedAt: new Date() })
    .where(eq(automationJobs.id, jobId));
}

export async function failAutomationJob(db: Db, jobId: number, lastError: string) {
  await db
    .update(automationJobs)
    .set({ status: "failed", lastError, updatedAt: new Date() })
    .where(eq(automationJobs.id, jobId));
}
