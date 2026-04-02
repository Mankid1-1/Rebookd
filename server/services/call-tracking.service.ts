/**
 * 📞 CALL TRACKING SERVICE
 * Voice call tracking for Twilio, Telnyx, Google Voice (manual), and generic webhooks.
 * Auto-matches callers to leads, emits events for automation triggers.
 */

import type { Db } from "../_core/context";
import { callLogs, leads, type InsertCallLog } from "../../drizzle/schema";
import { and, eq, gte, desc, sql, count, isNull } from "drizzle-orm";
import { hashPhoneNumber, normalizePhoneNumber } from "../_core/phone";
import { emitEvent } from "./event-bus.service";
import { randomUUID } from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CallDirection = "inbound" | "outbound";
export type CallStatus = "ringing" | "in_progress" | "completed" | "missed" | "voicemail" | "failed" | "busy" | "no_answer";

export interface LogCallData {
  tenantId: number;
  direction: CallDirection;
  callerNumber: string;
  calledNumber: string;
  status?: CallStatus;
  duration?: number;
  startedAt?: Date;
  answeredAt?: Date;
  endedAt?: Date;
  provider: string;
  providerCallSid?: string;
  recordingUrl?: string;
  transcription?: string;
  notes?: string;
  cost?: number;
  tags?: string[];
}

export interface CallFilters {
  direction?: CallDirection;
  status?: CallStatus;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Log a new call. Auto-matches the phone number to a lead if possible.
 */
export async function logCall(db: Db, data: LogCallData): Promise<number> {
  // Try to match caller/called number to an existing lead
  let leadId: number | null = null;
  const matchNumber = data.direction === "inbound" ? data.callerNumber : data.calledNumber;

  try {
    const normalized = normalizePhoneNumber(matchNumber);
    const hash = hashPhoneNumber(normalized);
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.tenantId, data.tenantId), eq(leads.phoneHash, hash)))
      .limit(1);
    if (lead) leadId = lead.id;
  } catch {
    // Phone normalization may fail for unusual numbers — don't block logging
  }

  const row: InsertCallLog = {
    tenantId: data.tenantId,
    leadId,
    direction: data.direction,
    callerNumber: data.callerNumber,
    calledNumber: data.calledNumber,
    status: data.status ?? "ringing",
    duration: data.duration ?? 0,
    startedAt: data.startedAt ?? new Date(),
    answeredAt: data.answeredAt ?? null,
    endedAt: data.endedAt ?? null,
    provider: data.provider,
    providerCallSid: data.providerCallSid ?? null,
    recordingUrl: data.recordingUrl ?? null,
    transcription: data.transcription ?? null,
    notes: data.notes ?? null,
    cost: data.cost ?? null,
    tags: data.tags ?? null,
  };

  const [result] = await db.insert(callLogs).values(row);
  const callId = (result as any).insertId as number;

  // Emit events for automation triggers
  await emitCallEvent(data.tenantId, data.status ?? "ringing", {
    callId,
    leadId,
    direction: data.direction,
    callerNumber: data.callerNumber,
    calledNumber: data.calledNumber,
    provider: data.provider,
  });

  return callId;
}

/**
 * Update an existing call by provider SID (for multi-event webhooks: ringing → in_progress → completed).
 */
export async function updateCallStatus(
  db: Db,
  tenantId: number,
  providerCallSid: string,
  updates: Partial<Pick<InsertCallLog, "status" | "duration" | "answeredAt" | "endedAt" | "recordingUrl" | "transcription" | "cost">>
): Promise<boolean> {
  const result = await db
    .update(callLogs)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(callLogs.tenantId, tenantId), eq(callLogs.providerCallSid, providerCallSid)));

  const updated = (result as any).affectedRows > 0;

  // Emit event if status changed to a terminal state
  if (updated && updates.status) {
    const [call] = await db
      .select({ id: callLogs.id, leadId: callLogs.leadId, direction: callLogs.direction, callerNumber: callLogs.callerNumber, calledNumber: callLogs.calledNumber, provider: callLogs.provider })
      .from(callLogs)
      .where(and(eq(callLogs.tenantId, tenantId), eq(callLogs.providerCallSid, providerCallSid)))
      .limit(1);

    if (call) {
      await emitCallEvent(tenantId, updates.status, {
        callId: call.id,
        leadId: call.leadId,
        direction: call.direction,
        callerNumber: call.callerNumber,
        calledNumber: call.calledNumber,
        provider: call.provider,
      });
    }
  }

  return updated;
}

// ─── Aggregation Queries ─────────────────────────────────────────────────────

/**
 * KPI stats: total calls, avg duration, missed rate, inbound/outbound counts.
 */
export async function getCallStats(db: Db, tenantId: number, days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [stats] = await db
    .select({
      totalCalls: count(),
      avgDuration: sql<number>`COALESCE(AVG(CASE WHEN ${callLogs.status} = 'completed' THEN ${callLogs.duration} END), 0)`,
      totalInbound: sql<number>`SUM(CASE WHEN ${callLogs.direction} = 'inbound' THEN 1 ELSE 0 END)`,
      totalOutbound: sql<number>`SUM(CASE WHEN ${callLogs.direction} = 'outbound' THEN 1 ELSE 0 END)`,
      totalMissed: sql<number>`SUM(CASE WHEN ${callLogs.status} IN ('missed', 'no_answer', 'busy') THEN 1 ELSE 0 END)`,
      totalCompleted: sql<number>`SUM(CASE WHEN ${callLogs.status} = 'completed' THEN 1 ELSE 0 END)`,
    })
    .from(callLogs)
    .where(and(eq(callLogs.tenantId, tenantId), gte(callLogs.createdAt, since)));

  const total = stats?.totalCalls ?? 0;
  const inbound = Number(stats?.totalInbound ?? 0);
  const missed = Number(stats?.totalMissed ?? 0);

  return {
    totalCalls: total,
    avgDuration: Math.round(Number(stats?.avgDuration ?? 0)),
    missedRate: inbound > 0 ? Math.round((missed / inbound) * 100) : 0,
    totalInbound: inbound,
    totalOutbound: Number(stats?.totalOutbound ?? 0),
    totalMissed: missed,
    totalCompleted: Number(stats?.totalCompleted ?? 0),
  };
}

/**
 * Call volume by day for the area chart.
 */
export async function getCallsByDay(db: Db, tenantId: number, days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select({
      date: sql<string>`DATE(${callLogs.startedAt})`,
      inbound: sql<number>`SUM(CASE WHEN ${callLogs.direction} = 'inbound' THEN 1 ELSE 0 END)`,
      outbound: sql<number>`SUM(CASE WHEN ${callLogs.direction} = 'outbound' THEN 1 ELSE 0 END)`,
      missed: sql<number>`SUM(CASE WHEN ${callLogs.status} IN ('missed', 'no_answer', 'busy') THEN 1 ELSE 0 END)`,
    })
    .from(callLogs)
    .where(and(eq(callLogs.tenantId, tenantId), gte(callLogs.createdAt, since)))
    .groupBy(sql`DATE(${callLogs.startedAt})`)
    .orderBy(sql`DATE(${callLogs.startedAt})`);

  return rows.map((r) => ({
    date: String(r.date),
    inbound: Number(r.inbound),
    outbound: Number(r.outbound),
    missed: Number(r.missed),
  }));
}

/**
 * Call distribution by hour of day for the bar chart.
 */
export async function getCallsByHour(db: Db, tenantId: number, days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select({
      hour: sql<number>`HOUR(${callLogs.startedAt})`,
      count: count(),
    })
    .from(callLogs)
    .where(and(eq(callLogs.tenantId, tenantId), gte(callLogs.createdAt, since)))
    .groupBy(sql`HOUR(${callLogs.startedAt})`)
    .orderBy(sql`HOUR(${callLogs.startedAt})`);

  // Fill in all 24 hours
  const hourMap = new Map(rows.map((r) => [Number(r.hour), r.count]));
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourMap.get(h) ?? 0 }));
}

/**
 * Most active inbound callers.
 */
export async function getTopCallers(db: Db, tenantId: number, limit: number = 10) {
  const rows = await db
    .select({
      callerNumber: callLogs.callerNumber,
      callCount: count(),
      leadName: leads.name,
      leadId: leads.id,
    })
    .from(callLogs)
    .leftJoin(leads, and(eq(callLogs.leadId, leads.id), eq(callLogs.tenantId, leads.tenantId)))
    .where(and(eq(callLogs.tenantId, tenantId), eq(callLogs.direction, "inbound")))
    .groupBy(callLogs.callerNumber, leads.name, leads.id)
    .orderBy(desc(count()))
    .limit(limit);

  return rows.map((r) => ({
    callerNumber: r.callerNumber,
    callCount: r.callCount,
    leadName: r.leadName ?? null,
    leadId: r.leadId ?? null,
  }));
}

/**
 * Recent calls for the live feed.
 */
export async function getRecentCalls(db: Db, tenantId: number, limit: number = 20) {
  const rows = await db
    .select({
      id: callLogs.id,
      direction: callLogs.direction,
      callerNumber: callLogs.callerNumber,
      calledNumber: callLogs.calledNumber,
      status: callLogs.status,
      duration: callLogs.duration,
      provider: callLogs.provider,
      startedAt: callLogs.startedAt,
      endedAt: callLogs.endedAt,
      leadName: leads.name,
      leadId: leads.id,
    })
    .from(callLogs)
    .leftJoin(leads, and(eq(callLogs.leadId, leads.id), eq(callLogs.tenantId, leads.tenantId)))
    .where(eq(callLogs.tenantId, tenantId))
    .orderBy(desc(callLogs.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    direction: r.direction,
    callerNumber: r.callerNumber,
    calledNumber: r.calledNumber,
    status: r.status,
    duration: r.duration,
    provider: r.provider,
    startedAt: r.startedAt?.toISOString() ?? null,
    endedAt: r.endedAt?.toISOString() ?? null,
    leadName: r.leadName ?? null,
    leadId: r.leadId ?? null,
  }));
}

/**
 * Paginated call list with filters.
 */
export async function listCalls(db: Db, tenantId: number, filters: CallFilters = {}) {
  const { direction, status, search, dateFrom, dateTo, page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [eq(callLogs.tenantId, tenantId)];
  if (direction) conditions.push(eq(callLogs.direction, direction));
  if (status) conditions.push(eq(callLogs.status, status));
  if (dateFrom) conditions.push(gte(callLogs.createdAt, dateFrom));
  if (dateTo) conditions.push(sql`${callLogs.createdAt} <= ${dateTo}`);
  if (search) conditions.push(sql`(${callLogs.callerNumber} LIKE ${`%${search}%`} OR ${callLogs.calledNumber} LIKE ${`%${search}%`})`);

  const where = and(...conditions);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: callLogs.id,
        direction: callLogs.direction,
        callerNumber: callLogs.callerNumber,
        calledNumber: callLogs.calledNumber,
        status: callLogs.status,
        duration: callLogs.duration,
        provider: callLogs.provider,
        startedAt: callLogs.startedAt,
        endedAt: callLogs.endedAt,
        notes: callLogs.notes,
        leadName: leads.name,
        leadId: leads.id,
        createdAt: callLogs.createdAt,
      })
      .from(callLogs)
      .leftJoin(leads, and(eq(callLogs.leadId, leads.id), eq(callLogs.tenantId, leads.tenantId)))
      .where(where)
      .orderBy(desc(callLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(callLogs).where(where),
  ]);

  return {
    calls: rows.map((r) => ({
      id: r.id,
      direction: r.direction,
      callerNumber: r.callerNumber,
      calledNumber: r.calledNumber,
      status: r.status,
      duration: r.duration,
      provider: r.provider,
      startedAt: r.startedAt?.toISOString() ?? null,
      endedAt: r.endedAt?.toISOString() ?? null,
      notes: r.notes,
      leadName: r.leadName ?? null,
      leadId: r.leadId ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    total: totalRow?.total ?? 0,
    page,
    limit,
    totalPages: Math.ceil((totalRow?.total ?? 0) / limit),
  };
}

// ─── Event Emission ──────────────────────────────────────────────────────────

async function emitCallEvent(tenantId: number, status: string, data: Record<string, unknown>) {
  const eventType = status === "missed" || status === "no_answer" || status === "busy"
    ? "call.missed"
    : status === "completed"
      ? "call.completed"
      : status === "voicemail"
        ? "call.voicemail"
        : null;

  if (eventType) {
    await emitEvent({
      id: randomUUID(),
      type: eventType as any,
      tenantId,
      data,
      timestamp: new Date(),
    });
  }
}
