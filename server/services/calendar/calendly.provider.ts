/**
 * Calendly Calendar Provider
 * OAuth 2.0 integration with Calendly API v2
 */

import type {
  CalendarProvider,
  CalendarAuthResult,
  ExternalCalendarEvent,
} from "./calendar-provider.interface";
import { ENV } from "../../_core/env";

const AUTH_BASE = "https://auth.calendly.com/oauth";
const API_BASE = "https://api.calendly.com";

export class CalendlyProvider implements CalendarProvider {
  readonly providerName = "calendly" as const;

  private get redirectUri() {
    return `${ENV.backendUrl}/api/calendar/calendly/callback`;
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: ENV.calendlyClientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      state,
    });
    return `${AUTH_BASE}/authorize?${params}`;
  }

  async handleCallback(code: string): Promise<CalendarAuthResult> {
    const res = await fetch(`${AUTH_BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: ENV.calendlyClientId,
        client_secret: ENV.calendlyClientSecret,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!res.ok) throw new Error(`Calendly token exchange failed: ${await res.text()}`);

    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      owner: string;
      organization: string;
    };

    // Get user info
    const userRes = await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userData = userRes.ok
      ? ((await userRes.json()) as { resource: { uri: string; name: string; email: string } })
      : { resource: { uri: tokens.owner, name: "Calendly User", email: "" } };

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      externalCalendarId: userData.resource.uri,
      externalAccountId: userData.resource.uri,
      label: `${userData.resource.name} (Calendly)`,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      metadata: { organization: tokens.organization },
    };
  }

  async fetchEvents(
    accessToken: string,
    userUri: string,
    since?: Date,
    until?: Date
  ): Promise<ExternalCalendarEvent[]> {
    const params = new URLSearchParams({
      user: userUri,
      status: "active",
      count: "100",
    });
    if (since) params.set("min_start_time", since.toISOString());
    if (until) params.set("max_start_time", until.toISOString());

    const res = await fetch(`${API_BASE}/scheduled_events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) throw new Error(`Calendly API error: ${res.status}`);

    const data = (await res.json()) as {
      collection: Array<{
        uri: string;
        name: string;
        start_time: string;
        end_time: string;
        status: string;
        location?: { location?: string };
        invitees_counter: { active: number; limit: number };
      }>;
    };

    const events: ExternalCalendarEvent[] = [];

    for (const ev of data.collection || []) {
      // Fetch invitees for attendee info
      let attendeeName: string | undefined;
      let attendeeEmail: string | undefined;

      try {
        const invRes = await fetch(`${ev.uri}/invitees?count=1`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (invRes.ok) {
          const invData = (await invRes.json()) as {
            collection: Array<{ name: string; email: string }>;
          };
          const inv = invData.collection?.[0];
          if (inv) {
            attendeeName = inv.name;
            attendeeEmail = inv.email;
          }
        }
      } catch {
        // Skip invitee fetch failures
      }

      events.push({
        externalEventId: ev.uri.split("/").pop() || ev.uri,
        title: ev.name || null,
        startTime: new Date(ev.start_time),
        endTime: new Date(ev.end_time),
        status: ev.status === "canceled" ? "cancelled" : "confirmed",
        attendeeName,
        attendeeEmail,
        location: ev.location?.location,
      });
    }

    return events;
  }

  async refreshAccessToken(refreshToken: string) {
    const res = await fetch(`${AUTH_BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: ENV.calendlyClientId,
        client_secret: ENV.calendlyClientSecret,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) throw new Error("Calendly token refresh failed");

    const data = (await res.json()) as { access_token: string; expires_in: number };
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async revokeAccess(accessToken: string) {
    await fetch(`${AUTH_BASE}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${ENV.calendlyClientId}:${ENV.calendlyClientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ token: accessToken }),
    });
  }
}
