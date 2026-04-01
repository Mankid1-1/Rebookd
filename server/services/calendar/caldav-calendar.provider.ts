/**
 * CalDAV Calendar Provider (Apple Calendar / iCloud)
 *
 * Uses CalDAV protocol with app-specific password authentication.
 * No OAuth flow — user provides credentials directly.
 */

import type {
  CalendarProvider,
  CalendarAuthResult,
  ExternalCalendarEvent,
} from "./calendar-provider.interface";

const ICLOUD_CALDAV = "https://caldav.icloud.com";

export class CalDAVCalendarProvider implements CalendarProvider {
  readonly providerName = "caldav" as const;

  getAuthUrl(_state: string): string {
    // CalDAV uses direct credentials, not OAuth
    // Return empty — the frontend handles credential collection
    return "";
  }

  async handleCallback(credentialsJson: string): Promise<CalendarAuthResult> {
    // For CalDAV, "code" is actually a JSON string with { username, appPassword }
    const { username, appPassword } = JSON.parse(credentialsJson) as {
      username: string;
      appPassword: string;
    };

    // Verify credentials by making a PROPFIND request
    const res = await fetch(`${ICLOUD_CALDAV}/${username}/calendars/`, {
      method: "PROPFIND",
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${appPassword}`).toString("base64")}`,
        Depth: "1",
        "Content-Type": "application/xml",
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:displayname/><d:resourcetype/></d:prop>
</d:propfind>`,
    });

    if (!res.ok) {
      throw new Error("CalDAV authentication failed — check your app-specific password");
    }

    return {
      accessToken: appPassword,
      refreshToken: null,
      externalCalendarId: username,
      externalAccountId: username,
      label: "Apple Calendar",
      tokenExpiresAt: null, // App-specific passwords don't expire
      metadata: { username, caldavUrl: ICLOUD_CALDAV },
    };
  }

  async fetchEvents(
    appPassword: string,
    calendarId: string,
    since?: Date,
    until?: Date
  ): Promise<ExternalCalendarEvent[]> {
    const timeFilter = since && until
      ? `<c:time-range start="${formatCalDAVDate(since)}" end="${formatCalDAVDate(until)}"/>`
      : "";

    const body = `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:getetag/><c:calendar-data/></d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">${timeFilter}</c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

    const res = await fetch(`${ICLOUD_CALDAV}/${calendarId}/calendars/`, {
      method: "REPORT",
      headers: {
        Authorization: `Basic ${Buffer.from(`${calendarId}:${appPassword}`).toString("base64")}`,
        Depth: "1",
        "Content-Type": "application/xml",
      },
      body,
    });

    if (!res.ok) return [];

    const xml = await res.text();
    return parseICalEvents(xml);
  }

  async refreshAccessToken(_refreshToken: string) {
    // App-specific passwords don't need refresh
    return { accessToken: _refreshToken, expiresAt: null };
  }

  async revokeAccess(_accessToken: string) {
    // User must revoke app-specific password via Apple ID settings
  }
}

function formatCalDAVDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** Basic iCal VEVENT parser */
function parseICalEvents(xml: string): ExternalCalendarEvent[] {
  const events: ExternalCalendarEvent[] = [];
  // Extract calendar-data from multistatus response
  const calDataRegex = /<c:calendar-data[^>]*>([\s\S]*?)<\/c:calendar-data>/gi;
  let match: RegExpExecArray | null;

  while ((match = calDataRegex.exec(xml)) !== null) {
    const ical = match[1]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

    const veventMatch = ical.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/);
    if (!veventMatch) continue;

    const vevent = veventMatch[0];
    const uid = extractICalProp(vevent, "UID") || `unknown-${events.length}`;
    const summary = extractICalProp(vevent, "SUMMARY");
    const dtstart = extractICalProp(vevent, "DTSTART");
    const dtend = extractICalProp(vevent, "DTEND");
    const status = extractICalProp(vevent, "STATUS");
    const location = extractICalProp(vevent, "LOCATION");
    const attendee = extractICalProp(vevent, "ATTENDEE");

    if (!dtstart || !dtend) continue;

    events.push({
      externalEventId: uid,
      title: summary || null,
      startTime: parseICalDate(dtstart),
      endTime: parseICalDate(dtend),
      status: status === "CANCELLED" ? "cancelled" : status === "TENTATIVE" ? "tentative" : "confirmed",
      attendeeEmail: attendee?.replace(/^mailto:/i, ""),
      location: location || undefined,
    });
  }

  return events;
}

function extractICalProp(vevent: string, prop: string): string | undefined {
  const regex = new RegExp(`^${prop}[^:]*:(.+)$`, "mi");
  const match = vevent.match(regex);
  return match?.[1]?.trim();
}

function parseICalDate(dateStr: string): Date {
  // Handle YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
  const clean = dateStr.replace(/[^0-9TZ]/g, "");
  if (clean.length >= 15) {
    const y = clean.slice(0, 4);
    const m = clean.slice(4, 6);
    const d = clean.slice(6, 8);
    const h = clean.slice(9, 11);
    const min = clean.slice(11, 13);
    const s = clean.slice(13, 15);
    return new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`);
  }
  return new Date(dateStr);
}
