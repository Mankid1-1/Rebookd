/**
 * Lead Segment Service
 *
 * Manages lead segments (groups) for targeted automation and organization.
 * Supports both manual and automatic (rule-based) segments.
 */

import { eq, and, sql, inArray } from "drizzle-orm";
import {
  leadSegments,
  leadSegmentMembers,
  leads,
  type LeadSegment,
  type Lead,
} from "../../drizzle/schema";
import type { Db } from "../_core/context";
import { evaluateConditions, type ConditionGroup } from "./conditions-engine.service";

// ─── CRUD ──────────────────────────────────────────────────────────────────────

export async function createSegment(
  db: Db,
  tenantId: number,
  data: {
    name: string;
    description?: string;
    color?: string;
    rules?: ConditionGroup;
    isAutomatic?: boolean;
  }
) {
  const [result] = await db.insert(leadSegments).values({
    tenantId,
    name: data.name,
    description: data.description,
    color: data.color,
    rules: data.rules as any,
    isAutomatic: data.isAutomatic ?? false,
  }).$returningId();

  // If automatic, evaluate immediately
  if (data.isAutomatic && data.rules) {
    await evaluateAutomaticSegment(db, tenantId, result.id, data.rules);
  }

  return result;
}

export async function updateSegment(
  db: Db,
  tenantId: number,
  segmentId: number,
  data: {
    name?: string;
    description?: string;
    color?: string;
    rules?: ConditionGroup;
    isAutomatic?: boolean;
  }
) {
  await db
    .update(leadSegments)
    .set(data as any)
    .where(and(eq(leadSegments.id, segmentId), eq(leadSegments.tenantId, tenantId)));

  // Re-evaluate if automatic
  if (data.isAutomatic && data.rules) {
    await evaluateAutomaticSegment(db, tenantId, segmentId, data.rules);
  }
}

export async function deleteSegment(db: Db, tenantId: number, segmentId: number) {
  await db.delete(leadSegmentMembers).where(eq(leadSegmentMembers.segmentId, segmentId));
  await db
    .delete(leadSegments)
    .where(and(eq(leadSegments.id, segmentId), eq(leadSegments.tenantId, tenantId)));
}

export async function listSegments(db: Db, tenantId: number) {
  const segments = await db
    .select()
    .from(leadSegments)
    .where(eq(leadSegments.tenantId, tenantId))
    .orderBy(leadSegments.name);

  // Get member counts
  const counts = await db
    .select({
      segmentId: leadSegmentMembers.segmentId,
      count: sql<number>`COUNT(*)`,
    })
    .from(leadSegmentMembers)
    .where(
      inArray(
        leadSegmentMembers.segmentId,
        segments.map((s) => s.id)
      )
    )
    .groupBy(leadSegmentMembers.segmentId);

  const countMap = new Map(counts.map((c) => [c.segmentId, c.count]));

  return segments.map((s) => ({
    ...s,
    memberCount: countMap.get(s.id) || 0,
  }));
}

export async function getSegment(db: Db, tenantId: number, segmentId: number) {
  const [segment] = await db
    .select()
    .from(leadSegments)
    .where(and(eq(leadSegments.id, segmentId), eq(leadSegments.tenantId, tenantId)))
    .limit(1);
  return segment;
}

// ─── Membership ────────────────────────────────────────────────────────────────

export async function getLeadsInSegment(
  db: Db,
  segmentId: number,
  limit: number = 100,
  offset: number = 0
) {
  return db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      email: leads.email,
      status: leads.status,
      source: leads.source,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .innerJoin(leadSegmentMembers, eq(leads.id, leadSegmentMembers.leadId))
    .where(eq(leadSegmentMembers.segmentId, segmentId))
    .orderBy(leads.createdAt)
    .limit(limit)
    .offset(offset);
}

export async function addToSegment(db: Db, segmentId: number, leadIds: number[]) {
  if (leadIds.length === 0) return;

  // Batch insert, skip existing
  const values = leadIds.map((leadId) => ({ segmentId, leadId }));
  for (const v of values) {
    try {
      await db.insert(leadSegmentMembers).values(v);
    } catch {
      // Duplicate — skip
    }
  }
}

export async function removeFromSegment(db: Db, segmentId: number, leadIds: number[]) {
  if (leadIds.length === 0) return;

  for (const leadId of leadIds) {
    await db
      .delete(leadSegmentMembers)
      .where(
        and(
          eq(leadSegmentMembers.segmentId, segmentId),
          eq(leadSegmentMembers.leadId, leadId)
        )
      );
  }
}

// ─── Automatic Segment Evaluation ──────────────────────────────────────────────

export async function evaluateAutomaticSegment(
  db: Db,
  tenantId: number,
  segmentId: number,
  rules: ConditionGroup
) {
  // Get all tenant leads
  const allLeads = await db
    .select()
    .from(leads)
    .where(eq(leads.tenantId, tenantId));

  // Evaluate each lead against rules
  const matchingIds: number[] = [];
  for (const lead of allLeads) {
    if (evaluateConditions(lead, rules)) {
      matchingIds.push(lead.id);
    }
  }

  // Clear existing members and re-populate
  await db.delete(leadSegmentMembers).where(eq(leadSegmentMembers.segmentId, segmentId));

  if (matchingIds.length > 0) {
    await addToSegment(db, segmentId, matchingIds);
  }

  return { evaluated: allLeads.length, matched: matchingIds.length };
}

/**
 * Re-evaluate all automatic segments for a tenant.
 * Called when leads change (status update, new lead, etc.)
 */
export async function reevaluateAllAutoSegments(db: Db, tenantId: number) {
  const autoSegments = await db
    .select()
    .from(leadSegments)
    .where(and(eq(leadSegments.tenantId, tenantId), eq(leadSegments.isAutomatic, true)));

  for (const segment of autoSegments) {
    if (segment.rules) {
      await evaluateAutomaticSegment(db, tenantId, segment.id, segment.rules as ConditionGroup);
    }
  }
}
