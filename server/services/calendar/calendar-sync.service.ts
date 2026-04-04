/**
 * Calendar Sync Service
 *
 * Orchestrates syncing events from external calendars, detecting
 * cancellations (→ flurry), new bookings, and feeding gaps into
 * the smart-scheduling service.
 */

import { eq, and, sql, gte, lte } from "drizzle-orm";
import {
  calendarConnections,
  calendarEvents,
  calendarSyncLog,
  leads,
  type CalendarConnection,
} from "../../../drizzle/schema";
import type { Db } from "../../_core/context";
import type { CalendarProvider, ExternalCalendarEvent } from "./calendar-provider.interface";
import { GoogleCalendarProvider } from "./google-calendar.provider";
import { OutlookCalendarProvider } from "./outlook-calendar.provider";
import { CalDAVCalendarProvider } from "./caldav-calendar.provider";
import { CalendlyProvider } from "./calendly.provider";
import { AcuityProvider } from "./acuity.provider";
import { emitEvent } from "../event-bus.service";
import { createLead } from "../lead.service";
import { encrypt, decrypt, encryptIfNeeded } from "../../_core/crypto";
import { hashPhoneNumber, normalizePhoneNumber, hashEmail } from "../../_core/phone";

// Provider registry
const providers: Record<string, CalendarProvider> = {
  google: new GoogleCalendarProvider(),
  outlook: new OutlookCalendarProvider(),
  caldav: new CalDAVCalendarProvider(),
  calendly: new CalendlyProvider(),
  acuity: new AcuityProvider(),
};

export function getProvider(name: string): CalendarProvider {
  const p = providers[name];
  if (!p) throw new Error(`Unknown calendar provider: ${name}`);
  return p;
}

/** List all connections for a tenant */
export async function listConnections(db: Db, tenantId: number) {
  return db
    .select({
      id: calendarConnections.id,
      provider: calendarConnections.provider,
      label: calendarConnections.label,
      syncEnabled: calendarConnections.syncEnabled,
      lastSyncAt: calendarConnections.lastSyncAt,
      syncIntervalMinutes: calendarConnections.syncIntervalMinutes,
      createdAt: calendarConnections.createdAt,
    })
    .from(calendarConnections)
    .where(eq(calendarConnections.tenantId, tenantId));
}

/** Save a new calendar connection after OAuth */
export async function saveConnection(
  db: Db,
  tenantId: number,
  data: {
    provider: "google" | "outlook" | "caldav" | "calendly" | "acuity";
    accessToken: string;
    refreshToken: string | null;
    externalCalendarId: string;
    externalAccountId: string;
    label: string;
    tokenExpiresAt: Date | null;
    metadata?: Record<string, unknown>;
  }
) {
  const [result] = await db.insert(calendarConnections).values({
    tenantId,
    provider: data.provider,
    label: data.label,
    accessToken: data.accessToken ? encrypt(data.accessToken) : null,
    refreshToken: data.refreshToken ? encrypt(data.refreshToken) : null,
    externalCalendarId: data.externalCalendarId,
    externalAccountId: data.externalAccountId,
    syncEnabled: true,
    tokenExpiresAt: data.tokenExpiresAt,
    metadata: data.metadata,
  }).$returningId();

  return result;
}

/** Disconnect a calendar */
export async function disconnectCalendar(db: Db, tenantId: number, connectionId: number) {
  const [conn] = await db
    .select()
    .from(calendarConnections)
    .where(and(eq(calendarConnections.id, connectionId), eq(calendarConnections.tenantId, tenantId)))
    .limit(1);

  if (!conn) throw new Error("Calendar connection not found");

  const provider = getProvider(conn.provider);
  try {
    const tokenDecrypted = conn.accessToken ? decrypt(conn.accessToken) : "";
    await provider.revokeAccess(tokenDecrypted);
  } catch {
    // Best effort revoke
  }

  await db
    .delete(calendarEvents)
    .where(eq(calendarEvents.calendarConnectionId, connectionId));

  await db
    .delete(calendarConnections)
    .where(and(eq(calendarConnections.id, connectionId), eq(calendarConnections.tenantId, tenantId)));
}

/** Sync a single calendar connection */
export async function syncCalendar(
  db: Db,
  connectionId: number
): Promise<{ success: boolean; eventsProcessed: number; error?: string }> {
  // Get connection
  const [conn] = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.id, connectionId))
    .limit(1);

  if (!conn || !conn.syncEnabled) {
    return { success: false, eventsProcessed: 0, error: "Connection not found or disabled" };
  }

  // Create sync log entry
  const [logEntry] = await db.insert(calendarSyncLog).values({
    calendarConnectionId: connectionId,
    syncType: conn.lastSyncAt ? "incremental" : "full",
    status: "running",
  }).$returningId();

  const logId = logEntry.id;
  const errors: Array<{ message: string; eventId?: string }> = [];
  let eventsCreated = 0;
  let eventsUpdated = 0;
  let eventsCancelled = 0;

  try {
    const provider = getProvider(conn.provider);

    // Decrypt stored tokens and refresh if needed
    let accessToken = conn.accessToken ? decrypt(conn.accessToken) : "";
    const refreshTokenDecrypted = conn.refreshToken ? decrypt(conn.refreshToken) : "";
    if (conn.tokenExpiresAt && conn.tokenExpiresAt < new Date() && refreshTokenDecrypted) {
      const refreshed = await provider.refreshAccessToken(refreshTokenDecrypted);
      accessToken = refreshed.accessToken;
      await db
        .update(calendarConnections)
        .set({
          accessToken: encrypt(refreshed.accessToken), // Re-encrypt new token
          tokenExpiresAt: refreshed.expiresAt,
        })
        .where(eq(calendarConnections.id, connectionId));
    }

    // Fetch events (last 7 days to 30 days ahead for incremental)
    const since = conn.lastSyncAt
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const externalEvents = await provider.fetchEvents(
      accessToken,
      conn.externalCalendarId || "",
      since,
      until
    );

    // Get existing events for comparison
    const existingEvents = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.calendarConnectionId, connectionId));

    const existingMap = new Map(existingEvents.map((e) => [e.externalEventId, e]));

    for (const ext of externalEvents) {
      try {
        const existing = existingMap.get(ext.externalEventId);

        // Try to match attendee to a lead, or auto-create one
        let leadId = await matchEventToLead(db, conn.tenantId, ext);

        // Auto-create lead from calendar attendee if no match exists
        if (!leadId && ext.attendeePhone && ext.status !== "cancelled") {
          try {
            const result = await createLead(db, {
              tenantId: conn.tenantId,
              phone: ext.attendeePhone,
              name: ext.attendeeName || undefined,
              email: ext.attendeeEmail || undefined,
              source: "calendar_sync",
            });
            if (result.success && !result.duplicate) {
              // Re-match to get the new lead's ID
              leadId = await matchEventToLead(db, conn.tenantId, ext);
            }
          } catch {
            // Non-fatal: don't let lead creation break calendar sync
          }
        }

        // ── Encrypt attendee PII before persisting ──────────────────
        const encName = ext.attendeeName ? encryptIfNeeded(ext.attendeeName) : null;
        const encEmail = ext.attendeeEmail ? encryptIfNeeded(ext.attendeeEmail) : null;
        const encPhone = ext.attendeePhone ? encryptIfNeeded(ext.attendeePhone) : null;

        if (existing) {
          // Check for status changes (cancellation detection)
          const wasCancelled = existing.status !== "cancelled" && ext.status === "cancelled";

          await db
            .update(calendarEvents)
            .set({
              title: ext.title,
              startTime: ext.startTime,
              endTime: ext.endTime,
              status: ext.status,
              attendeeName: encName,
              attendeeEmail: encEmail,
              attendeePhone: encPhone,
              leadId,
              location: ext.location,
              metadata: ext.metadata,
              syncedAt: new Date(),
            })
            .where(eq(calendarEvents.id, existing.id));

          eventsUpdated++;

          // Emit cancellation event for flurry triggers
          if (wasCancelled) {
            eventsCancelled++;
            await emitEvent({
              type: "appointment.cancelled",
              tenantId: conn.tenantId,
              data: {
                source: "calendar_sync",
                calendarProvider: conn.provider,
                eventTitle: ext.title,
                startTime: ext.startTime.toISOString(),
                endTime: ext.endTime.toISOString(),
                attendeeEmail: ext.attendeeEmail,
                attendeePhone: ext.attendeePhone,
                leadId,
              },
              timestamp: new Date(),
            });

            // Open the slot for the waiting list — triggers cancellation_flurry
            await emitEvent({
              type: "waitlist.slot_opened" as any,
              tenantId: conn.tenantId,
              data: {
                source: "calendar_sync",
                leadId,
                appointmentTime: ext.startTime.toISOString(),
                date: ext.startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
                time: ext.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              },
              timestamp: new Date(),
            });
          }

          // Detect rescheduling: time changed but still confirmed
          const wasRescheduled = existing.status === "confirmed" && ext.status === "confirmed" &&
            (existing.startTime.getTime() !== ext.startTime.getTime() || existing.endTime.getTime() !== ext.endTime.getTime());
          if (wasRescheduled && leadId) {
            await emitEvent({
              type: "appointment.rescheduled" as any,
              tenantId: conn.tenantId,
              data: {
                source: "calendar_sync",
                leadId,
                oldStartTime: existing.startTime.toISOString(),
                newStartTime: ext.startTime.toISOString(),
                attendeePhone: ext.attendeePhone,
                attendeeName: ext.attendeeName,
              },
              timestamp: new Date(),
            });
          }
        } else {
          // New event — attendee PII encrypted before storage
          await db.insert(calendarEvents).values({
            tenantId: conn.tenantId,
            calendarConnectionId: connectionId,
            externalEventId: ext.externalEventId,
            title: ext.title,
            startTime: ext.startTime,
            endTime: ext.endTime,
            status: ext.status,
            attendeeName: encName,
            attendeeEmail: encEmail,
            attendeePhone: encPhone,
            leadId,
            location: ext.location,
            metadata: ext.metadata,
          });

          eventsCreated++;

          // Emit booking event
          if (ext.status === "confirmed") {
            await emitEvent({
              type: "appointment.booked",
              tenantId: conn.tenantId,
              data: {
                source: "calendar_sync",
                calendarProvider: conn.provider,
                eventTitle: ext.title,
                startTime: ext.startTime.toISOString(),
                endTime: ext.endTime.toISOString(),
                attendeeEmail: ext.attendeeEmail,
                attendeePhone: ext.attendeePhone,
                leadId,
              },
              timestamp: new Date(),
            });
          }
        }
      } catch (err) {
        errors.push({
          message: err instanceof Error ? err.message : String(err),
          eventId: ext.externalEventId,
        });
      }
    }

    // Update connection last sync time
    await db
      .update(calendarConnections)
      .set({ lastSyncAt: new Date() })
      .where(eq(calendarConnections.id, connectionId));

    // Update sync log
    await db
      .update(calendarSyncLog)
      .set({
        status: errors.length > 0 ? "failed" : "success",
        eventsProcessed: externalEvents.length,
        eventsCreated,
        eventsUpdated,
        eventsCancelled,
        errors: errors.length > 0 ? errors : null,
        completedAt: new Date(),
      })
      .where(eq(calendarSyncLog.id, logId));

    return { success: true, eventsProcessed: externalEvents.length };
  } catch (err) {
    await db
      .update(calendarSyncLog)
      .set({
        status: "failed",
        errors: [{ message: err instanceof Error ? err.message : String(err) }],
        completedAt: new Date(),
      })
      .where(eq(calendarSyncLog.id, logId));

    return {
      success: false,
      eventsProcessed: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Match calendar event attendee to an existing lead via phoneHash (encrypted-safe) */
async function matchEventToLead(
  db: Db,
  tenantId: number,
  event: ExternalCalendarEvent
): Promise<number | null> {
  if (!event.attendeePhone && !event.attendeeEmail) return null;

  // Try phone match via hash (most reliable — works with encrypted phone storage)
  if (event.attendeePhone) {
    try {
      const normalized = normalizePhoneNumber(event.attendeePhone);
      const hash = hashPhoneNumber(normalized);
      const [lead] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.tenantId, tenantId), eq(leads.phoneHash, hash)))
        .limit(1);
      if (lead) return lead.id;
    } catch {
      // Phone normalization failed — try direct encrypted match as fallback
    }
  }

  // Try email match via deterministic hash (encrypted values are non-deterministic)
  if (event.attendeeEmail) {
    const eHash = hashEmail(event.attendeeEmail);
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), eq(leads.emailHash, eHash)))
      .limit(1);
    if (lead) return lead.id;
  }

  return null;
}

/** Get calendar events for a tenant within a date range (decrypts PII) */
export async function getCalendarEvents(
  db: Db,
  tenantId: number,
  start: Date,
  end: Date
) {
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.tenantId, tenantId),
        gte(calendarEvents.startTime, start),
        lte(calendarEvents.endTime, end)
      )
    )
    .orderBy(calendarEvents.startTime);

  // Decrypt attendee PII for display
  return rows.map((row) => ({
    ...row,
    attendeeName: row.attendeeName ? decrypt(row.attendeeName) : null,
    attendeeEmail: row.attendeeEmail ? decrypt(row.attendeeEmail) : null,
    attendeePhone: row.attendeePhone ? decrypt(row.attendeePhone) : null,
  }));
}

/** Get calendar gaps for smart scheduling integration */
export async function getCalendarGaps(
  db: Db,
  tenantId: number,
  start: Date,
  end: Date,
  gapThresholdMinutes: number = 30
): Promise<Array<{ startTime: Date; endTime: Date; duration: number }>> {
  const events = await db
    .select({
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
    })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.tenantId, tenantId),
        eq(calendarEvents.status, "confirmed"),
        gte(calendarEvents.startTime, start),
        lte(calendarEvents.endTime, end)
      )
    )
    .orderBy(calendarEvents.startTime);

  const gaps: Array<{ startTime: Date; endTime: Date; duration: number }> = [];

  for (let i = 0; i < events.length - 1; i++) {
    const currentEnd = events[i].endTime;
    const nextStart = events[i + 1].startTime;
    const durationMin = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60);

    if (durationMin >= gapThresholdMinutes) {
      gaps.push({
        startTime: currentEnd,
        endTime: nextStart,
        duration: durationMin,
      });
    }
  }

  return gaps;
}

/** Get sync history for a connection */
export async function getSyncHistory(db: Db, connectionId: number, limit: number = 20) {
  return db
    .select()
    .from(calendarSyncLog)
    .where(eq(calendarSyncLog.calendarConnectionId, connectionId))
    .orderBy(sql`${calendarSyncLog.startedAt} DESC`)
    .limit(limit);
}

/** Sync all due connections (called by cron job) */
export async function syncAllDueConnections(db: Db) {
  const dueConnections = await db
    .select()
    .from(calendarConnections)
    .where(
      and(
        eq(calendarConnections.syncEnabled, true),
        sql`(${calendarConnections.lastSyncAt} IS NULL OR ${calendarConnections.lastSyncAt} < DATE_SUB(NOW(), INTERVAL ${calendarConnections.syncIntervalMinutes} MINUTE))`
      )
    );

  console.log(`[CalendarSync] ${dueConnections.length} connections due for sync`);

  const results = [];
  for (const conn of dueConnections) {
    try {
      const result = await syncCalendar(db, conn.id);
      results.push({ connectionId: conn.id, ...result });
    } catch (err) {
      results.push({
        connectionId: conn.id,
        success: false,
        eventsProcessed: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}
