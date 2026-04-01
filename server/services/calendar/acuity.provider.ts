/**
 * Acuity Scheduling Provider
 * API key (Basic Auth) integration with Acuity API v1
 */

import type {
  CalendarProvider,
  CalendarAuthResult,
  ExternalCalendarEvent,
} from "./calendar-provider.interface";
import { ENV } from "../../_core/env";

const API_BASE = "https://acuityscheduling.com/api/v1";

export class AcuityProvider implements CalendarProvider {
  readonly providerName = "acuity" as const;

  getAuthUrl(_state: string): string {
    // Acuity uses API key auth, not OAuth
    // Frontend handles credential collection
    return "";
  }

  async handleCallback(credentialsJson: string): Promise<CalendarAuthResult> {
    // "code" is a JSON string with { userId, apiKey } or we use env vars
    let userId: string;
    let apiKey: string;

    try {
      const parsed = JSON.parse(credentialsJson) as { userId: string; apiKey: string };
      userId = parsed.userId;
      apiKey = parsed.apiKey;
    } catch {
      // Fall back to env vars
      userId = ENV.acuityUserId;
      apiKey = ENV.acuityApiKey;
    }

    if (!userId || !apiKey) {
      throw new Error("Acuity credentials required");
    }

    // Verify credentials
    const auth = Buffer.from(`${userId}:${apiKey}`).toString("base64");
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!res.ok) throw new Error("Acuity authentication failed");

    const me = (await res.json()) as { id: number; firstName: string; lastName: string; email: string };

    return {
      accessToken: apiKey,
      refreshToken: null,
      externalCalendarId: String(me.id),
      externalAccountId: String(me.id),
      label: `${me.firstName} ${me.lastName} (Acuity)`,
      tokenExpiresAt: null, // API keys don't expire
      metadata: { userId, email: me.email },
    };
  }

  async fetchEvents(
    apiKey: string,
    _calendarId: string,
    since?: Date,
    until?: Date
  ): Promise<ExternalCalendarEvent[]> {
    const metadata = JSON.parse(_calendarId || "{}");
    const userId = metadata.userId || ENV.acuityUserId;
    const auth = Buffer.from(`${userId}:${apiKey}`).toString("base64");

    const params = new URLSearchParams({ max: "100" });
    if (since) params.set("minDate", since.toISOString().split("T")[0]);
    if (until) params.set("maxDate", until.toISOString().split("T")[0]);

    const res = await fetch(`${API_BASE}/appointments?${params}`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!res.ok) throw new Error(`Acuity API error: ${res.status}`);

    const appointments = (await res.json()) as Array<{
      id: number;
      type: string;
      datetime: string;
      endTime: string;
      canceled: boolean;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      location: string;
    }>;

    return appointments.map((appt) => ({
      externalEventId: String(appt.id),
      title: appt.type || null,
      startTime: new Date(appt.datetime),
      endTime: new Date(appt.endTime),
      status: appt.canceled ? "cancelled" : "confirmed",
      attendeeName: `${appt.firstName} ${appt.lastName}`.trim(),
      attendeeEmail: appt.email,
      attendeePhone: appt.phone,
      location: appt.location,
    }));
  }

  async refreshAccessToken(apiKey: string) {
    // API keys don't expire
    return { accessToken: apiKey, expiresAt: null };
  }

  async revokeAccess(_accessToken: string) {
    // API keys must be revoked via Acuity dashboard
  }
}
