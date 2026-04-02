/**
 * BOOKING PAGE SERVICE
 *
 * CRUD for the public booking page configuration.
 * Each tenant gets one booking page with a unique slug that clients
 * can visit to self-book appointments.
 */

import { eq, and, desc, sql, count } from "drizzle-orm";
import { bookingPages, publicBookings, tenants } from "../../drizzle/schema";
import type { Db } from "../_core/context";
import { logger } from "../_core/logger";

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

async function ensureUniqueSlug(db: Db, baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let attempt = 0;
  while (attempt < 20) {
    const [existing] = await db
      .select({ id: bookingPages.id })
      .from(bookingPages)
      .where(eq(bookingPages.slug, slug))
      .limit(1);
    if (!existing) return slug;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }
  // Fallback: append timestamp
  return `${baseSlug}-${Date.now()}`;
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function createBookingPage(
  db: Db,
  tenantId: number,
  data: {
    title: string;
    description?: string;
    services?: Array<{ name: string; durationMinutes: number; price?: number }>;
    businessHours?: Record<string, { start: string; end: string } | null>;
    slotDurationMinutes?: number;
    bufferMinutes?: number;
    maxAdvanceDays?: number;
    brandColor?: string;
    logoUrl?: string;
    confirmationMessage?: string;
    calendarConnectionId?: number;
  },
) {
  // Get tenant name for slug generation
  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const baseSlug = slugify(tenant?.name ?? `tenant-${tenantId}`);
  const slug = await ensureUniqueSlug(db, baseSlug);

  const [result] = await db.insert(bookingPages).values({
    tenantId,
    slug,
    title: data.title,
    description: data.description,
    services: data.services ?? [],
    businessHours: data.businessHours ?? null,
    slotDurationMinutes: data.slotDurationMinutes ?? 30,
    bufferMinutes: data.bufferMinutes ?? 0,
    maxAdvanceDays: data.maxAdvanceDays ?? 30,
    brandColor: data.brandColor,
    logoUrl: data.logoUrl,
    confirmationMessage: data.confirmationMessage,
    calendarConnectionId: data.calendarConnectionId,
  }).$returningId();

  logger.info("Booking page created", { tenantId, slug, id: result.id });

  return getBookingPage(db, tenantId);
}

export async function getBookingPage(db: Db, tenantId: number) {
  const [page] = await db
    .select()
    .from(bookingPages)
    .where(eq(bookingPages.tenantId, tenantId))
    .limit(1);
  return page ?? null;
}

export async function getBookingPageBySlug(db: Db, slug: string) {
  const [page] = await db
    .select()
    .from(bookingPages)
    .where(and(eq(bookingPages.slug, slug), eq(bookingPages.enabled, true)))
    .limit(1);
  return page ?? null;
}

export async function getBookingPageById(db: Db, bookingPageId: number) {
  const [page] = await db
    .select()
    .from(bookingPages)
    .where(eq(bookingPages.id, bookingPageId))
    .limit(1);
  return page ?? null;
}

export async function updateBookingPage(
  db: Db,
  tenantId: number,
  id: number,
  data: Partial<{
    title: string;
    description: string;
    services: Array<{ name: string; durationMinutes: number; price?: number }>;
    businessHours: Record<string, { start: string; end: string } | null>;
    slotDurationMinutes: number;
    bufferMinutes: number;
    maxAdvanceDays: number;
    brandColor: string;
    logoUrl: string;
    confirmationMessage: string;
    calendarConnectionId: number;
    enabled: boolean;
  }>,
) {
  await db
    .update(bookingPages)
    .set(data)
    .where(and(eq(bookingPages.id, id), eq(bookingPages.tenantId, tenantId)));

  logger.info("Booking page updated", { tenantId, id });
  return getBookingPage(db, tenantId);
}

export async function listBookings(
  db: Db,
  tenantId: number,
  opts?: { page?: number; limit?: number; status?: string },
) {
  const limit = opts?.limit ?? 20;
  const page = opts?.page ?? 1;

  const conditions = [eq(publicBookings.tenantId, tenantId)];
  if (opts?.status) {
    conditions.push(eq(publicBookings.status, opts.status as any));
  }

  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(publicBookings)
    .where(and(...conditions));

  const rows = await db
    .select()
    .from(publicBookings)
    .where(and(...conditions))
    .orderBy(desc(publicBookings.slotStart))
    .limit(limit)
    .offset((page - 1) * limit);

  return {
    bookings: rows,
    total: Number(countRow?.count ?? 0),
  };
}

// ─── Metrics ──────────────────────────────────────────────────────────────

export async function getMetrics(db: Db, tenantId: number) {
  // Total bookings
  const [totalRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(publicBookings)
    .where(eq(publicBookings.tenantId, tenantId));
  const totalBookings = Number(totalRow?.count ?? 0);

  // Cancellation count
  const [cancelledRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(publicBookings)
    .where(and(eq(publicBookings.tenantId, tenantId), eq(publicBookings.status, "cancelled")));
  const cancelledBookings = Number(cancelledRow?.count ?? 0);

  // Bookings by source
  const bySource = await db
    .select({
      source: publicBookings.source,
      count: sql<number>`COUNT(*)`,
    })
    .from(publicBookings)
    .where(eq(publicBookings.tenantId, tenantId))
    .groupBy(publicBookings.source);

  // Bookings by status
  const byStatus = await db
    .select({
      status: publicBookings.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(publicBookings)
    .where(eq(publicBookings.tenantId, tenantId))
    .groupBy(publicBookings.status);

  const cancellationRate = totalBookings > 0 ? cancelledBookings / totalBookings : 0;

  return {
    totalBookings,
    cancelledBookings,
    cancellationRate: Math.round(cancellationRate * 10000) / 100, // e.g. 12.34%
    bySource: bySource.map((r) => ({ source: r.source, count: Number(r.count) })),
    byStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
  };
}
