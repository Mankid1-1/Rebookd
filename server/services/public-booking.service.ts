/**
 * PUBLIC BOOKING SERVICE
 *
 * Handles slot availability calculation and public booking creation
 * for the customer-facing booking page.
 */

import { eq, and, ne, gte, lte } from "drizzle-orm";
import {
  bookingPages,
  publicBookings,
  calendarEvents,
  leads,
} from "../../drizzle/schema";
import type { Db } from "../_core/context";
import { logger } from "../_core/logger";
import { sendSMS } from "../_core/sms";
import { normalizePhoneNumber, hashPhoneNumber } from "../_core/phone";
import { encryptIfNeeded } from "../_core/crypto";
import * as BookingPageService from "./booking-page.service";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TimeSlot {
  start: string; // ISO 8601
  end: string;   // ISO 8601
}

// ─── Slot Generation ────────────────────────────────────────────────────────

/**
 * Convert "HH:MM" to minutes since midnight.
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Build a Date from a date string (YYYY-MM-DD) and minutes-since-midnight.
 */
function dateFromMinutes(dateStr: string, minutes: number): Date {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Get available time slots for a specific date on a booking page.
 *
 * 1. Load booking page config (businessHours, slotDuration, buffer)
 * 2. Get the day-of-week for the date
 * 3. Get business hours for that day
 * 4. Generate all possible slots based on slotDuration + buffer
 * 5. Query calendarEvents for that date range (status != 'cancelled')
 * 6. Query publicBookings for that date range (status != 'cancelled')
 * 7. Filter out occupied slots
 * 8. Return available slots
 */
export async function getAvailableSlots(
  db: Db,
  bookingPageId: number,
  date: string, // YYYY-MM-DD
): Promise<TimeSlot[]> {
  const page = await BookingPageService.getBookingPageById(db, bookingPageId);
  if (!page || !page.enabled) return [];

  // Determine day-of-week
  const dateObj = new Date(`${date}T12:00:00`);
  const dayName = DAY_NAMES[dateObj.getDay()];

  // Get business hours for that day
  const hours = page.businessHours as Record<string, { start: string; end: string } | null> | null;
  if (!hours) return [];
  const dayHours = hours[dayName];
  if (!dayHours) return []; // Closed on that day

  const slotDuration = page.slotDurationMinutes;
  const buffer = page.bufferMinutes;
  const step = slotDuration + buffer;

  // Generate all possible slots
  const startMin = timeToMinutes(dayHours.start);
  const endMin = timeToMinutes(dayHours.end);
  const allSlots: TimeSlot[] = [];

  for (let m = startMin; m + slotDuration <= endMin; m += step) {
    const slotStart = dateFromMinutes(date, m);
    const slotEnd = dateFromMinutes(date, m + slotDuration);
    allSlots.push({
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
    });
  }

  if (allSlots.length === 0) return [];

  // Date range for queries
  const dayStart = dateFromMinutes(date, startMin);
  const dayEnd = dateFromMinutes(date, endMin);

  // Fetch occupied calendar events (confirmed/tentative)
  const calEvents = await db
    .select({ startTime: calendarEvents.startTime, endTime: calendarEvents.endTime })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.tenantId, page.tenantId),
        ne(calendarEvents.status, "cancelled"),
        gte(calendarEvents.startTime, dayStart),
        lte(calendarEvents.endTime, dayEnd),
      ),
    );

  // Fetch existing bookings (not cancelled)
  const existingBookings = await db
    .select({ slotStart: publicBookings.slotStart, slotEnd: publicBookings.slotEnd })
    .from(publicBookings)
    .where(
      and(
        eq(publicBookings.bookingPageId, bookingPageId),
        ne(publicBookings.status, "cancelled"),
        gte(publicBookings.slotStart, dayStart),
        lte(publicBookings.slotEnd, dayEnd),
      ),
    );

  // Combine occupied ranges
  const occupied = [
    ...calEvents.map((e) => ({ start: e.startTime.getTime(), end: e.endTime.getTime() })),
    ...existingBookings.map((b) => ({ start: b.slotStart.getTime(), end: b.slotEnd.getTime() })),
  ];

  // Filter out slots that overlap with occupied ranges
  const available = allSlots.filter((slot) => {
    const slotStartMs = new Date(slot.start).getTime();
    const slotEndMs = new Date(slot.end).getTime();
    return !occupied.some(
      (occ) => slotStartMs < occ.end && slotEndMs > occ.start,
    );
  });

  return available;
}

// ─── Booking Creation ───────────────────────────────────────────────────────

/**
 * Create a booking on the public booking page.
 *
 * 1. Re-check slot availability
 * 2. Find or create lead by phone (phoneHash matching)
 * 3. Insert publicBookings row
 * 4. Send confirmation SMS to client
 * 5. Return booking record
 */
export async function createBooking(
  db: Db,
  tenantId: number,
  bookingPageId: number,
  clientInfo: {
    name: string;
    phone: string;
    email?: string;
  },
  slot: {
    start: string; // ISO 8601
    end: string;
    serviceName?: string;
  },
  source: "sms_link" | "direct" | "qr_code" | "website" = "direct",
) {
  // 1. Re-check availability
  const slotDate = slot.start.slice(0, 10); // YYYY-MM-DD
  const available = await getAvailableSlots(db, bookingPageId, slotDate);
  const isAvailable = available.some(
    (s) => s.start === slot.start && s.end === slot.end,
  );

  if (!isAvailable) {
    logger.warn("Slot no longer available", { tenantId, bookingPageId, slot });
    return { success: false as const, error: "slot_unavailable" };
  }

  // 2. Find or create lead by phone
  const normalizedPhone = normalizePhoneNumber(clientInfo.phone);
  const phoneHash = hashPhoneNumber(normalizedPhone);

  let [existingLead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.tenantId, tenantId), eq(leads.phoneHash, phoneHash)))
    .limit(1);

  let leadId: number;
  if (existingLead) {
    leadId = existingLead.id;
    // Update name/email if provided and lead exists
    const updates: Record<string, any> = {};
    if (clientInfo.name) updates.name = encryptIfNeeded(clientInfo.name);
    if (clientInfo.email) updates.email = encryptIfNeeded(clientInfo.email);
    if (Object.keys(updates).length > 0) {
      await db.update(leads).set(updates).where(eq(leads.id, leadId));
    }
  } else {
    const [inserted] = await db
      .insert(leads)
      .values({
        tenantId,
        phone: encryptIfNeeded(normalizedPhone) ?? "",
        phoneHash,
        name: encryptIfNeeded(clientInfo.name) ?? undefined,
        email: encryptIfNeeded(clientInfo.email) ?? undefined,
        source: "booking_page",
        status: "booked",
      })
      .$returningId();
    leadId = inserted.id;
  }

  // 3. Insert booking
  const slotStart = new Date(slot.start);
  const slotEnd = new Date(slot.end);

  const [bookingResult] = await db
    .insert(publicBookings)
    .values({
      tenantId,
      bookingPageId,
      leadId,
      clientName: clientInfo.name,
      clientPhone: normalizedPhone,
      clientEmail: clientInfo.email,
      serviceName: slot.serviceName,
      slotStart,
      slotEnd,
      status: "confirmed",
      source,
      confirmationSentAt: new Date(),
    })
    .$returningId();

  // 4. Send confirmation SMS
  const page = await BookingPageService.getBookingPageById(db, bookingPageId);
  const confirmMsg =
    page?.confirmationMessage ??
    `Your appointment is confirmed for ${slotStart.toLocaleDateString()} at ${slotStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. See you then!`;

  try {
    await sendSMS(normalizedPhone, confirmMsg, undefined, tenantId);
  } catch (err) {
    logger.error("Failed to send booking confirmation SMS", { err, tenantId, leadId });
  }

  logger.info("Public booking created", {
    tenantId,
    bookingPageId,
    bookingId: bookingResult.id,
    leadId,
    slotStart: slot.start,
  });

  // 5. Return booking
  const [booking] = await db
    .select()
    .from(publicBookings)
    .where(eq(publicBookings.id, bookingResult.id))
    .limit(1);

  return { success: true as const, booking };
}

// ─── Booking Cancellation ─────────────────────────────────────────────────

/**
 * Cancel a booking. Verifies that the provided phone matches the
 * clientPhone on the booking record to prevent unauthorized cancellations.
 */
export async function cancelBooking(
  db: Db,
  bookingId: number,
  phone: string,
): Promise<{ success: boolean; error?: string }> {
  const normalizedPhone = normalizePhoneNumber(phone);

  const [booking] = await db
    .select({
      id: publicBookings.id,
      clientPhone: publicBookings.clientPhone,
      status: publicBookings.status,
      tenantId: publicBookings.tenantId,
    })
    .from(publicBookings)
    .where(eq(publicBookings.id, bookingId))
    .limit(1);

  if (!booking) {
    return { success: false, error: "booking_not_found" };
  }

  if (booking.status === "cancelled") {
    return { success: false, error: "already_cancelled" };
  }

  // Verify phone matches
  if (booking.clientPhone !== normalizedPhone) {
    logger.warn("Cancel booking phone mismatch", {
      bookingId,
      expected: booking.clientPhone?.slice(0, 4) + "...",
    });
    return { success: false, error: "phone_mismatch" };
  }

  await db
    .update(publicBookings)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(publicBookings.id, bookingId));

  logger.info("Public booking cancelled", {
    bookingId,
    tenantId: booking.tenantId,
  });

  return { success: true };
}
