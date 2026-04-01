/**
 * Outlook / Microsoft Calendar Provider
 * OAuth 2.0 with Microsoft Graph API
 */

import type {
  CalendarProvider,
  CalendarAuthResult,
  ExternalCalendarEvent,
} from "./calendar-provider.interface";
import { ENV } from "../../_core/env";

const AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH_API = "https://graph.microsoft.com/v1.0";
const SCOPES = "Calendars.Read offline_access";

export class OutlookCalendarProvider implements CalendarProvider {
  readonly providerName = "outlook" as const;

  private get redirectUri() {
    return `${ENV.backendUrl}/api/calendar/outlook/callback`;
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: ENV.outlookClientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: SCOPES,
      response_mode: "query",
      state,
    });
    return `${AUTH_URL}/authorize?${params}`;
  }

  async handleCallback(code: string): Promise<CalendarAuthResult> {
    const res = await fetch(`${AUTH_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: ENV.outlookClientId,
        client_secret: ENV.outlookClientSecret,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!res.ok) throw new Error(`Outlook token exchange failed: ${await res.text()}`);

    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    // Get user profile
    const profileRes = await fetch(`${GRAPH_API}/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = profileRes.ok
      ? ((await profileRes.json()) as { id: string; displayName: string; mail: string })
      : { id: "default", displayName: "Outlook Calendar", mail: "" };

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      externalCalendarId: "primary",
      externalAccountId: profile.id,
      label: `${profile.displayName || "Outlook"} Calendar`,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    };
  }

  async fetchEvents(
    accessToken: string,
    _calendarId: string,
    since?: Date,
    until?: Date
  ): Promise<ExternalCalendarEvent[]> {
    const params = new URLSearchParams({
      $orderby: "start/dateTime",
      $top: "250",
      $select: "id,subject,start,end,isCancelled,attendees,location",
    });
    if (since) params.set("startDateTime", since.toISOString());
    if (until) params.set("endDateTime", until.toISOString());

    const url = `${GRAPH_API}/me/calendarView?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' },
    });

    if (!res.ok) throw new Error(`Outlook Calendar API error: ${res.status}`);

    const data = (await res.json()) as {
      value: Array<{
        id: string;
        subject?: string;
        start: { dateTime: string };
        end: { dateTime: string };
        isCancelled?: boolean;
        attendees?: Array<{
          emailAddress: { address: string; name: string };
          status: { response: string };
        }>;
        location?: { displayName?: string };
      }>;
    };

    return (data.value || []).map((ev) => {
      const attendee = ev.attendees?.[0];
      return {
        externalEventId: ev.id,
        title: ev.subject || null,
        startTime: new Date(ev.start.dateTime + "Z"),
        endTime: new Date(ev.end.dateTime + "Z"),
        status: ev.isCancelled ? "cancelled" : "confirmed",
        attendeeName: attendee?.emailAddress?.name,
        attendeeEmail: attendee?.emailAddress?.address,
        location: ev.location?.displayName,
      };
    });
  }

  async refreshAccessToken(refreshToken: string) {
    const res = await fetch(`${AUTH_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: ENV.outlookClientId,
        client_secret: ENV.outlookClientSecret,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) throw new Error("Outlook token refresh failed");

    const data = (await res.json()) as { access_token: string; expires_in: number };
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async revokeAccess(_accessToken: string) {
    // Microsoft doesn't have a simple revoke endpoint; token expires naturally
  }
}
