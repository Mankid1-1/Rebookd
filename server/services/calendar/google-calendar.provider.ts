/**
 * Google Calendar Provider
 * OAuth 2.0 integration with Google Calendar API v3
 */

import type {
  CalendarProvider,
  CalendarAuthResult,
  ExternalCalendarEvent,
} from "./calendar-provider.interface";
import { ENV } from "../../_core/env";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
].join(" ");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export class GoogleCalendarProvider implements CalendarProvider {
  readonly providerName = "google" as const;

  private get redirectUri() {
    return `${ENV.backendUrl}/api/calendar/google/callback`;
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: ENV.googleCalendarClientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async handleCallback(code: string): Promise<CalendarAuthResult> {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: ENV.googleCalendarClientId,
        client_secret: ENV.googleCalendarClientSecret,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google token exchange failed: ${err}`);
    }

    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    // Get user's primary calendar info
    const calRes = await fetch(`${CALENDAR_API}/calendars/primary`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const cal = calRes.ok ? ((await calRes.json()) as { id: string; summary: string }) : { id: "primary", summary: "Google Calendar" };

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      externalCalendarId: cal.id,
      externalAccountId: cal.id,
      label: cal.summary || "Google Calendar",
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    };
  }

  async fetchEvents(
    accessToken: string,
    calendarId: string,
    since?: Date,
    until?: Date
  ): Promise<ExternalCalendarEvent[]> {
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (since) params.set("timeMin", since.toISOString());
    if (until) params.set("timeMax", until.toISOString());

    const res = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      throw new Error(`Google Calendar API error: ${res.status}`);
    }

    const data = (await res.json()) as {
      items: Array<{
        id: string;
        summary?: string;
        start: { dateTime?: string; date?: string };
        end: { dateTime?: string; date?: string };
        status: string;
        attendees?: Array<{ email: string; displayName?: string }>;
        location?: string;
      }>;
    };

    return (data.items || []).map((ev) => {
      const startStr = ev.start.dateTime || ev.start.date || "";
      const endStr = ev.end.dateTime || ev.end.date || "";
      const attendee = ev.attendees?.[0];

      let status: "confirmed" | "cancelled" | "tentative" = "confirmed";
      if (ev.status === "cancelled") status = "cancelled";
      else if (ev.status === "tentative") status = "tentative";

      return {
        externalEventId: ev.id,
        title: ev.summary || null,
        startTime: new Date(startStr),
        endTime: new Date(endStr),
        status,
        attendeeName: attendee?.displayName,
        attendeeEmail: attendee?.email,
        location: ev.location,
      };
    });
  }

  async refreshAccessToken(refreshToken: string) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: ENV.googleCalendarClientId,
        client_secret: ENV.googleCalendarClientSecret,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) throw new Error("Google token refresh failed");

    const data = (await res.json()) as { access_token: string; expires_in: number };
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async revokeAccess(accessToken: string) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
      method: "POST",
    });
  }
}
